// ============================================================
// portalScene — числа й геометрія порталу, без React і без стану.
// ------------------------------------------------------------
// Сцена навколо артефакта раніше жила в CSS: пласкі шари неба, диск
// підлоги в perspective() і два прямокутники-колони. Вони ніколи не
// могли зійтися з кристалом, бо кристал живе в іншій системі координат
// — у WebGL-камері. Тут та сама сцена перенесена в 3D і стоїть на тій
// самій площині, що й артефакт (CRYSTAL_GROUND_BASELINE).
//
// Модуль навмисно чистий: кадрування камери, розкладка колон і поле
// зір — це арифметика, яку можна перевірити тестом без WebGL.
// ============================================================
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import { mulberry32 } from '../../mulberry32';

/** Площина, на якій стоїть артефакт; уся сцена відраховується від неї. */
export const PORTAL_GROUND_Y = CRYSTAL_GROUND_BASELINE;

/**
 * Скільки draw call'ів додає оточення. Приймальний тест перевіряє, що
 * кристал лишається збатчений (draw call'и ≈ кількість матеріалів, а не
 * тіл), тож він мусить знати внесок сцени — інакше довелось би просто
 * послабити межу й перевірка втратила б сенс.
 *
 * Земля + подіум + ритуальна плита + тріщини + інкрустація + колони (один
 * InstancedMesh на всі три пари) + зорі.
 */
export const PORTAL_ENVIRONMENT_DRAW_CALLS = 7;

/**
 * Скільки трикутників додає оточення. Той самий привід, що й у draw
 * call'ах: приймальний тест звіряє намальовані трикутники з бюджетом
 * геометрії кристала, і без цього числа сцена мовчки з'їла б перевірку.
 *
 * Значення прибите свідомо — рахувати його в рантаймі означало б
 * будувати геометрію двічі. За тим, щоб воно не розійшлось із реальними
 * буферами, стежить portalScene.test.ts.
 */
export const PORTAL_ENVIRONMENT_TRIANGLES = 2434;

/** Сегментів у диску поля; єдине місце, що задає його вартість. */
const FIELD_SEGMENTS = 64;

/** Реальна вартість оточення — джерело правди для константи вище. */
export function measurePortalEnvironmentTriangles(seed = 1): number {
  const dais = buildPortalDaisGeometry();
  const inlay = buildPortalInlayGeometry(seed);
  const pillar = buildPortalPillarGeometry();
  const slab = buildPortalRitualSlabGeometry(seed);
  const cracks = buildPortalGroundCrackGeometry(seed);
  const triangles = (geometry: THREE.BufferGeometry): number => {
    const index = geometry.getIndex();
    return index === null
      ? geometry.getAttribute('position').count / 3
      : index.count / 3;
  };

  const total = FIELD_SEGMENTS
    + triangles(dais)
    + triangles(inlay)
    + triangles(slab)
    + triangles(cracks)
    + triangles(pillar) * PORTAL_PILLARS.length * 2;

  dais.dispose();
  inlay.dispose();
  pillar.dispose();
  slab.dispose();
  cracks.dispose();
  return total;
}

const FOV = 42;
const DEG = Math.PI / 180;

/**
 * Скільки світових одиниць мусить бути видно. Висота — головна: вона
 * задає, яку частину екрана займає кристал (зрілий — близько половини).
 * Ширина рятує вузькі екрани: на вертикальному телефоні кадр по висоті
 * не гарантує, що друза влізе вшир, і камера відходить.
 *
 * Підтягнуто після зниження кривої монарха (ADR-0004): артефакт став
 * нижчим, тож камера мусить підійти ближче, інакше він губиться в кадрі.
 */
const FIT_HEIGHT = 5.2;
const FIT_WIDTH = 2.3;

/** Запас між крайнім кристалом і краєм кадру. */
const FRAME_MARGIN = 1.08;

/** Камера над площиною підлоги. Дає кут ≈17° — підлога читається як
 *  поверхня, що йде вглиб, а не як лінія. */
const EYE_ABOVE_GROUND = 2.25;
/** Куди дивиться камера: трохи нижче середини кристала, щоб над ним
 *  лишалось небо, а під ним — подіум. */
const TARGET_ABOVE_GROUND = 1.25;

export interface PortalCameraFrame {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
  fov: number;
  /** Відстань від камери до точки прицілу. */
  distance: number;
  fogNear: number;
  fogFar: number;
}

function halfHeightTangent(): number {
  return Math.tan((FOV / 2) * DEG);
}

/**
 * Половина видимої ширини на заданій глибині. Колони спираються саме на
 * це: у 3D їх не можна прибити до краю кадру, як CSS-шар, — на широкому
 * екрані фіксовані позиції з'їхали б до центру й затиснули кристал.
 */
export function portalHalfWidthAt(depth: number, aspect: number): number {
  return depth * halfHeightTangent() * Math.max(aspect, 0.1);
}

/**
 * Кадр камери під конкретний артефакт.
 *
 * `artifactRadius` — це те, скільки місця вшир займають самі кристали в
 * одиницях сцени (`crystalSceneRadius(..., { includeSubstrate: false })`).
 * Камінь і подіум сюди не входять свідомо: це підлога, їй нормально
 * виходити за кадр, а от зрізаний кристал — це втрачений рік пари.
 *
 * Без цього аргументу ширина кадру була константою FIT_WIDTH = 2.3, тобто
 * півширина 1.15. Виміряно на справжньому пайплайні: кристали доростають
 * до 1.5 на десятому році — тобто зовнішні річні кристали десятирічної
 * пари просто зрізались краєм екрана на вертикальному телефоні.
 */
export function portalCameraFrame(aspect: number, artifactRadius = 0): PortalCameraFrame {
  const tangent = halfHeightTangent();
  // Аспект приходить із viewport'а; на нульовій висоті контейнера він
  // вироджується, тож тримаємо його в межах реальних екранів.
  const safeAspect = Math.min(Math.max(Number.isFinite(aspect) ? aspect : 1, 0.3), 3.2);
  const safeRadius = Number.isFinite(artifactRadius) ? Math.max(0, artifactRadius) : 0;
  const width = Math.max(FIT_WIDTH, safeRadius * 2 * FRAME_MARGIN);
  const byHeight = FIT_HEIGHT / (2 * tangent);
  const byWidth = width / (2 * tangent * safeAspect);
  const distance = Math.max(byHeight, byWidth);

  const eyeY = PORTAL_GROUND_Y + EYE_ABOVE_GROUND;
  const targetY = PORTAL_GROUND_Y + TARGET_ABOVE_GROUND;
  // Камера трохи вище за ціль, тож пряма відстань більша за z-виніс.
  const rise = eyeY - targetY;
  const z = Math.sqrt(Math.max(0, distance * distance - rise * rise));

  return {
    position: [0, eyeY, z],
    target: [0, targetY, 0],
    fov: FOV,
    distance,
    // Туман починається одразу за артефактом: він мусить з'їдати далеку
    // підлогу й задні колони, але не мити сам кристал.
    fogNear: distance * 0.96,
    fogFar: distance + 26,
  };
}

// ── Подіум ──────────────────────────────────────────────────
// Профіль обертання, y відраховується від PORTAL_GROUND_Y. Верхня
// площина — рівно 0: саме на ній стоїть субстрат кристала, і будь-яке
// відхилення або підвісило б його в повітрі, або втопило.
const DAIS_PROFILE: readonly (readonly [number, number])[] = [
  [0, -0.62],
  [1.9, -0.62],
  [1.9, -0.44],
  [1.66, -0.44],
  [1.66, -0.26],
  [1.44, -0.26],
  [1.44, -0.1],
  [1.3, -0.1],
  [1.3, 0],
  [0, 0],
];

/** Радіус верхньої площини подіуму в базовій геометрії. */
export const PORTAL_DAIS_TOP_RADIUS = 1.3;

/**
 * Наскільки подіум має бути ширшим за камінь друзи.
 *
 * Було 1.16 — рівно стільки, щоб золота інкрустація лишалась видимою. Тепер
 * ширше, бо між каменем і обводом має вміститись ритуальна плита, яку кристал
 * пробив, коли ріс: при 1.16 на неї лишалось 14% радіуса, тобто смужка, у якій
 * не видно ні тріщин, ні уламків.
 */
const DAIS_CLEARANCE = 1.34;

/**
 * Стеля масштабу подіуму — її задають колони.
 *
 * Колони стоять на полі, а не на подіумі. Найближча пара на найвужчому
 * реальному кадрі відходить від осі на ≈2.99 (z = -2.6 плюс виніс по x).
 * На висоті, де вони стоять (-PORTAL_FIELD_DROP), радіус подіуму — 1.66
 * базової геометрії, тож 1.66 × 1.75 = 2.91 < 2.99: цоколі лишаються
 * зовні.
 *
 * Ціна стелі чесна й обмежена: приблизно після п'ятнадцяти років друза
 * доростає до краю подіуму й далі камінь торкається обводу замість того,
 * щоб лишати запас. Це помітно менша вада, ніж колона, що пробиває плиту.
 */
const DAIS_MAX_SCALE = 1.75;

/**
 * Масштаб подіуму під конкретний артефакт.
 *
 * Подіум був константою, і це трималось рівно доти, доки всі друзи були
 * дрібні. Але друза росте з роками, а камінь під нею — ще й з місцями, де
 * пара була (ADR-0004): пара з двадцятьма шістьма містами вже стояла на
 * плиті, вужчій за власний камінь, і золота інкрустація зникала під ним.
 *
 * Тільки збільшує: подіум, менший за спроєктований, зробив би сцену
 * тіснішою, ніж її кадрувала камера.
 */
export function portalDaisScale(artifactSceneRadius: number): number {
  const radius = Number.isFinite(artifactSceneRadius) ? Math.max(0, artifactSceneRadius) : 0;
  const needed = (radius * DAIS_CLEARANCE) / PORTAL_DAIS_TOP_RADIUS;
  return Math.min(DAIS_MAX_SCALE, Math.max(1, Number(needed.toFixed(4))));
}
/** Наскільки навколишнє поле нижче за верх подіуму. */
export const PORTAL_FIELD_DROP = 0.3;

export function buildPortalDaisGeometry(): THREE.LatheGeometry {
  const points = DAIS_PROFILE.map(([radius, y]) => new THREE.Vector2(radius, y));
  const geometry = new THREE.LatheGeometry(points, 64);
  geometry.computeVertexNormals();
  return geometry;
}

// ── Ритуальна плита ─────────────────────────────────────────
// Кристал не поставлений на подіум — він проріс крізь нього. Плита лежить
// на верхній площині, її внутрішній обвід розламаний і піднятий там, де
// камінь пішов угору, від пролому по каменю розходяться тріщини, а сама
// плита вигнута там, де тріснула.

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Внутрішній обвід плити — рівно там, де стоїть камінь друзи.
 *
 * Спочатку тут було на 4% менше, «щоб не було щілини», і через це весь
 * розламаний обвід разом із піднятою губою ховався під каменем: пролом
 * будувався й не було його видно. Розкид нижче лишає частину сегментів під
 * каменем, а частину — назовні, і саме ці й читаються як уламки.
 */
const SLAB_INNER = round4(PORTAL_DAIS_TOP_RADIUS / DAIS_CLEARANCE);

/**
 * Де підважений злам сходить нанівець.
 *
 * Уламок піднімається вузькою губою просто біля пролому, а не через усю
 * плиту. Перша версія нахиляла всю верхню площину від внутрішнього обводу до
 * зовнішнього, і піднята частина накривала золоту інкрустацію — та виходила
 * пунктиром там, де сегмент був піднятий, і суцільною там, де ні.
 */
const SLAB_LIP = 0.075;
/** Зовнішній — трохи всередині обводу подіуму, щоб фаска подіуму лишалась видною. */
const SLAB_OUTER = 1.27;
const SLAB_THICKNESS = 0.075;
const SLAB_SEGMENTS = 30;
/** Частка сегментів, яку кристал підважив угору. */
const SLAB_HEAVED_SHARE = 0.38;

/** Скільки тріщин розходиться від пролому. */
const CRACK_COUNT = 9;

/**
 * Напрямки тріщин. Спільні для тріщин і для плити: плита має вигинатись саме
 * там, де вона тріснула, тож обидва будівники мусять читати одні й ті самі
 * кути, а не два незалежні випадкові потоки.
 */
export function portalCrackAngles(seed: number): number[] {
  const random = mulberry32(seed ^ 0x0c2ac);
  return Array.from(
    { length: CRACK_COUNT },
    (_, index) => (index / CRACK_COUNT) * Math.PI * 2 + (random() - 0.5) * 0.35,
  );
}

/** Найменша кутова відстань між двома напрямками. */
function angularGap(left: number, right: number): number {
  const tau = Math.PI * 2;
  const raw = Math.abs(((left - right) % tau + tau) % tau);
  return Math.min(raw, tau - raw);
}

/** Наскільки плита піднімається просто над тріщиною. */
const SLAB_SWELL = 0.055;
/** Кутова ширина вигину; ширше — і вигини зіллються в купол. */
const SLAB_SWELL_SPREAD = 0.42;

/**
 * Підйом плити на заданому напрямку.
 *
 * Плита не просто розколота — її вигнуло тим, що йшло знизу. Вигин
 * найсильніший на самій тріщині й згасає вбік, тож між тріщинами камінь
 * лишається пласким і злам читається як злам, а не як брижі.
 */
function slabSwell(angle: number, cracks: readonly number[]): number {
  let swell = 0;
  for (const crack of cracks) {
    const gap = angularGap(angle, crack) / SLAB_SWELL_SPREAD;
    swell += SLAB_SWELL * Math.exp(-gap * gap);
  }
  return Math.min(SLAB_SWELL * 1.6, swell);
}

/**
 * Висота поверхні плити в точці.
 *
 * Одна функція на всіх, хто на плиті лежить: сама плита, тріщини й золота
 * інкрустація. Інкрустація спершу була пласким кільцем на сталій висоті — і
 * щойно плиту вигнуло, вигин її накрив, тобто золото зникло. Інкрустація
 * вкладена *в* камінь, тож вона мусить вигинатись разом із ним.
 */
export function portalSlabSurfaceY(angle: number, radius: number, seed: number): number {
  return slabSurfaceY(angle, radius, portalCrackAngles(seed));
}

/** Наскільки інкрустація підведена над каменем плити. */
export const PORTAL_INLAY_CLEARANCE = 0.005;

function slabSurfaceY(angle: number, radius: number, cracks: readonly number[]): number {
  const lip = SLAB_INNER + SLAB_LIP;
  const span = Math.max(1e-6, SLAB_OUTER - lip);
  const along = Math.max(0, Math.min(1, (radius - lip) / span));
  // Сила прийшла зсередини, тож на обводі від вигину лишається третина.
  return SLAB_THICKNESS + slabSwell(angle, cracks) * (1 - along * 0.7);
}

interface SlabRim {
  innerRadius: number;
  lift: number;
}

function slabRim(seed: number): SlabRim[] {
  const random = mulberry32(seed ^ 0x51ab);
  const rim: SlabRim[] = [];
  for (let index = 0; index < SLAB_SEGMENTS; index += 1) {
    // Розлам нерівний, але не рваний: плита має лишитись плитою.
    const inner = SLAB_INNER + (random() - 0.5) * 0.09;
    const heaved = random() < SLAB_HEAVED_SHARE;
    rim.push({ innerRadius: inner, lift: heaved ? 0.018 + random() * 0.05 : 0 });
  }
  return rim;
}

/**
 * Плита як суцільне тіло: верхня площина, внутрішній зріз розлому і
 * зовнішній обвід. Не індексована — сусідні уламки підняті по-різному, і
 * спільні вершини усереднили б нормалі саме там, де має бути ребро злому.
 */
export function buildPortalRitualSlabGeometry(seed: number): THREE.BufferGeometry {
  const rim = slabRim(seed);
  const cracks = portalCrackAngles(seed);
  const positions: number[] = [];
  const push = (x: number, y: number, z: number): void => {
    positions.push(x, y, z);
  };
  const triangle = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ): void => {
    push(a[0], a[1], a[2]);
    push(b[0], b[1], b[2]);
    push(c[0], c[1], c[2]);
  };

  for (let index = 0; index < SLAB_SEGMENTS; index += 1) {
    const next = (index + 1) % SLAB_SEGMENTS;
    const a0 = (index / SLAB_SEGMENTS) * Math.PI * 2;
    const a1 = (next / SLAB_SEGMENTS) * Math.PI * 2;
    const here = rim[index]!;
    const there = rim[next]!;
    const lipHere = here.innerRadius + SLAB_LIP;
    const lipThere = there.innerRadius + SLAB_LIP;
    const topHere = SLAB_THICKNESS + here.lift + slabSwell(a0, cracks);
    const topThere = SLAB_THICKNESS + there.lift + slabSwell(a1, cracks);
    const midHereY = slabSurfaceY(a0, lipHere, cracks);
    const midThereY = slabSurfaceY(a1, lipThere, cracks);
    const outHereY = slabSurfaceY(a0, SLAB_OUTER, cracks);
    const outThereY = slabSurfaceY(a1, SLAB_OUTER, cracks);

    const inHere: readonly [number, number, number] = [Math.sin(a0) * here.innerRadius, topHere, Math.cos(a0) * here.innerRadius];
    const inThere: readonly [number, number, number] = [Math.sin(a1) * there.innerRadius, topThere, Math.cos(a1) * there.innerRadius];
    const midHere: readonly [number, number, number] = [Math.sin(a0) * lipHere, midHereY, Math.cos(a0) * lipHere];
    const midThere: readonly [number, number, number] = [Math.sin(a1) * lipThere, midThereY, Math.cos(a1) * lipThere];
    const outHere: readonly [number, number, number] = [Math.sin(a0) * SLAB_OUTER, outHereY, Math.cos(a0) * SLAB_OUTER];
    const outThere: readonly [number, number, number] = [Math.sin(a1) * SLAB_OUTER, outThereY, Math.cos(a1) * SLAB_OUTER];

    // Піднята губа біля пролому — вона одна й нахилена.
    triangle(inHere, midHere, inThere);
    triangle(inThere, midHere, midThere);
    // Решта плити вигинається разом із тріщинами, але вже полого.
    triangle(midHere, outHere, midThere);
    triangle(midThere, outHere, outThere);

    // Зріз розлому, повернутий до кристала: саме він читається як товщина
    // каменю, крізь який кристал пройшов.
    const inHereFloor: readonly [number, number, number] = [inHere[0], 0, inHere[2]];
    const inThereFloor: readonly [number, number, number] = [inThere[0], 0, inThere[2]];
    triangle(inHere, inThere, inHereFloor);
    triangle(inThere, inThereFloor, inHereFloor);

    // Зовнішній обвід.
    const outHereFloor: readonly [number, number, number] = [outHere[0], 0, outHere[2]];
    const outThereFloor: readonly [number, number, number] = [outThere[0], 0, outThere[2]];
    triangle(outHere, outHereFloor, outThere);
    triangle(outThere, outHereFloor, outThereFloor);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Тріщини лежать *на* плиті. Спершу вони були на 0.006 від підлоги подіуму,
 * тобто на сім сотих нижче за верх плити — тобто всередині каменю, і на екрані
 * їх не було взагалі.
 */
const CRACK_CLEARANCE = PORTAL_INLAY_CLEARANCE;

/**
 * Тріщини від пролому назовні. Кожна звужується до нуля, тож вона згасає
 * сама, а не впирається в обвід плити.
 */
export function buildPortalGroundCrackGeometry(seed: number): THREE.BufferGeometry {
  const random = mulberry32(seed ^ 0x51de);
  const cracks = portalCrackAngles(seed);
  const positions: number[] = [];
  const strand = (angle: number, from: number, to: number, width: number): void => {
    const drift = (random() - 0.5) * 0.22;
    const tip = angle + drift;
    const sx = Math.sin(angle);
    const cz = Math.cos(angle);
    const tx = Math.sin(tip);
    const tz = Math.cos(tip);
    const px = cz * width;
    const pz = -sx * width;
    const baseY = slabSurfaceY(angle, from, cracks) + CRACK_CLEARANCE;
    const tipY = slabSurfaceY(tip, to, cracks) + CRACK_CLEARANCE;
    // Намотка проти годинникової, якщо дивитись згори. Спершу тут був
    // зворотний порядок, нормаль показувала вниз, і backface culling викидав
    // кожну тріщину — на екрані їх не було взагалі, хоча геометрія будувалась.
    positions.push(
      sx * from + px, baseY, cz * from + pz,
      sx * from - px, baseY, cz * from - pz,
      tx * to, tipY, tz * to,
    );
  };

  for (const angle of cracks) {
    // Починаються там, де сходить нанівець піднята губа: під нею тріщину все
    // одно не було б видно.
    const from = SLAB_INNER + SLAB_LIP;
    const reach = from + (0.3 + random() * 0.6) * (SLAB_OUTER - from);
    // Ширина в одиницях геометрії подіуму: тонша за це — і на телефоні від
    // тріщини лишається пара пікселів, тобто нічого.
    strand(angle, from, reach, 0.042 + random() * 0.03);
    // Кожна тріщина роздвоюється — камінь рідко тріскає однією лінією. Гілка
    // є завжди, а не за кидком: інакше вартість оточення залежала б від
    // насіння пари, а PORTAL_ENVIRONMENT_TRIANGLES — константа бюджету.
    // Коротка гілка просто не читається, і це і є «без роздвоєння».
    const branch = 0.12 + random() * 0.72;
    strand(angle + (random() - 0.5) * 0.5, from + 0.02, from + (reach - from) * branch, 0.028);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Золоті кільця по обводу верхньої площини. Два кільця одним buffer'ом —
 * інкрустація не варта другого draw call'а.
 */
export function buildPortalInlayGeometry(seed: number): THREE.BufferGeometry {
  const cracks = portalCrackAngles(seed);
  // Обидва кільця лежать поза зоною зламу (SLAB_INNER + SLAB_LIP = 1.045) і
  // повторюють вигин плити — інакше вигин їх накриває, і золото зникає рівно
  // на гребенях, де воно найпомітніше.
  const bands: readonly (readonly [number, number])[] = [[1.075, 1.115], [1.16, 1.19]];
  const segments = 96;
  const positions: number[] = [];
  const point = (angle: number, radius: number): readonly [number, number, number] => [
    Math.sin(angle) * radius,
    slabSurfaceY(angle, radius, cracks) + CRACK_CLEARANCE,
    Math.cos(angle) * radius,
  ];

  for (const [innerRadius, outerRadius] of bands) {
    for (let index = 0; index < segments; index += 1) {
      const a0 = (index / segments) * Math.PI * 2;
      const a1 = ((index + 1) / segments) * Math.PI * 2;
      const i0 = point(a0, innerRadius);
      const i1 = point(a1, innerRadius);
      const o0 = point(a0, outerRadius);
      const o1 = point(a1, outerRadius);
      positions.push(
        i0[0], i0[1], i0[2], o0[0], o0[1], o0[2], i1[0], i1[1], i1[2],
        i1[0], i1[1], i1[2], o0[0], o0[1], o0[2], o1[0], o1[1], o1[2],
      );
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

// ── Колони ──────────────────────────────────────────────────

export interface PortalPillarPlacement {
  /** Глибина за площиною артефакта (від'ємна = вглиб кадру). */
  z: number;
  /**
   * Частка півширини кадру, на якій стоїть **внутрішня грань** колони:
   * 1 = грань точно на краю кадру.
   *
   * Саме грань, а не вісь. Для далеких колон різниця мізерна — їхній радіус
   * малий проти півширини кадру на тій глибині. Для колони перед артефактом
   * вона вирішальна: при радіусі 0.5 і півширині 0.52 колона, поставлена
   * віссю на край, закриває половину екрана.
   */
  edgeFraction: number;
  height: number;
  radius: number;
}

/**
 * Три пари, і третя — перед артефактом.
 *
 * Дві задні пари давали глибину, але кристал стояв *перед* колонадою, як
 * перед декорацією. Святилище — це зала, а не тло: пара попереду замикає
 * простір із протилежного боку, і глядач опиняється всередині, а не навпроти.
 *
 * Передня пара навмисно стоїть далеко вбік і близько до камери — вона
 * підрізається краєм кадру, і саме підрізана колона читається як «камера
 * всередині зали». Обмеження, яке її тримає: у проєкції на екран вона мусить
 * лишатись за межами артефакта, інакше замість обрамлення вийде затулянка.
 * За цим стежить portalScene.test.ts.
 */
export const PORTAL_PILLARS: readonly PortalPillarPlacement[] = [
  { z: 3.6, edgeFraction: 1.04, height: 6.2, radius: 0.5 },
  { z: -2.6, edgeFraction: 0.94, height: 5.2, radius: 0.42 },
  { z: -7.4, edgeFraction: 0.86, height: 6.4, radius: 0.5 },
];

export interface PortalPillarInstance {
  position: readonly [number, number, number];
  /** Множник до базової геометрії висотою 1 і радіусом 1. */
  scale: readonly [number, number, number];
  rotationY: number;
}

/**
 * Розкладка колон для конкретного кадру. Камера дивиться вздовж -Z, тож
 * глибина колони — це distance + |z|.
 */
export function portalPillarInstances(
  frame: PortalCameraFrame,
  aspect: number,
): PortalPillarInstance[] {
  const instances: PortalPillarInstance[] = [];
  for (let index = 0; index < PORTAL_PILLARS.length; index += 1) {
    const placement = PORTAL_PILLARS[index]!;
    // Камера дивиться вздовж -Z, тож глибина точки — це відстань камери мінус
    // її z. Раніше тут стояв `+ Math.abs(z)`, що збігається з правильною
    // формулою рівно для колон позаду; для колони перед артефактом воно дало б
    // глибину більшу замість меншої, і вона поїхала б до центру кадру — просто
    // поперек кристала.
    const depth = Math.max(0.1, frame.distance - placement.z);
    const x = portalHalfWidthAt(depth, aspect) * placement.edgeFraction + placement.radius;
    for (const side of [-1, 1]) {
      instances.push({
        position: [x * side, PORTAL_GROUND_Y - PORTAL_FIELD_DROP, placement.z],
        scale: [placement.radius, placement.height, placement.radius],
        // Розвертаємо грані так, щоб дві колони пари не були дзеркальними
        // копіями кадр-у-кадр — інакше пара читається як декаль.
        rotationY: side > 0 ? Math.PI / 8 : -Math.PI / 5,
      });
    }
  }
  return instances;
}

/**
 * Колона висотою 1 і найбільшим радіусом 1 з цоколем і капітеллю — усе
 * одним buffer'ом, щоб чотири колони пішли одним InstancedMesh.
 * Нормалізація потрібна, щоб `radius` у PORTAL_PILLARS означав саме
 * габарит колони, а не радіус якоїсь її частини.
 */
export function buildPortalPillarGeometry(): THREE.BufferGeometry {
  const plinth = new THREE.CylinderGeometry(0.88, 1, 0.06, 8, 1);
  plinth.translate(0, 0.03, 0);
  const shaft = new THREE.CylinderGeometry(0.55, 0.67, 0.88, 8, 1);
  shaft.translate(0, 0.5, 0);
  const capital = new THREE.CylinderGeometry(0.83, 0.6, 0.06, 8, 1);
  capital.translate(0, 0.97, 0);

  const merged = mergeGeometries([plinth, shaft, capital]);
  plinth.dispose();
  shaft.dispose();
  capital.dispose();
  if (merged === null) throw new Error('Portal pillar geometry could not be merged.');
  merged.computeVertexNormals();
  return merged;
}

// ── Зорі ────────────────────────────────────────────────────

export interface PortalStarField {
  positions: Float32Array;
  colors: Float32Array;
  count: number;
}

const STAR_SHELL_RADIUS = 34;

/**
 * Зорі на сферичній оболонці, лише над горизонтом. Насіння — artifactSeed
 * пари: небо в кожної пари своє, але однакове при кожному відкритті.
 */
export function buildPortalStarField(seed: number, count: number): PortalStarField {
  const random = mulberry32(seed ^ 0x5f37);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const azimuth = random() * Math.PI * 2;
    // Зміщення в бік зеніту: біля горизонту зорі майже не видно крізь
    // туман, і рівномірний розподіл витратив би на них половину поля.
    const elevation = Math.asin(0.06 + random() * 0.94);
    const radius = STAR_SHELL_RADIUS * (0.86 + random() * 0.14);
    positions[index * 3] = Math.cos(elevation) * Math.cos(azimuth) * radius;
    positions[index * 3 + 1] = Math.sin(elevation) * radius;
    positions[index * 3 + 2] = Math.cos(elevation) * Math.sin(azimuth) * radius;

    // Розкид яскравості важливіший за кількість: рівні зорі читаються як
    // шум, нерівні — як глибина.
    const brightness = 0.24 + random() * 0.76;
    const warmth = random();
    colors[index * 3] = brightness;
    colors[index * 3 + 1] = brightness * (0.9 + warmth * 0.1);
    colors[index * 3 + 2] = brightness * (0.94 + (1 - warmth) * 0.06);
  }

  return { positions, colors, count };
}

// ── Палітра ─────────────────────────────────────────────────

export interface PortalPalette {
  fog: string;
  field: string;
  dais: string;
  daisEmissive: string;
  /** Ритуальна плита — той самий камінь, що подіум, але світліший на зламі. */
  slab: string;
  /** Ґрунт, видний у розколі. Тепліший за камінь — це земля, а не порожнеча. */
  crack: string;
  crackGlow: string;
  inlay: string;
  pillar: string;
  starOpacity: number;
  daisLight: string;
  daisLightIntensity: number;
}

/**
 * Портал — нічна сцена в обох темах: це декорація, всередині якої
 * світиться артефакт, а не «темний режим». Світла тема лише тепліша.
 * Ті самі ролі, що й у --portal-* токенах CSS, тільки для WebGL.
 */
export const PORTAL_PALETTES: Record<'light' | 'dark', PortalPalette> = {
  light: {
    fog: '#3b2b57',
    field: '#2e2244',
    dais: '#6d5f8a',
    daisEmissive: '#20182f',
    slab: '#8073a4',
    crack: '#3d2c31',
    crackGlow: '#b487e4',
    inlay: '#e2be80',
    pillar: '#6a5c8f',
    starOpacity: 0.85,
    daisLight: '#d7b7f2',
    daisLightIntensity: 2.6,
  },
  dark: {
    fog: '#221a33',
    field: '#1b1428',
    dais: '#544a6d',
    daisEmissive: '#161022',
    slab: '#645887',
    crack: '#281c20',
    crackGlow: '#9068c4',
    inlay: '#cea86e',
    pillar: '#4b4070',
    starOpacity: 1,
    daisLight: '#b891dd',
    daisLightIntensity: 2.2,
  },
};
