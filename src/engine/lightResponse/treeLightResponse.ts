import { clamp01, dot, normalize, round6 } from '../growth/math';
import type { TreeRgb } from '../treeMaterial';
import type {
  BuildTreeLightResponseInput,
  TreeLightResponseProfile,
  TreeLightResponseState,
} from './types';

function validateInput(input: BuildTreeLightResponseInput): void {
  const { canopy, leaves, materials, config } = input;
  if (!config.rulesVersion.trim()) throw new Error('Tree Light Response requires a rulesVersion.');
  if (canopy.artifactSeed !== leaves.artifactSeed || canopy.artifactSeed !== materials.artifactSeed) {
    throw new Error('Tree Light Response received states from different artifacts.');
  }
  if (canopy.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopy.sourceLeafGeometryRulesVersion !== leaves.rulesVersion) {
    throw new Error('Tree Light Response leaf provenance does not match.');
  }
  if (canopy.sourceMaterialStateVersion !== materials.treeMaterialStateVersion
    || canopy.sourceMaterialRulesVersion !== materials.rulesVersion) {
    throw new Error('Tree Light Response material provenance does not match.');
  }
  if (canopy.profiles.length !== leaves.instances.length) {
    throw new Error('Tree Light Response requires one canopy profile per leaf.');
  }
  if (!Number.isInteger(config.quantizationSteps) || config.quantizationSteps < 2 || config.quantizationSteps > 256) {
    throw new Error('Tree Light Response quantizationSteps must be between 2 and 256.');
  }
  if (!Number.isInteger(config.maximumUniqueTints) || config.maximumUniqueTints < 2) {
    throw new Error('Tree Light Response maximumUniqueTints must be at least two.');
  }
  for (const value of [config.ambientFloor, config.directStrength, config.backlightLift]) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new Error('Tree Light Response strengths must be in [0, 1].');
    }
  }
}

function quantize(value: number, steps: number): number {
  return round6(Math.round(clamp01(value) * (steps - 1)) / (steps - 1));
}

function tintForExposure(exposure: number, steps: number): TreeRgb {
  const warmLift = Math.max(0, exposure - 0.72) * 0.045;
  return {
    r: quantize(exposure + warmLift, steps),
    g: quantize(exposure, steps),
    b: quantize(exposure - warmLift * 0.55, steps),
  };
}

function key(tint: TreeRgb): string {
  return `${tint.r.toFixed(6)},${tint.g.toFixed(6)},${tint.b.toFixed(6)}`;
}

export function buildTreeLightResponse(input: BuildTreeLightResponseInput): TreeLightResponseState {
  validateInput(input);
  const lightDirection = normalize(input.config.lightDirection);
  const profiles: TreeLightResponseProfile[] = [];
  const tintKeys = new Set<string>();
  let minimumExposure = 1;
  let maximumExposure = 0;

  for (const leaf of input.leaves.instances) {
    const canopy = input.canopy.profiles[leaf.sequence];
    if (!canopy || canopy.leafInstanceId !== leaf.id) {
      throw new Error(`Tree Light Response cannot resolve canopy profile for "${leaf.id}".`);
    }
    const facing = clamp01((dot(normalize(leaf.normal), lightDirection) + 1) * 0.5);
    const backlight = clamp01(dot(normalize(leaf.direction), lightDirection) * -1);
    const rawExposure = input.config.ambientFloor
      + facing * input.config.directStrength
      + backlight * input.config.backlightLift;
    const exposure = quantize(rawExposure, input.config.quantizationSteps);
    const tintMultiplier = tintForExposure(exposure, input.config.quantizationSteps);
    const responseBand = Math.round(exposure * (input.config.quantizationSteps - 1));

    minimumExposure = Math.min(minimumExposure, exposure);
    maximumExposure = Math.max(maximumExposure, exposure);
    tintKeys.add(key(tintMultiplier));
    profiles.push({
      id: `tree:light-response:${leaf.id}`,
      leafInstanceId: leaf.id,
      sequence: leaf.sequence,
      exposure,
      responseBand,
      tintMultiplier,
    });
  }

  if (tintKeys.size > input.config.maximumUniqueTints) {
    throw new Error(`Tree Light Response tint budget exceeded: ${tintKeys.size}/${input.config.maximumUniqueTints}.`);
  }

  const signature = [
    input.config.rulesVersion.trim(),
    input.canopy.signature,
    input.leaves.lod,
    profiles.length,
    tintKeys.size,
    minimumExposure.toFixed(6),
    maximumExposure.toFixed(6),
    lightDirection.x.toFixed(6),
    lightDirection.y.toFixed(6),
    lightDirection.z.toFixed(6),
  ].join('|');

  return {
    treeLightResponseVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    sourceCanopyDepthVersion: input.canopy.treeCanopyDepthVersion,
    sourceCanopyDepthRulesVersion: input.canopy.rulesVersion,
    sourceLeafGeometryVersion: input.leaves.treeLeafGeometryVersion,
    sourceLeafGeometryRulesVersion: input.leaves.rulesVersion,
    sourceMaterialStateVersion: input.materials.treeMaterialStateVersion,
    sourceMaterialRulesVersion: input.materials.rulesVersion,
    artifactSeed: input.leaves.artifactSeed,
    lod: input.leaves.lod,
    descriptor: {
      id: 'tree:light-response:canopy',
      profileId: 'tree:light-response:instance-profile',
      tintAttributeId: 'tree:light-response:instance-tint',
      sourceGeometryId: 'tree:leaf:instances',
      materialRole: 'foliage',
    },
    lightDirection,
    signature,
    profiles,
    diagnostics: {
      sourceLeafCount: input.leaves.instances.length,
      emittedProfileCount: profiles.length,
      minimumExposure: round6(profiles.length > 0 ? minimumExposure : 0),
      maximumExposure: round6(profiles.length > 0 ? maximumExposure : 0),
      uniqueTintCount: tintKeys.size,
      tintBudget: input.config.maximumUniqueTints,
      tintBudgetExceeded: false,
      quantizationSteps: input.config.quantizationSteps,
      stableLeafOrderPreserved: true,
      instanceCountPreserved: true,
      lightDirectionNormalized: true,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
      estimatedAdditionalMatrixUpdatesPerFrame: 0,
    },
  };
}
