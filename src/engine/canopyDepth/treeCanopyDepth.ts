import {
  add,
  clamp01,
  distance,
  normalize,
  round6,
  roundVec,
  scale,
  seededUnit,
  subtract,
} from '../growth/math';
import type { TreeRgb } from '../treeMaterial';
import type {
  BuildTreeCanopyDepthInput,
  TreeCanopyDepthLayer,
  TreeCanopyDepthProfile,
  TreeCanopyDepthState,
} from './types';

const LAYERS: readonly TreeCanopyDepthLayer[] = ['inner', 'middle', 'outer'];
const TINT_VARIATION_BANDS = 8;

function validateInput(input: BuildTreeCanopyDepthInput): void {
  const { composition, foliage, leaves, materials, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Canopy Depth requires a non-empty rulesVersion.');
  }
  if (
    !Number.isFinite(config.innerDepthMaximum)
    || !Number.isFinite(config.outerDepthMinimum)
    || config.innerDepthMaximum <= 0
    || config.outerDepthMinimum >= 1
    || config.innerDepthMaximum >= config.outerDepthMinimum
  ) {
    throw new Error('Tree Canopy Depth layer thresholds are invalid.');
  }
  if (!Number.isFinite(config.maximumOffsetRatio) || config.maximumOffsetRatio < 0 || config.maximumOffsetRatio > 0.25) {
    throw new Error('Tree Canopy Depth maximumOffsetRatio must be in [0, 0.25].');
  }
  if (!Number.isInteger(config.quantizationSteps) || config.quantizationSteps < 2 || config.quantizationSteps > 256) {
    throw new Error('Tree Canopy Depth quantizationSteps must be an integer between 2 and 256.');
  }
  if (!Number.isInteger(config.maximumUniqueTints) || config.maximumUniqueTints < 3) {
    throw new Error('Tree Canopy Depth maximumUniqueTints must be at least three.');
  }
  for (const layer of LAYERS) {
    const scaleMultiplier = config.scaleByLayer[layer];
    const tint = config.tintByLayer[layer];
    if (!Number.isFinite(scaleMultiplier) || scaleMultiplier <= 0 || scaleMultiplier > 1.5) {
      throw new Error(`Tree Canopy Depth scaleByLayer.${layer} is invalid.`);
    }
    for (const channel of [tint.r, tint.g, tint.b]) {
      if (!Number.isFinite(channel) || channel < 0 || channel > 1) {
        throw new Error(`Tree Canopy Depth tintByLayer.${layer} must stay in [0, 1].`);
      }
    }
  }
  if (composition.artifactSeed !== foliage.artifactSeed
    || composition.artifactSeed !== leaves.artifactSeed
    || composition.artifactSeed !== materials.artifactSeed) {
    throw new Error('Tree Canopy Depth received states from different artifacts.');
  }
  if (foliage.sourceCompositionVersion !== composition.treeCompositionVersion) {
    throw new Error('Tree Canopy Depth foliage and composition versions do not match.');
  }
  if (leaves.sourceFoliageVersion !== foliage.treeFoliageVersion
    || leaves.sourceFoliageRulesVersion !== foliage.rulesVersion) {
    throw new Error('Tree Canopy Depth foliage and leaf geometry provenance does not match.');
  }
  if (materials.sourceCompositionVersion !== composition.treeCompositionVersion
    || materials.sourceFoliageVersion !== foliage.treeFoliageVersion
    || materials.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion) {
    throw new Error('Tree Canopy Depth material provenance does not match.');
  }
  if (!Number.isFinite(composition.bounds.radius) || composition.bounds.radius <= 0) {
    throw new Error('Tree Canopy Depth requires a positive accepted crown radius.');
  }
}

function quantize(value: number, steps: number): number {
  return round6(Math.round(clamp01(value) * (steps - 1)) / (steps - 1));
}

function tintForLayer(
  base: TreeRgb,
  variationBand: number,
  steps: number,
): TreeRgb {
  const factor = 0.94 + (variationBand / Math.max(1, TINT_VARIATION_BANDS - 1)) * 0.06;
  return {
    r: quantize(base.r * factor, steps),
    g: quantize(base.g * factor, steps),
    b: quantize(base.b * factor, steps),
  };
}

function tintKey(tint: TreeRgb): string {
  return `${tint.r.toFixed(6)},${tint.g.toFixed(6)},${tint.b.toFixed(6)}`;
}

function layerForProfile(
  localIndex: number,
  seed: number,
  leafId: string,
): TreeCanopyDepthLayer {
  const phase = Math.floor(seededUnit(seed, `${leafId}:depth-layer`) * LAYERS.length);
  return LAYERS[(localIndex + phase) % LAYERS.length] ?? 'middle';
}

function depthForLayer(
  layer: TreeCanopyDepthLayer,
  actualRadialDepth: number,
  seededDepth: number,
  input: BuildTreeCanopyDepthInput,
): number {
  const { innerDepthMaximum, outerDepthMinimum } = input.config;
  if (layer === 'inner') {
    return round6(Math.min(
      innerDepthMaximum,
      innerDepthMaximum * (0.2 + seededDepth * 0.62) * 0.76 + actualRadialDepth * 0.24,
    ));
  }
  if (layer === 'outer') {
    return round6(Math.max(
      outerDepthMinimum,
      outerDepthMinimum + (1 - outerDepthMinimum) * (0.2 + seededDepth * 0.8) * 0.76
        + actualRadialDepth * 0.24,
    ));
  }
  const middleSpan = outerDepthMinimum - innerDepthMaximum;
  const middle = innerDepthMaximum + middleSpan * (0.2 + seededDepth * 0.6);
  return round6(Math.min(
    outerDepthMinimum - 1e-6,
    Math.max(innerDepthMaximum + 1e-6, middle * 0.78 + actualRadialDepth * 0.22),
  ));
}

function offsetRatioForLayer(
  layer: TreeCanopyDepthLayer,
  seed: number,
  leafId: string,
  maximum: number,
): number {
  const variation = seededUnit(seed, `${leafId}:depth-offset`);
  if (layer === 'inner') return 0;
  if (layer === 'middle') return maximum * (0.14 + variation * 0.2);
  return maximum * (0.55 + variation * 0.45);
}

function profileSignature(state: Omit<TreeCanopyDepthState, 'signature'>): string {
  return [
    state.rulesVersion,
    state.artifactSeed,
    state.lod,
    state.profiles.length,
    state.diagnostics.innerLeafCount,
    state.diagnostics.middleLeafCount,
    state.diagnostics.outerLeafCount,
    state.diagnostics.uniqueTintCount,
    state.diagnostics.maximumPositionOffset.toFixed(6),
  ].join('|');
}

/**
 * Projects accepted leaf instances into stable inner/middle/outer crown layers.
 * Source leaf IDs, topology, occupied cells and instance count remain untouched.
 */
export function buildTreeCanopyDepth(
  input: BuildTreeCanopyDepthInput,
): TreeCanopyDepthState {
  validateInput(input);
  const clustersById = new Map(input.foliage.clusters.map((cluster) => [cluster.id, cluster] as const));
  const profiles: TreeCanopyDepthProfile[] = [];
  const tintKeys = new Set<string>();
  let innerLeafCount = 0;
  let middleLeafCount = 0;
  let outerLeafCount = 0;
  let maximumPositionOffset = 0;

  for (const leaf of input.leaves.instances) {
    const cluster = clustersById.get(leaf.clusterId);
    if (!cluster) {
      throw new Error(`Tree Canopy Depth cannot resolve source cluster "${leaf.clusterId}".`);
    }
    const layer = layerForProfile(leaf.localIndex, leaf.seed, leaf.id);
    const actualRadialDepth = clamp01(
      distance(leaf.position, input.composition.bounds.center)
        / input.composition.bounds.radius,
    );
    const seededDepth = seededUnit(leaf.seed, `${leaf.id}:depth`);
    const depth = depthForLayer(layer, actualRadialDepth, seededDepth, input);
    const outward = normalize(
      subtract(leaf.position, input.composition.bounds.center),
      cluster.normal,
    );
    const offsetRatio = offsetRatioForLayer(
      layer,
      leaf.seed,
      leaf.id,
      input.config.maximumOffsetRatio,
    );
    const offsetMagnitude = cluster.radius * offsetRatio;
    const positionOffset = roundVec(scale(outward, offsetMagnitude));
    const renderPosition = roundVec(add(leaf.position, positionOffset));
    const scaleVariation = 0.98 + seededUnit(leaf.seed, `${leaf.id}:depth-scale`) * 0.04;
    const scaleMultiplier = round6(input.config.scaleByLayer[layer] * scaleVariation);
    const variationBand = Math.min(
      TINT_VARIATION_BANDS - 1,
      Math.floor(seededUnit(leaf.seed, `${leaf.id}:depth-tint`) * TINT_VARIATION_BANDS),
    );
    const tintMultiplier = tintForLayer(
      input.config.tintByLayer[layer],
      variationBand,
      input.config.quantizationSteps,
    );

    if (layer === 'inner') innerLeafCount += 1;
    else if (layer === 'middle') middleLeafCount += 1;
    else outerLeafCount += 1;
    maximumPositionOffset = Math.max(maximumPositionOffset, offsetMagnitude);
    tintKeys.add(tintKey(tintMultiplier));
    profiles.push({
      id: `tree:canopy-depth:${leaf.id}`,
      leafInstanceId: leaf.id,
      clusterId: leaf.clusterId,
      branchId: leaf.branchId,
      sequence: leaf.sequence,
      layer,
      depth,
      crownCellId: cluster.crownCellId,
      sourcePosition: { ...leaf.position },
      positionOffset,
      renderPosition,
      scaleMultiplier,
      tintMultiplier,
    });
  }

  if (tintKeys.size > input.config.maximumUniqueTints) {
    throw new Error(
      `Tree Canopy Depth tint budget exceeded: ${tintKeys.size}/${input.config.maximumUniqueTints}.`,
    );
  }

  const scales = profiles.map((profile) => profile.scaleMultiplier);
  const stateWithoutSignature: Omit<TreeCanopyDepthState, 'signature'> = {
    treeCanopyDepthVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceCompositionVersion: input.composition.treeCompositionVersion,
    sourceCompositionRulesVersion: input.composition.rulesVersion,
    sourceFoliageVersion: input.foliage.treeFoliageVersion,
    sourceFoliageRulesVersion: input.foliage.rulesVersion,
    sourceLeafGeometryVersion: input.leaves.treeLeafGeometryVersion,
    sourceLeafGeometryRulesVersion: input.leaves.rulesVersion,
    sourceMaterialStateVersion: input.materials.treeMaterialStateVersion,
    sourceMaterialRulesVersion: input.materials.rulesVersion,
    artifactSeed: input.leaves.artifactSeed,
    lod: input.leaves.lod,
    descriptor: {
      id: 'tree:canopy-depth:volume',
      profileId: 'tree:canopy-depth:instance-profile',
      tintAttributeId: 'tree:canopy-depth:instance-tint',
      sourceGeometryId: 'tree:leaf:instances',
      materialRole: 'foliage',
    },
    profiles,
    diagnostics: {
      sourceLeafCount: input.leaves.instances.length,
      emittedProfileCount: profiles.length,
      innerLeafCount,
      middleLeafCount,
      outerLeafCount,
      occupiedCellCount: new Set(profiles.map((profile) => profile.crownCellId)).size,
      preservedOccupiedCellIds: true,
      filledPreviouslyEmptyCells: false,
      stableLeafOrderPreserved: profiles.every((profile, index) => (
        profile.sequence === index
        && profile.leafInstanceId === input.leaves.instances[index]?.id
      )),
      instanceCountPreserved: profiles.length === input.leaves.instances.length,
      minimumScaleMultiplier: round6(scales.length > 0 ? Math.min(...scales) : 1),
      maximumScaleMultiplier: round6(scales.length > 0 ? Math.max(...scales) : 1),
      maximumPositionOffset: round6(maximumPositionOffset),
      maximumPositionOffsetRatio: input.config.maximumOffsetRatio,
      uniqueTintCount: tintKeys.size,
      tintBudget: input.config.maximumUniqueTints,
      tintBudgetExceeded: false,
      quantizationSteps: input.config.quantizationSteps,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
      estimatedAdditionalMatrixUpdatesPerFrame: 0,
    },
  };

  return {
    ...stateWithoutSignature,
    signature: profileSignature(stateWithoutSignature),
  };
}
