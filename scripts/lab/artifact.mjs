// ============================================================
// Вимір артефакта без порталу — кристал або дерево.
// ------------------------------------------------------------
// `amore-crystal-look`: кристал, який читається кристалом, має сусідні
// грані, що різняться на 30%+; нижче ~10% він виглядатиме гладкою
// формою, хай яким правильним буде решта. Досі це число можна було
// дістати лише через живий портал із логіном і мережею.
//
// Тут те саме число знімається з `crystal-lab.html` — тим самим ланцюгом
// станів і тією самою сценою, але без бекенда.
//
// НІЧОГО НЕ ДУБЛЮЄТЬСЯ. Браузер, SwiftShader, підміна профілю пристрою й
// приховані девтули — з `portal.mjs` (`openPortal({ login: false })`).
// Сама арифметика світла — з `luminance.mjs`: якщо вона розійдеться,
// вимір із лабораторії перестане означати те саме, що вимір із порталу.
//
//   node scripts/lab/artifact.mjs --years=11 --band=380-520
//   node scripts/lab/artifact.mjs --species=tree --years=1
//
// Драйвер один на обидва види навмисно: браузер, SwiftShader, підміна
// профілю, контрольний кадр і арифметика світла мусять бути ті самі,
// інакше числа двох видів не можна класти поруч.
// ============================================================
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ensureServer, openPortal, readToneMapping } from '../live/portal.mjs';
import {
  decodePng, scanBand, findPlateaus, facetSeparations,
} from '../live/luminance.mjs';
import { DEVICES, TIERS } from '../live/options.mjs';

const PORT = 5199;
const OUT = '.live';

function arg(name, fallback) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

function band(text) {
  const match = /^(\d+)-(\d+)$/.exec(text);
  if (!match) throw new Error(`--band має вигляд 380-520, а не «${text}»`);
  return { y0: Number(match[1]), y1: Number(match[2]), x0: 0, x1: 0 };
}

const species = arg('species', 'crystal');
if (species !== 'crystal' && species !== 'tree') {
  throw new Error(`--species приймає crystal або tree, не «${species}».`);
}
const years = arg('years', '11');
/*
 * Обнулити один доданок і перезняти — уся техніка цього проєкту. Різниця
 * в профілі і є внесок того доданка.
 */
const off = arg('off', '');
/*
 * Смуга по X обмежує вимір ТІЛОМ. Без неї в медіану потрапляють переходи
 * тіло↔тло — вони завжди 80%+ і ховають справжнє число за собою, рівно
 * як і крайні плато, які `facetSeparations` уже відкидає.
 */
const xRange = arg('x', '');
const quality = arg('quality', 'high');
/*
 * Рівень деталізації окремо від профілю пристрою: телефон бачить `medium`,
 * і саме там живуть інші стелі (18 000 трикутників, 660 листків,
 * чотирирядкова пластинка листка). Дивитись на `high` і робити висновок про
 * телефон — це міряти одне дерево, а писати про інше.
 */
const lod = arg('lod', '');
/* Профіль заповнення модулів: найгірші просідання живуть не в лабораторній парі. */
const fill = arg('fill', '');
const theme = arg('theme', 'dark');
const rows = band(arg('band', '380-520'));

const server = await ensureServer(PORT, { silent: true });
const portal = await openPortal({
  baseUrl: server.url,
  device: DEVICES.phone,
  tier: TIERS[quality] ?? TIERS.high,
  theme,
  login: false,
});

try {
  const url = `${server.url}${species}-lab.html?years=${years}&quality=${quality}&theme=${theme}`
    + (lod ? `&lod=${lod}` : '')
    + (fill ? `&fill=${encodeURIComponent(fill)}` : '')
    + (off === '' ? '' : `&off=${off}`);
  await portal.page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await portal.page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 60_000 });
  /*
   * Час ПІСЛЯ ознаки, а не замість неї. Полотно повідомляє, що стан
   * зібрано, але камера ще їде, а сцена ще не осіла; знімок до цього
   * показує кадр, якого не бачить ніхто.
   */
  await portal.page.waitForTimeout(9_000);

  mkdirSync(OUT, { recursive: true });
  const tag = off === '' ? 'base' : `off-${off.replace(/,/g, '+')}`;
  const file = join(OUT, `${species}-lab-${years}y-${quality}${lod ? `-${lod}` : ''}${fill ? `-${fill}` : ''}-${theme}-${tag}.png`);
  writeFileSync(file, await portal.page.screenshot());

  /*
   * ЧИ КРИСТАЛ УЗАГАЛІ НАМАЛЬОВАНИЙ — контрольним кадром у ТОМУ Ж прогоні.
   *
   * Без цієї перевірки оснастка вже брехала впевнено: коли бандл
   * виявився звільненим, сцена малювалась цілком — руїна, обеліски,
   * каміння, — і профіль звітував «ЧИТАЄТЬСЯ КРИСТАЛОМ, 85%», бо міряв
   * обеліск проти неба. Два прогони з трьох.
   *
   * Перша редакція цієї перевірки не спрацювала й теж чесно про це
   * каже: вона звіряла лічильник трикутників УСІЄЇ сцени (11 916 без
   * кристала, 12 472 з ним) із числом трикутників кристала (2 284) — і
   * 11 916 > 2 284 у будь-якому разі. Порівнювати треба сцену з собою,
   * а не з частиною себе.
   */
  const controlUrl = species === 'crystal' ? `${url}&crystal=off` : null;
  let controlColumns = null;
  if (controlUrl !== null) {
    await portal.page.goto(controlUrl, { waitUntil: 'load', timeout: 60_000 });
    await portal.page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 60_000 });
    await portal.page.waitForTimeout(9_000);
    const control = decodePng(await portal.page.screenshot());
    controlColumns = scanBand(
      control, { ...rows, x1: control.width }, await readToneMapping(portal.page),
    );
  }

  await portal.page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await portal.page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 60_000 });
  await portal.page.waitForTimeout(9_000);

  const tone = await readToneMapping(portal.page);
  const image = decodePng(await portal.page.screenshot());
  const columns = scanBand(image, { ...rows, x1: image.width }, tone);

  /*
   * Скільки стовпців смуги кристал справді змінив. Нуль означає, що його
   * в кадрі немає, хай яким здоровим виглядає профіль.
   */
  if (controlColumns !== null) {
    let changed = 0;
    for (let x = 0; x < Math.min(columns.length, controlColumns.length); x += 1) {
      if (Math.abs(columns[x] - controlColumns[x]) > 0.01) changed += 1;
    }
    if (changed < 20) {
      throw new Error(
        'Кристала в кадрі немає: контрольний знімок (crystal=off) відрізняється лише в '
        + `${changed} стовпцях зі ${columns.length}. Профіль не знімається.`,
      );
    }
    console.log(`кристал змінив ${changed} стовпців смуги зі ${columns.length}`);
  }
  const all = findPlateaus(columns);
  const bounds = /^(\d+)-(\d+)$/.exec(xRange);
  const plateaus = bounds
    ? all.filter((step) => step.from >= Number(bounds[1]) && step.to <= Number(bounds[2]))
    : all;
  const spread = facetSeparations(plateaus);

  console.log(`знімок  ${file}`);
  console.log(`тонування  ${JSON.stringify(tone)}`);
  console.log(`смуга  y ${rows.y0}–${rows.y1}, ширина ${image.width}`
    + (bounds ? `, тіло x ${bounds[1]}–${bounds[2]}` : '')
    + (off === '' ? '' : `, вимкнено: ${off}`));
  console.log(`плато  ${plateaus.length} (усього в смузі ${all.length})`);
  if (plateaus.length === 0 && all.length > 0) {
    for (const step of all) {
      console.log(`   [поза межами] x ${step.from}–${step.to}  ${step.luminance.toFixed(4)}`);
    }
  }
  for (const step of plateaus) {
    console.log(`   x ${String(step.from).padStart(4)}–${String(step.to).padStart(4)}  ${step.luminance.toFixed(4)}`);
  }
  if (spread.steps.length === 0) {
    console.log('РІЗНИЦЯ МІЖ СУСІДНІМИ ГРАНЯМИ: плато замало, щоб порівнювати.');
  } else {
    console.log(`різниця між сусідніми  ${spread.steps.map((s) => `${(s * 100).toFixed(0)}%`).join(', ')}`);
    console.log(`медіана ${(spread.median * 100).toFixed(0)}%, найбільша ${(spread.max * 100).toFixed(0)}%`);
    console.log(spread.median >= 0.3
      ? 'ЧИТАЄТЬСЯ КРИСТАЛОМ (поріг 30%).'
      : spread.median >= 0.1
        ? 'МЕЖА: нижче 30%, але не гладке.'
        : 'ЧИТАЄТЬСЯ ГЛАДКОЮ ФОРМОЮ (нижче 10%).');
  }
  const errors = portal.logs.filter((line) => /error|Error/.test(line));
  if (errors.length > 0) {
    console.log(`\nПОМИЛКИ СТОРІНКИ (${errors.length}):`);
    for (const line of errors.slice(0, 8)) console.log(`   ${line}`);
  }
} finally {
  await portal.close();
  await server.stop();
}
