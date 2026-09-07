// ============================================================
// Фото-еталон проти нашого кадру — ОДНА мірка на обидва.
// ------------------------------------------------------------
// НАВІЩО. Власник надсилає знімок і каже «зроби так». Досі з такого
// знімка можна було дістати лише прозу — «глибший», «оптичніший», — а з
// прози не виходить ані число, ані засувка. Тут із фото знімаються ті
// самі чотири величини, що й із нашого кадру, і кладуться поруч.
//
//   node scripts/live/photoProfile.mjs <фото> <наш.png>
//   node scripts/live/photoProfile.mjs <фото> <наш.png> --a=292,378,120,395 --b=345,455,730,1180
//
// ЩО МІРЯЄТЬСЯ, І ЧОМУ САМЕ ЦЕ:
//
//   відтінок, насиченість  — чи це той самий камінь;
//   розмах яскравості      — чи він ОПТИЧНИЙ. Прозорий кристал темний у
//                            товщі й світлий на ребрах; пласка фарба
//                            тримається однієї смуги;
//   низ → вістря           — куди в ньому збирається світло. У знімку
//                            аметиста вістря на 0.43 світліше за
//                            підніжжя; у нас — навпаки, бо світить ядро
//                            біля жеоди;
//   контраст граней        — `findPlateaus`/`facetSeparations`, ті самі
//                            функції, що й у профілі світла.
//
// ВІКНО ЗАДАЄТЬСЯ РУКАМИ, і це навмисне. Автоматична маска «пікселі
// насиченіші за поріг» уже збрехала тут одного разу: щойно тіло темніло,
// маска починала брати інші пікселі, і вимір мінявся разом із тим, що
// міряв. Прямокутник усередині тіла такого не вміє.
//
// JPEG декодує браузер із оснастки (`playwright-core` + Chromium з
// образу): другого декодера в проєкті немає, а тягти залежність заради
// одного знімка — гірше.
// ============================================================
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { decodePng, scanBand, findPlateaus, facetSeparations } from './luminance.mjs';

const TONE = { toneMapping: 0, exposure: 1 };

/**
 * Тонова крива НЕ знімається, і це не недогляд.
 *
 * `pixelLuminance` уміє повертати лінійну сцену — саме те, що треба, коли
 * питання «чи справді грані дістають різне світло». Тут питання інше:
 * ЧИ ОДНАКОВО ЦЕ ВИГЛЯДАЄ. Пара дивиться на sRGB-пікселі телефона, а
 * фото — теж sRGB, тож порівнюються саме вони.
 */
function hsv(r, g, b) {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const d = max - min;
  let h = 0;
  if (d > 1e-6) {
    if (max === r / 255) h = ((g - b) / 255 / d) % 6;
    else if (max === g / 255) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
    h = ((h / 6) % 1 + 1) % 1;
  }
  return { h, s: max <= 1e-6 ? 0 : d / max, v: max };
}

export function stoneProfile(image, win) {
  const { width, channels, data } = image;
  const pixels = [];
  for (let y = win.y0; y < win.y1; y += 1) {
    for (let x = win.x0; x < win.x1; x += 1) {
      const at = (y * width + x) * channels;
      pixels.push({ ...hsv(data[at], data[at + 1], data[at + 2]), y });
    }
  }
  const values = pixels.map((pixel) => pixel.v).sort((a, b) => a - b);
  const pct = (q) => values[Math.floor(q * (values.length - 1))];
  const saturation = pixels.reduce((sum, pixel) => sum + pixel.s, 0) / pixels.length;
  let hx = 0;
  let hy = 0;
  for (const pixel of pixels) {
    hx += Math.cos(pixel.h * Math.PI * 2);
    hy += Math.sin(pixel.h * Math.PI * 2);
  }
  const hue = ((Math.atan2(hy, hx) / (Math.PI * 2)) % 1 + 1) % 1;
  /*
   * ПІДЙОМ МІРЯЄТЬСЯ ПО ВСІЙ ШИРИНІ ТІЛА, А НЕ В КОЛОНЦІ.
   *
   * Перша редакція брала середнє у вузькому стовпчику. На знімку, де
   * кристал рівний, це те саме; на нашому кадрі — ні: монарх має ОДНУ
   * велику затінену грань, і стовпчик угорі проходив крізь неї, а внизу
   * — повз. Тобто число казало «верх темніший», а міряло «стовпчик
   * потрапив на темну грань».
   *
   * Тепер кожен РЯДОК вікна усереднюється цілком, а вже потім верхня
   * чверть рядків порівнюється з нижньою. Яка грань де стоїть, у це
   * число більше не входить.
   */
  const rows = [];
  for (let y = win.y0; y < win.y1; y += 1) {
    const row = pixels.filter((pixel) => pixel.y === y);
    if (row.length > 0) rows.push(row.reduce((sum, pixel) => sum + pixel.v, 0) / row.length);
  }
  const quarter = Math.max(1, Math.round(rows.length * 0.25));
  const mean = (list) => (list.length ? list.reduce((sum, value) => sum + value, 0) / list.length : 0);
  const tip = mean(rows.slice(0, quarter));
  const foot = mean(rows.slice(-quarter));

  const middle = Math.round((win.y0 + win.y1) / 2);
  const spread = facetSeparations(findPlateaus(
    scanBand(image, { x0: win.x0, x1: win.x1, y0: middle - 20, y1: middle + 20 }, TONE),
  ));

  return {
    hueDeg: hue * 360,
    saturation,
    low: pct(0.1),
    median: pct(0.5),
    high: pct(0.9),
    range: pct(0.9) - pct(0.1),
    tip,
    foot,
    lift: tip - foot,
    facetBoundaryMedian: spread.boundaryMedian,
    facetBoundaries: spread.boundaries.length,
  };
}

async function decodeAny(file) {
  if (file.endsWith('.png')) return decodePng(readFileSync(file));
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader-webgl'],
  });
  try {
    const page = await browser.newPage();
    const source = `data:image/jpeg;base64,${readFileSync(file).toString('base64')}`;
    const shot = await page.evaluate(async (src) => {
      const image = new Image();
      await new Promise((ok, no) => { image.onload = ok; image.onerror = no; image.src = src; });
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const { data } = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
      return { width: canvas.width, height: canvas.height, data: Array.from(data) };
    }, source);
    return { width: shot.width, height: shot.height, channels: 4, data: shot.data };
  } finally {
    await browser.close();
  }
}

function windowFrom(text, image, fallback) {
  if (!text) return fallback ?? { x0: 0, x1: image.width, y0: 0, y1: image.height };
  const [x0, x1, y0, y1] = text.split(',').map(Number);
  return { x0, x1, y0, y1 };
}

function say(label, profile) {
  console.log(`\n${label}`);
  console.log(`  відтінок      ${profile.hueDeg.toFixed(0)}°   насиченість ${profile.saturation.toFixed(2)}`);
  console.log(`  яскравість    10% ${profile.low.toFixed(2)}   медіана ${profile.median.toFixed(2)}`
    + `   90% ${profile.high.toFixed(2)}   розмах ${profile.range.toFixed(2)}`);
  console.log(`  вістря/низ    ${profile.tip.toFixed(2)} / ${profile.foot.toFixed(2)}   підйом ${profile.lift >= 0 ? '+' : ''}${profile.lift.toFixed(2)}`);
  console.log(`  грані         межі ${profile.facetBoundaries}, медіана ${(profile.facetBoundaryMedian * 100).toFixed(0)}%`);
}

const [photoFile, ourFile] = process.argv.slice(2).filter((value) => !value.startsWith('--'));
if (!photoFile || !ourFile) {
  console.log('node scripts/live/photoProfile.mjs <фото> <наш.png> [--a=x0,x1,y0,y1] [--b=x0,x1,y0,y1]');
  process.exit(1);
}
const arg = (name) => process.argv.slice(2).find((v) => v.startsWith(`--${name}=`))?.slice(name.length + 3);
const photo = await decodeAny(photoFile);
const ours = await decodeAny(ourFile);
say(`ЕТАЛОН  ${photoFile}`, stoneProfile(photo, windowFrom(arg('a'), photo)));
say(`НАШ     ${ourFile}`, stoneProfile(ours, windowFrom(arg('b'), ours)));
