// ============================================================
// Профіль світла: скільки насправді відрізняються сусідні грані.
// ------------------------------------------------------------
// НАВІЩО ЦЕ ІСНУЄ. Правило `amore-crystal-look` одне: МІРЯЙ, ПЕРШ НІЖ
// КРУТИТИ. Кристал, який читається кристалом, має сусідні грані, що
// різняться на 30%+; нижче ~10% він виглядатиме гладкою формою, хай яким
// правильним буде решта. І щоразу число, за яке хапається розумна людина,
// виявлялось не тим числом.
//
// Досі цю перевірку робили руками: зняти екран, вирізати тіло, пройти
// смугою пікселів, розкодувати криву, знайти плато. Година роботи на
// питання, на яке має відповідати одна команда — і саме тому на нього
// часто не відповідали взагалі.
//
// ПАСТКА, ЗАРАДИ ЯКОЇ ТУТ ПІВФАЙЛУ. Знімок — це НЕ вимір світла: крива ACES
// СТИСКАЄ різниці, і тим сильніше, чим яскравіші відліки. Виміряно на цій
// самій реалізації:
//
//   байти 161→186: на екрані 27.4% різниці, у сцені 31.7%
//   байти 200→220: на екрані 19.3%, у сцені 36.0%
//   байти 230→245: на екрані 13.3%, у сцені 52.1%
//
// Тобто дві грані, що на знімку різняться на тринадцять відсотків, у сцені
// різняться вдвічі. Тому тут спершу знімається sRGB, потім обертається сама
// крива — і лише тоді щось порівнюється.
// ============================================================
import { inflateSync } from 'node:zlib';

/** Мінімальний декодер PNG: 8 біт на канал, RGB або RGBA, без інтерлейсу. */
export function decodePng(buffer) {
  if (buffer.length < 8 || buffer.readUInt32BE(0) !== 0x89504e47) {
    throw new Error('Це не PNG.');
  }
  let offset = 8;
  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = 0;
  const chunks = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      depth = body[8];
      colorType = body[9];
      if (body[12] !== 0) throw new Error('Інтерлейсований PNG не підтримується.');
    } else if (type === 'IDAT') {
      chunks.push(body);
    } else if (type === 'IEND') {
      break;
    }
    offset += 12 + length;
  }
  if (depth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`PNG ${depth} біт, тип ${colorType} — підтримано лише 8-бітні RGB/RGBA.`);
  }

  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const raw = inflateSync(Buffer.concat(chunks));
  const data = Buffer.alloc(stride * height);
  let source = 0;
  for (let y = 0; y < height; y += 1) {
    const filter = raw[source];
    source += 1;
    const row = y * stride;
    const previous = row - stride;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[source + x];
      const a = x >= channels ? data[row + x - channels] : 0;
      const b = y > 0 ? data[previous + x] : 0;
      const c = x >= channels && y > 0 ? data[previous + x - channels] : 0;
      let out = value;
      if (filter === 1) out = value + a;
      else if (filter === 2) out = value + b;
      else if (filter === 3) out = value + ((a + b) >> 1);
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        out = value + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      data[row + x] = out & 0xff;
    }
    source += stride;
  }
  return { width, height, channels, data };
}

/** Знімає гамму sRGB: байт екрана → лінійне значення каналу. */
export function srgbToLinear(byte) {
  const c = byte / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Пряма крива ACES у наближенні Нарковича — та сама, що в three.
 *
 * Тримається поруч із оберненою навмисно: тест ганяє одну крізь одну, тож
 * помилка в оберненій не може лишитись непоміченою.
 */
export function acesToneMap(x) {
  const value = Math.max(0, x);
  const mapped = (value * (2.51 * value + 0.03)) / (value * (2.43 * value + 0.59) + 0.14);
  return Math.min(1, Math.max(0, mapped));
}

/**
 * Обернена крива ACES: із того, що на екрані, — у яскравість сцени.
 *
 * `y = (x(2.51x + 0.03)) / (x(2.43x + 0.59) + 0.14)` — квадратне рівняння
 * відносно `x`. Беремо невід'ємний корінь; у насиченні (`y → 1`) корінь
 * іде в нескінченність, тож значення обрізається трохи нижче одиниці, і це
 * названа межа: пересвічене на знімку не відновлюється ніяк.
 */
export function inverseAces(y) {
  // Нуль має бути нулем, а не мінус нулем: інакше він тече далі в суми й
  // порівняння, де `Object.is` раптом каже «не збігається».
  if (!(y > 0)) return 0;
  const clamped = Math.min(y, 0.9999);
  const a = 2.43 * clamped - 2.51;
  const b = 0.59 * clamped - 0.03;
  const c = 0.14 * clamped;
  if (Math.abs(a) < 1e-9) return Math.abs(b) > 1e-9 ? -c / b : 0;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return 0;
  const root = Math.sqrt(discriminant);
  for (const x of [(-b + root) / (2 * a), (-b - root) / (2 * a)]) {
    if (x >= 0) return x;
  }
  return 0;
}

/** Криві, які цей модуль уміє обертати. Числа — константи three. */
export const TONE_MAPPING_NONE = 0;
export const TONE_MAPPING_ACES = 4;

/**
 * Яскравість сцени в одному пікселі.
 *
 * Ваги Rec.709 — ті самі, якими три рахує яскравість.
 */
export function pixelLuminance(r, g, b, { toneMapping, exposure }) {
  const decode = (byte) => {
    const linear = srgbToLinear(byte);
    if (toneMapping === TONE_MAPPING_ACES) return inverseAces(linear) / Math.max(1e-6, exposure);
    return linear / Math.max(1e-6, exposure);
  };
  return 0.2126 * decode(r) + 0.7152 * decode(g) + 0.0722 * decode(b);
}

/** Середня яскравість кожного стовпця смуги. */
export function scanBand(image, band, tone) {
  const { width, channels, data } = image;
  const columns = [];
  for (let x = band.x0; x < band.x1; x += 1) {
    let total = 0;
    let count = 0;
    for (let y = band.y0; y < band.y1; y += 1) {
      const offset = (y * width + x) * channels;
      total += pixelLuminance(data[offset], data[offset + 1], data[offset + 2], tone);
      count += 1;
    }
    columns.push(count > 0 ? total / count : 0);
  }
  return columns;
}

/**
 * Плато — пробіг стовпців, у якому яскравість тримається.
 *
 * ЦЕ НЕ «згрупувати сусідів, що схожі». Перша редакція робила саме так — і
 * різала ПЛАВНИЙ градієнт на десяток фальшивих плато, після чого «медіана
 * переходу» виходила 9% там, де насправді була одна грань. Плато мусить
 * бути широким і рівним ЦІЛКОМ, тому тут перевіряється розкид усього
 * пробігу, а не крок між сусідами.
 */
export function findPlateaus(columns, { minRun = 10, tolerance = 0.08 } = {}) {
  const plateaus = [];
  let index = 0;
  while (index < columns.length) {
    let end = index + 1;
    while (end < columns.length) {
      let min = Infinity;
      let max = -Infinity;
      let total = 0;
      for (let k = index; k <= end; k += 1) {
        min = Math.min(min, columns[k]);
        max = Math.max(max, columns[k]);
        total += columns[k];
      }
      const mean = total / (end - index + 1);
      if (mean <= 1e-9 || (max - min) / mean > tolerance) break;
      end += 1;
    }
    if (end - index >= minRun) {
      let total = 0;
      for (let k = index; k < end; k += 1) total += columns[k];
      plateaus.push({ from: index, to: end, luminance: total / (end - index) });
      index = end;
    } else {
      index += 1;
    }
  }
  return plateaus;
}

/**
 * Розділення граней, у відсотках.
 *
 * Крайні плато відкидаються: це тло обабіч тіла, і перехід тіло↔тло — це
 * силует, а не грань. Він завжди вісімдесят із гаком відсотків і, якщо його
 * не прибрати, ховає справжнє число за собою.
 *
 * ДВА ЧИСЛА, І ЦЕ ВИПРАВЛЕННЯ САМОГО ПРИЛАДУ.
 * ------------------------------------------------------------
 * `median` — медіана переходів між СУСІДНІМИ ПЛАТО, і саме її досі
 * звіряли з порогом 30% (`amore-crystal-look`). Це працює лише тоді,
 * коли одна грань дає одне плато.
 *
 * Сьогодні не дає. Грань завширшки 60–85 пікселів має власний перепад
 * ~20% (ADR-0085), тож `findPlateaus` ріже її на два-три плато, і
 * більшість «сусідніх пар» — це переходи ВСЕРЕДИНІ однієї грані. Медіана
 * по них міряє гладкість грані, а не різницю між гранями, і саме тому
 * вона стрибала між 6% і 47% від прогону до прогону, поки сама форма не
 * мінялась.
 *
 * `boundaryMedian` питає те, що питає око: наскільки різні дві СУСІДНІ
 * ПЛОЩИНИ. Межа грані — це стрибок, більший за сусідні з ним стрибки;
 * усередині грані яскравість пливе рівно, тож її кроки менші за той, що
 * стоїть на межі. Локальний максимум серед кроків — ознака без жодного
 * підібраного порога.
 */
export function facetSeparations(plateaus) {
  const inner = plateaus.length > 2 ? plateaus.slice(1, -1) : plateaus;
  const steps = [];
  for (let index = 1; index < inner.length; index += 1) {
    const low = inner[index - 1].luminance;
    const high = inner[index].luminance;
    const scale = Math.max(low, high, 1e-9);
    steps.push(Math.abs(high - low) / scale);
  }

  /*
   * Межі граней — кроки, більші за ОБИДВА сусідні кроки.
   *
   * Обидва, а не «хоча б один наявний»: перша редакція брала й крайні
   * кроки, у яких сусід лише один, — і тест упіймав це першим прогоном.
   * Пологий підйом на початку грані (0.10 → 0.12) не має лівого сусіда,
   * тож проходив як межа й тягнув медіану вниз рівно так само, як тягнули
   * її переходи всередині грані. Тобто прилад лікували від того самого,
   * чим він і хворів.
   *
   * Ціна названа: межа на самому краю силуету не рахується. Це грані під
   * ковзним кутом, де вимір і без того найненадійніший.
   *
   * Виняток один — коли крок узагалі один: тоді порівнювати нема з чим, і
   * цей крок і Є межею між двома площинами.
   */
  const boundaries = [];
  if (steps.length === 1) {
    if (steps[0] > 0) boundaries.push(steps[0]);
  } else if (steps.length === 2) {
    /*
     * Два кроки — і сказати, котрий із них межа, а котрий схил, нема з
     * чого: у кожного лише один сусід. Береться більший, і лише коли він
     * УТРИЧІ більший за менший, тобто поруч із ним справді рівний хід.
     * Інакше межа не оголошується взагалі — краще порожня вибірка, ніж
     * вигадане число.
     */
    const [high, low] = steps[0] >= steps[1] ? [steps[0], steps[1]] : [steps[1], steps[0]];
    if (high > 0 && high >= low * 3) boundaries.push(high);
  } else {
    for (let index = 1; index + 1 < steps.length; index += 1) {
      if (steps[index] > 0 && steps[index] >= steps[index - 1] && steps[index] >= steps[index + 1]) {
        boundaries.push(steps[index]);
      }
    }
  }

  const sorted = [...steps].sort((left, right) => right - left);
  const sortedBoundaries = [...boundaries].sort((left, right) => right - left);
  return {
    steps: sorted,
    median: sorted.length > 0 ? sorted[Math.floor(sorted.length / 2)] : 0,
    max: sorted.length > 0 ? sorted[0] : 0,
    boundaries: sortedBoundaries,
    boundaryMedian: sortedBoundaries.length > 0
      ? sortedBoundaries[Math.floor(sortedBoundaries.length / 2)]
      : 0,
    plateaus: inner,
  };
}
