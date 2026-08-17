import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  JOURNEY_LICENSE_PATH,
  JOURNEY_MAX_TRIANGLES,
  JOURNEY_SKYBOX_MAX_BYTES,
  JOURNEY_SKYBOX_PATH,
  JOURNEY_SKYBOX_TEXTURE_SIZE,
  JOURNEY_SUN_MAX_BYTES,
  JOURNEY_SUN_PATH,
} from './journeyAssets';

function publicAsset(path: string): string {
  return fileURLToPath(new URL(`../../../public/${path}`, import.meta.url));
}

interface GlbDocument {
  images?: Array<{ bufferView: number; mimeType?: string }>;
  bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
  accessors?: Array<{ count?: number }>;
  meshes?: Array<{ primitives?: Array<{ indices?: number }> }>;
  materials?: Array<{ doubleSided?: boolean }>;
  extensionsUsed?: string[];
  extensionsRequired?: string[];
  textures?: Array<{ source?: number; extensions?: Record<string, { source: number }> }>;
}

/** Читає контейнер напряму — без three, без DOM, без завантажувача. */
function readGlb(path: string): { byteLength: number; document: GlbDocument; bin: Buffer } {
  const buffer = readFileSync(path);
  expect(buffer.toString('ascii', 0, 4)).toBe('glTF');
  const total = buffer.readUInt32LE(8);
  let offset = 12;
  let document: GlbDocument | null = null;
  let bin: Buffer | null = null;
  while (offset < total) {
    const length = buffer.readUInt32LE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'JSON') document = JSON.parse(body.toString('utf8').replace(/\0+$/, ''));
    if (type === 'BIN\0') bin = Buffer.from(body);
    offset += 8 + length;
  }
  expect(document).not.toBeNull();
  expect(bin).not.toBeNull();
  return { byteLength: buffer.length, document: document!, bin: bin! };
}

function triangleCount(document: GlbDocument): number {
  return (document.meshes ?? []).reduce(
    (total, mesh) => total + (mesh.primitives ?? []).reduce((sum, primitive) => {
      const count = primitive.indices === undefined
        ? 0
        : document.accessors?.[primitive.indices]?.count ?? 0;
      return sum + Math.floor(count / 3);
    }, 0),
    0,
  );
}

function imageBytes(document: GlbDocument, bin: Buffer, index: number): Buffer {
  const view = document.bufferViews![document.images![index]!.bufferView]!;
  const start = view.byteOffset ?? 0;
  return bin.subarray(start, start + view.byteLength);
}

/**
 * Габарит WebP із контейнера RIFF.
 *
 * Три форми, і всі три треба знати: `VP8 ` (з втратами), `VP8L` (без втрат) і
 * `VP8X` (розширений — саме його віддає Chromium, бо дописує профіль ICC).
 */
function webpCanvas(webp: Buffer): { width: number; height: number; fourcc: string } {
  expect(webp.toString('ascii', 0, 4)).toBe('RIFF');
  expect(webp.toString('ascii', 8, 12)).toBe('WEBP');
  const fourcc = webp.toString('ascii', 12, 16);
  if (fourcc === 'VP8X') {
    return {
      fourcc,
      width: (webp.readUIntLE(24, 3) & 0xffffff) + 1,
      height: (webp.readUIntLE(27, 3) & 0xffffff) + 1,
    };
  }
  if (fourcc === 'VP8L') {
    const bits = webp.readUInt32LE(21);
    return { fourcc, width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  expect(fourcc).toBe('VP8 ');
  expect(webp.readUInt32LE(23) & 0x00ffffff).toBe(0x2a019d); // ключовий кадр
  return {
    fourcc,
    width: webp.readUInt16LE(26) & 0x3fff,
    height: webp.readUInt16LE(28) & 0x3fff,
  };
}

describe('скайбокс «Нашого шляху»', () => {
  it('лишається під стелею, заради якої його перетискали', () => {
    const { byteLength, document } = readGlb(publicAsset(JOURNEY_SKYBOX_PATH));
    // Оригінал зі Sketchfab важив 8 511 640 байтів — понад вісім мегабайтів
    // однією PNG. Якщо тут знову з'явиться щось таке, це має падати.
    expect(byteLength).toBeLessThan(JOURNEY_SKYBOX_MAX_BYTES);
    expect(triangleCount(document)).toBeLessThanOrEqual(JOURNEY_MAX_TRIANGLES);
  });

  it('везе панораму саме як WebP і саме через розширення', () => {
    const { document } = readGlb(publicAsset(JOURNEY_SKYBOX_PATH));
    expect(document.images).toHaveLength(1);
    expect(document.images![0]!.mimeType).toBe('image/webp');
    // Запасної PNG немає, тож розширення мусить бути ОБОВ'ЯЗКОВИМ: інакше
    // завантажувач без його підтримки мовчки дістав би текстуру без джерела.
    expect(document.extensionsUsed).toContain('EXT_texture_webp');
    expect(document.extensionsRequired).toContain('EXT_texture_webp');
    const texture = document.textures![0]!;
    expect(texture.source).toBeUndefined();
    expect(texture.extensions?.EXT_texture_webp?.source).toBe(0);
  });

  it('тримає роздільність 2048 — на 1536 точкові зірки змазуються', () => {
    const { document, bin } = readGlb(publicAsset(JOURNEY_SKYBOX_PATH));
    const webp = imageBytes(document, bin, 0);
    const { width, height, fourcc } = webpCanvas(webp);
    expect(width).toBe(JOURNEY_SKYBOX_TEXTURE_SIZE);
    expect(height).toBe(JOURNEY_SKYBOX_TEXTURE_SIZE);
    // VP8L — це WebP БЕЗ втрат, і на зоряному шумі він важить як PNG. Якщо
    // текстуру колись перезберуть у ньому, стеля ваги впаде разом із цим.
    expect(fourcc).not.toBe('VP8L');
  });

  it('лишається двостороннім — камера дивиться зсередини сфери', () => {
    const { document } = readGlb(publicAsset(JOURNEY_SKYBOX_PATH));
    expect(document.materials![0]!.doubleSided).toBe(true);
  });
});

describe('сонце «Нашого шляху»', () => {
  it('везе власну текстуру й лишається дрібним', () => {
    const { byteLength, document } = readGlb(publicAsset(JOURNEY_SUN_PATH));
    expect(byteLength).toBeLessThan(JOURNEY_SUN_MAX_BYTES);
    expect(triangleCount(document)).toBeLessThanOrEqual(JOURNEY_MAX_TRIANGLES);
    expect(document.images).toHaveLength(1);
  });
});

describe('атрибуція', () => {
  it('обидва автори названі, обидві ліцензії вказані', () => {
    const text = readFileSync(publicAsset(JOURNEY_LICENSE_PATH), 'utf8');
    // Обидва асети CC-BY-4.0: без цього файлу ми порушуємо умову.
    expect(text.match(/^License: CC-BY-4\.0$/gm)).toHaveLength(2);
    expect(text).toContain('alexandr.melas');
    expect(text).toContain('Kasugay');
    expect(text).toContain('EXT_texture_webp');
  });
});
