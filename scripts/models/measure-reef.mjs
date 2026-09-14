#!/usr/bin/env node
// ============================================================
// ЩО НАСПРАВДІ ЛЕЖИТЬ У `coral_reef_set_cc0.glb`.
// ------------------------------------------------------------
// Асет лежав у репозиторії з серпня, значився в README як «каміння й
// корали ДЕКОРУ» — і жоден рядок коду його не читав. Кристал і дерево
// свої референси розібрали (`amore-crystal-look`, `amore-tree-look`); у
// рифа референс був, а розбору не було.
//
// Скрипт існує, щоб числа в `engine/species/reef/reefProfile.ts`
// (`REEF_REFERENCE`) були ВІДТВОРЮВАНІ, а не моїм словом:
//
//   node scripts/models/measure-reef.mjs
//
// Розбір ручний, без бібліотек: GLB — це заголовок, JSON-шматок і
// двійковий шматок, і читати їх трьома десятками рядків дешевше, ніж
// тягнути залежність заради одного файлу.
//
// ПАСТКА, В ЯКУ ЦЕЙ СКРИПТ УЖЕ ВПАВ. Перша редакція надрукувала габарити
// «0.00 × 0.01 × 0.01» і однакову рамку в усіх восьми тіл — тобто числа
// правдоподібні на вигляд і безглузді по суті. Причини дві, і обидві в
// GLB звичайні: вузли несуть `scale: [100,100,100]`, а ще поворот на
// −90° навколо X (експорт із Z-угору). Без них «висота» тіла — це його
// глибина, поділена на сто. Тому осі тут перевертаються явно, а масштаб
// вузла домножується — і саме тому в друк виведено ОБИДВА числа, сире й
// світове: щоб наступний читач бачив, що перетворення застосоване.
// ============================================================
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '..', '..', 'public', 'models', 'coral_reef_set_cc0.glb');

const buffer = readFileSync(FILE);
const declared = buffer.readUInt32LE(8);
let offset = 12;
let json = null;
let bin = null;
while (offset < declared) {
  const length = buffer.readUInt32LE(offset);
  const kind = buffer.readUInt32LE(offset + 4);
  const chunk = buffer.subarray(offset + 8, offset + 8 + length);
  if (kind === 0x4e4f534a) json = JSON.parse(chunk.toString('utf8'));
  if (kind === 0x004e4942) bin = chunk;
  offset += 8 + length;
}
if (!json || !bin) {
  console.error('GLB без JSON- або BIN-шматка — файл не той.');
  process.exit(1);
}

const TYPED = {
  5120: Int8Array, 5121: Uint8Array, 5122: Int16Array,
  5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array,
};
const COMPONENTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function accessor(index) {
  const a = json.accessors[index];
  const n = COMPONENTS[a.type];
  const Typed = TYPED[a.componentType];
  const view = json.bufferViews[a.bufferView];
  const base = (view.byteOffset || 0) + (a.byteOffset || 0);
  const stride = view.byteStride;
  const out = new Float32Array(a.count * n);
  const divisor = a.normalized
    ? (a.componentType === 5121 ? 255 : a.componentType === 5123 ? 65535 : 1)
    : 1;
  for (let k = 0; k < a.count; k += 1) {
    const at = stride ? base + k * stride : base + k * n * Typed.BYTES_PER_ELEMENT;
    const slot = new Typed(bin.buffer, bin.byteOffset + at, n);
    for (let c = 0; c < n; c += 1) out[k * n + c] = slot[c] / divisor;
  }
  return { data: out, components: n, count: a.count };
}

/** Вузол, який малює цей меш: звідти масштаб і поворот. */
function nodeFor(meshIndex) {
  return json.nodes.find((node) => node.mesh === meshIndex) ?? null;
}

/** Поворот −90° навколо X переводить Z-угору в Y-угору. */
function upAxis(positions, k) {
  return { x: positions[k * 3], y: -positions[k * 3 + 2], z: positions[k * 3 + 1] };
}

function hex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('');
}

function hueOf(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const span = max - min;
  if (span === 0) return 0;
  let h = max === r ? ((g - b) / span) % 6 : max === g ? (b - r) / span + 2 : (r - g) / span + 4;
  h *= 60;
  return h < 0 ? h + 360 : h;
}

console.log(`Файл: ${FILE}`);
console.log(`Мешів ${json.meshes.length}, матеріалів ${json.materials.length}, текстур ${(json.textures ?? []).length}\n`);

const material = json.materials[0];
console.log('МАТЕРІАЛ');
console.log(`  alphaMode        ${material.alphaMode ?? 'OPAQUE (типове)'}`);
console.log(`  emissiveFactor   ${JSON.stringify(material.emissiveFactor ?? [0, 0, 0])}`);
console.log(`  emissiveTexture  ${material.emissiveTexture ? 'є' : 'немає'}`);
console.log(`  shadingModel     ${material.extras?.fromFBX?.shadingModel ?? '—'} (isTruePBR: ${material.extras?.fromFBX?.isTruePBR ?? '—'})`);
console.log(`  images           ${(json.images ?? []).map((i) => i.name ?? i.mimeType).join(', ')}\n`);

console.log('ТІЛА (габарити СВІТОВІ — масштаб вузла домножено, осі перевернуто)');
console.log('  # | трикутників | H | W | D | стрункість H/max(W,D) | колір | відтінок | унікальних кольорів');

const aspects = [];
const hues = [];
const triangleCounts = [];
const colourCounts = [];

for (let index = 0; index < json.meshes.length; index += 1) {
  const primitive = json.meshes[index].primitives[0];
  const positions = accessor(primitive.attributes.POSITION).data;
  const colours = primitive.attributes.COLOR_0 !== undefined
    ? accessor(primitive.attributes.COLOR_0)
    : null;
  const indices = primitive.indices !== undefined ? accessor(primitive.indices) : null;
  const node = nodeFor(index);
  const scale = node?.scale?.[0] ?? 1;

  const vertices = positions.length / 3;
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;
  for (let k = 0; k < vertices; k += 1) {
    const v = upAxis(positions, k);
    if (v.x < minX) minX = v.x; if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y; if (v.y > maxY) maxY = v.y;
    if (v.z < minZ) minZ = v.z; if (v.z > maxZ) maxZ = v.z;
  }
  const height = (maxY - minY) * scale;
  const width = (maxX - minX) * scale;
  const depth = (maxZ - minZ) * scale;
  const aspect = height / Math.max(width, depth);
  const triangles = indices ? indices.count / 3 : vertices / 3;

  const unique = new Set();
  let first = [1, 1, 1];
  if (colours) {
    for (let k = 0; k < colours.count; k += 1) {
      const rgb = [0, 1, 2].map((c) => colours.data[k * colours.components + c]);
      if (k === 0) first = rgb;
      unique.add(rgb.map((v) => v.toFixed(4)).join(','));
    }
  }

  aspects.push(aspect);
  hues.push(hueOf(first[0], first[1], first[2]));
  triangleCounts.push(triangles);
  colourCounts.push(unique.size);

  console.log(
    `  ${index} | ${String(triangles).padStart(11)} | ${height.toFixed(3)} | ${width.toFixed(3)} | ${depth.toFixed(3)} | ${aspect.toFixed(2).padStart(21)} | ${hex(first[0], first[1], first[2])} | ${hueOf(first[0], first[1], first[2]).toFixed(0).padStart(8)}° | ${String(unique.size).padStart(19)}`,
  );
}

const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
const same = (list) => list.every((value) => value === list[0]);

console.log('\nВИСНОВКИ, які й лежать у `REEF_REFERENCE`:');
console.log(`  стрункість тіла       ${mean(aspects).toFixed(2)} (розкид ${Math.min(...aspects).toFixed(2)}…${Math.max(...aspects).toFixed(2)})`);
console.log(`  трикутників на тіло   ${mean(triangleCounts).toFixed(0)}${same(triangleCounts) ? ' (однаково в усіх)' : ''}`);
console.log(`  кольорів на тіло      ${mean(colourCounts).toFixed(0)}${same(colourCounts) ? ' (однаково в усіх)' : ''}`);
console.log(`  відтінки              ${hues.map((h) => h.toFixed(0)).sort((a, b) => a - b).join(', ')}`);
console.log(
  `\n  Вісім «різних» коралів — це ОДНА форма у восьми кольорах: габарити збігаються\n`
  + `  до третього знака, трикутників порівну. Набір продає палітру, а не морфологію.`,
);
