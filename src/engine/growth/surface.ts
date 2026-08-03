import {
  GROWTH_UP,
  add,
  clamp,
  directionFromAzimuthElevation,
  ensureUpward,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  seededUnit,
} from './math';
import type { GrowthSurfaceRegion } from './surfaceAtlas';
import type {
  GrowthAttachment,
  GrowthBody,
  GrowthVec3,
  UniversalGrowthInstruction,
} from './types';

export interface GrowthSiteCandidate {
  siteKey: string;
  surfaceRegionId: string | null;
  candidateIndex: number;
  host: GrowthBody;
  hostT: number;
  hostAngleRad: number;
  surfacePoint: GrowthVec3;
  surfaceNormal: GrowthVec3;
  surfacePotential: number;
  surfaceStress: number;
  localDensity: number;
  growthShadow: number;
  competitionPressure: number;
  anchor: GrowthVec3;
  direction: GrowthVec3;
  burialDepth: number;
}

function radiusAt(host: GrowthBody, hostT: number): number {
  return host.skeletonRadius
    * host.surfaceRadiusScale
    * (1 - clamp(hostT, 0, 1) * 0.62);
}

/**
 * How deep a child may bury itself at this point on the host before its base
 * leaves the host solid.
 *
 * Two limits apply and the tighter one wins. A child that grows roughly
 * parallel to its host sinks back along the host's axis, so it cannot bury
 * deeper than the host body that remains below the contact. A child that grows
 * out sideways sinks toward the axis, so it is limited by how wide the host is
 * there. Ignoring either one lets a small host be punched straight through,
 * which leaves the junction unsealed and exposes a base cap.
 */
export function hostBurialCapacity(host: GrowthBody, hostT: number): number {
  const axialRoom = clamp(hostT, 0, 1) * host.skeletonLength;
  const radialRoom = radiusAt(host, hostT) * 1.2;
  return Math.max(0, Math.min(axialRoom, radialRoom));
}

export function bodyEnd(body: Pick<GrowthBody, 'anchor' | 'direction' | 'skeletonLength'>): GrowthVec3 {
  return add(body.anchor, scale(body.direction, body.skeletonLength));
}

function growthDirection(
  host: GrowthBody,
  surfaceNormal: GrowthVec3,
  instruction: UniversalGrowthInstruction,
): GrowthVec3 {
  const preferred = directionFromAzimuthElevation(
    instruction.preferredAzimuthRad,
    instruction.preferredElevation,
  );
  const inherited = instruction.directionInheritance;
  return ensureUpward(
    add(
      add(scale(surfaceNormal, inherited), scale(preferred, 1 - inherited)),
      scale(host.direction, 0.12),
    ),
    instruction.minUpwardComponent,
  );
}

function dominantCrystalBasalHostT(
  host: GrowthBody,
  instruction: UniversalGrowthInstruction,
  region: GrowthSurfaceRegion,
): number | null {
  const dominantCrystal = host.species === 'crystal'
    && host.generation === 0
    && instruction.growthCenterRole === 'dominant';
  if (!dominantCrystal) return null;

  // Phase 3B-1: large daughter crystals must nucleate around the monarch foot,
  // never on its middle or upper shaft. Keep a bounded 15-33% basal ring while
  // preserving deterministic variation between sectors and stable instructions.
  const basalDraw = seededUnit(
    instruction.seed,
    `crystal:basal-host-t:${region.sectorIndex}`,
  );
  return round6(0.15 + basalDraw * 0.18);
}

function remappedRegionSurface(
  host: GrowthBody,
  instruction: UniversalGrowthInstruction,
  region: GrowthSurfaceRegion,
): {
  hostT: number;
  surfacePoint: GrowthVec3;
  surfaceNormal: GrowthVec3;
} {
  const basalHostT = dominantCrystalBasalHostT(host, instruction, region);
  if (basalHostT === null) {
    return {
      hostT: region.hostT,
      surfacePoint: region.surfacePosition,
      surfaceNormal: region.surfaceNormal,
    };
  }

  const { tangent, bitangent } = orthonormalBasis(host.direction);
  const radialNormal = normalize(add(
    scale(tangent, Math.cos(region.azimuthRad)),
    scale(bitangent, Math.sin(region.azimuthRad)),
  ));
  const center = add(host.anchor, scale(host.direction, host.skeletonLength * basalHostT));
  return {
    hostT: basalHostT,
    surfacePoint: roundVec(add(center, scale(radialNormal, radiusAt(host, basalHostT)))),
    surfaceNormal: roundVec(normalize(add(
      scale(radialNormal, 0.92),
      scale(host.direction, 0.08),
    ))),
  };
}

/**
 * Identifies sites on the substrate rather than on another body. It is not a
 * real body and is never published — it exists so ground-rooted candidates
 * share an angular-separation namespace and therefore spread around the
 * monarch instead of piling into one sector.
 */
export const GROUND_HOST_ID = '__ground';

function groundHost(root: GrowthBody): GrowthBody {
  return { ...root, id: GROUND_HOST_ID, generation: 0 };
}

/**
 * The most a ground-rooted body may lean away from the axis, as the weight its
 * outward bearing takes against straight up.
 *
 * Exported because the species layer has to be able to *ask for* an angle. A
 * lean of `l` puts a body at `atan((1−l)/l)` above the platform, so this
 * constant is the ceiling on how far any species can splay a formation — it was
 * a bare 0.55 here and a private copy of the same number in `growthModel`, and
 * two copies of a number that has to agree is a bug waiting to be written.
 *
 * 0.7 admits a lean of up to 55° off the monarch's axis, which is what the
 * crystal's crown of year bodies asks for. Volume III still owns the ceiling;
 * the species only picks a point under it.
 */
export const GROUND_LEAN_SCALE = 0.7;

/**
 * Places a body in the substrate around the monarch instead of on her shaft.
 *
 * Companion crystals used to attach to the monarch's own surface, which read
 * as pieces stuck onto her — the reference art instead shows one spire with
 * separate crystals rising from the same ground around it. Rooting them in the
 * ground also removes the host/child junction entirely, so these bodies are no
 * longer bound by whether their base ring stays enclosed in a host.
 *
 * The base still sits below y=0 and keeps its cap: the cap is occluded by the
 * scene's ground rather than deleted, so no internal face is ever exposed even
 * if the camera drops below the horizon.
 */
export function sampleGroundSite(
  root: GrowthBody,
  instruction: UniversalGrowthInstruction,
  candidateIndex: number,
): GrowthSiteCandidate {
  // An instruction that states its own distance owns its placement outright:
  // the species has already assigned it a slot, so neither the candidate
  // sweep nor jitter may move it.
  //
  // Both halves of that mattered. Deriving the radius from the root's own
  // radius — the only option before ADR-0004 — meant thickening the monarch
  // shifted every body standing around her. And letting competition pick
  // among twelve sampled bearings meant a single new event could hand a
  // finished year a completely different bearing. Either way a new photo
  // reshuffled the whole druse, and a "frozen" year was not frozen.
  const stated = instruction.ringDistance ?? null;
  const placed = stated !== null && Number.isFinite(stated) && stated > 0;

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angleJitter = (seededUnit(instruction.seed, `ground:${candidateIndex}:angle`) - 0.5) * 0.85;
  const azimuth = round6(
    placed
      ? instruction.preferredAzimuthRad
      : instruction.preferredAzimuthRad + candidateIndex * goldenAngle + angleJitter,
  );
  const outward = { x: Math.cos(azimuth), y: 0, z: Math.sin(azimuth) };

  // Without a stated distance the engine falls back to standing the body just
  // clear of the root's footprint, with deterministic spread so bodies do not
  // land on a perfect circle.
  const ringRadius = placed
    ? round6(stated)
    : round6(
        (root.skeletonRadius * 0.95 + instruction.radialScale * 0.95)
        * (0.82 + seededUnit(instruction.seed, `ground:${candidateIndex}:radius`) * 0.5),
      );
  const surfacePoint = {
    x: round6(outward.x * ringRadius),
    y: 0,
    z: round6(outward.z * ringRadius),
  };

  // radialBias already encodes "how far out this formation reaches", so it
  // doubles as the outward tilt; ensureUpward keeps it from lying down flat.
  const lean = clamp(instruction.radialBias, 0, 1) * GROUND_LEAN_SCALE;
  const direction = ensureUpward(
    add(scale(GROWTH_UP, 1 - lean), scale(outward, lean)),
    instruction.minUpwardComponent,
  );

  const burialDepth = round6(instruction.radialScale * 0.9);
  const anchor = add(surfacePoint, scale(direction, -burialDepth));

  return {
    siteKey: `${GROUND_HOST_ID}:site:${instruction.id}:${candidateIndex}`,
    surfaceRegionId: null,
    candidateIndex,
    host: groundHost(root),
    hostT: 0,
    hostAngleRad: azimuth,
    surfacePoint: roundVec(surfacePoint),
    surfaceNormal: { x: 0, y: 1, z: 0 },
    surfacePotential: 0.8,
    surfaceStress: 0,
    localDensity: 0,
    growthShadow: 0,
    competitionPressure: 0,
    anchor: roundVec(anchor),
    direction: roundVec(direction),
    burialDepth,
  };
}

/** Compatibility sampler retained for non-atlas callers. */
export function sampleGrowthSite(
  host: GrowthBody,
  instruction: UniversalGrowthInstruction,
  candidateIndex: number,
): GrowthSiteCandidate {
  const tJitter = (seededUnit(instruction.seed, `site:${candidateIndex}:t`) - 0.5) * 0.34;
  const hostT = round6(clamp(0.16 + instruction.radialBias * 0.62 + tJitter, 0.12, 0.88));

  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const angleJitter = (seededUnit(instruction.seed, `site:${candidateIndex}:angle`) - 0.5) * 0.7;
  const hostAngleRad = round6(
    instruction.preferredAzimuthRad + candidateIndex * goldenAngle + angleJitter,
  );

  const { tangent, bitangent } = orthonormalBasis(host.direction);
  const radialNormal = normalize(add(
    scale(tangent, Math.cos(hostAngleRad)),
    scale(bitangent, Math.sin(hostAngleRad)),
  ));
  const center = add(host.anchor, scale(host.direction, host.skeletonLength * hostT));
  const surfacePoint = add(center, scale(radialNormal, radiusAt(host, hostT)));
  const surfaceNormal = normalize(add(scale(radialNormal, 0.92), scale(host.direction, 0.08)));
  const direction = growthDirection(host, surfaceNormal, instruction);

  const burialDepth = round6(Math.min(
    instruction.radialScale * instruction.attachmentDepth,
    hostBurialCapacity(host, hostT) * 0.4,
  ));
  const anchor = add(surfacePoint, scale(direction, -burialDepth));

  return {
    siteKey: `${host.id}:site:${instruction.id}:${candidateIndex}`,
    surfaceRegionId: null,
    candidateIndex,
    host,
    hostT,
    hostAngleRad,
    surfacePoint: roundVec(surfacePoint),
    surfaceNormal: roundVec(surfaceNormal),
    surfacePotential: 0.5,
    surfaceStress: 0,
    localDensity: 0,
    growthShadow: 0,
    competitionPressure: 0,
    anchor: roundVec(anchor),
    direction: roundVec(direction),
    burialDepth,
  };
}

/** Creates a candidate from one stable region of the aggregate Surface Atlas. */
export function sampleGrowthRegionSite(
  host: GrowthBody,
  region: GrowthSurfaceRegion,
  instruction: UniversalGrowthInstruction,
  candidateIndex: number,
): GrowthSiteCandidate {
  const remapped = remappedRegionSurface(host, instruction, region);
  const surfaceNormal = normalize(remapped.surfaceNormal);
  const direction = growthDirection(host, surfaceNormal, instruction);
  const burialDepth = round6(Math.min(
    instruction.radialScale * instruction.attachmentDepth,
    hostBurialCapacity(host, remapped.hostT) * 0.4,
  ));
  const anchor = add(remapped.surfacePoint, scale(direction, -burialDepth));

  return {
    siteKey: `${region.id}:site:${instruction.id}`,
    surfaceRegionId: region.id,
    candidateIndex,
    host,
    hostT: remapped.hostT,
    hostAngleRad: region.azimuthRad,
    surfacePoint: remapped.surfacePoint,
    surfaceNormal: remapped.surfaceNormal,
    surfacePotential: region.growthPotential,
    surfaceStress: region.surfaceStress,
    localDensity: region.localDensity,
    growthShadow: region.growthShadow,
    competitionPressure: region.competitionPressure,
    anchor: roundVec(anchor),
    direction: roundVec(direction),
    burialDepth,
  };
}

export function attachmentFromSite(site: GrowthSiteCandidate): GrowthAttachment {
  return {
    siteKey: site.siteKey,
    ...(site.surfaceRegionId === null ? {} : { surfaceRegionId: site.surfaceRegionId }),
    hostBodyId: site.host.id,
    hostT: site.hostT,
    hostAngleRad: site.hostAngleRad,
    point: site.surfacePoint,
    normal: site.surfaceNormal,
    burialDepth: site.burialDepth,
    ...(site.surfaceRegionId === null
      ? {}
      : {
          growthShadow: round6(site.growthShadow),
          competitionPressure: round6(site.competitionPressure),
        }),
  };
}