// Аркуші модульних людей (ADR-0239, поправка 2026-11-01): кожен шар кожної
// людини — окремий PNG у `render/assets/doll/` (піксель аркуша — піксель
// малюнка, прозорість лише 0 або 255). Код частин — `render/doll/`.
//
//   node scripts/doll/export.mjs — записати аркуші (тест `render/doll/doll.test.ts` звіряє їх із кодом)
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync, crc32 } from 'node:zlib';
import { resolve } from 'node:path';
import { createServer } from 'vite';

const root = resolve(import.meta.dirname, '../..');
const out = resolve(root, 'src/features/game/life/render/assets/doll');

/** PNG RGBA 8 біт без фільтрів — найпростіший і детермінований. */
export function encodePng({ width, height, data }) {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(tb));
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { layerSheet } = await vite.ssrLoadModule('/src/features/game/life/render/doll/sheet.ts');
  const { DOLLS } = await vite.ssrLoadModule('/src/features/game/life/render/doll/dolls.ts');
  const { DRAWN_LAYERS } = await vite.ssrLoadModule('/src/features/game/life/render/doll/rig.ts');
  mkdirSync(out, { recursive: true });
  for (const d of DOLLS) {
    for (const layer of DRAWN_LAYERS) {
      const file = resolve(out, `${d.name}-${layer}.png`);
      writeFileSync(file, encodePng(layerSheet(d, layer)));
      console.log('записано', file.slice(root.length + 1));
    }
  }
} finally {
  await vite.close();
}
