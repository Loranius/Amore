import { round6, seededUnit } from './math';
import type {
  ReefModuleEvolutionEntity,
  ReefModuleEvolutionPlan,
} from './types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;
const MAXIMUM_ATTEMPTS = 32;

export interface ReefGrowthStructurePoint {
  x: number;
  y: number;
  z: number;
}

export interface ReefGrowthArchPlacement {
  id: string;
  sourceEntityId: string;
  yearIndex: number;
  center: ReefGrowthStructurePoint;
  rotationY: number;
  span: number;
  height: number;
  thickness: number;
  curveDepth: number;
  footprintRadius: number;
  seed: number;
}

export interface ReefGrowthOutcropPlacement {
  id: string;
  sourceEntityId: string;
  center: ReefGrowthStructurePoint;
  rotationY: number;
  footprintRadius: number;
  height: number;
  ledgeScale: number;
  seed: number;
}

export interface ReefGrowthTerracePlacement {
  id: string;
  sourceEntityId: string;
  center: ReefGrowthStructurePoint;
  rotationY: number;
  footprintRadius: number;
  thickness: number;
  seed: number;
}

export interface ReefGrowthStructureLayoutDiagnostics {
  rejectedArchIds: string[];
  rejectedOutcropIds: string[];
  rejectedTerraceIds: string[];
  minimumArchClearance: number | null;
  minimumExternalClearance: number | null;
  collisionFree: boolean;
}

export interface ReefGrowthStructureLayout {
  version: 'reef-growth-structure-layout-v1';
  visibleFoundationRadius: number;
  foundationScaleXZ: number;
  foundationScaleY: number;
  arches: ReefGrowthArchPlacement[];
  outcrops: ReefGrowthOutcropPlacement[];
  terraces: ReefGrowthTerracePlacement[];
  diagnostics: ReefGrowthStructureLayoutDiagnostics;
}

interface OccupiedCircle {
  id: string;
  x: number;
  z: number;
  radius: number;
}

function normalizeAngle(value: number): number {
  return ((value % TAU) + TAU) % TAU;
}

function collides(
  candidate: OccupiedCircle,
  occupied: readonly OccupiedCircle[],
  clearanceRatio: number,
): boolean {
  return occupied.some((other) => {
    const distance = Math.hypot(candidate.x - other.x, candidate.z - other.z);
    return distance < (candidate.radius + other.radius) * clearanceRatio - 1e-6;
  });
}

function minimumClearance(occupied: readonly OccupiedCircle[]): number | null {
  if (occupied.length < 2) return null;
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < occupied.length; left += 1) {
    const first = occupied[left];
    if (!first) continue;
    for (let right = left + 1; right < occupied.length; right += 1) {
      const second = occupied[right];
      if (!second) continue;
      minimum = Math.min(
        minimum,
        Math.hypot(first.x - second.x, first.z - second.z)
          - first.radius
          - second.radius,
      );
    }
  }
  return Number.isFinite(minimum) ? round6(minimum) : null;
}

function radialCandidate(
  entity: ReefModuleEvolutionEntity,
  index: number,
  attempt: number,
  minimumRadius: number,
  maximumRadius: number,
  footprintRadius: number,
): OccupiedCircle {
  const azimuth = normalizeAngle(
    seededUnit(entity.seed, 'azimuth') * TAU
      + index * GOLDEN_ANGLE
      + attempt * GOLDEN_ANGLE,
  );
  const distanceSeed = seededUnit(entity.seed, `radius:${attempt}`);
  const distance = minimumRadius + (maximumRadius - minimumRadius) * distanceSeed;
  return {
    id: entity.id,
    x: round6(Math.cos(azimuth) * distance),
    z: round6(Math.sin(azimuth) * distance),
    radius: footprintRadius,
  };
}

/**
 * Pure placement pass for time arches, map outcrops and Schedule terraces.
 * It reserves disjoint footprints before Three.js creates any mesh.
 */
export function buildReefGrowthStructureLayout(
  evolution: ReefModuleEvolutionPlan,
): ReefGrowthStructureLayout {
  const visibleFoundationRadius = round6(evolution.foundation.substrateRadius * 0.76);
  const foundationScaleXZ = round6(visibleFoundationRadius / 2.08);
  const foundationScaleY = round6(0.96 + evolution.foundation.radialSaturation * 0.34);
  // Geological footprints are already their final visual extents; unlike
  // living colonies they receive no later 1.54x presentation sculpt.
  const minimumClearanceRatio = Math.min(1.18, evolution.colonies.minimumClearanceRatio);

  const arches: ReefGrowthArchPlacement[] = [];
  const archCircles: OccupiedCircle[] = [];
  const rejectedArchIds: string[] = [];
  const visibleArches = evolution.entities.yearArches.slice(
    0,
    evolution.foundation.arches.visibleCount,
  );
  visibleArches.forEach((entity, index) => {
    const span = round6(1.18 + seededUnit(entity.seed, 'span') * 0.5);
    const footprintRadius = round6(span * 0.43);
    let accepted: OccupiedCircle | null = null;
    for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
      const candidate = radialCandidate(
        entity,
        index,
        attempt,
        visibleFoundationRadius * 0.34,
        visibleFoundationRadius * 0.64,
        footprintRadius,
      );
      if (!collides(candidate, archCircles, 1.02)) {
        accepted = candidate;
        break;
      }
    }
    if (!accepted) {
      rejectedArchIds.push(entity.id);
      return;
    }
    archCircles.push(accepted);
    const azimuth = Math.atan2(accepted.z, accepted.x);
    arches.push({
      id: `reef:growth-arch:${entity.sourceKey}`,
      sourceEntityId: entity.id,
      yearIndex: Number(entity.sourceKey),
      center: { x: accepted.x, y: 0.05, z: accepted.z },
      rotationY: round6(azimuth + Math.PI * 0.5),
      span,
      height: round6(1.38 + seededUnit(entity.seed, 'height') * 0.74),
      thickness: round6(0.16 + seededUnit(entity.seed, 'thickness') * 0.075),
      curveDepth: round6((seededUnit(entity.seed, 'curve-depth') - 0.5) * 0.42),
      footprintRadius,
      seed: entity.seed,
    });
  });

  const externalCircles: OccupiedCircle[] = [];
  const outcrops: ReefGrowthOutcropPlacement[] = [];
  const rejectedOutcropIds: string[] = [];
  const visibleOutcrops = evolution.entities.mapOutcrops.slice(
    0,
    evolution.foundation.satelliteOutcrops.visibleCount,
  );
  visibleOutcrops.forEach((entity, index) => {
    const footprintRadius = round6(0.42 + seededUnit(entity.seed, 'footprint') * 0.24);
    // Each stable group of six places opens one farther ring. The envelope is
    // based on the entity index, not the current total, so adding a new place
    // never nudges an old outcrop.
    const ringIndex = Math.floor(index / 6);
    const minimumOutcropRadius = visibleFoundationRadius * 0.9 + ringIndex * 0.34;
    const maximumOutcropRadius = visibleFoundationRadius * 1.08
      + 0.58
      + ringIndex * 0.42;
    let accepted: OccupiedCircle | null = null;
    for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
      const candidate = radialCandidate(
        entity,
        index,
        attempt,
        minimumOutcropRadius,
        maximumOutcropRadius,
        footprintRadius,
      );
      if (!collides(candidate, externalCircles, minimumClearanceRatio)) {
        accepted = candidate;
        break;
      }
    }
    if (!accepted) {
      rejectedOutcropIds.push(entity.id);
      return;
    }
    externalCircles.push(accepted);
    outcrops.push({
      id: `reef:growth-outcrop:${entity.sourceKey}`,
      sourceEntityId: entity.id,
      center: { x: accepted.x, y: -0.2, z: accepted.z },
      rotationY: round6(seededUnit(entity.seed, 'rotation') * TAU),
      footprintRadius,
      height: round6(0.42 + seededUnit(entity.seed, 'height') * 0.36),
      ledgeScale: round6(0.76 + seededUnit(entity.seed, 'ledge') * 0.34),
      seed: entity.seed,
    });
  });

  const terraces: ReefGrowthTerracePlacement[] = [];
  const rejectedTerraceIds: string[] = [];
  const visibleTerraces = evolution.entities.scheduleTerraces.slice(
    0,
    evolution.foundation.scheduleTerraces.visibleCount,
  );
  visibleTerraces.forEach((entity, index) => {
    // Schedule terraces are low, compact shelves tucked into the chronological
    // foundation. Keeping their reserved footprint smaller than a satellite
    // outcrop lets every active month remain legible without intersecting a
    // neighbouring module structure.
    const footprintRadius = round6(0.24 + seededUnit(entity.seed, 'footprint') * 0.12);
    let accepted: OccupiedCircle | null = null;
    for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
      const candidate = radialCandidate(
        entity,
        index,
        attempt,
        visibleFoundationRadius * 0.34,
        visibleFoundationRadius * 0.72,
        footprintRadius,
      );
      if (!collides(candidate, externalCircles, minimumClearanceRatio)) {
        accepted = candidate;
        break;
      }
    }
    if (!accepted) {
      rejectedTerraceIds.push(entity.id);
      return;
    }
    externalCircles.push(accepted);
    terraces.push({
      id: `reef:growth-terrace:${entity.sourceKey}`,
      sourceEntityId: entity.id,
      center: { x: accepted.x, y: -0.18, z: accepted.z },
      rotationY: round6(seededUnit(entity.seed, 'rotation') * TAU),
      footprintRadius,
      thickness: round6(0.14 + seededUnit(entity.seed, 'thickness') * 0.08),
      seed: entity.seed,
    });
  });

  const minimumArchClearance = minimumClearance(archCircles);
  const minimumExternalClearance = minimumClearance(externalCircles);
  const collisionFree = (minimumArchClearance === null || minimumArchClearance >= -1e-6)
    && (minimumExternalClearance === null || minimumExternalClearance >= -1e-6);

  return {
    version: 'reef-growth-structure-layout-v1',
    visibleFoundationRadius,
    foundationScaleXZ,
    foundationScaleY,
    arches,
    outcrops,
    terraces,
    diagnostics: {
      rejectedArchIds,
      rejectedOutcropIds,
      rejectedTerraceIds,
      minimumArchClearance,
      minimumExternalClearance,
      collisionFree,
    },
  };
}
