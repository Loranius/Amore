import { stableHash32 } from '../../evolution';
import { clamp01, round6, seededUnit } from './math';
import type { ReefCoreManifest } from './reefCore';
import type { ReefSurfaceManifest, ReefSurfacePatch, ReefSurfacePoint } from './surfaceSystem';

export const REEF_CORAL_COLONIES_VERSION = 'reef-coral-colonies-v1' as const;
export const REEF_CORAL_MAX_COUNT = 48;
export const REEF_CORAL_PLATFORM_BASELINE = 5;
export const REEF_CORAL_YEAR_NUCLEATION_CHANCE = 0.72;

const TAU = Math.PI * 2;

export type ReefCoralMorphotype = 'BRANCHING' | 'MASSIVE' | 'PLATE' | 'ENCRUSTING';

export interface ReefCoralColony {
  id: string;
  seed: number;
  patchId: string;
  sourceId: string;
  sourceKind: 'PLATFORM' | 'YEAR_STRUCTURE';
  birthYear: number;
  morphotype: ReefCoralMorphotype;
  position: ReefSurfacePoint;
  normal: ReefSurfacePoint;
  tangentRotation: number;
  radius: number;
  height: number;
  growth: number;
  vitality: number;
  separationRadius: number;
  branchCount: number;
  toneIndex: number;
  nucleationScore: number;
  signature: string;
}

export interface ReefCoralColoniesDiagnostics {
  colonyCount: number;
  platformColonyCount: number;
  yearlyColonyCount: number;
  sourceCount: number;
  skippedBySpacing: number;
  boundedForMobile: boolean;
  averageVitality: number;
  morphotypeCounts: Record<ReefCoralMorphotype, number>;
}

export interface ReefCoralColoniesManifest {
  version: typeof REEF_CORAL_COLONIES_VERSION;
  reefSeed: number;
  sourceSurfaceSignature: string;
  colonies: ReefCoralColony[];
  diagnostics: ReefCoralColoniesDiagnostics;
  signature: string;
}

export interface BuildReefCoralColoniesInput {
  core: ReefCoreManifest;
  surfaces: ReefSurfaceManifest;
}

const hex32 = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function yearFromSourceId(sourceId: string): number | null {
  const match = /^reef:year:(\d+)$/.exec(sourceId);
  if (!match?.[1]) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function patchPriority(patch: ReefSurfacePatch): number {
  const stable = seededUnit(patch.seed, 'coral-priority');
  return round6(patch.suitability * 0.52 + patch.capacity * 0.30 + stable * 0.18);
}

function morphotypeFor(patch: ReefSurfacePatch, seed: number): ReefCoralMorphotype {
  const draw = seededUnit(seed, 'morphotype');
  let weights: Record<ReefCoralMorphotype, number>;

  if (patch.sourceKind === 'PLATFORM') {
    weights = { BRANCHING: 0.30, MASSIVE: 0.34, PLATE: 0.20, ENCRUSTING: 0.16 };
  } else if (patch.normal.y >= 0.58 && patch.exposure >= 0.62) {
    weights = { BRANCHING: 0.42, MASSIVE: 0.20, PLATE: 0.28, ENCRUSTING: 0.10 };
  } else if (patch.normal.y <= 0.16) {
    weights = { BRANCHING: 0.14, MASSIVE: 0.34, PLATE: 0.08, ENCRUSTING: 0.44 };
  } else {
    weights = { BRANCHING: 0.28, MASSIVE: 0.32, PLATE: 0.20, ENCRUSTING: 0.20 };
  }

  let cursor = 0;
  for (const morphotype of ['BRANCHING', 'MASSIVE', 'PLATE', 'ENCRUSTING'] as const) {
    cursor += weights[morphotype];
    if (draw < cursor) return morphotype;
  }
  return 'MASSIVE';
}

function dimensionsFor(
  patch: ReefSurfacePatch,
  seed: number,
  morphotype: ReefCoralMorphotype,
): { radius: number; height: number; separationRadius: number; branchCount: number } {
  const growth = clamp01((patch.capacity - 0.08) / 0.92);
  const sizeNoise = lerp(0.88, 1.12, seededUnit(seed, 'size'));
  const radiusBase = (0.16 + patch.capacity * 0.22) * sizeNoise;
  const radiusMultiplier = {
    BRANCHING: 0.92,
    MASSIVE: 1.10,
    PLATE: 1.28,
    ENCRUSTING: 1.06,
  }[morphotype];
  const radius = round6(radiusBase * radiusMultiplier);
  const height = round6((
    morphotype === 'BRANCHING' ? 0.32 + growth * 0.72
      : morphotype === 'MASSIVE' ? radius * 0.88
        : morphotype === 'PLATE' ? 0.11 + radius * 0.24
          : 0.08 + radius * 0.26
  ) * lerp(0.9, 1.1, seededUnit(seed, 'height')));
  const separationRadius = round6(radius * (morphotype === 'PLATE' ? 1.72 : 1.52) + 0.12);
  const branchCount = morphotype === 'BRANCHING'
    ? 3 + Math.floor(seededUnit(seed, 'branch-count') * 3)
    : 0;
  return { radius, height, separationRadius, branchCount };
}

function buildColony(patch: ReefSurfacePatch, birthYear: number): ReefCoralColony {
  const seed = stableHash32(`${patch.seed}:baseline-coral-colony`);
  const morphotype = morphotypeFor(patch, seed);
  const dimensions = dimensionsFor(patch, seed, morphotype);
  const growth = round6(clamp01((patch.capacity - 0.08) / 0.92));
  const vitality = round6(clamp01(
    patch.suitability * 0.48
      + patch.stability * 0.28
      + patch.exposure * 0.14
      + patch.capacity * 0.10,
  ));
  const tangentRotation = round6(seededUnit(seed, 'tangent-rotation') * TAU);
  const toneIndex = Math.floor(seededUnit(seed, 'tone') * 4);
  const nucleationScore = patchPriority(patch);
  const signature = hex32(stableHash32([
    REEF_CORAL_COLONIES_VERSION,
    patch.id,
    seed,
    morphotype,
    dimensions.radius,
    dimensions.height,
    dimensions.branchCount,
    tangentRotation,
    toneIndex,
  ].join('\u001f')));

  return {
    id: `reef:colony:${patch.id}`,
    seed,
    patchId: patch.id,
    sourceId: patch.sourceId,
    sourceKind: patch.sourceKind === 'PLATFORM' ? 'PLATFORM' : 'YEAR_STRUCTURE',
    birthYear,
    morphotype,
    position: patch.position,
    normal: patch.normal,
    tangentRotation,
    radius: dimensions.radius,
    height: dimensions.height,
    growth,
    vitality,
    separationRadius: dimensions.separationRadius,
    branchCount: dimensions.branchCount,
    toneIndex,
    nucleationScore,
    signature,
  };
}

function hasSpacing(candidate: ReefCoralColony, accepted: readonly ReefCoralColony[]): boolean {
  return accepted.every((other) => {
    const distance = Math.hypot(
      candidate.position.x - other.position.x,
      candidate.position.y - other.position.y,
      candidate.position.z - other.position.z,
    );
    return distance >= candidate.separationRadius + other.separationRadius;
  });
}

function sortedCandidates(patches: readonly ReefSurfacePatch[]): ReefSurfacePatch[] {
  return [...patches].sort((left, right) => {
    const delta = patchPriority(right) - patchPriority(left);
    return Math.abs(delta) > 1e-9 ? delta : left.id.localeCompare(right.id);
  });
}

function shouldColonizeYear(reefSeed: number, yearIndex: number): boolean {
  if (yearIndex <= 3) return true;
  const seed = stableHash32(`${reefSeed}:baseline-colony:year:${yearIndex}`);
  return seededUnit(seed, 'nucleate') < REEF_CORAL_YEAR_NUCLEATION_CHANCE;
}

export function buildReefCoralColonies({
  core,
  surfaces,
}: BuildReefCoralColoniesInput): ReefCoralColoniesManifest {
  const accepted: ReefCoralColony[] = [];
  let skippedBySpacing = 0;

  const platform = sortedCandidates(surfaces.patches.filter(
    (patch) => patch.eligible && patch.sourceKind === 'PLATFORM',
  ));
  for (const patch of platform) {
    if (accepted.length >= REEF_CORAL_PLATFORM_BASELINE) break;
    const colony = buildColony(patch, 0);
    if (hasSpacing(colony, accepted)) accepted.push(colony);
    else skippedBySpacing += 1;
  }

  const byYear = new Map<number, ReefSurfacePatch[]>();
  surfaces.patches.forEach((patch) => {
    if (!patch.eligible || patch.sourceKind !== 'YEAR_STRUCTURE') return;
    const yearIndex = yearFromSourceId(patch.sourceId);
    if (yearIndex === null) return;
    const group = byYear.get(yearIndex) ?? [];
    group.push(patch);
    byYear.set(yearIndex, group);
  });

  const years = [...byYear.keys()].sort((a, b) => a - b);
  for (const yearIndex of years) {
    if (accepted.length >= REEF_CORAL_MAX_COUNT) break;
    if (!shouldColonizeYear(surfaces.reefSeed, yearIndex)) continue;
    const candidates = sortedCandidates(byYear.get(yearIndex) ?? []);
    let placed = false;
    for (const patch of candidates) {
      const colony = buildColony(patch, yearIndex);
      if (!hasSpacing(colony, accepted)) {
        skippedBySpacing += 1;
        continue;
      }
      accepted.push(colony);
      placed = true;
      break;
    }
    if (!placed) continue;
  }

  const colonies = accepted.slice(0, REEF_CORAL_MAX_COUNT);
  const morphotypeCounts: Record<ReefCoralMorphotype, number> = {
    BRANCHING: 0,
    MASSIVE: 0,
    PLATE: 0,
    ENCRUSTING: 0,
  };
  colonies.forEach((colony) => { morphotypeCounts[colony.morphotype] += 1; });
  const sourceCount = new Set(colonies.map((colony) => colony.sourceId)).size;
  const averageVitality = round6(
    colonies.length > 0
      ? colonies.reduce((sum, colony) => sum + colony.vitality, 0) / colonies.length
      : 0,
  );
  const diagnostics: ReefCoralColoniesDiagnostics = {
    colonyCount: colonies.length,
    platformColonyCount: colonies.filter((colony) => colony.sourceKind === 'PLATFORM').length,
    yearlyColonyCount: colonies.filter((colony) => colony.sourceKind === 'YEAR_STRUCTURE').length,
    sourceCount,
    skippedBySpacing,
    boundedForMobile: colonies.length <= REEF_CORAL_MAX_COUNT,
    averageVitality,
    morphotypeCounts,
  };
  const signature = hex32(stableHash32([
    REEF_CORAL_COLONIES_VERSION,
    core.identity.reefSeed,
    surfaces.signature,
    ...colonies.map((colony) => colony.signature),
  ].join('\u001f')));

  return {
    version: REEF_CORAL_COLONIES_VERSION,
    reefSeed: core.identity.reefSeed,
    sourceSurfaceSignature: surfaces.signature,
    colonies,
    diagnostics,
    signature,
  };
}
