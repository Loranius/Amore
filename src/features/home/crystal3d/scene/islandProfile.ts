// ============================================================
// Мірка сцени острова — ОДНА функція на еталон і на нас.
// ------------------------------------------------------------
// Той самий прецедент, що `treeSilhouetteProfile` (ADR-0104) і
// `crystalSilhouetteProfile` (ADR-0114): дві різні мірки дали б числа,
// які не можна класти поруч, і ця помилка в цьому проєкті вже коштувала
// хибних висновків двічі.
//
// Модуль чистий: на вході — сирий суп трикутників `[x, y, z, …]`, на
// виході — числа. Ні three, ні React, ні файлів. Еталон приходить із
// `scripts/models/reference/island-temple.glb`, наша сцена — з
// `portalIsland.ts`, і обидві проходять крізь ці самі рядки.
// ============================================================

/** Профіль скелі — усе в радіусах її найширшого місця. */
export interface IslandProfile {
  /** Найширший радіус тіла, в одиницях самої геометрії. Решта — до нього. */
  widest: number;
  /**
   * Наскільки нижче за САМИЙ ВЕРХ лежить найширше місце.
   *
   * ГОЛОВНЕ ЧИСЛО ЖАНРУ. Верх острова не має бути його найширшим місцем:
   * під кромкою скеля нависає карнизом, бо м'яку породу вимило, а тверда
   * лишилась. Нуль означає усічений конус, тобто плиту.
   */
  overhangDrop: number;
  /**
   * Радіус на шести десятих шляху від найширшого місця до верху.
   *
   * Скільки тіло встигає звузитись, підіймаючись до вершини. Плита
   * лишається одиницею до самого краю; скеля з банею опадає нижче 0.8.
   */
  topTaper: number;
  /** Глибина кореня під найширшим місцем. */
  rootDepth: number;
  /** Рваність обрису: відхилення радіуса на найширшому рівні. */
  rimRagged: number;
}

const BANDS = 120;
const AZIMUTH_BINS = 36;

/*
 * ЖОДНОГО ПОРОГА В ОЗНАЧЕННЯХ, і це не смак.
 *
 * Перша редакція шукала «кромку» як найвищу смугу, ширшу за 90% від
 * найширшого місця. На еталоні це працювало, а щойно нашому острову
 * додали карниз — поріг переїхав на сам карниз, і `overhangDrop` упав із
 * 0.022 до 0.001. Тобто мірка помінялась разом із тим, що вона міряє, і
 * два її числа не можна було класти поруч навіть із собою вчорашньою.
 *
 * Тому всі якорі тепер безумовні: найвища точка, найнижча, найширша. Їх
 * не треба шукати порогом, і вони не залежать від того, яка форма прийде.
 */

export function islandSilhouetteProfile(positions: readonly number[]): IslandProfile {
  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  let widest = 0;
  let widestY = 0;
  for (let at = 0; at + 2 < positions.length; at += 3) {
    const y = positions[at + 1]!;
    if (y < low) low = y;
    if (y > high) high = y;
    const radius = Math.hypot(positions[at]!, positions[at + 2]!);
    if (radius > widest) { widest = radius; widestY = y; }
  }
  const band = (high - low) / BANDS;

  // Радіус на шести десятих шляху від найширшого місця до верху.
  const taperY = widestY + (high - widestY) * 0.6;
  let taper = 0;
  const bins = new Float64Array(AZIMUTH_BINS);
  for (let at = 0; at + 2 < positions.length; at += 3) {
    const x = positions[at]!;
    const y = positions[at + 1]!;
    const z = positions[at + 2]!;
    const radius = Math.hypot(x, z);
    if (Math.abs(y - taperY) <= band * 1.5 && radius > taper) taper = radius;
    // Рваність — по НАЙДАЛЬШІЙ точці кожного азимутального сектора на
    // найширшому рівні: інакше в середнє потрапили б внутрішні вершини, і
    // будь-який обрис вийшов би рваним.
    if (Math.abs(y - widestY) > band * 1.5) continue;
    let bin = Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * AZIMUTH_BINS);
    if (bin < 0) bin = 0;
    if (bin >= AZIMUTH_BINS) bin = AZIMUTH_BINS - 1;
    if (radius > bins[bin]!) bins[bin] = radius;
  }
  const filled = Array.from(bins).filter((value) => value > 0);
  const mean = filled.reduce((sum, value) => sum + value, 0) / Math.max(1, filled.length);
  const variance = filled.reduce((sum, value) => sum + (value - mean) ** 2, 0)
    / Math.max(1, filled.length);

  return {
    widest,
    overhangDrop: (high - widestY) / widest,
    topTaper: taper / widest,
    rootDepth: (widestY - low) / widest,
    rimRagged: Math.sqrt(variance) / (mean || 1),
  };
}

/** Профіль храму спереду — і три числа, зняті з нього. */
export interface TempleProfile {
  /**
   * Частка ширини силуету, зайнята каменем, на кожній висоті знизу вгору.
   *
   * Одна крива замість трьох окремих вимірів, і це не економія: висота
   * колони, просвіт між колонами й нахил фронтону — це три ділянки ОДНОГО
   * силуету, і виміряти їх нарізно означало б втратити те, чи вони взагалі
   * складаються в храм.
   */
  solid: readonly number[];
  /** Частка ПОВІТРЯ в колонаді: 0 — суцільна стіна, 1 — колон немає. */
  colonnadeVoid: number;
  /** Яку частку висоти займає колонада. */
  colonnadeShare: number;
  /** Нахил фронтону від горизонталі, градуси. Нуль — фронтону немає. */
  pedimentSlopeDeg: number;
}

/** Перетин трикутника з висотою `y`: відрізок по x, або null. */
function spanAt(
  ax: number, ay: number, bx: number, by: number, cx: number, cy: number, y: number,
): [number, number] | null {
  const xs: number[] = [];
  const edges: readonly (readonly [number, number, number, number])[] = [
    [ax, ay, bx, by], [bx, by, cx, cy], [cx, cy, ax, ay],
  ];
  for (const [x1, y1, x2, y2] of edges) {
    if ((y1 - y) * (y2 - y) > 0) continue;
    if (y1 === y2) { xs.push(x1, x2); continue; }
    xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
  }
  if (xs.length === 0) return null;
  return [Math.min(...xs), Math.max(...xs)];
}

export function templeFrontProfile(
  positions: readonly number[],
  samples = 40,
  /**
   * Куди дивиться фасад, одиничним вектором у площині XZ.
   *
   * За замовчуванням — на +Z, бо саме так стоїть еталон із Blender. Наш
   * храм розвернутий до артефакта (ADR-0169), і без цього повороту
   * проєкція дивилась би на нього навскіс: колонада читалась 0.575
   * замість 0.655, а фронтон 12.5° замість 14°. Форма при цьому не
   * змінювалась ані на трикутник — брехала мірка.
   */
  facing: readonly [number, number] = [0, 1],
): TempleProfile {
  const [faceX, faceZ] = facing;
  /** Горизонталь фасаду: те, що для повернутого храму замінює світове X. */
  const across = (x: number, z: number): number => x * faceZ - z * faceX;
  let lowY = Number.POSITIVE_INFINITY;
  let highY = Number.NEGATIVE_INFINITY;
  let lowX = Number.POSITIVE_INFINITY;
  let highX = Number.NEGATIVE_INFINITY;
  for (let at = 0; at + 2 < positions.length; at += 3) {
    const x = across(positions[at]!, positions[at + 2]!);
    const y = positions[at + 1]!;
    if (y < lowY) lowY = y;
    if (y > highY) highY = y;
    if (x < lowX) lowX = x;
    if (x > highX) highX = x;
  }
  const width = highX - lowX;
  const solid: number[] = [];
  for (let sample = 0; sample < samples; sample += 1) {
    // Півсмуги від країв: рівно на підошві й рівно на вістрі перетин
    // вироджується, і крива починалась би з нуля на обох кінцях незалежно
    // від того, що там насправді.
    const y = lowY + ((sample + 0.5) / samples) * (highY - lowY);
    const spans: [number, number][] = [];
    for (let at = 0; at + 8 < positions.length; at += 9) {
      const span = spanAt(
        across(positions[at]!, positions[at + 2]!), positions[at + 1]!,
        across(positions[at + 3]!, positions[at + 5]!), positions[at + 4]!,
        across(positions[at + 6]!, positions[at + 8]!), positions[at + 7]!,
        y,
      );
      if (span) spans.push(span);
    }
    spans.sort((first, second) => first[0] - second[0]);
    let covered = 0;
    let edge = Number.NEGATIVE_INFINITY;
    for (const [from, to] of spans) {
      if (to <= edge) continue;
      covered += to - Math.max(from, edge);
      edge = to;
    }
    solid.push(width > 0 ? covered / width : 0);
  }

  /*
   * КОЛОНАДА — НАЙДОВША СУЦІЛЬНА СМУГА, У ЯКІЙ КАМЕНЮ ВІД 15% ДО 70%.
   *
   * Знову означення від форми, а не від будови: нижче стоїть суцільний
   * стилобат (майже 100%), вище — суцільний антаблемент (100%), і лише
   * між ними силует дірявий. Якщо колон немає взагалі, смуга не
   * знайдеться, і `colonnadeShare` чесно дасть нуль.
   */
  let bestFrom = 0;
  let bestLength = 0;
  let from = -1;
  for (let index = 0; index <= solid.length; index += 1) {
    /*
     * Стеля 0.7, а не 0.8, і межу знайшов перший же вимір. Антаблемент
     * еталона читається на 0.77 — він вужчий за стилобат, тож не дає
     * повної одиниці, — і на 0.8 смуга ковтала його разом із колонадою:
     * еталон давав 0.85 висоти проти наших 0.53, і числа означали різне.
     */
    const inside = index < solid.length && solid[index]! >= 0.15 && solid[index]! <= 0.7;
    if (inside && from === -1) from = index;
    if (!inside && from !== -1) {
      if (index - from > bestLength) { bestLength = index - from; bestFrom = from; }
      from = -1;
    }
  }
  const band = solid.slice(bestFrom, bestFrom + bestLength);
  const colonnadeVoid = band.length === 0
    ? 0
    : 1 - band.reduce((sum, value) => sum + value, 0) / band.length;

  /*
   * ФРОНТОН — ХВІСТ КРИВОЇ ЗВЕРХУ, поки камінь звужується.
   *
   * Нахил рахується як `atan(висота хвоста / півширина основи хвоста)`:
   * саме так його й міряють на кресленні. Хвіст закінчується там, де
   * камінь перестає звужуватись, тобто на антаблементі.
   */
  let peakFrom = solid.length;
  for (let index = solid.length - 1; index > 0; index -= 1) {
    if (solid[index]! >= solid[index - 1]! - 1e-9) break;
    peakFrom = index;
  }
  const pedimentBands = solid.length - peakFrom;
  const pedimentHeight = (pedimentBands / solid.length) * (highY - lowY);
  const pedimentBase = (solid[peakFrom - 1] ?? 0) * width;
  const pedimentSlopeDeg = pedimentBase > 0
    ? (Math.atan(pedimentHeight / (pedimentBase / 2)) * 180) / Math.PI
    : 0;

  return {
    solid,
    colonnadeVoid,
    colonnadeShare: bestLength / solid.length,
    pedimentSlopeDeg,
  };
}

/** Характер породи — битий камінь чи згладжений горб. */
export interface RockFacetProfile {
  /** Скільки пар сусідніх граней узято до виміру. */
  pairs: number;
  /** Середній кут між сусідніми гранями, градуси. */
  dihedralMean: number;
  /** Медіанний кут між сусідніми гранями, градуси. */
  dihedralMedian: number;
  /** Розкид площ граней: відхилення на середнє. Однакові грані — нуль. */
  areaSpread: number;
}

/**
 * Двогранний кут між сусідніми гранями — і розкид їхніх площ.
 *
 * ЦЕ МІРКА «БИТИЙ КАМІНЬ ЧИ ГОРБ», і потрібні саме обидва числа. Кут каже,
 * чи ламається поверхня: у згладженого горба сусідні грані майже в одній
 * площині. Розкид площ каже друге — чи грані однакові: `DESIGN.md`
 * повторює це правило прозою («однакова ширина читається токарним
 * верстатом»), а тут воно стає числом.
 *
 * БЕРУТЬСЯ ЛИШЕ ГРАНІ, ПОВЕРНУТІ ВГОРУ. Інакше в число потрапляють обрив і
 * корінь, у яких злам різкий за побудовою, — і плато, на яке пара
 * дивиться згори, ховається за ними. Перший вимір саме так і збрехав:
 * усе тіло дало 30.6° при плато в 11.9°.
 *
 * Суп трикутників не має спільних вершин, тож сусідство шукається за
 * ЗБІГОМ КООРДИНАТ, округлених до п'ятого знака.
 */
export function rockFacetProfile(
  positions: readonly number[],
  upAtLeast = 0.3,
): RockFacetProfile {
  const normals: [number, number, number][] = [];
  const corners: string[][] = [];
  const areas: number[] = [];
  for (let at = 0; at + 8 < positions.length; at += 9) {
    const ax = positions[at]!; const ay = positions[at + 1]!; const az = positions[at + 2]!;
    const bx = positions[at + 3]!; const by = positions[at + 4]!; const bz = positions[at + 5]!;
    const cx = positions[at + 6]!; const cy = positions[at + 7]!; const cz = positions[at + 8]!;
    const ux = bx - ax; const uy = by - ay; const uz = bz - az;
    const vx = cx - ax; const vy = cy - ay; const vz = cz - az;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    if (length === 0) continue;
    if (ny / length <= upAtLeast) continue;
    normals.push([nx / length, ny / length, nz / length]);
    areas.push(length / 2);
    const key = (x: number, y: number, z: number) => `${x.toFixed(5)},${y.toFixed(5)},${z.toFixed(5)}`;
    corners.push([key(ax, ay, az), key(bx, by, bz), key(cx, cy, cz)]);
  }

  const edges = new Map<string, number[]>();
  corners.forEach((triangle, index) => {
    for (let side = 0; side < 3; side += 1) {
      const first = triangle[side]!;
      const second = triangle[(side + 1) % 3]!;
      const key = first < second ? `${first}|${second}` : `${second}|${first}`;
      const bucket = edges.get(key);
      if (bucket) bucket.push(index);
      else edges.set(key, [index]);
    }
  });

  const angles: number[] = [];
  for (const bucket of edges.values()) {
    if (bucket.length !== 2) continue;
    const [first, second] = bucket as [number, number];
    const a = normals[first]!;
    const b = normals[second]!;
    const dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]));
    angles.push((Math.acos(dot) * 180) / Math.PI);
  }
  angles.sort((first, second) => first - second);
  const mean = angles.reduce((sum, value) => sum + value, 0) / Math.max(1, angles.length);
  const areaMean = areas.reduce((sum, value) => sum + value, 0) / Math.max(1, areas.length);
  const areaVariance = areas.reduce((sum, value) => sum + (value - areaMean) ** 2, 0)
    / Math.max(1, areas.length);

  return {
    pairs: angles.length,
    dihedralMean: mean,
    dihedralMedian: angles.length === 0 ? 0 : angles[Math.floor((angles.length - 1) / 2)]!,
    areaSpread: Math.sqrt(areaVariance) / (areaMean || 1),
  };
}

/** Силует хмари: бугристий верх і пласка основа — чи столова гора. */
export interface CloudProfile {
  /** Розкид верхньої кромки, у висотах хмари. Кумулус бугристий. */
  topRough: number;
  /** Розкид нижньої кромки. Основа хмари майже пласка — це її прикмета. */
  baseFlat: number;
  /** Ширина на висоту. */
  aspect: number;
}

/**
 * Верхня й нижня кромка силуету, по стовпцях.
 *
 * ЩО ЦЕ РОЗРІЗНЯЄ. Хмару від столової гори відрізняє не форма взагалі, а
 * РІЗНИЦЯ між верхом і низом: у кумулуса верх бугристий, а основа майже
 * пласка — її ріже рівень конденсації, той самий на всю хмару. Столова
 * гора пласка з обох боків, а гірський хребет — рваний з обох.
 *
 * ХМАРА МІРЯЄТЬСЯ У ВЛАСНІЙ СИСТЕМІ. Пелюстки стоять по колу навколо
 * острова, і вісь X сцени для більшості з них — погляд збоку; тому
 * горизонтальний напрямок береться як напрямок найбільшого розмаху самої
 * хмари.
 *
 * І СКАНУЮТЬСЯ ТРИКУТНИКИ, А НЕ ВЕРШИНИ. Перша редакція брала мінімум і
 * максимум по вершинах у стовпці — у стовпці без жодної вершини основи
 * «низом» ставала вершина горба, і рівна основа давала розкид 0.39 замість
 * нуля. Тобто мірка міряла щільність сітки, а не силует.
 */
export function cloudSilhouetteProfile(
  positions: readonly number[],
  columns = 48,
): CloudProfile {
  let cx = 0;
  let cz = 0;
  let count = 0;
  for (let at = 0; at + 2 < positions.length; at += 3) {
    cx += positions[at]!;
    cz += positions[at + 2]!;
    count += 1;
  }
  if (count === 0) return { topRough: 0, baseFlat: 0, aspect: 0 };
  cx /= count;
  cz /= count;
  let spreadXX = 0;
  let spreadXZ = 0;
  let spreadZZ = 0;
  for (let at = 0; at + 2 < positions.length; at += 3) {
    const dx = positions[at]! - cx;
    const dz = positions[at + 2]! - cz;
    spreadXX += dx * dx;
    spreadXZ += dx * dz;
    spreadZZ += dz * dz;
  }
  const angle = 0.5 * Math.atan2(2 * spreadXZ, spreadXX - spreadZZ);
  const axisX = Math.cos(angle);
  const axisZ = Math.sin(angle);
  const along = (at: number) => (positions[at]! - cx) * axisX + (positions[at + 2]! - cz) * axisZ;

  let low = Number.POSITIVE_INFINITY;
  let high = Number.NEGATIVE_INFINITY;
  let lowY = Number.POSITIVE_INFINITY;
  let highY = Number.NEGATIVE_INFINITY;
  for (let at = 0; at + 2 < positions.length; at += 3) {
    const u = along(at);
    if (u < low) low = u;
    if (u > high) high = u;
    const y = positions[at + 1]!;
    if (y < lowY) lowY = y;
    if (y > highY) highY = y;
  }
  const width = high - low;
  const height = highY - lowY;
  if (width <= 0 || height <= 0) return { topRough: 0, baseFlat: 0, aspect: 0 };

  const tops: number[] = [];
  const bases: number[] = [];
  for (let column = 0; column < columns; column += 1) {
    const u = low + ((column + 0.5) / columns) * width;
    let top = Number.NEGATIVE_INFINITY;
    let base = Number.POSITIVE_INFINITY;
    for (let at = 0; at + 8 < positions.length; at += 9) {
      // Той самий перетин, що в `spanAt`, лише транспонований: січемо
      // трикутник ВЕРТИКАЛЛЮ й беремо розмах по висоті.
      const span = spanAt(
        positions[at + 1]!, along(at),
        positions[at + 4]!, along(at + 3),
        positions[at + 7]!, along(at + 6),
        u,
      );
      if (!span) continue;
      if (span[1] > top) top = span[1];
      if (span[0] < base) base = span[0];
    }
    if (!Number.isFinite(top) || !Number.isFinite(base)) continue;
    tops.push(top);
    bases.push(base);
  }

  const deviation = (values: readonly number[]): number => {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
  };

  return {
    topRough: deviation(tops) / height,
    baseFlat: deviation(bases) / height,
    aspect: width / height,
  };
}
