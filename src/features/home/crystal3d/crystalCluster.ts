// ============================================================
// crystalCluster — Crystal-специфічний рендер-шар «Artifact Engine».
// ------------------------------------------------------------
// Уся геологічна логіка (де відклалось тіло, з якою датою, скільки їх)
// живе в ../artifact/ і не знає про THREE/Lathe-геометрію взагалі. Цей файл
// — єдиний адаптер: deriveClusterBranch перекладає абстрактний ArtifactNode
// (anchor/direction у просторі рушія) у Crystal-конкретні позицію та
// кватерніон, deriveClusterMaterial перекладає EvolutionPressures у PBR-
// параметри матеріалу. Навмисно функція-адаптер, а не `extends`/успадкування
// — так ClusterBranch не може непомітно "просочити" crystal-специфічні поля
// назад у спільний ArtifactNode-контракт.
// ============================================================
import * as THREE from 'three';
import { mulberry32, hashSeedString } from '../mulberry32';
import type {
  ArtifactDNA,
  ArtifactNode,
  ColonyRole,
  CompositionTier,
  CrystalArchetype,
  DominantSystem,
  EvolutionPressures,
  GrowthDomainId,
  NodeKind,
} from '../artifact';

export interface ClusterBranch {
  key: string;
  kind: NodeKind;
  domain: GrowthDomainId | null;
  label?: string;
  /** «Доросла» довжина/товщина (до масштабування maturity в buildBranchGeometry). */
  height: number;
  radiusBottom: number;
  posX: number;
  posY: number;
  posZ: number;
  /** Орієнтація тіла: локальна вісь Y меша → напрямок росту + власний spin. */
  quatX: number;
  quatY: number;
  quatZ: number;
  quatW: number;
  colorA: string;
  colorB: string;
  breathePhase: number;
  breatheSpeed: number;
  /** 0 (щойно з'явився) .. ~1 (давно росте) — див. maturityCurve(). */
  maturity: number;
  /** Роль у колонії — супутники/мікро рендеряться простіше (менше сегментів). */
  role: ColonyRole;
  /** Ярус композиції (Composition Framework) — полірування, не розміри. */
  tier: CompositionTier;
  /** Архетип форми — вістря/сплющення/шорсткість реалізує buildBranchGeometry. */
  archetype: CrystalArchetype;
  /** Монарх друзи — найвища оптична якість (чистіші грані, глибший блиск).
   *  Справжньої прозорості немає навмисно: transmission вмикає баговий
   *  mobile-рендерпас (див. заголовок CrystalScene.tsx), а opacity на
   *  невідсортованих перетинних мешах дає артефакти. */
  primary: boolean;
  /** Золоте світіння для milestone-вузлів. */
  emissive?: boolean;
}

type CreationSourceLabel = 'recipe' | 'movie' | 'book';

const BASE_PALETTE: Record<Exclude<NodeKind, 'creation'>, [string, string]> = {
  core: ['#6d4fa8', '#e9ddff'],
  country: ['#1f8f82', '#8fe0d6'],
  city: ['#4a7fc9', '#b9d8ff'],
  milestone: ['#c9971f', '#fff3c9'],
  goal: ['#3f9142', '#b9e8b0'],
  anniversary: ['#c76a8f', '#f6c9dc'],
  memory: ['#d98a4f', '#ffd9a8'],
  wish: ['#e0527a', '#f6a8c0'],
};

const CREATION_PALETTE: Record<CreationSourceLabel, [string, string]> = {
  recipe: ['#d9702e', '#ffcf9e'],
  movie: ['#2f8fa3', '#a8ecf6'],
  book: ['#6b4fa8', '#cbb8f0'],
};

/**
 * Вертикальний зсув усієї маси в сцені: рушій кладе ядро-нуклеус біля
 * y≈-0.6 власного простору, тож композиція вже «сидить» низько — тут лише
 * дрібне вирівнювання під камеру/орбіту (стара коренева зона мала базу на
 * ROOT_Y=-0.34; нове дно маси лягає приблизно туди ж).
 */
const CLUSTER_Y = 0.08;

const UP = new THREE.Vector3(0, 1, 0);

function basePalette(node: ArtifactNode): [string, string] {
  if (node.kind === 'creation') {
    const source = (node.label as CreationSourceLabel | undefined) ?? 'recipe';
    return CREATION_PALETTE[source];
  }
  return BASE_PALETTE[node.kind];
}

/** Обертає відтінок (H у HSL) на hueRotationDeg — «вид» цієї пари. */
export function applyFamilyHue(hex: string, hueRotationDeg: number): string {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL((hsl.h + hueRotationDeg / 360) % 1, hsl.s, hsl.l);
  return `#${c.getHexString()}`;
}

/**
 * Переклад абстрактного вузла в Crystal-конкретну гілку: anchor/direction
 * (простір рушія, «де на масі відклалось і куди росте») → позиція +
 * кватерніон «вісь Y меша ↦ напрямок росту» з обертом spin навколо власної
 * осі — точний setFromUnitVectors, без Euler-гімнастики. Golden milestone-
 * колір НЕ обертається hueRotation — це навмисно фіксований, впізнаваний
 * бейдж «великої події» для будь-якої пари. Затінені конкуренцією тіла
 * (growthEnergy < 1) тьмяніші: верхній колір градієнта присідає до
 * базового — Growth Shadow видно й у кольорі, не лише в розмірі.
 */
export function deriveClusterBranch(node: ArtifactNode, dna: ArtifactDNA): ClusterBranch {
  const [baseA, baseB] = basePalette(node);
  const keepFixed = node.kind === 'milestone';
  const colorA = keepFixed ? baseA : applyFamilyHue(baseA, dna.hueRotation);
  let colorB = keepFixed ? baseB : applyFamilyHue(baseB, dna.hueRotation);
  if (node.primary) {
    // Монарх — чистіший і світліший до вістря, без жодного тінявого гашення.
    const lifted = new THREE.Color(colorB).lerp(new THREE.Color('#ffffff'), 0.18);
    colorB = `#${lifted.getHexString()}`;
  } else if (node.growthEnergy < 1) {
    const dulled = new THREE.Color(colorB).lerp(new THREE.Color(colorA), (1 - node.growthEnergy) * 0.45);
    colorB = `#${dulled.getHexString()}`;
  }

  const quat = new THREE.Quaternion().setFromUnitVectors(
    UP,
    new THREE.Vector3(node.direction.x, node.direction.y, node.direction.z).normalize(),
  );
  quat.multiply(new THREE.Quaternion().setFromAxisAngle(UP, node.spin));

  return {
    key: node.key,
    kind: node.kind,
    domain: node.domain,
    ...(node.label !== undefined ? { label: node.label } : {}),
    height: node.growthScale,
    radiusBottom: node.massScale,
    posX: node.anchor.x,
    posY: CLUSTER_Y + node.anchor.y,
    posZ: node.anchor.z,
    quatX: quat.x,
    quatY: quat.y,
    quatZ: quat.z,
    quatW: quat.w,
    colorA,
    colorB,
    breathePhase: node.breathePhase,
    breatheSpeed: node.breatheSpeed,
    maturity: node.maturity,
    role: node.role,
    tier: node.tier,
    archetype: node.archetype,
    primary: node.primary,
    ...(node.emphasized !== undefined ? { emissive: node.emphasized } : {}),
  };
}

// ── Матеріал: фото/фільми/рецепти/книги/спогади = НЕ форма ───────
export interface ClusterMaterial {
  /** Фото → полірування (Refinement Pressure). Немає окремого поля
   *  transmission — реального заломлення (material.transmission) свідомо
   *  немає ніде в рендері: воно вмикає власний "transmission render pass"
   *  THREE.WebGLRenderer для ВСІЄЇ сцени, який підставляє суцільний білий
   *  clear-колір при прозорому canvas (WebGLRenderer.js::renderTransmissionPass)
   *  — саме це спричиняло білий фон на реальних пристроях (CrystalScene.tsx). */
  roughness: number;
  clearcoat: number;
  /** Фото → стадія полірування: гамує per-facet джиттер граней (buildBranchGeometry). */
  polish: number;
  /** Рецепти → теплий відтінок (Warmth Pressure). */
  warmthMix: number;
  /** Фільми → внутрішні кольорові переливи. */
  movieMix: number;
  /** Спогади → внутрішнє світіння (Luminosity Pressure). */
  glow: number;
  /** Книги → складність поверхні (більше/менш регулярні грані). */
  surfaceComplexity: number;
  /** Фінанси → щільність/маса. */
  density: number;
  dominant: DominantSystem;
  dominance: number;
}

const WARMTH_COLOR = new THREE.Color('#ff8a3d');
const MOVIE_COLOR = new THREE.Color('#4fd1e0');

/** Переклад іменованих Evolution Pressures у PBR-параметри матеріалу кристала. */
export function deriveClusterMaterial(pressures: EvolutionPressures): ClusterMaterial {
  return {
    roughness: Math.max(0.06, 0.32 - pressures.refinement * 0.216),
    clearcoat: Math.min(0.95, 0.55 + pressures.refinement * 0.36),
    polish: pressures.refinement,
    warmthMix: pressures.warmth,
    movieMix: pressures.movieMix,
    glow: pressures.luminosity,
    surfaceComplexity: pressures.surfaceComplexity,
    density: pressures.density,
    dominant: pressures.dominant,
    dominance: pressures.dominance,
  };
}

/** Домішує тон (рецепти/фільми) у колір гілки — застосовується один раз при побудові геометрії. */
export function tintBranchColors(
  branch: ClusterBranch,
  material: Pick<ClusterMaterial, 'warmthMix' | 'movieMix'>,
): { colorA: THREE.Color; colorB: THREE.Color } {
  const a = new THREE.Color(branch.colorA);
  const b = new THREE.Color(branch.colorB);
  if (material.warmthMix > 0) {
    a.lerp(WARMTH_COLOR, material.warmthMix * 0.5);
    b.lerp(WARMTH_COLOR, material.warmthMix * 0.6);
  }
  if (material.movieMix > 0) {
    a.lerp(MOVIE_COLOR, material.movieMix * 0.35);
    b.lerp(MOVIE_COLOR, material.movieMix * 0.45);
  }
  return { colorA: a, colorB: b };
}

// ── Геометрія гілки: гранована призма → гранена гостра верхівка ──
// (той самий принцип, що v1, але тепер параметризований maturity:
// молода гілка — тупіша/тонша/коротша, зріла — гостра/товста/повна).
export function buildBranchGeometry(
  branch: ClusterBranch,
  material: Pick<ClusterMaterial, 'warmthMix' | 'movieMix' | 'surfaceComplexity' | 'polish'>,
): THREE.BufferGeometry {
  const shapeRng = mulberry32(hashSeedString(branch.key));
  // Великі тіла — ВЕЛИКІ чисті грані (референс: кварцовий гексагон, 6-7
  // граней — кожна читається площиною); середні — 7-9 (+шанс зайвої від
  // «складності поверхні»/книг); супутники колоній — дрібні й численні,
  // тому дешевші: 5-6 граней; мікрошар — 4-5 (перф на мобільних GPU).
  const segments =
    branch.role === 'micro'
      ? 4 + Math.floor(shapeRng() * 2)
      : branch.role === 'satellite'
        ? 5 + Math.floor(shapeRng() * 2)
        : 6 + Math.floor(shapeRng() * 3) + (shapeRng() < material.surfaceComplexity ? 1 : 0);
  const m = branch.maturity;

  const h = branch.height * (0.32 + m * 0.68);
  const r = branch.radiusBottom * (0.4 + m * 0.6);
  // Архетип (Composition Framework) реалізується тут ЛИШЕ формою профілю —
  // пропорції вже виставив композитор, матеріали його не обходять.
  const arch = branch.archetype;
  const blunt = arch === 'prismatic' || arch === 'tabular' || arch === 'massive';
  const tipR = blunt ? r * 0.28 : r * (0.14 - m * 0.12); // молоді — тупіші вістря, зрілі — майже гострі
  const prismEnd = (arch === 'prismatic' ? 0.6 : 0.46) + shapeRng() * 0.08;
  // pointStart МУСИТЬ бути помітно вище prismEnd (інакше профіль самоперетнеться
  // при високій maturity, де 0.72-m*0.2 може впасти аж до 0.52) — тому явно
  // прив'язаний до prismEnd з запасом, а не рахується незалежно.
  const pointStart = Math.max(prismEnd + 0.14, 0.72 - m * 0.2 + shapeRng() * 0.08);

  // 5 точок профілю (не 4) — довга майже-паралельна «призматична» ділянка
  // (p1→p2) окремо від пірамідального вістря (p2→p3→p4): справжній кристал
  // читається саме як призма+вістря, а не суцільний плавний конус.
  // Основа РОЗШИРЕНА понад радіус призми — «спідниця», що ховається в тілі
  // субстрату: стик двох тіл читається зрощеним мінералом, а не перетином
  // двох мешів. 'broken' — зрізана верхівка (обламаний кристал): профіль
  // завершується широким уступом і пласкою «кришкою» нижче повної висоти.
  const side =
    arch === 'broken'
      ? [
          new THREE.Vector2(Math.max(0.001, r * (1.06 + shapeRng() * 0.1)), 0),
          new THREE.Vector2(r, h * (0.06 + shapeRng() * 0.04)),
          new THREE.Vector2(r * (0.96 + shapeRng() * 0.04), h * Math.min(prismEnd, 0.6)),
          new THREE.Vector2(r * (0.3 + shapeRng() * 0.08), h * 0.84),
          new THREE.Vector2(0.06 * r, h * 0.85),
        ]
      : [
          new THREE.Vector2(Math.max(0.001, r * (1.06 + shapeRng() * 0.1)), 0),
          new THREE.Vector2(r, h * (0.06 + shapeRng() * 0.04)),
          new THREE.Vector2(r * (0.96 + shapeRng() * 0.04), h * prismEnd),
          new THREE.Vector2(r * (0.9 + shapeRng() * 0.06), h * pointStart),
          new THREE.Vector2(Math.max(0.001, tipR), h),
        ];

  // ЗАКРИТІ торці: LatheGeometry — поверхня обертання з ВІДКРИТИМИ кінцями,
  // тож без кришок видно наскрізь у порожнє нутро — саме ці «діри без
  // текстури» на вершині й під основою. Додаємо осьову точку (r≈0) перед
  // основою і після вістря: між нею й кільцем торця лате будує суцільний
  // диск-кришку. Тепер тіло замкнене з обох боків (низ ховається в
  // субстраті, верх — грань термінації кристала).
  const first = side[0]!;
  const last = side[side.length - 1]!;
  const profile = [new THREE.Vector2(0.0001, first.y), ...side, new THREE.Vector2(0.0001, last.y)];

  const geo = new THREE.LatheGeometry(profile, segments);
  const pos = geo.getAttribute('position') as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  const { colorA, colorB } = tintBranchColors(branch, material);
  const c = new THREE.Color();
  const profileLen = profile.length;

  // Легка per-facet варіація тону (справжній мінерал не має ідеально рівного
  // забарвлення грані до грані — тонкі домішки/включення). Тон фіксований на
  // всю грань (не на вершину), тому разом із flatShading (Branch у
  // CrystalScene.tsx) кожна грань читається як окрема, відмінна від сусідньої
  // — це і прибирає «картонний» ефект гладкого суцільного градієнта.
  // Монарх — оптично найчистіший: вузький розкид тону граней (майже
  // однорідний самоцвіт), решта — звичайна мінеральна неоднорідність.
  const facetTints = Array.from({ length: segments }, (_, idx) => {
    const tintRng = mulberry32(hashSeedString(`${branch.key}:facet:${idx}`));
    return branch.primary ? 0.92 + tintRng() * 0.16 : 0.82 + tintRng() * 0.36;
  });

  // THREE.LatheGeometry будує вершини у фіксованому порядку: зовнішній цикл
  // по (segments+1) кутових «колонках» (остання — шов, що дублює колонку 0),
  // внутрішній — по profile.length рядках профілю (LatheGeometry.js: `for i
  // <= segments { for j < points.length { push vertex } }`). Тому i-та
  // вершина = колонка Math.floor(i/profileLen), рядок i%profileLen — точний
  // розклад, без наближення через atan2.
  for (let i = 0; i < pos.count; i++) {
    const row = i % profileLen;
    const col = Math.floor(i / profileLen);
    const facetIdx = col % segments;

    const t = h > 0 ? pos.getY(i) / h : 0;
    c.lerpColors(colorA, colorB, Math.min(1, Math.max(0, t)));
    const tint = facetTints[facetIdx]!;
    colors[i * 3] = c.r * tint;
    colors[i * 3 + 1] = c.g * tint;
    colors[i * 3 + 2] = c.b * tint;

    // Органічний радіальний джиттер — детермінований по (facetIdx, row), тож
    // вершина шва (col===segments) дублює точнісінько той самий джиттер, що
    // й col===0 (facetIdx===0 в обох) — жодних щілин/тріщин у мешi. БЕЗ
    // джиттера лишаються 4 крайні рядки: осьові кришки торців (row 0,
    // profileLen-1) та прилеглі до них кільця основи/вістря (row 1,
    // profileLen-2) — щоб основа сиділа flush у субстраті, вістря лишалось
    // гострим, а диски-кришки точно збігались зі своїми кільцями (жодних
    // щілин по краю кришки).
    if (row > 1 && row < profileLen - 2) {
      const jitterRng = mulberry32(hashSeedString(`${branch.key}:jitter:${facetIdx}:${row}`));
      // ±8% базово — природна нерівність грані; «Фото → Polishing Pressure»
      // гамує її глобально, а ієрархія — локально: старі великі тіла чисті
      // (монарх майже ідеальний), крихітні супутники — грубші. Це і робить
      // ієрархію читабельною: велике = чисте, дрібне = шорстке.
      const hierarchy =
        (branch.primary ? 0.15 : branch.role !== 'dominant' ? 1.25 : 1) * (1 - 0.4 * branch.maturity);
      // 'etched' — протравлені грані: шорсткість поверх усіх правил.
      const amp = 0.08 * (1 - material.polish * 0.6) * hierarchy * (branch.archetype === 'etched' ? 1.7 : 1);
      const j = 1 + (jitterRng() * 2 - 1) * amp;
      pos.setXYZ(i, pos.getX(i) * j, pos.getY(i), pos.getZ(i) * j);
    }
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // Пласкі архетипи: blade — лезо (сильний сплюск по X), tabular — таблитчастий
  // (ширший і нижчий, помірний сплюск). Це геометрія, не матеріал — сплюск
  // «запікається» в позиції і обертається разом зі spin-кватерніоном.
  if (branch.archetype === 'blade') geo.scale(0.45, 1, 1);
  else if (branch.archetype === 'tabular') geo.scale(1.1, 1, 0.5);
  geo.computeVertexNormals();
  return geo;
}
