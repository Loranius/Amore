import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { buildTreeV2Geometry } from '@/engine/species/treeV2/geometry';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { TREE_EMPHASIS, treeV2Frame } from './treeV2Frame';

// Власник, 2026-10-05: «збільш дерево на 20–30% у композиції». Дерево
// малюється на чверть більшим, а кадр камери й острів — з масштабу без
// множника; інакше камера просто відступила б і дерево на екрані лишилось
// тим самим.

const TWIN = fileURLToPath(new URL('../../../../../tools/crystal_twin/', import.meta.url));
const BUSY = JSON.parse(readFileSync(`${TWIN}fixtures/busy.json`, 'utf8')) as CrystalV2Snapshot;

describe('дерево в композиції', () => {
  it('у межах 20–30%: малюється більшим за свій кадр', () => {
    expect(TREE_EMPHASIS).toBeGreaterThanOrEqual(1.2);
    expect(TREE_EMPHASIS).toBeLessThanOrEqual(1.3);
    for (const asOf of [BUSY.asOf, '2032-06-01', '2040-06-01']) {
      const g = buildTreeV2Geometry(buildTreeV2Model({ ...BUSY, asOf } as never));
      const f = treeV2Frame(g);
      const drawn = g.height * f.scale;
      expect(drawn / f.height).toBeCloseTo(TREE_EMPHASIS, 9);
    }
  });
});
