// ============================================================
// Кристальна печера — місце, у якому стоїть артефакт.
// ------------------------------------------------------------
// ЩО ЦЕ ЗАМІНЮЄ. Грецький храм: спершу процедурний (підлога, вісімнадцять
// колон, арки, світильники, релікварій), потім одна авторська руїна
// (`amore_ruin.glb`) з мармуровим подіумом, обелісками й золотим кільцем.
//
// Власник скасував цей світ разом із `PRODUCT.md` і `DESIGN.md`
// (ADR-0116). Причина не в тому, що храм негарний, а в тому, що подіум
// був ПІДСТАВКОЮ, і `amore-crystal-look` каже про це прямо: гладка
// суцільна поверхня під кристалом читається п'єдесталом, хай як її
// формувати. Жеода (ADR-0115) під мармуровою плитою лишалась жеодою на
// тарілці.
//
// ЩО ТУТ Є І ЧОГО НЕМАЄ. Зала, стеля з розломом угорі й друза по стінах.
// Немає жодної кривої поверхні: камінь ламається пласко, тож усе тут —
// площини й ребра, з жорсткими нормалями. Це `The Flat Facet Rule`
// (`DESIGN.md`) прикладене до породи, а не лише до кристала.
//
// ПІДЛОГА НЕ ЗРУШИЛА. Верх кам'яної підлоги лягає рівно на
// `PORTAL_GROUND_Y` — ту саму площину, на якій рушій ставить кристали.
// Про заміну сцени не дізнається жоден інший файл, так само як це було з
// руїною.
//
// ЧОМУ СУП ІЗ ТРИКУТНИКІВ, А НЕ ІНДЕКСОВАНА СІТКА. Спільна вершина
// усереднює нормалі сусідніх граней, і скеля стає надутою кулею. Тут
// кожен трикутник має власні три вершини, тож кожна грань має власну
// нормаль і ловить своє світло — те саме, чим кристал відрізняється від
// гладкої форми.
// ============================================================
import * as THREE from 'three';
import { PORTAL_GROUND_Y } from './portalScene';

/**
 * Радіус зали.
 *
 * 11 → 6.2, і це головне число цієї сцени.
 *
 * Одинадцять давало ЗАЛУ, а не печеру: стіна стояла так далеко, що
 * займала весь фон рівним полем без жодної структури, а друза на ній
 * малювалась цятками, які читались брудом. Причому виправити це
 * розміром друзи не можна — порахуйте: на відстані одинадцяти одиниць
 * одна одиниця сцени займає 226 пікселів, тож кристал, помітний на
 * стіні, мусив би бути завбільшки з артефакт.
 *
 * Печера — це тіснота. Око за 3.4 одиниці від осі, стіна за 6.2: між
 * ними менше трьох одиниць, стіна читається каменем, а кристал на ній
 * лишається кристалом і не сперечається з артефактом.
 */
export const CAVE_CHAMBER_RADIUS = 6.2;

/** Висота склепіння над підлогою. */
export const CAVE_CEILING_HEIGHT = 5;

/**
 * Скільки граней має стіна по колу.
 *
 * Сорок — це грань завширшки 9°, тобто на око вона пласка, але не читається
 * багатокутником. Менше — і зала стає гранчастою вазою; більше — і скеля
 * знову округла, бо сусідні грані вже не відрізняються.
 */
export const CAVE_AZIMUTH_SEGMENTS = 40;

/**
 * Профіль зали: (частка висоти, множник радіуса).
 *
 * Не купол. Стіна трохи піддається назовні внизу (підмив), стоїть майже
 * прямо в середині й швидко сходиться до розлому вгорі. Останнє число —
 * радіус самого розлому.
 */
const CAVE_PROFILE: readonly (readonly [number, number])[] = [
  [0.00, 1.00],
  [0.16, 1.07],
  [0.42, 1.02],
  [0.66, 0.86],
  [0.84, 0.58],
  [1.00, 0.19],
];

/** Розкид радіуса стіни по колу — частка радіуса зали. */
const CAVE_WALL_NOISE = 0.13;
/** Скільки контрольних точок має той розкид. Просте число. */
const CAVE_NOISE_POINTS = 17;

/**
 * Кільця підлоги, частками радіуса зали.
 *
 * П'ять, а не три. Із трьома віяло від центру мало трикутники завдовжки
 * у третину зали, і на кадрі підлога читалась ПРОМЕНЯМИ від артефакта —
 * рівно тим візерунком, якого в камені не буває.
 */
const CAVE_FLOOR_RINGS: readonly number[] = [0.14, 0.30, 0.46, 0.63, 0.82];
/** Розкид висоти підлоги — частка радіуса зали. Камінь нерівний. */
const CAVE_FLOOR_RELIEF = 0.02;

/**
 * Скільки кущів друзи росте по стінах на кожному рівні якості.
 *
 * Друза — не декорація: саме вона робить печеру КРИСТАЛЬНОЮ. Без неї це
 * просто кам'яний мішок, і артефакт у ньому не має родини.
 */
export const CAVE_DRUSE_CLUSTERS: Record<'high' | 'balanced' | 'low' | 'fallback', number> = {
  high: 92, balanced: 56, low: 24, fallback: 0,
};

/** Скільки кристалів у кущі. */
const DRUSE_MIN = 3;
const DRUSE_MAX = 6;

/**
 * ОДИНАК: кожен восьмий кущ — ОДИН великий кристал, а не купка.
 *
 * П'ята спроба зробити стіну кристальною провалилась, і ADR-0121 записав
 * причину: великі кристали ОДНОГО КУЩА перетинаються, їхні опуклі тіла
 * зливаються в одну бульбу, а фарба в діапазоні 0.86–1.0 не давала їхнім
 * граням розділення. На знімку виходила картопля.
 *
 * Це виправляє обидві половини причини, а не додає ще одне число:
 *
 *  • великий кристал росте ОДИН, тож перетинатись нема з чим;
 *  • його грані фарбуються ЧЕРГУВАННЯМ через одну, з розмахом 0.58/1.34
 *    замість 0.86/1.00 — тим самим прийомом, яким читаються грані самого
 *    артефакта (ADR-0120).
 */
const DRUSE_SOLITARY_EVERY = 8;
const DRUSE_SOLITARY_MIN_LENGTH = 0.9;
const DRUSE_SOLITARY_MAX_LENGTH = 1.8;
/** Тони бічних граней одинака — через одну, як у циклі артефакта. */
const DRUSE_FACE_SHADES: readonly number[] = [1.34, 0.58, 1.16, 0.72, 1.26, 0.64];
/**
 * Розмір кристала друзи в одиницях сцени.
 *
 * ПОРАХОВАНО, а не підібрано. Стіна стоїть за 6.2 одиниці від осі, поле
 * зору 42°, кадр 1900 px заввишки: на такій відстані одна одиниця сцени
 * займає близько 350 пікселів. Тобто кристал завдовжки 2.6 малювався б
 * майже на всю висоту кадру — і саме так виглядала одна з редакцій: три
 * брили в повітрі, дві з яких склались у серце.
 *
 * 0.10–0.46 дає 35–160 px. Це кристал, який видно як кристал, і якого не
 * плутають з артефактом.
 */
const DRUSE_MIN_LENGTH = 0.07;
const DRUSE_MAX_LENGTH = 0.26;
/** Товщина відносно довжини — та сама стрункість, що в еталона. */
const DRUSE_ASPECT = 3.4;
/** Кут головки від горизонталі — решітка кварцу, як в еталоні. */
const DRUSE_TERMINATION_DEG = 52;
/** Нерівні відстані до шести граней: вирослий кристал, не виточений. */
const DRUSE_FACE_OFFSETS: readonly number[] = [1.0, 0.82, 0.95, 1.0, 0.82, 0.95];

/**
 * Насінний шум 0…1, детермінований і без стрибка на замиканні кола.
 *
 * Власний, а не з `substrate.ts`: та функція живе в рушії, а рушій не
 * імпортують зі сцени. Формула та сама — синус із перемішуванням, — і це
 * навмисне повторення чотирьох рядків замість залежності через межу тому.
 */
function seededUnit(seed: number, label: string): number {
  let hash = 2166136261 ^ Math.trunc(seed);
  for (let index = 0; index < label.length; index += 1) {
    hash = Math.imul(hash ^ label.charCodeAt(index), 16777619);
  }
  // Беззнакове зсування, щоб результат не залежав від знаку хеша.
  return ((hash >>> 0) % 100000) / 100000;
}

/** Гладкий шум по колу: інтерполяція між контрольними точками. */
function ringNoise(seed: number, label: string, angle: number, points: number): number {
  const turns = angle / (Math.PI * 2);
  const scaled = (turns - Math.floor(turns)) * points;
  const index = Math.floor(scaled);
  const t = scaled - index;
  const left = seededUnit(seed, `${label}:${index % points}`);
  const right = seededUnit(seed, `${label}:${(index + 1) % points}`);
  const eased = t * t * (3 - 2 * t);
  return left + (right - left) * eased;
}

interface Soup {
  readonly positions: number[];
  readonly colors: number[];
  /**
   * `shade` — одне число на весь трикутник або три, по одному на кут.
   *
   * Одне: грань каменю ловить своє світло цілком, і градієнт усередині
   * неї був би тим самим, від чого тікає `The Flat Facet Rule`.
   * Три: промінь із розлому гасне донизу, і це вже не грань, а об'єм.
   */
  push(
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number],
    shade?: number | readonly [number, number, number],
  ): void;
}

function soup(): Soup {
  const positions: number[] = [];
  const colors: number[] = [];
  return {
    positions,
    colors,
    push(a, b, c, shade = 1) {
      positions.push(...a, ...b, ...c);
      const corners = typeof shade === 'number' ? [shade, shade, shade] : shade;
      for (const value of corners) colors.push(value, value, value);
    },
  };
}

function finish(mesh: Soup): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(mesh.colors, 3));
  // Нормалі рахуються ПІСЛЯ супу, тож кожна грань дістає власну.
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * ЯК СВІТИТЬСЯ ПЕЧЕРА — І ЧОМУ НЕ СВІТЛОМ.
 * ------------------------------------------------------------
 * Перша редакція покладалась на світло сцени, і кадр показав, чому так не
 * можна: при нічній заливці 0.1 камінь `#241d33` намалювався ЧОРНИМ.
 * Стіни зникли, друза на них лишилась висіти в порожнечі уламками, а
 * кристал знову стояв ні на чому.
 *
 * Полагодити це силою світла не можна, і це не питання підбору числа.
 * Світло, якого досить, щоб побачити стіну за десять одиниць, залило б і
 * кристал за три — а `amore-crystal-look` міряв цю ціну: різниця
 * яскравості сусідніх граней і є те, що робить кристал кристалом, і
 * заливка з'їдає її першою. Зробити два світла для двох тіл через
 * `layers` можна, але тоді сцена мовчки залежить від того, які шари
 * увімкнені в камери, у проби блуму й у променя вибору.
 *
 * Тому печера НАМАЛЬОВАНА, а не освітлена — рівно так, як намальовані
 * еталонні самоцвіти, з яких узято мову граней. Яскравість кожної грані
 * лежить у вершинному кольорі:
 *
 *   • підйом до розлому — світло падає згори;
 *   • власна яскравість грані — камінь ламається пласко, і сусідні
 *     площини ловлять різне;
 *   • підлога світліша під артефактом — це його власне світло.
 *
 * Жодне джерело сцени печери не торкається (`meshBasicMaterial`), тож
 * різниця граней кристала лишається такою, якою її виміряли.
 */
const CAVE_FACET_SHADE_MIN = 0.78;
const CAVE_FACET_SHADE_SPAN = 0.44;

/** Радіус стіни в напрямку `angle` на частці висоти `share`. */
function wallRadiusAt(seed: number, angle: number, share: number): number {
  let factor = CAVE_PROFILE[CAVE_PROFILE.length - 1]![1];
  for (let index = 0; index < CAVE_PROFILE.length - 1; index += 1) {
    const [lowShare, lowFactor] = CAVE_PROFILE[index]!;
    const [highShare, highFactor] = CAVE_PROFILE[index + 1]!;
    if (share > highShare) continue;
    const span = Math.max(1e-6, highShare - lowShare);
    const t = Math.min(1, Math.max(0, (share - lowShare) / span));
    factor = lowFactor + (highFactor - lowFactor) * t;
    break;
  }
  /*
   * Шум слабшає до розлому. Інакше отвір угорі виходив би рваним
   * настільки, що читався б дірою в моделі, а не тріщиною в склепінні:
   * при радіусі 0.19 розкид у 13% радіуса ЗАЛИ — це 70% самого отвору.
   */
  const fade = 1 - share * 0.72;
  const noise = (ringNoise(seed, 'cave:wall', angle, CAVE_NOISE_POINTS) - 0.5)
    * 2 * CAVE_WALL_NOISE * fade;
  return CAVE_CHAMBER_RADIUS * Math.max(0.08, factor + noise);
}

/** Висота підлоги на відстані `radius` в напрямку `angle`. */
function floorHeightAt(seed: number, angle: number, radius: number): number {
  const relief = (ringNoise(seed, 'cave:floor', angle * 1.7 + radius, CAVE_NOISE_POINTS) - 0.5)
    * 2 * CAVE_FLOOR_RELIEF * CAVE_CHAMBER_RADIUS;
  /*
   * Біля осі рельєфу немає взагалі: там стоїть жеода, і горб під нею
   * підняв би породу вище за власну губу. Ріст рельєфу від центру —
   * квадратичний, тобто перші дві одиниці лишаються практично рівними.
   */
  const grow = Math.min(1, radius / (CAVE_CHAMBER_RADIUS * 0.55)) ** 2;
  return PORTAL_GROUND_Y + relief * grow;
}

/**
 * Підлога зали — окремою геометрією, бо в неї інший камінь.
 *
 * Рельєф є, але біля осі його немає: там стоїть жеода, і горб під нею
 * підняв би породу вище за її власну губу. Верх підлоги по осі лягає
 * рівно на `PORTAL_GROUND_Y` — ту саму площину, на якій рушій ставить
 * кристали, і саме тому про заміну сцени не дізнається жоден інший файл.
 */
export function buildPortalCaveFloorGeometry(seed: number): THREE.BufferGeometry {
  const mesh = soup();
  const segments = CAVE_AZIMUTH_SEGMENTS;
  const angleOf = (segment: number): number => (segment / segments) * Math.PI * 2;
  const floorPoint = (segment: number, share: number): [number, number, number] => {
    const angle = angleOf(segment);
    const radius = wallRadiusAt(seed, angle, 0) * share;
    return [
      Math.cos(angle) * radius,
      floorHeightAt(seed, angle, radius),
      Math.sin(angle) * radius,
    ];
  };

  /*
   * Підлога світліша під артефактом і темніє до стін: єдине світло, яке
   * тут справді є, — сам кристал, і воно падає йому під ноги.
   */
  const floorShade = (segment: number, share: number, ring: number): number => {
    const near = 1 - Math.min(1, share / 0.55);
    /*
     * Розкид яскравості на підлозі ВТРИЧІ менший, ніж на стіні, і це не
     * непослідовність. Стіна дивиться на глядача ребром до ребра — там
     * різниця граней читається каменем. Підлога дивиться пласко, і той
     * самий розкид на віялі від центру дав промені, що розходяться від
     * артефакта.
     */
    const facet = CAVE_FACET_SHADE_MIN
      + CAVE_FACET_SHADE_SPAN * 0.34 * seededUnit(seed, `cave:floor:${segment}:${ring}`);
    return (0.42 + 0.58 * near ** 1.6) * facet;
  };

  const centre: [number, number, number] = [0, PORTAL_GROUND_Y, 0];
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    const first = CAVE_FLOOR_RINGS[0]!;
    mesh.push(
      centre, floorPoint(next, first), floorPoint(segment, first),
      floorShade(segment, first * 0.5, 0),
    );
    for (let ring = 0; ring < CAVE_FLOOR_RINGS.length - 1; ring += 1) {
      const inner = CAVE_FLOOR_RINGS[ring]!;
      const outer = CAVE_FLOOR_RINGS[ring + 1]!;
      const shade = floorShade(segment, (inner + outer) * 0.5, ring + 1);
      mesh.push(
        floorPoint(segment, inner), floorPoint(next, inner), floorPoint(next, outer), shade,
      );
      mesh.push(
        floorPoint(segment, inner), floorPoint(next, outer), floorPoint(segment, outer), shade,
      );
    }
    const last = CAVE_FLOOR_RINGS[CAVE_FLOOR_RINGS.length - 1]!;
    const edge = floorShade(segment, (last + 1) * 0.5, CAVE_FLOOR_RINGS.length);
    mesh.push(floorPoint(segment, last), floorPoint(next, last), floorPoint(next, 1), edge);
    mesh.push(floorPoint(segment, last), floorPoint(next, 1), floorPoint(segment, 1), edge);
  }
  return finish(mesh);
}

/**
 * Стіни й склепіння з розломом угорі.
 *
 * Намотка ВНУТРІШНЯ: глядач стоїть усередині, тож нормалі дивляться до
 * осі, і зворотні грані відсікаються звичайним `FrontSide`. Робити це
 * `BackSide`-ом було б дешевше на один рядок і неправильно: тоді нормалі
 * дивились би назовні, і світло рахувалось би для стіни, оберненої від
 * зали.
 */
export function buildPortalCaveShellGeometry(seed: number): THREE.BufferGeometry {
  const mesh = soup();
  const segments = CAVE_AZIMUTH_SEGMENTS;
  const angleOf = (segment: number): number => (segment / segments) * Math.PI * 2;
  const wallPoint = (segment: number, share: number): [number, number, number] => {
    const angle = angleOf(segment);
    const radius = wallRadiusAt(seed, angle, share);
    return [
      Math.cos(angle) * radius,
      PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT * share,
      Math.sin(angle) * radius,
    ];
  };

  for (let index = 0; index < CAVE_PROFILE.length - 1; index += 1) {
    const low = CAVE_PROFILE[index]![0];
    const high = CAVE_PROFILE[index + 1]![0];
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = wallPoint(segment, low);
      const b = wallPoint(next, low);
      const c = wallPoint(next, high);
      const d = wallPoint(segment, high);
      /*
       * Дві половини чотирикутника беруть РІЗНУ яскравість. Це не шум
       * заради шуму: пласка стіна з однією яскравістю на всю ланку
       * читається циліндром, і саме так виглядала перша редакція.
       */
      const lift = 0.55 + 0.45 * ((low + high) * 0.5) ** 1.1;
      const one = CAVE_FACET_SHADE_MIN
        + CAVE_FACET_SHADE_SPAN * seededUnit(seed, `cave:wall:${index}:${segment}:a`);
      const two = CAVE_FACET_SHADE_MIN
        + CAVE_FACET_SHADE_SPAN * seededUnit(seed, `cave:wall:${index}:${segment}:b`);
      /*
       * Намотка ВНУТРІШНЯ, і перша редакція мала її навпаки.
       *
       * Кадр показав чорноту над лінією підлоги, і причина була не в
       * кольорі: `(a, c, b)` дає нормаль НАЗОВНІ, тобто стіна цілком
       * відсікалась як зворотна грань. Підлога намальована правильно
       * випадково — її віяло намотане в інший бік, — тож вада виглядала
       * як «камінь замалий», а не як «стіни немає».
       */
      mesh.push(a, b, c, lift * one);
      mesh.push(a, c, d, lift * two);
    }
  }

  return finish(mesh);
}

/**
 * Диск розлому — те, що видно крізь тріщину в склепінні.
 *
 * Окремою геометрією, бо в нього інший матеріал: це не камінь, а небо
 * (вдень) або темрява з зорями (вночі). Робити з нього справжній отвір
 * означало б лишити оболонку відкритою — і туман зали витікав би крізь
 * неї у фон.
 */
export function buildPortalCaveOculusGeometry(seed: number): THREE.BufferGeometry {
  const mesh = soup();
  const segments = CAVE_AZIMUTH_SEGMENTS;
  const y = PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT;
  const centre: [number, number, number] = [0, y, 0];
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    const point = (index: number): [number, number, number] => {
      const angle = (index / segments) * Math.PI * 2;
      const radius = wallRadiusAt(seed, angle, 1);
      return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    };
    // Донизу, до глядача: диск видно знизу.
    mesh.push(centre, point(segment), point(next));
  }
  return finish(mesh);
}

/**
 * Промінь із розлому — конус світла від склепіння до підлоги.
 *
 * ЧОМУ ГЕОМЕТРІЯ, А НЕ СВІТЛО. Напрямлене джерело з розлому вже є
 * (`oculusIntensity`), і воно робить свою роботу — освітлює тіла. Але
 * САМОГО ПРОМЕНЯ від нього не видно: промінь видно тому, що в повітрі є
 * пил, а об'ємного розсіювання тут немає й не буде.
 *
 * Тому промінь — це тіло: конус, який розширюється донизу, малюється
 * адитивно й не пише в буфер глибини. Він нічого не освітлює; він і Є
 * те, що видно.
 *
 * Конус стоїть НА ОСІ, тобто падає рівно на артефакт. Це не випадковість
 * композиції: у печері з одним отвором світло падає туди, куди падає, а
 * кристал стоїть під ним — саме тому він там і виріс.
 */
export function buildPortalCaveShaftGeometry(seed: number): THREE.BufferGeometry {
  const mesh = soup();
  const segments = CAVE_AZIMUTH_SEGMENTS;
  const top = PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT;
  const bottom = PORTAL_GROUND_Y;
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    const at = (index: number, y: number, scale: number): [number, number, number] => {
      const angle = (index / segments) * Math.PI * 2;
      const radius = wallRadiusAt(seed, angle, 1) * scale;
      return [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
    };
    const a = at(segment, top, 1);
    const b = at(next, top, 1);
    const c = at(next, bottom, CAVE_SHAFT_SPREAD);
    const d = at(segment, bottom, CAVE_SHAFT_SPREAD);
    /*
     * Яскравість гасне донизу: біля розлому промінь щільний, біля
     * підлоги розходиться. Вершинний колір несе саме це — матеріал
     * адитивний, тож нуль унизу означає «нічого не додає».
     */
    mesh.push(a, b, c, [1, 1, 0]);
    mesh.push(a, c, d, [1, 0, 0]);
  }
  return finish(mesh);
}

/** Наскільки промінь ширший біля підлоги, ніж біля розлому. */
const CAVE_SHAFT_SPREAD = 2.6;

/**
 * Друза по стінах — кущі кварцу, що ростуть із каменю.
 *
 * Кожен кристал будується тією ж арифметикою, що еталон
 * (`scripts/models/reference-crystal.py`): шестигранна призма з
 * НЕРІВНИМИ відстанями до граней і головка під кутом решітки. Це не
 * копія коду рушія — рушій сюди не імпортують, — а те саме правило
 * форми, застосоване до декору, щоб печера й артефакт були з одного
 * мінералу.
 */
export function buildPortalCaveDruseGeometry(
  seed: number,
  clusters: number,
): THREE.BufferGeometry {
  const mesh = soup();
  const rise = Math.tan((DRUSE_TERMINATION_DEG * Math.PI) / 180);

  for (let cluster = 0; cluster < clusters; cluster += 1) {
    const tag = `cave:druse:${cluster}`;
    const angle = ((cluster + seededUnit(seed, `${tag}:spin`) * 0.7) / clusters) * Math.PI * 2;
    /*
     * Кущі сидять БІЛЯ ПІДНІЖЖЯ стіни — там, де стіна сходиться з
     * підлогою. Перша редакція розкидала їх до половини висоти, і на
     * телефоні вони опинялись у верхній третині кадру, відірвані від
     * усього: контакту з каменем не видно, тіні немає, і купка читалась
     * уламками в небі.
     */
    /*
     * Одинак росте від самого підніжжя стіни — там, де вона сходиться з
     * підлогою, — тобто стоїть, а не висить. Дрібні розсипані вище.
     */
    const share = cluster % DRUSE_SOLITARY_EVERY === 0
      ? 0.004 + seededUnit(seed, `${tag}:height`) * 0.05
      : 0.01 + seededUnit(seed, `${tag}:height`) * 0.34;
    const wallRadius = wallRadiusAt(seed, angle, share);
    const baseX = Math.cos(angle) * wallRadius;
    const baseZ = Math.sin(angle) * wallRadius;
    const baseY = PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT * share;

    const solitary = cluster % DRUSE_SOLITARY_EVERY === 0;
    const count = solitary
      ? 1
      : DRUSE_MIN + Math.floor(seededUnit(seed, `${tag}:count`) * (DRUSE_MAX - DRUSE_MIN + 1));
    for (let index = 0; index < count; index += 1) {
      const own = `${tag}:${index}`;
      const length = solitary
        ? DRUSE_SOLITARY_MIN_LENGTH
          + seededUnit(seed, `${own}:len`)
            * (DRUSE_SOLITARY_MAX_LENGTH - DRUSE_SOLITARY_MIN_LENGTH)
        : DRUSE_MIN_LENGTH
          + seededUnit(seed, `${own}:len`) * (DRUSE_MAX_LENGTH - DRUSE_MIN_LENGTH);
      const offset = length / DRUSE_ASPECT / 2;
      const prism = length - offset * rise;
      if (prism <= 0) continue;

      // Кристал росте ВІД стіни: вісь дивиться до центру зали, з нахилом.
      const lean = (seededUnit(seed, `${own}:lean`) - 0.5) * 0.9;
      /*
       * ОДИНАК СТОЇТЬ МАЙЖЕ ПРЯМО, і це виправлення шостої спроби.
       *
       * Досі всі кристали стіни росли ВІД неї — вісь дивилась до центру
       * зали. Для дрібних це правда життя, для великого — вирок: той, що
       * росте з дальньої стіни, дивиться вістрям просто в камеру, і на
       * кадрі від нього видно шестикутний торець. Саме він і читався
       * картоплею; ні розмір, ні фарба цього не лікували, бо довжини
       * кристала не було видно взагалі.
       *
       * Тепер підйом переважає над виносом: одинак — це шпиль біля стіни,
       * нахилений від неї, а не спис, спрямований у глядача.
       */
      const lift = solitary
        ? 1.7 + seededUnit(seed, `${own}:lift`) * 0.9
        : (seededUnit(seed, `${own}:lift`) - 0.3) * 1.1;
      const axis = new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle))
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), lean)
        .add(new THREE.Vector3(0, lift, 0))
        .normalize();
      const side = new THREE.Vector3(0, 1, 0).cross(axis);
      if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
      side.normalize();
      const up = new THREE.Vector3().crossVectors(axis, side).normalize();

      /*
       * ПІДОШВА ВТОПЛЕНА В КАМІНЬ, і без цього нічого не рятує.
       *
       * Кадр показував ту саму ваду тричі поспіль: кристали висіли перед
       * стіною з просвітом. Причина не в розмірі й не в місці — вони
       * СТОЯЛИ рівно на поверхні, а нахилені всередину зали, тож усе
       * тіло виявлялось перед каменем, і торкалась його одна точка.
       *
       * Те саме правило, що в жеоди (`BURIED_SHARE` еталона): кристал
       * росте З породи, тобто частина його в ній. Сорок п'ять відсотків
       * довжини назовні від стіни — і видима частина ВИХОДИТЬ з каменю.
       */
      const outward = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const spread = length * 0.5;
      const root = new THREE.Vector3(
        baseX + (seededUnit(seed, `${own}:dx`) - 0.5) * spread,
        baseY + (seededUnit(seed, `${own}:dy`) - 0.5) * spread,
        baseZ + (seededUnit(seed, `${own}:dz`) - 0.5) * spread,
      );
      if (solitary) {
        /*
         * ОДИНАК ТОНЕ ВНИЗ, А НЕ ВБІК, і це сьома спроба тієї самої речі.
         *
         * Дрібна друза росте ВІД стіни, тож і топити її треба в стіну —
         * назовні по горизонталі. Одинак стоїть майже прямо, і той самий
         * горизонтальний зсув давав інше: тіло ховалось за оболонкою по
         * КОСІЙ, тобто виринало серед стіни, а не виходило з підніжжя. На
         * кадрі це читалось як кристал, що висить.
         *
         * Вертикальне тіло ховає підошву так само, як монарх у жеоді, —
         * вона просто нижча за підлогу.
         */
        root.addScaledVector(outward, length * 0.1);
        root.y -= length * 0.34;
      } else {
        root.addScaledVector(outward, length * 0.45);
      }

      const at = (u: number, v: number, along: number): [number, number, number] => {
        const point = root.clone()
          .addScaledVector(side, u)
          .addScaledVector(up, v)
          .addScaledVector(axis, along);
        return [point.x, point.y, point.z];
      };

      // Кути шестикутника з нерівних відстаней до граней — та сама
      // арифметика, що `corner_ring` в еталоні.
      const corners: [number, number][] = [];
      for (let face = 0; face < 6; face += 1) {
        const first = (face * Math.PI) / 3;
        const second = ((face + 1) * Math.PI) / 3;
        const dFirst = DRUSE_FACE_OFFSETS[face]! * offset;
        const dSecond = DRUSE_FACE_OFFSETS[(face + 1) % 6]! * offset;
        const det = Math.cos(first) * Math.sin(second) - Math.sin(first) * Math.cos(second);
        corners.push([
          (dFirst * Math.sin(second) - dSecond * Math.sin(first)) / det,
          (dSecond * Math.cos(first) - dFirst * Math.cos(second)) / det,
        ]);
      }

      /*
       * ДРУЗА ТЕЖ НАМАЛЬОВАНА, і це третє виправлення того самого.
       *
       * Доти вона була `meshStandardMaterial` з емісією, тобто ЄДИНЕ
       * тіло сцени, яке освітлюється, — на намальованій стіні. Кадр
       * показував наслідок щоразу: кристали яскравіші за камінь навколо
       * й читаються наліпленими грудками, скільки їх не роби меншими й
       * скільки не втоплюй у породу.
       *
       * Тепер тон береться з того самого діапазону, що й у стіни, і
       * малюється тим самим `meshBasicMaterial`. Друза стає ФАКТУРОЮ
       * стіни — гранями, які стоять під іншим кутом, — а не предметами
       * на ній.
       */
      const shade = 0.62 + 0.62 * seededUnit(seed, `${own}:shade`);
      // Зсув циклу з насіння: два одинаки поруч не повторюють один одного.
      const shadeShift = Math.floor(
        seededUnit(seed, `${own}:shade-shift`) * DRUSE_FACE_SHADES.length,
      );
      const apex = at(0, 0, length);
      for (let face = 0; face < 6; face += 1) {
        const [ux, uy] = corners[face]!;
        const [vx, vy] = corners[(face + 1) % 6]!;
        const bottomLeft = at(ux, uy, 0);
        const bottomRight = at(vx, vy, 0);
        const topLeft = at(ux, uy, prism);
        const topRight = at(vx, vy, prism);
        /*
         * Бічні площини одного кристала ловлять різне світло так само, як
         * грані артефакта, — і так само ЧЕРГУЮТЬСЯ. Дрібна друза тримає
         * вужчий розмах: на двадцяти пікселях сильний контраст читається
         * не гранями, а сміттям.
         */
        const own = solitary
          ? DRUSE_FACE_SHADES[(face + shadeShift) % DRUSE_FACE_SHADES.length]!
          : 0.86 + 0.28 * ((face % 3) / 2);
        mesh.push(bottomLeft, bottomRight, topRight, shade * own);
        mesh.push(bottomLeft, topRight, topLeft, shade * own);
        mesh.push(topLeft, topRight, apex, shade * (solitary ? 1.28 : 1.16));
      }
    }
  }

  return finish(mesh);
}
