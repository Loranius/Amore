import { round6, seededUnit } from './math';
import type {
  ReefAnnualStructureArchetype,
  ReefAnnualZone,
  ReefModuleEvolutionPlan,
} from './types';

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const TAU = Math.PI * 2;
const MAXIMUM_ATTEMPTS = 32;
const MAXIMUM_GUARANTEED_ARCHES = 6;

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
  /** Optional during renderer migration; new annual-zone layouts always publish it. */
  progress?: number;
  colonization?: number;
  biodiversity?: number;
  cohesion?: number;
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
  /** Optional only for legacy fixtures; new layouts always publish annual-zone metadata. */
  yearIndex?: number;
  archetype?: ReefAnnualStructureArchetype;
  center: ReefGrowthStructurePoint;
  rotationY: number;
  footprintRadius: number;
  thickness: number;
  progress?: number;
  colonization?: number;
  biodiversity?: number;
  cohesion?: number;
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

interface StableSeededIdentity {
  id: string;
  seed: number;
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
  identity: StableSeededIdentity,
  index: number,
  attempt: number,
  minimumRadius: number,
  maximumRadius: number,
  footprintRadius: number,
): OccupiedCircle {
  const azimuth = normalizeAngle(
    seededUnit(identity.seed, 'azimuth') * TAU
      + index * GOLDEN_ANGLE
      + attempt * GOLDEN_ANGLE,
  );
  const distanceSeed = seededUnit(identity.seed, `radius:${attempt}`);
  const distance = minimumRadius + (maximumRadius - minimumRadius) * distanceSeed;
  return {
    id: identity.id,
    x: round6(Math.cos(azimuth) * distance),
    z: round6(Math.sin(azimuth) * distance),
    radius: footprintRadius,
  };
}

function zoneFootprint(zone: ReefAnnualZone): number {
  const archetypeScale: Record<ReefAnnualStructureArchetype, number> = {
    core: 1.2,
    terrace: 1,
    ridge: 0.88,
    arch: 0.78,
    shelf: 1.08,
    overhang: 0.92,
    buttress: 0.82,
    peninsula: 1.12,
  };
  return round6(
    (0.38 + zone.progress * 0.3 + zone.mapExpansion * 0.14)
      * archetypeScale[zone.structureArchetype],
  );
}

function annualPlacementCircle(
  zone: ReefAnnualZone,
  index: number,
  visibleFoundationRadius: number,
  annualCircles: readonly OccupiedCircle[],
): OccupiedCircle | null {
  const footprintRadius = zoneFootprint(zone);
  if (zone.structureArchetype === 'core' || index === 0) {
    return {
      id: zone.id,
      x: 0,
      z: 0,
      radius: footprintRadius,
    };
  }

  // High togetherness/cohesion lets neighbouring annual habitats knit closer
  // without spawning any Schedule geometry of its own.
  const clearanceRatio = 0.68 - zone.cohesion * 0.1;
  for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
    const ring = Math.floor((zone.yearIndex - 2) / 4);
    const candidate = radialCandidate(
      { id: zone.id, seed: zone.structureSeed },
      index,
      attempt,
      visibleFoundationRadius * (0.3 + ring * 0.08),
      visibleFoundationRadius * Math.min(0.92, 0.82 + ring * 0.05 + zone.mapExpansion * 0.05),
      footprintRadius,
    );
    if (!collides(candidate, annualCircles, clearanceRatio)) return candidate;
  }
  return null;
}

function archPlacement(
  zone: ReefAnnualZone,
  circle: OccupiedCircle,
  seed: number,
  id: string,
): ReefGrowthArchPlacement {
  const azimuth = Math.atan2(circle.z, circle.x);
  const span = round6(
    (1.08 + seededUnit(seed, 'span') * 0.48)
      * (0.38 + zone.progress * 0.62),
  );
  return {
    id,
    sourceEntityId: zone.id,
    yearIndex: zone.yearIndex,
    center: { x: circle.x, y: 0.03, z: circle.z },
    rotationY: round6(azimuth + Math.PI * 0.5),
    span,
    height: round6(
      (1.18 + seededUnit(seed, 'height') * 0.68)
        * (0.35 + zone.progress * 0.65),
    ),
    thickness: round6(0.17 + seededUnit(seed, 'thickness') * 0.08),
    curveDepth: round6((seededUnit(seed, 'curve-depth') - 0.5) * 0.48),
    footprintRadius: circle.radius,
    progress: zone.progress,
    colonization: zone.colonization,
    biodiversity: zone.biodiversity,
    cohesion: zone.cohesion,
    seed,
  };
}

function guaranteedCompletedArchCount(completedYears: number): number {
  if (completedYears <= 0) return 0;
  // Years must visibly bend the reef, but one arch per year becomes repetitive.
  // One stable arch for roughly every two completed years keeps a readable
  // limestone backbone while annual zones remain free to be shelves/ridges/etc.
  return Math.min(
    MAXIMUM_GUARANTEED_ARCHES,
    Math.max(1, Math.ceil(completedYears / 2)),
  );
}

/**
 * Pure placement pass for annual habitat zones plus clustered exploration
 * outcrops. Schedule affects cohesion only; it never becomes a terrace/object.
 *
 * Annual zones remain morphologically varied, while completed relationship time
 * also guarantees a sparse limestone arch backbone. This keeps arches as a
 * persistent time signature without regressing to the old `1 year = 1 arch`
 * rule or allowing a deterministic seed to produce zero arches forever.
 */
export function buildReefGrowthStructureLayout(
  evolution: ReefModuleEvolutionPlan,
): ReefGrowthStructureLayout {
  const visibleFoundationRadius = round6(evolution.foundation.substrateRadius * 0.76);
  const foundationScaleXZ = round6(visibleFoundationRadius / 2.08);
  const foundationScaleY = round6(
    0.94
      + evolution.foundation.radialSaturation * 0.22
      + evolution.development.ecology.maturity * 0.12,
  );
  const minimumClearanceRatio = Math.min(1.18, evolution.colonies.minimumClearanceRatio);

  const arches: ReefGrowthArchPlacement[] = [];
  const terraces: ReefGrowthTerracePlacement[] = [];
  const annualCircles: OccupiedCircle[] = [];
  const archCircles: OccupiedCircle[] = [];
  const rejectedArchIds: string[] = [];
  const rejectedTerraceIds: string[] = [];

  const visibleZones = evolution.development.annualZones.filter((zone) => zone.progress > 0);
  visibleZones.forEach((zone, index) => {
    const accepted = annualPlacementCircle(zone, index, visibleFoundationRadius, annualCircles);
    if (!accepted) {
      if (zone.structureArchetype === 'arch') rejectedArchIds.push(zone.id);
      else rejectedTerraceIds.push(zone.id);
      return;
    }
    annualCircles.push(accepted);
    const azimuth = Math.atan2(accepted.z, accepted.x);

    if (zone.structureArchetype === 'arch') {
      archCircles.push(accepted);
      arches.push(archPlacement(
        zone,
        accepted,
        zone.structureSeed,
        `reef:growth-zone-arch:${zone.yearIndex}`,
      ));
      return;
    }

    const verticalBias: Record<ReefAnnualStructureArchetype, number> = {
      core: 1.25,
      terrace: 1,
      ridge: 1.32,
      arch: 1,
      shelf: 0.82,
      overhang: 1.16,
      buttress: 1.38,
      peninsula: 0.92,
    };
    terraces.push({
      id: `reef:growth-zone:${zone.yearIndex}:${zone.structureArchetype}`,
      sourceEntityId: zone.id,
      yearIndex: zone.yearIndex,
      archetype: zone.structureArchetype,
      center: {
        x: accepted.x,
        y: round6(-0.2 + 0.08 * verticalBias[zone.structureArchetype] * zone.progress),
        z: accepted.z,
      },
      rotationY: round6(
        (zone.structureArchetype === 'core' ? 0 : azimuth)
          + seededUnit(zone.structureSeed, 'rotation') * 0.72,
      ),
      footprintRadius: accepted.radius,
      thickness: round6(
        (0.15 + seededUnit(zone.structureSeed, 'thickness') * 0.1)
          * verticalBias[zone.structureArchetype]
          * (0.55 + zone.progress * 0.45),
      ),
      progress: zone.progress,
      colonization: zone.colonization,
      biodiversity: zone.biodiversity,
      cohesion: zone.cohesion,
      seed: zone.structureSeed,
    });
  });

  // A relationship with completed years must never render as an archless reef.
  // Existing annual arch zones count first. Missing arches are added as sparse
  // connector/backbone structures tied to the oldest completed zones so adding
  // later history never reshuffles established identities.
  const completedZones = visibleZones.filter((zone) => zone.complete);
  const completedArchYears = new Set(
    arches
      .filter((arch) => completedZones.some((zone) => zone.yearIndex === arch.yearIndex))
      .map((arch) => arch.yearIndex),
  );
  const desiredCompletedArchCount = guaranteedCompletedArchCount(evolution.facts.completedYears);
  let completedArchCount = completedArchYears.size;

  for (const zone of completedZones) {
    if (completedArchCount >= desiredCompletedArchCount) break;
    if (completedArchYears.has(zone.yearIndex)) continue;

    const connectorId = `reef:growth-time-arch:${zone.yearIndex}`;
    const connectorSeed = (zone.structureSeed ^ 0x51f15e5d) >>> 0;
    const footprintRadius = round6(0.46 + seededUnit(connectorSeed, 'footprint') * 0.1);
    let accepted: OccupiedCircle | null = null;

    for (let attempt = 0; attempt < MAXIMUM_ATTEMPTS; attempt += 1) {
      const candidate = radialCandidate(
        { id: connectorId, seed: connectorSeed },
        zone.yearIndex - 1,
        attempt,
        visibleFoundationRadius * 0.36,
        visibleFoundationRadius * 0.72,
        footprintRadius,
      );
      // Arches may grow from annual terrain, but should not stack on top of
      // another arch or cut directly through the densest centre of a zone.
      if (
        !collides(candidate, archCircles, 0.96)
        && !collides(candidate, annualCircles, 0.42)
      ) {
        accepted = candidate;
        break;
      }
    }

    if (!accepted) {
      rejectedArchIds.push(connectorId);
      continue;
    }

    archCircles.push(accepted);
    arches.push(archPlacement(zone, accepted, connectorSeed, connectorId));
    completedArchYears.add(zone.yearIndex);
    completedArchCount += 1;
  }

  const externalCircles: OccupiedCircle[] = [];
  const outcrops: ReefGrowthOutcropPlacement[] = [];
  const rejectedOutcropIds: string[] = [];
  const visibleOutcrops = evolution.entities.mapOutcrops.slice(
    0,
    evolution.foundation.satelliteOutcrops.visibleCount,
  );
  visibleOutcrops.forEach((entity, index) => {
    const footprintRadius = round6(0.34 + seededUnit(entity.seed, 'footprint') * 0.18);
    // Map rows are pre-clustered by annual zone. New visits expand habitat in
    // bounded branches instead of producing one giant detached slab per place.
    const ringIndex = Math.floor(index / 4);
    const minimumOutcropRadius = visibleFoundationRadius * 0.84 + ringIndex * 0.28;
    const maximumOutcropRadius = visibleFoundationRadius * 1.02 + 0.46 + ringIndex * 0.34;
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
      center: { x: accepted.x, y: -0.24, z: accepted.z },
      rotationY: round6(seededUnit(entity.seed, 'rotation') * TAU),
      footprintRadius,
      height: round6(0.32 + seededUnit(entity.seed, 'height') * 0.28),
      ledgeScale: round6(0.72 + seededUnit(entity.seed, 'ledge') * 0.28),
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
