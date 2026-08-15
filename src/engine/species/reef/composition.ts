import { stableHash32 } from '../../evolution';
import { clamp01, round6, seededUnit } from './math';
import {
  buildReefCore,
  REEF_CORE_MAX_DAYS,
  REEF_CORE_YEAR_DAYS,
  type ReefCoreManifest,
} from './reefCore';
import type { ReefYearStructure, ReefYearStructuresManifest } from './yearStructures';

export const REEF_COMPOSITION_VERSION = 'reef-composition-v1' as const;
export const REEF_COMPOSITION_ATTEMPTS = 12;
export const REEF_COMPOSITION_ACCEPT_SCORE = 0.72;
export const REEF_MIN_CORE_VISIBILITY = 0.35;

const TAU = Math.PI * 2;
const SECTOR_COUNT = 72;
const OPEN_RUN_SECTORS = 4;
const COMPOSITION_SNAPSHOT_SETTLE_DAYS = 30;

export interface ReefCompositionScore {
  coreVisibility: number;
  openWater: number;
  heightBalance: number;
  radialBalance: number;
  silhouette: number;
  collision: number;
  total: number;
}

export interface ReefCompositionMetrics {
  coreVisibility: number;
  freeWaterFraction: number;
  waterWindowCount: number;
  minimumClearance: number | null;
  collisionFree: boolean;
}

export interface ReefStructureCompositionDecision {
  sourceSignature: string;
  attempt: number;
  adjusted: boolean;
  score: ReefCompositionScore;
}

export interface ReefComposedYearStructure extends ReefYearStructure {
  composition: ReefStructureCompositionDecision;
}

export interface ReefCompositionDiagnostics extends ReefCompositionMetrics {
  structureCount: number;
  adjustedStructureCount: number;
  score: ReefCompositionScore;
}

export interface ReefCompositionManifest {
  version: typeof REEF_COMPOSITION_VERSION;
  reefSeed: number;
  sourceYearStructuresSignature: string;
  structures: ReefComposedYearStructure[];
  diagnostics: ReefCompositionDiagnostics;
  signature: string;
}

export interface BuildReefCompositionInput {
  core: ReefCoreManifest;
  yearStructures: ReefYearStructuresManifest;
}

interface CandidateTransform {
  x: number;
  z: number;
  rotationY: number;
  attempt: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hex32 = (value: number) => (value >>> 0).toString(16).padStart(8, '0');
const normalizeAngle = (value: number) => ((value % TAU) + TAU) % TAU;
const angularDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function compositionCoreForYear(core: ReefCoreManifest, yearIndex: number): ReefCoreManifest {
  return buildReefCore({
    coupleId: core.identity.coupleId,
    relationshipStartDate: core.identity.relationshipStartDate,
    daysTogether: Math.min(
      REEF_CORE_MAX_DAYS,
      Math.ceil(yearIndex * REEF_CORE_YEAR_DAYS + COMPOSITION_SNAPSHOT_SETTLE_DAYS),
    ),
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
      minimum = Math.min(
        minimum,
        Math.hypot(a.center.x - b.center.x, a.center.z - b.center.z)
          - a.footprintRadius
          - b.footprintRadius,
      );
    }
  }
  return Number.isFinite(minimum) ? round6(minimum) : null;
}

function coreVisibility(core: ReefCoreManifest, structures: readonly ReefYearStructure[]): number {
  if (structures.length === 0) return 1;
  const coreRadius = Math.max(core.dimensions.radiusX, core.dimensions.radiusZ);
  let occlusion = 0;
  for (const structure of structures) {
    const distance = Math.max(0.01, Math.hypot(structure.center.x, structure.center.z));
    const angularFootprint = Math.min(1, structure.footprintRadius / distance);
    const verticalRatio = Math.min(1.2, structure.shape.height / Math.max(0.01, core.dimensions.height));
    const innerPenalty = clamp01((coreRadius * 1.45 - distance) / Math.max(0.01, coreRadius));
    occlusion += angularFootprint * (0.18 + verticalRatio * 0.32) * (1 + innerPenalty * 0.65);
  }
  return round6(clamp01(1 - occlusion));
}

function waterMetrics(structures: readonly ReefYearStructure[]): { freeWaterFraction: number; waterWindowCount: number } {
  if (structures.length === 0) return { freeWaterFraction: 1, waterWindowCount: 1 };
  const occupied = Array.from({ length: SECTOR_COUNT }, () => false);
  structures.forEach((structure) => {
    const distance = Math.max(0.01, Math.hypot(structure.center.x, structure.center.z));
    const centerAngle = normalizeAngle(Math.atan2(structure.center.z, structure.center.x));
    const halfWidth = Math.asin(Math.min(0.92, structure.footprintRadius / distance));
    for (let sector = 0; sector < SECTOR_COUNT; sector += 1) {
      const angle = (sector + 0.5) / SECTOR_COUNT * TAU;
      if (angularDistance(angle, centerAngle) <= halfWidth) occupied[sector] = true;
    }
  });

  const freeCount = occupied.filter((value) => !value).length;
  if (freeCount === 0) return { freeWaterFraction: 0, waterWindowCount: 0 };
  const firstOccupied = occupied.findIndex(Boolean);
  if (firstOccupied < 0) return { freeWaterFraction: 1, waterWindowCount: 1 };

  let windows = 0;
  let freeRun = 0;
  for (let step = 1; step <= SECTOR_COUNT; step += 1) {
    const free = !occupied[(firstOccupied + step) % SECTOR_COUNT];
    if (free) freeRun += 1;
    else {
      if (freeRun >= OPEN_RUN_SECTORS) windows += 1;
      freeRun = 0;
    }
  }
  return {
    freeWaterFraction: round6(freeCount / SECTOR_COUNT),
    waterWindowCount: Math.max(1, windows),
  };
}

function directionalBalance(structures: readonly ReefYearStructure[], mode: 'height' | 'radial'): number {
  if (structures.length === 0) return 1;
  let vectorX = 0;
  let vectorZ = 0;
  let total = 0;
  structures.forEach((structure) => {
    const angle = Math.atan2(structure.center.z, structure.center.x);
    const radius = Math.max(0.01, Math.hypot(structure.center.x, structure.center.z));
    const weight = mode === 'height'
      ? Math.max(0.1, structure.shape.height)
      : Math.max(0.1, structure.footprintRadius * Math.sqrt(radius));
    vectorX += Math.cos(angle) * weight;
    vectorZ += Math.sin(angle) * weight;
    total += weight;
  });
  const imbalance = total > 0 ? Math.hypot(vectorX, vectorZ) / total : 0;
  const raw = clamp01(1 - imbalance);
  const earlyFloor = structures.length <= 2 ? 0.68 : structures.length === 3 ? 0.5 : 0;
  return round6(Math.max(earlyFloor, raw));
}

function silhouetteScore(structures: readonly ReefYearStructure[]): number {
  if (structures.length === 0) return 1;
  const sectorHeights = Array.from({ length: 8 }, () => 0);
  let totalHeight = 0;
  let minimumHeight = Number.POSITIVE_INFINITY;
  let maximumHeight = 0;
  structures.forEach((structure) => {
    const angle = normalizeAngle(Math.atan2(structure.center.z, structure.center.x));
    const sector = Math.min(7, Math.floor(angle / TAU * 8));
    const height = Math.max(0.05, structure.shape.height);
    sectorHeights[sector] += height;
    totalHeight += height;
    minimumHeight = Math.min(minimumHeight, height);
    maximumHeight = Math.max(maximumHeight, height);
  });
  const dominance = totalHeight > 0 ? Math.max(...sectorHeights) / totalHeight : 0;
  const directional = clamp01(1 - Math.max(0, dominance - 0.28) / 0.72);
  const variation = maximumHeight > 0
    ? clamp01(0.45 + (maximumHeight - minimumHeight) / maximumHeight * 0.55)
    : 1;
  const earlyFloor = structures.length <= 2 ? 0.68 : 0;
  return round6(Math.max(earlyFloor, directional * 0.72 + variation * 0.28));
}

function scoreOpenWater(windowCount: number, freeWaterFraction: number, structureCount: number): number {
  if (structureCount === 0) return 1;
  const minimumWindows = Math.min(3, structureCount);
  const gapScore = windowCount >= minimumWindows && windowCount <= 5
    ? 1
    : windowCount < minimumWindows
      ? clamp01(windowCount / Math.max(1, minimumWindows))
      : clamp01(1 - (windowCount - 5) * 0.08);
  return round6(gapScore * 0.62 + clamp01(freeWaterFraction / 0.42) * 0.38);
}

export function scoreReefComposition(
  core: ReefCoreManifest,
  structures: readonly ReefYearStructure[],
): { score: ReefCompositionScore; metrics: ReefCompositionMetrics } {
  const visibility = coreVisibility(core, structures);
  const water = waterMetrics(structures);
  const clearance = minimumClearance(structures);
  const collisionFree = clearance === null || clearance >= -1e-6;
  const collision = clearance === null ? 1 : clamp01((clearance + 0.04) / 0.2);
  const coreVisibilityScore = clamp01(visibility / 0.5);
  const openWater = scoreOpenWater(water.waterWindowCount, water.freeWaterFraction, structures.length);
  const heightBalance = directionalBalance(structures, 'height');
  const radialBalance = directionalBalance(structures, 'radial');
  const silhouette = silhouetteScore(structures);
  const total = round6(
    coreVisibilityScore * 0.25
      + openWater * 0.20
      + heightBalance * 0.15
      + radialBalance * 0.15
      + silhouette * 0.15
      + collision * 0.10,
  );
  return {
    score: {
      coreVisibility: round6(coreVisibilityScore),
      openWater,
      heightBalance,
      radialBalance,
      silhouette,
      collision: round6(collision),
      total,
    },
    metrics: {
      coreVisibility: visibility,
      freeWaterFraction: water.freeWaterFraction,
      waterWindowCount: water.waterWindowCount,
      minimumClearance: clearance,
      collisionFree,
    },
  };
}

function candidateTransform(structure: ReefYearStructure, attempt: number): CandidateTransform {
  if (attempt === 0) {
    return { x: structure.center.x, z: structure.center.z, rotationY: structure.rotationY, attempt };
  }
  const baseAngle = Math.atan2(structure.center.z, structure.center.x);
  const baseRadius = Math.max(0.01, Math.hypot(structure.center.x, structure.center.z));
  const direction = seededUnit(structure.seed, `composition-side:${attempt}`) < 0.5 ? -1 : 1;
  const angleOffset = direction * (
    0.12 + attempt * 0.055 + seededUnit(structure.seed, `composition-angle:${attempt}`) * 0.16
  );
  const radialScale = 1.02 + attempt * 0.025 + seededUnit(structure.seed, `composition-radius:${attempt}`) * 0.09;
  const angle = baseAngle + angleOffset;
  const radius = baseRadius * radialScale;
  return {
    x: round6(Math.cos(angle) * radius),
    z: round6(Math.sin(angle) * radius),
    rotationY: round6(structure.rotationY + angleOffset * 0.42),
    attempt,
  };
}

function applyTransform(structure: ReefYearStructure, candidate: CandidateTransform): ReefYearStructure {
  return {
    ...structure,
    center: { ...structure.center, x: candidate.x, z: candidate.z },
    rotationY: candidate.rotationY,
  };
}

function candidateMerit(core: ReefCoreManifest, structures: readonly ReefYearStructure[]): number {
  const evaluated = scoreReefComposition(core, structures);
  const hardPenalty = (evaluated.metrics.collisionFree ? 0 : 0.5)
    + (evaluated.metrics.coreVisibility >= REEF_MIN_CORE_VISIBILITY ? 0 : 0.2);
  return evaluated.score.total - hardPenalty;
}

/**
 * Phase 3 composition pass. Structures are processed strictly by yearIndex.
 * A new year may only move itself; previously composed years are immutable.
 */
export function buildReefComposition({
  core,
  yearStructures,
}: BuildReefCompositionInput): ReefCompositionManifest {
  const composed: ReefComposedYearStructure[] = [];
  const source = [...yearStructures.structures].sort((a, b) => a.yearIndex - b.yearIndex);

  for (const structure of source) {
    const scoringCore = compositionCoreForYear(core, structure.yearIndex);
    const baseCandidate = candidateTransform(structure, 0);
    let bestCandidate = baseCandidate;
    let bestStructure = applyTransform(structure, baseCandidate);
    let bestSet: ReefYearStructure[] = [...composed, bestStructure];
    let bestEvaluation = scoreReefComposition(scoringCore, bestSet);
    let bestMerit = candidateMerit(scoringCore, bestSet);

    const acceptable = bestEvaluation.score.total >= REEF_COMPOSITION_ACCEPT_SCORE
      && bestEvaluation.metrics.collisionFree
      && bestEvaluation.metrics.coreVisibility >= REEF_MIN_CORE_VISIBILITY;

    if (!acceptable) {
      for (let attempt = 1; attempt <= REEF_COMPOSITION_ATTEMPTS; attempt += 1) {
        const candidate = candidateTransform(structure, attempt);
        const transformed = applyTransform(structure, candidate);
        const candidateSet: ReefYearStructure[] = [...composed, transformed];
        const evaluation = scoreReefComposition(scoringCore, candidateSet);
        const merit = candidateMerit(scoringCore, candidateSet);
        if (merit > bestMerit + 1e-9) {
          bestCandidate = candidate;
          bestStructure = transformed;
          bestSet = candidateSet;
          bestEvaluation = evaluation;
          bestMerit = merit;
        }
      }
    }

    composed.push({
      ...bestStructure,
      composition: {
        sourceSignature: structure.signature,
        attempt: bestCandidate.attempt,
        adjusted: bestCandidate.attempt !== 0,
        score: bestEvaluation.score,
      },
    });
  }

  const finalEvaluation = scoreReefComposition(core, composed);
  const adjustedStructureCount = composed.filter((structure) => structure.composition.adjusted).length;
  const signaturePayload = composed
    .map((structure) => `${structure.signature}:${structure.center.x}:${structure.center.z}:${structure.rotationY}:${structure.composition.attempt}`)
    .join('|');

  return {
    version: REEF_COMPOSITION_VERSION,
    reefSeed: core.identity.reefSeed,
    sourceYearStructuresSignature: yearStructures.signature,
    structures: composed,
    diagnostics: {
      structureCount: composed.length,
      adjustedStructureCount,
      score: finalEvaluation.score,
      ...finalEvaluation.metrics,
    },
    signature: hex32(stableHash32(
      `${REEF_COMPOSITION_VERSION}\u001f${core.identity.reefSeed}\u001f${signaturePayload}`,
    )),
  };
}
