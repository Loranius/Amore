import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  PORTAL_FLOOR_MAX_ANISOTROPY,
  PORTAL_FLOOR_TEXTURE_FILES,
  PORTAL_FLOOR_TEXTURE_RESOLUTION,
  portalFloorAnisotropy,
} from './platformTexture';

function portalAsset(path: string): string {
  return fileURLToPath(new URL(`../../../../assets/portal/${path}`, import.meta.url));
}

function lossyWebpDimensions(bytes: Buffer): readonly [number, number] {
  expect(bytes.toString('ascii', 12, 16)).toBe('VP8 ');
  expect(bytes.subarray(23, 26)).toEqual(Buffer.from([0x9d, 0x01, 0x2a]));
  return [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
}

describe('portal floor PBR assets', () => {
  it('ships a complete compact WebP set for mobile GPUs', () => {
    expect(PORTAL_FLOOR_TEXTURE_RESOLUTION).toBe(512);

    let totalBytes = 0;
    for (const filename of PORTAL_FLOOR_TEXTURE_FILES) {
      const path = portalAsset(filename);
      const bytes = readFileSync(path);
      totalBytes += statSync(path).size;

      expect(bytes.toString('ascii', 0, 4), filename).toBe('RIFF');
      expect(bytes.toString('ascii', 8, 12), filename).toBe('WEBP');
      expect(lossyWebpDimensions(bytes), filename).toEqual([
        PORTAL_FLOOR_TEXTURE_RESOLUTION,
        PORTAL_FLOOR_TEXTURE_RESOLUTION,
      ]);
      expect(bytes.length, filename).toBeGreaterThan(1_000);
      expect(bytes.length, filename).toBeLessThan(64_000);
    }

    expect(totalBytes).toBeLessThan(128_000);
  });

  it('keeps the source and CC0 transformation record beside the maps', () => {
    const license = readFileSync(portalAsset('FLOOR_STONE_LICENSE.txt'), 'utf8');
    expect(license).toContain('Floor Tiles 04');
    expect(license).toContain('Rob Tuytel');
    expect(license).toContain('CC0 1.0');
    expect(license).toContain('polyhaven.com/ar/a/floor_tiles_04');
  });

  it('uses the renderer limit but never requests costly desktop sampling', () => {
    expect(PORTAL_FLOOR_MAX_ANISOTROPY).toBe(8);
    expect(portalFloorAnisotropy(16)).toBe(8);
    expect(portalFloorAnisotropy(6.9)).toBe(6);
    expect(portalFloorAnisotropy(1)).toBe(1);
    expect(portalFloorAnisotropy(0)).toBe(1);
    expect(portalFloorAnisotropy(Number.NaN)).toBe(1);
    expect(portalFloorAnisotropy(Number.POSITIVE_INFINITY)).toBe(1);
  });
});
