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

describe('скайбокс «Нашого шляху»', () => {
  it('лишається під стелею', () => {
    const { byteLength, document } = readGlb(publicAsset(JOURNEY_SKYBOX_PATH));
    expect(byteLength).toBeLessThan(JOURNEY_SKYBOX_MAX_BYTES);
    expect(triangleCount(document)).toBeLessThanOrEqual(JOURNEY_MAX_TRIANGLES);
  });

  it('везе панораму БЕЗ ВТРАТ — стискання з’їдало колір зірок', () => {
    /*
     * Регрес, який побачив власник, а не тест.
     *
     * Текстура їхала WebP q80 (0.71 МБ замість 8.09). За різкістю втрати не
     * було взагалі — середній модуль градієнта на живому екрані 4.114 проти
     * 4.088. Але WebP підвибирає КОЛІР удвічі, а панорама розтягнута на екрані
     * приблизно втричі: червоні та сині іскри окремих зірок злились у рівний
     * фіолет, і фон почав читатись дешевим.
     *
     * Тому джерело лишається без втрат. Якщо колись з'явиться кодек із
     * повною кольоровістю (4:4:4), його можна буде взяти — але не 4:2:0.
     */
    const { document } = readGlb(publicAsset(JOURNEY_SKYBOX_PATH));
    expect(document.images).toHaveLength(1);
    expect(document.images![0]!.mimeType).toBe('image/png');
    expect(document.extensionsRequired ?? []).not.toContain('EXT_texture_webp');
    expect(document.textures![0]!.source).toBe(0);
  });

  it('тримає роздільність 2048 — на 1536 точкові зірки змазуються', () => {
    const { document, bin } = readGlb(publicAsset(JOURNEY_SKYBOX_PATH));
    const png = imageBytes(document, bin, 0);
    // Сигнатура PNG і габарит із IHDR — перший блок після неї.
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(png.toString('ascii', 12, 16)).toBe('IHDR');
    expect(png.readUInt32BE(16)).toBe(JOURNEY_SKYBOX_TEXTURE_SIZE);
    expect(png.readUInt32BE(20)).toBe(JOURNEY_SKYBOX_TEXTURE_SIZE);
    // Тип 2 — truecolor без палітри. Індексована панорама вбила б колір так
    // само, як це зробила підвибірка.
    expect(png[25]).toBe(2);
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
    // CC-BY вимагає позначати зміни. Обидва асети їдуть незміненими — і саме
    // це має бути написано, а не лишатись здогадом.
    expect(text.match(/^The source GLB is stored unchanged\.$/gm)).toHaveLength(2);
  });
});
