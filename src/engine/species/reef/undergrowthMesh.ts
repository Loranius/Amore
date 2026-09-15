// ============================================================
// Чотири дрібні форми: пучок, кулька, камінець, водорість.
// ------------------------------------------------------------
// Кожна будується РАЗ і малюється інстансами: дві сотні одиниць дрібноти
// коштують ЧОТИРИ виклики малювання — по одному на рід.
//
// ПРИМІТКА КАЗАЛА «ТРИ», КОЛИ РОДІВ БУЛО ЧОТИРИ, і не просто помилялась
// числом: вона заявляла правило («тому й форм рівно три — четверта
// коштувала б четвертий виклик»), яке цей самий файл уже порушив, коли
// з'явилась водорість. Примітка, що описує намір, а не дію, ховає власну
// ваду — а ця ховала аж наступний по ціні рід у сцені.
//
// Усі чотири стоять у ВЛАСНІЙ системі: основа в нулі, ріст у +Y, розмір
// 1. Сцена ставить їх на поверхню, повертає по нормалі й масштабує. Ця
// вісь — контракт, як і в риби.
//
// ЧОГО ВОНИ КОШТУЮТЬ (виміряно `--breakdown` на телефоні, риф четвертого
// року, 26 164 трикутники сцени):
//
//   кулька    86 × 56 = 4 816  (18.4% сцени)
//   стрічка   85 × 28 = 2 380  (9.1%)
//   водорість 18 × 100 = 1 800 (6.9%)
//   камінець  24 × 24 =   576  (2.2%)
//
// Разом 9 572 — **36.6% сцени проти 2 640 на сам риф**. Перш ніж додавати
// сюди грань, подивись у цю таблицю: вона рахує не форму, а форму
// ПОМНОЖЕНУ на дві сотні.
// ============================================================
import { round6 } from './math';
import type { ReefMeshData } from './headMesh';

/** Скільки стрічок у пучку й наскільки вони розходяться. */
/*
 * Стрічка ВУЗЬКА, і це виправлення зі знімка.
 *
 * Перша редакція мала ширину 0.13 при висоті 1 — на екрані такі
 * стрічки читались клаптями паперу, а не травою. Трава вузька: 0.05
 * при висоті понад одиницю дає силует, у якому видно окремі стрічки, а
 * не суцільну пляму.
 */
const BLADE_COUNT = 7;
const BLADE_LEAN = 0.46;
const BLADE_WIDTH = 0.05;

/** Кулька: скільки кілець, скільки сторін, скільки ребер і як глибоко. */
/*
 * КУЛЬКА ЧИТАЛАСЬ ЗГОРНУТИМ ПАПІРЦЕМ, І ПРИЧИНА БУЛА В ЧЕРГУВАННІ
 * (ADR-0194).
 *
 * Тут стояло `(side + ring) % 2` — радіус стрибав через вершину і по
 * колу, і по кільцях. Тобто зсув ішов ДІАГОНАЛЛЮ в обидва боки, а це
 * буквально схема, якою складають папір: на знімку кульки лежали на
 * камені зіжмаканими обгортками.
 *
 * Виміряно зануленням по одному терму на живому порталі:
 *
 *   тон граней у нуль → кадр НЕ ЗМІНИВСЯ (тобто не тон);
 *   `TUFT_SPIKE` у нуль → папір зник повністю (тобто голка).
 *
 * Ребро йде по колу й НЕ залежить від кільця: у губки, актинії та
 * їжака борозни тягнуться від основи до маківки, а не зиґзаґом. Косинус
 * замість чергування парності — бо він замикається на будь-якій
 * кількості сторін, тоді як парність на семи дала б одне подвійне
 * ребро.
 *
 * Глибина 0.34 → 0.12: при тілі в 38 пристроєвих пікселів будь-який
 * злам глибше десятої частки читається зім'яттям, а не рельєфом.
 */
/**
 * Кільця й сторони кульки ЕКСПОРТУЮТЬСЯ, бо їх читає тест.
 *
 * Той самий урок, що в корала (ADR-0193 §4): тест, який знає розміри
 * напам'ять, міряє не те, що виросло. Зріз по чужих вершинах може так
 * само й НЕ впасти — і тоді мовчазне «все гаразд» коштує дорожче за
 * гучне падіння.
 */
export const TUFT_RINGS = 4;
export const TUFT_SIDES = 7;
const TUFT_RIDGES = 3;
const TUFT_SPIKE = 0.12;

/**
 * ТОН ГРАНІ Й ТУТ (ADR-0191).
 *
 * ADR-0190 дав тон куполу й коралам і назвав, чого не зробив: «дрібнота
 * досі читається папером». Це видно на кожному кадрі — жовті й бірюзові
 * клапті на камені, пласкі, кожен одного кольору на все тіло.
 *
 * Причина та сама, що була в купола, і навіть гірша: у цих тіл по
 * десятку граней, вони крихітні, і колір у них один на інстанс. Тобто
 * все, чим одна кулька могла відрізнятись від сусідньої, — це відтінок,
 * заданий ззовні.
 *
 * **ПАПІР ТОН НЕ ПРИБРАВ, І ЦЕ ВИМІРЯНО (ADR-0194).** Тон кульки
 * занулено на живому порталі — кадр не змінився жодною плямою; форму
 * випрямлено — папір зник повністю. Тобто причина була в геометрії, а
 * рядок нижче про те, що «саме голки роблять із неї актинію», був
 * здогадом, записаним як факт. Тон лишається: під збільшенням він видно,
 * коштує нуль і однаковий на всі чотири роди. Але тримати його за
 * причину більше не можна.
 *
 * Тон іде за формою кожного роду окремо, і це не оздоба:
 * - у **стрічки** тон СПІЛЬНИЙ на всі чотири її грані (лице й виворіт),
 *   бо різні боки однієї стрічки — це блимання, а не рельєф;
 * - у **кульки** світлішають гребені ребер, темнішають борозни — по тому
 *   самому косинусу, яким зроблене саме ребро;
 * - у **камінця** кожен бік свій, як у справжньої гальки;
 * - у **водорості** блідне кінчик стрічки, як у живої рослини.
 */
interface MeshParts {
  positions: number[];
  normals: number[];
  indices: number[];
  faceShade: number[];
}

function emptyMesh(): MeshParts {
  return { positions: [], normals: [], indices: [], faceShade: [] };
}

/** Додати грань разом із її тоном — щоб довжини не розійшлись мовчки. */
function face(parts: MeshParts, a: number, b: number, c: number, tone: number): void {
  parts.indices.push(a, b, c);
  parts.faceShade.push(round6(tone));
}

function finish(parts: MeshParts): ReefMeshData {
  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let at = 0; at < parts.positions.length; at += 3) {
    minX = Math.min(minX, parts.positions[at]!); maxX = Math.max(maxX, parts.positions[at]!);
    minY = Math.min(minY, parts.positions[at + 1]!); maxY = Math.max(maxY, parts.positions[at + 1]!);
    minZ = Math.min(minZ, parts.positions[at + 2]!); maxZ = Math.max(maxZ, parts.positions[at + 2]!);
  }
  return {
    positions: parts.positions,
    normals: parts.normals,
    indices: parts.indices,
    faceShade: parts.faceShade,
    baseCapTriangleCount: 0,
    bounds: {
      min: { x: round6(minX), y: round6(minY), z: round6(minZ) },
      max: { x: round6(maxX), y: round6(maxY), z: round6(maxZ) },
    },
  };
}

/**
 * Пучок стрічок — трава й м'які корали референсів.
 *
 * Стрічка двобічна: у площини немає товщини, і половина пучка
 * показувала б виворіт із будь-якого одного боку. Та сама причина, що
 * й у хвоста риби.
 */
export function buildReefBladeMesh(): ReefMeshData {
  const parts = emptyMesh();
  for (let blade = 0; blade < BLADE_COUNT; blade += 1) {
    const angle = (blade / BLADE_COUNT) * Math.PI * 2;
    const lean = BLADE_LEAN * (0.45 + 0.55 * ((blade * 7) % 5) / 4);
    const height = 0.95 + 0.45 * ((blade * 3) % 4) / 3;
    const dirX = Math.cos(angle);
    const dirZ = Math.sin(angle);
    // Стрічка стоїть упоперек власного напряму — так її видно збоку.
    const acrossX = -dirZ * BLADE_WIDTH;
    const acrossZ = dirX * BLADE_WIDTH;
    const base = parts.positions.length / 3;

    const push = (x: number, y: number, z: number): void => {
      parts.positions.push(round6(x), round6(y), round6(z));
      parts.normals.push(round6(-dirZ), 0, round6(dirX));
    };
    push(-acrossX, 0, -acrossZ);
    push(acrossX, 0, acrossZ);
    // Верх звужений і відхилений — стрічка не палиця.
    push(dirX * lean - acrossX * 0.25, height, dirZ * lean - acrossZ * 0.25);
    push(dirX * lean + acrossX * 0.25, height, dirZ * lean + acrossZ * 0.25);

    /*
     * Один тон на всю стрічку, і він різний у сусідів. Лице й виворіт
     * мусять збігатись: різні боки однієї стрічки під гойданням читались
     * би блиманням, а не рельєфом.
     */
    const tone = 0.82 + 0.36 * ((blade * 3) % BLADE_COUNT) / (BLADE_COUNT - 1);
    face(parts, base, base + 1, base + 2, tone);
    face(parts, base + 1, base + 3, base + 2, tone);
    face(parts, base + 2, base + 1, base, tone);
    face(parts, base + 2, base + 3, base + 1, tone);
  }
  return finish(parts);
}

/**
 * Кулька з голок — актинія, губка, їжак.
 *
 * Півсфера з кільцями, у яких радіус стрибає через одну вершину: саме
 * цей стрибок і читається голками, без жодної додаткової геометрії.
 */
export function buildReefTuftMesh(): ReefMeshData {
  const parts = emptyMesh();
  const push = (x: number, y: number, z: number): void => {
    const length = Math.max(1e-9, Math.hypot(x, y, z));
    parts.positions.push(round6(x), round6(y), round6(z));
    parts.normals.push(round6(x / length), round6(y / length), round6(z / length));
  };

  /*
   * КІЛЬЦЯ РОЗКЛАДЕНІ ПО ВИСОТІ, А НЕ ПО КУТУ.
   *
   * Тут стояло `(ring + 0.35) / RINGS` як частка чверті оберту — тобто
   * рівномірно по КУТУ. На куполі це кладе кільця на висоти
   * 0.14, 0.51, 0.80, 0.97: перший проміжок крихітний, другий уп'ятеро
   * більший. Власний тест «у кульки є БІК» міряє саме найдовшу грань, і
   * він проходив лише тому, що глибока голка розсовувала рівні: щойно
   * голка змілішала, вилізла грань на третину висоти — та сама
   * брилуватість, яку видно на знімку жовтих кульок.
   *
   * `asin` кладе кільця рівномірно по y. Та сама правка, що в розкладці
   * дрібноти (ADR-0186, по площі, а не по куту) і в сітці дна
   * (ADR-0193): рівномірність там, де на неї дивляться, а не там, де її
   * зручно рахувати.
   */
  for (let ring = 0; ring < TUFT_RINGS; ring += 1) {
    const phi = Math.asin((ring + 0.5) / TUFT_RINGS);
    for (let side = 0; side < TUFT_SIDES; side += 1) {
      const angle = (side / TUFT_SIDES) * Math.PI * 2;
      const spike = 1 + TUFT_SPIKE * Math.cos(angle * TUFT_RIDGES);
      const across = Math.cos(phi) * spike * 0.5;
      push(Math.cos(angle) * across, Math.sin(phi) * spike * 0.9, Math.sin(angle) * across);
    }
  }
  const apex = parts.positions.length / 3;
  push(0, 1.02, 0);

  /*
   * Тон іде за тим самим косинусом, що й ребро: грань на гребені
   * світліша за грань у борозні. Це не другий візерунок поверх форми, це
   * та сама форма, сказана кольором.
   *
   * Кільце в підпис більше не входить, і це не спрощення: тон, який
   * залежав би від кільця, домальовував би поперечний злам поверх
   * поздовжніх борозен — рівно те, через що тіло й читалось згортком.
   */
  const spikeTone = (side: number): number => (
    1 + 0.19 * Math.cos(((side / TUFT_SIDES) * Math.PI * 2) * TUFT_RIDGES)
  );
  for (let ring = 0; ring < TUFT_RINGS - 1; ring += 1) {
    const low = ring * TUFT_SIDES;
    const high = low + TUFT_SIDES;
    for (let side = 0; side < TUFT_SIDES; side += 1) {
      const next = (side + 1) % TUFT_SIDES;
      face(parts, low + side, low + next, high + side, spikeTone(side));
      face(parts, low + next, high + next, high + side, spikeTone(next));
    }
  }
  const top = (TUFT_RINGS - 1) * TUFT_SIDES;
  for (let side = 0; side < TUFT_SIDES; side += 1) {
    face(parts, top + side, top + ((side + 1) % TUFT_SIDES), apex, spikeTone(side));
  }
  // Денце: кулька сидить на поверхні, але камера рифа опускається, і
  // відкритий низ показав би порожнечу.
  const floor = parts.positions.length / 3;
  push(0, 0, 0);
  for (let side = 0; side < TUFT_SIDES; side += 1) {
    // Денце дивиться в пісок: тон йому ні до чого.
    face(parts, floor, (side + 1) % TUFT_SIDES, side, 1);
  }
  return finish(parts);
}

/**
 * Камінець — приплюснута галька, а не пласка пірамідка.
 *
 * Перша редакція давала шестикутник із однією вершиною зверху: під
 * пласким затіненням це читалось клаптем паперу на піску. Два кільця
 * дають гальці бік, а бік — це те, чим камінь відрізняється від тіні.
 */
export function buildReefPebbleMesh(): ReefMeshData {
  const parts = emptyMesh();
  const SIDES = 6;
  const push = (x: number, y: number, z: number): void => {
    const length = Math.max(1e-9, Math.hypot(x, y, z));
    parts.positions.push(round6(x), round6(y), round6(z));
    parts.normals.push(round6(x / length), round6(y / length), round6(z / length));
  };

  const RINGS: ReadonlyArray<readonly [number, number]> = [[0.02, 0.5], [0.2, 0.44]];
  for (const [height, across] of RINGS) {
    for (let side = 0; side < SIDES; side += 1) {
      const angle = (side / SIDES) * Math.PI * 2;
      const wobble = 0.82 + 0.18 * ((side * 5) % 3) / 2;
      push(Math.cos(angle) * across * wobble, height, Math.sin(angle) * across * wobble);
    }
  }
  const crown = parts.positions.length / 3;
  push(0, 0.34, 0);
  const floor = crown + 1;
  push(0, 0, 0);

  /*
   * У гальки кожен бік свій — це та сама зернистість, якою камінь
   * відрізняється від пластмаси. Візерунок іде від того ж числа, що й
   * `wobble` форми, тож тон і форма не сперечаються.
   */
  const sideTone = (side: number): number => 0.8 + 0.4 * ((side * 5) % SIDES) / (SIDES - 1);
  for (let side = 0; side < SIDES; side += 1) {
    const next = (side + 1) % SIDES;
    face(parts, side, next, SIDES + side, sideTone(side));
    face(parts, next, SIDES + next, SIDES + side, sideTone(next));
    face(parts, SIDES + side, SIDES + next, crown, sideTone(side) * 1.08);
    // Денце лежить на піску.
    face(parts, floor, next, side, 1);
  }
  return finish(parts);
}

/** Кущ водорості: скільки стрічок, скільки в них колін, як вигинаються. */
const WEED_STRANDS = 5;
const WEED_JOINTS = 5;
const WEED_WIDTH = 0.09;
const WEED_CURVE = 0.5;

/** Наскільки корінь утоплений у пісок. */
const WEED_ROOT = 0.06;

/**
 * Висока водорість — КУЩ, а не одна стрічка.
 *
 * Перша редакція давала єдину стрічку, і на знімку вона читалась
 * пласкою зеленою смугою, що висить у воді: у одної стрічки немає ані
 * об'єму, ані місця, де вона починається. Кущ із п'яти, кожна зі своєю
 * висотою й вигином, читається рослиною з першого погляду.
 *
 * Корінь іде НИЖЧЕ нуля: інакше на дюні стеблина зависає над піском, і
 * рослина знову втрачає землю під собою.
 *
 * Коліна потрібні не для краси: сцена гойдає кущ, обертаючи його
 * цілком, і прямі палиці під таким рухом читались би стрілками
 * годинника. Вигнуті стрічки під тим самим поворотом читаються течією.
 */
export function buildReefWeedMesh(): ReefMeshData {
  const parts = emptyMesh();
  for (let strand = 0; strand < WEED_STRANDS; strand += 1) {
    const azimuth = (strand / WEED_STRANDS) * Math.PI * 2 + 0.3;
    const dirX = Math.cos(azimuth);
    const dirZ = Math.sin(azimuth);
    const height = 0.62 + 0.38 * ((strand * 3) % 5) / 4;
    const curve = WEED_CURVE * (0.5 + 0.5 * ((strand * 7) % 4) / 3);
    // Стрічка стоїть упоперек власного напряму — так її видно збоку.
    const acrossX = -dirZ;
    const acrossZ = dirX;
    const base = parts.positions.length / 3;

    for (let joint = 0; joint <= WEED_JOINTS; joint += 1) {
      const along = joint / WEED_JOINTS;
      const bend = curve * along * along;
      const width = WEED_WIDTH * (1 - 0.6 * along);
      for (const side of [-1, 1]) {
        parts.positions.push(
          round6(dirX * bend + acrossX * side * width),
          round6(along * height - WEED_ROOT),
          round6(dirZ * bend + acrossZ * side * width),
        );
        parts.normals.push(round6(-dirZ), 0, round6(dirX));
      }
    }

    /*
     * Кінчик блідніший за корінь, а кожна стрічка куща — трохи своя.
     * Лице й виворіт одного коліна тримають ОДИН тон, з тієї ж причини,
     * що й у стрічки трави.
     */
    const strandTone = 0.86 + 0.28 * ((strand * 3) % WEED_STRANDS) / (WEED_STRANDS - 1);
    for (let joint = 0; joint < WEED_JOINTS; joint += 1) {
      const low = base + joint * 2;
      const tone = strandTone * (1 + 0.3 * ((joint + 0.5) / WEED_JOINTS));
      face(parts, low, low + 1, low + 2, tone);
      face(parts, low + 1, low + 3, low + 2, tone);
      face(parts, low + 2, low + 1, low, tone);
      face(parts, low + 2, low + 3, low + 1, tone);
    }
  }
  return finish(parts);
}
