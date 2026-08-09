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

/**
 * How opaque the shell may be.
 *
 * This is the alpha *face-on*. The silhouette closes toward solid on its own
 * through the glass term, so the band could come down once that existed: a
 * crystal you can see straight through keeps a hard outline, which is what
 * stopped the body dissolving into the background at the first, flatter
 * setting.
 *
 * Never fully clear even so — a shell with nothing solid about it stops
 * catching the key light, and the faceting, which is the whole point of the
 * geometry, goes with it. Never fully opaque either, or the light the couple
 * earned inside has nowhere to come out.
 *
 * Raised twice on review (2026-08-03), the second time to the point of closing
 * almost completely. Four stylized crystal references the owner supplied are
 * **opaque without exception** — no alpha, no transmission, not one of them —
 * and they read as crystal far better than ours did while see-through. What
 * makes a gem look like a gem in all of them is the facets: their rims, and how
 * differently each one catches light. Transparency was never carrying that, and
 * while it was open the far facets showed through the near ones and the two
 * sets of edges cancelled into a wireframe.
 *
 * A trace is left rather than none at all, because the earned light still has to
 * get out and a perfectly sealed shell is a painted stone.
 *
 * The earlier note, kept because the reasoning still applies at every step:
 * raised from 0.52..0.84 because at the low end the body was
 * see-through enough that the far facets showed through the near ones, and two
 * sets of edges crossing each other read as a wireframe rather than as depth.
 * Glass is not mostly-transparent — a real quartz prism hides most of what is
 * behind it and gives back an edge instead. The transparency that remains is
 * there to let the earned light out, which is the one thing it is for.
 */
const SHELL_OPACITY = { min: 0.94, max: 1 } as const;

function intoBand(band: { readonly min: number; readonly max: number }, value: number): number {
  return round6(Math.max(band.min, Math.min(band.max, value)));
}

/** Position within a band, 0 at min and 1 at max. */
function acrossBand(band: { readonly min: number; readonly max: number }, t: number): number {
  return band.min + (band.max - band.min) * clamp01(t);
}

/**
 * How bright the shell's *diffuse* albedo is allowed to be, as luminance.
 *
 * This is the difference between a crystal and a piece of chalk, and it was
 * measured rather than chosen. The shell's albedo had drifted to a luminance of
 * about 0.80 — near-white — and on top of that came ambient, hemisphere, the sky
 * term, the core and the rim. Sampled off the live portal, four neighbouring
 * facets of the monarch then rendered at 161..186 of 255: a spread under 9%,
 * which the eye reads as one smooth surface no matter how well the geometry is
 * faceted.
 *
 * The facets were not actually receiving the same light. Undoing the ACES curve
 * on those samples puts them at roughly 0.36..1.6 in linear scene radiance — a
 * range of more than four to one. The shell was simply sitting so high on the
 * tone curve that the whole range landed in its shoulder, where everything
 * compresses toward white. Quadrupling the key light widened the spread by
 * nothing at all, which is exactly what a shoulder does.
 *
 * So the cap is not a darkening for taste: it moves the body down into the part
 * of the curve where a difference in illumination is still a difference in
 * pixels. It is also what quartz is — a mineral whose diffuse reflectance is
 * modest and whose brightness comes from specular and from the light inside it,
 * both of which are left untouched here.
 *
 * Hue and saturation are preserved exactly: all three channels scale by one
 * factor, so the colour the couple earned (ADR-0004) is the colour that shows.
 * Only its value moves.
 */
const SHELL_ALBEDO_LUMA = 0.46;

function capShellValue(color: CrystalRgb): CrystalRgb {
  const luma = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  if (luma <= SHELL_ALBEDO_LUMA || luma <= 1e-6) return color;
  return scaleRgb(color, SHELL_ALBEDO_LUMA / luma);
}

/**
 * How much of the shell's value a body keeps, by its rank in the colony.
 *
 * Rank has to be carried by *value*, and that is a correction rather than a
 * preference. The hue mix below moves a body from `primary` toward `secondary`,
 * and `secondary = mixRgb(primary, warmth, warmth · 0.36)` — so on a couple
 * whose events carry no warm channel, `secondary` **is** `primary` and the
 * whole ladder mixes a colour with itself. Measured on three couples, warmth
 * came out 0 for all three and the monarch, the current year and every skirt
 * crystal shared one identical RGB: 0.7768, 0.3601, 0.5162.
 *
 * The value step was already written — `role === 'micro' ? 0.84 : 1` — and it
 * was inert too, for a different reason: it was applied *inside*
 * `capShellValue`, which then divided it straight back out. Any colour above
 * the cap comes out at exactly the cap, whatever was done to it first.
 *
 * So the step goes after the cap. The cap keeps its job — no body sits higher
 * on the tone curve than 0.46 luma — and the ladder descends from there. The
 * range is deliberately narrow: this is rank, not shadow, and a druse whose
 * outer crystals read as grey has traded one flat colony for another.
 */
function roleValue(role: string): number {
  if (role === 'focal') return 1;
  if (role === 'support') return 0.95;
  if (role === 'family') return 0.92;
  if (role === 'companion') return 0.88;
  return 0.85;
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
  return scaleRgb(
    capShellValue(mixRgb(base.primary, target, roleMix)),
    roleValue(role),
  );
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
    // The whole of the crystal's reflection, and it has to be: an environment
    // map is off by decision, not by omission (`render/envMap.ts`), because
    // every route to one goes through a HalfFloat render target — the standing
    // suspect for the white background on the owner's device. So what a real
    // studio environment contributes gets computed instead: a Fresnel rim, and sky above
    // against warmer ground below mixed by the reflected ray's vertical.
    //
    // Both raised on review (2026-08-03) — the shell was reading as tinted
    // plastic. Reflection is most of what separates the two, and with no map to
    // supply it these two terms are the entire budget.
    rimStrength: round6(reflectionEnabled ? preset.reflectionScale * (micro ? 0.12 : emphasized ? 0.74 : 0.54) : 0),
    skyStrength: round6(reflectionEnabled ? preset.reflectionScale * (micro ? 0.05 : 0.26) : 0),
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
    // Granted wishes are what the light inside is made of (ADR-0004), so they
    // decide how much of it there is, not merely what colour it is. The step
    // this replaces was a flat ×1.3 for "has any tint at all", which read the
    // same for one gift as for twenty.
    coreStrength: round6(micro
      ? 0
      : (0.1 + pressures.luminosity * 0.16 + state.luminosity * 0.08)
        * (emphasized ? 1.35 : focal ? 1 : 0.72)
        * (1 + wishDepth(tint) * CORE_WISH_GAIN)),
    coreColor: coreTintColor(emissiveColor, tint),
    // A refined, unfractured couple's crystal is nearer glass; a clouded one is
    // nearer stone. Kept off the smallest bodies, where the effect is a few
    // pixels of edge and the cost is the same as on the monarch.
    glassStrength: round6(micro ? 0 : clamp01(
      0.66 + pressures.refinement * 0.26 + state.purity * 0.2 - state.fracture * 0.24,
    )),
    veilStrength: round6(micro ? 0 : textureTier(0.4 + inclusionBase * 0.5, preset)),
    veilScale: round6(5.5 + pressures.surfaceComplexity * 3.5),
    // The aurora belongs to the ground, not to the crystals standing in it.
    auroraStrength: 0,
    auroraColor: emissiveColor,
    auroraSecondColor: emissiveColor,
    auroraDepth: 1,
    // One grain for the whole colony: a year crystal shows fewer cells of the
    // same size rather than a shrunk-to-fit copy of the pattern.
    // No surface map on a crystal. Not a budget decision — the maps are still
    // loaded and the vein still wears them.
    //
    // A grown crystal face is *clean*: that is what makes it a face rather than
    // a fracture, and every reference the owner supplied shows it — flat planes,
    // a painted rim, and whatever structure there is living inside the body
    // rather than on it. A cellular map wrapped over the outside reads as hide
    // at the size the portal draws a crystal, which is what it was doing, and it
    // was also the last thing flattening the facets: a pattern that crosses an
    // edge tells the eye the two planes are one surface.
    //
    // What it was there for is still there, procedurally and *within* the stone:
    // the veils (`veilStrength`) are a 3D field, so they cloud the body without
    // ever crossing a facet edge.
    surfaceTextureScale: 0,
    // Light. The map is a mineral's grain, and a grain that stands up off the
    // surface stops reading as stone and starts reading as hide — the crystal
    // wants its relief in the facets, which the geometry already provides.
    // Nothing to give relief to once the map is off, and a normal map without
    // an albedo to agree with is just a rippled plane.
    surfaceReliefStrength: 0,
    // The veins glow in the colour the couple earned, not in the map's own —
    // the map is structure, ADR-0004 owns the colour.
    surfaceVeinStrength: 0,
    // Every tier, including fallback, and that is the point of it: this is the
    // one cue that costs nothing and does not depend on the lighting, so it is
    // the last thing that should be switched off on a weak phone rather than
    // the first. A stylized gem keeps reading as a gem on any stage precisely
    // because its facets are outlined by the surface itself.
    facetEdgeStrength: round6(micro ? 0 : emphasized ? 0.34 : focal ? 0.28 : 0.22),
    facetEdgeWidth: 1.4,
    // Off on the smallest bodies for the usual reason — a gradient across nine
    // pixels is a colour shift nobody reads as one.
    axialTintStrength: round6(micro ? 0 : 0.55),
    footColor: coreTintColor(emissiveColor, tint),
    // Off on the smallest bodies, and off on the fallback tier. Everywhere
    // else it is cheap — a fract, a smoothstep and one derivative — and it is
    // the only thing on the crystal that says anything grew over time.
    striationStrength: round6(
      micro || input.config.quality === 'fallback' ? 0 : focal ? 0.2 : 0.14,
    ),
    striationCount: striationCount(state.ageDays),
  };
}

/**
 * One striation per year together, and never so few that the shaft looks blank
 * or so many that they close into a hatch.
 *
 * The floor matters more than it looks. A couple in their first year would
 * otherwise get a single line across the shaft, which reads as a defect rather
 * than as a texture — a crystal has striations from the moment it has a prism
 * face. The ceiling is where the pattern stops being resolvable on a phone: the
 * monarch stands about three hundred pixels tall on a portrait screen, so
 * thirty-six bands is eight pixels apart, and past that the shader's own
 * derivative fade would be doing the work instead of the number.
 */
export function striationCount(ageDays: number): number {
  const days = Number.isFinite(ageDays) ? Math.max(0, ageDays) : 0;
  return Math.min(36, Math.max(4, Math.round(days / 365)));
}

/**
 * The two colours the fissure glows in, from every wish the couple granted.
 *
 * Aggregated across the year crystals rather than taken from one of them: the
 * vein is the ground they all grew out of, so the light in it is the couple's
 * whole history of giving and not the most recent year's.
 *
 * The second colour is the first rotated through the channels. A real aurora is
 * two hues sliding over one another; one hue at one brightness is a lamp in a
 * slot, however slowly it moves.
 */
function auroraColors(
  input: BuildCrystalMaterialInput,
): { strength: number; first: CrystalRgb; second: CrystalRgb } {
  const tints = [input.species.mother, ...input.species.formations]
    .map((instruction) => instruction.tintRgb)
    .filter((tint): tint is readonly [number, number, number] => tint !== undefined);

  let depth = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  for (const tint of tints) {
    const earned = wishDepth(tint);
    if (earned <= 0) continue;
    depth = Math.max(depth, earned);
    r += tint[0] * earned;
    g += tint[1] * earned;
    b += tint[2] * earned;
    }
  const total = r + g + b;
  if (depth <= 0 || total <= 0) {
    // No wishes granted yet. The fissure still glows, faintly and in the
    // couple's own palette — an unlit crack reads as a gap in the floor, and
    // the artifact must never punish a couple for not having done a thing yet.
    const quiet = input.species.pressures.dominantChannel === 'culture'
      ? rgb(0.52, 0.62, 0.95)
      : rgb(0.58, 0.78, 0.9);
    return { strength: AURORA_FLOOR, first: quiet, second: rgb(0.72, 0.56, 0.94) };
  }

  const scale = 3 / total;
  const first = rgb(round6(clamp01(r * scale)), round6(clamp01(g * scale)), round6(clamp01(b * scale)));
  return {
    strength: round6(AURORA_FLOOR + (1 - AURORA_FLOOR) * depth),
    first,
    // Channels rotated, so the two colours are related but never the same.
    second: rgb(first.b, first.r, first.g),
  };
}

/** How high the vein stands above the platform, from the published mesh. */
function substrateLip(input: BuildCrystalMaterialInput): number {
  const mesh = input.geometry.meshes.find(
    (candidate) => candidate.bodyId === CRYSTAL_SUBSTRATE_BODY_ID,
  );
  return mesh === undefined ? 0.02 : Math.max(1e-4, mesh.bounds.max.y);
}

/**
 * Texture cells per engine unit.
 *
 * Measured against the body it has to sit on rather than picked, and the window
 * either side of it is narrow. Too coarse and a face holds less than one cell,
 * so the map reads as a soft gradient — the pattern is there and the *texture*
 * is not. Too fine and the cells drop under the size of the facets themselves,
 * at which point the eye stops reading mineral and starts reading woven cloth
 * laid over the crystal, which is worse than no map at all. This puts a handful
 * of cells across a prism face, which is the grain quartz actually has.
 */
const SURFACE_CELLS_PER_UNIT = 11;

/** What the fissure glows at before a single wish has been granted. */
const AURORA_FLOOR = 0.3;

/**
 * How much of the wish cap a body's earned tint represents, from 0 to 1.
 *
 * `wishTint` builds its colour as `1 - (1 - hue) * pull` with `pull` three
 * quarters of the strongest channel's fill, so the darkest component is exactly
 * `1 - pull`. Inverting that recovers the fill itself — the number of gifts as
 * a share of the cap — rather than guessing at it from the colour.
 */
function wishDepth(tint: readonly [number, number, number] | null): number {
  if (tint === null) return 0;
  return clamp01((1 - Math.min(tint[0], tint[1], tint[2])) / WISH_TINT_PULL);
}

/**
 * How much of a texture survives a quality tier.
 *
 * Not a plain multiply by `inclusionScale`, which is what the first pass did:
 * at the `low` tier that scale is 0.35, and a third of a subtle effect is
 * nothing at all — the striations were invisible on exactly the phones most
 * couples are holding. Off entirely at `fallback`, because there procedural
 * noise is a per-pixel cost with a frame budget that cannot pay it; everywhere
 * else it keeps at least half its strength.
 */
function textureTier(
  base: number,
  preset: (typeof CRYSTAL_MATERIAL_QUALITY_PRESETS)[keyof typeof CRYSTAL_MATERIAL_QUALITY_PRESETS],
): number {
  if (preset.inclusionScale <= 0) return 0;
  return base * (0.5 + 0.5 * preset.inclusionScale);
}

/** The ceiling `wishTint` applies when it pulls a colour off white. */
const WISH_TINT_PULL = 0.75;

/** How much a fully granted year brightens its own core. */
const CORE_WISH_GAIN = 0.85;

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
  // How much light gets through. A clear couple's crystal is more glass than
  // stone; fracture and cloudiness close it up. The floor matters more than the
  // ceiling: below roughly two thirds the facets stop reading, because what
  // makes a facet visible is the light it reflects rather than the light behind
  // it. The smallest bodies stay solid — at their size transparency is a sort
  // order risk bought for pixels nobody can resolve.
  // Opaque. Not nearly opaque — opaque.
  //
  // The band above is what a couple's clarity *would* buy if the shell were
  // see-through, and it is kept because the reasoning is sound and the door may
  // reopen. It is not spent: every reference crystal is opaque, none of them
  // lose anything by it, and the light the couple earned never needed alpha in
  // the first place — the core term adds it to the outgoing colour rather than
  // letting the background through, so a sealed shell still glows.
  //
  // Being genuinely opaque also retires a real hazard rather than a cosmetic
  // one. Alpha blending needs back-to-front ordering, and batching groups bodies
  // by material signature, so within one batch there was no order at all
  // (ADR-0007's standing risk). At `transparent: false` the depth buffer does
  // the work and the question cannot be asked.
  void SHELL_OPACITY;
  const opacity = 1;
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
    // Specular reach of the shell itself, under the clearcoat. Raised with the
    // rim so the highlight the key light leaves on a facet is as strong as the
    // reflection at its edge — otherwise the edge lights up and the face it
    // belongs to stays matte, which reads as an outline drawn on plastic.
    reflectivity: round6(clamp01(0.74 + state.purity * 0.26 + (focal ? 0.06 : 0))),
    emissiveIntensity,
    envMapIntensity: 0,
    iridescence,
    iridescenceIOR: 1.3,
    iridescenceThicknessMin: round6(220 + pressures.warmth * 70),
    iridescenceThicknessMax: round6(390 + pressures.brilliance * 180),
    // Transmission stays off, and for the same reason it always has: the canvas
    // is alpha-composited over a CSS sky, and Three's transmission samples a
    // render target that the sky is not in — a transmissive shell shows black
    // where it overlaps the sky rather than the sky itself.
    //
    // Alpha is a different mechanism and does not have that problem. A
    // semi-transparent pixel over an empty region of the canvas simply carries
    // its own alpha out to the compositor, which lays it over the CSS gradient
    // correctly. So the shell can be see-through after all; what it cannot be
    // is refractive. See ADR-0007.
    transmission: 0,
    opacity,
    transparent: false,
    // Kept on. Each body is convex and back faces are culled, so a crystal
    // covers each of its own pixels exactly once and needs no sorting with
    // itself; writing depth is what stops one crystal's far side showing
    // through its near side.
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
  const aurora = auroraColors(input);
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
      // The vein is not glass. It is opaque quartz sitting in stone, and an
      // edge that lit up would make the seam read as a pane set into the floor.
      glassStrength: 0,
      // Veils instead, and stronger than any crystal's. Milky quartz *is*
      // cloud; the mottling is what separates the seam from polished stone at
      // the distance the portal actually looks at it from.
      veilStrength: round6(
        textureTier(0.9, CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality]),
      ),
      veilScale: 7.5,
      // Tiered like a texture rather than switched off outside `high`, but not
      // scaled down as hard: this is the artifact's own light, and a couple on
      // a mid-range phone should still see what they earned. Off only at
      // `fallback`, where nothing procedural runs.
      auroraStrength: round6(
        textureTier(aurora.strength, CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality]),
      ),
      auroraColor: aurora.first,
      auroraSecondColor: aurora.second,
      // The lip's own height is the yardstick: the fissure runs a couple of
      // those below it, and both scale with the druse.
      auroraDepth: round6(Math.max(1e-4, substrateLip(input) * 2.2)),
      // The vein wears the same mineral as the crystals it grew, at a much
      // coarser grain. Two reasons, and they compound: it is massive quartz
      // rather than a grown face, so its domains are larger to begin with, and
      // it spans an order of magnitude more of them than any single body does.
      // The fraction is that small for exactly that reason: at anything near
      // the crystals' density the pattern repeated some twenty-five times
      // across the seam, and a cellular map repeated that often on dark stone
      // stops reading as mineral and reads as snakeskin. Here it comes to a
      // handful of broad domains, which is what massive quartz looks like.
      surfaceTextureScale: round6(
        textureTier(SURFACE_CELLS_PER_UNIT * 0.08, CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality]),
      ),
      surfaceReliefStrength: round6(
        // Weaker than the crystals', not stronger. The vein is lit almost
        // edge-on by the aurora below it, and at that grazing angle a relief
        // that merely textures a crystal turns every cell into a raised scale.
        textureTier(0.3, CRYSTAL_MATERIAL_QUALITY_PRESETS[input.config.quality]),
      ),
      // No glowing veins on the stone: the light down there is the aurora, and
      // two lit patterns in the same crack would fight.
      surfaceVeinStrength: 0,
      // The rubble takes a rim, the seam does not — and they share a material,
      // so this is one number for both. It goes on: the boulders are faceted
      // solids whose whole job is to read as broken rock, and broken rock is
      // read from its edges. Weaker than the crystals', because stone catches
      // less on a fracture than quartz does on a grown face.
      facetEdgeStrength: 0.12,
      facetEdgeWidth: 1.4,
      // The rock has no foot and no tip: it is broken rubble, not a grown body,
      // and there is no axis for a gradient to run along. Growth striation is
      // out for the same reason and more strongly: a striation records the
      // increments a crystal grew in, and this is the stone it grew *out of*.
      axialTintStrength: 0,
      footColor: baseColor,
      striationStrength: 0,
      striationCount: 0,
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
