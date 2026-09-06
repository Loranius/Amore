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
export const CAVE_CHAMBER_RADIUS = 5.4;

/** Висота склепіння над підлогою. */
export const CAVE_CEILING_HEIGHT = 4.4;

/**
 * Скільки граней має стіна по колу.
 *
 * Сорок — це грань завширшки 9°, тобто на око вона пласка, але не читається
 * багатокутником. Менше — і зала стає гранчастою вазою; більше — і скеля
 * знову округла, бо сусідні грані вже не відрізняються.
 */
export const CAVE_AZIMUTH_SEGMENTS = 64;

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
const CAVE_FLOOR_RINGS: readonly number[] = [0.11, 0.22, 0.34, 0.47, 0.61, 0.76, 0.9];
/** Розкид висоти підлоги — частка радіуса зали. Камінь нерівний. */
const CAVE_FLOOR_RELIEF = 0.045;

/**
 * Частка радіуса зали, всередині якої підлога РІВНА.
 *
 * Там стоїть артефакт, і рушій ставить його на `PORTAL_GROUND_Y`, нічого
 * не знаючи про печеру. 0.16 при вікні тесту 0.12 — запас навмисний.
 */
const CAVE_FLOOR_FLAT = 0.16;

/**
 * Скільки кущів друзи росте по стінах на кожному рівні якості.
 *
 * Друза — не декорація: саме вона робить печеру КРИСТАЛЬНОЮ. Без неї це
 * просто кам'яний мішок, і артефакт у ньому не має родини.
 */
export const CAVE_DRUSE_CLUSTERS: Record<'high' | 'balanced' | 'low' | 'fallback', number> = {
  high: 92, balanced: 56, low: 24, fallback: 0,
};

/**
 * З якого кільця підлоги починають рости кущі дрібної друзи.
 *
 * `CAVE_FLOOR_RINGS` — [0.11 … 0.9]; п’яте кільце це 0.76 радіуса
 * зали. Ближче до осі кущ сперечався б із самою колонією, а далі за
 * останнє кільце підлоги вже немає.
 */
const DRUSE_FLOOR_FIRST_RING = 5;
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
 * ЧИСЛО ПЕРЕЖИЛО ГЕОМЕТРІЮ, ЯКУ ОПИСУВАЛО — вдруге в цьому файлі й
 * утретє в цьому проєкті, тож причина записана повністю.
 *
 * Обґрунтування над цими константами говорило: «стіна стоїть за 6.2
 * одиниці, кадр 1900 px заввишки, одна одиниця — близько 350 пікселів,
 * 0.10–0.46 дає 35–160 px». Жодне з цих чисел уже не було правдою:
 * стіна переїхала на 5.4 (ADR-0132), самі константи хтось опустив до
 * 0.07–0.26 і коментар не чіпав, а «1900 px» — це ПІКСЕЛІ ПРИСТРОЮ, тоді
 * як розмір, який бачить око, міряється в CSS-пікселях, тобто вдвічі
 * менший.
 *
 * Переміряно на кадрі, який пара справді бачить (`portalCameraFrame`,
 * аспект 0.46, полотно 896 CSS px, поле зору 42°): камера стоїть за 5.45
 * від осі, тож дальня стіна — за 10.85, і одна одиниця сцени там займає
 * 107 CSS px, а на бічній — 152.
 *
 * Отже 0.07 малювався ВІСІММА CSS-пікселями. На восьми пікселях
 * шестигранна призма не може показати жодної грані: власник побачив
 * бліду напівпрозору цятку й назвав її «прозорий камінець без
 * текстури». 0.16–0.30 дає 17–46 px — розмір, на якому грань є гранню.
 */
const DRUSE_MIN_LENGTH = 0.16;
const DRUSE_MAX_LENGTH = 0.3;
/** Товщина відносно довжини — та сама стрункість, що в еталона. */
const DRUSE_ASPECT = 3.4;
/**
 * Стрункість ДРІБНОЇ друзи — окремим числом, і це не дублювання.
 *
 * Грань читається шириною, а не довжиною. При стрункості 3.4 кристал
 * завдовжки 0.3 має ширину 0.09, тобто 9–13 CSS px на три видимі грані —
 * по чотири пікселі на грань, і жодна з них не існує для ока.
 *
 * Кірка друзи в жеоді й у природі СТОВПЧАСТА, а не шпилева: короткі
 * товсті кристали, що стоять щіткою. 1.9 дає ширину 0.16 — 17–24 CSS px,
 * по шість-вісім на грань. Одинак лишається шпилем: він великий, і йому
 * стрункість не заважає.
 */
const DRUSE_CRUST_ASPECT = 1.9;
/** Кут головки від горизонталі — решітка кварцу, як в еталоні. */
const DRUSE_TERMINATION_DEG = 52;
/**
 * У скільки разів підошва кристала темніша за його ж тіло.
 *
 * Тон самої друзи — 0.62…1.24; 0.42 опускає підошву до 0.26…0.52, тобто
 * рівно в діапазон стіни, з якої вона росте. Не менше: чорна підошва
 * читалась би діркою, а не тінню.
 */
const DRUSE_FOOT_SHADOW = 0.42;
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
  readonly uvs: number[];
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
    uv?: readonly [readonly [number, number], readonly [number, number], readonly [number, number]],
  ): void;
}

function soup(): Soup {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  return {
    positions,
    colors,
    uvs,
    push(a, b, c, shade = 1, uv) {
      positions.push(...a, ...b, ...c);
      const corners = typeof shade === 'number' ? [shade, shade, shade] : shade;
      for (const value of corners) colors.push(value, value, value);
      /*
       * КООРДИНАТИ КЛАДЕ БУДІВНИК, А НЕ `finish`.
       *
       * Вивести їх із позиції вершини — спокуса, і вона ламається рівно в
       * одному місці: `atan2` вертає кут у смузі (−π, π], тож трикутник,
       * що лежить на стику розгортки, дістав би на одному кінці 0.999, а
       * на другому 0.001 — і плитка розтяглась би через усю ланку однією
       * вертикальною смугою. Будівник знає НОМЕР сегмента, а номер
       * продовжується за 39 у 40 без стрибка.
       */
      if (uv === undefined) {
        for (let corner = 0; corner < 3; corner += 1) uvs.push(0, 0);
        return;
      }
      for (const [u, v] of uv) uvs.push(u, v);
    },
  };
}

function finish(mesh: Soup): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(mesh.colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2));
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
/*
 * РОЗКИД ГРАНЕЙ РОЗШИРЕНО ВНИЗ, а не вгору.
 *
 * Було 0.78–1.22, і виміряний кадр показав, у що це виливається: уся
 * стіна вкладалась у 39–61 з 255, тобто дев'ять відсотків шкали. Грані
 * там були, але різниця між ними — двадцять рівнів, і на такому тлі це
 * читається одним аркушем.
 *
 * Піднімати світлий кінець не можна: стіна почала б змагатися з
 * кристалом, а вся печера темна саме для того, щоб він читався. Тому
 * розширено ТЕМНИЙ кінець — 0.58–1.22. Середнє падає, розкид росте
 * удвічі, кристал лишається найяскравішим у кадрі.
 */
const CAVE_FACET_SHADE_MIN = 0.58;
const CAVE_FACET_SHADE_SPAN = 0.64;

/**
 * Скільки плиток зерна лягає навколо зали й на одиницю висоти.
 *
 * Навколо — ціле число, і це не охайність: розгортка замикається на
 * повному оберті, тож дробове число дало б на стику пів плитки й
 * вертикальний шов.
 */
const CAVE_TEXTURE_TILES_AROUND = 6;
/** Одиниць світу на плитку по висоті й по підлозі. */
const CAVE_TEXTURE_UNITS = 2.6;


/**
 * Кут сегмента — з НЕРІВНИМ кроком.
 *
 * Кільце з рівним кроком дає правильний многокутник, і жодна кількість
 * сегментів цього не ховає: грані виходять однакової ширини, а однакова
 * ширина читається токарним верстатом, а не зламом породи. Це та сама
 * думка, яку власник висловив про кристал — «не роби поверхні кривими й
 * шумними, зроби пласкі грані НЕРІВНИМИ», — і для каменю вона та сама.
 *
 * Зсув насінений і обмежений третиною кроку: більше — і сусідні сегменти
 * міняються місцями, менше — і нерівності не видно.
 */
function segmentAngle(seed: number, segment: number, segments: number): number {
  const step = (Math.PI * 2) / segments;
  const jitter = (seededUnit(seed, `cave:azimuth:${((segment % segments) + segments) % segments}`) - 0.5)
    * 0.66 * step;
  return segment * step + jitter;
}

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
   * Біля осі рельєфу немає ВЗАГАЛІ, і тепер це сказано числом, а не
   * покладено на те, що квадрат малий.
   *
   * Там стоїть жеода, і горб під нею підняв би породу вище за власну
   * губу. Тест `ПЛОЩИНА АРТЕФАКТА НЕ ЗРУШИЛА` міряє це прямо: всередині
   * 12% радіуса зали підлога мусить лежати рівно на `PORTAL_GROUND_Y`.
   *
   * Перша редакція мала лише квадратичний ріст від нуля — на слабкому
   * рельєфі (0.02) і першому кільці на 0.14 це проходило випадково.
   * Щойно рельєф став сильнішим (0.045), а кілець більше, найближче
   * кільце опинилось у вікні тесту й дало −0.0094. Тобто інваріант
   * тримався не правилом, а збігом двох чисел.
   *
   * `CAVE_FLOOR_FLAT` навмисно ширший за вікно тесту: межа має стояти за
   * тим, що вона боронить, а не впритул до нього.
   */
  const grow = Math.min(1, Math.max(
    0,
    radius / CAVE_CHAMBER_RADIUS - CAVE_FLOOR_FLAT,
  ) / Math.max(1e-6, 0.55 - CAVE_FLOOR_FLAT)) ** 2;
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
  const angleOf = (segment: number): number => segmentAngle(seed, segment, segments);
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
  const floorShade = (share: number): number => {
    const near = 1 - Math.min(1, share / 0.55);
    /*
     * ВИПАДКОВОСТІ ПО КЛИНАХ БІЛЬШЕ НЕМАЄ, і зняли її не за смаком.
     *
     * Тут стояв власний відтінок на кожен клин, утричі слабший за
     * стінний — із коментарем, що сильніший «дав промені, що
     * розходяться від артефакта». Поки клинів було сорок, слабкого
     * вистачало. На шістдесяти чотирьох ті самі промені повернулись:
     * на світлій темі однорічної пари підлога читалась віялом.
     *
     * Причина в самій формі: клин — це промінь, і будь-яка різниця між
     * сусідніми клинами лягає радіально. Ховати її множником — це
     * лікувати симптом.
     *
     * Тепер деталь підлоги несе ЗЕРНО (ADR-0132), а воно накладається
     * площинно з `xz` і радіальних смуг не має за побудовою. Клин же
     * несе тільки те, що й мусив: падіння яскравості від артефакта до
     * стін.
     */
    return 0.66 + 0.34 * near ** 1.6;
  };

  /** Розгортка підлоги — площинна з `xz`: вона й лежить у цій площині. */
  const floorUv = (point: readonly [number, number, number]): readonly [number, number] => [
    point[0] / CAVE_TEXTURE_UNITS,
    point[2] / CAVE_TEXTURE_UNITS,
  ];

  const centre: [number, number, number] = [0, PORTAL_GROUND_Y, 0];
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    const first = CAVE_FLOOR_RINGS[0]!;
    const centreA = floorPoint(next, first);
    const centreB = floorPoint(segment, first);
    mesh.push(
      centre, centreA, centreB,
      floorShade(first * 0.5),
      [floorUv(centre), floorUv(centreA), floorUv(centreB)],
    );
    for (let ring = 0; ring < CAVE_FLOOR_RINGS.length - 1; ring += 1) {
      const inner = CAVE_FLOOR_RINGS[ring]!;
      const outer = CAVE_FLOOR_RINGS[ring + 1]!;
      const shade = floorShade((inner + outer) * 0.5);
      const si = floorPoint(segment, inner);
      const ni = floorPoint(next, inner);
      const no = floorPoint(next, outer);
      const so = floorPoint(segment, outer);
      mesh.push(si, ni, no, shade, [floorUv(si), floorUv(ni), floorUv(no)]);
      mesh.push(si, no, so, shade, [floorUv(si), floorUv(no), floorUv(so)]);
    }
    const last = CAVE_FLOOR_RINGS[CAVE_FLOOR_RINGS.length - 1]!;
    const edge = floorShade((last + 1) * 0.5);
    const sl = floorPoint(segment, last);
    const nl = floorPoint(next, last);
    const ne = floorPoint(next, 1);
    const se = floorPoint(segment, 1);
    mesh.push(sl, nl, ne, edge, [floorUv(sl), floorUv(nl), floorUv(ne)]);
    mesh.push(sl, ne, se, edge, [floorUv(sl), floorUv(ne), floorUv(se)]);
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
  const angleOf = (segment: number): number => segmentAngle(seed, segment, segments);
  const wallPoint = (segment: number, share: number): [number, number, number] => {
    const angle = angleOf(segment);
    const radius = wallRadiusAt(seed, angle, share);
    /*
     * НИЖНЄ КІЛЬЦЕ СТІНИ СІДАЄ НА РЕЛЬЄФ ПІДЛОГИ, а не на рівний нуль.
     *
     * Було `PORTAL_GROUND_Y` для всіх сегментів — тобто стіна стояла на
     * ідеальній площині, а підлога під нею горбилась на ±2% радіуса
     * зали. Там, де рельєф падав, між ними відкривалась щілина, і крізь
     * неї видно було фон: на знімку це читалось чорною смугою вздовж
     * підніжжя стіни, а настінні кристали над нею — висячими.
     *
     * Обидва краї беруть одну функцію на однакових кутах і радіусах, тож
     * тепер вони збігаються точка в точку, а не приблизно.
     */
    /*
     * Рельєф ЗГАСАЄ ДОГОРИ, і це не косметика — це вимога стику вгорі.
     *
     * Перша редакція цієї правки додавала рельєф на всю висоту, і тест
     * `зала тримає оголошений радіус і висоту` впіймав наслідок одразу:
     * склепіння піднялось разом із підніжжям (3.6965 при оголошених
     * 3.685). Диск розлому будується рівно на `PORTAL_GROUND_Y +
     * CAVE_CEILING_HEIGHT`, тож нерівне склепіння відкрило б щілину саме
     * там, де ми щойно закрили нижню.
     *
     * Отже рельєф повний біля підлоги й нульовий біля розлому: низ
     * сідає на камінь, верх лишається площиною.
     */
    const relief = (floorHeightAt(seed, angle, radius) - PORTAL_GROUND_Y) * (1 - share);
    return [
      Math.cos(angle) * radius,
      PORTAL_GROUND_Y + relief + CAVE_CEILING_HEIGHT * share,
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
      /*
       * `segment + 1`, а не `next`: на стику розгортки номер має
       * продовжуватись у 40, інакше плитка розтягнеться назад через усю
       * ланку. Плиток навколо ціле число, тож 40 і 0 дають однакову
       * точку текстури.
       */
      const uLow = (segment / segments) * CAVE_TEXTURE_TILES_AROUND;
      const uHigh = ((segment + 1) / segments) * CAVE_TEXTURE_TILES_AROUND;
      const vLow = (PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT * low) / CAVE_TEXTURE_UNITS;
      const vHigh = (PORTAL_GROUND_Y + CAVE_CEILING_HEIGHT * high) / CAVE_TEXTURE_UNITS;
      mesh.push(a, b, c, lift * one, [[uLow, vLow], [uHigh, vLow], [uHigh, vHigh]]);
      mesh.push(a, c, d, lift * two, [[uLow, vLow], [uHigh, vHigh], [uLow, vHigh]]);
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
      const angle = segmentAngle(seed, index, segments);
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
      const angle = segmentAngle(seed, index, segments);
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
    const spun = ((cluster + seededUnit(seed, `${tag}:spin`) * 0.7) / clusters) * Math.PI * 2;
    const solitary = cluster % DRUSE_SOLITARY_EVERY === 0;
    /*
     * КУЩ СІДАЄ РІВНО НА ВЕРШИНУ МЕША ПІДЛОГИ, і це не педантизм.
     *
     * `floorHeightAt` — крива; підлога ж намальована сімома кільцями по
     * шістдесят чотири клини, тобто пласкими трикутниками МІЖ вибірками
     * цієї кривої. Між кільцями хорда провисає, і провисає помітно: шум
     * підлоги йде за аргументом `angle * 1.7 + radius`, а крок кільця —
     * майже 0.7, тож у середині клітинки меш нижчий за криву. Виміряно
     * на всіх 92 кущах: до 0.19 одиниці — двадцять пікселів дірки під
     * кристалом, який «стоїть на підлозі».
     *
     * Тому куща садять не в довільній точці, а в тому самому кутку, який
     * будівник підлоги справді поставив: кут клина зі `segmentAngle`,
     * радіус — одне з кілець `CAVE_FLOOR_RINGS`. Там крива й меш
     * збігаються за побудовою.
     */
    const angle = solitary
      ? spun
      : segmentAngle(
        seed,
        Math.round((spun / (Math.PI * 2)) * CAVE_AZIMUTH_SEGMENTS),
        CAVE_AZIMUTH_SEGMENTS,
      );
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
    /*
     * УСЯ ДРУЗА СИДИТЬ БІЛЯ ПІДНІЖЖЯ — і це одинадцята спроба тієї самої
     * речі, тож причина записана як причина, а не як ще одне число.
     *
     * Дрібні кущі розсипались до 34% висоти склепіння. Формально вони
     * вросли в стіну (тест `НЕ ВИСИТЬ У ПОВІТРІ` це й міряє), але
     * ВИСОКО НА СТІНІ контакту не видно НІЧИМ: там немає ні лінії стику
     * з підлогою, ні тіні, ні різниці масштабу — тільки рівна темна
     * грань каменю і світла грудка на ній. Десять попередніх спроб
     * лікували грудку: розмір, тон, нахил, втоплення, кількість. Жодна
     * не могла спрацювати, бо ламався не кристал, а МІСЦЕ.
     *
     * Біля підніжжя стик стіни з підлогою видно, і кристал, що виходить
     * із нього, читається таким, що звідти й виріс. Одинак стояв там від
     * шостої спроби й саме тому єдиний не висів.
     *
     * Верх стіни лишається голим каменем. Це не втрата: печера — це
     * камінь, а друза — те, що росте там, де камінь зустрічає підлогу.
     */
    const share = solitary ? 0.004 + seededUnit(seed, `${tag}:height`) * 0.05 : 0;
    /*
     * ДРІБНА ДРУЗА ВИХОДИТЬ ІЗ ПІДЛОГИ, А НЕ ЗІ СТІНИ.
     *
     * Це одинадцята спроба тієї самої речі, тож тут записана причина, а
     * не ще одне число.
     *
     * Кущі сиділи на стіні й розсипались до 34% висоти склепіння.
     * Формально вони були вросли в камінь — тест `НЕ ВИСИТЬ У ПОВІТРІ`
     * саме це й міряє, і він проходив. Але підлога зали — чаша, і з ока
     * на висоті 0.38 її дальній обід ХОВАЄ підніжжя стіни. Отже точки
     * дотику не видно взагалі: на кадрі є рівна темна грань і світла
     * грудка на ній, і більше нічого. Десять спроб лікували грудку —
     * розмір, тон, нахил, втоплення, кількість, — і жодна не могла
     * спрацювати, бо ламався не кристал, а МІСЦЕ.
     *
     * Тепер кущ стоїть на підлозі між обідом і стіною, тобто на видимій
     * поверхні: око читає дотик із самої площини, без тіні й без світла.
     * Одинак лишається біля стіни — він великий, його підошва нижча за
     * обід, і він єдиний ніколи не висів.
     */
    const wallRadius = solitary
      ? wallRadiusAt(seed, angle, share)
      : wallRadiusAt(seed, angle, 0)
        * CAVE_FLOOR_RINGS[
          DRUSE_FLOOR_FIRST_RING
          + Math.floor(
            seededUnit(seed, `${tag}:reach`)
            * (CAVE_FLOOR_RINGS.length - DRUSE_FLOOR_FIRST_RING),
          )
        ]!;
    const baseX = Math.cos(angle) * wallRadius;
    const baseZ = Math.sin(angle) * wallRadius;
    /*
     * Основа береться від РЕЛЬЄФУ підлоги на тому самому куті, як і
     * підніжжя стіни. Раніше стояв рівний `PORTAL_GROUND_Y`, і поки
     * стіна теж стояла на ньому, це збігалось; відколи обидві сідають на
     * рельєф, друза лишилась би висіти над ним на ±0.12 одиниці.
     */
    const baseY = floorHeightAt(seed, angle, wallRadius) + CAVE_CEILING_HEIGHT * share;

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
      const offset = length / (solitary ? DRUSE_ASPECT : DRUSE_CRUST_ASPECT) / 2;
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
        // Кущ на підлозі росте ВГОРУ з розбігом, а не від стіни: він уже
        // не на стіні, і горизонтальна вісь поклала б його на бік.
        : 1.15 + seededUnit(seed, `${own}:lift`) * 1.1;
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
        /*
         * Кущ на підлозі не розкидається ПО ВЕРТИКАЛІ: висоту йому задає
         * сама підлога, і розбіг угору підняв би підошву над нею. Тест
         * `ДРІБНА ДРУЗА СТОЇТЬ НА ПІДЛОЗІ` упіймав саме це — один
         * кристал стояв на 0.049 вище за камінь під собою.
         */
        baseY + (solitary ? (seededUnit(seed, `${own}:dy`) - 0.5) * spread : 0),
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
        // Кущ на підлозі ховає підошву так само — вниз, у камінь під
        // собою. Горизонтальне втоплення лишилось би від стіни, якої під
        // ним уже немає, а вертикальне ще й покриває той нахил меша, на
        // який кристал відносить власний розбіг по горизонталі.
        root.y -= length * 0.45;
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
        /*
         * ЧЕРГУВАННЯ ТЕПЕР НА ВСІЙ ДРУЗІ, і скасована тут заувага була
         * записана чесно — просто на неміряному числі.
         *
         * Стояло: «дрібна друза тримає вужчий розмах: на двадцяти
         * пікселях сильний контраст читається не гранями, а сміттям», і
         * розмах був 0.86/1.00/1.14 — чотирнадцять відсотків між
         * сусідніми гранями при тридцяти, які цей проєкт вважає межею
         * «читається кристалом».
         *
         * Двадцяти пікселів не було. Виміряно на знімку з телефона
         * власника: пляма мала 8 CSS px і 5% розмаху всередині —
         * рівна бузкова цятка. Тобто вужчий розмах не рятував від сміття,
         * він робив сміття рівним.
         *
         * Розмір виправлено вище; тут лишається друга половина причини —
         * грані фарбуються тим самим циклом через одну, що й одинак і що
         * сам артефакт (ADR-0120).
         */
        const own = DRUSE_FACE_SHADES[(face + shadeShift) % DRUSE_FACE_SHADES.length]!;
        /*
         * ПІДОШВА ТЕМНІША ЗА ВІСТРЯ — власна тінь кристала, намальована.
         *
         * Це те, чого не вистачало всім десяти спробам, і жодна з них не
         * могла цього дати числом, яке крутили. Кристал на намальованій
         * стіні не має тіні: печера НЕ ОСВІТЛЕНА (див. коментар до
         * `soup`), тож жодне джерело не покладе під нього пляму. А без
         * плями під підошвою око не має за що зачепитись і читає світлу
         * грудку на рівному камені як предмет ПЕРЕД стіною.
         *
         * Тінь тому кладеться вершинним кольором: низ кристала гасне до
         * тону самої стіни, вістря лишається кристалом. Коштує нуль
         * трикутників і нуль світла, і це та сама мова, якою намальовано
         * весь камінь навколо.
         */
        const foot = shade * own * DRUSE_FOOT_SHADOW;
        const body = shade * own;
        mesh.push(bottomLeft, bottomRight, topRight, [foot, foot, body]);
        mesh.push(bottomLeft, topRight, topLeft, [foot, body, body]);
        mesh.push(topLeft, topRight, apex, shade * (solitary ? 1.28 : 1.16));
      }
    }
  }

  return finish(mesh);
}
