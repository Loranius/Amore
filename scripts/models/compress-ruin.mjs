#!/usr/bin/env node
/**
 * Руїна для головної: 21.8 МБ вихідного експорту → мобільний асет.
 * ------------------------------------------------------------
 * Чому скрипт, а не «стиснув один раз руками». Асет доведеться перебрати
 * ще не раз — інша роздільність, інший набір мешів, інший формат, — і
 * кожен такий перебір мусить бути ПОВТОРЮВАНИМ. Скайбокс «Нашого шляху»
 * і зграю риб у рифі вже тиснули; від обох лишились скрипт і ліцензія,
 * і саме тому їх можна перебрати сьогодні, не шукаючи, «як тоді робили».
 *
 * ЩО ПОКАЗАВ ВИМІР ВИХІДНОГО ФАЙЛУ (не здогад — розібраний GLB):
 *
 *   геометрія     12 812 трикутників, 18 191 вершина, 9 мешів   ← дешево
 *   текстури      27 зображень, усі 1024×1024, разом 19.8 МБ    ← уся вага
 *   матеріали     9, у кожного base(JPEG) + normal(PNG) + ORM(PNG)
 *
 * Тобто вага асета — це PNG-и нормалей і ORM по ~1 МБ кожен. Геометрію
 * чіпати нема сенсу взагалі: 12.8k трикутників — це менше, ніж у нас
 * коштує одне дерево.
 *
 * ЩО РОБИТЬ ЦЕЙ СКРИПТ:
 *
 *   1. Прибирає вузол `Gem`. У руїні по центру вже стоїть самоцвіт — але
 *      його місце належить кристалу пари. Лишити обидва означало б два
 *      кристали в одному кадрі; лишити чужий — показувати пару чужу
 *      історію.
 *   2. Тисне текстури за РОЛЛЮ, а не однаково: те, на що дивляться
 *      (підлога, підставка, колони), лишається 512; уламки цегли, кожен
 *      з яких займає сотню пікселів екрана, — 256.
 *   3. Переводить PNG у WebP. `EXT_texture_webp` підтримується
 *      GLTFLoader'ом у three (перевірено в node_modules), і саме на цих
 *      PNG-ах лежить основна вага.
 *   4. Прибирає те, на що вже ніхто не посилається, і звіряє результат
 *      із бюджетом.
 *
 * ЛІЦЕНЗІЯ. Скрипт НЕ вигадує її за автора: поруч із вихідним файлом
 * має лежати `public/models/RUIN_LICENSE.txt`, інакше асет у репозиторій
 * не потрапляє. Так само зроблено для риб і скайбокса.
 */
import { NodeIO } from '@gltf-transform/core';
import { prune, dedup } from '@gltf-transform/functions';
import { EXTTextureWebP } from '@gltf-transform/extensions';
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

/** Вузли, які прибираються повністю, і чому. */
const DROP_NODES = new Set(['Gem']);

/**
 * Роздільність за роллю поверхні.
 *
 * Числа не «на око»: уламки цегли — це меші на 88–968 трикутників, які на
 * телефоні 412 px завширшки ніколи не займають більше кількох сотень
 * пікселів. Тримати під ними ту саму карту, що під підлогою на весь
 * кадр, — це платити однаково за різне.
 */
const SIZES = { hero: 512, debris: 256 };
const DEBRIS = /^bricks/i;

/** Ціль, названа до роботи, а не підігнана після. */
const BUDGET_MB = 3;

const SOURCE = process.argv[2];
const OUT = process.argv[3] ?? 'public/models/amore_ruin.glb';
if (!SOURCE) {
  console.error('Використання: compress-ruin.mjs <вихідний.glb> [вихід.glb]');
  process.exit(2);
}

const io = new NodeIO().registerExtensions([EXTTextureWebP]);
const doc = await io.read(SOURCE);
const root = doc.getRoot();

const before = {
  meshes: root.listMeshes().length,
  textures: root.listTextures().length,
  bytes: root.listTextures().reduce((s, t) => s + (t.getImage()?.byteLength ?? 0), 0),
};

// ── 1. Геть чужий самоцвіт ───────────────────────────────────
let dropped = 0;
for (const node of root.listNodes()) {
  if (!DROP_NODES.has(node.getName())) continue;
  // Разом із дітьми: у цьому експорті меш висить на дитині `defaultMaterial`.
  for (const child of node.listChildren()) child.dispose();
  node.dispose();
  dropped += 1;
}
if (dropped === 0) throw new Error('Вузол Gem не знайдено — асет не той, який міряли.');

// ── 2. Текстури: роздільність за роллю, PNG → WebP ───────────
doc.createExtension(EXTTextureWebP).setRequired(false);

/** Яким матеріалам належить текстура — щоб знати її роль. */
const roleOf = new Map();
for (const material of root.listMaterials()) {
  const debris = DEBRIS.test(material.getName());
  for (const tex of [
    material.getBaseColorTexture(),
    material.getMetallicRoughnessTexture(),
    material.getNormalTexture(),
    material.getOcclusionTexture(),
    material.getEmissiveTexture(),
  ]) {
    if (!tex) continue;
    // Найсуворіша роль виграє: текстуру, спільну для героя й уламка,
    // не можна тиснути як уламок.
    roleOf.set(tex, (roleOf.get(tex) ?? true) && debris);
  }
}

let converted = 0;
for (const tex of root.listTextures()) {
  const image = tex.getImage();
  if (!image) continue;
  const size = roleOf.get(tex) === true ? SIZES.debris : SIZES.hero;
  const pipeline = sharp(Buffer.from(image)).resize(size, size, { fit: 'fill' });
  // WebP для всього: на нормалях і ORM він дає найбільший виграш, а на
  // базовому кольорі не програє JPEG-у.
  const next = await pipeline.webp({ quality: 82, effort: 6 }).toBuffer();
  tex.setImage(new Uint8Array(next)).setMimeType('image/webp');
  converted += 1;
}

// ── 3. Прибрати осиротіле ────────────────────────────────────
await doc.transform(dedup(), prune());

const after = {
  meshes: root.listMeshes().length,
  textures: root.listTextures().length,
  bytes: root.listTextures().reduce((s, t) => s + (t.getImage()?.byteLength ?? 0), 0),
};

const glb = await io.writeBinary(doc);
writeFileSync(OUT, glb);

const mb = (n) => (n / 1048576).toFixed(2) + ' МБ';
console.log(`вузол Gem прибрано: ${dropped}`);
console.log(`меші     ${before.meshes} → ${after.meshes}`);
console.log(`текстури ${before.textures} → ${after.textures} (перетиснуто ${converted})`);
console.log(`піксельні дані ${mb(before.bytes)} → ${mb(after.bytes)}`);
console.log(`ФАЙЛ     ${mb(glb.byteLength)}  →  ${OUT}`);

if (glb.byteLength > BUDGET_MB * 1048576) {
  console.error(`\nПЕРЕВИЩЕНО БЮДЖЕТ ${BUDGET_MB} МБ.`);
  process.exit(1);
}
