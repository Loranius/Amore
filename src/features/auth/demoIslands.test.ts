import { describe, expect, it } from 'vitest';
import { buildCrystalV2Model } from '@/engine/species/crystalV2/model';
import { buildTreeV2Model } from '@/engine/species/treeV2/model';
import { buildReefV2Model } from '@/engine/species/reefV2/model';
import { demoIslands, demoSnapshot } from './demoIslands';

// ============================================================
// Острівці на тлі входу (ADR-0228): «процедурно генеруються щоразу».
// Тести тримають: є всі три види, різні зерна дають різні острівці, те
// саме зерно — той самий, і кожна вигадана історія справді вирощує вид.
// ============================================================

describe('острівці на тлі входу', () => {
  it('завжди три — кристал, дерево й риф, кожен по разу', () => {
    for (const seed of ['a', 'b', 'c', 'd']) {
      expect(demoIslands(seed, 2026).map((i) => i.species).sort()).toEqual(['crystal', 'reef', 'tree']);
    }
  });

  it('різні зерна — різні острівці; те саме зерно — ті самі', () => {
    expect(demoIslands('x1', 2026)).toEqual(demoIslands('x1', 2026));
    const starts = new Set(['x1', 'x2', 'x3', 'x4', 'x5'].map((s) => demoSnapshot(s, 2026).startDate));
    expect(starts.size).toBeGreaterThan(3);
  });

  it('історія не заглядає в майбутнє й не старша за дванадцять років', () => {
    for (const seed of ['p', 'q', 'r', 's', 't']) {
      const snap = demoSnapshot(seed, 2026);
      expect(snap.startDate < snap.asOf).toBe(true);
      expect(Number(snap.startDate.slice(0, 4))).toBeGreaterThanOrEqual(2014);
      for (const item of [...(snap.memories ?? []), ...(snap.wishes ?? [])]) expect(item.date! <= snap.asOf).toBe(true);
    }
  });

  it('кожна вигадана історія вирощує справжній вид тими самими моделями', () => {
    for (const island of demoIslands('grow', 2026)) {
      const build = { crystal: buildCrystalV2Model, tree: buildTreeV2Model, reef: buildReefV2Model }[island.species];
      expect(() => build(island.snapshot as never)).not.toThrow();
    }
  });
});
