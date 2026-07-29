import {
  clamp01,
  distance,
  dot,
  length,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  subtract,
} from '../growth/math';
import type { GrowthVec3 } from '../growth';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
} from '../labs/organic';
import type {
  BuildTreeCompositionInput,
  TreeCompositionBounds,
  TreeCompositionBranch,
  TreeCompositionRole,
  TreeCompositionScore,
  TreeCompositionState,
  TreeSilhouette,
} from './types';

const TAU = Math.PI * 2;
const UP: GrowthVec3 = { x: 0, y: 1, z: 0 };

function validateInput(input: BuildTreeCompositionInput): void {
  const { config, skeleton, frames } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Composition requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.azimuthSectorCount) || config.azimuthSectorCount < 6) {
    throw new Error('Tree Composition azimuthSectorCount must be an integer of at least 6.');
  }
  if (!Number.isInteger(config.verticalLayerCount) || config.verticalLayerCount < 2) {
    throw new Error('Tree Composition verticalLayerCount must be an integer of at least 2.');
  }
  for (const [name, value] of [
    ['targetEmptySectorShare', config.targetEmptySectorShare],
    ['targetCrownFill', config.targetCrownFill],
  ] as const) {
    if (!Number.isFinite(value) || value <= 0 || value >= 1) {
      throw new Error(`Tree Composition ${name} must be between 0 and 1.`);
    }
  }
  if (skeleton.nodes.length === 0) {
    throw new Error('Tree Composition requires a non-empty organic skeleton.');
  }
  if (frames.curves.length === 0) {
    throw new Error('Tree Composition requires non-empty organic curve frames.');
  }
  if (frames.sourceSkeletonVersion !== skeleton.organicSkeletonVersion) {
    throw new Error('Tree Composition frame and skeleton versions do not match.');
  }
  if (frames.sourceRulesVersion !== skeleton.rulesVersion) {
    throw new Error('Tree Composition frame rules do not match the source skeleton.');
  }
}

function roleForGeneration(generation: number): TreeCompositionRole {
  if (generation <= 0) return 'trunk';
  if (generation === 1) return 'primary';
  if (generation === 2) return 'secondary';
  return 'twig';
}

function normalizedSector(angle: number, count: number): number {
  const normalized = ((angle % TAU) + TAU) % TAU;
  return Math.min(count - 1, Math.floor((normalized / TAU) * count));
}

function fixedLayer(height: number, totalHeight: number, count: number): number {
  const normalized = clamp01(height / Math.max(totalHeight, 1e-6));
  return Math.min(count - 1, Math.floor(normalized * count));
}

function axialPosition(position: GrowthVec3, base: GrowthVec3, axis: GrowthVec3): number {
  return dot(subtract(position, base), axis);
}

function radialVector(position: GrowthVec3, base: GrowthVec3, axis: GrowthVec3): GrowthVec3 {
  const relative = subtract(position, base);
  return subtract(relative, scale(axis, dot(relative, axis)));
}

function radialDistance(position: GrowthVec3, base: GrowthVec3, axis: GrowthVec3): number {
  return length(radialVector(position, base, axis));
}

function branchLength(samples: readonly OrganicCurveFrameSample[]): number {
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    total += distance(samples[index - 1]!.position, samples[index]!.position);
  }
  return total;
}

function branchVolume(samples: readonly OrganicCurveFrameSample[]): number {
  let total = 0;
  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1]!;
    const current = samples[index]!;
    const segmentLength = distance(previous.position, current.position);
    total += Math.PI * segmentLength
      * (previous.radius ** 2 + previous.radius * current.radius + current.radius ** 2)
      / 3;
  }
  return total;
}

function coefficientOfVariation(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 1e-9) return 0;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

function branchSector(
  curve: OrganicBranchCurve,
  base: GrowthVec3,
  axis: GrowthVec3,
  tangent: GrowthVec3,
  bitangent: GrowthVec3,
  sectorCount: number,
): number {
  if (curve.generation === 0) return 0;
  const weighted = curve.samples.reduce(
    (sum, sample) => ({
      x: sum.x + sample.position.x * Math.max(sample.radius, 0.001),
      y: sum.y + sample.position.y * Math.max(sample.radius, 0.001),
      z: sum.z + sample.position.z * Math.max(sample.radius, 0.001),
      weight: sum.weight + Math.max(sample.radius, 0.001),
    }),
    { x: 0, y: 0, z: 0, weight: 0 },
  );
  const center = weighted.weight > 0
    ? { x: weighted.x / weighted.weight, y: weighted.y / weighted.weight, z: weighted.z / weighted.weight }
    : curve.samples[0]?.position ?? base;
  const radial = radialVector(center, base, axis);
  if (length(radial) <= 1e-9) return 0;
  return normalizedSector(Math.atan2(dot(radial, bitangent), dot(radial, tangent)), sectorCount);
}

function mapBranch(
  curve: OrganicBranchCurve,
  nodeCounts: ReadonlyMap<string, number>,
  base: GrowthVec3,
  axis: GrowthVec3,
  tangent: GrowthVec3,
  bitangent: GrowthVec3,
  fixedTotalHeight: number,
  sectorCount: number,
  layerCount: number,
): TreeCompositionBranch {
  const heights = curve.samples.map((sample) => axialPosition(sample.position, base, axis));
  const radii = curve.samples.map((sample) => sample.radius);
  const verticalLayerIndices = [...new Set(heights.map(
    (height) => fixedLayer(height, fixedTotalHeight, layerCount),
  ))].sort((left, right) => left - right);
  const terminalDirection = curve.samples[curve.samples.length - 1]?.tangent ?? axis;

  return {
    branchId: curve.branchId,
    generation: curve.generation,
    role: roleForGeneration(curve.generation),
    parentBranchId: curve.junction?.parentBranchId ?? null,
    sourceNodeCount: nodeCounts.get(curve.branchId) ?? 0,
    sampleCount: curve.samples.length,
    length: round6(branchLength(curve.samples)),
    meanRadius: round6(radii.length > 0
      ? radii.reduce((sum, value) => sum + value, 0) / radii.length
      : 0),
    estimatedVolume: round6(branchVolume(curve.samples)),
    radialReach: round6(Math.max(
      0,
      ...curve.samples.map((sample) => radialDistance(sample.position, base, axis)),
    )),
    minHeight: round6(Math.min(...heights)),
    maxHeight: round6(Math.max(...heights)),
    azimuthSectorIndex: branchSector(
      curve,
      base,
      axis,
      tangent,
      bitangent,
      sectorCount,
    ),
    verticalLayerIndices,
    terminalDirection: roundVec(terminalDirection),
  };
}

function buildBounds(samples: readonly OrganicCurveFrameSample[]): TreeCompositionBounds {
  const min = { ...samples[0]!.position };
  const max = { ...samples[0]!.position };
  for (const sample of samples.slice(1)) {
    min.x = Math.min(min.x, sample.position.x);
    min.y = Math.min(min.y, sample.position.y);
    min.z = Math.min(min.z, sample.position.z);
    max.x = Math.max(max.x, sample.position.x);
    max.y = Math.max(max.y, sample.position.y);
    max.z = Math.max(max.z, sample.position.z);
  }
  const center = {
    x: (min.x + max.x) * 0.5,
    y: (min.y + max.y) * 0.5,
    z: (min.z + max.z) * 0.5,
  };
  const radius = Math.max(...samples.map((sample) => distance(sample.position, center)));
  return {
    min: roundVec(min),
    max: roundVec(max),
    center: roundVec(center),
    radius: round6(radius),
    height: round6(max.y - min.y),
  };
}

interface CrownMetrics {
  maxRadial: number;
  crownHeight: number;
  lean: number;
  spread: number;
  weightedCenter: GrowthVec3;
}

function crownMetrics(
  samples: readonly OrganicCurveFrameSample[],
  base: GrowthVec3,
  axis: GrowthVec3,
): CrownMetrics {
  const crown = samples.filter((sample) => sample.generation > 0);
  const source = crown.length > 0 ? crown : samples;
  const maxRadial = Math.max(0, ...source.map((sample) => radialDistance(sample.position, base, axis)));
  const heights = source.map((sample) => axialPosition(sample.position, base, axis));
  const crownHeight = Math.max(1e-6, Math.max(...heights) - Math.min(...heights));
  const weighted = source.reduce(
    (sum, sample) => {
      const weight = Math.max(sample.radius, 0.001);
      return {
        x: sum.x + sample.position.x * weight,
        y: sum.y + sample.position.y * weight,
        z: sum.z + sample.position.z * weight,
        weight: sum.weight + weight,
      };
    },
    { x: 0, y: 0, z: 0, weight: 0 },
  );
  const weightedCenter = weighted.weight > 0
    ? { x: weighted.x / weighted.weight, y: weighted.y / weighted.weight, z: weighted.z / weighted.weight }
    : base;
  const lean = radialDistance(weightedCenter, base, axis) / Math.max(maxRadial, 1e-6);
  return {
    maxRadial,
    crownHeight,
    lean,
    spread: maxRadial / crownHeight,
    weightedCenter,
  };
}

function classifySilhouette(metrics: CrownMetrics): TreeSilhouette {
  if (metrics.lean > 0.36) return 'windswept';
  if (metrics.spread < 0.48) return 'columnar';
  if (metrics.spread > 0.88) return 'umbrella';
  return 'oval';
}

function scoreComposition(
  curves: readonly OrganicBranchCurve[],
  branches: readonly TreeCompositionBranch[],
  silhouette: TreeSilhouette,
  metrics: CrownMetrics,
  occupiedCellCount: number,
  sectorCounts: readonly number[],
  sectorCount: number,
  layerCount: number,
  targetEmptySectorShare: number,
  targetCrownFill: number,
  base: GrowthVec3,
  axis: GrowthVec3,
): TreeCompositionScore {
  const trunk = branches.find((branch) => branch.role === 'trunk') ?? branches[0]!;
  const totalVolume = branches.reduce((sum, branch) => sum + branch.estimatedVolume, 0) || 1;
  const trunkShare = trunk.estimatedVolume / totalVolume;
  const generationMeans = [0, 1, 2, 3].map((generation) => {
    const values = branches
      .filter((branch) => Math.min(branch.generation, 3) === generation)
      .map((branch) => branch.estimatedVolume);
    return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  });
  const taperPairs = generationMeans.slice(1).reduce((score, mean, index) => {
    const parentMean = generationMeans[index] ?? 0;
    if (parentMean <= 1e-9 || mean <= 1e-9) return score;
    return score + (mean < parentMean ? 1 : clamp01(parentMean / mean));
  }, 0);
  const comparablePairs = generationMeans.slice(1).filter(
    (mean, index) => mean > 1e-9 && (generationMeans[index] ?? 0) > 1e-9,
  ).length;
  const taperScore = comparablePairs > 0 ? taperPairs / comparablePairs : 1;
  const primaryCount = branches.filter((branch) => branch.role === 'primary').length;
  const primaryScore = primaryCount >= 3 && primaryCount <= 8
    ? 1
    : clamp01(1 - Math.abs(primaryCount - 5.5) / 7);
  const hierarchy = clamp01(trunkShare * 1.7 * 0.45 + taperScore * 0.35 + primaryScore * 0.2);

  const childCurves = curves.filter((curve) => curve.generation > 0 && curve.junction !== null);
  const flow = childCurves.length === 0
    ? 1
    : clamp01(childCurves.reduce((sum, curve) => {
      const firstDirection = curve.samples[1]?.tangent ?? curve.samples[0]?.tangent ?? axis;
      return sum + Math.max(0, dot(firstDirection, curve.junction!.childDirection));
    }, 0) / childCurves.length);

  const silhouetteTarget = silhouette === 'columnar'
    ? 0.36
    : silhouette === 'oval'
      ? 0.68
      : silhouette === 'umbrella'
        ? 1.02
        : 0.76;
  const spreadScore = clamp01(1 - Math.abs(metrics.spread - silhouetteTarget) / 0.9);
  const silhouetteScore = silhouette === 'windswept'
    ? clamp01(spreadScore * 0.55 + (1 - Math.abs(metrics.lean - 0.48) / 0.52) * 0.45)
    : spreadScore;

  const cellCount = sectorCount * layerCount;
  const crownFill = occupiedCellCount / Math.max(cellCount, 1);
  const crownDensity = clamp01(
    1 - Math.abs(crownFill - targetCrownFill) / Math.max(targetCrownFill, 1 - targetCrownFill),
  );

  const leanTarget = silhouette === 'windswept' ? 0.42 : 0.08;
  const balance = clamp01(1 - Math.abs(metrics.lean - leanTarget) / 0.62);

  const branchLengths = branches
    .filter((branch) => branch.role !== 'trunk')
    .map((branch) => branch.length);
  const rhythmCv = coefficientOfVariation(branchLengths);
  const rhythm = clamp01(1 - Math.abs(rhythmCv - 0.38) / 0.85);

  const emptySectorShare = sectorCounts.filter((count) => count === 0).length / sectorCount;
  const sectorSpace = clamp01(
    1 - Math.abs(emptySectorShare - targetEmptySectorShare)
      / Math.max(targetEmptySectorShare, 1 - targetEmptySectorShare),
  );
  const emptyCellShare = 1 - crownFill;
  const targetEmptyCellShare = 1 - targetCrownFill;
  const cellSpace = clamp01(
    1 - Math.abs(emptyCellShare - targetEmptyCellShare)
      / Math.max(targetEmptyCellShare, 1 - targetEmptyCellShare),
  );
  const negativeSpace = clamp01(sectorSpace * 0.48 + cellSpace * 0.52);

  const nonTrunk = curves.filter((curve) => curve.generation > 0);
  const junctionRealism = nonTrunk.length === 0
    ? 1
    : clamp01(nonTrunk.reduce((sum, curve) => {
      const junction = curve.junction;
      if (!junction) return sum;
      const childRadius = curve.samples[junction.joinSampleIndex]?.radius
        ?? curve.samples[0]?.radius
        ?? 0;
      const radiusRatio = junction.collarRadius / Math.max(junction.parentRadius, childRadius, 1e-6);
      const embedded = distance(junction.insetPosition, junction.parentPosition)
        < distance(junction.surfacePosition, junction.parentPosition);
      return sum + (embedded ? 0.45 : 0.1) + clamp01(1 - Math.abs(radiusRatio - 0.72) / 0.72) * 0.55;
    }, 0) / nonTrunk.length);

  const weightedCenterRelative = subtract(metrics.weightedCenter, base);
  const axialCenter = scale(axis, dot(weightedCenterRelative, axis));
  const radialCenter = length(subtract(weightedCenterRelative, axialCenter));
  const centerSanity = clamp01(1 - radialCenter / Math.max(metrics.maxRadial * 1.2, 1e-6));
  const adjustedBalance = clamp01(balance * 0.82 + centerSanity * 0.18);

  const total = hierarchy * 0.17
    + flow * 0.13
    + silhouetteScore * 0.14
    + crownDensity * 0.12
    + adjustedBalance * 0.12
    + rhythm * 0.09
    + negativeSpace * 0.13
    + junctionRealism * 0.1;

  return {
    hierarchy: round6(hierarchy),
    flow: round6(flow),
    silhouette: round6(silhouetteScore),
    crownDensity: round6(crownDensity),
    balance: round6(adjustedBalance),
    rhythm: round6(rhythm),
    negativeSpace: round6(negativeSpace),
    junctionRealism: round6(junctionRealism),
    total: round6(clamp01(total)),
  };
}

/**
 * Immutable composition analysis. It scores hierarchy and crown space without
 * moving, trimming, resizing or regenerating any historical branch.
 */
export function buildTreeComposition(
  input: BuildTreeCompositionInput,
): TreeCompositionState {
  validateInput(input);
  const trunk = input.frames.curves.find((curve) => curve.branchId === 'organic:trunk')
    ?? input.frames.curves.find((curve) => curve.generation === 0)
    ?? input.frames.curves[0]!;
  const trunkStart = trunk.samples[0]!;
  const trunkEnd = trunk.samples[trunk.samples.length - 1]!;
  const axis = roundVec(normalize(subtract(trunkEnd.position, trunkStart.position), UP));
  const base = trunkStart.position;
  const basis = orthonormalBasis(axis);
  const fixedTotalHeight = input.species.structure.trunkHeight + input.species.structure.crownHeight;
  const nodeCounts = new Map<string, number>();
  for (const node of input.skeleton.nodes) {
    nodeCounts.set(node.branchId, (nodeCounts.get(node.branchId) ?? 0) + 1);
  }

  const branches = input.frames.curves.map((curve) => mapBranch(
    curve,
    nodeCounts,
    base,
    axis,
    basis.tangent,
    basis.bitangent,
    fixedTotalHeight,
    input.config.azimuthSectorCount,
    input.config.verticalLayerCount,
  ));
  const samples = input.frames.curves.flatMap((curve) => curve.samples);
  const bounds = buildBounds(samples);
  const metrics = crownMetrics(samples, base, axis);
  const silhouette = classifySilhouette(metrics);

  const occupiedCells = new Set<string>();
  const sectorCounts = Array.from({ length: input.config.azimuthSectorCount }, () => 0);
  for (const curve of input.frames.curves) {
    if (curve.generation <= 0) continue;
    const sector = branchSector(
      curve,
      base,
      axis,
      basis.tangent,
      basis.bitangent,
      input.config.azimuthSectorCount,
    );
    sectorCounts[sector] = (sectorCounts[sector] ?? 0) + 1;
    for (const sample of curve.samples) {
      occupiedCells.add(`${sector}:${fixedLayer(
        axialPosition(sample.position, base, axis),
        fixedTotalHeight,
        input.config.verticalLayerCount,
      )}`);
    }
  }

  const skeletonBranchIds = new Set(input.skeleton.nodes.map((node) => node.branchId));
  const curveBranchIds = new Set(input.frames.curves.map((curve) => curve.branchId));
  const missingCurveBranchIds = [...skeletonBranchIds]
    .filter((branchId) => !curveBranchIds.has(branchId))
    .sort();
  const orphanCurveBranchIds = input.frames.curves
    .filter((curve) => curve.generation > 0 && (
      !curve.junction || !curveBranchIds.has(curve.junction.parentBranchId)
    ))
    .map((curve) => curve.branchId)
    .sort();
  const averagePerSector = Math.max(1, branches.filter((branch) => branch.role !== 'trunk').length)
    / input.config.azimuthSectorCount;
  const generationCount = Math.max(0, ...branches.map((branch) => branch.generation)) + 1;
  const generationCounts = Array.from({ length: generationCount }, (_, generation) =>
    branches.filter((branch) => branch.generation === generation).length,
  );
  const cellCount = input.config.azimuthSectorCount * input.config.verticalLayerCount;

  return {
    treeCompositionVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceSpeciesRulesVersion: input.species.rulesVersion,
    sourceSkeletonVersion: input.skeleton.organicSkeletonVersion,
    sourceFrameVersion: input.frames.organicCurveFrameVersion,
    artifactSeed: input.species.artifactSeed,
    silhouette,
    axis,
    bounds,
    branches,
    score: scoreComposition(
      input.frames.curves,
      branches,
      silhouette,
      metrics,
      occupiedCells.size,
      sectorCounts,
      input.config.azimuthSectorCount,
      input.config.verticalLayerCount,
      input.config.targetEmptySectorShare,
      input.config.targetCrownFill,
      base,
      axis,
    ),
    diagnostics: {
      missingCurveBranchIds,
      orphanCurveBranchIds,
      emptySectorIndices: sectorCounts.flatMap((count, index) => count === 0 ? [index] : []),
      crowdedSectorIndices: sectorCounts.flatMap(
        (count, index) => count > Math.max(2, averagePerSector * 1.8) ? [index] : [],
      ),
      occupiedCellCount: occupiedCells.size,
      emptyCellCount: Math.max(0, cellCount - occupiedCells.size),
      generationCounts,
    },
  };
}
