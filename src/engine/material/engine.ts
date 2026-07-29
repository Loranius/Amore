import { stableHash32 } from '../evolution';
import { CRYSTAL_MATERIAL_QUALITY_PRESETS } from './config';
import {
  clamp01,
  crystalChannelColor,
  mixRgb,
  rgb,
  rgbSignature,
  round6,
  scaleRgb,
  weightedChannelColor,
} from './color';
import type {
  BuildCrystalMaterialInput,
  CrystalBodyMaterial,
  CrystalMaterialPalette,
  CrystalMaterialState,
  CrystalRgb,
  CrystalShaderRecipe,
} from './types';

function validateInput(input: BuildCrystalMaterialInput): void {
  if (!input.config.rulesVersion.trim()) throw new Error('Crystal Material requires a non-empty rulesVersion.');
  if (input.species.artifactSeed !== input.composition.artifactSeed) {
    throw new Error('Crystal Material received composition from another artifact.');
  }
  if (input.species.artifactSeed !== input.geometry.artifactSeed) {
    throw new Error('Crystal Material received geometry from another artifact.');
  }
}

function seededUnit(seed: number, salt: string): number {
  return stableHash32(`${seed}\u001f${salt}`) / 0xffffffff;
}

function palette(input: BuildCrystalMaterialInput): CrystalMaterialPalette {
  const pressures = input.species.pressures;
  const state = input.species.state;
  const weighted = weightedChannelColor(pressures.channelShare);
  const dominant = crystalChannelColor(pressures.dominantChannel);
  const warmth = rgb(1, 0.58 + pressures.warmth * 0.16, 0.38 + pressures.warmth * 0.18);
  const cool = rgb(0.58, 0.76 + pressures.brilliance * 0.16, 1);
  const primary = mixRgb(weighted, dominant, 0.28 + pressures.dominance * 0.34);
  const secondary = mixRgb(primary, warmth, pressures.warmth * 0.36);
  const highlight = mixRgb(cool, rgb(1, 0.92, 0.97), 0.45 + state.purity * 0.35);
  const core = mixRgb(rgb(1, 0.45, 0.22), dominant, pressures.luminosity * 0.32);
  return { primary, secondary, highlight, core };
}

function materialSignature(body: Omit<CrystalBodyMaterial, 'signature'>): string {
  return [
    body.bodyId,
    rgbSignature(body.baseColor),
    rgbSignature(body.emissiveColor),
    body.roughness,
    body.metalness,
    body.clearcoat,
    body.clearcoatRoughness,
    body.ior,
    body.reflectivity,
    body.emissiveIntensity,
    body.envMapIntensity,
    body.iridescence,
    body.iridescenceIOR,
    body.iridescenceThicknessMin,
    body.iridescenceThicknessMax,
    body.transmission,
    body.opacity,
    body.transparent,
    body.depthWrite,
    body.shader.rimStrength,
    body.shader.skyStrength,
    rgbSignature(body.shader.skyColor),
    rgbSignature(body.shader.groundColor),
    rgbSignature(body.shader.rimColor),
    body.shader.inclusionDensity,
    body.shader.inclusionScale,
    body.shader.inclusionContrast,
  ].map((value) => typeof value === 'number' ? value.toFixed(6) : String(value)).join('|');
}

function bodyColor(
  base: CrystalMaterialPalette,
  role: string,
  emphasized: boolean,
  seed: number,
): CrystalRgb {
  const jitter = (seededUnit(seed, 'material:hue') - 0.5) * 0.12;
  const roleMix = role === 'focal' ? 0.08 : role === 'support' ? 0.18 : role === 'micro' ? 0.42 : 0.28;
  const target = emphasized ? rgb(1, 0.72, 0.28) : base.secondary;
  return scaleRgb(mixRgb(base.primary, target, clamp01(roleMix + jitter)), role === 'micro' ? 0.84 : 1);
}

function shaderRecipe(
  input: BuildCrystalMaterialInput,
  role: string,
  emphasized: boolean,
  emissiveColor: CrystalRgb,
): CrystalShaderRecipe {
  const preset = CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality];
  const pressures = input.species.pressures;
  const state = input.species.state;
  const reflectionEnabled = input.config.allowProceduralReflection && preset.reflectionScale > 0;
  const micro = role === 'micro';
  const inclusionBase = clamp01(
    state.fracture * 0.42
      + pressures.mutation * 0.26
      + pressures.surfaceComplexity * 0.22,
  );

  return {
    shaderVersion: 1,
    rimStrength: round6(reflectionEnabled ? preset.reflectionScale * (micro ? 0.08 : emphasized ? 0.5 : 0.34) : 0),
    skyStrength: round6(reflectionEnabled ? preset.reflectionScale * (micro ? 0.03 : 0.14) : 0),
    skyColor: mixRgb({ r: 0.82, g: 0.9, b: 1 }, input.species.pressures.dominantChannel === 'culture'
      ? { r: 0.78, g: 0.72, b: 1 }
      : { r: 0.9, g: 0.95, b: 1 }, 0.34),
    groundColor: mixRgb({ r: 1, g: 0.73, b: 0.62 }, input.species.pressures.warmth > 0.45
      ? { r: 1, g: 0.62, b: 0.42 }
      : { r: 0.98, g: 0.76, b: 0.84 }, 0.42),
    rimColor: mixRgb({ r: 1, g: 0.9, b: 0.96 }, emissiveColor, emphasized ? 0.46 : 0.2),
    inclusionDensity: round6(micro ? 0 : inclusionBase * preset.inclusionScale),
    inclusionScale: round6(3.4 + pressures.density * 4.6 + pressures.surfaceComplexity * 2.2),
    inclusionContrast: round6((0.18 + state.fracture * 0.34) * preset.inclusionScale),
  };
}

function buildBodyMaterial(
  input: BuildCrystalMaterialInput,
  materialPalette: CrystalMaterialPalette,
  bodyId: string,
): { material: CrystalBodyMaterial; clamped: boolean } | null {
  const mesh = input.geometry.meshes.find((candidate) => candidate.bodyId === bodyId);
  const compositionBody = input.composition.bodies.find((candidate) => candidate.sourceBodyId === bodyId);
  if (!mesh || !compositionBody) return null;

  const instructions = [input.species.mother, ...input.species.formations];
  const instruction = instructions.find((candidate) => candidate.id === bodyId);
  const emphasized = instruction?.emphasized ?? false;
  const preset = CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality];
  const pressures = input.species.pressures;
  const state = input.species.state;
  const role = compositionBody.role;
  const micro = role === 'micro';
  const focal = role === 'focal';
  const seed = instruction?.seed ?? stableHash32(bodyId);
  const baseColor = bodyColor(materialPalette, role, emphasized, seed);
  const emissiveColor = emphasized ? rgb(1, 0.66, 0.22) : materialPalette.core;

  const rawRoughness = (0.3 - pressures.refinement * 0.2 + state.fracture * 0.08)
    * (micro ? 1.55 : focal ? 0.62 : 0.92);
  const roughness = round6(Math.max(preset.roughnessFloor, Math.min(0.62, rawRoughness)));
  const clearcoat = round6(clamp01((0.58 + pressures.refinement * 0.38) * preset.clearcoatScale * (micro ? 0.46 : 1)));
  const iridescenceAllowed = input.config.allowIridescence && !micro && !emphasized;
  const iridescence = round6(iridescenceAllowed
    ? Math.min(preset.maxIridescence, 0.08 + pressures.refinement * 0.42 + pressures.brilliance * 0.12)
    : 0);
  const emissiveIntensity = round6(clamp01(
    (emphasized ? 0.32 : focal ? 0.1 : 0.025)
      + pressures.luminosity * (emphasized ? 0.34 : 0.2)
      + state.luminosity * 0.08,
  ));
  const shader = shaderRecipe(input, role, emphasized, emissiveColor);
  const bodyWithoutSignature: Omit<CrystalBodyMaterial, 'signature'> = {
    materialVersion: 1,
    bodyId,
    baseColor,
    emissiveColor,
    roughness,
    metalness: emphasized ? 0.08 : 0,
    clearcoat,
    clearcoatRoughness: round6(focal ? 0.025 : micro ? 0.18 : 0.06),
    ior: round6(1.5 + state.purity * 0.12),
    reflectivity: round6(clamp01(0.52 + state.purity * 0.34 + (focal ? 0.08 : 0))),
    emissiveIntensity,
    envMapIntensity: 0,
    iridescence,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: round6(220 + pressures.warmth * 70),
    iridescenceThicknessMax: round6(390 + pressures.brilliance * 180),
    transmission: 0,
    opacity: 1,
    transparent: false,
    depthWrite: true,
    shader,
  };
  const material: CrystalBodyMaterial = {
    ...bodyWithoutSignature,
    signature: materialSignature(bodyWithoutSignature),
  };
  const clamped = roughness !== round6(rawRoughness)
    || clearcoat === 0
    || clearcoat === 1
    || emissiveIntensity === 0
    || emissiveIntensity === 1;
  return { material, clamped };
}

/** Pure, renderer-independent crystal material derivation. */
export function buildCrystalMaterialState(input: BuildCrystalMaterialInput): CrystalMaterialState {
  validateInput(input);
  const materialPalette = palette(input);
  const missingCompositionBodyIds: string[] = [];
  const missingGeometryBodyIds: string[] = [];
  const clampedBodyIds: string[] = [];
  const geometryIds = new Set(input.geometry.meshes.map((mesh) => mesh.bodyId));
  const compositionIds = new Set(input.composition.bodies.map((body) => body.sourceBodyId));

  for (const body of input.composition.bodies) {
    if (!geometryIds.has(body.sourceBodyId)) missingGeometryBodyIds.push(body.sourceBodyId);
  }
  for (const mesh of input.geometry.meshes) {
    if (!compositionIds.has(mesh.bodyId)) missingCompositionBodyIds.push(mesh.bodyId);
  }

  const bodies = input.geometry.meshes.flatMap((mesh) => {
    const result = buildBodyMaterial(input, materialPalette, mesh.bodyId);
    if (!result) return [];
    if (result.clamped) clampedBodyIds.push(mesh.bodyId);
    return [result.material];
  });
  for (const values of [missingCompositionBodyIds, missingGeometryBodyIds, clampedBodyIds]) values.sort();

  return {
    materialStateVersion: 1,
    rulesVersion: input.config.rulesVersion.trim(),
    quality: input.config.quality,
    sourceSpeciesBlueprintVersion: input.species.speciesBlueprintVersion,
    sourceCompositionStateVersion: input.composition.compositionStateVersion,
    sourceGeometryStateVersion: input.geometry.geometryStateVersion,
    engineVersion: input.species.engineVersion,
    speciesRulesVersion: input.species.rulesVersion,
    artifactSeed: input.species.artifactSeed,
    palette: materialPalette,
    bodies,
    diagnostics: {
      missingCompositionBodyIds,
      missingGeometryBodyIds,
      clampedBodyIds,
      transmissionForcedOff: true,
      uniqueMaterialCount: new Set(bodies.map((body) => body.signature)).size,
    },
  };
}
