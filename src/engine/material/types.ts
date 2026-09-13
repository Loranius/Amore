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
   * Перелив: наскільки обчислена «кімната» має СТОРОНИ, а не лише верх і низ.
   *
   * `skyStrength` мішає небо із землею за ВЕРТИКАЛЛЮ відбитого променя, і для
   * призми це майже нічого не вирішує: усі її грані близькі до вертикальних,
   * тож відбиті промені близькі до горизонтальних і дістають ту саму
   * відповідь. Виміряно на живій лабораторії — кристал змінювався на 10.1%
   * медіанно за 4° оберту, і майже все те були зсунуті межі граней, а не
   * світло, що біжить по тілу.
   *
   * Це число дає тій самій кімнаті АЗИМУТ. Дві грані, повернуті в різні
   * боки, дістають різне; коли кристал крутять, кожна грань проходить крізь
   * цю різницю — і це є перелив. Той самий механізм дала б карта оточення,
   * якби вона тут була (`render/envMap.ts` каже, чому її немає).
   *
   * Одне число на дві дії, бо це один факт про кімнату: воно і розгойдує
   * яскравість (± своя частка), і підмішує відтінок від бузкового неба до
   * трояндового обідка. Обидва кінці вже в родині пари, тож перелив не може
   * винести колір за межі заслуженого (ADR-0004).
   *
   * ЗНАКОВЕ, А НЕ ДОДАТНЕ. Терм, який лише додає, — це підйом, а підйом
   * рівно й є те, що сплощує грані. Цей темнить так само часто, як
   * висвітлює, тож дві по-різному повернуті грані розходяться, а не
   * сходяться.
   */
  sheenStrength: number;
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
   * Колір самого обводу — ЯСКРАВІШИЙ КАМІНЬ, а не біла нитка (ADR-0177).
   *
   * Досі обвід брав `rimColor`, спільний із френелем і склом: світло-рожевий
   * `1 / 0.86 / 0.94`, тобто насиченість 0.14. На блідому тілі це було
   * непомітно, але відколи нутро опущене (ADR-0175), камінь став насиченим —
   * і виміряно на кадрі: грані тримають насиченість **0.43**, а обвід —
   * **0.15**. Біла нитка по насиченому каменю читається як шов пластмасової
   * форми, а не як ребро кристала.
   *
   * Еталонні камені (`amore-crystal-look`) обводять грань «у всіх трьох
   * каналах одразу»: яскравіше в альбедо, шорсткіше в roughness, яскравіше в
   * emissive. Це ЯСКРАВІШИЙ ТОЙ САМИЙ КАМІНЬ, а не інший матеріал поверх
   * нього.
   *
   * Окреме поле, а не правка `rimColor`: той самий колір несуть френель і
   * скло, тобто СИЛУЕТ. Силует має відділяти тіло від неба яскравістю, і
   * насичувати його — інша розмова з іншим виміром.
   */
  facetEdgeColor: CrystalRgb;
  /**
   * Рівень нутра грані — множник підсумкового кольору ПЕРЕД тим, як
   * додається обвід.
   *
   * Народився з виміру, а не з бажання (ADR-0175). У стовбурі монарха
   * найтемніша грань стояла на 75% яскравості екрана, а дві найсвітліші —
   * на 93% із насиченістю 0.23: тіло сиділо на плечі кривої тонування, де
   * заслужений колір (ADR-0004) вицвітає в білий. Власник назвав це
   * «сирим», і це було точне слово.
   *
   * Еталонні камені (`amore-crystal-look`) влаштовані навпаки: нутро грані
   * темне й насичене, світлий саме обвід. Тому цей множник стоїть ПЕРЕД
   * обводом — інакше камінь просто потемнів би цілком, а темне тіло без
   * світлого ребра читається як силует, а не як кристал.
   *
   * ЧОМУ ОКРЕМЕ ЧИСЛО, А НЕ НАБІР ТОНІВ. Перша спроба опустила
   * `CRYSTAL_FACET_TINTS` в 0.55 разу — кроки циклу від цього не
   * змінюються, тож на вигляд це те саме. Але тони граней мають
   * ВАРІЮВАТИСЬ навколо заслуженого кольору, а не зсувати його: умова
   * `facets.test.ts` про середнє 1.0 стереже саме це й упіймала спробу
   * першим прогоном. Рівень і варіація — дві різні речі, і в них два
   * різні числа.
   */
  interiorLevel: number;
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
   * Pink energy turning inside the monarch.
   *
   * A real helix in the body's own normalised frame (`CrystalMeshData.bodyCoord`),
   * not a screen effect and not a second mesh: the shell is opaque by contract
   * (ADR-0007), so anything "inside" it has to be drawn by the shell's own
   * fragments as light arriving from behind them. That is why the term is
   * weighted by how squarely a face meets the eye — a facet at the silhouette
   * has no stone behind it to carry the glow, and a facet turned toward the
   * viewer has the whole body.
   *
   * **The monarch only, and that is a rule rather than a budget.** The colony
   * reads as one mineral because every body shares the couple's colour; what
   * makes the monarch the monarch is that she is the one with something moving
   * in her. Lighting the daughters the same way would make seven equal lanterns
   * out of a crystal and its brood.
   */
  innerFlowStrength: number;
  /**
   * How many turns the helix makes between the monarch's foot and her tip.
   *
   * Separate from the rate it drifts at (`CrystalLifeState.innerFlowSpeed`): one
   * is the shape of the coil, the other is how fast it turns. Below about one
   * turn the ribbon reads as a bent line rather than a spiral; far above it the
   * turns land closer together than the body is wide and the whole thing goes
   * back to being an even glow.
   */
  innerFlowTurns: number;
  /** The two colours the flow drifts between — rose into amethyst, per §6. */
  innerFlowColor: CrystalRgb;
  innerFlowSecondColor: CrystalRgb;
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
