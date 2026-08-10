#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { resolveChromium } from './portal.mjs';

// ============================================================
// npm run live:diff -- <до.png> <після.png>
// ------------------------------------------------------------
// Відповідає на одне питання: «а чи не змінилось те, що змінюватись не мало?»
//
// **І одразу дає шум.** Сцена живе власною анімацією — іскри мерехтять, камінь
// дихає, — тож два знімки однієї збірки ніколи не збігаються попіксельно.
// Порівнювати «до» і «після» без цієї межі безглуздо: 0.9% розбіжності
// виглядають страшно, поки не знаєш, що два запуски одного коду дають 1.2%.
// Тому третім аргументом можна дати ще один знімок тієї самої збірки — і
// скрипт скаже, чи різниця взагалі вища за власний шум сцени.
// ============================================================

const args = process.argv.slice(2);
// Області, які не порівнюються. Не поблажка: на головній рядок привітання
// щоразу інший («Як справи, Дімасік?» — випадковий із набору), і без цього
// два знімки того самого коду розходились на 0.46% пікселів, з яких усі до
// одного лежали в тій смузі. Сцена під нею збігається до пікселя.
const ignore = [];
const files = [];
for (const arg of args) {
  if (arg.startsWith('--ignore=')) {
    const box = arg.slice('--ignore='.length).split(',').map(Number);
    if (box.length !== 4 || box.some((value) => !Number.isFinite(value))) {
      console.error('--ignore приймає чотири числа: x,y,ширина,висота (у пікселях знімка).');
      process.exit(1);
    }
    ignore.push(box);
    continue;
  }
  files.push(arg);
}
const [a, b, noiseSample] = files;

if (!a || !b) {
  console.log(`
Порівняння знімків.

  npm run live:diff -- .live/home-phone.png .live/home-phone-after.png [ще-один-знімок-тієї-самої-збірки.png]

Третій файл необов'язковий: це другий знімок ТОГО САМОГО коду. Він задає шум
власної анімації сцени, з яким і треба порівнювати різницю.

  --ignore=x,y,ширина,висота   не порівнювати цю область; можна кілька

Знімай для порівняння із --still, інакше власна анімація сцени дає близько
10% розбіжності й порівнювати нічого. На головній варто виключати рядок
привітання: --ignore=0,0,824,300 (для phone@2).
`.trim());
  process.exit(1);
}

const executablePath = resolveChromium();
const browser = await chromium.launch({
  ...(executablePath ? { executablePath } : {}),
  headless: true,
});
const page = await browser.newPage();

async function compare(first, second) {
  return page.evaluate(async ([one, two, skip]) => {
    const read = async (data) => {
      const image = new Image();
      image.src = `data:image/png;base64,${data}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      return {
        width: image.width,
        height: image.height,
        pixels: context.getImageData(0, 0, image.width, image.height).data,
      };
    };
    const left = await read(one);
    const right = await read(two);
    if (left.width !== right.width || left.height !== right.height) {
      return { error: `розміри різні: ${left.width}×${left.height} проти ${right.width}×${right.height}` };
    }
    let differing = 0;
    // Не лише скільки, а й де: частка сама по собі не каже, чи це кайма
    // згладжування по краю каменю, чи новий елемент на пів-екрана.
    let minX = left.width;
    let minY = left.height;
    let maxX = -1;
    let maxY = -1;
    for (let index = 0; index < left.pixels.length; index += 4) {
      const delta = Math.abs(left.pixels[index] - right.pixels[index])
        + Math.abs(left.pixels[index + 1] - right.pixels[index + 1])
        + Math.abs(left.pixels[index + 2] - right.pixels[index + 2]);
      // Поріг 12 із 765: нижче цього — шум кодування, а не зміна кольору.
      if (delta <= 12) continue;
      const pixel = index / 4;
      const x = pixel % left.width;
      const y = (pixel - x) / left.width;
      if (skip.some(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh)) continue;
      differing += 1;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return {
      total: left.pixels.length / 4,
      differing,
      width: left.width,
      height: left.height,
      box: maxX < 0 ? null : [minX, minY, maxX - minX + 1, maxY - minY + 1],
    };
  }, [
    readFileSync(resolve(process.cwd(), first)).toString('base64'),
    readFileSync(resolve(process.cwd(), second)).toString('base64'),
    ignore,
  ]);
}

const main = await compare(a, b);
if (main.error) {
  console.error(main.error);
  await browser.close();
  process.exit(1);
}
const share = (100 * main.differing) / main.total;
console.log(`${a} ↔ ${b}: ${main.differing} пікселів (${share.toFixed(2)}%)`);
if (main.box !== null) {
  const [x, y, width, height] = main.box;
  console.log(
    `  область змін: ${width}×${height} від (${x}, ${y}) — це `
    + `${((100 * width) / main.width).toFixed(0)}% ширини й ${((100 * height) / main.height).toFixed(0)}% висоти кадру`,
  );
}

if (noiseSample) {
  const noise = await compare(a, noiseSample);
  if (!noise.error) {
    const noiseShare = (100 * noise.differing) / noise.total;
    console.log(`шум сцени (${a} ↔ ${noiseSample}): ${noise.differing} (${noiseShare.toFixed(2)}%)`);
    console.log(
      share <= noiseShare
        ? 'Різниця НЕ вища за власний шум сцени — змін, які можна виміряти, немає.'
        : `Різниця вища за шум у ${(share / Math.max(noiseShare, 1e-9)).toFixed(1)} разів — є що дивитись.`,
    );
  }
}

await browser.close();
