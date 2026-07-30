import {
  add,
  clamp01,
  cross,
  dot,
  length,
  normalize,
  round6,
  roundVec,
  scale,
  seededUnit,
  subtract,
} from '../growth/math';
import type { GrowthVec3 } from '../growth';
import type { TreeRgb } from '../treeMaterial';
import type {
  BuildTreeCanopyLightInput,
  TreeCanopyLightBand,
  TreeCanopyLightProfile,
  TreeCanopyLightState,
} from './types';

const LIGHT_BANDS: readonly TreeCanopyLightBand[] = ['shade', 'transition', 'sunlit'];

function validateInput(input: BuildTreeCanopyLightInput): void {
  const { composition, leaves, canopy, materials, config } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Canopy Light requires a non-empty rulesVersion.');
  }
  if (![config.lightDirection.x, config.lightDirection.y, config.lightDirection.z].every(Number.isFinite)
    || length(config.lightDirection) <= 1e-9) {
    throw new Error('Tree Canopy Light requires a finite non-zero light direction.');
  }
  if (!Number.isFinite(config.ambientFloor) || config.ambientFloor < 0 || config.ambientFloor >= 1) {
    throw new Error('Tree Canopy Light ambientFloor must be in [0, 1).');
  }
  const influenceTotal = config.sideInfluence
    + config.facingInfluence
    + config.heightInfluence
    + config.layerInfluence;
  if ([
    config.sideInfluence,
    config.facingInfluence,
    config.heightInfluence,
    config.layerInfluence,
  ].some((value) => !Number.isFinite(value) || value < 0)
    || Math.abs(influenceTotal - 1) > 1e-6) {
    throw new Error('Tree Canopy Light influence weights must be non-negative and sum to one.');
  }
  if (!Number.isFinite(config.shadeMaximum)
    || !Number.isFinite(config.sunlitMinimum)
    || config.shadeMaximum <= 0
    || config.shadeMaximum >= config.sunlitMinimum
    || config.sunlitMinimum > 1) {
    throw new Error('Tree Canopy Light exposure thresholds are invalid.');
  }
  if (!Number.isInteger(config.exposureBands) || config.exposureBands < 3 || config.exposureBands > 64) {
    throw new Error('Tree Canopy Light exposureBands must be an integer between 3 and 64.');
  }
  if (!Number.isInteger(config.quantizationSteps)
    || config.quantizationSteps < 2
    || config.quantizationSteps > 256) {
    throw new Error('Tree Canopy Light quantizationSteps must be an integer between 2 and 256.');
  }
  if (!Number.isInteger(config.maximumUniqueCombinedTints)
    || config.maximumUniqueCombinedTints < LIGHT_BANDS.length) {
    throw new Error('Tree Canopy Light maximumUniqueCombinedTints is invalid.');
  }
  for (const layer of ['inner', 'middle', 'outer'] as const) {
    const exposure = config.layerExposureByLayer[layer];
    const penalty = config.shadowPenaltyByLayer[layer];
    if (!Number.isFinite(exposure) || exposure < 0 || exposure > 1) {
      throw new Error(`Tree Canopy Light layerExposureByLayer.${layer} must be in [0, 1].`);
    }
    if (!Number.isFinite(penalty) || penalty < 0 || penalty > 0.25) {
      throw new Error(`Tree Canopy Light shadowPenaltyByLayer.${layer} must be in [0, 0.25].`);
    }
  }
  for (const band of LIGHT_BANDS) {
    const tint = config.tintByBand[band];
    for (const channel of [tint.r, tint.g, tint.b]) {
      if (!Number.isFinite(channel) || channel < 0 || channel > 1) {
        throw new Error(`Tree Canopy Light tintByBand.${band} must stay in [0, 1].`);
      }
    }
  }
  if (composition.artifactSeed !== leaves.artifactSeed
    || composition.artifactSeed !== canopy.artifactSeed
    || composition.artifactSeed !== materials.artifactSeed) {
    throw new Error('Tree Canopy Light received states from different artifacts.');
  }
  if (canopy.sourceCompositionVersion !== composition.treeCompositionVersion
    || canopy.sourceCompositionRulesVersion !== composition.rulesVersion) {
    throw new Error('Tree Canopy Light composition and Canopy Depth provenance does not match.');
  }
  if (canopy.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopy.sourceLeafGeometryRulesVersion !== leaves.rulesVersion
    || canopy.lod !== leaves.lod) {
    throw new Error('Tree Canopy Light leaf geometry and Canopy Depth provenance does not match.');
  }
  if (canopy.sourceMaterialStateVersion !== materials.treeMaterialStateVersion
    || canopy.sourceMaterialRulesVersion !== materials.rulesVersion) {
    throw new Error('Tree Canopy Light material and Canopy Depth provenance does not match.');
  }
  if (canopy.profiles.length !== leaves.instances.length) {
    throw new Error('Tree Canopy Light requires one Canopy Depth profile per accepted leaf.');
  }
  for (let index = 0; index < leaves.instances.length; index += 1) {
    const leaf = leaves.instances[index];
    const profile = canopy.profiles[index];
    if (!leaf || !profile || profile.sequence !== index || profile.leafInstanceId !== leaf.id) {
      throw new Error('Tree Canopy Light Canopy Depth order does not match accepted leaves.');
    }
  }
  const foliageMaterial = materials.materials.find(
    (material) => material.id === materials.bindings.leafMaterialId && material.role === 'foliage',
  );
  if (!foliageMaterial) {
    throw new Error('Tree Canopy Light requires the accepted foliage material binding.');
  }
  if (!Number.isFinite(composition.bounds.height) || composition.bounds.height <= 0) {
    throw new Error('Tree Canopy Light requires positive accepted composition height.');
  }
}

function quantizeUnit(value: number, steps: number): number {
  return round6(Math.round(clamp01(value) * (steps - 1)) / (steps - 1));
}

function quantizeRgb(value: TreeRgb, steps: number): TreeRgb {
  return {
    r: quantizeUnit(value.r, steps),
    g: quantizeUnit(value.g, steps),
    b: quantizeUnit(value.b, steps),
  };
}

function multiplyRgb(left: TreeRgb, right: TreeRgb): TreeRgb {
  return {
    r: left.r * right.r,
    g: left.g * right.g,
    b: left.b * right.b,
  };
}

function tintKey(value: TreeRgb): string {
  return `${value.r.toFixed(6)},${value.g.toFixed(6)},${value.b.toFixed(6)}`;
}

function rotateAroundAxis(vector: GrowthVec3, rawAxis: GrowthVec3, angle: number): GrowthVec3 {
  const axis = normalize(rawAxis);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return normalize(add(
    add(
      scale(vector, cosine),
      scale(cross(axis, vector), sine),
    ),
    scale(axis, dot(axis, vector) * (1 - cosine)),
  ), vector);
}

function bandForExposure(
  exposure: number,
  input: BuildTreeCanopyLightInput,
): TreeCanopyLightBand {
  if (exposure <= input.config.shadeMaximum) return 'shade';
  if (exposure >= input.config.sunlitMinimum) return 'sunlit';
  return 'transition';
}

function stateSignature(state: Omit<TreeCanopyLightState, 'signature'>): string {
  return [
    state.rulesVersion,
    state.artifactSeed,
    state.lod,
    state.lightDirection.x.toFixed(6),
    state.lightDirection.y.toFixed(6),
    state.lightDirection.z.toFixed(6),
    state.profiles.length,
    state.diagnostics.shadeLeafCount,
    state.diagnostics.transitionLeafCount,
    state.diagnostics.sunlitLeafCount,
    state.diagnostics.minimumExposure.toFixed(6),
    state.diagnostics.maximumExposure.toFixed(6),
    state.diagnostics.uniqueCombinedTintCount,
  ].join('|');
}

/**
 * Projects accepted Canopy Depth profiles into stable sun-facing, transition and
 * shaded tint multipliers. Geometry, instance count and Tree Life remain untouched.
 */
export function buildTreeCanopyLight(
  input: BuildTreeCanopyLightInput,
): TreeCanopyLightState {
  validateInput(input);
  const lightDirection = roundVec(normalize(input.config.lightDirection));
  const profiles: TreeCanopyLightProfile[] = [];
  const combinedTintKeys = new Set<string>();
  const exposures: number[] = [];
  let shadeLeafCount = 0;
  let transitionLeafCount = 0;
  let sunlitLeafCount = 0;

  for (let index = 0; index < input.leaves.instances.length; index += 1) {
    const leaf = input.leaves.instances[index]!;
    const canopyProfile = input.canopy.profiles[index]!;
    const surfaceNormal = roundVec(rotateAroundAxis(
      leaf.normal,
      leaf.direction,
      leaf.rollRad,
    ));
    const outward = normalize(
      subtract(canopyProfile.renderPosition, input.composition.bounds.center),
      surfaceNormal,
    );
    const crownSideExposure = round6(clamp01((dot(outward, lightDirection) + 1) * 0.5));
    const surfaceFacingExposure = round6(clamp01(Math.abs(dot(surfaceNormal, lightDirection))));
    const normalizedHeight = round6(clamp01(
      (canopyProfile.renderPosition.y - input.composition.bounds.min.y)
        / input.composition.bounds.height,
    ));
    const layerExposure = input.config.layerExposureByLayer[canopyProfile.layer];
    const weightedExposure = crownSideExposure * input.config.sideInfluence
      + surfaceFacingExposure * input.config.facingInfluence
      + normalizedHeight * input.config.heightInfluence
      + layerExposure * input.config.layerInfluence;
    const variationStep = Math.min(
      input.config.exposureBands - 1,
      Math.floor(
        seededUnit(leaf.seed, `${leaf.id}:canopy-light`) * input.config.exposureBands,
      ),
    );
    const variation = (
      variationStep / Math.max(1, input.config.exposureBands - 1) - 0.5
    ) * 0.04;
    const rawExposure = input.config.ambientFloor
      + (1 - input.config.ambientFloor) * weightedExposure
      - input.config.shadowPenaltyByLayer[canopyProfile.layer]
      + variation;
    const exposure = quantizeUnit(rawExposure, input.config.exposureBands);
    const band = bandForExposure(exposure, input);
    const lightTintMultiplier = quantizeRgb(
      input.config.tintByBand[band],
      input.config.quantizationSteps,
    );
    const combinedTintMultiplier = quantizeRgb(
      multiplyRgb(canopyProfile.tintMultiplier, lightTintMultiplier),
      input.config.quantizationSteps,
    );

    if (band === 'shade') shadeLeafCount += 1;
    else if (band === 'transition') transitionLeafCount += 1;
    else sunlitLeafCount += 1;
    exposures.push(exposure);
    combinedTintKeys.add(tintKey(combinedTintMultiplier));
    profiles.push({
      id: `tree:canopy-light:${leaf.id}`,
      leafInstanceId: leaf.id,
      canopyProfileId: canopyProfile.id,
      sequence: leaf.sequence,
      canopyLayer: canopyProfile.layer,
      crownCellId: canopyProfile.crownCellId,
      surfaceNormal,
      crownSideExposure,
      surfaceFacingExposure,
      normalizedHeight,
      layerExposure: round6(layerExposure),
      exposure,
      band,
      lightTintMultiplier,
      combinedTintMultiplier,
    });
  }

  if (combinedTintKeys.size > input.config.maximumUniqueCombinedTints) {
    throw new Error(
      `Tree Canopy Light combined tint budget exceeded: ${combinedTintKeys.size}/${input.config.maximumUniqueCombinedTints}.`,
    );
  }

  const minimumExposure = exposures.length > 0 ? Math.min(...exposures) : 0;
  const maximumExposure = exposures.length > 0 ? Math.max(...exposures) : 0;
  const averageExposure = exposures.length > 0
    ? exposures.reduce((sum, value) => sum + value, 0) / exposures.length
    : 0;
  const stateWithoutSignature: Omit<TreeCanopyLightState, 'signature'> = {
    treeCanopyLightVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceCompositionVersion: input.composition.treeCompositionVersion,
    sourceCompositionRulesVersion: input.composition.rulesVersion,
    sourceLeafGeometryVersion: input.leaves.treeLeafGeometryVersion,
    sourceLeafGeometryRulesVersion: input.leaves.rulesVersion,
    sourceCanopyDepthVersion: input.canopy.treeCanopyDepthVersion,
    sourceCanopyDepthRulesVersion: input.canopy.rulesVersion,
    sourceCanopyDepthSignature: input.canopy.signature,
    sourceMaterialStateVersion: input.materials.treeMaterialStateVersion,
    sourceMaterialRulesVersion: input.materials.rulesVersion,
    artifactSeed: input.leaves.artifactSeed,
    lod: input.leaves.lod,
    lightDirection,
    descriptor: {
      id: 'tree:canopy-light:response',
      profileId: 'tree:canopy-light:instance-profile',
      tintAttributeId: 'tree:canopy-light:instance-tint',
      sourceCanopyId: 'tree:canopy-depth:volume',
      materialRole: 'foliage',
    },
    profiles,
    diagnostics: {
      sourceLeafCount: input.leaves.instances.length,
      emittedProfileCount: profiles.length,
      shadeLeafCount,
      transitionLeafCount,
      sunlitLeafCount,
      minimumExposure: round6(minimumExposure),
      maximumExposure: round6(maximumExposure),
      averageExposure: round6(averageExposure),
      exposureBands: input.config.exposureBands,
      uniqueCombinedTintCount: combinedTintKeys.size,
      combinedTintBudget: input.config.maximumUniqueCombinedTints,
      combinedTintBudgetExceeded: false,
      quantizationSteps: input.config.quantizationSteps,
      lightDirectionNormalized: Math.abs(length(lightDirection) - 1) <= 1e-5,
      canopyProfileOrderPreserved: profiles.every((profile, index) => (
        profile.sequence === index
        && profile.leafInstanceId === input.leaves.instances[index]?.id
        && profile.canopyProfileId === input.canopy.profiles[index]?.id
      )),
      instanceCountPreserved: profiles.length === input.leaves.instances.length,
      crownCellProvenancePreserved: profiles.every((profile, index) => (
        profile.crownCellId === input.canopy.profiles[index]?.crownCellId
      )),
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
      estimatedAdditionalMatrixUpdatesPerFrame: 0,
    },
  };

  return {
    ...stateWithoutSignature,
    signature: stateSignature(stateWithoutSignature),
  };
}
