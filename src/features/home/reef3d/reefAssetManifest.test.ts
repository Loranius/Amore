import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  REEF_BACKDROP_MAX_TRIANGLES,
  REEF_BACKDROP_MODEL_PATH,
  REEF_BACKDROP_SOURCE_MESHES,
  REEF_ROCK_TEXTURE_PATHS,
  REEF_ROCK_TEXTURE_RESOLUTION,
} from './reefAssetManifest';

function publicAsset(path: string): string {
  return fileURLToPath(new URL(`../../../../public/${path}`, import.meta.url));
}

function glbJson(path: string) {
  const buffer = readFileSync(path);
  expect(buffer.toString('ascii', 0, 4)).toBe('glTF');
  const jsonLength = buffer.readUInt32LE(12);
  return {
    byteLength: buffer.length,
    document: JSON.parse(
      buffer.subarray(20, 20 + jsonLength).toString('utf8').replace(/\0+$/, ''),
    ) as {
      accessors?: Array<{ count?: number }>;
      meshes?: Array<{ primitives?: Array<{ indices?: number }> }>;
    },
  };
}

describe('reef CC0 visual assets', () => {
  it('keeps the distant coral set inside its static mobile budget', () => {
    const { byteLength, document } = glbJson(publicAsset(REEF_BACKDROP_MODEL_PATH));
    const meshes = document.meshes ?? [];
    const triangles = meshes.reduce((total, mesh) => total + (mesh.primitives ?? []).reduce(
      (meshTotal, primitive) => {
        const indexCount = primitive.indices === undefined
          ? 0
          : document.accessors?.[primitive.indices]?.count ?? 0;
        return meshTotal + Math.floor(indexCount / 3);
      },
      0,
    ), 0);

    expect(meshes).toHaveLength(REEF_BACKDROP_SOURCE_MESHES);
    expect(triangles).toBeGreaterThan(0);
    expect(triangles).toBeLessThanOrEqual(REEF_BACKDROP_MAX_TRIANGLES);
    expect(byteLength).toBeLessThan(450_000);
  });

  it('ships one compact 1K PBR rock set and its CC0 records', () => {
    expect(REEF_ROCK_TEXTURE_RESOLUTION).toBe(1_024);
    for (const path of Object.values(REEF_ROCK_TEXTURE_PATHS)) {
      const size = statSync(publicAsset(path)).size;
      expect(size).toBeGreaterThan(10_000);
      expect(size).toBeLessThan(500_000);
    }
    expect(readFileSync(publicAsset('models/CORAL_REEF_SET_LICENSE.txt'), 'utf8')).toContain('CC0');
    expect(readFileSync(publicAsset('textures/reef/LICENSE.txt'), 'utf8')).toContain('CC0');
  });
});
