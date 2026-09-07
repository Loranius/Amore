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
 */
const ISLAND_SCALE_PER_DISTANCE = 0.3;

/**
 * Світовий масштаб острова для цього кадру.
 *
 * Читається `PortalEnvironment` і більше ніким: сцена мусить мати один
 * масштаб, а не по одному на меш.
 */
export function portalIslandScale(cameraDistance: number): number {
  return Math.max(1, cameraDistance) * ISLAND_SCALE_PER_DISTANCE;
}

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
  high: 18, balanced: 13, low: 8, fallback: 0,
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
  return {
    positions,
    colors,
    uvs,
    push(a, b, c, shade = 1, uv) {
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
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(mesh.colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2));
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

function rootPoint(seed: number, segment: number, level: number): Point {
  const angle = segmentAngle(seed, segment, PORTAL_ISLAND_SEGMENTS);
  const [share, drop] = ISLAND_ROOT_LEVELS[level]!;
  const calm = level === 0 ? ISLAND_CORNICE_CALM : 1;
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
  const levels = ISLAND_ROOT_LEVELS.length;
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
      pushLit(mesh, aboveA, belowA, belowB, deep, [
        wallUv(segment, aboveA[1]), wallUv(segment, belowA[1]), wallUv(segment + 1, belowB[1]),
      ]);
      pushLit(mesh, aboveA, belowB, aboveB, deep, [
        wallUv(segment, aboveA[1]), wallUv(segment + 1, belowB[1]), wallUv(segment + 1, aboveB[1]),
      ]);
      aboveA = belowA;
      aboveB = belowB;
    }
    /*
     * Вістря — своє на кожен клин, а не одна спільна голка. Конус читався
     * б виточеним; злам породи закінчується жменею гострих країв.
     */
    const angle = segmentAngle(seed, segment, segments);
    const tipShift = (seededUnit(seed, `island:tip:${segment}`) - 0.5) * 0.5;
    const tip: Point = [
      Math.cos(angle) * PORTAL_ISLAND_RADIUS * 0.05,
      portalIslandHeightAt(seed, angle, 1) - ISLAND_ROOT_TIP + tipShift,
      Math.sin(angle) * PORTAL_ISLAND_RADIUS * 0.05,
    ];
    pushLit(mesh, aboveA, tip, aboveB, 0.34, [
      wallUv(segment, aboveA[1]), wallUv(segment, tip[1]), wallUv(segment + 1, aboveB[1]),
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
      pushQuad(mesh, ringPoint(-1, corner), ringPoint(-1, next), ringPoint(1, next), ringPoint(1, corner));
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
        if (end > 0) pushLit(mesh, hub, first, second);
        else pushLit(mesh, hub, second, first);
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
  pushQuad(mesh, top[0], top[1], top[2], top[3]);
  for (let face = 0; face < 4; face += 1) {
    const next = (face + 1) % 4;
    pushQuad(mesh, low[face]!, low[next]!, top[next]!, top[face]!);
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
 */
const TEMPLE_AT: readonly [number, number] = [0.34, -0.7];

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
 * 0.0415 радіуса острова — єдине розмірне число храму. Воно каже, який він
 * МАЛИЙ, а не яких він пропорцій: ширина при чотирьох колонах виходить
 * 0.376, тобто на глибині 8 від камери близько 90 CSS-пікселів — менше за
 * чверть екрана телефона.
 */
const TEMPLE_COLUMN_DIAMETER = 0.0415;

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

  const box = (
    cx: number, cy: number, cz: number,
    hx: number, hy: number, hz: number,
    tint = 1,
  ): void => {
    const at = (sx: number, sy: number, sz: number): Point =>
      [cx + sx * hx, cy + sy * hy, cz + sz * hz];
    const top = [at(-1, 1, -1), at(1, 1, -1), at(1, 1, 1), at(-1, 1, 1)] as const;
    const low = [at(-1, -1, -1), at(1, -1, -1), at(1, -1, 1), at(-1, -1, 1)] as const;
    pushQuad(mesh, top[0], top[3], top[2], top[1], tint);
    for (let face = 0; face < 4; face += 1) {
      const next = (face + 1) % 4;
      pushQuad(mesh, low[face]!, low[next]!, top[next]!, top[face]!, tint);
    }
  };

  // ── Стилобат: три сходинки ────────────────────────────────
  let stepTop = ground;
  for (let step = 0; step < 3; step += 1) {
    const grow = 1 + (2 - step) * 0.075;
    box(
      ox, stepTop + TEMPLE_STEP / 2, oz,
      (TEMPLE_WIDTH / 2) * grow, TEMPLE_STEP / 2, (TEMPLE_DEPTH / 2) * grow,
      1 - step * 0.04,
    );
    stepTop += TEMPLE_STEP;
  }

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
      return [
        ox + cx + Math.cos(a) * TEMPLE_COLUMN_RADIUS * taper,
        stepTop + height * level,
        oz + cz + Math.sin(a) * TEMPLE_COLUMN_RADIUS * taper,
      ];
    };
    for (let corner = 0; corner < sides; corner += 1) {
      const next = (corner + 1) % sides;
      pushQuad(mesh, ringPoint(0, corner), ringPoint(0, next), ringPoint(1, next), ringPoint(1, corner));
    }
    // Злам угорі — рваний, а не рівний зріз: у зламаної колони верх
    // нерівний, і саме це відрізняє руїну від недобудови.
    const hub: Point = [ox + cx, stepTop + height + (share2 < 1 ? TEMPLE_COLUMN_RADIUS * 0.3 : 0), oz + cz];
    for (let corner = 0; corner < sides; corner += 1) {
      const next = (corner + 1) % sides;
      const first = ringPoint(1, corner);
      const second = ringPoint(1, next);
      const lift = share2 < 1
        ? seededUnit(seed, `temple:break:${index}:${corner}`) * TEMPLE_COLUMN_RADIUS * 0.7
        : 0;
      pushLit(mesh, hub, [first[0], first[1] + lift, first[2]], [second[0], second[1] + lift, second[2]]);
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
  box(ox, beamY, oz + halfD, halfW + TEMPLE_COLUMN_RADIUS, TEMPLE_BEAM / 2, TEMPLE_COLUMN_RADIUS, 1.04);
  box(ox + halfW, beamY, oz, TEMPLE_COLUMN_RADIUS, TEMPLE_BEAM / 2, halfD, 0.94);
  box(ox - halfW, beamY, oz, TEMPLE_COLUMN_RADIUS, TEMPLE_BEAM / 2, halfD * 0.55, 0.94);

  // ── Уламок фронтону над фасадом ───────────────────────────
  const gableY = beamY + TEMPLE_BEAM / 2;
  // Нахил фронтону — оголошений, а не «щоб гарно»: 14° усередині
  // грецьких 12.5–16°. Перша редакція мала прибиту висоту 0.073, тобто
  // 21°, і це вже читалось двосхилим дахом хати.
  const peak: Point = [
    ox - halfW * 0.15,
    gableY + (halfW + TEMPLE_COLUMN_RADIUS) * Math.tan((TEMPLE_PEDIMENT_DEG * Math.PI) / 180),
    oz + halfD,
  ];
  const left: Point = [ox - halfW - TEMPLE_COLUMN_RADIUS, gableY, oz + halfD];
  const right: Point = [ox + halfW * 0.45, gableY, oz + halfD];
  const depth = TEMPLE_COLUMN_RADIUS * 1.2;
  const back = (p: Point): Point => [p[0], p[1], p[2] - depth];
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
export function buildPortalDriftGeometry(seed: number, count: number): THREE.BufferGeometry {
  const mesh = soup();
  for (let index = 0; index < count; index += 1) {
    const tag = `island:drift:${index}`;
    const angle = ((index + seededUnit(seed, `${tag}:spin`) * 0.8) / Math.max(1, count)) * Math.PI * 2;
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
     */
    const reach = PORTAL_ISLAND_RADIUS * (4.6 + seededUnit(seed, `${tag}:reach`) * 3.4);
    const rise = -0.42 + seededUnit(seed, `${tag}:rise`) * 1.5;
    /*
     * Далі — більша. Без цього дальні брили читаються крихтами, а зміна
     * розміру з відстанню і є те, чим око міряє глибину; тут це єдина
     * підказка глибини взагалі, бо тіней у сцені немає.
     */
    const size = (0.055 + seededUnit(seed, `${tag}:size`) * 0.085)
      * (reach / PORTAL_ISLAND_RADIUS) * 0.42;
    const cx = Math.cos(angle) * reach;
    const cz = Math.sin(angle) * reach;
    const spin = seededUnit(seed, `${tag}:turn`) * Math.PI * 2;

    /*
     * ФОРМА — БРИЛА, А НЕ САМОЦВІТ, і це виправлення знайшов кадр.
     *
     * Перша редакція мала вузький верх і довге вістря вниз — на екрані це
     * читалось діамантом, тобто рівно тим, чим у цій сцені вже є
     * артефакт. Брила навпаки: широке плато згори (колишня поверхня
     * острова, з якої її вирвало), майже пряма стінка і КОРОТКИЙ рваний
     * злам знизу.
     */
    const sides = 7;
    const top = size * (0.42 + seededUnit(seed, `${tag}:cap`) * 0.26);
    const ringPoint = (corner: number, level: number): Point => {
      const a = spin + (corner / sides) * Math.PI * 2;
      const wobble = 0.72 + seededUnit(seed, `${tag}:edge:${corner}`) * 0.56;
      const radius = size * wobble * (level === 0 ? 1 : 0.88);
      const lean = (seededUnit(seed, `${tag}:lean:${corner}`) - 0.5) * size * 0.22;
      return [
        cx + Math.cos(a) * radius,
        rise + (level === 0 ? 0 : top) + lean,
        cz + Math.sin(a) * radius,
      ];
    };
    const cap: Point = [cx, rise + top * 1.16, cz];
    const tip: Point = [
      cx + (seededUnit(seed, `${tag}:tipx`) - 0.5) * size * 0.8,
      rise - size * (0.34 + seededUnit(seed, `${tag}:deep`) * 0.44),
      cz + (seededUnit(seed, `${tag}:tipz`) - 0.5) * size * 0.8,
    ];
    for (let corner = 0; corner < sides; corner += 1) {
      const next = (corner + 1) % sides;
      pushLit(mesh, ringPoint(corner, 1), ringPoint(next, 1), cap, 1.06);
      pushQuad(mesh, ringPoint(corner, 0), ringPoint(next, 0), ringPoint(next, 1), ringPoint(corner, 1));
      pushLit(mesh, ringPoint(next, 0), ringPoint(corner, 0), tip, 0.52);
    }
  }
  return finish(mesh);
}

// ── Море хмар ───────────────────────────────────────────────

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
    const reach = 17 + seededUnit(seed, `${tag}:reach`) * 22;
    const rise = -2.6 - seededUnit(seed, `${tag}:rise`) * 2.2;
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
