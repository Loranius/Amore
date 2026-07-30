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
      const crowding = clamp01(body.crowding / 4);
      const surfaceStress = round6(clamp01(
        body.competition * 0.45
        + crowding * 0.2
        + localDensity * 0.35
        + (occupied ? 0.15 : 0),
      ));
      const upwardExposure = clamp01((surfaceNormal.y + 1) * 0.5);
      const growthPotential = !exposed || occupied
        ? 0
        : round6(clamp01(
          (1 - surfaceStress) * 0.55
          + (1 - localDensity) * 0.25
          + upwardExposure * 0.15
          + (1 - body.maturity) * 0.05,
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
 * density, stress and exposure are current-field values derived from the full
 * mineral mass.
 */
export function buildGrowthSurfaceAtlas(state: GrowthState): GrowthSurfaceAtlas {
  return buildGrowthSurfaceAtlasFromMass({
    species: state.species,
    bodies: state.bodies,
    occupiedSites: state.surfaceMap.occupiedSites,
  });
}
