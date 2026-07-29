import { clamp01, round6, seededUnit } from '../growth/math';
import type {
  BuildTreeMaterialInput,
  TreeMaterialRecipe,
  TreeMaterialRole,
  TreeMaterialState,
  TreeRgb,
} from './types';

function validateInput(input: BuildTreeMaterialInput): void {
  const { config, species, composition, foliage, leaves } = input;
  if (!config.rulesVersion.trim()) {
    throw new Error('Tree Material requires a non-empty rulesVersion.');
  }
  if (!Number.isInteger(config.quantizationSteps) || config.quantizationSteps < 2 || config.quantizationSteps > 256) {
    throw new Error('Tree Material quantizationSteps must be an integer between 2 and 256.');
  }
  if (config.maxMaterials !== 2) {
    throw new Error('Tree Material supports exactly two published materials.');
  }
  if (composition.sourceSpeciesRulesVersion !== species.rulesVersion) {
    throw new Error('Tree Material species and composition rules do not match.');
  }
  if (foliage.sourceSpeciesRulesVersion !== species.rulesVersion) {
    throw new Error('Tree Material species and foliage rules do not match.');
  }
  if (foliage.sourceCompositionVersion !== composition.treeCompositionVersion) {
    throw new Error('Tree Material composition and foliage versions do not match.');
  }
  if (leaves.sourceFoliageVersion !== foliage.treeFoliageVersion) {
    throw new Error('Tree Material foliage and leaf geometry versions do not match.');
  }
  if (leaves.sourceFoliageRulesVersion !== foliage.rulesVersion) {
    throw new Error('Tree Material foliage and leaf geometry rules do not match.');
  }
}

function hueChannel(p: number, q: number, rawT: number): number {
  let t = rawT;
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h: number, s: number, l: number): TreeRgb {
  const hue = ((h % 1) + 1) % 1;
  const saturation = clamp01(s);
  const lightness = clamp01(l);
  if (saturation <= 1e-9) {
    return { r: lightness, g: lightness, b: lightness };
  }
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  return {
    r: hueChannel(p, q, hue + 1 / 3),
    g: hueChannel(p, q, hue),
    b: hueChannel(p, q, hue - 1 / 3),
  };
}

function quantizeChannel(value: number, steps: number): { value: number; clamped: boolean } {
  const clamped = clamp01(value);
  return {
    value: round6(Math.round(clamped * (steps - 1)) / (steps - 1)),
    clamped: clamped !== value,
  };
}

function quantizeRgb(source: TreeRgb, steps: number): { color: TreeRgb; clamped: boolean } {
  const r = quantizeChannel(source.r, steps);
  const g = quantizeChannel(source.g, steps);
  const b = quantizeChannel(source.b, steps);
  return {
    color: { r: r.value, g: g.value, b: b.value },
    clamped: r.clamped || g.clamped || b.clamped,
  };
}

function colorKey(color: TreeRgb): string {
  return `${color.r.toFixed(6)},${color.g.toFixed(6)},${color.b.toFixed(6)}`;
}

function materialRecipe(
  role: TreeMaterialRole,
  color: TreeRgb,
  roughness: number,
  rulesVersion: string,
): TreeMaterialRecipe {
  const id = `tree:material:${role}`;
  const resolvedRoughness = round6(clamp01(roughness));
  const flatShading = role === 'bark';
  const side = role === 'foliage' ? 'double' : 'front';
  const signature = [
    rulesVersion,
    role,
    colorKey(color),
    resolvedRoughness.toFixed(6),
    flatShading ? 'flat' : 'smooth',
    side,
  ].join('|');

  return {
    treeMaterialVersion: 1,
    id,
    role,
    signature,
    color,
    roughness: resolvedRoughness,
    metalness: 0,
    emissiveColor: { r: 0, g: 0, b: 0 },
    emissiveIntensity: 0,
    opacity: 1,
    transparent: false,
    depthWrite: true,
    flatShading,
    side,
  };
}

/**
 * Pure tree-material projection. It derives two quantized surface recipes and
 * never edits accepted species, composition, foliage or geometry state.
 */
export function buildTreeMaterialState(input: BuildTreeMaterialInput): TreeMaterialState {
  validateInput(input);
  const { species, composition, foliage, leaves, config } = input;
  const barkHue = 0.065
    + (seededUnit(species.artifactSeed, 'tree-material:bark:hue') - 0.5) * 0.025;
  const barkSaturation = 0.31
    + species.pressures.memoryDensity * 0.09
    + species.pressures.rootStability * 0.04;
  const barkLightness = 0.25
    + species.state.trunkMaturity * 0.07
    + composition.score.balance * 0.025;

  const foliageHue = 0.285
    + (seededUnit(species.artifactSeed, 'tree-material:foliage:hue') - 0.5) * 0.045
    + species.pressures.asymmetry * 0.012;
  const foliageSaturation = 0.34
    + species.pressures.foliagePotential * 0.18
    + species.pressures.crownSpread * 0.05;
  const foliageLightness = 0.29
    + species.state.foliageMaturity * 0.105
    + composition.score.negativeSpace * 0.025;

  const bark = quantizeRgb(
    hslToRgb(barkHue, barkSaturation, barkLightness),
    config.quantizationSteps,
  );
  const foliageColor = quantizeRgb(
    hslToRgb(foliageHue, foliageSaturation, foliageLightness),
    config.quantizationSteps,
  );
  const barkMaterial = materialRecipe(
    'bark',
    bark.color,
    0.94 - species.pressures.rootStability * 0.11,
    config.rulesVersion.trim(),
  );
  const foliageMaterial = materialRecipe(
    'foliage',
    foliageColor.color,
    0.86 - species.pressures.foliagePotential * 0.13,
    config.rulesVersion.trim(),
  );
  const materials = [barkMaterial, foliageMaterial];
  const duplicateRoleIds = materials
    .filter((material, index) => materials.findIndex((candidate) => candidate.role === material.role) !== index)
    .map((material) => material.id)
    .sort();
  const clampedRoles: TreeMaterialRole[] = [];
  if (bark.clamped) clampedRoles.push('bark');
  if (foliageColor.clamped) clampedRoles.push('foliage');

  return {
    treeMaterialStateVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    sourceSpeciesBlueprintVersion: species.speciesBlueprintVersion,
    sourceCompositionVersion: composition.treeCompositionVersion,
    sourceFoliageVersion: foliage.treeFoliageVersion,
    sourceLeafGeometryVersion: leaves.treeLeafGeometryVersion,
    artifactSeed: species.artifactSeed,
    palette: {
      bark: bark.color,
      foliage: foliageColor.color,
    },
    materials,
    bindings: {
      branchMaterialId: barkMaterial.id,
      leafMaterialId: foliageMaterial.id,
    },
    diagnostics: {
      uniqueMaterialCount: new Set(materials.map((material) => material.signature)).size,
      materialBudget: 2,
      materialBudgetExceeded: false,
      quantizationSteps: config.quantizationSteps,
      clampedRoles,
      duplicateRoleIds,
    },
  };
}
