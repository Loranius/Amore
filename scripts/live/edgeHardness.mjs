// ============================================================
// Твердість краю — скільки на тілі СХОДИНОК світла на сто пікселів.
// ------------------------------------------------------------
// НАВІЩО ЦЕ ОКРЕМИЙ ПРИЛАД, А НЕ `findFacets`. У кристала питання
// звучить «чи РІЗНЯТЬСЯ сусідні грані» — там сходинка є метою, і
// `facetProfile` міряє її висоту. У рифа питання протилежне: власник
// сказав «аплікація дитини з гострими кутками», тобто сходинок на
// круглому тілі забагато. Висота тут ні до чого — рахується ЩІЛЬНІСТЬ.
//
// Два прилади з однієї арифметики розійшлись би тихо, тому спільне —
// `pixelLuminance` із `luminance.mjs`; тут лежить лише те, чого там нема.
//
// ЧОМУ ПО РЯДКАХ, А НЕ СМУГОЮ. `scanBand` усереднює смугу вниз по
// стовпцях. На кристалі це слушно: ребра гранованої призми йдуть
// вертикально, і усереднення прибирає шум, не чіпаючи сходинки. На
// куполі ребра йдуть в УСІ боки, і те саме усереднення розмазало б
// кожне похиле ребро в пологий схил — прилад показав би гладке тіло на
// будь-якому кадрі. Тому кожен рядок міряється окремо, а по рядках
// береться медіана.
//
// ЩО ТАКЕ СХОДИНКА. Крок між сусідніми пікселями, БІЛЬШИЙ ЗА ОБИДВА
// сусідні кроки і більший за поріг. Та сама умова, що в
// `boundaryMedian` кристала (ADR-0122), і з тієї самої причини: усередині
// однієї площини теж є перепад, просто він рівномірний. Локальний
// максимум відрізняє ребро від схилу; сам по собі поріг — ні.
// ============================================================
import { pixelLuminance } from './luminance.mjs';

/** Медіана п'яти сусідів: прибирає поодиноку іскру, не розмиваючи сходинку. */
function smoothRow(values) {
  const out = new Array(values.length);
  for (let x = 0; x < values.length; x += 1) {
    const window = [];
    for (let k = Math.max(0, x - 2); k <= Math.min(values.length - 1, x + 2); k += 1) {
      if (Number.isFinite(values[k])) window.push(values[k]);
    }
    if (window.length === 0) { out[x] = Number.NaN; continue; }
    window.sort((left, right) => left - right);
    out[x] = window[window.length >> 1];
  }
  return out;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[sorted.length >> 1];
}

/**
 * Сходинки в одному рядку.
 *
 * `jump` — частка від середнього двох сусідів, а не абсолютна різниця:
 * інакше прилад міряв би яскравість теми, а не твердість краю. Світлий
 * риф і темний риф мусять давати одне число на однаковій формі.
 */
export function rowEdges(values, { jump = 0.06 } = {}) {
  const smooth = smoothRow(values);
  const steps = [];
  for (let x = 0; x + 1 < smooth.length; x += 1) {
    const left = smooth[x];
    const right = smooth[x + 1];
    if (!Number.isFinite(left) || !Number.isFinite(right)) { steps[x] = Number.NaN; continue; }
    const mean = (left + right) / 2;
    steps[x] = mean > 1e-9 ? Math.abs(right - left) / mean : 0;
  }
  const edges = [];
  for (let x = 1; x + 1 < steps.length; x += 1) {
    const here = steps[x];
    if (!Number.isFinite(here) || here < jump) continue;
    const before = steps[x - 1];
    const after = steps[x + 1];
    if (!Number.isFinite(before) || !Number.isFinite(after)) continue;
    // Строго більший за обидва боки: рівна ділянка схилу дає однакові
    // кроки підряд, і жоден із них не є ребром.
    if (here > before && here > after) edges.push({ at: x, step: here });
  }
  return edges;
}

/**
 * Твердість краю на ділянці кадру.
 *
 * `mask` — та сама домовленість, що в `scanBand`: одиниця означає «цей
 * піксель належить тілу». Пікселі поза маскою стають `NaN`, і сходинка
 * крізь них не рахується — інакше найтвердішим ребром кадру щоразу
 * виявлявся б САМ СИЛУЕТ, тобто межа тіла з водою. Силует має бути
 * твердим; питання не про нього.
 */
/**
 * ЛАТКИ — це сходинки, обабіч яких лежать ДОВГІ рівні пробіги.
 *
 * Перша редакція рахувала всі сходинки підряд, і на цьому спіткнулась: карти
 * каменю (ADR-0195, крок 4) додали дрібне зерно, число зросло 4.29 → 4.76 —
 * а на кадрі камінь став явно кращим. Прилад не брехав, він відповідав не на
 * те питання: скарга власника була про АПЛІКАЦІЮ, тобто про клапті завбільшки
 * з десятки пікселів, а не про зернистість поверхні.
 *
 * Відрізняє їх рівно розмір. Зерно — це сходинки через кожні два-три пікселі;
 * латка — сходинка, обабіч якої тягнеться рівне поле. Тому тут рахуються лише
 * ті сходинки, що мають із обох боків пробіг не коротший за `patchRun`.
 *
 * Це третій випадок у цьому проєкті, коли мірку довелось виправляти після
 * того, як вона розійшлася з кадром (ADR-0174 міряла острів, ADR-0187 —
 * дрібноту). Спільне в них: **мірка, яка ставить не те питання, дає числа
 * схожого порядку й нічим не кричить.**
 */
function patchEdges(edges, patchRun, width) {
  const kept = [];
  for (let at = 0; at < edges.length; at += 1) {
    const before = at === 0 ? edges[at].at : edges[at].at - edges[at - 1].at;
    const after = at + 1 === edges.length ? width - edges[at].at : edges[at + 1].at - edges[at].at;
    if (before >= patchRun && after >= patchRun) kept.push(edges[at]);
  }
  return kept;
}

export function edgeHardness(
  image,
  band,
  tone,
  { mask = null, jump = 0.06, minRun = 24, patchRun = 8 } = {},
) {
  const { width, channels, data } = image;
  const rows = [];
  const allSteps = [];
  const patchSteps = [];
  for (let y = band.y0; y < band.y1; y += 1) {
    const values = [];
    let inside = 0;
    for (let x = band.x0; x < band.x1; x += 1) {
      if (mask !== null && mask[y * width + x] !== 1) { values.push(Number.NaN); continue; }
      const offset = (y * width + x) * channels;
      values.push(pixelLuminance(data[offset], data[offset + 1], data[offset + 2], tone));
      inside += 1;
    }
    if (inside < minRun) continue;
    const edges = rowEdges(values, { jump });
    for (const edge of edges) allSteps.push(edge.step);
    const patches = patchEdges(edges, patchRun, values.length);
    for (const edge of patches) patchSteps.push(edge.step);
    rows.push({
      y,
      inside,
      edges: edges.length,
      per100: (edges.length / inside) * 100,
      patchesPer100: (patches.length / inside) * 100,
    });
  }
  return {
    rows: rows.length,
    /**
     * ГОЛОВНЕ ЧИСЛО: латок на сто пікселів тіла, медіана по рядках.
     *
     * Саме воно відповідає на скаргу «аплікація»: клапоть — це сходинка з
     * рівним полем обабіч. Дрібне зерно поверхні сюди не входить.
     */
    patchesPer100: median(rows.map((row) => row.patchesPer100)),
    /** Усі сходинки разом із зерном — довідка про те, наскільки живе тіло. */
    per100: median(rows.map((row) => row.per100)),
    /** Висота сходинки — довідка, а не мірка: скарга про кількість. */
    medianStep: median(allSteps),
    patchStep: median(patchSteps),
    edges: allSteps.length,
    patches: patchSteps.length,
  };
}

/*
 * Запуск руками над готовим знімком:
 *
 *   node scripts/live/edgeHardness.mjs .live/home-phone.png --band=760-1020 --x=200-620
 *
 * Смуга задається в пікселях САМОГО PNG (тобто з урахуванням `scale`
 * пристрою) і мусить лежати всередині тіла: маски тут нема навмисно —
 * межа тіла з водою твердою й має бути.
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import('node:fs');
  const { decodePng, TONE_MAPPING_ACES } = await import('./luminance.mjs');
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const pick = (name, fallback) => {
    const hit = args.find((a) => a.startsWith(`--${name}=`));
    return hit === undefined ? fallback : hit.slice(name.length + 3);
  };
  const range = (text, label) => {
    const match = /^(\d+)-(\d+)$/.exec(text ?? '');
    if (!match) throw new Error(`--${label} має вигляд 700-1100, а не «${text}»`);
    return [Number(match[1]), Number(match[2])];
  };
  if (!file) throw new Error('Перший аргумент — шлях до PNG.');
  const [y0, y1] = range(pick('band'), 'band');
  const [x0, x1] = range(pick('x'), 'x');
  const image = decodePng(readFileSync(file));
  const tone = { toneMapping: TONE_MAPPING_ACES, exposure: Number(pick('exposure', '1')) };
  const result = edgeHardness(image, { y0, y1, x0, x1 }, tone, {
    jump: Number(pick('jump', '0.06')),
  });
  console.log(
    `${file}  смуга ${y0}-${y1} × ${x0}-${x1}\n`
    + `  ЛАТОК на 100 px тіла: ${result.patchesPer100.toFixed(2)}`
    + `  (медіана по ${result.rows} рядках, висота ${(result.patchStep * 100).toFixed(1)}%)\n`
    + `  усіх сходинок на 100 px: ${result.per100.toFixed(2)}`
    + `  (з зерном; усього ${result.edges}, висота ${(result.medianStep * 100).toFixed(1)}%)`,
  );
}
