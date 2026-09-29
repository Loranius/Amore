import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CRYSTAL_FORMS, buildCrystalV2Geometry } from '../crystalV2/geometry';
import { buildCrystalV2Model, type CrystalV2Snapshot } from '../crystalV2/model';
import { TREE_FORMS, buildTreeV2Geometry, treeV2Skeleton } from '../treeV2/geometry';
import { buildTreeV2Model } from '../treeV2/model';

// ============================================================
// Форми виду (ADR-0237 §4.3): «той самий ріст, інший малюнок».
//   * модель одна на всі форми — форма її не бачить;
//   * кожна форма дає скінченну, детерміновану геометрію;
//   * форма читається силуетом: ялина — конус, сакура — розлога,
//     сталагміт — найширший біля основи.
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../tools/crystal_twin/', import.meta.url));
const BUSY = JSON.parse(readFileSync(`${TWIN}fixtures/busy.json`, 'utf8')) as CrystalV2Snapshot;
const OLD: CrystalV2Snapshot = { ...BUSY, asOf: '2040-06-01' };

const finite = (array: Float32Array) => array.every((v) => Number.isFinite(v));

describe('форми дерева: той самий ріст, інший малюнок', () => {
  const model = buildTreeV2Model(OLD);

  it.each(TREE_FORMS)('%s: скінченна й детермінована геометрія, гілка на кожен рік', (form) => {
    const g = buildTreeV2Geometry(model, form);
    expect(finite(g.wood.positions) && finite(g.leaves.positions)).toBe(true);
    expect(Array.from(buildTreeV2Geometry(buildTreeV2Model(OLD), form).leaves.positions)).toEqual(Array.from(g.leaves.positions));
    const keys = new Set(treeV2Skeleton(model, form).branches.map((b) => b.key));
    for (const yb of model.yearBranches) expect(keys.has(`y${yb.year}`)).toBe(true);
  });

  it('ялина — конус: гілки верхнього ярусу коротші за нижні; осені в неї немає', () => {
    const { branches } = treeV2Skeleton(model, 'spruce');
    const len = (key: string) => {
      const b = branches.find((x) => x.key === key)!;
      return Math.hypot(b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2]);
    };
    const lowest = model.yearBranches.filter((b) => b.tier === 0).map((b) => len(`y${b.year}`));
    const highest = model.yearBranches.filter((b) => b.tier === model.tiers - 1).map((b) => len(`y${b.year}`));
    expect(Math.max(...highest)).toBeLessThan(Math.min(...lowest));
    expect(buildTreeV2Geometry({ ...model, autumn: 0.7 }, 'spruce').leaves.autumn.every((a) => a === 0)).toBe(true);
  });

  it('сакура — розлога: крона ширша, ніж у дуба, а дерево нижче', () => {
    const oak = buildTreeV2Geometry(model, 'oak');
    const sakura = buildTreeV2Geometry(model, 'sakura');
    expect(sakura.crownRadius).toBeGreaterThan(oak.crownRadius);
    const top = (g: typeof oak) => Math.max(...Array.from(g.leaves.positions).filter((_, i) => i % 3 === 1));
    expect(top(sakura)).toBeLessThan(top(oak));
  });
});

describe('форми кристала', () => {
  const model = buildCrystalV2Model(OLD);

  it.each(CRYSTAL_FORMS)('%s: скінченна й детермінована геометрія', (form) => {
    const g = buildCrystalV2Geometry(model, form);
    expect(finite(g.crystals.positions)).toBe(true);
    expect(g.crystals.positions.length % 9).toBe(0);
    expect(Array.from(buildCrystalV2Geometry(buildCrystalV2Model(OLD), form).crystals.positions)).toEqual(Array.from(g.crystals.positions));
  });

  it('сталагміт найширший біля основи й звужується до кінчика', () => {
    const alone = buildCrystalV2Geometry({ ...model, children: [] }, 'stalagmite').crystals.positions;
    const widthAt = (lo: number, hi: number) => {
      let w = 0;
      for (let i = 0; i < alone.length; i += 3) {
        const y = alone[i + 1]!;
        if (y >= lo && y < hi) w = Math.max(w, Math.hypot(alone[i]!, alone[i + 2]!));
      }
      return w;
    };
    const h = model.monarch.height;
    expect(widthAt(-1, h * 0.2)).toBeGreaterThan(widthAt(h * 0.4, h * 0.6));
    expect(widthAt(h * 0.4, h * 0.6)).toBeGreaterThan(widthAt(h * 0.8, h * 1.01));
  });

  it('друза — теперішній кристал без змін: форма за замовчуванням', () => {
    expect(Array.from(buildCrystalV2Geometry(model).crystals.positions)).toEqual(Array.from(buildCrystalV2Geometry(model, 'druse').crystals.positions));
  });
});
