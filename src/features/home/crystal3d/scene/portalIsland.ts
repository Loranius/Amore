// ============================================================
// Літаючий острів із малим давнім храмом — місце, у якому стоїть артефакт.
// ------------------------------------------------------------
// ЩО ЦЕ ЗАМІНЮЄ. Кристальну печеру (ADR-0117): залу з розломом у
// склепінні, друзою по стінах і променем із стелі. Власник скасував її
// прямо: «зміни фон на кристалі повністю, прибираємо печеру, робимо
// древній маленький храм, який знаходиться на літаючому острові».
//
// ЩО ЛИШАЄТЬСЯ НЕЗМІННИМ, І ЦЕ НЕ ФОРМАЛЬНІСТЬ:
//
//  • Верх острова лягає рівно на `PORTAL_GROUND_Y` — ту саму площину, на
//    якій рушій ставить кристали. Про заміну сцени не дізнається жоден
//    інший файл, так само як це було з руїною і з печерою.
//  • Артефакт стоїть на власній жеоді, а не на храмі. `DESIGN.md` каже
//    прямо, чому попередній храм скасували: подіум був ПІДСТАВКОЮ, а
//    гладка суцільна поверхня під кристалом читається п'єдесталом. Тому
//    храм тут стоїть ЗБОКУ й ПОЗАДУ, він малий, і під кристалом його
//    немає. Єдина дозволена опора артефакта — жеода.
//  • Усе намальоване, а не освітлене (`meshBasicMaterial` + вершинний
//    колір). Причина виміряна й не залежить від того, який тут світ:
//    світла, якого досить, щоб показати камінь за десять одиниць, залило
//    б кристал за три, а різниця яскравості сусідніх граней і є те, що
//    робить кристал кристалом.
//  • Жодної кривої поверхні: камінь ламається пласко. Кожен трикутник має
//    власні три вершини й власну нормаль (`The Flat Facet Rule`).
//
// ЯК ЧИТАЄТЬСЯ «ЛІТАЮЧИЙ», І ЧОМУ ЦЕ НЕ ОЧЕВИДНО. Камера порталу стоїть
// на 8–17° над площиною острова, тож дальню кручу острова вона не бачить
// узагалі: та повернута від глядача. Отже «острів у повітрі» не можна
// показати самим обривом — його показує те, що видно ЗА краєм і ПІД ним:
//
//  • небо (полотно прозоре, під ним CSS-небо теми);
//  • брили, що висять у повітрі за островом, вище за лінію його краю;
//  • море хмар далеко внизу.
//
// Останнє — арифметика, а не смак. Промінь, що проходить над дальнім
// краєм острова, має нахил менший за 11°; шар хмар на 9 одиниць нижче за
// острів потрапляє в цю щілину лише з відстані від п'ятдесяти одиниць.
// Тому хмари стоять на 55–130 і не беруть туману: інакше вони були б
// рівно кольору туману, тобто нічим.
// ============================================================
import * as THREE from 'three';
import { PORTAL_KEY_LIGHT } from './portalScene';

/**
 * ОСТРІВ БУДУЄТЬСЯ В ОДИНИЦЯХ ОСТРОВА: радіус рівно 1, верх плато на 0.
 *
 * Світові координати йому дає `PortalEnvironment` одним `scale` і одним
 * `position`, і саме тому вся сцена лишається однією й тією ж
 * композицією в один рік і в сорок.
 *
 * ЧОМУ НЕ ПРИБИТИЙ РОЗМІР. Кадр порталу підганяється під артефакт: чим
 * старша пара, тим далі стоїть камера. Острів сталого розміру означав би
 * дві різні сцени — у молодої пари він виходить за обидва краї кадру й
 * читається рівниною, у старої губиться камінцем під кристалом. Виміряно
 * на кадрі: на четвертому році півширина кадру 1.93 одиниці, на
 * сороковому — 3.9.
 *
 * Масштаб іде за відстанню камери, тож ЕКРАННИЙ розмір острова сталий, і
 * всю арифметику цієї сцени — щілину над краєм, висоту хмар, виліт брил —
 * достатньо порахувати один раз.
 */
export const PORTAL_ISLAND_RADIUS = 1;

/**
 * Скільки світових одиниць острова припадає на одиницю відстані камери.
 *
 * 0.30, і межу задає кадр: півширина кадру на глибині артефакта дорівнює
 * `відстань × 0.3532`. Отже при 0.30 бічні краї острова стоять на 85%
 * півширини — тобто В КАДРІ, з небом обабіч. Це і є те єдине, що показує
 * «острів», а не «рівнина»: видно, де камінь кінчається.
 *
 * Більше за 0.3532 — і краї виходять за кадр при будь-якому віці пари.
 *
 * 0.30 → 0.244 (ADR-0164). Власник показав еталон, де острів займає близько
 * сімдесяти відсотків півширини кадру, а не вісімдесяти п'яти: над ним і під
 * ним є небо, і саме воно робить його ЛІТАЮЧИМ. 0.244 × 0.3532 і дає ті
 * сімдесят.
 */
const ISLAND_SCALE_PER_DISTANCE = 0.15;

/**
 * Світовий масштаб острова для цього кадру.
 *
 * Читається `PortalEnvironment` і більше ніким: сцена мусить мати один
 * масштаб, а не по одному на меш.
 */
export function portalIslandScale(cameraDistance: number): number {
  return Math.max(1, cameraDistance) * ISLAND_SCALE_PER_DISTANCE;
}

/**
 * На якому радіусі стоїть камера, В ОДИНИЦЯХ ОСТРОВА.
 *
 * Масштаб іде за відстанню, тож це число СТАЛЕ в будь-якому віці пари — і
 * саме тому воно годиться в гарантію, а не в запас.
 *
 * Опубліковане, бо його знають ДВОЄ: брили в небі (вони мусять висіти за
 * ним) і тест, що це стереже. Поки воно було вписане числом 4.6, зміна
 * масштабу острова тихо завела брили ВСЕРЕДИНУ кільця — 6.67 проти
 * колишніх 3.33, — і жодне з тих 4.6 про це не сказало (ADR-0164).
 */
export const PORTAL_CAMERA_RING = PORTAL_ISLAND_RADIUS / ISLAND_SCALE_PER_DISTANCE;

/** Скільки клинів у круга острова. */
export const PORTAL_ISLAND_SEGMENTS = 72;

/**
 * Кільця верхньої поверхні, у частках радіуса.
 *
 * Нерівномірні: біля краю щільніше, бо саме там поверхня падає й саме там
 * її силует читається на тлі неба.
 */
const ISLAND_TOP_RINGS: readonly number[] = [0.13, 0.28, 0.44, 0.6, 0.74, 0.85, 0.94, 1];

/**
 * Скільки кілець має верх острова.
 *
 * Публікується, бо густина моху задана ЧАСТКОЮ вкритих клітинок, а
 * клітинок на плато — `сегменти × (кільця - 2) × 2`. Тест, який виписав
 * би це число рукою, застряг би на сьогоднішній топології й мовчки
 * розійшовся б із нею завтра.
 */
export const PORTAL_ISLAND_TOP_RING_COUNT = ISLAND_TOP_RINGS.length;

/**
 * Скільки трикутників на початку меша острова належать ВЕРХУ.
 *
 * Публікується з тієї ж причини, з якої підкладка артефакта публікує
 * `seamTriangleCount`: перевірити, що уламок стоїть на плато, можна лише
 * проти самого ПЛАТО, а в одному меші за ним ідуть іще обрив, корінь і
 * ті самі уламки. Число тут — не вимір, а будова: віяло в центрі плюс
 * кільця.
 */
export const PORTAL_ISLAND_CROWN_TRIANGLES = PORTAL_ISLAND_SEGMENTS * (1 + (8 - 1) * 2);

/**
 * Частка радіуса, всередині якої рельєфу немає ВЗАГАЛІ.
 *
 * Там стоїть жеода, і горб під нею підняв би породу вище за її власну
 * губу. Це та сама межа, що боронила підлогу печери, і вона так само
 * ширша за вікно тесту: межа має стояти за тим, що вона боронить.
 */
const ISLAND_FLAT = 0.44;


/** Розмах рельєфу верху, у частках радіуса. */
const ISLAND_RELIEF = 0.055;

/**
 * ДРУГИЙ, ДРІБНИЙ ОКТАВ РЕЛЬЄФУ — і без нього плато було горбом.
 *
 * Виміряно проти еталона з Blender, у якому камінь ламали зміщенням і
 * пласким спрощенням (ADR-0147). Мірка — двогранний кут між сусідніми
 * гранями, узятий лише на гранях, ПОВЕРНУТИХ УГОРУ, тобто на тій
 * поверхні, на яку пара й дивиться згори:
 *
 *   еталон  медіана 13.7°, середнє 19.9°
 *   плато   медіана  5.5°, середнє 11.9°
 *
 * Тобто наша поверхня була вдвічі з половиною гладшою за биту породу.
 * Один великий октав дає пагорби, а не злам: між сусідніми вершинами
 * висота майже не міняється, і кожна грань виходить майже в площині
 * сусідньої. Другий октав із частотою всемеро вищою і є те, що ламає.
 */
const ISLAND_GRIT = 0.04;

/**
 * Розбіг вершин ПО РАДІУСУ, у частках щілини до найближчого сусіднього
 * кільця.
 *
 * Друга половина тієї ж вади, і міряє її розкид площ граней: 0.52 в нас
 * проти 1.08 в еталона. Причина суто в будові — кільцева сітка дає
 * трикутники однакового розміру в межах кільця, а однаковий розмір
 * читається токарним верстатом, хай яким рваним буде рельєф по висоті.
 * Зсув кожної вершини вздовж її ж радіуса ламає саму ґратку.
 */
const ISLAND_LATTICE = 0.62;


/** Скільки контрольних точок у кільцевому шумі. Просте число — навмисно. */
const ISLAND_NOISE_POINTS = 19;

/** Наскільки рваний обрис острова, у частках радіуса. */
const ISLAND_RIM_NOISE = 0.11;

/**
 * Наскільки край острова просів нижче за середину.
 *
 * Не оздоба: рівний по висоті край дає ідеальне коло на тлі неба, а
 * ідеальне коло читається тарілкою. Просідання починається з 0.7 радіуса
 * й доходить до повного на самому обрисі.
 */
const ISLAND_EDGE_DROP = 0.1;

/** З якої частки радіуса край починає падати. */
const ISLAND_EDGE_FROM = 0.7;

/**
 * Корінь острова — те, що висить під ним.
 *
 * З типової камери його не видно жодним пікселем, і він усе одно тут:
 * у пісочниці є вільна камера, а острів без низу з неї читається
 * вирізаним колом. Рівні звужуються й тонуть, останній сходиться в
 * кілька вістер, а не в одну голку — злам породи не буває конусом.
 */
const ISLAND_ROOT_LEVELS: readonly (readonly [number, number])[] = [
  /*
   * КАРНИЗ — ПЕРШИЙ РІВЕНЬ, І ВІН ШИРШИЙ ЗА КРОМКУ.
   *
   * Знайдено виміром проти еталона з Blender (ADR-0145). Верх острова НЕ
   * має бути його найширшим місцем: під кромкою скеля нависає, бо м'яку
   * породу вимило, а тверда лишилась карнизом. Якщо найширше збігається з
   * верхом, тіло — усічений конус, тобто плита.
   *
   * Формально карниз у нас БУВ — але на 0.022 радіуса нижче за кромку
   * проти 0.211 в еталона, тобто вдесятеро мілкіший, та ще й зроблений
   * шумом, а не будовою: найширшою точкою виявлявся випадковий виступ
   * першого кільця кореня. На силуеті це читалось як фаска, а не як
   * карниз.
   */
  [1.13, 0.26],
  [0.86, 0.52],
  [0.62, 0.86],
  [0.28, 1.2],
];

/**
 * Рівень карниза шумить утричі слабше за решту кореня.
 *
 * Карниз — це те, що видно на силуеті збоку, і рваний карниз перестає
 * бути карнизом: найширша точка знову стає випадковою, а вимір —
 * випадковим разом із нею. Нижче обрив може ламатись як завгодно.
 */
const ISLAND_CORNICE_CALM = 0.34;

/**
 * На скільки рядів ділиться кожен оголошений проліт кореня.
 *
 * ЧОТИРИ РІВНІ РОБИЛИ З ОБРИВУ ГРЕБІНЕЦЬ. Між кромкою й карнизом ішла
 * ОДНА смуга на всю висоту обриву, і на екрані вона читалась не каменем,
 * а зачесаними вертикальними пасмами: трикутник заввишки в третину
 * острова й завширшки в один клин має співвідношення сторін близько
 * восьми до одного, і жоден шум по радіусу цього не ховає.
 *
 * Два ряди на проліт дають вісім поясів замість чотирьох. Форма при
 * цьому не змінюється: оголошені рівні лишаються тими самими точками,
 * між ними лінійна частка, а власний шум кожного ряду ламає її на
 * породу.
 *
 * ДВА, А НЕ ТРИ, І ЦЕ СТЕЛЯ БЮДЖЕТУ, А НЕ СМАК. При трьох рядах острів
 * дає 4 634 трикутники при межі 4 200 («стеля не задерта»), тобто
 * з'їдає бюджет, який належить сцені цілком. Два ряди вкладаються.
 */
const ISLAND_ROOT_ROWS = 2;

/** Наскільки глибоко сходяться вістря кореня. */
const ISLAND_ROOT_TIP = 1.6;

/** Розмах шуму кореня, у частках його радіуса на цьому рівні. */
const ISLAND_ROOT_NOISE = 0.22;

/**
 * Одиниць світу на плитку зерна каменю.
 *
 * 2.6 приїхало з печери, де стіна була заввишки 4.4 і плитка вкладалась
 * двічі. Острів має 2 одиниці впоперек, і на тих самих 2.6 зерно
 * вклалось би однією коміркою на всю сцену, тобто рівною плямою. Це та
 * сама вада, що в ADR-0139 і ADR-0140; тут вона не пережила навіть
 * переїзду. 0.28 дає близько семи плиток упоперек плато.
 */
const ROCK_TEXTURE_UNITS = 0.28;

/** Скільки плиток зерна лягає навколо острова по обрису. */
const ROCK_TILES_AROUND = 8;

/**
 * Скільки уламків лежить на плато. Веде профіль якості, як усе, чого
 * може бути більше або менше без шкоди для змісту сцени.
 */
export const PORTAL_ISLAND_RUBBLE: Record<'high' | 'balanced' | 'low' | 'fallback', number> = {
  high: 16, balanced: 11, low: 6, fallback: 0,
};

/** Скільки брил висить у повітрі навколо острова. */
export const PORTAL_DRIFT_ROCKS: Record<'high' | 'balanced' | 'low' | 'fallback', number> = {
  high: 34, balanced: 22, low: 12, fallback: 0,
};

/** Скільки хмар у морі хмар унизу. */
export const PORTAL_CLOUD_BANKS: Record<'high' | 'balanced' | 'low' | 'fallback', number> = {
  // 18 → 46 (ADR-0165). Море хмар в еталоні власника — це ТЛО, а не смуга
  // на обрії: воно займає більшу частину кадру. Вісімнадцять пелюсток на
  // повне коло давали пасмо через кожні двадцять градусів, тобто рідке
  // мереживо. Бюджет на це власник дав.
  high: 46, balanced: 30, low: 16, fallback: 0,
};

// ── Насіння й шум ───────────────────────────────────────────

/**
 * Насінний шум 0…1, детермінований і без стрибка на замиканні кола.
 *
 * Власний, а не з `substrate.ts`: та функція живе в рушії, а рушій не
 * імпортують зі сцени. Формула та сама — і це навмисне повторення
 * чотирьох рядків замість залежності через межу тому.
 */
function seededUnit(seed: number, label: string): number {
  let hash = 2166136261 ^ Math.trunc(seed);
  for (let index = 0; index < label.length; index += 1) {
    hash = Math.imul(hash ^ label.charCodeAt(index), 16777619);
  }
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

// ── Суп із трикутників ──────────────────────────────────────

type Point = readonly [number, number, number];
type Uv = readonly [number, number];

interface Soup {
  readonly positions: number[];
  readonly colors: number[];
  readonly uvs: number[];
  /**
   * Власний рух тіла, що зараз будується: [фаза, темп] або `null`.
   *
   * Один меш несе всі брили — інакше сцена платила б draw call за кожну, —
   * тож щоб вони левітували НЕ В ОДИН ГОЛОС, кожна вершина мусить знати, до
   * якої брили належить. Будівник ставить це поле перед тим, як класти
   * трикутники чергового тіла, і воно їде у вершинний атрибут (ADR-0162).
   */
  float: readonly [number, number] | null;
  /** Пари [фаза, темп], по одній на вершину. Порожньо — меш нерухомий. */
  readonly floats: number[];
  /**
   * Непрозорість тіла, що зараз будується: 1 — суцільне.
   *
   * Той самий прийом, що й `float`, і з тієї ж причини. Усі хмари живуть в
   * одному меші, тож дальня не може бути слабшою за ближню інакше, ніж
   * повершинно. Будівник ставить це поле перед трикутниками чергового
   * тіла (ADR-0165).
   */
  alpha: number | readonly [number, number, number];
  /** По одному значенню на вершину. Усі одиниці — меш непрозорий. */
  readonly alphas: number[];
  /**
   * Зсув вершини В ПЛОЩИНІ ЕКРАНА: [праворуч, угору] в одиницях меша.
   *
   * Той самий прийом, що `float` і `alpha`, і з тієї ж причини — але тут
   * він робить те, чого геометрією не зробиш узагалі: БІЛБОРД. Тіло, яке
   * має світитися навколо артефакта з будь-якого боку, не може бути
   * пласким чотирикутником у світі: пара крутить острів рукою, і такий
   * чотирикутник показав би ребро. Зсув у площині екрана рахує вершинний
   * шейдер (ADR-0170), а сюди кладеться тільки те, НАСКІЛЬКИ зсувати.
   *
   * `null` — вершина лишається там, де стоїть. Так живе саме кільце.
   */
  glow: readonly [number, number] | null;
  /** Пари зсувів, по одній на вершину. Усі нулі — білбордів немає. */
  readonly glows: number[];
  push(
    a: Point,
    b: Point,
    c: Point,
    shade?: number | readonly [number, number, number],
    uv?: readonly [Uv, Uv, Uv],
  ): void;
}

/**
 * Суп, а не індексована сітка.
 *
 * Спільна вершина усереднює нормалі сусідніх граней, і скеля стає надутою
 * кулею. Тут кожен трикутник має власні три вершини, тож кожна грань має
 * власну нормаль і ловить своє світло — те саме, чим кристал
 * відрізняється від гладкої форми.
 */
function soup(): Soup {
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const floats: number[] = [];
  const alphas: number[] = [];
  const glows: number[] = [];
  return {
    positions,
    colors,
    uvs,
    floats,
    float: null,
    alphas,
    alpha: 1,
    glows,
    glow: null,
    push(a, b, c, shade = 1, uv) {
      if (this.float !== null) {
        for (let corner = 0; corner < 3; corner += 1) floats.push(this.float[0], this.float[1]);
      }
      /*
       * Або одне число на тіло, або три на кути — так само, як `shade`.
       * Три знадобились водоспаду: стрічка мусить згасати ВЗДОВЖ падіння,
       * а одне число на трикутник дало б смуги завширшки з ланку.
       */
      if (typeof this.alpha === 'number') {
        for (let corner = 0; corner < 3; corner += 1) alphas.push(this.alpha);
      } else {
        alphas.push(...this.alpha);
      }
      for (let corner = 0; corner < 3; corner += 1) {
        glows.push(this.glow?.[0] ?? 0, this.glow?.[1] ?? 0);
      }
      positions.push(...a, ...b, ...c);
      const corners = typeof shade === 'number' ? [shade, shade, shade] : shade;
      for (const value of corners) colors.push(value, value, value);
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
  /*
   * Колір із четвертим каналом — ЛИШЕ там, де прозорість справді
   * різна. Умова та сама, що й нижче в атрибуті руху, і з тієї ж
   * причини: меш, у якому всі тіла суцільні, не має носити канал, у
   * якому всюди одиниця. three вмикає `USE_COLOR_ALPHA` саме за
   * `itemSize === 4`, тож четвертий канал тут — не декорація, а вимикач
   * іншої гілки шейдера.
   */
  const graded = mesh.alphas.some((value) => value < 1);
  if (graded) {
    const rgba: number[] = [];
    mesh.alphas.forEach((alpha, vertex) => {
      rgba.push(
        mesh.colors[vertex * 3] ?? 1,
        mesh.colors[vertex * 3 + 1] ?? 1,
        mesh.colors[vertex * 3 + 2] ?? 1,
        alpha,
      );
    });
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(rgba, 4));
  } else {
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(mesh.colors, 3));
  }
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2));
  /*
   * Атрибут руху ставиться ЛИШЕ там, де тіла справді ворушаться, і це не
   * заощадження двох флоатів на вершину. Меш без нього не можна зрушити
   * навіть помилково: острів стоїть нерухомо тому, що йому нічим рухатись,
   * а не тому, що хтось не забув передати нуль (ADR-0162).
   */
  if (mesh.floats.length > 0) {
    geometry.setAttribute('portalFloat', new THREE.Float32BufferAttribute(mesh.floats, 2));
  }
  /*
   * Той самий закон, що вище: атрибут білборда ставиться ЛИШЕ там, де
   * хоч одна вершина справді зсувається. Меш без нього не можна
   * розвернути до камери навіть помилково.
   */
  if (mesh.glows.some((value) => value !== 0)) {
    geometry.setAttribute('portalGlow', new THREE.Float32BufferAttribute(mesh.glows, 2));
  }
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

// ── Намальоване світло ──────────────────────────────────────

/**
 * Напрямок ключа, порахований ЛІНИВО.
 *
 * Не константа модуля, і причина конкретна: `portalScene` імпортує цей
 * файл заради виміру вартості сцени, а цей файл імпортує `portalScene`
 * заради площини землі й позиції ключа. Коло замикається, і на момент
 * ініціалізації модуля `PORTAL_KEY_LIGHT` ще `undefined` — вимір падав
 * саме тут. Усередині функції кола вже немає: до першого виклику обидва
 * модулі готові.
 */
let keyDirection: Point | null = null;
function key(): Point {
  if (keyDirection === null) {
    const [x, y, z] = PORTAL_KEY_LIGHT.position;
    const length = Math.hypot(x, y, z) || 1;
    keyDirection = [x / length, y / length, z / length];
  }
  return keyDirection;
}

/**
 * Яскравість грані від її нахилу до ключового світла.
 *
 * Сцена НЕ освітлена (див. шапку), тож напрямок світла доводиться
 * запікати. Береться той самий `PORTAL_KEY_LIGHT`, що освітлює артефакт:
 * інакше камінь і кристал ловили б світло з різних боків, і сцена
 * розпалась би на два світи в одному кадрі.
 *
 * Нижня межа не нуль: грань, повернута від сонця, у природі бачить небо,
 * а не порожнечу. Нуль тут читався б дірою.
 */
function litShade(normal: Point, floor = 0.5, span = 0.5): number {
  const length = Math.hypot(normal[0], normal[1], normal[2]) || 1;
  const direction = key();
  const dot = (normal[0] * direction[0] + normal[1] * direction[1] + normal[2] * direction[2]) / length;
  return floor + span * Math.max(0, dot);
}

/** Нормаль трикутника за правилом правої руки. */
function faceNormal(a: Point, b: Point, c: Point): Point {
  const ux = b[0] - a[0]; const uy = b[1] - a[1]; const uz = b[2] - a[2];
  const vx = c[0] - a[0]; const vy = c[1] - a[1]; const vz = c[2] - a[2];
  return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
}

/** Трикутник, пофарбований власним нахилом до ключа. */
function pushLit(mesh: Soup, a: Point, b: Point, c: Point, tint = 1, uv?: readonly [Uv, Uv, Uv]): void {
  mesh.push(a, b, c, litShade(faceNormal(a, b, c)) * tint, uv);
}

/** Чотирикутник як два трикутники, з однією нормаллю на обидва. */
function pushQuad(mesh: Soup, a: Point, b: Point, c: Point, d: Point, tint = 1): void {
  pushLit(mesh, a, b, c, tint);
  pushLit(mesh, a, c, d, tint);
}

/**
 * Розгортка каменю по ДОМІНАНТНІЙ ОСІ ГРАНІ.
 *
 * Плато має власну розгортку з `xz` — воно в цій площині й лежить. Брили
 * й уламки лежать як завгодно, і та сама проєкція розмазала б зерно на
 * стінках у смуги. Тому вісь вибирає сама грань: у майже горизонтальної
 * це `xz`, у майже вертикальної — та з двох бічних площин, куди вона
 * повернута ширшим боком.
 *
 * ОДИНИЦІ ТІ САМІ, ЩО В ПЛАТО, і це не заощадження рядка: брила — шматок
 * цього ж каменю, тож зерно на ній мусить бути того ж розміру, що на
 * плато під нею. Різний масштаб на одному камені око ловить одразу, хай
 * і не знає, що саме побачило.
 */
function rockUv(a: Point, b: Point, c: Point): readonly [Uv, Uv, Uv] {
  const normal = faceNormal(a, b, c);
  const alongX = Math.abs(normal[0]);
  const alongY = Math.abs(normal[1]);
  const alongZ = Math.abs(normal[2]);
  const project = (point: Point): Uv => {
    if (alongY >= alongX && alongY >= alongZ) {
      return [point[0] / ROCK_TEXTURE_UNITS, point[2] / ROCK_TEXTURE_UNITS];
    }
    if (alongX >= alongZ) return [point[2] / ROCK_TEXTURE_UNITS, point[1] / ROCK_TEXTURE_UNITS];
    return [point[0] / ROCK_TEXTURE_UNITS, point[1] / ROCK_TEXTURE_UNITS];
  };
  return [project(a), project(b), project(c)];
}

/** Трикутник каменю: власний нахил до ключа плюс зерно. */
function pushRock(mesh: Soup, a: Point, b: Point, c: Point, tint = 1): void {
  pushLit(mesh, a, b, c, tint, rockUv(a, b, c));
}

/** Чотирикутник каменю. Обидва трикутники беруть нормаль першого. */
function pushRockQuad(mesh: Soup, a: Point, b: Point, c: Point, d: Point, tint = 1): void {
  pushRock(mesh, a, b, c, tint);
  pushRock(mesh, a, c, d, tint);
}

// ── Острів ──────────────────────────────────────────────────

/**
 * Кут клина — з НЕРІВНИМ кроком.
 *
 * Кільце з рівним кроком дає правильний многокутник, і жодна кількість
 * сегментів цього не ховає: грані виходять однакової ширини, а однакова
 * ширина читається токарним верстатом, а не зламом породи.
 */
function segmentAngle(seed: number, segment: number, segments: number): number {
  const step = (Math.PI * 2) / segments;
  const jitter = (seededUnit(seed, `island:azimuth:${((segment % segments) + segments) % segments}`) - 0.5)
    * 0.66 * step;
  return segment * step + jitter;
}

/** Радіус обрису острова в напрямку `angle`. Читається ще й перевірками. */
export function portalIslandRadiusAt(seed: number, angle: number): number {
  return islandRadiusAt(seed, angle);
}

/** Радіус обрису острова в напрямку `angle`. */
function islandRadiusAt(seed: number, angle: number): number {
  const noise = (ringNoise(seed, 'island:rim', angle, ISLAND_NOISE_POINTS) - 0.5) * 2 * ISLAND_RIM_NOISE;
  return PORTAL_ISLAND_RADIUS * (1 + noise);
}

/**
 * Висота верхньої поверхні на частці `share` радіуса в напрямку `angle`.
 *
 * Експортується навмисно: на цю поверхню сідають уламки й храм, і сідати
 * вони мусять на ТУ САМУ функцію, інакше між каменем і тим, що на ньому
 * лежить, з'явиться щілина.
 */
export function portalIslandHeightAt(seed: number, angle: number, share: number): number {
  const relief = (ringNoise(seed, 'island:relief', angle * 1.7 + share * 4.1, ISLAND_NOISE_POINTS) - 0.5)
    * 2 * ISLAND_RELIEF * PORTAL_ISLAND_RADIUS;
  // Дрібний октав — усемеро частіший. Саме він дає злам замість пагорбів.
  const grit = (ringNoise(seed, 'island:grit', angle * 11.9 + share * 27.3, ISLAND_NOISE_POINTS) - 0.5)
    * 2 * ISLAND_GRIT * PORTAL_ISLAND_RADIUS;
  const grow = Math.min(1, Math.max(0, share - ISLAND_FLAT) / Math.max(1e-6, 0.55 - ISLAND_FLAT)) ** 2;
  const edge = Math.min(1, Math.max(0, share - ISLAND_EDGE_FROM) / (1 - ISLAND_EDGE_FROM)) ** 1.6;
  return (relief + grit) * grow - ISLAND_EDGE_DROP * edge;
}

/**
 * Яскравість верху: світліше під артефактом, темніше до краю.
 *
 * Єдине світло, яке тут справді є, — сам кристал, і воно падає йому під
 * ноги. Радіальної випадковості по клинах немає навмисно: клин — це
 * промінь, і будь-яка різниця між сусідніми клинами лягає віялом.
 */
function crownShade(share: number): number {
  const near = 1 - Math.min(1, share / 0.75);
  return 0.62 + 0.38 * near ** 1.6;
}

/**
 * Вершина плато на перетині клина `segment` і кільця `ring`.
 *
 * КІЛЬЦЕ ПРИХОДИТЬ НОМЕРОМ, А НЕ ЧАСТКОЮ, і це не стиль. Зсув вершини
 * обмежується ВІДСТАННЮ ДО СУСІДНІХ КІЛЕЦЬ, а її без номера не дізнатись.
 */
function crownPoint(seed: number, segment: number, ring: number): Point {
  const angle = segmentAngle(seed, segment, PORTAL_ISLAND_SEGMENTS);
  const share = ISLAND_TOP_RINGS[ring]!;
  /*
   * Кожна вершина зсунута ВЗДОВЖ ВЛАСНОГО РАДІУСА, і це ламає ґратку, а
   * не поверхню. Кільцева сітка дає трикутники однакового розміру в межах
   * кільця; однаковий розмір читається токарним верстатом, хай яким
   * рваним буде рельєф по висоті.
   *
   * ЗСУВ МІРЯЄТЬСЯ ЩІЛИНОЮ ДО СУСІДІВ, а не часткою радіуса, і цю межу
   * знайшов тест. Кільця стоять нерівномірно — найтісніші 0.94 і 1.0, між
   * ними 0.06, — і зсув у 11.5% радіуса перекидав вершину ЗА сусіднє
   * кільце: трикутники вивертались, і `ВЕРХ ДИВИТЬСЯ ВГОРУ` впав. На
   * екрані це дірка, крізь яку видно небо.
   */
  const below = ring > 0 ? share - ISLAND_TOP_RINGS[ring - 1]! : share;
  const above = ring + 1 < ISLAND_TOP_RINGS.length
    ? ISLAND_TOP_RINGS[ring + 1]! - share
    : share * 0.1;
  const room = Math.min(below, above) * ISLAND_LATTICE;
  const moved = share + (seededUnit(seed, `island:lattice:${segment}:${ring}`) - 0.5) * 2 * room;
  const radius = islandRadiusAt(seed, angle) * moved;
  return [
    Math.cos(angle) * radius,
    /*
     * Висота береться від ЗСУНУТОЇ частки, а не від початкової: інакше
     * вершина стояла б на висоті чужого місця, і рельєф розмазало б
     * поперек власного зсуву.
     */
    portalIslandHeightAt(seed, angle, moved),
    Math.sin(angle) * radius,
  ];
}

/** Розгортка верху — площинна з `xz`: він у цій площині й лежить. */
function crownUv(point: Point): Uv {
  return [point[0] / ROCK_TEXTURE_UNITS, point[2] / ROCK_TEXTURE_UNITS];
}

/**
 * Рівні кореня після подрібнення: оголошені точки плюс проміжні ряди.
 *
 * Виводиться, а не оголошується: `ISLAND_ROOT_LEVELS` лишається єдиним
 * місцем, де сказано, якої форми корінь, а це — лише те, скількома
 * поясами ця форма малюється.
 */
const ISLAND_ROOT_ROWS_ALL: readonly (readonly [number, number])[] = (() => {
  const out: (readonly [number, number])[] = [];
  const rim: readonly [number, number] = [1, 0];
  for (let level = 0; level < ISLAND_ROOT_LEVELS.length; level += 1) {
    const from = level === 0 ? rim : ISLAND_ROOT_LEVELS[level - 1]!;
    const to = ISLAND_ROOT_LEVELS[level]!;
    for (let row = 1; row <= ISLAND_ROOT_ROWS; row += 1) {
      const t = row / ISLAND_ROOT_ROWS;
      out.push([
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ]);
    }
  }
  return out;
})();

/**
 * Який із оголошених рівнів цей ряд представляє. Потрібно тільки для
 * карниза: він спокійніший за решту, і спокій належить йому, а не
 * порядковому номеру ряду.
 */
function rootBand(level: number): number {
  return Math.floor(level / ISLAND_ROOT_ROWS);
}

function rootPoint(seed: number, segment: number, level: number): Point {
  const angle = segmentAngle(seed, segment, PORTAL_ISLAND_SEGMENTS);
  const [share, drop] = ISLAND_ROOT_ROWS_ALL[level]!;
  const calm = rootBand(level) === 0 ? ISLAND_CORNICE_CALM : 1;
  const noise = (seededUnit(seed, `island:root:${segment}:${level}`) - 0.5)
    * 2 * ISLAND_ROOT_NOISE * calm;
  const radius = islandRadiusAt(seed, angle) * share * (1 + noise);
  const sag = (seededUnit(seed, `island:sag:${segment}:${level}`) - 0.5) * 0.34 * calm;
  return [
    Math.cos(angle) * radius,
    portalIslandHeightAt(seed, angle, 1) - drop + sag,
    Math.sin(angle) * radius,
  ];
}

/**
 * Острів: плато, обрив по обрису й корінь, що висить під ним.
 *
 * Уламки кладуться сюди ж, а не окремим мешем: камінь у них той самий,
 * тож окремий меш коштував би зайвий draw call і нічого не давав.
 */
export function buildPortalIslandGeometry(seed: number, rubble: number): THREE.BufferGeometry {
  const mesh = soup();
  const segments = PORTAL_ISLAND_SEGMENTS;

  // ── Верх: центральний віяльний круг і кільця ──────────────
  const centre: Point = [0, 0, 0];
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    const a = crownPoint(seed, segment, 0);
    const b = crownPoint(seed, next, 0);
    mesh.push(centre, b, a, crownShade(0), [crownUv(centre), crownUv(b), crownUv(a)]);
  }
  for (let ring = 0; ring + 1 < ISLAND_TOP_RINGS.length; ring += 1) {
    const inner = ISLAND_TOP_RINGS[ring]!;
    const outer = ISLAND_TOP_RINGS[ring + 1]!;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = crownPoint(seed, segment, ring);
      const b = crownPoint(seed, next, ring);
      const c = crownPoint(seed, next, ring + 1);
      const d = crownPoint(seed, segment, ring + 1);
      const shade = crownShade((inner + outer) / 2);
      mesh.push(a, b, c, shade, [crownUv(a), crownUv(b), crownUv(c)]);
      mesh.push(a, c, d, shade, [crownUv(a), crownUv(c), crownUv(d)]);
    }
  }

  // ── Обрив і корінь ────────────────────────────────────────
  //
  // Розгортка тут циліндрична: НОМЕР клина, а не `atan2`. Кут вертає
  // значення в смузі (−π, π], тож трикутник на стику розгортки дістав би
  // на одному кінці 0.999, а на другому 0.001, і плитка розтяглась би
  // через усю ланку однією вертикальною смугою.
  const wallUv = (segment: number, y: number): Uv => [
    (segment / segments) * ROCK_TILES_AROUND,
    y / ROCK_TEXTURE_UNITS,
  ];
  const levels = ISLAND_ROOT_ROWS_ALL.length;
  /*
   * Вістря — своє на кожен клин, а не одна спільна голка. Конус читався
   * б виточеним; злам породи закінчується жменею гострих країв.
   *
   * Але вістря — це КІЛЬЦЕ, а не жмут окремих зубців. Перша редакція
   * зшивала кожен клин із власним вістрям одним трикутником, і між
   * сусідніми вістрями лишалась щілина завширшки в різницю їхніх висот
   * (до 0.5 одиниці) — дірка просто в осі острова. Промінь з-під нахилу
   * камери влучав крізь неї у виворіт сусіднього зубця: 1 влучання з 900
   * (ADR-0159). Тому вістря нижче зшиті смугою, як усі інші кільця, і
   * закриті шапкою в одну точку — 144 трикутники на весь острів.
   */
  const tipAt = (segment: number): Point => {
    const angle = segmentAngle(seed, segment, segments);
    const tipShift = (seededUnit(seed, `island:tip:${segment}`) - 0.5) * 0.5;
    return [
      Math.cos(angle) * PORTAL_ISLAND_RADIUS * 0.05,
      portalIslandHeightAt(seed, angle, 1) - ISLAND_ROOT_TIP + tipShift,
      Math.sin(angle) * PORTAL_ISLAND_RADIUS * 0.05,
    ];
  };
  const tips: Point[] = [];
  for (let segment = 0; segment < segments; segment += 1) tips.push(tipAt(segment));
  const rootEnd: Point = [
    0,
    Math.min(...tips.map((tip) => tip[1])) - PORTAL_ISLAND_RADIUS * 0.03,
    0,
  ];
  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    const rim = ISLAND_TOP_RINGS.length - 1;
    let aboveA = crownPoint(seed, segment, rim);
    let aboveB = crownPoint(seed, next, rim);
    for (let level = 0; level < levels; level += 1) {
      const belowA = rootPoint(seed, segment, level);
      const belowB = rootPoint(seed, next, level);
      /*
       * Корінь темніє донизу, і це не градієнт заради градієнта: у
       * природі низ брили бачить тільки відбите від хмар світло. Тут це
       * ще й єдине, що відрізняє обрив від плато, коли на них дивляться
       * з вільної камери збоку.
       */
      const deep = 1 - (level / levels) * 0.62;
      pushLit(mesh, aboveA, belowB, belowA, deep, [
        wallUv(segment, aboveA[1]), wallUv(segment + 1, belowB[1]), wallUv(segment, belowA[1]),
      ]);
      pushLit(mesh, aboveA, aboveB, belowB, deep, [
        wallUv(segment, aboveA[1]), wallUv(segment + 1, aboveB[1]), wallUv(segment + 1, belowB[1]),
      ]);
      aboveA = belowA;
      aboveB = belowB;
    }
    const tipA = tips[segment]!;
    const tipB = tips[next]!;
    pushLit(mesh, aboveA, tipB, tipA, 0.34, [
      wallUv(segment, aboveA[1]), wallUv(segment + 1, tipB[1]), wallUv(segment, tipA[1]),
    ]);
    pushLit(mesh, aboveA, aboveB, tipB, 0.34, [
      wallUv(segment, aboveA[1]), wallUv(segment + 1, aboveB[1]), wallUv(segment + 1, tipB[1]),
    ]);
    pushLit(mesh, tipA, tipB, rootEnd, 0.3, [
      wallUv(segment, tipA[1]), wallUv(segment + 1, tipB[1]), wallUv(segment, rootEnd[1]),
    ]);
  }

  // ── Уламки на плато ───────────────────────────────────────
  for (let index = 0; index < rubble; index += 1) {
    pushRubble(mesh, seed, index);
  }

  return finish(mesh);
}

/**
 * Один уламок: барабан колони або тесаний блок, наполовину втоплений.
 *
 * САДИТЬСЯ В ТУ САМУ ТОЧКУ, ЯКУ ПОСТАВИВ БУДІВНИК ПЛАТО — кут клина й
 * кільце, а не довільна пара координат. Це не педантизм: поверхня
 * намальована пласкими трикутниками МІЖ вибірками функції висоти, і між
 * кільцями хорда провисає. Друза печери свого часу висіла над мешем
 * рівно з цієї причини (ADR-0140), і повторювати це вдруге ні до чого.
 */
function pushRubble(mesh: Soup, seed: number, index: number): void {
  const tag = `island:rubble:${index}`;
  const segment = Math.floor(seededUnit(seed, `${tag}:segment`) * PORTAL_ISLAND_SEGMENTS);
  const ring = 1 + Math.floor(seededUnit(seed, `${tag}:ring`) * 5);
  /*
   * Сідає на НАЙНИЖЧУ з чотирьох вершин своєї клітинки, а не на одну.
   *
   * Того самого правила тримається храм, і причина спільна: клітинка
   * плато — це два трикутники між чотирма вершинами, і уламок лежить на
   * ній усією підошвою. Поки він сідав на одну вершину, вистачало, щоб
   * сусідня була нижча, — і кут уламка зависав над каменем. Виміряно
   * тестом одразу після того, як плато стало по-справжньому битим:
   * гладка поверхня цю неточність приховувала.
   */
  const level = Math.min(ISLAND_TOP_RINGS.length - 1, ring);
  const cell = [
    crownPoint(seed, segment, level),
    crownPoint(seed, (segment + 1) % PORTAL_ISLAND_SEGMENTS, level),
    crownPoint(seed, segment, Math.max(0, level - 1)),
    crownPoint(seed, (segment + 1) % PORTAL_ISLAND_SEGMENTS, Math.max(0, level - 1)),
  ];
  const seat: Point = [
    cell[0]![0],
    Math.min(...cell.map((point) => point[1])),
    cell[0]![2],
  ];
  /*
   * РОЗМІР — У ЧАСТКАХ ОСТРОВА, і перша редакція носила тут світові
   * числа з часів, коли острів мав радіус 3.3. На радіусі 1 ті самі
   * 0.09–0.22 давали брилу в п'яту частину острова: передній план
   * заростав плитами, з-під яких не було видно ані плато, ані жеоди.
   */
  const size = 0.028 + seededUnit(seed, `${tag}:size`) * 0.042;
  const drum = seededUnit(seed, `${tag}:kind`) < 0.45;
  const spin = seededUnit(seed, `${tag}:spin`) * Math.PI * 2;
  // Втоплений на третину: уламок, що лежить НА поверхні всією підошвою,
  // читається наліпленим, а не впалим.
  const base = seat[1] - size * 0.45;

  if (drum) {
    // Барабан колони, що впав на бік: шестигранник з віссю по горизонталі.
    const half = size * 0.9;
    const radius = size * 0.62;
    const axis: Point = [Math.cos(spin), 0, Math.sin(spin)];
    const side: Point = [-Math.sin(spin), 0, Math.cos(spin)];
    const ringPoint = (end: number, corner: number): Point => {
      const a = (corner / 6) * Math.PI * 2;
      return [
        seat[0] + axis[0] * half * end + side[0] * Math.cos(a) * radius,
        base + radius + Math.sin(a) * radius,
        seat[2] + axis[2] * half * end + side[2] * Math.cos(a) * radius,
      ];
    };
    for (let corner = 0; corner < 6; corner += 1) {
      const next = (corner + 1) % 6;
      pushRockQuad(mesh, ringPoint(-1, corner), ringPoint(1, corner), ringPoint(1, next), ringPoint(-1, next));
    }
    for (const end of [-1, 1] as const) {
      const hub: Point = [
        seat[0] + axis[0] * half * end,
        base + radius,
        seat[2] + axis[2] * half * end,
      ];
      for (let corner = 0; corner < 6; corner += 1) {
        const next = (corner + 1) % 6;
        const first = ringPoint(end, corner);
        const second = ringPoint(end, next);
        if (end > 0) pushRock(mesh, hub, second, first);
        else pushRock(mesh, hub, first, second);
      }
    }
    return;
  }

  // Тесаний блок: коробка з нерівними кутами. Нерівність тут — не шум
  // заради шуму: правильний паралелепіпед читається кубиком, а не
  // уламком архітраву, який пролежав століття.
  const half = size * 0.8;
  const height = size * 0.62;
  const corner = (cx: number, cz: number, cy: number): Point => {
    const jitter = seededUnit(seed, `${tag}:corner:${cx}:${cz}:${cy}`) * 0.26 + 0.87;
    const x = cx * half * jitter;
    const z = cz * half * 0.72 * jitter;
    return [
      seat[0] + x * Math.cos(spin) - z * Math.sin(spin),
      base + (cy > 0 ? height : 0),
      seat[2] + x * Math.sin(spin) + z * Math.cos(spin),
    ];
  };
  const top = [corner(-1, -1, 1), corner(1, -1, 1), corner(1, 1, 1), corner(-1, 1, 1)] as const;
  const low = [corner(-1, -1, -1), corner(1, -1, -1), corner(1, 1, -1), corner(-1, 1, -1)] as const;
  pushRockQuad(mesh, top[0], top[3], top[2], top[1]);
  for (let face = 0; face < 4; face += 1) {
    const next = (face + 1) % 4;
    pushRockQuad(mesh, low[face]!, top[face]!, top[next]!, low[next]!);
  }
}

// ── Храм ────────────────────────────────────────────────────

/**
 * Де стоїть храм, і чому саме там.
 *
 * ПОЗАДУ Й ЗБОКУ. Під артефактом його немає й бути не може: `DESIGN.md`
 * скасував попередній світ саме за те, що подіум опинився під кристалом.
 * Позаду — бо кадр телефона має 1.94 одиниці ширини на глибині
 * артефакта, і храм збоку від нього просто вийшов би за край; глибше він
 * і менший, і цілком у кадрі.
 *
 * ПРИСУНУТО ДО ОСІ (ADR-0169): 0.778 радіуса → 0.680. Храм виріс на
 * чверть, а місця в кільці між жеодою й кромкою рівно стільки, скільки
 * є: усередині 0.5 радіуса храму бути не може (`DESIGN.md`), зовні —
 * обрис острова, який у цьому секторі гуляє між 0.96 і 1.08. Виміряно на
 * кутах нижньої сходинки: внутрішній кут виходить на 0.527, зовнішній на
 * 0.946 при обрисі 0.967.
 */
const TEMPLE_AT: readonly [number, number] = [0.297, -0.612];

/**
 * Куди дивиться фасад храму — одиничний вектор на центр острова.
 *
 * Публікується, бо будь-яка мірка ФАСАДУ мусить дивитись у тому самому
 * напрямку. Профіль храму проєктує тіло на площину XY, тобто мовчки
 * вважає, що фасад повернутий на +Z; відколи храм розвернувся до
 * артефакта (ADR-0169), така проєкція бачить його навскіс — і показала
 * колонаду 0.575 замість 0.655 та фронтон 12.5° замість 14°.
 *
 * Форма не змінилась ані на трикутник. Змінилась мірка, і саме її
 * довелось повернути разом із храмом.
 */
export const PORTAL_TEMPLE_FACE: readonly [number, number] = (() => {
  const [ox, oz] = TEMPLE_AT;
  const length = Math.hypot(ox, oz) || 1;
  return [-ox / length, -oz / length];
})();

/**
 * Храм міряється НИЖНІМ ДІАМЕТРОМ КОЛОНИ, як його й міряли ті, хто це
 * будував.
 *
 * Перша редакція носила п'ять незалежних чисел — ширину, глибину,
 * сходинку, висоту колони, її радіус, — і вони не складались у жодну
 * відому пропорцію. Вимір проти еталона з Blender (ADR-0145) показав, що
 * саме розійшлось: колони стояли на 2.02 діаметра одна від одної при
 * дорійських 1.2–1.5, а фронтон мав 21° при грецьких 12.5–16°. Стрункість
 * при цьому випадково була правильною — 5.7 при 5.6, — і саме тому вада
 * не була видна оком: одна вірна пропорція з трьох рятує силует рівно
 * настільки, щоб він не читався поламаним.
 *
 * 0.0519 радіуса острова — єдине розмірне число храму. Воно каже, який він
 * МАЛИЙ, а не яких він пропорцій: ширина при чотирьох колонах виходить
 * 0.47 радіуса острова.
 *
 * 0.0415 → 0.0519 (ADR-0169), тобто на чверть. Межу поставив не смак, а
 * кільце: усередині 0.5 радіуса храму бути не може, зовні його ловить
 * обрис острова, і на чверті приросту нижня сходинка вже торкається
 * обох меж (див. `TEMPLE_AT`). Більший храм тут вимагав би або
 * посунути жеоду, або звузити сходинки — обидва рішення власника, а не
 * мої.
 */
const TEMPLE_COLUMN_DIAMETER = 0.0519;

/** Висота колони на її нижній діаметр. Дорика тримається 4–6.5. */
const TEMPLE_COLUMN_SLENDER = 5.6;

/** Просвіт між колонами на діаметр. Класична дорика — 1.2–1.5. */
const TEMPLE_INTERCOLUMN = 1.35;

/** Нахил фронтону від горизонталі. Грецькі — 12.5–16°. */
const TEMPLE_PEDIMENT_DEG = 14;

/** Висота антаблемента в діаметрах. */
const TEMPLE_ENTABLATURE = 1.6;

/** Висота однієї сходинки стилобата в діаметрах. */
const TEMPLE_STEP_SHARE = 0.42;

const TEMPLE_COLUMN_RADIUS = TEMPLE_COLUMN_DIAMETER / 2;
const TEMPLE_COLUMN_HEIGHT = TEMPLE_COLUMN_DIAMETER * TEMPLE_COLUMN_SLENDER;
const TEMPLE_BAY = TEMPLE_COLUMN_DIAMETER * (1 + TEMPLE_INTERCOLUMN);
const TEMPLE_STEP = TEMPLE_COLUMN_DIAMETER * TEMPLE_STEP_SHARE;
const TEMPLE_BEAM = TEMPLE_COLUMN_DIAMETER * TEMPLE_ENTABLATURE;

/** Скільки колон уздовж фасаду й уздовж боку. */
const TEMPLE_FRONT_COLUMNS = 4;
const TEMPLE_SIDE_COLUMNS = 3;

/*
 * Ширина й глибина — НАСЛІДОК кроку колон, а не окремі числа.
 *
 * Будівник розставляє осі по `ширина − 2 діаметри`, тож щоб крок вийшов
 * рівно `діаметр × (1 + просвіт)`, ширина мусить бути саме такою. Поки
 * ширина була власним числом, крок виходив який вийде — і вийшов 2.02
 * діаметра замість 1.35.
 */
const TEMPLE_WIDTH = TEMPLE_BAY * (TEMPLE_FRONT_COLUMNS - 1) + TEMPLE_COLUMN_DIAMETER * 2;
const TEMPLE_DEPTH = TEMPLE_BAY * (TEMPLE_SIDE_COLUMNS - 1) + TEMPLE_COLUMN_DIAMETER * 2;

/**
 * Які колони зламані, і чому це список, а не випадковість.
 *
 * «Древній» — це не шум: руїна читається тоді, коли видно, ЩО саме
 * впало. Дві сусідні колони одного кута, обламані на різній висоті,
 * читаються обвалом; випадкові дірки по всьому периметру читаються
 * помилкою побудови.
 */
const TEMPLE_BROKEN: readonly (readonly [number, number])[] = [[0, 0.34], [1, 0.62], [7, 0.5]];

/**
 * Малий давній храм: стилобат, колонада, архітрав і уламок фронтону.
 *
 * Даху немає навмисно. Дах перетворює силует на трапецію, а трапеція на
 * тлі неба читається будинком; античний храм упізнають по колонах, і
 * зламаний фронтон каже «давній» голосніше за будь-яку текстуру.
 */
export function buildPortalTempleGeometry(seed: number): THREE.BufferGeometry {
  const mesh = soup();
  const [ox, oz] = TEMPLE_AT;
  /*
   * Основа береться з тієї самої вибірки поверхні, що й уламки. Храм —
   * тіло тверде, тож він сідає на НАЙНИЖЧУ зі своїх кутових точок і
   * топить стилобат ще на сходинку: інакше під одним кутом лишилась би
   * щілина, а щілина під храмом читається тим, що він висить.
   */
  const reach = Math.hypot(ox, oz);
  const footprint = Math.hypot(TEMPLE_WIDTH, TEMPLE_DEPTH) * 0.62;
  /*
   * Найнижча ВЕРШИНА МЕША під плямою храму, а не значення кривої в його
   * центрі. Причина та сама, що в ADR-0140: плато намальоване пласкими
   * трикутниками між вибірками кривої, тож у центрі клітинки меш нижчий
   * за криву — перевірка посадки впіймала різницю в 0.043, тобто храм,
   * що стоїть на повітрі одним кутом.
   */
  let ground = Number.POSITIVE_INFINITY;
  for (let segment = 0; segment < PORTAL_ISLAND_SEGMENTS; segment += 1) {
    for (let ring = 0; ring < ISLAND_TOP_RINGS.length; ring += 1) {
      const point = crownPoint(seed, segment, ring);
      if (Math.hypot(point[0] - ox, point[2] - oz) > footprint) continue;
      ground = Math.min(ground, point[1]);
    }
  }
  if (!Number.isFinite(ground)) {
    ground = portalIslandHeightAt(seed, Math.atan2(oz, ox), Math.min(1, reach));
  }
  ground -= TEMPLE_STEP;

  /*
   * ХРАМ ДИВИТЬСЯ НА АРТЕФАКТ (ADR-0169).
   *
   * Досі він будувався по світових осях, фасадом на +Z. Камера теж
   * стоїть на +Z, але храм — на (0.30, −0.61), тобто збоку: з кадру
   * було видно його БІК, три колони замість чотирьох і жодного
   * фронтону. Найдорожча частина будівлі — портик — не показувалась
   * узагалі.
   *
   * Тому все нижче будується в МІСЦЕВИХ координатах (+Z — фасад), а
   * `place` повертає їх так, щоб фасад дивився в центр острова. Це не
   * лише про кадр: пара крутить острів рукою, і храм, повернутий до
   * артефакта, лишається правильним із будь-якого боку, тоді як храм,
   * повернутий до камери, розвернувся б спиною на першому ж дотику.
   *
   * Обертання застосовується ДО того, як `pushLit` рахує нормаль, — бо
   * інакше тон запікся б для неповернутого храму, і бік, що дивиться на
   * сонце, лишився б темним.
   */
  const [faceX, faceZ] = PORTAL_TEMPLE_FACE;
  const place = (lx: number, ly: number, lz: number): Point => [
    ox + lx * faceZ + lz * faceX,
    ly,
    oz - lx * faceX + lz * faceZ,
  ];

  const box = (
    cx: number, cy: number, cz: number,
    hx: number, hy: number, hz: number,
    tint = 1,
  ): void => {
    const at = (sx: number, sy: number, sz: number): Point =>
      place(cx + sx * hx, cy + sy * hy, cz + sz * hz);
    const top = [at(-1, 1, -1), at(1, 1, -1), at(1, 1, 1), at(-1, 1, 1)] as const;
    const low = [at(-1, -1, -1), at(1, -1, -1), at(1, -1, 1), at(-1, -1, 1)] as const;
    pushQuad(mesh, top[0], top[3], top[2], top[1], tint);
    for (let face = 0; face < 4; face += 1) {
      const next = (face + 1) % 4;
      pushQuad(mesh, low[face]!, top[face]!, top[next]!, low[next]!, tint);
    }
  };

  // ── Стилобат: три сходинки ────────────────────────────────
  let stepTop = ground;
  for (let step = 0; step < 3; step += 1) {
    const grow = 1 + (2 - step) * 0.075;
    box(
      0, stepTop + TEMPLE_STEP / 2, 0,
      (TEMPLE_WIDTH / 2) * grow, TEMPLE_STEP / 2, (TEMPLE_DEPTH / 2) * grow,
      1 - step * 0.04,
    );
    stepTop += TEMPLE_STEP;
  }

  /*
   * ── СВІТЛО ВСЕРЕДИНІ ──────────────────────────────────────
   *
   * Власник попросив «теплий храм». Тепло тут не можна дати ані
   * світильником (сцена намальована, а не освітлена), ані другим
   * матеріалом (draw call'и вичерпані ADR-0168) — лишається один шлях:
   * ЗАПЕКТИ його в тон грані. Тон вершини множиться на колір матеріалу,
   * і множник більший за одиницю виводить колір за камінь у бік білого,
   * тобто читається світлом, що лягло на стіну, а не каменем.
   *
   * СТІНА, А НЕ ПІДЛОГА, І ЦЕ ВИПРАВЛЕНО ЗА КАДРОМ. Перша редакція
   * світила підлогою портика — і в кадрі її не було видно взагалі.
   * Арифметика проста: камера стоїть на 23.6° над обрієм, тобто
   * тангенс 0.437; глибина портика 0.39, тож промінь від верху передньої
   * колони падає всередині лише на 0.17 при висоті колони 0.29. Підлога
   * ховається за власною колонадою повністю.
   *
   * Стіна целли стоїть ВЕРТИКАЛЬНО й видна крізь просвіти між колонами —
   * тобто рівно там, де око й шукає нутро храму. Це та сама помилка, що
   * з мохом на шапках брил: прикраса, поставлена туди, куди камера не
   * дивиться, оплачена й невидима.
   */
  /*
   * СТІНА — УЛАМОК, А НЕ СТІНА. Перша редакція перекривала всю ширину
   * портика, і мірка колонади це впіймала: повітря в силуеті впало з
   * 0.655 до 0.493, тобто храм із колонади став коробкою з колонами.
   * Еталон власника — відкритий портик, крізь який видно небо, і саме це
   * число його стереже.
   *
   * Розмір уламка ВИМІРЯНИЙ проти цієї мірки, а не вгаданий: на повну
   * ширину повітря 0.493, на 0.28 прольоту — 0.571, на 0.62 — 0.608, на
   * 0.72 при висоті 0.56 колони — 0.62 з запасом. Теплого каменю досить,
   * щоб побачити його у двох просвітах, і замало, щоб силует перестав
   * дихати.
   */
  const wallHalfW = TEMPLE_WIDTH / 2 - TEMPLE_COLUMN_RADIUS * 2.6;
  const wallHeight = TEMPLE_COLUMN_HEIGHT * 0.56;
  const wallZ = -TEMPLE_DEPTH * 0.1;
  const wallThick = TEMPLE_COLUMN_RADIUS * 0.55;
  /*
   * Стіна ОБВАЛЕНА з одного боку: рівний прямокутник між колонами
   * читався б новою кладкою, а храм тут древній. Правий край нижчий і
   * коротший — та сама рука, що обламала три колони зі списку.
   */
  const wallRight = -wallHalfW * 0.72;
  const wallDrop = wallHeight * 0.45;
  const face = (x0: number, x1: number, y1: number, tint: number): void => {
    pushQuad(
      mesh,
      place(x1, stepTop, wallZ + wallThick),
      place(x1, y1, wallZ + wallThick),
      place(x0, stepTop + wallHeight, wallZ + wallThick),
      place(x0, stepTop, wallZ + wallThick),
      tint,
    );
  };
  // Передня грань тепла — це і є «світло всередині».
  face(-wallHalfW, wallRight, stepTop + wallHeight - wallDrop, 1.5);
  // Торець і верх лишаються каменем: світло падає з нутра, а не звідусіль.
  pushQuad(
    mesh,
    place(-wallHalfW, stepTop, wallZ - wallThick),
    place(-wallHalfW, stepTop + wallHeight, wallZ - wallThick),
    place(wallRight, stepTop + wallHeight - wallDrop, wallZ - wallThick),
    place(wallRight, stepTop, wallZ - wallThick),
    0.82,
  );
  pushQuad(
    mesh,
    place(-wallHalfW, stepTop + wallHeight, wallZ - wallThick),
    place(-wallHalfW, stepTop + wallHeight, wallZ + wallThick),
    place(wallRight, stepTop + wallHeight - wallDrop, wallZ + wallThick),
    place(wallRight, stepTop + wallHeight - wallDrop, wallZ - wallThick),
    1.06,
  );
  /*
   * ТОРЦІ ЗАКРИТІ, і це не педантизм. Стіна без них — розкрита коробка:
   * промінь із камери заходить у відкритий бік і бачить її виворіт.
   * Променева проба зловила рівно одне таке влучання з дев'ятисот
   * (ADR-0159), і одного досить: у кадрі це чорна дірка в білому камені.
   */
  pushQuad(
    mesh,
    place(-wallHalfW, stepTop, wallZ + wallThick),
    place(-wallHalfW, stepTop + wallHeight, wallZ + wallThick),
    place(-wallHalfW, stepTop + wallHeight, wallZ - wallThick),
    place(-wallHalfW, stepTop, wallZ - wallThick),
    0.88,
  );
  pushQuad(
    mesh,
    place(wallRight, stepTop, wallZ - wallThick),
    place(wallRight, stepTop + wallHeight - wallDrop, wallZ - wallThick),
    place(wallRight, stepTop + wallHeight - wallDrop, wallZ + wallThick),
    place(wallRight, stepTop, wallZ + wallThick),
    0.9,
  );

  // ── Колонада по периметру ─────────────────────────────────
  const columns: (readonly [number, number])[] = [];
  for (let index = 0; index < TEMPLE_FRONT_COLUMNS; index += 1) {
    const t = index / (TEMPLE_FRONT_COLUMNS - 1);
    const x = (t - 0.5) * (TEMPLE_WIDTH - TEMPLE_COLUMN_RADIUS * 4);
    columns.push([x, (TEMPLE_DEPTH - TEMPLE_COLUMN_RADIUS * 4) / 2]);
    columns.push([x, -(TEMPLE_DEPTH - TEMPLE_COLUMN_RADIUS * 4) / 2]);
  }
  for (let index = 1; index + 1 < TEMPLE_SIDE_COLUMNS; index += 1) {
    const t = index / (TEMPLE_SIDE_COLUMNS - 1);
    const z = (t - 0.5) * (TEMPLE_DEPTH - TEMPLE_COLUMN_RADIUS * 4);
    columns.push([(TEMPLE_WIDTH - TEMPLE_COLUMN_RADIUS * 4) / 2, z]);
    columns.push([-(TEMPLE_WIDTH - TEMPLE_COLUMN_RADIUS * 4) / 2, z]);
  }

  const brokenBy = new Map(TEMPLE_BROKEN.map(([at, share2]) => [at, share2]));
  columns.forEach(([cx, cz], index) => {
    const share2 = brokenBy.get(index) ?? 1;
    const height = TEMPLE_COLUMN_HEIGHT * share2;
    const sides = 6;
    const spin = seededUnit(seed, `temple:column:${index}`) * Math.PI * 2;
    const ringPoint = (level: number, corner: number): Point => {
      const a = spin + (corner / sides) * Math.PI * 2;
      // Ентазис у мініатюрі: верх вужчий за низ. Циліндр однакової
      // товщини читається трубою, а не колоною.
      const taper = 1 - 0.14 * level;
      return place(
        cx + Math.cos(a) * TEMPLE_COLUMN_RADIUS * taper,
        stepTop + height * level,
        cz + Math.sin(a) * TEMPLE_COLUMN_RADIUS * taper,
      );
    };
    /*
     * Злам угорі — рваний, а не рівний зріз: у зламаної колони верх
     * нерівний, і саме це відрізняє руїну від недобудови.
     *
     * Підйом рахується НА КУТ, а не на трикутник, і верх стовбура йде за
     * ним. Поки підйом був спільний на обидві вершини одного трикутника
     * віяла, сусідні трикутники розходились по висоті, а стінка під ними
     * лишалась рівною — між ними зяяли щілини, крізь які промінь бачив
     * виворіт наступної грані. Променева проба ловила це як 5 влучань у
     * спину з 900 (ADR-0159).
     */
    const lift = (corner: number): number => (share2 < 1
      ? seededUnit(seed, `temple:break:${index}:${corner}`) * TEMPLE_COLUMN_RADIUS * 0.7
      : 0);
    const torn = (corner: number): Point => {
      const point = ringPoint(1, corner);
      return [point[0], point[1] + lift(corner), point[2]];
    };
    for (let corner = 0; corner < sides; corner += 1) {
      const next = (corner + 1) % sides;
      pushQuad(mesh, ringPoint(0, corner), torn(corner), torn(next), ringPoint(0, next));
    }
    const hub: Point = place(cx, stepTop + height + (share2 < 1 ? TEMPLE_COLUMN_RADIUS * 0.3 : 0), cz);
    for (let corner = 0; corner < sides; corner += 1) {
      pushLit(mesh, hub, torn((corner + 1) % sides), torn(corner));
    }
  });

  // ── Архітрав: чотири балки, і однієї немає ────────────────
  //
  // Дірка в поясі — над зламаними колонами. Балка, що висить над
  // порожнечею, зруйнувала б єдине, що тут має бути безсумнівним: те, що
  // камінь підкоряється вазі.
  const beamY = stepTop + TEMPLE_COLUMN_HEIGHT + TEMPLE_BEAM / 2;
  const halfW = TEMPLE_WIDTH / 2 - TEMPLE_COLUMN_RADIUS;
  const halfD = TEMPLE_DEPTH / 2 - TEMPLE_COLUMN_RADIUS;
  box(0, beamY, halfD, halfW + TEMPLE_COLUMN_RADIUS, TEMPLE_BEAM / 2, TEMPLE_COLUMN_RADIUS, 1.04);
  box(halfW, beamY, 0, TEMPLE_COLUMN_RADIUS, TEMPLE_BEAM / 2, halfD, 0.94);
  box(-halfW, beamY, 0, TEMPLE_COLUMN_RADIUS, TEMPLE_BEAM / 2, halfD * 0.55, 0.94);

  // ── Уламок фронтону над фасадом ───────────────────────────
  const gableY = beamY + TEMPLE_BEAM / 2;
  // Нахил фронтону — оголошений, а не «щоб гарно»: 14° усередині
  // грецьких 12.5–16°. Перша редакція мала прибиту висоту 0.073, тобто
  // 21°, і це вже читалось двосхилим дахом хати.
  const peak: Point = place(
    -halfW * 0.15,
    gableY + (halfW + TEMPLE_COLUMN_RADIUS) * Math.tan((TEMPLE_PEDIMENT_DEG * Math.PI) / 180),
    halfD,
  );
  const left: Point = place(-halfW - TEMPLE_COLUMN_RADIUS, gableY, halfD);
  const right: Point = place(halfW * 0.45, gableY, halfD);
  const depth = TEMPLE_COLUMN_RADIUS * 1.2;
  // Назад — уздовж МІСЦЕВОЇ осі глибини, а не світової.
  const back = (point: Point): Point => [
    point[0] - faceX * depth,
    point[1],
    point[2] - faceZ * depth,
  ];
  pushLit(mesh, left, right, peak, 1.08);
  pushLit(mesh, back(right), back(left), back(peak), 0.9);
  pushQuad(mesh, left, peak, back(peak), back(left), 1.02);
  pushQuad(mesh, peak, right, back(right), back(peak), 0.96);

  return finish(mesh);
}

// ── Брили в повітрі ─────────────────────────────────────────

/**
 * Брили, що висять навколо острова.
 *
 * Вони й НЕСУТЬ слово «літаючий». Камера дивиться на острів згори, тож
 * його обрив вона не бачить; єдине, що каже «під нами нічого немає», —
 * камінь, який висить у небі поруч, без опори й без тіні.
 *
 * Тому вони стоять ЗА островом і ВИЩЕ за лінію його краю: брила нижча за
 * цю лінію просто ховається за самим островом — промінь до неї встигає
 * впертись у плато.
 */
/**
 * ЛЕВІТАЦІЯ: своя фаза й свій темп на кожну брилу (ADR-0162).
 *
 * Спільна фаза дала б не летючі камені, а один камінь, розмножений
 * копіюванням: усі підіймаються разом, і око читає це як тремтіння камери.
 * Спільний темп при різних фазах читається краще, але за пів хвилини
 * вертається те саме — вони проходять верхню точку по черзі, з рівним
 * кроком, як зубці шестерні.
 *
 * Темп 0.72…1.34 — вузько навмисно: ширше, і найшвидша брила обганяла б
 * найповільнішу на цілий період, а два камені в протифазі поруч читаються
 * гойдалкою.
 *
 * ФУНКЦІЯ, А НЕ РЯДОК У БУДІВНИКУ, бо це число знають ДВОЄ: сама брила й
 * трава, що на ній росте (ADR-0163). Трава, яка порахувала б фазу
 * самостійно, одного дня почала б літати окремо від каменя.
 */
function driftFloat(seed: number, tag: string): readonly [number, number] {
  return [
    seededUnit(seed, `${tag}:float`) * Math.PI * 2,
    0.72 + seededUnit(seed, `${tag}:pace`) * 0.62,
  ];
}

/**
 * Де стоїть брила номер `index` і яка вона завбільшки.
 *
 * Спільне з будівником брил, бо росте на них трава, і рости вона мусить
 * САМЕ ТАМ, де камінь. Друга копія цієї арифметики розійшлась би з першою
 * тієї ж миті, коли хтось поворухне будь-яке з чисел, — і кущ повис би в
 * повітрі поруч із каменем.
 */
function driftRockAt(seed: number, index: number, count: number): {
  tag: string;
  cx: number;
  cz: number;
  rise: number;
  size: number;
  top: number;
  spin: number;
  float: readonly [number, number];
} {
  const tag = `island:drift:${index}`;
  const angle = ((index + seededUnit(seed, `${tag}:spin`) * 0.8) / Math.max(1, count)) * Math.PI * 2;
  const reach = PORTAL_CAMERA_RING * (1.38 + seededUnit(seed, `${tag}:reach`) * 1.02);
  const rise = -0.42 + seededUnit(seed, `${tag}:rise`) * 1.5;
  const size = (0.055 + seededUnit(seed, `${tag}:size`) * 0.085)
    * (reach / PORTAL_ISLAND_RADIUS) * 0.42;
  return {
    tag,
    cx: Math.cos(angle) * reach,
    cz: Math.sin(angle) * reach,
    rise,
    size,
    top: size * (0.42 + seededUnit(seed, `${tag}:cap`) * 0.26),
    spin: seededUnit(seed, `${tag}:turn`) * Math.PI * 2,
    float: driftFloat(seed, tag),
  };
}

export function buildPortalDriftGeometry(seed: number, count: number): THREE.BufferGeometry {
  const mesh = soup();
  for (let index = 0; index < count; index += 1) {
    /*
     * ЗА КІЛЬЦЕМ КАМЕРИ, І ЦЕ ГАРАНТІЯ, А НЕ ЗАПАС.
     *
     * Масштаб сцени йде за відстанню камери (`portalIslandScale`), тож
     * камера СТОЇТЬ ЗАВЖДИ на одному й тому самому радіусі в одиницях
     * острова: 1 / 0.30 ≈ 3.33. Отже «не ближче за 4.6» означає «ніколи
     * не між камерою й островом» — і означає це в один рік так само, як у
     * сорок.
     *
     * Перша редакція мала 2.2, тобто ближче за камеру, і кадр показав
     * наслідок одразу: брила опинялась перед об'єктивом і затуляла
     * артефакт темною плямою на пів екрана. Оснастка чесно впала —
     * «кристала в кадрі немає».
     *
     * Розміщення рахує `driftRockAt` — спільно з травою, що росте на цих
     * каменях (ADR-0163). Далі — більша: зміна розміру з відстанню і є те,
     * чим око міряє глибину, а тіней у цій сцені немає взагалі.
     */
    const { tag, cx, cz, rise, size, float } = driftRockAt(seed, index, count);
    mesh.float = float;

    /*
     * ФОРМА — БРИЛА, А НЕ САМОЦВІТ, і це виправлення знайшов кадр.
     *
     * Перша редакція мала вузький верх і довге вістря вниз — на екрані це
     * читалось діамантом, тобто рівно тим, чим у цій сцені вже є
     * артефакт. Брила навпаки: широке плато згори (колишня поверхня
     * острова, з якої її вирвало), майже пряма стінка і КОРОТКИЙ рваний
     * злам знизу.
     */
    const sides = DRIFT_ROCK_SIDES;
    const rock = driftRockAt(seed, index, count);
    const { top } = rock;

    /*
     * КУТИ МІЖ КУТАМИ НЕРІВНІ, і це те саме виправлення, що ADR-0147
     * зробив ґратці плато, лише на меншому тілі. Рівні кути дають віяло
     * з подібних трикутників: хай як гуляє радіус, площі граней
     * лишаються майже однаковими, а однакова площа й читається
     * виточеним. Виміряно: розкид площ 0.38 проти 0.60 в еталонної
     * брили з опуклої оболонки; сам лише нерівний крок дає 0.52.
     *
     * Зсув обмежений 0.45 щілини між сусідами — менше за половину, тож
     * кут НЕ МОЖЕ обігнати сусідній і вивернути грань. Та сама пастка
     * вже коштувала дірок у плато.
     */
    const ringPoint = (corner: number, level: number): Point =>
      driftRockCorner(seed, rock, corner, level);
    /*
     * Вершина шапки ПО ЦЕНТРУ, і це перевірене рішення, а не лінощі.
     * Зміщена вершина напрошується сама (вона теж ламає віяло), але дає
     * 0.013 розкиду площ із 0.15 усієї правки, а в кадрі не змінює
     * нічого: камера дивиться на брили майже врівень, і шапка з неї
     * видна ребром. Прикраса, яка нічого не міряє й нічого не показує,
     * тут не лишається.
     */
    const cap: Point = [cx, rise + top * 1.16, cz];
    const tip: Point = [
      cx + (seededUnit(seed, `${tag}:tipx`) - 0.5) * size * 0.8,
      rise - size * (0.34 + seededUnit(seed, `${tag}:deep`) * 0.44),
      cz + (seededUnit(seed, `${tag}:tipz`) - 0.5) * size * 0.8,
    ];
    for (let corner = 0; corner < sides; corner += 1) {
      const next = (corner + 1) % sides;
      pushRock(mesh, ringPoint(corner, 1), cap, ringPoint(next, 1), 1.06);
      pushRockQuad(mesh, ringPoint(corner, 1), ringPoint(next, 1), ringPoint(next, 0), ringPoint(corner, 0));
      pushRock(mesh, ringPoint(corner, 0), ringPoint(next, 0), tip, 0.52);
    }
  }
  return finish(mesh);
}

// ── Світляне кільце ─────────────────────────────────────────

/**
 * Диски світіння навколо артефакта — у тих самих одиницях, що й кільце.
 *
 * Кільце має радіус 1, і той, хто його вішає, множить усе на висоту
 * артефакта; ці числа їдуть тим самим множником, тож світіння росте
 * разом із кристалом, а не з декорацією.
 *
 * Два, а не один: широкий і слабкий — це повітря навколо тіла, вузький
 * і яскравий на вістрі — те, що око читає як джерело. Один диск дає або
 * пляму, або нічого.
 */
const HALO_GLOWS: readonly { height: number; radius: number; alpha: number }[] = [
  /*
   * ВИСОТИ ВИМІРЯНІ ЗА СИЛУЕТОМ, а не поставлені «по центру».
   * Додавання видно лише там, де за тілом небо: над плато острів
   * закриває нижню третину кристала, і диск, поставлений на висоті
   * кільця, світив у камінь. Обидва підняті у верхню половину — туди,
   * де кристал і межує з небом.
   */
  { height: 0.25, radius: 0.52, alpha: 0.5 },
  { height: 0.75, radius: 0.58, alpha: 0.62 },
  { height: 1.2, radius: 0.34, alpha: 0.72 },
];

/** На скільки ланок ділиться кільце, за профілем якості. */
export const PORTAL_HALO_SEGMENTS: Record<PortalQuality, number> = {
  high: 60, balanced: 40, low: 24, fallback: 0,
};

/**
 * Світляне кільце навколо артефакта — в одиницях САМОГО КІЛЬЦЯ.
 *
 * Радіус 1, площина XZ, центр у нулі. Нахил, розмір і місце ставить той,
 * хто його вішає: кільце належить артефактові, а артефакт росте, тож
 * прибити тут світові координати означало б кільце, яке підходить парі
 * рівно одного віку.
 *
 * ЧОМУ ТРИ РЯДИ ВЕРШИН, А НЕ ДВА. Стрічка з двох рядів має РІЗАНІ краї:
 * при будь-якій прозорості видно рівно, де вона закінчується, і кільце
 * читається обручем із пластику. Три ряди — зовнішній, серединний,
 * внутрішній — дають прозорість 0 / 1 / 0 поперек стрічки, тобто край,
 * якого не видно. Це коштує вдвічі більше трикутників і є єдиною
 * причиною, чому кільце взагалі світиться, а не лежить.
 *
 * ЧОМУ ЯСКРАВІСТЬ ГУЛЯЄ ПО КОЛУ. Рівне кільце — це обруч. У еталоні
 * власника світло збирається дугами, а між ними майже гасне; саме це й
 * читається рухом світла, а не предметом.
 */
export function buildPortalHaloGeometry(seed: number, segments: number): THREE.BufferGeometry {
  const mesh = soup();
  if (segments < 3) return finish(mesh);
  /*
   * Межа між кільцем і дисками ПУБЛІКУЄТЬСЯ, а не відновлюється.
   *
   * Здавалося б, її видно з атрибута: у кільця зсув нульовий, у дисків
   * ні. Але ЦЕНТРАЛЬНА вершина диска теж має нульовий зсув — вона й є
   * центр, — тож за атрибутом два тіла не розрізнити. Перша редакція
   * тестів на цьому й спіткнулась: мірки кільця почали бачити радіус 0.
   */
  /*
   * Ширина стрічки — від радіуса кільця, і 0.085 замість 0.055 після
   * кадру: вужча стрічка на екрані телефона давала лінію в один-два
   * пікселі, тобто подряпину, а не світло.
   */
  const halfWidth = 0.062;
  const at = (index: number, side: number): Point => {
    const angle = (index / segments) * Math.PI * 2;
    /*
     * Кільце НЕ ідеальне коло: радіус трохи гуляє. Ідеальне коло —
     * єдина форма, яку око впізнає як накреслену циркулем, а сцена
     * навколо неї вся рвана.
     */
    const wobble = 1 + (seededUnit(seed, `halo:wobble:${index % segments}`) - 0.5) * 0.06;
    const radius = (1 + side * halfWidth) * wobble;
    return [Math.cos(angle) * radius, side * halfWidth * 0.35, Math.sin(angle) * radius];
  };
  /** Дуги світла: дві широкі й одна вузька, розведені по колу. */
  const glow = (index: number): number => {
    const angle = (index / segments) * Math.PI * 2;
    /*
     * ПІДЛОГА, А НЕ НУЛЬ. Перша редакція гасила кільце майже до нуля між
     * дугами, і в кадрі лишалась одна яскрава дуга ліворуч від кристала —
     * випадковий розчерк, а не кільце. Кільце мусить читатись кільцем
     * ЦІЛКОМ, а дуги — лише збирати в собі більше світла.
     */
    const wave = 0.38 + 0.62 * (0.5 + 0.5 * Math.sin(angle * 2 + 0.9));
    const spark = 0.26 * Math.max(0, Math.sin(angle * 5 - 2.1));
    return Math.min(1, wave + spark);
  };
  for (let index = 0; index < segments; index += 1) {
    const next = (index + 1) % segments;
    const inner = [at(index, -1), at(next, -1)] as const;
    const core = [at(index, 0), at(next, 0)] as const;
    const outer = [at(index, 1), at(next, 1)] as const;
    const here = glow(index);
    const there = glow(next);
    // Ядро стрічки світиться, краї згасають у ніщо.
    // Тон і прозорість ідуть ПО ТИХ САМИХ кутах: край стрічки і темніший,
    // і прозоріший, ядро — і яскравіше, і щільніше.
    const edge = 0.55;
    mesh.alpha = [0, 0, there];
    mesh.push(inner[0], inner[1], core[1], [edge, edge, there]);
    mesh.alpha = [0, there, here];
    mesh.push(inner[0], core[1], core[0], [edge, there, here]);
    mesh.alpha = [here, there, 0];
    mesh.push(core[0], core[1], outer[1], [here, there, edge]);
    mesh.alpha = [here, 0, 0];
    mesh.push(core[0], outer[1], outer[0], [here, edge, edge]);
  }
  /*
   * ── СВІТІННЯ НАВКОЛО АРТЕФАКТА ────────────────────────────
   *
   * Це «bloom для бідних», і саме так світіння робили до постобробки:
   * додавальний диск із м'яким краєм, повернутий до ока. Повноекранний
   * прохід нам заборонений, доки не поставлено діагноз білому фону на
   * пристрої власника (`render/gfxProfile.ts`), і цей шлях від того
   * діагнозу не залежить узагалі — жодного render target, жодного
   * нового матеріалу, жодного нового draw call: диски їдуть у мешеві
   * кільця, бо в них те саме додавальне змішування.
   *
   * ЧОМУ ДИСК, А НЕ ЧОТИРИКУТНИК. Чотирикутник має чотири кути, тобто
   * альфа в ньому може бути лише на краях; щоб яскравість спадала ВІД
   * ЦЕНТРА, потрібна вершина в центрі. Віяло з центром і двома кільцями
   * дає спад у два кроки — це вже читається світлом, а не наклейкою.
   *
   * ЧОМУ ЙОГО НЕ ВИДНО ПОВЕРХ КРИСТАЛА. Диск стоїть у площині, що
   * проходить ЧЕРЕЗ вісь артефакта, тобто всередині його тіла; ближня
   * половина кристала пише глибину й затуляє ближню половину диска.
   * Лишається рівно те, що поза силуетом, — тобто сяйво навколо, а не
   * пляма на гранях.
   */
  const ringTriangles = mesh.positions.length / 9;
  for (const disc of HALO_GLOWS) {
    /*
     * ТРИ КІЛЬЦЯ, А НЕ ДВА, І ОБОВ'ЯЗКОВО ПО ДВА ТРИКУТНИКИ НА ЛАНКУ.
     *
     * Перша редакція клала між кільцями по одному трикутнику
     * (внутрішня вершина плюс дві зовнішні) — і кадр показав СОНЦЕ З
     * ПРОМЕНЯМИ: половина кожної ланки лишалась незакритою, тож диск
     * вийшов зіркою. Смуга між двома кільцями — це чотирикутник, і
     * закрити його можна лише двома трикутниками.
     */
    /*
     * ЯСКРАВІШЕ НЕ В ЦЕНТРІ, А НА СЕРЕДИНІ, і це не смак кривої.
     * Центр диска лежить НА ОСІ артефакта, тобто всередині його тіла:
     * ближня половина кристала пише глибину й закриває саме ту частину,
     * де світло найсильніше. Максимум, посаджений у центр, витрачається
     * на невидиме. Перенесений на середнє кільце, він лягає рівно на
     * силует — а сяйво навколо силуету і є те, чого ми домагаємось.
     */
    const rings: readonly { at: number; alpha: number; shade: number }[] = [
      { at: 0, alpha: disc.alpha * 0.55, shade: 1 },
      { at: 0.44, alpha: disc.alpha, shade: 0.82 },
      { at: 1, alpha: 0, shade: 0.4 },
    ];
    const sides = 12;
    const anchor: Point = [0, disc.height, 0];
    const on = (ring: { at: number }, angle: number): readonly [number, number] => [
      Math.cos(angle) * disc.radius * ring.at,
      Math.sin(angle) * disc.radius * ring.at,
    ];
    /**
     * Трикутник із трьома РІЗНИМИ зсувами.
     *
     * `glow` — поле тіла, як `float` і `alpha`, тобто одне на три кути.
     * Диску потрібні три різні, тож зсуви двох останніх вершин
     * дописуються прямо в масив. Це єдине місце в файлі, де так робиться,
     * і воно назване: інакше довелось би заводити ще одну форму `push`
     * заради одного тіла.
     */
    const spoke = (
      offsets: readonly (readonly [number, number])[],
      alphas: readonly [number, number, number],
      shades: readonly [number, number, number],
    ): void => {
      mesh.alpha = alphas;
      mesh.glow = offsets[0]!;
      const at = (mesh.positions.length / 3) * 2;
      mesh.push(anchor, anchor, anchor, shades);
      for (let corner = 1; corner < 3; corner += 1) {
        mesh.glows[at + corner * 2] = offsets[corner]![0];
        mesh.glows[at + corner * 2 + 1] = offsets[corner]![1];
      }
    };
    for (let band = 0; band + 1 < rings.length; band += 1) {
      const inner = rings[band]!;
      const outer = rings[band + 1]!;
      for (let corner = 0; corner < sides; corner += 1) {
        const a = (corner / sides) * Math.PI * 2;
        const b = ((corner + 1) / sides) * Math.PI * 2;
        spoke(
          [on(inner, a), on(outer, a), on(outer, b)],
          [inner.alpha, outer.alpha, outer.alpha],
          [inner.shade, outer.shade, outer.shade],
        );
        // Друга половина смуги. У центральному віялі її немає: там
        // «внутрішнє кільце» — одна точка, і чотирикутника не існує.
        if (inner.at > 0) {
          spoke(
            [on(inner, a), on(outer, b), on(inner, b)],
            [inner.alpha, outer.alpha, inner.alpha],
            [inner.shade, outer.shade, inner.shade],
          );
        }
      }
    }
  }
  mesh.glow = null;
  const geometry = finish(mesh);
  geometry.userData.haloLayout = { ring: ringTriangles, glow: mesh.positions.length / 9 - ringTriangles };
  return geometry;
}

// ── Водоспади ───────────────────────────────────────────────

/** Скільки водоспадів падає з кромки, за профілем якості. */
export const PORTAL_WATERFALLS: Record<PortalQuality, number> = {
  high: 5, balanced: 3, low: 2, fallback: 0,
};

/**
 * Водоспади з кромки — те, що робить острів островом, а не брилою.
 *
 * ЧОМУ СТРІЧКА, А НЕ ТІЛО. Вода тут не має об'єму, який хтось побачить:
 * з камери під 23.6° падіння видно збоку, тобто пласким. Стрічка, повернута
 * до осі (як пелюстка хмари), дає рівно той силует, і коштує вісімнадцять
 * трикутників замість сотні.
 *
 * ЧОМУ ПРОЗОРІСТЬ ЙДЕ ВЕРШИНОЮ. Падіння мусить ЗНИКАТИ внизу, а не
 * обриватись: під островом немає ані озера, ані туману, який би його
 * з'їв, — там порожнеча, і різаний край стрічки читався б шматком скла.
 * Один множник на весь меш такого не вміє, тому альфа кладеться в
 * четвертий канал кольору (той самий, що в хмар, ADR-0165) і згасає
 * вздовж падіння.
 *
 * ЧОМУ СТРУМІНЬ ШИРШАЄ. Вода, що падає, розсипається: вгорі це струмінь
 * завширшки з розколину, внизу — завіса. Стала ширина читалась би
 * стрічкою тканини, вивішеною за борт.
 */
export function buildPortalWaterfallGeometry(seed: number, count: number): THREE.BufferGeometry {
  const mesh = soup();
  const rows = ISLAND_ROOT_ROWS_ALL.length;
  // Скільки ланок падає у вільному повітрі під коренем.
  const freeLinks = 3;
  for (let index = 0; index < count; index += 1) {
    const tag = `island:fall:${index}`;
    /*
     * Клини розведені по колу рівно, з місцевим зсувом. Випадковий вибір
     * із повторами посадив би два водоспади на один клин, і замість двох
     * падінь вийшло б одне подвійної яскравості.
     */
    const segment = Math.floor(
      ((index + 0.5) / count + (seededUnit(seed, `${tag}:spin`) - 0.5) * 0.6 / count)
      * PORTAL_ISLAND_SEGMENTS,
    ) % PORTAL_ISLAND_SEGMENTS;
    const angle = segmentAngle(seed, segment, PORTAL_ISLAND_SEGMENTS);
    const out: Point = [Math.cos(angle), 0, Math.sin(angle)];
    const across: Point = [-out[2], 0, out[0]];
    /*
     * ВУЗЬКО. 0.028…0.048 радіуса острова дало в кадрі білі ЛАТКИ на
     * породі завширшки з десяту частину острова: на такій ширині стрічка
     * перестає бути струменем. Водоспад упізнають за тим, що він ДОВГИЙ І
     * ТОНКИЙ, а не за тим, що він білий.
     */
    const width = 0.016 + seededUnit(seed, `${tag}:wide`) * 0.013;
    /*
     * ВОДА ЙДЕ ПО ПОРОДІ, А НЕ ПО ПРЯМІЙ, І ЦЕ НЕ ПРИКРАСА.
     *
     * Перша редакція пускала стрічку рівно вниз від кромки плато. Кадр
     * показав, чим це є: острів найширший НЕ на кромці — виміряно 1.03
     * радіуса на плато проти 1.32 на висоті −0.4, — тож пряма стрічка йшла
     * ВСЕРЕДИНІ породи й з'являлась лише там, де обрив уже звузився. Видно
     * було нижню половину падіння без початку, тобто стовп туману.
     *
     * Тому профіль береться з тієї самої арифметики, що будує обрив
     * (`ISLAND_ROOT_ROWS_ALL` і `islandRadiusAt`), і відсувається назовні
     * на зазор. Це ще й правда про воду: вона тече по каменю.
     *
     * Береться ГЛАДКИЙ профіль, без пошумленого `rootPoint`: шум там
     * кидається на кожну вершину окремо, і стрічка від нього тремтіла б
     * упоперек породи замість того, щоб її облягати.
     */
    const clearance = 0.035 + seededUnit(seed, `${tag}:gap`) * 0.02;
    const spine = (link: number): { at: Point; spread: number } => {
      const rim = portalIslandHeightAt(seed, angle, 1);
      const spread = link / (rows + freeLinks + 1);
      /*
       * ЛАНКА НУЛЬ — САМА КРОМКА. `ISLAND_ROOT_ROWS_ALL` починається вже
       * НИЖЧЕ за неї, тож без цієї ланки вода з'являлась на кілька
       * пікселів під плато, і в кадрі це читалось не падінням, а білою
       * подряпиною на породі: витік було видно, а джерело — ні.
       */
      if (link === 0) {
        const radius = islandRadiusAt(seed, angle) + clearance;
        return { at: [Math.cos(angle) * radius, rim, Math.sin(angle) * radius], spread };
      }
      if (link <= rows) {
        const [share, drop] = ISLAND_ROOT_ROWS_ALL[link - 1]!;
        const radius = islandRadiusAt(seed, angle) * share + clearance;
        return { at: [Math.cos(angle) * radius, rim - drop, Math.sin(angle) * radius], spread };
      }
      // Нижче кореня падати нема по чому: вода йде у вільне повітря,
      // тримаючи той радіус, на якому корінь її покинув.
      const [lastShare, lastDrop] = ISLAND_ROOT_ROWS_ALL[rows - 1]!;
      const radius = islandRadiusAt(seed, angle) * lastShare + clearance;
      const step = (link - rows) * 0.16;
      return {
        at: [Math.cos(angle) * radius, rim - lastDrop - step, Math.sin(angle) * radius],
        spread,
      };
    };
    const edge = (link: number, side: number): Point => {
      const { at, spread } = spine(link);
      // Ширшає донизу, але не безмежно: корінь квадратний дає завісу, а не лійку.
      const half = width * (1 + Math.sqrt(spread) * 1.4);
      const sway = (seededUnit(seed, `${tag}:sway:${link}`) - 0.5) * width * 0.4;
      return [
        at[0] + across[0] * (side * half + sway),
        at[1],
        at[2] + across[2] * (side * half + sway),
      ];
    };
    /*
     * ЗГАСАННЯ РАХУЄТЬСЯ ПО ГЛИБИНІ, А НЕ ПО НОМЕРУ ЛАНКИ, і це друге
     * виправлення за кадром.
     *
     * Ланки не рівні: біля кромки ряди кореня стоять густо, а нижче
     * розходяться. Згасання за номером ланки давало яскравим перші
     * тридцять відсотків ЛАНОК, що по висоті — кілька пікселів: у кадрі
     * це читалось не падінням, а білою латкою на породі. Перед тим
     * зворотна крайність — 1 - t² — тримала стрічку майже до кінця, і
     * під островом стояв сірий стовп пари.
     *
     * Глибина — те, що бачить око. Струмінь яскравий там, де він ще
     * цілий, і тане з висотою падіння.
     */
    const links = rows + freeLinks + 1;
    const spineY: number[] = [];
    for (let link = 0; link <= links; link += 1) spineY.push(spine(link).at[1]);
    const span = Math.max(1e-6, spineY[0]! - spineY[links]!);
    const fade = (link: number): number => {
      const fallen = (spineY[0]! - spineY[Math.min(link, links)]!) / span;
      return Math.max(0, 1 - fallen) ** 1.25;
    };
    for (let link = 0; link < links; link += 1) {
      const aboveL = edge(link, -1);
      const aboveR = edge(link, 1);
      const belowL = edge(link + 1, -1);
      const belowR = edge(link + 1, 1);
      const top = fade(link);
      const bottom = fade(link + 1);
      // Яскравіше вгорі, де струмінь ще цілий; нижче — водяний пил.
      const shade = 0.66 + 0.34 * top;
      mesh.alpha = [top, top, bottom];
      mesh.push(aboveL, aboveR, belowR, shade);
      mesh.alpha = [top, bottom, bottom];
      mesh.push(aboveL, belowR, belowL, shade);
    }
  }
  return finish(mesh);
}

// ── Море хмар ───────────────────────────────────────────────

// ── Рослинність ─────────────────────────────────────────────

/** Профіль якості сцени — той самий ключ, що в решти лічильників. */
export type PortalQuality = 'high' | 'balanced' | 'low' | 'fallback';

/** Скільки кущиків росте на плато, за профілем якості. */
export const PORTAL_FLORA_TUFTS: Record<PortalQuality, number> = {
  high: 38, balanced: 24, low: 12, fallback: 0,
};

/**
 * Частка трикутників плато, вкритих мохом (ADR-0166).
 *
 * ЛАТКА — ЦЕ САМ ТРИКУТНИК ПЛАТО, піднятий на волосину. Не довільний
 * многокутник «десь на поверхні»: довільний лежав би у власній площині й
 * провисав над хордою рівно так само, як провисав кущик, посаджений на
 * криву висоти (ADR-0140). Трикутник плато лежить на плато за побудовою.
 *
 * Тому й міряється це часткою, а не кількістю: клітинок на плато рівно
 * `PORTAL_ISLAND_SEGMENTS * (кільця - 1) * 2`, і частка каже, скільки з
 * них зелені.
 */
export const PORTAL_MOSS_COVER: Record<PortalQuality, number> = {
  high: 0.52, balanced: 0.38, low: 0.22, fallback: 0,
};

/**
 * Кущі по кромці плато — те, що звисає з обриву.
 *
 * В еталоні власника край острова НЕ голий: зелень перевалюється через
 * кромку й висить над порожнечею. Це найдешевша частина всієї зелені й
 * найпомітніша — саме кромка малює силует острова на тлі неба.
 */
export const PORTAL_RIM_TUFTS: Record<PortalQuality, number> = {
  high: 128, balanced: 78, low: 34, fallback: 0,
};

/** Кущі, що вже читаються деревцями. Стоять поясом ближче до кромки. */
export const PORTAL_BUSHES: Record<PortalQuality, number> = {
  high: 22, balanced: 14, low: 6, fallback: 0,
};

/**
 * Один кущик: три листки з однієї точки, кожен своїм азимутом.
 *
 * ТРИ, А НЕ ОДИН. Листок — це один трикутник, тобто площина; з боку вона
 * видна смужкою в піксель, і кущик із одного листка зникає рівно тоді, коли
 * пара повернула сцену. Три листки, розведені азимутом, лишають хоч один
 * повернутим до ока з будь-якого боку — і це, а не пишність, вирішує,
 * скільки їх тут.
 *
 * ДВОБІЧНИЙ МАТЕРІАЛ, тож намотка на листку нічого не значить — і саме тому
 * листок коштує ОДИН трикутник, а не два. Це той самий виняток, що в хмар
 * (ADR-0159): пласка пелюстка не є тілом, і питати в неї, де в неї
 * середина, немає сенсу.
 *
 * Тон рахується явно, а не з нахилу до ключа: листок стоїть майже
 * вертикально, тож `litShade` дала б усім листкам одне число, і кущик
 * читався б пласкою плямою. Темніше при землі, світліше на кінчику — так
 * само, як хмара світліша вгорі.
 */
function pushTuft(
  mesh: Soup,
  seed: number,
  tag: string,
  seat: Point,
  size: number,
  blades = 3,
): void {
  const spin = seededUnit(seed, `${tag}:spin`) * Math.PI * 2;
  for (let blade = 0; blade < blades; blade += 1) {
    const angle = spin + (blade / blades) * Math.PI * 2
      + (seededUnit(seed, `${tag}:skew:${blade}`) - 0.5) * 0.7;
    const width = size * (0.11 + seededUnit(seed, `${tag}:wide:${blade}`) * 0.08);
    const height = size * (0.62 + seededUnit(seed, `${tag}:tall:${blade}`) * 0.72);
    // Кінчик відхилений УБІК, а не строго вгору: рівні листки читаються
    // щіткою. Нахил свій на кожен, і в межах чверті власної висоти.
    const lean = size * (0.18 + seededUnit(seed, `${tag}:lean:${blade}`) * 0.34);
    const across: Point = [-Math.sin(angle), 0, Math.cos(angle)];
    const along: Point = [Math.cos(angle), 0, Math.sin(angle)];
    const left: Point = [
      seat[0] + across[0] * width,
      seat[1],
      seat[2] + across[2] * width,
    ];
    const right: Point = [
      seat[0] - across[0] * width,
      seat[1],
      seat[2] - across[2] * width,
    ];
    const tip: Point = [
      seat[0] + along[0] * lean,
      seat[1] + height,
      seat[2] + along[2] * lean,
    ];
    mesh.push(left, right, tip, [0.5, 0.5, 0.98]);
  }
}

/**
 * Скільки трикутників меша трави належить кожному роду зелені, в порядку
 * укладання: мох плато, кущики плато, кущі, звиси з кромки, мох на шапках
 * брил, трава на брилах.
 *
 * ПУБЛІКУЄТЬСЯ З МЕША, А НЕ РАХУЄТЬСЯ ЗАНОВО. Раніше тест ділив меш на
 * кущики кроком у три трикутники — це працювало, поки в меші не було
 * нічого, крім кущиків. Тепер там п'ять родів зелені різної довжини, і
 * будь-яка спроба відновити межі ділінням стала б ДРУГОЮ КОПІЄЮ тієї
 * самої арифметики: вона розійшлася б із першою тієї миті, коли хтось
 * поворухне густину моху. Число, яке залежить від насіння, мусить іти
 * від того, хто його породив.
 */
export interface PortalFloraLayout {
  readonly moss: number;
  readonly tufts: number;
  readonly bushes: number;
  readonly drapes: number;
  readonly rockMoss: number;
  readonly rockTufts: number;
}

/**
 * Половина клітинки плато — трикутник, який справді лежить у мешеві.
 *
 * Витягнуто в функцію, бо користувачів стало троє: кущик, кущ і мохова
 * латка. Друга копія цієї арифметики розійшлася б із першою, і латка
 * поїхала б від трави на тому самому камені — та сама вада, від якої
 * `driftRockAt` тримає купи разом (ADR-0163).
 */
function crownCell(
  seed: number,
  segment: number,
  level: number,
  outerHalf: boolean,
): readonly [Point, Point, Point] {
  const next = (segment + 1) % PORTAL_ISLAND_SEGMENTS;
  const inner = crownPoint(seed, segment, level);
  return outerHalf
    ? [inner, crownPoint(seed, next, level + 1), crownPoint(seed, segment, level + 1)]
    : [inner, crownPoint(seed, next, level), crownPoint(seed, next, level + 1)];
}

/**
 * Точка ВСЕРЕДИНІ трикутника плато, барицентрично. Три спроби до цього, і
 * кожна попередня — окрема вада:
 *
 *  1. **На криву висоти** — ADR-0140. Плато намальоване пласкими
 *     трикутниками МІЖ вибірками кривої, між ними хорда провисає, і
 *     кущик висить над каменем.
 *  2. **На найнижчий кут клітинки** — правило уламка й храму, і воно
 *     їхнє по праву: вони лежать на клітинці ПІДОШВОЮ, тож вищий кут
 *     підняв би протилежний у повітря. Кущик підошви не має, він точка,
 *     — і те саме правило топило його на 0.021 радіуса острова там, де
 *     клітинка крута.
 *  3. **На саму вершину.** Належить мешу за визначенням, але вершини
 *     стоять ґраткою, а ще промінь, пущений рівно крізь вершину, не
 *     влучає в жоден із трикутників, що в ній сходяться, — тобто таку
 *     посадку не можна ані перевірити, ані відрізнити від ґратки оком.
 *
 * Точка всередині трикутника лежить у його площині, тобто на мешеві, за
 * арифметикою. Ваги тримаються не ближче за 0.12 до ребра, щоб кущик не
 * з'їжджав на стик двох площин, де «поверхня» неоднозначна.
 */
function crownSeat(
  seed: number,
  tag: string,
  cell: readonly [Point, Point, Point],
  sink = 0.004,
): Point {
  const rawA = 0.12 + seededUnit(seed, `${tag}:bary`) * 0.76;
  const rawB = 0.12 + seededUnit(seed, `${tag}:bary2`) * (0.88 - rawA);
  const weights = [rawA, rawB, 1 - rawA - rawB] as const;
  return [
    cell[0][0] * weights[0] + cell[1][0] * weights[1] + cell[2][0] * weights[2],
    cell[0][1] * weights[0] + cell[1][1] * weights[1] + cell[2][1] * weights[2] - sink,
    cell[0][2] * weights[0] + cell[1][2] * weights[1] + cell[2][2] * weights[2],
  ];
}

/**
 * Звисаюча зелень: листок, що падає з кромки НАЗОВНІ й УНИЗ.
 *
 * `pushTuft` тут не годиться, і це не дрібниця форми. Його листок завжди
 * тягнеться вгору від сідала — так росте трава, — а кромка потрібна
 * протилежним: зелень перевалюється через край і висить над порожнечею.
 * Саме звис, а не кущик на краю, робить силует острова зеленим на тлі
 * неба; кущик на кромці з камери під 23.6° ховається за самою кромкою.
 *
 * Листків два, а не три: третій дивився б усередину острова, де його
 * затуляє плато.
 */
function pushDrape(
  mesh: Soup,
  seed: number,
  tag: string,
  seat: Point,
  outward: number,
  size: number,
): void {
  const out: Point = [Math.cos(outward), 0, Math.sin(outward)];
  const across: Point = [-out[2], 0, out[0]];
  for (let leaf = 0; leaf < 2; leaf += 1) {
    const skew = (seededUnit(seed, `${tag}:skew:${leaf}`) - 0.5) * 0.9;
    const width = size * (0.16 + seededUnit(seed, `${tag}:wide:${leaf}`) * 0.12);
    /*
     * НАЗОВНІ БІЛЬШЕ, НІЖ УНИЗ, і це не смак форми. Камера дивиться на
     * острів згори під 23.6°: те, що падає рівно вниз, ховається за
     * власною кромкою, і з кадру видно тільки виліт. Перша редакція
     * мала виліт 0.42…0.92 розміру проти падіння 0.7…2.2 — тобто
     * зелень, посаджену там, де її не видно.
     */
    const reach = size * (0.72 + seededUnit(seed, `${tag}:reach:${leaf}`) * 0.7);
    const fall = size * (0.6 + seededUnit(seed, `${tag}:fall:${leaf}`) * 1.4);
    const base: Point = [
      seat[0] + across[0] * skew * size * 0.4,
      seat[1],
      seat[2] + across[2] * skew * size * 0.4,
    ];
    const left: Point = [base[0] + across[0] * width, base[1], base[2] + across[2] * width];
    const right: Point = [base[0] - across[0] * width, base[1], base[2] - across[2] * width];
    const tip: Point = [
      base[0] + out[0] * reach,
      base[1] - fall,
      base[2] + out[2] * reach,
    ];
    // Темніше на кінчику, а не на основі: звис висить у тіні власного
    // острова, і світло до нього приходить згори, з боку кромки.
    mesh.push(left, right, tip, [0.95, 0.95, 0.46]);
  }
}

/**
 * Рослинність на всіх островах — і на великому, і на малих.
 *
 * ОКРЕМИЙ МЕШ, І ЦЕ КОШТУЄ П'ЯТИЙ DRAW CALL. Причина не в геометрії, а в
 * кольорі: вершинний колір у `meshBasicMaterial` МНОЖИТЬСЯ на колір
 * матеріалу, тож трава всередині меша каменю вийшла б кольору
 * «камінь × зелень». Пофарбувати її можна лише власним матеріалом, а
 * власний матеріал і є draw call (ADR-0163).
 *
 * Зате меш ОДИН на обидва місця, і саме тому він несе атрибут левітації:
 * кущик на брилі мусить літати РАЗОМ із нею, а кущик на плато — стояти.
 * Фаза [0, 0] дає рівно нуль зсуву, і це єдине місце в сцені, де
 * нерухомість тримається переданим нулем, а не відсутністю атрибута.
 * Названо навмисно, і тест на це є.
 */
export function buildPortalFloraGeometry(
  seed: number,
  quality: PortalQuality,
): THREE.BufferGeometry {
  const mesh = soup();
  const tufts = PORTAL_FLORA_TUFTS[quality];
  const rocks = PORTAL_DRIFT_ROCKS[quality];

  /*
   * ПРОФІЛЬ, А НЕ П'ЯТЬ ЧИСЕЛ. Раніше сюди передавали окремо кількість
   * кущиків і окремо кількість брил, і другу мусив підібрати той, хто
   * кличе: трава на брилах будується по одній на камінь, тож розбіжність
   * означала б кущики в порожньому небі. Тепер ключ профілю один, і
   * розійтись цим числам більше нема де.
   */

  /*
   * НА ПЛАТО — від третього кільця назовні.
   *
   * Ближче до осі стоїть жеода з кристалами, і кущик під нею просто
   * закопаний: намальований, невидимий і оплачений. Кільця нумеруються від
   * центру, тож 2…5 — це поясок між артефактом і кромкою.
   */
  mesh.float = [0, 0];

  /*
   * МОХОВІ ЛАТКИ — ПЕРШЕ, ЩО РОБИТЬ ОСТРІВ ЗЕЛЕНИМ (ADR-0166).
   *
   * Кущики дали 0.04% кадру: трава, яку видно, лише коли її шукаєш. В
   * еталоні власника зелена САМА ЗЕМЛЯ, а трава на ній — деталь. Латка
   * коштує один трикутник і вкриває площу, якої тридцять кущиків не
   * вкриють ніколи.
   *
   * ЧОМУ НЕ ПОФАРБУВАТИ ПЛАТО. Вершинний колір множиться на колір
   * матеріалу, а материал плато — камінь; помножити камінь на зелень
   * можна лише вниз, і вдень це дало б болото замість моху. Уночі гірше:
   * палітра навмисно тримає траву СВІТЛІШОЮ за камінь («трава ловить
   * місяць»), а множення вгору не вміє. Тому мох живе в меші трави, де
   * колір уже правильний в обидві пори доби.
   *
   * Клітинки перебираються ВСІ, а не вибираються випадково: вибір із
   * повторами дав би латки одна на одній і лисини поруч. Кільце 1 —
   * найближче до жеоди, за яким уже видно поверхню.
   */
  const mark = (): number => mesh.positions.length / 9;
  const startMoss = mark();
  const cover = PORTAL_MOSS_COVER[quality];
  for (let segment = 0; segment < PORTAL_ISLAND_SEGMENTS; segment += 1) {
    for (let level = 1; level + 1 < ISLAND_TOP_RINGS.length; level += 1) {
      for (const outerHalf of [false, true]) {
        const tag = `island:moss:${segment}:${level}:${outerHalf ? 'o' : 'i'}`;
        /*
         * ДВІ ЧАСТОТИ, А НЕ ОДНА. Кидок на клітинку сам по собі дає
         * конфеті: зелений трикутник, сірий, зелений — і кадр показав
         * саме це, лускату мозаїку замість луки. Зелень у природі
         * росте плямами, і пляма тут — зона з восьми клинів на два
         * кільця. Місцевий кидок лишає її краї рваними.
         */
        const zone = seededUnit(seed, `island:mosszone:${Math.floor(segment / 8)}:${Math.floor(level / 2)}`);
        if (seededUnit(seed, tag) * 0.45 + zone * 0.55 >= cover) continue;
        const cell = crownCell(seed, segment, level, outerHalf);
        /*
         * Піднято на 0.006 радіуса острова. Нуль дав би z-fighting із
         * породою під собою — два трикутники в одній площині сперечаються
         * за піксель і мерехтять при найменшому русі камери.
         */
        const lifted = cell.map((point) => [point[0], point[1] + 0.006, point[2]] as Point);
        /*
         * ВЛАСНИЙ МНОЖНИК ТОНУ, темніший за все інше в цьому меші.
         * Латка лежить майже горизонтально, тобто дивиться просто на
         * ключ, і без множника виходила майже повним кольором матеріалу
         * — найяскравішою зеленню сцени. Земля не буває яскравішою за
         * те, що на ній росте.
         */
        pushLit(mesh, lifted[0]!, lifted[1]!, lifted[2]!, 0.66);
      }
    }
  }

  /*
   * КУЩИКИ — від третього кільця назовні.
   *
   * Ближче до осі стоїть жеода з кристалами, і кущик під нею просто
   * закопаний: намальований, невидимий і оплачений. Кільця нумеруються від
   * центру, тож 2…5 — це поясок між артефактом і кромкою.
   */
  const startTufts = mark();
  for (let index = 0; index < tufts; index += 1) {
    const tag = `island:flora:${index}`;
    const segment = Math.floor(seededUnit(seed, `${tag}:segment`) * PORTAL_ISLAND_SEGMENTS);
    const ring = 2 + Math.floor(seededUnit(seed, `${tag}:ring`) * 4);
    const level = Math.min(ISLAND_TOP_RINGS.length - 2, ring);
    const cell = crownCell(seed, segment, level, seededUnit(seed, `${tag}:half`) >= 0.5);
    const seat = crownSeat(seed, tag, cell);
    /*
     * РОЗМІР — ВИМІРЯНИЙ, а не вгаданий (ADR-0163).
     *
     * Перша редакція мала 0.052…0.088 радіуса острова, і кадр показав, чим
     * це є: медіана кущика 47 пікселів на екрані заввишки 1830, найбільший
     * 172 — тобто чверть висоти самого кристала. Власник просив «трохи
     * рослинності», а вийшли зарості.
     *
     * 0.020…0.034 дає медіану 18 пікселів: трава при кристалі, а не поруч
     * із ним.
     */
    pushTuft(mesh, seed, tag, seat, 0.020 + seededUnit(seed, `${tag}:size`) * 0.014);
  }

  /*
   * КУЩІ — той самий кущик, більший і густіший.
   *
   * Стовбура немає навмисно, і це не лінощі: меш трави має ОДИН колір
   * матеріалу, тож коричневий стовбур у ньому неможливий, а зелений
   * стовбур — це просто ще один листок. При екранній висоті кущика в 18
   * пікселів стовбур усе одно був би завтовшки в два, тобто шумом.
   * П'ять листків замість трьох і потрійний розмір дають силует куща —
   * рівно те, чим деревце в еталоні й читається з нашої відстані.
   */
  const startBushes = mark();
  for (let index = 0; index < PORTAL_BUSHES[quality]; index += 1) {
    const tag = `island:bush:${index}`;
    const segment = Math.floor(seededUnit(seed, `${tag}:segment`) * PORTAL_ISLAND_SEGMENTS);
    // Пояс 4…6: далі від жеоди, ближче до кромки, де в еталоні й стоять дерева.
    const level = 4 + Math.floor(seededUnit(seed, `${tag}:ring`) * 3);
    const cell = crownCell(seed, segment, level, seededUnit(seed, `${tag}:half`) >= 0.5);
    const seat = crownSeat(seed, tag, cell);
    pushTuft(mesh, seed, tag, seat, 0.058 + seededUnit(seed, `${tag}:size`) * 0.042, 5);
  }

  /*
   * ЗВИС ІЗ КРОМКИ — найдешевша зелень і найпомітніша.
   *
   * Кромка малює силует острова на тлі неба, і саме там голий камінь
   * читається зрізаним. Сідало береться на ЗОВНІШНЬОМУ кільці плато, а
   * зелень падає назовні й униз — через край.
   */
  const startDrapes = mark();
  const rim = ISLAND_TOP_RINGS.length - 2;
  for (let index = 0; index < PORTAL_RIM_TUFTS[quality]; index += 1) {
    const tag = `island:rim:${index}`;
    const segment = Math.floor(seededUnit(seed, `${tag}:segment`) * PORTAL_ISLAND_SEGMENTS);
    const cell = crownCell(seed, segment, rim, true);
    const seat = crownSeat(seed, tag, cell);
    const outward = Math.atan2(seat[2], seat[0]);
    pushDrape(mesh, seed, tag, seat, outward, 0.075 + seededUnit(seed, `${tag}:size`) * 0.085);
  }

  /*
   * НА БРИЛАХ — по одному кущику, і на самій шапці.
   *
   * Шапка брили — це колишня поверхня острова, з якої її вирвало
   * (`buildPortalDriftGeometry`), тобто єдине місце на камені, де трава
   * могла лишитись. На зламі знизу її не буває.
   *
   * Розмір іде від каменя, а не сталий: брила вдвічі більша носить кущик
   * вдвічі більший, інакше на дальніх каменях трава читалась би мохом, а
   * на ближніх — деревами.
   */
  /*
   * МОХ НА ШАПКАХ БРИЛ — дрібні острови теж зелені.
   *
   * Шапка брили — це колишня поверхня острова, з якої її вирвало, тобто
   * рівно те місце, де зелень і мала лишитись. Без неї камені в небі
   * читаються сірими плитами поруч із зеленим островом, і кадр каже, що
   * вони з іншого світу.
   *
   * Віяло шапки будується ТІЄЮ САМОЮ функцією, що й сам камінь
   * (`driftRockCorner`): друга копія цих кидків розійшлася б із першою й
   * зелень поїхала б із каменя.
   */
  const startRockMoss = mark();
  for (let index = 0; index < rocks; index += 1) {
    const rock = driftRockAt(seed, index, rocks);
    const tag = `island:driftmoss:${index}`;
    if (seededUnit(seed, `${tag}:bare`) < 0.3) continue;
    mesh.float = rock.float;
    const lift = rock.size * 0.012;
    const cap: Point = [rock.cx, rock.rise + rock.top * 1.16 + lift, rock.cz];
    for (let corner = 0; corner < DRIFT_ROCK_SIDES; corner += 1) {
      const next = (corner + 1) % DRIFT_ROCK_SIDES;
      const a = driftRockCorner(seed, rock, corner, 1);
      const b = driftRockCorner(seed, rock, next, 1);
      pushLit(
        mesh,
        [a[0], a[1] + lift, a[2]],
        cap,
        [b[0], b[1] + lift, b[2]],
        0.66,
      );
    }
  }

  const startRockTufts = mark();
  for (let index = 0; index < rocks; index += 1) {
    const rock = driftRockAt(seed, index, rocks);
    const tag = `island:driftflora:${index}`;
    if (seededUnit(seed, `${tag}:bare`) < 0.28) continue;
    mesh.float = rock.float;
    const away = seededUnit(seed, `${tag}:away`) * Math.PI * 2;
    const reach = rock.size * 0.42 * seededUnit(seed, `${tag}:reach`);
    pushTuft(mesh, seed, tag, [
      rock.cx + Math.cos(away) * reach,
      rock.rise + rock.top * 0.94,
      rock.cz + Math.sin(away) * reach,
    ], rock.size * 0.34);
  }

  const geometry = finish(mesh);
  const layout: PortalFloraLayout = {
    moss: startTufts - startMoss,
    tufts: startBushes - startTufts,
    bushes: startDrapes - startBushes,
    drapes: startRockMoss - startDrapes,
    rockMoss: startRockTufts - startRockMoss,
    rockTufts: mark() - startRockTufts,
  };
  geometry.userData.floraLayout = layout;
  return geometry;
}

/** Скільки кутів має летюча брила. Спільне для каменю й моху на ньому. */
const DRIFT_ROCK_SIDES = 7;

/**
 * Кут летючої брили — СПІЛЬНА арифметика каменю й того, що на ньому росте.
 *
 * Витягнуто з `buildPortalDriftGeometry` тоді, коли шапка брили дістала
 * мох (ADR-0166). Друга копія цих кидків розійшлася б із першою тієї миті,
 * коли хтось поворухне тремтіння кутів, і зелень поїхала б із каменя —
 * рівно те, від чого `driftRockAt` уже стереже розміщення й фазу.
 */
function driftRockCorner(
  seed: number,
  rock: { tag: string; cx: number; cz: number; rise: number; size: number; top: number; spin: number },
  corner: number,
  level: number,
): Point {
  const gap = (Math.PI * 2) / DRIFT_ROCK_SIDES;
  const drift = (seededUnit(seed, `${rock.tag}:step:${corner}`) - 0.5) * 2 * gap * 0.45;
  const a = rock.spin + corner * gap + drift;
  const wobble = 0.72 + seededUnit(seed, `${rock.tag}:edge:${corner}`) * 0.56;
  const radius = rock.size * wobble * (level === 0 ? 1 : 0.88);
  const lean = (seededUnit(seed, `${rock.tag}:lean:${corner}`) - 0.5) * rock.size * 0.22;
  return [
    rock.cx + Math.cos(a) * radius,
    rock.rise + (level === 0 ? 0 : rock.top) + lean,
    rock.cz + Math.sin(a) * radius,
  ];
}

/**
 * Хмари далеко внизу — те, що робить висоту висотою.
 *
 * ЧОМУ ТАК ДАЛЕКО, І ЧОМУ ВОНИ ВСЕ ОДНО ВИЩЕ ЗА КРАЙ. Промінь, що
 * проходить над дальнім краєм острова, має нахил близько 14° від
 * горизонталі; усе, що нижче за цей нахил, затуляє саме плато. Отже
 * ХМАРИ ПІД ГОРИЗОНТОМ ІЗ ЦІЄЇ КАМЕРИ НЕМОЖЛИВІ — під ним завжди острів.
 *
 * Це не поразка, а те, як воно й буває: з висоти хмари видно НА СВОЄМУ
 * РІВНІ. Тому вони стоять за 17–39 радіусів, лінія їхніх основ лежить на
 * 2.6–4.8 нижче за плато, а тіло займає смугу приблизно від 6.5 до 0.55
 * під ним — так силует лягає трохи вище за край острова, тобто в небі, а
 * не на землі. Ближче — і хмара опиняється рівно за островом, тобто ніде.
 *
 * ЧОМУ ВЕРТИКАЛЬНІ. Горизонтальна пластина з камери, що стоїть на 8°
 * вище за неї, видно як волосину. Хмара тут — вертикальна пелюстка,
 * повернута до осі: з єдиної камери, яка має значення, це і є хмара.
 */
export function buildPortalCloudGeometry(seed: number, count: number): THREE.BufferGeometry {
  const mesh = soup();
  for (let index = 0; index < count; index += 1) {
    const tag = `island:cloud:${index}`;
    const angle = ((index + seededUnit(seed, `${tag}:spin`) * 0.9) / Math.max(1, count)) * Math.PI * 2;
    /*
     * ВІД КІЛЬЦЯ КАМЕРИ, а не числом (ADR-0165) — той самий урок, що з
     * брилами: 17…39 було правдою, поки камера стояла на 3.33 радіуса.
     * Тепер вона на 6.67, і те саме число означає вже інше.
     *
     * 1.3…4.6 кільця: найближче пасмо стоїть за брилами, найдальше — на
     * межі туману. Ближче не можна — хмара між оком і островом читається
     * не повітрям, а плямою на об'єктиві.
     */
    const away = seededUnit(seed, `${tag}:reach`);
    const reach = PORTAL_CAMERA_RING * (1.3 + away * 3.3);
    /*
     * ПОВІТРЯНА ПЕРСПЕКТИВА, ЗАПЕЧЕНА В ВЕРШИНУ (ADR-0165).
     *
     * Туман до хмар не дістає й дістати не може (див. коментар над
     * `<fog>` у `PortalEnvironment.tsx`): усе море стоїть далеко за
     * `fogFar`, тож під туманом воно стало б рівно кольором туману, тобто
     * зникло б цілком. Без туману ж дальня хмара нічим не відрізняється
     * від ближньої — і кадр це показав числом: у верхній половині смуги
     * хмари яскравіші за нижню (226 проти 202 з 255), тобто далина
     * читалась БЛИЖЧЕ за близину. Саме через це небо виглядало
     * наклеєними паперовими стрічками, а не глибиною.
     *
     * Тому глибина рахується тут, від власної віддалі хмари, і їде
     * четвертим каналом кольору. 0.86 зблизька, 0.24 на межі: дальнє
     * пасмо лишається натяком, ближнє тримає силует.
     */
    mesh.alpha = 0.86 - away * 0.62;
    /*
     * ВИСОТА МОРЯ ХМАР. Було −2.6…−4.8, стало −1.7…−3.6 на пряму вказівку
     * власника «хмари підніми вище» (ADR-0162).
     *
     * Межа зверху не смак: корінь острова закінчується близько −1.5, і
     * хмара, що зайшла вище за неї, перестає бути морем ПІД островом — вона
     * починає його різати. −1.7 лишає між ними приблизно двісті
     * тисячних острова, тобто зазор, який видно, і не більше.
     */
    /*
     * ВИСОТА МОРЯ ХМАР. −1.7…−3.6 → −0.9…−5.4 (ADR-0165): смуга розтягнута
     * і вгору, і вниз, бо в еталоні хмари не лінія, а ОБ'ЄМ — вони стоять
     * і врівень з островом, і глибоко під ним.
     *
     * Вище за −0.9 не можна: корінь острова закінчується близько −1.5, і
     * хмара, що зайшла вище, перестає бути морем ПІД островом — вона
     * починає його різати.
     */
    const rise = -1.6 - seededUnit(seed, `${tag}:rise`) * 6.6;
    /*
     * ШИРИНА ЙДЕ ВІД ВІДДАЛІ, тобто задається В ГРАДУСАХ КАДРУ, а не в
     * одиницях сцени. Кадр показав, чому: хмара завширшки 10.8 одиниці
     * за 17 радіусів займає близько 35° — ширше за весь кадр телефона
     * (по горизонталі це приблизно 20°). Те, що ширше за кадр, не має
     * силуету взагалі; воно читається сірою плитою, тобто гірським
     * пасмом, а не хмарою, хай яку правильну стрункість показує мірка.
     *
     * 0.09–0.19 віддалі — це 5–11° на хмару, тобто дві-три хмари
     * впоперек кадру. Сцену будують для ОДНОЇ камери (див. «чому
     * вертикальні» вище), тож кутовий розмір тут — чесніша величина за
     * лінійний.
     */
    const width = reach * (0.09 + seededUnit(seed, `${tag}:span`) * 0.1);
    /*
     * ВИСОТА ЙДЕ ВІД ШИРИНИ, А НЕ ВІД ВЛАСНОГО КИДКА, і в цьому вся
     * правка. Перша редакція кидала ширину й висоту незалежно
     * (`0.9 + u * 1.4`), тобто стрункість виходила добутком двох
     * випадковостей: `cloudSilhouetteProfile` показала середнє 8.9 при
     * розкиді від 4.5 до 18.6, тоді як в еталона 5.2. Хмара зі
     * стрункістю 18 — це пласка смуга, тобто столова гора.
     *
     * Еталон дає ФОРМУ, а не РОЗМІР: метакульове пасмо з Blender має
     * 5.2 незалежно від того, на скільки одиниць його масштабувати.
     * Тому розмір лишається вільним (ширина 4.2…10.8), а стрункість
     * кидається у вузькій смузі навколо еталонної.
     */
    const slender = 2.95 + seededUnit(seed, `${tag}:slender`) * 0.75;
    const height = width / slender;
    const cx = Math.cos(angle) * reach;
    const cz = Math.sin(angle) * reach;
    // Пелюстка повернута до осі: дивиться туди, де стоїть камера.
    const sideX = -Math.sin(angle);
    const sideZ = Math.cos(angle);
    const at = (u: number, v: number): Point => [
      cx + sideX * u * width * 0.5,
      rise + v * height,
      cz + sideZ * u * width * 0.5,
    ];
    /*
     * Горби, а не прямокутник. Прямокутна хмара читається смугою туману;
     * горби дають той самий силует, який кожен упізнає, і коштують
     * п'ятнадцять трикутників на хмару.
     *
     * П'ять — стільки ж, скільки в еталонного пасма метакуль
     * (`CLOUD_LOBES` у `scripts/models/reference-island.py`). Це не
     * збіг: саме кількість горбів задає, наскільки рваним виходить верх,
     * а `topRough` еталона й наш збігаються до чотирьох відсотків.
     */
    const lobes = 5;
    for (let lobe = 0; lobe < lobes; lobe += 1) {
      const centreU = ((lobe + 0.5) / lobes - 0.5) * 1.8;
      /*
       * ГОРБИ НИЗЬКІ Й ШИРОКІ, і це різниця між хмарою та горою.
       *
       * Перша редакція мала високі гострі горби, і кадр показав рівно
       * те, чим вони є геометрично: трикутник із вершиною читається
       * гірським хребтом, а хребет на горизонті скасовує все, заради
       * чого острів літає. Хмара — це широка пласка шапка.
       */
      const spread = 0.62 + seededUnit(seed, `${tag}:lobe:${lobe}`) * 0.44;
      const lift = 0.26 + seededUnit(seed, `${tag}:lift:${lobe}`) * 0.3;
      /*
       * Основа пласка, але не виміряна лінійкою. Рівень конденсації
       * один на все пасмо, тож дно кумулуса рівне — саме цим воно й
       * відрізняється від гори. Проте кожен горб сидить на ньому трохи
       * по-своєму: в еталоні розкид дна — 0.035 висоти, у нас до цієї
       * правки був рівний нуль, а рівний нуль у природі виглядає
       * різаним склом.
       */
      const base = -0.4 + (seededUnit(seed, `${tag}:base:${lobe}`) - 0.5) * 0.17;
      const left = at(centreU - spread, base);
      const right = at(centreU + spread, base);
      const crown = at(centreU, lift);
      const shoulderL = at(centreU - spread * 0.62, lift * 0.62);
      const shoulderR = at(centreU + spread * 0.62, lift * 0.62);
      // Яскравіше вгорі: світло приходить згори навіть тоді, коли його
      // ніхто не рахує.
      mesh.push(left, right, shoulderR, [0.72, 0.72, 0.9]);
      mesh.push(left, shoulderR, shoulderL, [0.72, 0.9, 0.9]);
      mesh.push(shoulderL, shoulderR, crown, [0.9, 0.9, 1.08]);
    }
  }
  return finish(mesh);
}
