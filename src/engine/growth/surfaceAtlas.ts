import {
  add,
  angularDistance,
  clamp,
  clamp01,
  distance,
  dot,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  seededUnit,
  subtract,
} from './math';
import type {
  GrowthBody,
  GrowthState,
  GrowthSurfaceOccupancy,
  GrowthVec3,
} from './types';

const SURFACE_BANDS = [0.14, 0.34, 0.56, 0.76, 0.9] as const;
const SURFACE_SECTOR_COUNT = 8;
const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface GrowthSurfaceRegion {
  readonly id: string;
  readonly sourceBodyId: string;
  readonly bandIndex: number;
  readonly sectorIndex: number;
  readonly hostT: number;
  readonly azimuthRad: number;
  readonly surfacePosition: GrowthVec3;
  readonly surfaceNormal: GrowthVec3;
  readonly exposed: boolean;
  readonly occupied: boolean;
  readonly surfaceStress: number;
  readonly growthPotential: number;
  readonly localDensity: number;
  /** Light/resource suppression produced by nearby mature crystal bodies. */
  readonly growthShadow: number;
  /** Extra local pressure produced by bodies in the same Growth Center. */
  readonly competitionPressure: number;
  readonly maturity: number;
}

export interface GrowthSurfaceAtlas {
  readonly surfaceAtlasVersion: 1;
  readonly species: string;
  readonly bodyCount: number;
  readonly regionCount: number;
  readonly exposedRegionCount: number;
  readonly activeRegionCount: number;
  readonly regions: readonly GrowthSurfaceRegion[];
}

export interface BuildGrowthSurfaceAtlasFromMassInput {
  readonly species: string;
  readonly bodies: readonly GrowthBody[];
  readonly occupiedSites: readonly GrowthSurfaceOccupancy[];
}

interface AxisProjection {
  readonly t: number;
  readonly rawT: number;
  readonly axisPoint: GrowthVec3;
  readonly axisDistance: number;
}

interface GrowthShadowField {
  readonly growthShadow: number;
  readonly competitionPressure: number;
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function radiusAt(body: GrowthBody, hostT: number): number {
  return body.skeletonRadius
    * body.surfaceRadiusScale
    * (1 - clamp(hostT, 0, 1) * 0.62);
}

function projectToAxis(body: GrowthBody, point: GrowthVec3): AxisProjection {
  const relative = subtract(point, body.anchor);
  const axialDistance = dot(relative, body.direction);
  const rawT = axialDistance / body.skeletonLength;
  const t = clamp(rawT, 0, 1);
  const axisPoint = add(body.anchor, scale(body.direction, body.skeletonLength * t));
  return {
    t,
    rawT,
    axisPoint,
    axisDistance: distance(point, axisPoint),
  };
}

function isCoveredByAnotherBody(
  sourceBodyId: string,
  point: GrowthVec3,
  bodies: readonly GrowthBody[],
): boolean {
  for (const body of bodies) {
    if (body.id === sourceBodyId) continue;
    const projection = projectToAxis(body, point);
    if (projection.rawT < -0.04 || projection.rawT > 1.04) continue;
    const envelope = radiusAt(body, projection.t) * 0.9;
    if (projection.axisDistance < envelope) return true;
  }
  return false;
}

function densityAt(
  sourceBodyId: string,
  point: GrowthVec3,
  sourceRadius: number,
  bodies: readonly GrowthBody[],
): number {
  let accumulated = 0;
  for (const body of bodies) {
    if (body.id === sourceBodyId) continue;
    const projection = projectToAxis(body, point);
    if (projection.rawT < -0.15 || projection.rawT > 1.15) continue;
    const otherRadius = radiusAt(body, projection.t);
    const clearance = Math.max(0, projection.axisDistance - otherRadius);
    const influence = Math.max(0.000001, sourceRadius * 2.4 + otherRadius * 1.8);
    accumulated += clamp01(1 - clearance / influence);
  }
  return round6(clamp01(accumulated / 3));
}

function bodyShadowStrength(body: GrowthBody): number {
  const size = clamp01(
    (body.skeletonLength * 0.48 + body.skeletonRadius * 3.2) / 1.5,
  );
  const maturity = 0.2 + clamp01(body.maturity) * 0.8;
  const role = body.growthCenterRole === 'dominant'
    ? 1
    : body.tier === 'king'
      ? 0.95
      : body.growthCenterRole === 'satellite'
        ? 0.72
        : body.tier === 'support' || body.tier === 'family'
          ? 0.64
          : body.tier === 'companion'
            ? 0.5
            : 0.32;
  const energy = 0.5 + clamp01(body.growthEnergy) * 0.5;
  return clamp01(size * maturity * role * energy);
}

function shadowFieldAt(
  species: string,
  sourceBody: GrowthBody,
  point: GrowthVec3,
  surfaceNormal: GrowthVec3,
  bodies: readonly GrowthBody[],
): GrowthShadowField {
  if (species !== 'crystal') {
    return { growthShadow: 0, competitionPressure: 0 };
  }

  let transmission = 1;
  let sameCenterPressure = 0;
  const sourceCenterId = sourceBody.growthCenterId ?? null;

  for (const body of bodies) {
    if (body.id === sourceBody.id) continue;
    const projection = projectToAxis(body, point);
    if (projection.rawT < -0.25 || projection.rawT > 1.25) continue;

    const otherRadius = radiusAt(body, projection.t);
    const clearance = Math.max(0, projection.axisDistance - otherRadius);
    const influenceRadius = Math.max(
      0.000001,
      0.08 + otherRadius * 4.6 + body.skeletonLength * 0.34,
    );
    const proximity = clamp01(1 - clearance / influenceRadius);
    if (proximity <= 0) continue;

    const towardAxis = normalize(
      subtract(projection.axisPoint, point),
      scale(surfaceNormal, -1),
    );
    const facing = clamp01((dot(surfaceNormal, towardAxis) + 1) * 0.5);
    const axialShelter = clamp01(1 - Math.abs(projection.rawT - 0.5) / 0.85);
    const sameCenter = sourceCenterId !== null
      && (body.growthCenterId ?? null) === sourceCenterId;
    const strength = clamp01(
      bodyShadowStrength(body)
      * proximity
      * (0.48 + facing * 0.32 + axialShelter * 0.2)
      * (sameCenter ? 1.18 : 1),
    );

    transmission *= 1 - strength * 0.8;
    if (sameCenter) sameCenterPressure += strength;
  }

  return {
    growthShadow: round6(clamp01(1 - transmission)),
    competitionPressure: round6(clamp01(sameCenterPressure / 1.25)),
  };
}

function isOccupied(
  regionId: string,
  bodyId: string,
  hostT: number,
  azimuthRad: number,
  occupiedSites: readonly GrowthSurfaceOccupancy[],
): boolean {
  const angularWindow = (TAU / SURFACE_SECTOR_COUNT) * 0.72;
  return occupiedSites.some((site) => (
    site.surfaceRegionId === regionId
    || (
      site.hostBodyId === bodyId
      && Math.abs(site.hostT - hostT) <= 0.11
      && angularDistance(site.hostAngleRad, azimuthRad) <= angularWindow
    )
  ));
}

function buildBodyRegions(
  species: string,
  body: GrowthBody,
  bodies: readonly GrowthBody[],
  occupiedSites: readonly GrowthSurfaceOccupancy[],
): GrowthSurfaceRegion[] {
  const { tangent, bitangent } = orthonormalBasis(body.direction);
  const phase = seededUnit(body.seed, 'surface-atlas:phase') * TAU;
  const regions: GrowthSurfaceRegion[] = [];

  for (let bandIndex = 0; bandIndex < SURFACE_BANDS.length; bandIndex += 1) {
    const hostT = SURFACE_BANDS[bandIndex]!;
    const sourceRadius = radiusAt(body, hostT);
    const center = add(body.anchor, scale(body.direction, body.skeletonLength * hostT));

    for (let sectorIndex = 0; sectorIndex < SURFACE_SECTOR_COUNT; sectorIndex += 1) {
      const regionId = `${body.id}:region:${bandIndex}:${sectorIndex}`;
      const azimuthRad = round6(
        phase
        + sectorIndex * (TAU / SURFACE_SECTOR_COUNT)
        + bandIndex * GOLDEN_ANGLE * 0.28,
      );
      const radialNormal = normalize(add(
        scale(tangent, Math.cos(azimuthRad)),
        scale(bitangent, Math.sin(azimuthRad)),
      ));
      const surfacePosition = roundVec(add(center, scale(radialNormal, sourceRadius)));
      const surfaceNormal = roundVec(normalize(add(
        scale(radialNormal, 0.92),
        scale(body.direction, 0.08),
      )));
      const exposed = !isCoveredByAnotherBody(body.id, surfacePosition, bodies);
      const occupied = isOccupied(regionId, body.id, hostT, azimuthRad, occupiedSites);
      const localDensity = densityAt(body.id, surfacePosition, sourceRadius, bodies);
      const shadow = shadowFieldAt(species, body, surfacePosition, surfaceNormal, bodies);
      const crowding = clamp01(body.crowding / 4);
      const surfaceStress = round6(clamp01(
        body.competition * 0.32
        + crowding * 0.14
        + localDensity * 0.22
        + shadow.growthShadow * 0.22
        + shadow.competitionPressure * 0.1
        + (occupied ? 0.15 : 0),
      ));
      const upwardExposure = clamp01((surfaceNormal.y + 1) * 0.5);
      const basePotential = (1 - surfaceStress) * 0.44
        + (1 - localDensity) * 0.18
        + upwardExposure * 0.13
        + (1 - body.maturity) * 0.05
        + (1 - shadow.growthShadow) * 0.2;
      const growthPotential = !exposed || occupied
        ? 0
        : round6(clamp01(
          basePotential
          * (1 - shadow.growthShadow * 0.72)
          * (1 - shadow.competitionPressure * 0.45),
        ));

      regions.push({
        id: regionId,
        sourceBodyId: body.id,
        bandIndex,
        sectorIndex,
        hostT,
        azimuthRad,
        surfacePosition,
        surfaceNormal,
        exposed,
        occupied,
        surfaceStress,
        growthPotential,
        localDensity,
        growthShadow: shadow.growthShadow,
        competitionPressure: shadow.competitionPressure,
        maturity: round6(clamp01(body.maturity)),
      });
    }
  }

  return regions;
}

/**
 * Builds the atlas directly from the current aggregate analytical mass.
 * This keeps candidate selection independent from a completed GrowthState.
 */
export function buildGrowthSurfaceAtlasFromMass(
  input: BuildGrowthSurfaceAtlasFromMassInput,
): GrowthSurfaceAtlas {
  const bodies = [...input.bodies].sort(
    (left, right) => left.sequence - right.sequence || compareIds(left.id, right.id),
  );
  const regions = bodies.flatMap((body) => buildBodyRegions(
    input.species,
    body,
    bodies,
    input.occupiedSites,
  ));
  const exposedRegionCount = regions.filter((region) => region.exposed).length;
  const activeRegionCount = regions.filter((region) => region.growthPotential > 0).length;

  return {
    surfaceAtlasVersion: 1,
    species: input.species,
    bodyCount: bodies.length,
    regionCount: regions.length,
    exposedRegionCount,
    activeRegionCount,
    regions,
  };
}

/**
 * Builds a deterministic species-neutral atlas over the aggregate analytical
 * surface. Region identity and coordinates depend only on the source body;
 * density, stress, shadow and exposure are current-field values derived from
 * the full mineral mass.
 */
export function buildGrowthSurfaceAtlas(state: GrowthState): GrowthSurfaceAtlas {
  return buildGrowthSurfaceAtlasFromMass({
    species: state.species,
    bodies: state.bodies,
    occupiedSites: state.surfaceMap.occupiedSites,
  });
}
