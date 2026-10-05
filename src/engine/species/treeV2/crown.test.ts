import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CrystalV2Snapshot } from '../crystalV2/model';
import { buildTreeV2Geometry, treeV2CrownMasses, treeV2Skeleton, treeV2WishPoints, type TreeV2CrownMass } from './geometry';
import { buildTreeV2Model } from './model';

// ============================================================
// Крона з купок (власник, 2026-10-05, ADR-0237): «6–9 великих кластерів;
// кожен кластер із 4–7 фасетних мас листя; без ідеальних сфер; більше
// вертикальної структури; зелений + золотистий, але золотого менше».
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../tools/crystal_twin/', import.meta.url));
const BUSY = JSON.parse(readFileSync(`${TWIN}fixtures/busy.json`, 'utf8')) as CrystalV2Snapshot;
const OLD = buildTreeV2Model({ ...BUSY, asOf: '2040-06-01' });
const AUTUMN = buildTreeV2Model({ ...BUSY, asOf: '2040-10-15' });

const depth = (p: readonly number[], m: TreeV2CrownMass) => {
  const c = Math.cos(m.turn);
  const s = Math.sin(m.turn);
  const dx = p[0]! - m.centre[0];
  const dz = p[2]! - m.centre[2];
  const ly = p[1]! - m.centre[1];
  const sy = m.scale[1] * (ly < 0 ? 0.8 : 1);
  return Math.hypot((dx * c + dz * s) / m.scale[0], ly / sy, (-dx * s + dz * c) / m.scale[2]);
};

describe('крона з купок', () => {
  it.each(['oak', 'sakura'] as const)('%s, зріле дерево: 6–9 купок по 4–7 мас, маси витягнуті вгору, не кулі', (form) => {
    const { clusters } = treeV2Skeleton(OLD, form);
    const masses = treeV2CrownMasses(OLD, clusters);
    const groups = new Map<number, number>();
    for (const m of masses) groups.set(m.group, (groups.get(m.group) ?? 0) + 1);
    expect(groups.size).toBeGreaterThanOrEqual(6);
    expect(groups.size).toBeLessThanOrEqual(9);
    for (const n of groups.values()) {
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(7);
    }
    for (const m of masses) {
      expect(m.scale[0]).not.toBeCloseTo(m.scale[2], 6);
      // Вертикальна структура (дуб): маса не нижча за 0.82 своєї ширини.
      // Сакура лишається ярусною — її маси пласкіші за формою виду.
      if (form === 'oak') expect(m.scale[1]).toBeGreaterThan(0.82 * Math.min(m.scale[0], m.scale[2]));
    }
    expect(treeV2CrownMasses(OLD, clusters)).toEqual(masses);
  });

  it('молоде дерево — проста крона, старе — складна', () => {
    const young = buildTreeV2Model({ ...BUSY, asOf: BUSY.asOf });
    const groupsOf = (model: typeof OLD) => new Set(treeV2CrownMasses(model, treeV2Skeleton(model, 'oak').clusters).map((m) => m.group)).size;
    expect(groupsOf(young)).toBeLessThanOrEqual(groupsOf(OLD));
  });

  it('кожен кінчик гілки накритий масою: гілка не стирчить голою', () => {
    for (const form of ['oak', 'sakura'] as const) {
      const { clusters } = treeV2Skeleton(OLD, form);
      const masses = treeV2CrownMasses(OLD, clusters);
      for (const c of clusters) expect(Math.min(...masses.map((m) => depth(c.centre, m)))).toBeLessThanOrEqual(0.8 + 1e-9);
    }
  });

  it('яблука бажань на дубі — на поверхні крони, а не всередині купки', () => {
    const { clusters } = treeV2Skeleton(OLD, 'oak');
    const masses = treeV2CrownMasses(OLD, clusters);
    const wishes = treeV2WishPoints(OLD, 'oak');
    expect(wishes.length).toBeGreaterThan(0);
    for (const p of wishes) {
      const nearest = Math.min(...masses.map((m) => depth(p, m)));
      expect(nearest).toBeGreaterThan(0.9);
      expect(nearest).toBeLessThan(1.05);
    }
  });

  it('золота менше: осінь — купками, не більше половини сезонної частки, і не до кінця', () => {
    expect(AUTUMN.autumn).toBeGreaterThan(0.5);
    const g = buildTreeV2Geometry(AUTUMN, 'oak');
    const autumn = Array.from(g.leaves.autumn);
    expect(Math.max(...autumn)).toBeLessThanOrEqual(0.8 + 1e-6);
    const share = autumn.filter((a) => a > 0).length / autumn.length;
    expect(share).toBeLessThan(AUTUMN.autumn);
  });
});
