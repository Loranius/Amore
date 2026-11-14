// Складає смуги pxl у файли гри (ADR-0239):
//   node compose.mjs <тека out від pxl> <куди класти PNG>
// <хто>_<кліп>.png — рядки униз/ліворуч/праворуч/угору, стовпці — кадри.
// <хто>_sheet.png — усе разом у порядку `SHEET_ORDER`: стовпець 0 — стоїть,
// далі хода, біг, стрибок і решта кадрів спокою (`CLIPS` у peopleHd.ts).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync, inflateSync } from 'node:zlib';

const CELL = 92;
const DIRS = ['down', 'left', 'right', 'up'];
const CLIPS = { idle: 4, walk: 6, run: 6, jump: 6 };

// pxl пише індексований PNG без фільтрів, коли кольорів не більше 256.
function decode(buf) {
  let p = 8, w = 0, h = 0, plte = null, trns = null;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('latin1', p + 4, p + 8), body = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') {
      w = body.readUInt32BE(0); h = body.readUInt32BE(4);
      if (body[8] !== 8 || body[9] !== 3 || body[12] !== 0) throw new Error('очікую індексований 8-бітний PNG від pxl');
    }
    if (type === 'PLTE') plte = body;
    if (type === 'tRNS') trns = body;
    if (type === 'IDAT') idat.push(body);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    if (raw[y * (w + 1)] !== 0) throw new Error('очікую рядки без фільтра');
    for (let x = 0; x < w; x += 1) {
      const c = raw[y * (w + 1) + 1 + x], o = (y * w + x) * 4;
      out[o] = plte[c * 3]; out[o + 1] = plte[c * 3 + 1]; out[o + 2] = plte[c * 3 + 2];
      out[o + 3] = trns && c < trns.length ? trns[c] : 255;
    }
  }
  return { w, h, data: out };
}

const TABLE = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function chunk(type, body) {
  const t = Buffer.concat([Buffer.from(type, 'latin1'), body]);
  let c = 0xffffffff;
  for (const x of t) c = TABLE[(c ^ x) & 255] ^ (c >>> 8);
  const len = Buffer.alloc(4), crc = Buffer.alloc(4);
  len.writeUInt32BE(body.length); crc.writeUInt32BE((c ^ 0xffffffff) >>> 0);
  return Buffer.concat([len, t, crc]);
}
function encode(w, h, data) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y += 1) data.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

function blit(dst, dw, src, sx, sy, x, y) {
  for (let r = 0; r < CELL; r += 1) src.data.copy(dst, (y + r) * dw * 4 + x * 4, (sy + r) * src.w * 4 + sx * 4, (sy + r) * src.w * 4 + (sx + CELL) * 4);
}

const [outDir, dest] = process.argv.slice(2);
if (!outDir || !dest) throw new Error('node compose.mjs <out> <куди>');
for (const who of ['girl', 'boy']) {
  const strips = {};
  for (const [clip, n] of Object.entries(CLIPS)) {
    const w = n * CELL, h = DIRS.length * CELL, data = Buffer.alloc(w * h * 4);
    strips[clip] = DIRS.map((dir) => decode(readFileSync(join(outDir, 'anims', `${who}_${clip}_${dir}.png`))));
    strips[clip].forEach((s, row) => { for (let k = 0; k < n; k += 1) blit(data, w, s, k * CELL, 0, k * CELL, row * CELL); });
    writeFileSync(join(dest, `${who}_${clip}.png`), encode(w, h, data));
  }
  // Спершу стоїть + хода (так гра вже читає аркуші), далі біг, стрибок, решта спокою.
  const order = [['idle', 0], ...[0, 1, 2, 3, 4, 5].map((k) => ['walk', k]), ...[0, 1, 2, 3, 4, 5].map((k) => ['run', k]), ...[0, 1, 2, 3, 4, 5].map((k) => ['jump', k]), ['idle', 1], ['idle', 2], ['idle', 3]];
  const w = order.length * CELL, h = DIRS.length * CELL, data = Buffer.alloc(w * h * 4);
  order.forEach(([clip, k], col) => strips[clip].forEach((s, row) => blit(data, w, s, k * CELL, 0, col * CELL, row * CELL)));
  writeFileSync(join(dest, `${who}_sheet.png`), encode(w, h, data));
}
