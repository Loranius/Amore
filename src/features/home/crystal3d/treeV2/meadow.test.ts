import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { buildTreeV2Geometry } from '@/engine/species/treeV2/geometry';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { grassInstances, tuckGrassUnderCanopy } from './meadow';

// ============================================================
// Власник, 2026-10-04: «через текстури ялинки проходять зелені смужки,
// схожі на траву — прибери». Травинка не сміє бути вищою за хвою над собою.
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../../tools/crystal_twin/', import.meta.url));
const BUSY = JSON.parse(readFileSync(`${TWIN}fixtures/busy.json`, 'utf8')) as CrystalV2Snapshot;
const model = buildTreeV2Model(BUSY);
const SCALE = 0.3;

describe('трава під кроною', () => {
  it('жодна травинка не проколює нижні «спіднички» ялини', () => {
    const leaves = buildTreeV2Geometry(model, 'spruce').leaves.positions;
    const grass = tuckGrassUnderCanopy(grassInstances('2022-12-26', 0.25, 1.1), leaves, SCALE);
    for (const g of grass) {
      const d = Math.hypot(g.x, g.z);
      for (let i = 0; i < leaves.length; i += 3) {
        const r = Math.hypot(leaves[i]!, leaves[i + 2]!) * SCALE;
        if (Math.abs(r - d) < 0.05) expect(g.scale).toBeLessThan(leaves[i + 1]! * SCALE);
      }
    }
  });

  it('поза кроною трава та сама: стрижемо лише під хвоєю', () => {
    const leaves = buildTreeV2Geometry(model, 'spruce').leaves.positions;
    let reach = 0;
    for (let i = 0; i < leaves.length; i += 3) reach = Math.max(reach, Math.hypot(leaves[i]!, leaves[i + 2]!) * SCALE);
    const before = grassInstances('2022-12-26', 0.25, 1.1);
    const after = tuckGrassUnderCanopy(before, leaves, SCALE);
    const outside = before.map((g, i) => [g, after[i]!] as const).filter(([g]) => Math.hypot(g.x, g.z) > reach + 0.1);
    expect(outside.length).toBeGreaterThan(20);
    for (const [g, a] of outside) expect(a).toBe(g);
  });
});
