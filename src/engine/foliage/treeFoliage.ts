import type { TreeCompositionBranch } from '../composition';
import {
  add,
  clamp01,
  normalize,
  round6,
  roundVec,
  scale,
  seededUnit,
} from '../growth/math';
import type {
  OrganicBranchCurve,
  OrganicCurveFrameSample,
} from '../labs/organic';
import type {
  BuildTreeFoliageInput,
  FoliageBranchRole,
  TreeFoliageCluster,
  TreeFoliageState,
} from './types';

function validateInput(input: BuildTreeFoliageInput): void {
  const { config, frames, composition } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Foliage requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.minimumGeneration) || config.minimumGeneration < 1) {
    throw new Error('Tree Foliage minimumGeneration must be a positive integer.');
  }
  if (!Number.isFinite(config.terminalStart) || config.terminalStart < 0 || config.terminalStart >= 1) {
    throw new Error('Tree Foliage terminalStart must be in the [0, 1) range.');
  }
  for (const [name, value] of [
    ['maxClusters', config.maxClusters],
    ['maxLeaves', config.maxLeaves],
    ['minLeavesPerCluster', config.minLeavesPerCluster],
    ['maxLeavesPerCluster', config.maxLeavesPerCluster],
  ] as const) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`Tree Foliage ${name} must be a positive integer.`);
    }
  }
  if (config.minLeavesPerCluster > config.maxLeavesPerCluster) {
    throw new Error('Tree Foliage leaf count range is inverted.');
  }
  if (
    !Number.isFinite(config.minClusterRadius)
    || !Number.isFinite(config.maxClusterRadius)
    || config.minClusterRadius <= 0
    || config.minClusterRadius > config.maxClusterRadius
  ) {
    throw new Error('Tree Foliage cluster radius range is invalid.');
  }
  for (const role of ['primary', 'secondary', 'twig'] as const) {
    if (!Number.isInteger(config.clustersByRole[role]) || config.clustersByRole[role] <= 0) {
      throw new Error(`Tree Foliage clustersByRole.${role} must be a positive integer.`);
    }
  }
  if (frames.curves.length === 0) {
    throw new Error('Tree Foliage requires non-empty curve frames.');
  }
  if (composition.branches.length === 0) {
    throw new Error('Tree Foliage requires a non-empty Tree Composition state.');
  }
  if (composition.sourceSpeciesRulesVersion !== input.species.rulesVersion) {
    throw new Error('Tree Foliage species and composition rules do not match.');
  }
  if (composition.sourceFrameVersion !== frames.organicCurveFrameVersion) {
    throw new Error('Tree Foliage frame and composition versions do not match.');
  }
}

function nearestSample(
  samples: readonly OrganicCurveFrameSample[],
  normalizedDistance: number,
): OrganicCurveFrameSample {
  return samples.reduce((closest, sample) => (
    Math.abs(sample.normalizedDistance - normalizedDistance)
      < Math.abs(closest.normalizedDistance - normalizedDistance)
      ? sample
      : closest
  ), samples[0]!);
}

function foliageRole(branch: TreeCompositionBranch): FoliageBranchRole | null {
  return branch.role === 'trunk' ? null : branch.role;
}

interface ClusterCandidate {
  id: string;
  branchId: string;
  sourceSampleId: string;
  generation: number;
  role: FoliageBranchRole;
  seed: number;
  position: TreeFoliageCluster['position'];
  direction: TreeFoliageCluster['direction'];
  normal: TreeFoliageCluster['normal'];
  radius: number;
  density: number;
  leafCount: number;
  azimuthSectorIndex: number;
  verticalLayerIndex: number;
  crownCellId: string;
}

function buildCandidate(
  artifactSeed: number,
  curve: OrganicBranchCurve,
  branch: TreeCompositionBranch,
  role: FoliageBranchRole,
  slot: number,
  slotCount: number,
  input: BuildTreeFoliageInput,
): ClusterCandidate {
  const id = `tree:foliage:${branch.branchId}:${slot}`;
  const jitter = (seededUnit(artifactSeed, `${id}:distance`) * 2 - 1)
    * (1 - input.config.terminalStart)
    / Math.max(slotCount * 5, 1);
  const targetDistance = clamp01(
    input.config.terminalStart
      + ((slot + 1) / (slotCount + 1)) * (1 - input.config.terminalStart)
      + jitter,
  );
  const terminalSamples = curve.samples.filter(
    (sample) => sample.normalizedDistance >= input.config.terminalStart,
  );
  const sample = nearestSample(terminalSamples.length > 0 ? terminalSamples : curve.samples, targetDistance);
  const radialUnit = seededUnit(artifactSeed, `${id}:radius`);
  const branchThickness = clamp01(branch.meanRadius / 0.14);
  const radiusMix = clamp01(radialUnit * 0.72 + branchThickness * 0.28);
  const radius = input.config.minClusterRadius
    + (input.config.maxClusterRadius - input.config.minClusterRadius) * radiusMix;
  const angle = seededUnit(artifactSeed, `${id}:angle`) * Math.PI * 2;
  const radialNormal = normalize(add(
    scale(sample.normal, Math.cos(angle)),
    scale(sample.binormal, Math.sin(angle)),
  ), sample.normal);
  const offset = sample.radius + radius * (0.28 + seededUnit(artifactSeed, `${id}:offset`) * 0.18);
  const position = add(sample.position, scale(radialNormal, offset));
  const outwardBias = 0.32 + seededUnit(artifactSeed, `${id}:direction`) * 0.28;
  const direction = normalize(add(sample.tangent, scale(radialNormal, outwardBias)), sample.tangent);
  const leafSpan = input.config.maxLeavesPerCluster - input.config.minLeavesPerCluster + 1;
  const roleBoost = role === 'twig' ? 2 : role === 'secondary' ? 1 : 0;
  const leafCount = Math.min(
    input.config.maxLeavesPerCluster,
    input.config.minLeavesPerCluster
      + Math.floor(seededUnit(artifactSeed, `${id}:leaves`) * leafSpan)
      + roleBoost,
  );
  const density = clamp01(
    (leafCount / input.config.maxLeavesPerCluster) * 0.78
      + seededUnit(artifactSeed, `${id}:density`) * 0.22,
  );
  const layerValues = branch.verticalLayerIndices.length > 0
    ? branch.verticalLayerIndices
    : [0];
  const layerSlot = Math.min(
    layerValues.length - 1,
    Math.floor(targetDistance * layerValues.length),
  );
  const verticalLayerIndex = layerValues[layerSlot] ?? 0;
  const seed = Math.floor(seededUnit(artifactSeed, `${id}:seed`) * 0xffffffff);

  return {
    id,
    branchId: branch.branchId,
    sourceSampleId: sample.id,
    generation: branch.generation,
    role,
    seed,
    position: roundVec(position),
    direction: roundVec(direction),
    normal: roundVec(radialNormal),
    radius: round6(radius),
    density: round6(density),
    leafCount,
    azimuthSectorIndex: branch.azimuthSectorIndex,
    verticalLayerIndex,
    crownCellId: `${branch.azimuthSectorIndex}:${verticalLayerIndex}`,
  };
}

/**
 * Builds stable cluster identities and local placement from accepted composition.
 * Global budgets only truncate later candidates; emitted historical clusters are
 * never resized or redistributed when later branches are appended.
 */
export function buildTreeFoliage(input: BuildTreeFoliageInput): TreeFoliageState {
  validateInput(input);
  const branchesById = new Map(
    input.composition.branches.map((branch) => [branch.branchId, branch] as const),
  );
  const clusters: TreeFoliageCluster[] = [];
  const truncatedClusterIds: string[] = [];
  const eligibleBranchIds: string[] = [];
  const emittedByBranch = new Map<string, number>();
  let candidateClusterCount = 0;
  let totalLeafCount = 0;
  let maxClusterBudgetReached = false;
  let maxLeafBudgetReached = false;

  for (const curve of input.frames.curves) {
    const branch = branchesById.get(curve.branchId);
    if (!branch || branch.generation < input.config.minimumGeneration || curve.samples.length === 0) {
      continue;
    }
    const role = foliageRole(branch);
    if (!role) continue;
    eligibleBranchIds.push(branch.branchId);
    const slotCount = input.config.clustersByRole[role];

    for (let slot = 0; slot < slotCount; slot += 1) {
      const candidate = buildCandidate(
        input.species.artifactSeed,
        curve,
        branch,
        role,
        slot,
        slotCount,
        input,
      );
      candidateClusterCount += 1;

      if (clusters.length >= input.config.maxClusters) {
        maxClusterBudgetReached = true;
        truncatedClusterIds.push(candidate.id);
        continue;
      }
      if (totalLeafCount + candidate.leafCount > input.config.maxLeaves) {
        maxLeafBudgetReached = true;
        truncatedClusterIds.push(candidate.id);
        continue;
      }

      clusters.push({
        ...candidate,
        sequence: clusters.length,
      });
      totalLeafCount += candidate.leafCount;
      emittedByBranch.set(branch.branchId, (emittedByBranch.get(branch.branchId) ?? 0) + 1);
    }
  }

  const occupiedCellIds = [...new Set(clusters.map((cluster) => cluster.crownCellId))].sort();
  const branchIdsWithoutFoliage = eligibleBranchIds
    .filter((branchId) => !emittedByBranch.has(branchId))
    .sort();

  return {
    treeFoliageVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceSpeciesRulesVersion: input.species.rulesVersion,
    sourceFrameVersion: input.frames.organicCurveFrameVersion,
    sourceCompositionVersion: input.composition.treeCompositionVersion,
    artifactSeed: input.species.artifactSeed,
    clusters,
    diagnostics: {
      candidateClusterCount,
      emittedClusterCount: clusters.length,
      totalLeafCount,
      occupiedCellIds,
      truncatedClusterIds,
      branchIdsWithoutFoliage,
      maxClusterBudgetReached,
      maxLeafBudgetReached,
    },
  };
}
