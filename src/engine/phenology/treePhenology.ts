import { clamp01, round6, seededUnit } from '../growth/math';
import type { TreeRgb } from '../treeMaterial';
import type {
  BuildTreePhenologyInput,
  TreePhenologyPhase,
  TreePhenologyState,
} from './types';

function phaseFromAsOf(asOf: string): TreePhenologyPhase {
  const date = new Date(asOf);
  if (Number.isNaN(date.getTime())) throw new Error('Tree Phenology requires a valid asOf date.');
  const month = date.getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

function quantize(value: number, steps: number): number {
  return round6(Math.round(clamp01(value) * (steps - 1)) / (steps - 1));
}

function multiply(left: TreeRgb, right: TreeRgb, strength: number, steps: number): TreeRgb {
  return {
    r: quantize(left.r * (1 - strength + right.r * strength), steps),
    g: quantize(left.g * (1 - strength + right.g * strength), steps),
    b: quantize(left.b * (1 - strength + right.b * strength), steps),
  };
}

function key(value: TreeRgb): string {
  return `${value.r.toFixed(6)},${value.g.toFixed(6)},${value.b.toFixed(6)}`;
}

export function buildTreePhenology(input: BuildTreePhenologyInput): TreePhenologyState {
  const { species, leaves, canopyLight, materials, config } = input;
  if (!config.rulesVersion.trim()) throw new Error('Tree Phenology requires a rulesVersion.');
  if (species.artifactSeed !== leaves.artifactSeed
    || species.artifactSeed !== canopyLight.artifactSeed
    || species.artifactSeed !== materials.artifactSeed) {
    throw new Error('Tree Phenology received states from different artifacts.');
  }
  if (canopyLight.sourceLeafGeometryVersion !== leaves.treeLeafGeometryVersion
    || canopyLight.sourceLeafGeometryRulesVersion !== leaves.rulesVersion) {
    throw new Error('Tree Phenology leaf provenance does not match.');
  }
  if (canopyLight.sourceMaterialStateVersion !== materials.treeMaterialStateVersion
    || canopyLight.sourceMaterialRulesVersion !== materials.rulesVersion) {
    throw new Error('Tree Phenology material provenance does not match.');
  }
  if (canopyLight.profiles.length !== leaves.instances.length) {
    throw new Error('Tree Phenology requires one light profile per leaf.');
  }
  if (!Number.isInteger(config.quantizationSteps) || config.quantizationSteps < 2) {
    throw new Error('Tree Phenology quantizationSteps must be at least two.');
  }

  const phase = phaseFromAsOf(input.asOf);
  const targetShare = config.accentShareByPhase[phase];
  const phaseTint = config.tintByPhase[phase];
  const profiles = leaves.instances.map((leaf) => {
    const light = canopyLight.profiles[leaf.sequence];
    if (!light || light.leafInstanceId !== leaf.id) {
      throw new Error(`Tree Phenology cannot resolve light profile for "${leaf.id}".`);
    }
    const unit = seededUnit(species.artifactSeed, `${leaf.id}:phenology:${phase}`);
    const role = unit < targetShare ? 'accent' as const : 'base' as const;
    const accentStrength = role === 'accent'
      ? round6(0.18 + seededUnit(species.artifactSeed, `${leaf.id}:phenology-strength`) * 0.22)
      : 0;
    const phenologyTintMultiplier = role === 'accent' ? phaseTint : { r: 1, g: 1, b: 1 };
    return {
      id: `tree:phenology:${leaf.id}`,
      leafInstanceId: leaf.id,
      canopyLightProfileId: light.id,
      sequence: leaf.sequence,
      role,
      accentStrength,
      phenologyTintMultiplier,
      combinedTintMultiplier: multiply(
        light.combinedTintMultiplier,
        phenologyTintMultiplier,
        accentStrength,
        config.quantizationSteps,
      ),
    };
  });

  const accentLeafCount = profiles.filter((profile) => profile.role === 'accent').length;
  const unique = new Set(profiles.map((profile) => key(profile.combinedTintMultiplier)));
  if (unique.size > config.maximumUniqueCombinedTints) {
    throw new Error(`Tree Phenology tint budget exceeded: ${unique.size}/${config.maximumUniqueCombinedTints}.`);
  }
  const signature = [
    config.rulesVersion.trim(),
    canopyLight.signature,
    phase,
    profiles.length,
    accentLeafCount,
    unique.size,
  ].join('|');

  return {
    treePhenologyVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceLeafGeometryVersion: leaves.treeLeafGeometryVersion,
    sourceLeafGeometryRulesVersion: leaves.rulesVersion,
    sourceCanopyLightVersion: canopyLight.treeCanopyLightVersion,
    sourceCanopyLightRulesVersion: canopyLight.rulesVersion,
    sourceCanopyLightSignature: canopyLight.signature,
    sourceMaterialStateVersion: materials.treeMaterialStateVersion,
    sourceMaterialRulesVersion: materials.rulesVersion,
    artifactSeed: leaves.artifactSeed,
    lod: leaves.lod,
    asOf: input.asOf,
    phase,
    descriptor: {
      id: 'tree:phenology:seasonal-accent',
      profileId: 'tree:phenology:instance-profile',
      tintAttributeId: 'tree:phenology:instance-tint',
      sourceCanopyLightId: 'tree:canopy-light:response',
      materialRole: 'foliage',
    },
    signature,
    profiles,
    diagnostics: {
      sourceLeafCount: leaves.instances.length,
      emittedProfileCount: profiles.length,
      baseLeafCount: profiles.length - accentLeafCount,
      accentLeafCount,
      accentShare: round6(profiles.length > 0 ? accentLeafCount / profiles.length : 0),
      uniqueCombinedTintCount: unique.size,
      combinedTintBudget: config.maximumUniqueCombinedTints,
      combinedTintBudgetExceeded: false,
      stableLeafOrderPreserved: true,
      instanceCountPreserved: true,
      estimatedAdditionalDrawCalls: 0,
      estimatedAdditionalMaterials: 0,
      estimatedAdditionalMatrixUpdatesPerFrame: 0,
    },
  };
}
