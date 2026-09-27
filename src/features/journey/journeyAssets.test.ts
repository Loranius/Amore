import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  JOURNEY_LICENSE_PATH,
  JOURNEY_MAX_TRIANGLES,
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

describe('скайбокса «Нашого шляху» більше немає (ADR-0214)', () => {
  /*
   * ВИМОГА ВЛАСНИКА: «при відкритті довго вантажиться фон і в поганій
   * якості». Панорама на 8.5 МБ була і першим, і другим: пара чекала на
   * чорноті, а приїжджала розтягнута втричі. Небо тепер малюється
   * (`journeySky.ts`), і файл не повинен повернутись у збірку тихо —
   * кожен байт `public/` їде на телефон пари.
   */
  it('файлу панорами немає в public/', () => {
    expect(existsSync(publicAsset('models/amore_journey_skybox.glb'))).toBe(false);
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
  it('автор сонця названий, ліцензія вказана', () => {
    const text = readFileSync(publicAsset(JOURNEY_LICENSE_PATH), 'utf8');
    // Обидва асети CC-BY-4.0: без цього файлу ми порушуємо умову.
    // Асет CC-BY-4.0: без цього файлу ми порушуємо умову. Скайбокс пішов
    // (ADR-0214), тож у файлі лишається один асет.
    expect(text.match(/^License: CC-BY-4\.0$/gm)).toHaveLength(1);
    expect(text).toContain('Kasugay');
    // CC-BY вимагає позначати зміни. Сонце їде незміненим — і саме це має
    // бути написано, а не лишатись здогадом.
    expect(text.match(/^The source GLB is stored unchanged\.$/gm)).toHaveLength(1);
  });
});
