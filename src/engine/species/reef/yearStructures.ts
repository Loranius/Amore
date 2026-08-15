import { stableHash32 } from '../../evolution';
import { clamp01, round6, seededUnit } from './math';
import {
  buildReefCore,
  REEF_CORE_MAX_DAYS,
  REEF_CORE_YEAR_DAYS,
  type ReefCoreManifest,
} from './reefCore';

export const REEF_YEAR_STRUCTURES_VERSION = 'reef-year-structures-v1' as const;
export const REEF_YEAR_GROWTH_DAYS = 30;
export const REEF_YEAR_GOLDEN_ANGLE_DEGREES = 137.507764;
export const REEF_YEAR_PLACEMENT_ATTEMPTS = 12;

const GOLDEN_ANGLE = REEF_YEAR_GOLDEN_ANGLE_DEGREES * Math.PI / 180;
const TAU = Math.PI * 2;

export type ReefYearStructureArchetype = 'BOULDER' | 'COLUMN' | 'RIDGE' | 'ARCH';

export interface ReefYearStructurePoint { x: number; y: number; z: number }
export interface ReefYearStructureShape {
  width: number;
  height: number;
  depth: number;
  leanX: number;
  leanZ: number;
  skew: number;
  irregularity: number;
  erosion: number;
  curveDepth: number;
  openingAsymmetry: number;
  thicknessVariation: number;
}
export interface ReefYearStructure {
  id: string;
  yearIndex: number;
  seed: number;
  saturation: number;
  saturationSource: 'input' | 'seeded-fallback';
  growth: number;
  archetype: ReefYearStructureArchetype;
  importance: number;
  center: ReefYearStructurePoint;
  rotationY: number;
  footprintRadius: number;
  shape: ReefYearStructureShape;
  signature: string;
}
export interface ReefYearStructuresDiagnostics {
  structureCount: number;
  collisionFree: boolean;
  minimumClearance: number | null;
  waterWindowCount: number;
  archetypeCounts: Record<ReefYearStructureArchetype, number>;
}
export interface ReefYearStructuresManifest {
  version: typeof REEF_YEAR_STRUCTURES_VERSION;
  reefSeed: number;
  structures: ReefYearStructure[];
  diagnostics: ReefYearStructuresDiagnostics;
  signature: string;
}
export interface BuildReefYearStructuresInput {
  core: ReefCoreManifest;
  yearSaturations?: readonly number[];
}

interface Footprint { x: number; z: number; radius: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hex32 = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
const normalizeAngle = (value: number) => ((value % TAU) + TAU) % TAU;
const easeOutCubic = (value: number) => {
  const t = clamp01(value);
  return round6(1 - Math.pow(1 - t, 3));
};

function weightedArchetype(seed: number, saturation: number): ReefYearStructureArchetype {
  const weights: Record<ReefYearStructureArchetype, number> = saturation <= 0.25
    ? { BOULDER: 50, RIDGE: 35, COLUMN: 15, ARCH: 0 }
    : saturation <= 0.55
      ? { BOULDER: 25, RIDGE: 35, COLUMN: 25, ARCH: 15 }
      : saturation <= 0.8
        ? { BOULDER: 10, RIDGE: 30, COLUMN: 25, ARCH: 35 }
        : { BOULDER: 5, RIDGE: 20, COLUMN: 25, ARCH: 50 };
  const draw = seededUnit(seed, 'archetype') * 100;
  let cursor = 0;
  for (const archetype of ['BOULDER', 'RIDGE', 'COLUMN', 'ARCH'] as const) {
    cursor += weights[archetype];
    if (draw < cursor) return archetype;
  }
  return 'RIDGE';
}

function shapeFor(seed: number, archetype: ReefYearStructureArchetype, importance: number, yearIndex: number): ReefYearStructureShape {
  const random = (salt: string, min: number, max: number) => lerp(min, max, seededUnit(seed, salt));
  const maturityScale = lerp(0.78, 1, clamp01(yearIndex / 20));
  const scale = importance * maturityScale;
  const ranges: Record<ReefYearStructureArchetype, [[number, number], [number, number], [number, number]]> = {
    BOULDER: [[1.35, 2.15], [0.85, 1.55], [1.15, 1.9]],
    COLUMN: [[0.62, 0.95], [1.85, 3.25], [0.58, 0.92]],
    RIDGE: [[2.1, 3.55], [0.82, 1.55], [0.78, 1.22]],
    ARCH: [[2.25, 3.7], [1.7, 2.95], [0.58, 0.92]],
  };
  const [widthRange, heightRange, depthRange] = ranges[archetype];
  return {
    width: round6(random('width', ...widthRange) * scale),
    height: round6(random('height', ...heightRange) * scale),
    depth: round6(random('depth', ...depthRange) * scale),
    leanX: round6(random('lean-x', -0.16, 0.16)),
    leanZ: round6(random('lean-z', -0.16, 0.16)),
    skew: round6(random('skew', -0.24, 0.24)),
    irregularity: round6(random('irregularity', 0.08, 0.19)),
    erosion: round6(random('erosion', 0.12, 0.38)),
    curveDepth: round6(random('curve-depth', -0.42, 0.42)),
    openingAsymmetry: round6(random('opening-asymmetry', -0.28, 0.28)),
    thicknessVariation: round6(random('thickness-variation', 0.08, 0.24)),
  };
}

function footprintFor(archetype: ReefYearStructureArchetype, shape: ReefYearStructureShape): number {
  const multiplier = { BOULDER: 0.52, COLUMN: 0.56, RIDGE: 0.48, ARCH: 0.5 }[archetype];
  return round6(Math.max(shape.width, shape.depth) * multiplier);
}

function collides(candidate: Footprint, occupied: readonly Footprint[]): boolean {
  return occupied.some((other) => Math.hypot(candidate.x - other.x, candidate.z - other.z) < candidate.radius + other.radius + 0.16);
}

function placementFactor(archetype: ReefYearStructureArchetype, seed: number): number {
  const ranges: Record<ReefYearStructureArchetype, [number, number]> = {
    BOULDER: [1.02, 1.2], RIDGE: [1.08, 1.32], COLUMN: [1.16, 1.4], ARCH: [1.24, 1.55],
  };
  const [minimum, maximum] = ranges[archetype];
  return lerp(minimum, maximum, seededUnit(seed, 'radial-band'));
}

function anniversaryCore(core: ReefCoreManifest, yearIndex: number): ReefCoreManifest {
  return buildReefCore({
    coupleId: core.identity.coupleId,
    relationshipStartDate: core.identity.relationshipStartDate,
    daysTogether: Math.min(REEF_CORE_MAX_DAYS, Math.ceil(yearIndex * REEF_CORE_YEAR_DAYS)),
  });
}

function minimumClearance(structures: readonly ReefYearStructure[]): number | null {
  if (structures.length < 2) return null;
  let minimum = Number.POSITIVE_INFINITY;
  for (let left = 0; left < structures.length; left += 1) {
    const a = structures[left];
    if (!a) continue;
    for (let right = left + 1; right < structures.length; right += 1) {
      const b = structures[right];
      if (!b) continue;
      minimum = Math.min(minimum, Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z) - a.footprintRadius - b.footprintRadius);
    }
  }
  return Number.isFinite(minimum) ? round6(minimum) : null;
}

function waterWindows(structures: readonly ReefYearStructure[]): number {
  if (structures.length === 0) return 1;
  const angles = structures.map((item) => normalizeAngle(Math.atan2(item.center.z, item.center.x))).sort((a, b) => a - b);
  let count = 0;
  for (let index = 0; index < angles.length; index += 1) {
    const current = angles[index]!;
    const next = index === angles.length - 1 ? angles[0]! + TAU : angles[index + 1]!;
    if (next - current >= 0.62) count += 1;
  }
  return Math.max(1, count);
}

export function buildReefYearStructures({ core, yearSaturations }: BuildReefYearStructuresInput): ReefYearStructuresManifest {
  const structures: ReefYearStructure[] = [];
  const occupied: Footprint[] = [];

  for (let yearIndex = 1; yearIndex <= core.age.completedYears; yearIndex += 1) {
    const seed = stableHash32(`${core.identity.reefSeed}:year:${yearIndex}`);
    const provided = yearSaturations?.[yearIndex - 1];
    const hasProvided = typeof provided === 'number' && Number.isFinite(provided);
    const saturation = round6(clamp01(hasProvided ? provided : seededUnit(seed, 'saturation-fallback')));
    const archetype = weightedArchetype(seed, saturation);
    const importance = round6((0.72 + saturation * 0.28) * lerp(0.9, 1.1, seededUnit(seed, 'importance')));
    const shape = shapeFor(seed, archetype, importance, yearIndex);
    let footprintRadius = footprintFor(archetype, shape);
    const isFiftyYearHorizon = yearIndex === core.age.maxYears && core.age.progress >= 1;
    const ageDays = core.age.daysTogether - yearIndex * REEF_CORE_YEAR_DAYS;
    const growth = isFiftyYearHorizon ? 1 : easeOutCubic(ageDays / REEF_YEAR_GROWTH_DAYS);
    const anchor = anniversaryCore(core, yearIndex);
    const anchorRadius = Math.max(anchor.platform.radiusX, anchor.platform.radiusZ);
    const baseAngle = (yearIndex - 1) * GOLDEN_ANGLE + lerp(-22, 22, seededUnit(seed, 'angle-jitter')) * Math.PI / 180;

    let accepted: Footprint | null = null;
    for (let attempt = 0; attempt < REEF_YEAR_PLACEMENT_ATTEMPTS; attempt += 1) {
      const angle = baseAngle + attempt * GOLDEN_ANGLE * 0.31;
      const distance = (anchorRadius * placementFactor(archetype, seed) + footprintRadius * 0.72) * (1 + attempt * 0.065);
      const candidate = { x: round6(Math.cos(angle) * distance), z: round6(Math.sin(angle) * distance), radius: footprintRadius };
      if (!collides(candidate, occupied)) { accepted = candidate; break; }
      if (attempt === 7) footprintRadius = round6(footprintRadius * 0.88);
    }
    if (!accepted) {
      for (let fallback = 1; fallback <= 10 && !accepted; fallback += 1) {
        const angle = baseAngle + (REEF_YEAR_PLACEMENT_ATTEMPTS + fallback) * GOLDEN_ANGLE * 0.31;
        const distance = anchorRadius * (1.75 + fallback * 0.22) + footprintRadius * 2;
        const candidate = { x: round6(Math.cos(angle) * distance), z: round6(Math.sin(angle) * distance), radius: footprintRadius };
        if (!collides(candidate, occupied)) accepted = candidate;
      }
    }
    if (!accepted) throw new Error(`Reef Phase 2 could not place year ${yearIndex}.`);
    occupied.push(accepted);

    const rotationY = round6(Math.atan2(accepted.z, accepted.x) + Math.PI * 0.5 + lerp(-0.34, 0.34, seededUnit(seed, 'rotation-jitter')));
    const signature = hex32(stableHash32(`${seed}\u001f${archetype}\u001f${accepted.x}\u001f${accepted.z}\u001f${shape.width}\u001f${shape.height}`));
    structures.push({
      id: `reef:year:${yearIndex}`,
      yearIndex,
      seed,
      saturation,
      saturationSource: hasProvided ? 'input' : 'seeded-fallback',
      growth,
      archetype,
      importance,
      center: { x: accepted.x, y: 0, z: accepted.z },
      rotationY,
      footprintRadius,
      shape,
      signature,
    });
  }

  const archetypeCounts: Record<ReefYearStructureArchetype, number> = { BOULDER: 0, COLUMN: 0, RIDGE: 0, ARCH: 0 };
  structures.forEach((item) => { archetypeCounts[item.archetype] += 1; });
  const clearance = minimumClearance(structures);
  const diagnostics: ReefYearStructuresDiagnostics = {
    structureCount: structures.length,
    collisionFree: clearance === null || clearance >= -1e-6,
    minimumClearance: clearance,
    waterWindowCount: waterWindows(structures),
    archetypeCounts,
  };
  return {
    version: REEF_YEAR_STRUCTURES_VERSION,
    reefSeed: core.identity.reefSeed,
    structures,
    diagnostics,
    signature: hex32(stableHash32(`${REEF_YEAR_STRUCTURES_VERSION}\u001f${core.identity.reefSeed}\u001f${structures.map((item) => item.signature).join(':')}`)),
  };
}
