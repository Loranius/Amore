import { CRYSTAL_SUBSTRATE_BODY_ID } from '../geometry/substrate';
import { CRYSTAL_MATERIAL_QUALITY_PRESETS } from './config';
import {
  CRYSTAL_FACET_TINTING,
  SUBSTRATE_FACET_TINTING,
  facetTintingSignature,
} from './facets';
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

/**
 * Signature describes optical identity only. bodyId is intentionally excluded,
 * so bodies with the same composition role can share one BatchedMesh material.
 */
function materialSignature(body: Omit<CrystalBodyMaterial, 'signature'>): string {
  return [
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
    body.shader.coreStrength,
    rgbSignature(body.shader.coreColor),
    facetTintingSignature(body.facets),
  ].map((value) => typeof value === 'number' ? value.toFixed(6) : String(value)).join('|');
}

/**
 * The optical band an outer crystal shell lives in.
 *
 * Every value below used to be derived from the couple's pressures across a
 * wide range, and the wide range was the problem: at 0.3 roughness with 0.42
 * clearcoat a facet reads as matte plastic, and at 0.32 emissive the body glows
 * evenly from within, which flattens every plane at once — the shell lit its
 * own facets to the same brightness and erased the relief the geometry had just
 * been given.
 *
 * So the pressures still choose *where in the band* a crystal sits, and the
 * band decides that it is a crystal at all. Quality tiers move a body inside
 * the band too; they can no longer push it out of one.
 */
const SHELL_ROUGHNESS = { min: 0.1, max: 0.16 } as const;
const SHELL_CLEARCOAT = { min: 0.75, max: 0.95 } as const;
const SHELL_CLEARCOAT_ROUGHNESS = { min: 0.03, max: 0.07 } as const;
const SHELL_IOR = { min: 1.52, max: 1.58 } as const;
/**
 * Glow belongs to the inner core, not to the shell. What is left here is the
 * faint self-light of a mineral catching ambient, not a lamp inside it.
 */
const SHELL_EMISSIVE = { min: 0.02, max: 0.06 } as const;

function intoBand(band: { readonly min: number; readonly max: number }, value: number): number {
  return round6(Math.max(band.min, Math.min(band.max, value)));
}

/** Position within a band, 0 at min and 1 at max. */
function acrossBand(band: { readonly min: number; readonly max: number }, t: number): number {
  return band.min + (band.max - band.min) * clamp01(t);
}

function bodyColor(
  base: CrystalMaterialPalette,
  role: string,
  emphasized: boolean,
): CrystalRgb {
  const roleMix = role === 'focal'
    ? 0.06
    : role === 'support'
      ? 0.18
      : role === 'family'
        ? 0.25
        : role === 'companion'
          ? 0.32
          : 0.44;
  const target = emphasized ? rgb(1, 0.72, 0.28) : base.secondary;
  return scaleRgb(mixRgb(base.primary, target, roleMix), role === 'micro' ? 0.84 : 1);
}

/**
 * How much further the core pushes toward the pure hue than the shell was
 * allowed to.
 *
 * `wishTint` deliberately stops short of a pure colour, with the note that a
 * crystal is translucent stone and not stained glass — sound reasoning for a
 * surface. A core is seen *through* that stone, so the same restraint reads as
 * no colour at all; it can and should go further.
 */
const CORE_TINT_GAIN = 1.45;

/** The colour a body's inner light takes from the gifts that earned it. */
function coreTintColor(
  base: CrystalRgb,
  tint: readonly [number, number, number] | null,
): CrystalRgb {
  if (tint === null) return base;
  const deepen = (channel: number): number => clamp01(1 - (1 - channel) * CORE_TINT_GAIN);
  return mixRgb(base, rgb(deepen(tint[0]), deepen(tint[1]), deepen(tint[2])), 0.82);
}

function shaderRecipe(
  input: BuildCrystalMaterialInput,
  role: string,
  emphasized: boolean,
  emissiveColor: CrystalRgb,
  tint: readonly [number, number, number] | null,
): CrystalShaderRecipe {
  const preset = CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality];
  const pressures = input.species.pressures;
  const state = input.species.state;
  const reflectionEnabled = input.config.allowProceduralReflection && preset.reflectionScale > 0;
  const micro = role === 'micro';
  const focal = role === 'focal';
  // Showing up regularly clears the stone (ADR-0004). A couple who adds
  // something most months gets a crystal with fewer flaws in it than one who
  // dumped an album in a single weekend and went quiet — a different question
  // from how much they logged, and the more interesting one.
  //
  // It only ever reduces flaws. Letting a quiet stretch *add* them would make
  // the artifact punish silence, which is the one thing it must never do.
  const clarity = clamp01(state.consistency);
  const inclusionBase = clamp01(
    (state.fracture * 0.42
      + pressures.mutation * 0.26
      + pressures.surfaceComplexity * 0.22)
    * (1 - clarity * 0.55),
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
    // A crystal is lit from within, but not evenly: the requested "inner
    // crystal at 70% size" cannot be a second mesh here, because the shell is
    // opaque by contract (the canvas is alpha-composited over a CSS sky, so a
    // transmissive shell would show black where it overlaps the sky rather
    // than the sky itself). Depth-weighted core light is the same effect
    // without transparency — and it costs no draw call and no triangle.
    coreStrength: round6(micro
      ? 0
      : (0.1 + pressures.luminosity * 0.16 + state.luminosity * 0.08)
        * (emphasized ? 1.35 : focal ? 1 : 0.72)
        // A year that earned a colour shows it a little harder, or the colour
        // it earned is the one thing about it nobody can see.
        * (tint === null || (tint[0] === 1 && tint[1] === 1 && tint[2] === 1) ? 1 : 1.3)),
    coreColor: coreTintColor(emissiveColor, tint),
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
  // ADR-0004 gives an annual crystal a colour earned by the gifts the couple
  // exchanged that year. It used to multiply the shell, which made the whole
  // body that colour — the "solid rainbow shell" the reference pass rejected.
  //
  // The colour belongs to the core. Outside, every crystal keeps the colony's
  // one mineral nature, so the druse reads as a druse rather than as a bag of
  // differently coloured objects; inside, each year carries its own light. See
  // coreTintColor and the shader's core term.
  const tint = instruction?.tintRgb ?? null;
  const baseColor = bodyColor(materialPalette, role, emphasized);
  const emissiveColor = emphasized ? rgb(1, 0.66, 0.22) : materialPalette.core;

  // Refined couples polish toward the smooth end of the band; fracture and the
  // smallest bodies push back toward the rough end.
  const roughnessT = 1 - clamp01(
    pressures.refinement * 0.86 - state.fracture * 0.3 - (micro ? 0.3 : focal ? -0.12 : 0),
  );
  const roughness = intoBand(
    SHELL_ROUGHNESS,
    Math.max(preset.roughnessFloor, acrossBand(SHELL_ROUGHNESS, roughnessT)),
  );
  const clearcoat = intoBand(
    SHELL_CLEARCOAT,
    acrossBand(SHELL_CLEARCOAT, pressures.refinement) * preset.clearcoatScale,
  );
  const iridescenceAllowed = input.config.allowIridescence && !micro;
  // A year in which both partners gave as much as they received comes out
  // nearly white — the balance shows as rainbow on the facets instead, which
  // is why an evenly-shared year is the most beautiful rather than the
  // greyest (ADR-0004).
  const earnedIridescence = instruction?.iridescence ?? 0;
  const iridescence = round6(iridescenceAllowed
    ? Math.min(
        preset.maxIridescence,
        0.08 + pressures.refinement * 0.42 + pressures.brilliance * 0.12 + earnedIridescence * 0.5,
      )
    : 0);
  const emissiveIntensity = intoBand(SHELL_EMISSIVE, acrossBand(
    SHELL_EMISSIVE,
    (emphasized ? 0.55 : focal ? 0.28 : 0.1)
      + pressures.luminosity * 0.3
      + state.luminosity * 0.15,
  ));
  const shader = shaderRecipe(input, role, emphasized, emissiveColor, tint);
  const bodyWithoutSignature: Omit<CrystalBodyMaterial, 'signature'> = {
    materialVersion: 1,
    bodyId,
    baseColor,
    emissiveColor,
    roughness,
    // Never metallic. A trace of metalness darkened the diffuse term and made
    // the emphasized body read as painted rather than as mineral.
    metalness: 0,
    clearcoat,
    clearcoatRoughness: intoBand(
      SHELL_CLEARCOAT_ROUGHNESS,
      acrossBand(SHELL_CLEARCOAT_ROUGHNESS, micro ? 0.8 : focal ? 0.1 : 0.45),
    ),
    ior: intoBand(SHELL_IOR, acrossBand(SHELL_IOR, state.purity)),
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
    facets: CRYSTAL_FACET_TINTING,
  };
  const material: CrystalBodyMaterial = {
    ...bodyWithoutSignature,
    signature: materialSignature(bodyWithoutSignature),
  };
  // "Clamped" now means the band caught this body, which is a diagnostic about
  // the pressures rather than about the renderer.
  const clamped = roughness === SHELL_ROUGHNESS.min
    || roughness === SHELL_ROUGHNESS.max
    || clearcoat === SHELL_CLEARCOAT.min
    || clearcoat === SHELL_CLEARCOAT.max;
  return { material, clamped };
}

/**
 * The substrate is quartz — the vein the druse grew out of, not the ground it
 * stands on.
 *
 * It has been three things. Dark earth, then a grey cut plate; visual review
 * (2026-08-03) rejected both, and the mesh is now a mineral seam opened through
 * the portal's own stone (`geometry/substrate.ts`). So the material stops
 * pretending to be rock: the portal's dais already publishes the stone, and this
 * has to read as the *other* material in that pair or the seam disappears.
 *
 * Milky white with a lavender cast, a little lighter and a good deal less rough
 * than the slab it cuts through — enough separation to read as quartz, nowhere
 * near enough to compete with the crystals standing in it. Emphatically not a
 * gem: no transmission, no iridescence, no bloom.
 */
function buildSubstrateMaterial(
  input: BuildCrystalMaterialInput,
  materialPalette: CrystalMaterialPalette,
): CrystalBodyMaterial {
  // Tinted toward the couple's own palette so the vein never looks imported
  // from a different artifact — but only just, because milky quartz that takes
  // a strong hue stops being quartz.
  const tint = materialPalette.secondary;
  const grey = (tint.r + tint.g + tint.b) / 3;
  // Linear values, and the whole design of this material is in them. The dais
  // slab sits near 0.10–0.14 linear; this is a little over twice that — enough
  // that the seam reads as a second mineral, little enough that it stays part
  // of the floor. Measured against both failures: at three times the stone the
  // vein rendered as a white splash brighter than everything but the monarch,
  // and at under twice it stopped being distinguishable from a shadow.
  const baseColor = rgb(
    round6(0.245 + grey * 0.045 + tint.r * 0.02),
    round6(0.238 + grey * 0.045 + tint.g * 0.018),
    round6(0.283 + grey * 0.045 + tint.b * 0.026),
  );
  const bodyWithoutSignature: Omit<CrystalBodyMaterial, 'signature'> = {
    materialVersion: 1,
    bodyId: CRYSTAL_SUBSTRATE_BODY_ID,
    baseColor,
    emissiveColor: baseColor,
    // Less rough than the slab (0.82) by a clear margin, and a thin clearcoat
    // so the facets catch a highlight. Both are what separate polished mineral
    // from cut stone at a glance.
    roughness: 0.44,
    metalness: 0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.4,
    // Quartz.
    ior: 1.54,
    reflectivity: 0.32,
    // No uniform emissive. A flat lift over the whole seam is exactly the
    // "glowing inlay" look review threw out; what light the vein carries comes
    // from the view-weighted core term below.
    emissiveIntensity: 0,
    // Low, not zero: the seam picking up the star field is most of what makes
    // its facets visible at all, since it is only barely proud of the stone.
    envMapIntensity: 0.3,
    iridescence: 0,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: 220,
    iridescenceThicknessMax: 390,
    transmission: 0,
    opacity: 1,
    transparent: false,
    depthWrite: true,
    shader: {
      shaderVersion: 1,
      rimStrength: 0,
      skyStrength: 0,
      skyColor: baseColor,
      groundColor: baseColor,
      rimColor: baseColor,
      // Milkiness, not grain. The old value at a coarse scale read as soil,
      // which is precisely what the vein replaced; this is a fraction of it at
      // a much finer scale, so it clouds the quartz instead of speckling it.
      inclusionDensity: round6(
        (0.09 + input.species.state.fracture * 0.06)
        * CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality].inclusionScale,
      ),
      inclusionScale: 6.4,
      inclusionContrast: round6(
        0.14 * CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality].inclusionScale,
      ),
      // The faintest light from inside the seam. Weighted by how squarely a
      // face meets the eye, so the vein's flat top lifts while its wall stays
      // dark at the silhouette — the opposite of a uniform emissive, and an
      // order of magnitude below what any crystal carries.
      coreStrength: 0.02,
      coreColor: rgb(round6(0.46), round6(0.44), round6(0.55)),
    },
    facets: SUBSTRATE_FACET_TINTING,
  };
  return {
    ...bodyWithoutSignature,
    signature: materialSignature(bodyWithoutSignature),
  };
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
    // The substrate is published geometry with no growth body behind it, so it
    // has no composition entry by design — that is not a data gap.
    if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) continue;
    if (!compositionIds.has(mesh.bodyId)) missingCompositionBodyIds.push(mesh.bodyId);
  }

  const bodies = input.geometry.meshes.flatMap((mesh) => {
    if (mesh.bodyId === CRYSTAL_SUBSTRATE_BODY_ID) {
      return [buildSubstrateMaterial(input, materialPalette)];
    }
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
