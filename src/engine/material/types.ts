import type { CrystalCompositionState } from '../composition';
import type { CrystalGeometryState } from '../geometry';
import type { CrystalSpeciesBlueprint } from '../species/crystal';

export type CrystalMaterialQuality = 'high' | 'balanced' | 'low' | 'fallback';

export interface CrystalRgb {
  r: number;
  g: number;
  b: number;
}

export interface CrystalMaterialConfig {
  /** Bump whenever optical formulas, shader recipes or quality tiers change. */
  rulesVersion: string;
  quality: CrystalMaterialQuality;
  allowIridescence: boolean;
  allowProceduralReflection: boolean;
}

export interface CrystalShaderRecipe {
  shaderVersion: 1;
  rimStrength: number;
  skyStrength: number;
  skyColor: CrystalRgb;
  groundColor: CrystalRgb;
  rimColor: CrystalRgb;
  inclusionDensity: number;
  inclusionScale: number;
  inclusionContrast: number;
  /**
   * Light from inside the stone.
   *
   * The shell's own emission lifts every plane by the same amount, which
   * flattens exactly the relief the facets are for, so the glow moved here:
   * strongest on faces turned toward the viewer, where the most crystal lies
   * behind them, and absent at the silhouette. Every face has its own normal,
   * so unlike emission this varies face to face — it deepens the relief
   * instead of erasing it.
   */
  coreStrength: number;
  coreColor: CrystalRgb;
  /**
   * How much the shell behaves like glass rather than like translucent stone.
   *
   * One number, three effects, all of them the same physics: reflectance rises
   * toward the silhouette. So the shell goes clear where you look straight
   * through it and solid at the edge, the edge lights up exactly where it stops
   * being transparent, and light crossing the body at an angle travels further
   * and picks up more of the colour it carries.
   *
   * This is what glass looks like *without* refraction, which is the only kind
   * available here — `transmission` samples a render target the CSS sky is not
   * in (ADR-0007). Flat alpha alone reads as fog; the view-dependence is the
   * whole difference.
   */
  glassStrength: number;
  /**
   * Milky veils inside the stone.
   *
   * Flattened along the axis so the noise forms lenses rather than speckle,
   * because that is what a plane of fluid inclusions looks like. This is the
   * texture the eye reads as depth once the shell is no longer opaque: it
   * varies the stone's cloudiness, and with it how much light gets through.
   *
   * Procedural rather than an image. The mesh has no UV attribute at all: it is
   * a polytope whose faces are different shapes on every crystal, so there is
   * nothing to unwrap and no atlas that would fit. An object-space field needs
   * no coordinates, costs no memory, and cannot seam.
   *
   * This is the only surface field left. Growth striations across the prism
   * faces were tried alongside it and removed on sight (2026-08-03): they are
   * a real quartz feature, but at the size the portal draws a crystal they read
   * as horizontal stripes ruled onto it rather than as a growth record.
   */
  veilStrength: number;
  veilScale: number;
  /**
   * The light in the fissure.
   *
   * Only the quartz vein carries it. The seam is a crack the crystals came out
   * of, and a crack with nothing in it is a groove — what makes it read as the
   * source rather than as a moulding is that something is lit down there.
   *
   * Two colours rather than one, drifting against each other, because that is
   * what makes it an aurora instead of a lamp: a single hue at a single
   * brightness is a bulb in a slot. Both come from the wishes the couple
   * granted (ADR-0004), so the light in the ground is the same light the
   * crystals carry inside them.
   *
   * Strongest at the bottom of the fissure and gone at the lip, so it lights
   * the crack rather than washing the whole seam.
   */
  auroraStrength: number;
  auroraColor: CrystalRgb;
  auroraSecondColor: CrystalRgb;
  /**
   * How far below the seam's lip the light reaches full strength, in engine
   * units.
   *
   * Published rather than assumed, because the fissure's depth scales with the
   * druse: a constant tuned on one couple would light the whole seam on a
   * small crystal and nothing at all on a large one.
   */
  auroraDepth: number;
  /**
   * How many texture cells fit into one engine unit of a face.
   *
   * The mesh publishes its texture coordinates in engine units (see
   * `CrystalMeshData.uvs`) precisely so density is decided here rather than
   * baked into the geometry: the grain belongs to the mineral, not to the size
   * of the body, so a year crystal shows the same cells as the monarch at the
   * same scale rather than a shrunken copy of them.
   *
   * Zero means the body takes no surface maps at all.
   */
  surfaceTextureScale: number;
  /** How far the surface map's relief is allowed to push the shading normal. */
  surfaceReliefStrength: number;
  /** How brightly the veins in the map glow, in the body's own earned colour. */
  surfaceVeinStrength: number;
  /**
   * How brightly a facet's own rim is drawn, in `rimColor`.
   *
   * Drawn rather than lit, and that is a finding rather than a style. Three
   * stylized gem assets the owner supplied all outline every facet **in the
   * surface itself** — albedo, roughness and emissive each treat the rim
   * differently from the interior — and the handpainted pack carries the whole
   * look in base colour under `KHR_materials_unlit`, with no lighting model at
   * all. Measurement on the portal agreed from the opposite direction: with the
   * key light switched off the monarch's facets moved by about 3%, so lighting
   * was never going to separate them however it was arranged.
   *
   * This is the one term that does not care where the light is, which is exactly
   * why a stylized gem keeps reading as a gem on any stage.
   */
  facetEdgeStrength: number;
  /**
   * How wide that rim is, in screen pixels.
   *
   * Screen space, not object space: a rim measured on the body would thicken as
   * the body shrank, until a year crystal was more outline than crystal.
   */
  facetEdgeWidth: number;
  /**
   * How strongly the body's foot is tinted away from its tip.
   *
   * Every stylized reference crystal carries a colour that changes along its
   * length, and a body of one flat colour reads as moulded however well it is
   * lit. Both ends stay the couple's: the foot takes the deepened core colour
   * the granted wishes made (ADR-0004), the tip keeps the shell's own, so this
   * is the earned colour changing depth rather than a second colour brought in
   * from outside.
   */
  axialTintStrength: number;
  /** What the foot is tinted toward — a multiplier over the outgoing colour. */
  footColor: CrystalRgb;
  /**
   * How hard the growth striations are drawn across the shaft, 0 for none.
   *
   * Horizontal striation perpendicular to the c-axis is *the* diagnostic
   * feature of a quartz prism face — it is how a mineralogist tells quartz from
   * beryl at a glance — and the crystal had none of it anywhere: not in the
   * geometry, not in the shader. Pass 1's "almost no evidence of growth
   * history" was the same absence read from the product side.
   *
   * Drawn rather than modelled, and that is a constraint rather than a
   * shortcut. Since ADR-0006 every face is planar by construction and the
   * architecture's own position is that vertex noise is not how this crystal
   * gets detail; displacing the shaft would break the one property the whole
   * faceting rests on. A striation is a step in the surface a few microns deep,
   * so what it does to a render is change a normal — which is exactly what can
   * be done without moving a vertex.
   */
  striationStrength: number;
  /**
   * How many striations the shaft carries from foot to tip.
   *
   * One per year the couple has been together. Striations *are* growth
   * increments on a real crystal, so this is the one place where the mineral's
   * own texture and the artifact's meaning are the same thing rather than one
   * dressed as the other — and it is the monarch's only expression of the year
   * count, which until now she carried solely as height.
   */
  striationCount: number;
}

export interface CrystalFacetTinting {
  /** Multipliers over the body's base colour, in palette order. */
  tints: readonly CrystalRgb[];
  /** Selection thresholds, same length and ascending; the last is 1. */
  cumulativeWeights: readonly number[];
}

export interface CrystalBodyMaterial {
  materialVersion: 1;
  bodyId: string;
  signature: string;
  baseColor: CrystalRgb;
  emissiveColor: CrystalRgb;
  roughness: number;
  metalness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  ior: number;
  reflectivity: number;
  emissiveIntensity: number;
  envMapIntensity: number;
  iridescence: number;
  iridescenceIOR: number;
  iridescenceThicknessMin: number;
  iridescenceThicknessMax: number;
  /**
   * Permanently zero, and not a matter of taste: Three's transmission samples a
   * render target the CSS sky behind the alpha canvas is not in, so a
   * transmissive shell shows black wherever it overlaps the sky.
   */
  transmission: 0;
  /**
   * Alpha, which the canvas *does* composite correctly — a semi-transparent
   * pixel over an empty region carries its own alpha out to the CSS gradient.
   * That is why the shell can be see-through while never being refractive
   * (ADR-0007). The substrate stays at 1.
   */
  opacity: number;
  transparent: boolean;
  depthWrite: true;
  shader: CrystalShaderRecipe;
  /** Per-face tone over baseColor — see `facets.ts`. */
  facets: CrystalFacetTinting;
}

export interface CrystalMaterialPalette {
  primary: CrystalRgb;
  secondary: CrystalRgb;
  highlight: CrystalRgb;
  core: CrystalRgb;
}

export interface CrystalMaterialDiagnostics {
  missingCompositionBodyIds: string[];
  missingGeometryBodyIds: string[];
  clampedBodyIds: string[];
  transmissionForcedOff: true;
  uniqueMaterialCount: number;
}

export interface CrystalMaterialState {
  materialStateVersion: 1;
  rulesVersion: string;
  quality: CrystalMaterialQuality;
  sourceSpeciesBlueprintVersion: CrystalSpeciesBlueprint['speciesBlueprintVersion'];
  sourceCompositionStateVersion: CrystalCompositionState['compositionStateVersion'];
  sourceGeometryStateVersion: CrystalGeometryState['geometryStateVersion'];
  engineVersion: string;
  speciesRulesVersion: string;
  artifactSeed: number;
  palette: CrystalMaterialPalette;
  bodies: CrystalBodyMaterial[];
  diagnostics: CrystalMaterialDiagnostics;
}

export interface BuildCrystalMaterialInput {
  species: CrystalSpeciesBlueprint;
  composition: CrystalCompositionState;
  geometry: CrystalGeometryState;
  config: CrystalMaterialConfig;
}
