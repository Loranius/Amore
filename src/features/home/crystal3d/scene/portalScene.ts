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
import { buildPortalPlatformGeometry } from './portalPlatformMesh';

/** Площина, на якій стоїть артефакт; уся сцена відраховується від неї. */
export const PORTAL_GROUND_Y = CRYSTAL_GROUND_BASELINE;

/**
 * Скільки draw call'ів додає оточення. Приймальний тест перевіряє, що
 * кристал лишається збатчений (draw call'и ≈ кількість матеріалів, а не
 * тіл), тож він мусить знати внесок сцени — інакше довелось би просто
 * послабити межу й перевірка втратила б сенс.
 *
 * Поле + підлога храму + подіум + кам'яна платформа + руни + інкрустація +
 * колони (один InstancedMesh на всі три пари) + вогні на колонах (так само
 * один) + арки (так само один) + зорі.
 */
export const PORTAL_ENVIRONMENT_DRAW_CALLS = 10;

/**
 * Скільки трикутників додає оточення. Той самий привід, що й у draw
 * call'ах: приймальний тест звіряє намальовані трикутники з бюджетом
 * геометрії кристала, і без цього числа сцена мовчки з'їла б перевірку.
 *
 * Значення прибите свідомо — рахувати його в рантаймі означало б
 * будувати геометрію двічі. За тим, щоб воно не розійшлось із реальними
 * буферами, стежить portalScene.test.ts.
 */
export const PORTAL_ENVIRONMENT_TRIANGLES = 3091;

/** Сегментів у диску поля; єдине місце, що задає його вартість. */
const FIELD_SEGMENTS = 64;

/**
 * Реальна вартість оточення — джерело правди для константи вище.
 *
 * Напрямки жили на вартість не впливають: вони зсувають вершини, але не
 * додають і не прибирають жодного трикутника. Саме тому константа лишається
 * однією на всі пари.
 */
export function measurePortalEnvironmentTriangles(
  seed = 1,
  bearings: readonly number[] = [],
  veinReach = 0,
): number {
  // Сцена малює модельований постамент, а не латку — бюджет мусить рахувати
  // те, що справді малюється.
  const dais = buildPortalPlatformGeometry();
  const inlay = buildPortalInlayGeometry(seed, bearings, veinReach);
  const pillar = buildPortalPillarGeometry();
  const lamp = buildPortalLampGeometry();
  const arch = buildPortalArchGeometry();
  const floor = buildPortalTempleFloorGeometry(seed);
  const slab = buildPortalRitualSlabGeometry(seed, bearings, veinReach);
  const runes = buildPortalRuneGeometry(seed, bearings, veinReach);
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
    + triangles(runes)
    + triangles(pillar) * PORTAL_PILLARS.length * 2
    + triangles(lamp) * PORTAL_PILLARS.length * 2
    // One arch per pair standing behind the artifact, not per pillar.
    + triangles(arch) * PORTAL_PILLARS.filter((pillar) => pillar.z <= -1).length
    + triangles(floor);

  dais.dispose();
  inlay.dispose();
  pillar.dispose();
  lamp.dispose();
  arch.dispose();
  floor.dispose();
  slab.dispose();
  runes.dispose();
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
// Профіль обертання, y відраховується від PORTAL_GROUND_Y. Верхня площина
// подіуму втоплена рівно на товщину кам'яної плити, бо плита лежить у цій
// заглибині — а от ЇЇ верхня грань уже точно на нулі, тобто на площині, на
// якій рушій ставить кристали. Будь-яке відхилення або підвісило б жилу в
// повітрі, або втопило її в камені (2026-08-03: саме друге й було).

/** Товщина кам'яної плити платформи. */
const SLAB_THICKNESS = 0.075;

const DAIS_PROFILE: readonly (readonly [number, number])[] = [
  [0, -0.62],
  [1.9, -0.62],
  [1.9, -0.44],
  [1.66, -0.44],
  [1.66, -0.26],
  [1.44, -0.26],
  [1.44, -0.1],
  [1.3, -0.1],
  // Recessed by exactly the platform's thickness. The stone slab lies in this
  // recess, so it is the *slab's* top face that lands on 0 — see SLAB_TOP.
  [1.3, -SLAB_THICKNESS],
  [0, -SLAB_THICKNESS],
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
 * Колони стоять на полі, а не на подіумі. Обмежує **передня** пара, і це не
 * очевидно: вона дзеркальна задній по z, але стоїть ближче до камери, тож
 * півширина кадру на її глибині менша й у світових координатах вона ближча до
 * осі. На найвужчому реальному кадрі вона відходить від осі на ≈2.81 проти
 * ≈2.99 у задньої.
 *
 * На висоті, де стоять цоколі (-PORTAL_FIELD_DROP), радіус подіуму — 1.66
 * базової геометрії, тож 1.66 × 1.66 = 2.76 < 2.81: цоколі лишаються зовні.
 *
 * Ціна стелі чесна й обмежена: приблизно після п'ятнадцяти років друза
 * доростає до краю подіуму й далі камінь торкається обводу замість того,
 * щоб лишати запас. Це помітно менша вада, ніж колона, що пробиває плиту.
 */
const DAIS_MAX_SCALE = 1.66;

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

// ── Кам'яна платформа ───────────────────────────────────────
// Суцільна верхня поверхня подіуму. Кристали ростуть просто з неї — крізь
// кварцову жилу, яку публікує рушій (engine/geometry/substrate.ts), — а
// камінь навколо вигинається рівно там, де під ним іде жила.
//
// Тут була ритуальна плита-кільце з розламаним внутрішнім обводом: усередині
// того обводу поверхня провалювалась на товщину плити, і під друзою виходило
// кругле заглиблення. Огляд (2026-08-03) відхилив його — тепер обводу немає
// зовсім, а пролом у камені є лише один, і це сама жила.

/** Зовнішній — трохи всередині обводу подіуму, щоб фаска подіуму лишалась видною. */
const SLAB_OUTER = 1.27;
const SLAB_SEGMENTS = 36;

/**
 * Верхня грань каменю — рівно площина артефакта.
 *
 * Це був справжній баг, і виміряний. Плита лежала **поверх** тієї самої
 * площини, на якій рушій ставить кристали, тобто камінь стояв на 0.075 вище за
 * основи кристалів і за кварцову жилу. Жила підіймається над площиною лише на
 * 0.024 в одиницях сцени, тож вона була похована під платформою з будь-якого
 * кута — а кристали виглядали зрізаними біля основи й підвішеними.
 *
 * Тепер плита втоплена в подіум: її низ на `-SLAB_THICKNESS`, верх на нулі.
 * Ту саму глибину вибрано в профілі подіуму, тож видима товщина каменю не
 * змінилась — змінилось лише те, від чого вона відраховується.
 */
const SLAB_TOP = 0;

/**
 * Скільки напрямків жили платформа підхоплює, якщо їх передали.
 *
 * Стримано: жила має 2–3 головні гілки, і камінь мусить читатись як їхнє
 * продовження, а не як власна система розломів. Раніше тут було дев'ять
 * рівномірних напрямків від власного насіння — саме та друга система.
 */
const CRACK_COUNT = 3;

/**
 * Напрямки, у яких камінь платформи піднято.
 *
 * Перший аргумент — насіння артефакта, другий — напрямки гілок кварцової жили
 * з опублікованого профілю субстрату. Коли вони є, камінь іде за ними: жила
 * розсунула його зсередини, тож будь-який інший напрямок був би розломом
 * нізвідки. Насіннєвий запас лишається для випадків, коли профіль старий і
 * напрямків у ньому немає, — тоді краще стриманий вигин, ніж пласка плита.
 */
export function portalCrackAngles(seed: number, bearings: readonly number[] = []): number[] {
  const fromVein = bearings.filter(Number.isFinite).slice(0, CRACK_COUNT);
  if (fromVein.length > 0) return fromVein;
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
 * Профіль вигину вздовж радіуса.
 *
 * Вигин не купол, а гребінь: над самою жилою камінь плаский, підіймається
 * одразу за нею й полого сходить до обводу.
 *
 * Пласка серцевина тут не косметика, і причин дві. При куполі вершина
 * припадала б рівно на вісь, де всі сегменти сходяться в одну точку, і
 * поверхня стала б віялом різнонахилених клинів. А головне — вигин, що
 * починається всередині сліду жили, підіймається **над кварцом** і ховає його:
 * жила стоїть на 0.024 над площиною артефакта, а камінь вигинався до 0.118.
 * Саме тому `veinReach` тут аргумент, а не константа: платформа зобов'язана
 * лишити шов у спокої, хоч би якою широкою була жила в цієї пари.
 */
function slabRidge(radius: number, veinReach: number): number {
  const clear = Math.max(0, Math.min(SLAB_OUTER * 0.75, veinReach));
  const span = Math.max(1e-6, SLAB_OUTER - clear);
  const along = Math.max(0, Math.min(1, (radius - clear) / span));
  const rise = Math.min(1, along / 0.3);
  const eased = rise * rise * (3 - 2 * rise);
  // Сила прийшла зсередини, тож на обводі від вигину лишається третина.
  return eased * (1 - along * 0.7);
}

/**
 * Висота поверхні платформи в точці.
 *
 * Одна функція на всіх, хто на камені лежить: сама платформа, руни й золота
 * інкрустація. Інкрустація спершу була пласким кільцем на сталій висоті — і
 * щойно камінь вигнуло, вигин її накрив, тобто золото зникло. Інкрустація
 * вкладена *в* камінь, тож вона мусить вигинатись разом із ним.
 */
export function portalSlabSurfaceY(
  angle: number,
  radius: number,
  seed: number,
  bearings: readonly number[] = [],
  veinReach = 0,
): number {
  return slabSurfaceY(angle, radius, portalCrackAngles(seed, bearings), veinReach);
}

/** Наскільки інкрустація підведена над каменем плити. */
export const PORTAL_INLAY_CLEARANCE = 0.005;

function slabSurfaceY(
  angle: number,
  radius: number,
  cracks: readonly number[],
  veinReach: number,
): number {
  return SLAB_TOP + slabSwell(angle, cracks) * slabRidge(radius, veinReach);
}

/** Радіуси кілець верхньої площини — від осі до обводу, без жодного розриву. */
const SLAB_RINGS: readonly number[] = [0, 0.18, 0.36, 0.58, 0.8, 1];

/**
 * Платформа як суцільне тіло: верхня площина від осі до обводу і зовнішній
 * бортик. Не індексована — flatShading по гранях і є тим фасетним каменем, що
 * на референсі, а спільні вершини усереднили б нормалі якраз на ребрах.
 *
 * `bearings` — напрямки гілок кварцової жили (профіль субстрату). Камінь
 * піднімається саме над ними.
 */
export function buildPortalRitualSlabGeometry(
  seed: number,
  bearings: readonly number[] = [],
  veinReach = 0,
): THREE.BufferGeometry {
  const cracks = portalCrackAngles(seed, bearings);
  const positions: number[] = [];
  const triangle = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
  ): void => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  };
  const point = (angle: number, radius: number): readonly [number, number, number] => [
    Math.sin(angle) * radius,
    slabSurfaceY(angle, radius, cracks, veinReach),
    Math.cos(angle) * radius,
  ];

  for (let index = 0; index < SLAB_SEGMENTS; index += 1) {
    const a0 = (index / SLAB_SEGMENTS) * Math.PI * 2;
    const a1 = ((index + 1) / SLAB_SEGMENTS) * Math.PI * 2;

    for (let ring = 0; ring < SLAB_RINGS.length - 1; ring += 1) {
      const inner = SLAB_RINGS[ring]! * SLAB_OUTER;
      const outer = SLAB_RINGS[ring + 1]! * SLAB_OUTER;
      const o0 = point(a0, outer);
      const o1 = point(a1, outer);
      if (inner <= 0) {
        // Серцевина: одне віяло на пласкій ділянці, тож усі його трикутники
        // лежать в одній площині й flatShading не робить із них зірки.
        triangle(point(a0, 0), o0, o1);
        continue;
      }
      const i0 = point(a0, inner);
      const i1 = point(a1, inner);
      triangle(i0, o0, i1);
      triangle(i1, o0, o1);
    }

    // Зовнішній бортик — товщина каменю, видима з-під фаски подіуму. Низ
    // тепер у заглибині подіуму, а не на його верхній площині: саме цей зсув
    // і опускає всю плиту так, щоб її верх збігся з площиною артефакта.
    const out0 = point(a0, SLAB_OUTER);
    const out1 = point(a1, SLAB_OUTER);
    const floor0: readonly [number, number, number] = [out0[0], -SLAB_THICKNESS, out0[2]];
    const floor1: readonly [number, number, number] = [out1[0], -SLAB_THICKNESS, out1[2]];
    triangle(out0, floor0, out1);
    triangle(out1, floor0, floor1);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Наскільки різьблення підведене над каменем плити. */
const CRACK_CLEARANCE = PORTAL_INLAY_CLEARANCE;

/** Скільки рун викарбувано на кільці. */
const RUNE_COUNT = 12;
/** Радіус, на якому вони лежать — між середнім і зовнішнім золотими кільцями. */
/** Між першим і другим кільцем — там для них є смуга завширшки 0.07. */
const RUNE_RADIUS = 1.1;
const RUNE_SIZE = 0.05;

/**
 * Рунічні візерунки по кільцю плити.
 *
 * Замінюють радіальні тріщини, які тут були: самі тріщини переїхали в геометрію
 * рушія, де кожен кристал ріже плиту власними, а їхні довжина, ширина й глибина
 * йдуть від його радіуса. Кільце лишилось порожнім, і на референсі саме там
 * стоїть різьблення.
 *
 * Кожна руна — кутник із двох штрихів, як на референсі: рівно стільки форми,
 * щоб читалось як знак, і жодної спроби зобразити алфавіт, якого не існує.
 */
export function buildPortalRuneGeometry(
  seed: number,
  bearings: readonly number[] = [],
  veinReach = 0,
): THREE.BufferGeometry {
  const random = mulberry32(seed ^ 0x2c0de);
  const positions: number[] = [];
  const cracks = portalCrackAngles(seed, bearings);

  const stroke = (
    angle: number,
    radius: number,
    alongTangent: number,
    alongRadial: number,
    thickness: number,
  ): void => {
    const sx = Math.sin(angle);
    const cz = Math.cos(angle);
    // Локальні осі руни: вздовж радіуса й по дотичній.
    const rx = sx;
    const rz = cz;
    const tx = cz;
    const tz = -sx;
    const cx = sx * radius;
    const czz = cz * radius;
    const y = slabSurfaceY(angle, radius, cracks, veinReach) + CRACK_CLEARANCE;
    const half = thickness * 0.5;
    const corner = (u: number, v: number): readonly [number, number, number] => [
      cx + tx * u + rx * v,
      y,
      czz + tz * u + rz * v,
    ];
    const a = corner(-alongTangent * 0.5 - half, -alongRadial * 0.5 - half);
    const b = corner(alongTangent * 0.5 + half, alongRadial * 0.5 - half);
    const c = corner(alongTangent * 0.5 + half, alongRadial * 0.5 + half);
    const d = corner(-alongTangent * 0.5 - half, -alongRadial * 0.5 + half);
    positions.push(
      a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
      a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2],
    );
  };

  for (let index = 0; index < RUNE_COUNT; index += 1) {
    const angle = (index / RUNE_COUNT) * Math.PI * 2;
    const size = RUNE_SIZE * (0.8 + random() * 0.4);
    const flip = random() < 0.5 ? 1 : -1;
    // Кутник: поперечний штрих і радіальний, що виходить з його кінця.
    stroke(angle, RUNE_RADIUS, size * 1.6, 0, size * 0.22);
    stroke(angle + (size * 0.7 * flip) / RUNE_RADIUS, RUNE_RADIUS + size * 0.55, 0, size * 1.1, size * 0.22);
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
export function buildPortalInlayGeometry(
  seed: number,
  bearings: readonly number[] = [],
  veinReach = 0,
): THREE.BufferGeometry {
  const cracks = portalCrackAngles(seed, bearings);
  // Три кільця різного радіуса, як на референсі: вузьке ближче до друзи,
  // широке посередині, вузьке по обводу. Усі лежать далеко за жилою й
  // повторюють вигин каменю — інакше вигин їх накриває, і золото зникає рівно
  // на гребенях, де воно найпомітніше.
  const bands: readonly (readonly [number, number])[] = [
    [1.045, 1.065],
    [1.135, 1.155],
    [1.245, 1.262],
  ];
  const segments = 96;
  const positions: number[] = [];
  const point = (angle: number, radius: number): readonly [number, number, number] => [
    Math.sin(angle) * radius,
    slabSurfaceY(angle, radius, cracks, veinReach) + CRACK_CLEARANCE,
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
 * Три пари, і всі три **позаду** артефакта.
 *
 * Тут колись стояла пара перед кристалом. Задум був у тому, щоб глядач
 * опинявся всередині зали, а не навпроти неї, і як задум він чесний — але
 * колона на передньому плані бореться з кристалом за увагу, а акцент тут
 * рівно один. Ближню пару відсунуто за артефакт, і додано третю, ще дальшу:
 * колонада тепер **відступає в глибину** й читається як тло, яким і має бути.
 *
 * Кожна дальша пара вища, ширша й ближча до осі кадру. Це не декоративний
 * градієнт: перспектива й так зменшує далеке, тож колона тієї самої висоти на
 * подвійній глибині виглядала б удвічі нижчою, і ряд читався б як спадна
 * сходинка замість однакових колон, що йдуть углиб.
 *
 * Обмеження, яке їх тримає: у проєкції на екран жодна не заходить на артефакт,
 * інакше замість обрамлення вийде затулянка. За цим стежить portalScene.test.ts.
 */
export const PORTAL_PILLARS: readonly PortalPillarPlacement[] = [
  { z: -3.2, edgeFraction: 0.94, height: 5.2, radius: 0.42 },
  { z: -7.4, edgeFraction: 0.86, height: 6.4, radius: 0.5 },
  { z: -12.2, edgeFraction: 0.78, height: 7.4, radius: 0.58 },
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

// ── Підлога храму ───────────────────────────────────────────

/** Скільки кілець плит лежить навколо подіуму. */
const FLOOR_RINGS = 6;
/** На скільки секторів поділене кожне кільце. */
const FLOOR_SECTORS = 32;
/** Де підлога починається і де закінчується, у світових одиницях. */
const FLOOR_INNER = 2.1;
const FLOOR_OUTER = 17;
/** Ширина шва між плитами, у частках плити. */
const FLOOR_JOINT = 0.055;

/**
 * Кам'яна підлога, викладена плитами по кільцях навколо подіуму.
 *
 * Досі за подіумом лежав один пласкій диск однієї барви на сорок два юніти —
 * тобто підлоги не було взагалі, була заливка, яку з'їдав туман. Храм читається
 * підлогою так само, як залою його роблять арки: поверхня без розкладки не має
 * ні масштабу, ні напрямку, і око не має чим міряти відстань до колон.
 *
 * Кільцями, а не квадратною сіткою, і це не стилізація. Подіум круглий, друза
 * стоїть на його осі, колони розходяться від неї — уся сцена концентрична, і
 * квадратна плитка внесла б у неї другу, чужу вісь, яку видно рівно там, де
 * вона розходиться з першою.
 *
 * Плити **не змикаються**: між ними лишається шов, крізь який видно темряву
 * під підлогою. Шов і є те, що робить плиту плитою — без нього це суцільна
 * поверхня, розфарбована смугами.
 *
 * Кільця розширюються назовні, бо перспектива стискає далеке: рівні по ширині
 * кільця лягли б на екран усе густішими смугами й читались би як муар.
 */
export function buildPortalTempleFloorGeometry(seed: number): THREE.BufferGeometry {
  const random = mulberry32(seed ^ 0x71a5);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  // Геометрична прогресія від внутрішнього краю до зовнішнього.
  const growth = Math.pow(FLOOR_OUTER / FLOOR_INNER, 1 / FLOOR_RINGS);
  for (let ring = 0; ring < FLOOR_RINGS; ring += 1) {
    const inner = FLOOR_INNER * Math.pow(growth, ring);
    const outer = FLOOR_INNER * Math.pow(growth, ring + 1);
    const jointR = (outer - inner) * FLOOR_JOINT;
    // Дальші кільця дістають менше секторів: плита, вужча за шов, — це шов.
    const sectors = Math.max(8, Math.round(FLOOR_SECTORS / Math.pow(1.28, ring)));
    const step = (Math.PI * 2) / sectors;
    const jointA = step * FLOOR_JOINT;
    // Кожне кільце зсунуте, щоб шви не збиралися в суцільні промені від осі —
    // вони читалися б як тріщини, і то саме там, де ми вже маємо справжні.
    const twist = random() * step;

    for (let sector = 0; sector < sectors; sector += 1) {
      const a0 = twist + sector * step + jointA;
      const a1 = twist + (sector + 1) * step - jointA;
      const r0 = inner + jointR;
      const r1 = outer - jointR;
      const first = positions.length / 3;
      // Плити злегка різняться тоном — камінь, а не друк. Діапазон вузький:
      // підлога мусить лишатись тлом, а строкатість тягне на себе увагу, яка
      // тут належить кристалу.
      const tone = 0.86 + random() * 0.28;
      for (const [angle, radius] of [
        [a0, r0], [a1, r0], [a1, r1], [a0, r1],
      ] as const) {
        positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
        colors.push(tone, tone, tone);
      }
      indices.push(first, first + 2, first + 1, first, first + 3, first + 2);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

// ── Арки ────────────────────────────────────────────────────

/**
 * Скільки сегментів має половина стрілчастої арки.
 *
 * Вісім. Арка — це силует на тлі неба, а не поверхня, яку розглядають: усе, що
 * від неї видно, — це лінія, де темний камінь межує зі світлим прорізом. Далі
 * восьми сегментів додаються трикутники, яких на цій лінії не відрізнити.
 */
const ARCH_SEGMENTS = 8;

/**
 * Наскільки центр кола арки зміщений від осі прорізу, у частках півпрольоту.
 *
 * Це і є те, що робить арку **стрілчастою**, а не півкруглою. Стрілчаста арка —
 * два дуги, чиї центри рознесені: кожна починається вертикально від капітелі й
 * сходиться з іншою під кутом угорі. Нуль дав би римський півциркуль, який на
 * референсі якраз не той — там гострий верх, і саме він тягне око вгору.
 */
const ARCH_POINT = 0.55;

/** Товщина арки вздовж прольоту, у частках півпрольоту. */
const ARCH_THICKNESS = 0.22;
/** Наскільки арка глибша за колону, щоб не читалась як пласка накладка. */
const ARCH_DEPTH = 1.05;

/**
 * Стрілчаста арка одиничного прольоту: півпроліт 1, п'ята на y=0, вістря вгорі.
 *
 * Будується як смуга — два кільця точок, внутрішнє й зовнішнє, — а не як
 * витягнутий профіль: проліт у кожної пари колон свій, і смуга масштабується
 * під нього по x, лишаючи товщину постійною по y. Витягування дало б арку, що
 * товщає разом із прольотом.
 *
 * Одна геометрія на всі арки, як і в колон, щоб вони пішли одним
 * InstancedMesh.
 */
export function buildPortalArchGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];

  // Дуга правої половини: центр зміщено вліво від правої п'яти, тож дуга
  // виходить із неї вертикально й приходить до осі під кутом.
  const centerX = -ARCH_POINT;
  const radius = 1 - centerX;
  // Кут, під яким дуга перетинає вісь прольоту, — там вона й обривається,
  // зустрічаючись із дзеркальною половиною.
  const meetAngle = Math.acos(-centerX / radius);

  const ring = (offset: number): number => {
    const first = positions.length / 3;
    for (let step = 0; step <= ARCH_SEGMENTS; step += 1) {
      const angle = (step / ARCH_SEGMENTS) * meetAngle;
      positions.push(
        centerX + Math.cos(angle) * (radius + offset),
        Math.sin(angle) * (radius + offset),
        0,
      );
    }
    return first;
  };
  const inner = ring(0);
  const outer = ring(ARCH_THICKNESS);
  for (let step = 0; step < ARCH_SEGMENTS; step += 1) {
    const a = inner + step;
    const b = inner + step + 1;
    const c = outer + step;
    const d = outer + step + 1;
    indices.push(a, c, b, b, c, d);
  }

  const half = new THREE.BufferGeometry();
  half.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  half.setIndex(indices);

  // Дзеркало по x дає ліву половину. Віддзеркалення обертає намотку, тож
  // індекси розвертаються назад — інакше половина арки зникає під відсіканням
  // задніх граней.
  const mirrored = half.clone();
  const mirroredPositions = mirrored.getAttribute('position');
  for (let index = 0; index < mirroredPositions.count; index += 1) {
    mirroredPositions.setX(index, -mirroredPositions.getX(index));
  }
  const mirroredIndex = Array.from(mirrored.getIndex()!.array);
  for (let offset = 0; offset < mirroredIndex.length; offset += 3) {
    const swap = mirroredIndex[offset]!;
    mirroredIndex[offset] = mirroredIndex[offset + 2]!;
    mirroredIndex[offset + 2] = swap;
  }
  mirrored.setIndex(mirroredIndex);

  const flat = mergeGeometries([half, mirrored]);
  half.dispose();
  mirrored.dispose();
  if (flat === null) throw new Error('Portal arch geometry could not be merged.');

  // Товщина по z. Без неї арка — площина, яка зникає, щойно камера відходить
  // від осі, а колонада на широкому екрані дивиться на глядача збоку.
  const solid = mergeGeometries([
    flat.clone().translate(0, 0, ARCH_DEPTH * 0.5),
    flat.clone().translate(0, 0, -ARCH_DEPTH * 0.5),
  ]);
  flat.dispose();
  if (solid === null) throw new Error('Portal arch geometry could not be extruded.');
  solid.computeVertexNormals();
  return solid;
}

export interface PortalArchInstance {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
}

/**
 * Арки над задніми парами колон.
 *
 * Тільки над задніми, і це не економія. Арка над передньою парою пройшла б
 * через кадр рівно там, де стоїть кристал, — колонада перетворилась би на
 * ґрати перед ним. Задні натомість роблять те, заради чого їх узято з
 * референсу: змикають колони в **залу** й кадрують небо у високі прорізи, що
 * ведуть око вниз до подіуму.
 *
 * П'ята арки стоїть на капітелі своєї пари, а проліт — це відстань між
 * внутрішніми гранями колон, тож арка тримається колонади на будь-якому
 * аспекті, замість того щоб мати власний розмір.
 */
export function portalArchInstances(
  frame: PortalCameraFrame,
  aspect: number,
): PortalArchInstance[] {
  const instances: PortalArchInstance[] = [];
  for (const placement of PORTAL_PILLARS) {
    if (placement.z > -1) continue;
    const depth = Math.max(0.1, frame.distance - placement.z);
    const axis = portalHalfWidthAt(depth, aspect) * placement.edgeFraction + placement.radius;
    const span = Math.max(0.4, axis - placement.radius);
    instances.push({
      position: [
        0,
        PORTAL_GROUND_Y - PORTAL_FIELD_DROP + placement.height * ARCH_SPRING,
        placement.z,
      ],
      // Півпроліт по x, а підйом — **світові одиниці**, не частка прольоту.
      // Колони роз'їжджаються з аспектом, тож проліт на широкому екрані втричі
      // ширший, ніж на телефоні; підйом, прив'язаний до нього, або лишав арку
      // над кадром на широкому, або чіпляв кристал на вузькому. У справжній
      // залі арка одна, а кадр її обрізає — сталий підйом і є цим.
      scale: [span, ARCH_RISE, placement.radius],
    });
  }
  return instances;
}

/**
 * На якій частці висоти колони лежить п'ята арки.
 *
 * Не під капітеллю, хоч архітектурно їй там і місце. Колони навмисно вищі за
 * кадр — вони мусять виходити за верхній край, щоб зала не мала стелі, — і
 * п'ята, поставлена під капітеллю, опинялась на y≈2.8 при верхньому краї кадру
 * 3.28, тобто арки не було видно взагалі. Виміряно, а не вгадано.
 */
const ARCH_SPRING = 0.49;
/**
 * Підйом арки над п'ятою, у світових одиницях.
 *
 * Опущено з 2.4: вістря опинялось під шапкою інтерфейсу, тобто арка була в
 * кадрі, але не на екрані. Портал — це не рендер у вакуумі, і верхня третина
 * його вікна зайнята текстом.
 */
const ARCH_RISE = 1.6;

// ── Світло на колонах ───────────────────────────────────────

/**
 * Де на колоні стоїть вогонь, як частка її висоти.
 *
 * Не під капітеллю, хоч там йому й місце за архітектурою: капітель передньої
 * пари лежить вище за верхній край кадру, тож вогонь було видно лише тому, хто
 * задере камеру. Джерело світла, якого не видно, — це не джерело світла, а
 * просто світло нізвідки. На цій висоті він у кадрі на кожному аспекті.
 */
const LAMP_HEIGHT_SHARE = 0.6;

/** Наскільки вогонь винесений усередину, до кристала, від осі колони. */
const LAMP_INSET = 0.62;

/**
 * Скільки колон несуть справжнє джерело світла.
 *
 * Два, і це не економія на вигляді, а на кадрі: кожен point light додає роботи
 * в кожному фрагменті кожного матеріалу сцени. Вогні горять на **всіх** колонах
 * — це геометрія, вона майже безкоштовна, — але освітлює кристал лише передня
 * пара, бо саме вона стоїть із того боку, з якого на нього дивляться. Задні
 * дали б контровий підсвіт, який тут уже є від directionalLight.
 */
export const PORTAL_LAMP_LIGHT_COUNT = 2;

export interface PortalLampInstance {
  position: readonly [number, number, number];
  /** Чи від цього вогню запалюється справжнє джерело світла. */
  lit: boolean;
}

/**
 * Вогні на колонах для конкретного кадру.
 *
 * Порядок той самий, що в `portalPillarInstances`, і це не збіг: вогонь мусить
 * стояти рівно на своїй колоні, а колони їдуть із кадром камери. Виводити їх
 * окремо означало б два джерела правди для однієї позиції.
 */
export function portalLampInstances(
  frame: PortalCameraFrame,
  aspect: number,
): PortalLampInstance[] {
  const pillars = portalPillarInstances(frame, aspect);
  // Найближча до глядача пара — та, у якої z найбільший.
  const frontZ = Math.max(...PORTAL_PILLARS.map((placement) => placement.z));
  return pillars.map((pillar) => {
    const height = pillar.scale[1] * LAMP_HEIGHT_SHARE;
    const inward = pillar.position[0] > 0 ? -1 : 1;
    return {
      position: [
        pillar.position[0] + inward * pillar.scale[0] * LAMP_INSET,
        pillar.position[1] + height,
        pillar.position[2],
      ] as const,
      lit: Math.abs(pillar.position[2] - frontZ) < 1e-6,
    };
  });
}

/**
 * Чаша вогню: маленька, гранована, з тією ж кількістю сторін, що й колона.
 *
 * Нормалізована так само, як колона, — радіусом 1, — тож масштаб інстансу
 * означає саме габарит вогню.
 */
export function buildPortalLampGeometry(): THREE.BufferGeometry {
  const bowl = new THREE.CylinderGeometry(1, 0.5, 0.55, 8, 1);
  bowl.translate(0, 0.28, 0);
  // Вузьке й високе. Перший конус був майже такої ж ширини, як чаша, і читався
  // як шпиль на колоні, а не як вогонь у ній.
  const flame = new THREE.ConeGeometry(0.62, 1.8, 8, 1);
  flame.translate(0, 1.4, 0);

  const merged = mergeGeometries([bowl, flame]);
  bowl.dispose();
  flame.dispose();
  if (merged === null) throw new Error('Portal lamp geometry could not be merged.');
  merged.computeVertexNormals();
  return merged;
}

/** Габарит вогню в одиницях сцени. */
export const PORTAL_LAMP_RADIUS = 0.19;

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
  /** Різьблення на кільці плити. */
  rune: string;
  runeGlow: string;
  inlay: string;
  pillar: string;
  /** Чаша вогню на колоні. */
  lamp: string;
  /** Саме полум'я — і колір джерела світла, що від нього запалюється. */
  lampGlow: string;
  lampIntensity: number;
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
    dais: '#4c4a56',
    daisEmissive: '#191720',
    slab: '#5d5b6a',
    rune: '#8d7fae',
    runeGlow: '#c9a9f0',
    inlay: '#e2be80',
    pillar: '#6a5c8f',
    lamp: '#241d33',
    lampGlow: '#ff9c47',
    lampIntensity: 11,
    starOpacity: 0.85,
    daisLight: '#d7b7f2',
    daisLightIntensity: 2.6,
  },
  dark: {
    fog: '#221a33',
    field: '#1b1428',
    dais: '#3a3844',
    daisEmissive: '#121017',
    slab: '#494757',
    rune: '#6f6390',
    runeGlow: '#a684d8',
    inlay: '#cea86e',
    pillar: '#4b4070',
    lamp: '#1b1628',
    lampGlow: '#ff8c34',
    lampIntensity: 13,
    starOpacity: 1,
    daisLight: '#b891dd',
    daisLightIntensity: 2.2,
  },
};
