import type { TreeFoliageCluster } from '../foliage';
import {
  add,
  clamp01,
  dot,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  seededUnit,
  subtract,
} from '../growth/math';
import { buildTreeLeafCardTemplate } from './template';
import type {
  BuildTreeLeafGeometryInput,
  TreeLeafGeometryState,
  TreeLeafInstance,
} from './types';

const TAU = Math.PI * 2;

function validateInput(input: BuildTreeLeafGeometryInput): void {
  const { config, lod } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Leaf Geometry requires a non-empty rulesVersion.');
  }
  for (const publishedLod of ['high', 'medium', 'low'] as const) {
    const fraction = config.renderFractionByLod[publishedLod];
    const maxInstances = config.maxInstancesByLod[publishedLod];
    if (!Number.isFinite(fraction) || fraction <= 0 || fraction > 1) {
      throw new Error(`Tree Leaf Geometry renderFractionByLod.${publishedLod} must be in (0, 1].`);
    }
    if (!Number.isInteger(maxInstances) || maxInstances <= 0) {
      throw new Error(`Tree Leaf Geometry maxInstancesByLod.${publishedLod} must be positive.`);
    }
  }
  if (!(lod in config.renderFractionByLod) || !(lod in config.maxInstancesByLod)) {
    throw new Error(`Tree Leaf Geometry does not support LOD "${String(lod)}".`);
  }
  if (
    !Number.isFinite(config.minimumLength)
    || !Number.isFinite(config.maximumLength)
    || config.minimumLength <= 0
    || config.minimumLength > config.maximumLength
  ) {
    throw new Error('Tree Leaf Geometry length range is invalid.');
  }
  if (
    !Number.isFinite(config.minimumWidthRatio)
    || !Number.isFinite(config.maximumWidthRatio)
    || config.minimumWidthRatio <= 0
    || config.minimumWidthRatio > config.maximumWidthRatio
  ) {
    throw new Error('Tree Leaf Geometry width ratio range is invalid.');
  }
  if (
    !Number.isFinite(config.radialSpread)
    || !Number.isFinite(config.axialSpread)
    || config.radialSpread < 0
    || config.axialSpread < 0
  ) {
    throw new Error('Tree Leaf Geometry spread values must be non-negative.');
  }
}

function targetInstanceCount(
  cluster: TreeFoliageCluster,
  fraction: number,
): number {
  if (cluster.leafCount <= 0) return 0;
  return Math.max(1, Math.min(cluster.leafCount, Math.floor(cluster.leafCount * fraction)));
}

function buildInstance(
  cluster: TreeFoliageCluster,
  localIndex: number,
  sequence: number,
  input: BuildTreeLeafGeometryInput,
): TreeLeafInstance {
  const id = `tree:leaf:${cluster.id}:${localIndex}`;
  const basis = orthonormalBasis(cluster.direction);
  const angle = seededUnit(cluster.seed, `${id}:angle`) * TAU;
  const radialDirection = normalize(add(
    scale(basis.tangent, Math.cos(angle)),
    scale(basis.bitangent, Math.sin(angle)),
  ), basis.tangent);
  const radialDistance = Math.sqrt(seededUnit(cluster.seed, `${id}:radial`))
    * cluster.radius
    * input.config.radialSpread;
  const axialDistance = (seededUnit(cluster.seed, `${id}:axial`) * 2 - 1)
    * cluster.radius
    * input.config.axialSpread;
  const position = add(
    cluster.position,
    add(
      scale(radialDirection, radialDistance),
      scale(cluster.direction, axialDistance),
    ),
  );
  const outwardBias = 0.26 + seededUnit(cluster.seed, `${id}:outward`) * 0.34;
  const direction = normalize(
    add(cluster.direction, scale(radialDirection, outwardBias)),
    cluster.direction,
  );
  const rawNormal = add(
    cluster.normal,
    scale(radialDirection, 0.18 + seededUnit(cluster.seed, `${id}:normal`) * 0.34),
  );
  const normal = normalize(
    subtract(rawNormal, scale(direction, dot(rawNormal, direction))),
    basis.tangent,
  );
  const radiusMaturity = clamp01(cluster.radius / 0.52);
  const lengthMix = clamp01(
    cluster.density * 0.42
      + radiusMaturity * 0.18
      + seededUnit(cluster.seed, `${id}:length`) * 0.4,
  );
  const length = input.config.minimumLength
    + (input.config.maximumLength - input.config.minimumLength) * lengthMix;
  const widthRatio = input.config.minimumWidthRatio
    + (input.config.maximumWidthRatio - input.config.minimumWidthRatio)
      * seededUnit(cluster.seed, `${id}:width`);
  const seed = Math.floor(seededUnit(cluster.seed, `${id}:seed`) * 0xffffffff);

  return {
    id,
    clusterId: cluster.id,
    branchId: cluster.branchId,
    localIndex,
    sequence,
    seed,
    position: roundVec(position),
    direction: roundVec(direction),
    normal: roundVec(normal),
    length: round6(length),
    width: round6(length * widthRatio),
    rollRad: round6(seededUnit(cluster.seed, `${id}:roll`) * TAU),
  };
}

/**
 * Expands stable foliage clusters into a bounded set of leaf-card transforms.
 * LOD changes only how many logical leaves are represented and which shared
 * card template is used. Cluster placement is never regenerated here.
 */
export function buildTreeLeafGeometry(
  input: BuildTreeLeafGeometryInput,
): TreeLeafGeometryState {
  validateInput(input);
  const fraction = input.config.renderFractionByLod[input.lod];
  const maxInstances = input.config.maxInstancesByLod[input.lod];
  const template = buildTreeLeafCardTemplate(input.lod);
  const instances: TreeLeafInstance[] = [];
  const truncatedInstanceIds: string[] = [];
  const emittedByCluster = new Set<string>();
  let candidateInstanceCount = 0;

  for (const cluster of input.foliage.clusters) {
    const count = targetInstanceCount(cluster, fraction);
    for (let localIndex = 0; localIndex < count; localIndex += 1) {
      const id = `tree:leaf:${cluster.id}:${localIndex}`;
      candidateInstanceCount += 1;
      if (instances.length >= maxInstances) {
        truncatedInstanceIds.push(id);
        continue;
      }
      instances.push(buildInstance(cluster, localIndex, instances.length, input));
      emittedByCluster.add(cluster.id);
    }
  }

  const clusterIdsWithoutInstances = input.foliage.clusters
    .filter((cluster) => !emittedByCluster.has(cluster.id))
    .map((cluster) => cluster.id)
    .sort();

  return {
    treeLeafGeometryVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceFoliageVersion: input.foliage.treeFoliageVersion,
    sourceFoliageRulesVersion: input.foliage.rulesVersion,
    artifactSeed: input.foliage.artifactSeed,
    lod: input.lod,
    template,
    instances,
    diagnostics: {
      sourceClusterCount: input.foliage.clusters.length,
      candidateInstanceCount,
      renderedInstanceCount: instances.length,
      truncatedInstanceIds,
      clusterIdsWithoutInstances,
      sharedVertexCount: template.vertexCount,
      sharedTriangleCount: template.triangleCount,
      renderedTriangleCount: template.triangleCount * instances.length,
      estimatedDrawCalls: 1,
      instanceBudgetReached: truncatedInstanceIds.length > 0,
    },
  };
}
