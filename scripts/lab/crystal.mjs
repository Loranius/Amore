// ============================================================
// Вимір кристала без порталу.
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
//   node scripts/lab/crystal.mjs --years=11 --band=380-520
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

const years = arg('years', '11');
const quality = arg('quality', 'high');
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
  const url = `${server.url}crystal-lab.html?years=${years}&quality=${quality}&theme=${theme}`;
  await portal.page.goto(url, { waitUntil: 'load', timeout: 60_000 });
  await portal.page.waitForSelector('[data-evolution-preview="ready"]', { timeout: 60_000 });
  /*
   * Час ПІСЛЯ ознаки, а не замість неї. Полотно повідомляє, що стан
   * зібрано, але камера ще їде, а сцена ще не осіла; знімок до цього
   * показує кадр, якого не бачить ніхто.
   */
  await portal.page.waitForTimeout(9_000);

  mkdirSync(OUT, { recursive: true });
  const file = join(OUT, `crystal-lab-${years}y-${quality}-${theme}.png`);
  writeFileSync(file, await portal.page.screenshot());

  const tone = await readToneMapping(portal.page);
  const image = decodePng(await portal.page.screenshot());
  const columns = scanBand(image, { ...rows, x1: image.width }, tone);
  const plateaus = findPlateaus(columns);
  const spread = facetSeparations(plateaus);

  console.log(`знімок  ${file}`);
  console.log(`тонування  ${JSON.stringify(tone)}`);
  console.log(`смуга  y ${rows.y0}–${rows.y1}, ширина ${image.width}`);
  console.log(`плато  ${plateaus.length}`);
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
