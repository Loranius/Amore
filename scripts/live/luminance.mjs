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

/**
 * Піксель за координатами — [r, g, b].
 *
 * Існує заради однієї вади, яка вже коштувала виправлення ADR. Знімки
 * порталу — PNG типу 2, тобто ТРИ канали; одноразова мірка, написана з
 * кроком 4 «бо RGBA», читає піксель зі зсувом, що росте вздовж рядка, і
 * повертає правдоподібні, але випадкові числа. Тут крок береться з самого
 * зображення, тож помилитись у ньому більше нема де.
 */
export function pixelAt(image, x, y) {
  const offset = (y * image.width + x) * image.channels;
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
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

/**
 * Середня яскравість кожного стовпця смуги.
 *
 * МАСКА — НЕ ПРИКРАСА, А УМОВА ТОГО, ЩО ВИМІР ВЗАГАЛІ ПРО КРИСТАЛ.
 * ------------------------------------------------------------
 * Без неї стовпець усереднює всю висоту смуги: небо над тілом, мох і
 * брили під ним, і саме тіло — усе одним числом. Виміряно, скільки це
 * коштує (ADR-0174): у смузі за замовчуванням із двадцяти трьох плато
 * кристалові належали два, а «медіана меж 18%» описувала камінь острова.
 * Три терми поспіль (`skyStrength`, `glassStrength`, `rimStrength`) дали
 * при цьому число в число однаковий результат — не тому, що вони нічого
 * не роблять, а тому, що прилад дивився не туди.
 *
 * `mask` — Uint8Array розміру `width * height` кадру, одиниця означає
 * «цей піксель належить артефакту». Стовпець, у якому таких пікселів
 * менше за `minSamples`, повертається як `NaN`: це не нуль і не темна
 * грань, це «тут тіла немає», і плато крізь такий стовпець не тягнеться.
 */
export function scanBand(image, band, tone, { mask = null, minSamples = 8 } = {}) {
  const { width, channels, data } = image;
  const columns = [];
  for (let x = band.x0; x < band.x1; x += 1) {
    let total = 0;
    let count = 0;
    for (let y = band.y0; y < band.y1; y += 1) {
      if (mask !== null && mask[y * width + x] !== 1) continue;
      const offset = (y * width + x) * channels;
      total += pixelLuminance(data[offset], data[offset + 1], data[offset + 2], tone);
      count += 1;
    }
    if (mask !== null && count < minSamples) columns.push(Number.NaN);
    else columns.push(count > 0 ? total / count : 0);
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
    // Порожній стовпець (`NaN`) — це діра в тілі, а не темна грань. Плато
    // крізь неї не тягнеться: інакше два різні кристали, між якими видно
    // небо, злились би в одне плато.
    if (!Number.isFinite(columns[index])) { index += 1; continue; }
    let end = index + 1;
    while (end < columns.length) {
      if (!Number.isFinite(columns[end])) break;
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
 * ГРАНІ — ВІДРІЗКИ МІЖ РЕБРАМИ, а не рівні пробіги.
 *
 * `findPlateaus` шукає пробіг, який тримається в межах 8% ЦІЛКОМ. На
 * теперішньому кристалі таких пробігів нуль — і це не тому, що граней
 * немає, а тому, що грань ними не є:
 *
 *  - грань завширшки 60–85 пікселів має власний перепад ~20% (ADR-0085),
 *    тобто ширша за допуск сама по собі;
 *  - по тілу розсипані іскри (§9 брифу), і одна іскра — це стовпець на
 *    17–32% яскравіший за сусідні, тобто розрив будь-якого плато.
 *
 * Виміряно на живому кадрі (ADR-0174): у смузі стовбура монарха
 * `findPlateaus` знайшов НУЛЬ плато там, де око бачить п'ять граней із
 * кроками 37–45%. Прилад мовчав про кристал, який проходить поріг.
 *
 * Тут грань шукається з іншого боку — від РЕБРА. Ребро це стрибок; між
 * стрибками лежить грань, якою б похилою вона не була всередині. Стовпці
 * самого ребра не належать жодній грані: там світиться намальований обвід
 * (`facetEdgeStrength`), і зарахувати його до грані означало б міряти
 * обвід замість площини.
 *
 * ЯСКРАВІСТЬ ГРАНІ — МЕДІАНА, а не середнє: медіана не рухається від
 * однієї іскри, середнє рухається.
 */
/*
 * `minRun` — п'ять стовпців, і це виміряно, а не вибрано круглим.
 *
 * На стовбурі завширшки 53 пікселі є фаска в 5–6 стовпців. При шести вона
 * то знаходилась, то ні — від кадру до кадру, — і коли випадала, прилад
 * порівнював дві НЕ сусідні грані як сусідні: 0.518 проти 0.594, тобто
 * «найслабша пара 13%» на кристалі, у якого найслабша пара 27%. Число
 * помилялось не трохи, а знаком висновку.
 *
 * Нижче п'яти не варто: обвід грані має ширину 2–3 стовпці, і при трьох
 * він сам почав би рахуватись гранню.
 */
/*
 * `jump` — двадцять відсотків, і це НЕ запас міцності, а названа межа
 * розрізнення приладу.
 *
 * Грань має власний перепад ~20% від краю до краю (ADR-0085), і на темній
 * грані цей перепад між сусідніми стовпцями сягає 16%. При порозі 12%
 * прилад від кадру до кадру то знаходив у стовбурі п'ять граней, то сім —
 * і сьома пара звітувала «22%» там, де це був схил усередині однієї
 * площини.
 *
 * ЦІНА: дві грані, що різняться менше ніж на 20%, зіллються в одну. Це
 * втрата, і от як її видно — таких граней стає МЕНШЕ. Тому число граней
 * друкується поруч із кроками: стовбур, у якому їх дві замість шести, —
 * це і є «читається гладкою формою», хай які великі кроки між ними.
 */
export function findFacets(columns, { minRun = 5, jump = 0.2 } = {}) {
  const facets = [];
  let index = 0;
  while (index < columns.length) {
    if (!Number.isFinite(columns[index])) { index += 1; continue; }
    let end = index;
    while (end + 1 < columns.length && Number.isFinite(columns[end + 1])) end += 1;
    facets.push(...splitRun(columns, index, end, minRun, jump));
    index = end + 1;
  }
  return facets;
}

function splitRun(columns, from, to, minRun, jump) {
  /*
   * РЕБРА ШУКАЮТЬСЯ ПО ЗГЛАДЖЕНОМУ РЯДУ, і без цього не працює зовсім.
   *
   * Іскра (§9 брифу) — це один-два стовпці на 17–32% яскравіші за
   * сусідні, тобто стрибок більший за поріг ребра. На живому кадрі перша
   * редакція через це нарізала стовбур на дві грані замість п'яти: іскри
   * порізали грані на шматки, коротші за `minRun`, і ті випали.
   *
   * Медіана п'яти сусідів прибирає одиничний сплеск і НЕ розмиває
   * сходинку — саме тому медіана, а не середнє.
   */
  const smooth = [];
  for (let x = from; x <= to; x += 1) {
    const window = [];
    for (let k = Math.max(from, x - 2); k <= Math.min(to, x + 2); k += 1) window.push(columns[k]);
    window.sort((left, right) => left - right);
    smooth[x] = window[window.length >> 1];
  }

  // Ребра: стовпці, на яких крок до наступного більший за поріг. Сусідні
  // такі стовпці — одне ребро, а не кілька: обвід має ширину.
  const edges = [];
  for (let x = from; x < to; x += 1) {
    const low = Math.min(smooth[x], smooth[x + 1]);
    const high = Math.max(smooth[x], smooth[x + 1]);
    if (high > 1e-9 && (high - low) / high >= jump) {
      const last = edges[edges.length - 1];
      if (last !== undefined && last.to === x - 1) last.to = x;
      else edges.push({ from: x, to: x });
    }
  }

  const facets = [];
  let start = from;
  const close = (end) => {
    if (end - start + 1 < minRun) return;
    const values = [];
    for (let x = start; x <= end; x += 1) values.push(columns[x]);
    values.sort((left, right) => left - right);
    const middle = values.length >> 1;
    facets.push({
      from: start,
      to: end,
      luminance: values.length % 2 === 1
        ? values[middle]
        : (values[middle - 1] + values[middle]) / 2,
    });
  };
  for (const edge of edges) {
    close(edge.from);
    start = edge.to + 1;
  }
  close(to);
  return facets;
}

/**
 * Крок між сусідніми гранями, у відсотках — те саме питання, що ставить
 * `amore-crystal-look`: наскільки різні дві сусідні ПЛОЩИНИ.
 *
 * Без вибору «межа це чи схил»: між двома гранями завжди рівно один крок,
 * бо ребро вже викинуте. Тому й читається найслабша пара, а не медіана:
 * одна пара, що збіглася, читається оком як одна площина.
 */
export function facetProfile(facets) {
  const steps = [];
  for (let index = 1; index < facets.length; index += 1) {
    const low = Math.min(facets[index - 1].luminance, facets[index].luminance);
    const high = Math.max(facets[index - 1].luminance, facets[index].luminance);
    steps.push(high > 1e-9 ? (high - low) / high : 0);
  }
  const sorted = [...steps].sort((left, right) => left - right);
  const middle = sorted.length >> 1;
  return {
    steps,
    weakest: sorted.length === 0 ? 0 : sorted[0],
    median: sorted.length === 0
      ? 0
      : (sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2),
    strongest: sorted.length === 0 ? 0 : sorted[sorted.length - 1],
  };
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
