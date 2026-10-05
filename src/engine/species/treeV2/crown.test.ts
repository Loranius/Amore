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

describe('романтика дозовано і ріст складніший з роками', () => {
  it('квіток між листям дуба до шести років немає, у зрілого — кілька (до 14)', async () => {
    const { treeV2CrownFlowerCount } = await import('./geometry');
    expect(treeV2CrownFlowerCount({ ...OLD, years: 5.9 })).toBe(0);
    expect(treeV2CrownFlowerCount({ ...OLD, years: 6 })).toBe(3);
    expect(treeV2CrownFlowerCount({ ...OLD, years: 40 })).toBe(14);
    // Квітки додають трикутники до шару бажань: зрілий дуб має їх більше,
    // ніж сам по собі дав би лише плід-серце на кожне бажання.
    const g = buildTreeV2Geometry(OLD, 'oak');
    const young = buildTreeV2Geometry({ ...OLD, years: 5 }, 'oak');
    expect(g.wishes.positions.length - young.wishes.positions.length).toBe(treeV2CrownFlowerCount(OLD) * 15 * 9);
  });

  it('плід бажання на дубі — серце: западинка вгорі, вістря внизу', () => {
    const model = buildTreeV2Model({ ...BUSY, asOf: '2030-01-01', wishes: [{ id: 7, date: '2024-06-01', isShared: true }] });
    const g = buildTreeV2Geometry(model, 'oak');
    const p = treeV2WishPoints(model, 'oak')[0]!;
    // Перші 80·3 вершини — тіло серця.
    const ys: number[] = [];
    const xs: number[] = [];
    for (let i = 0; i < 240; i += 1) {
      ys.push(g.wishes.positions[i * 3 + 1]!);
      xs.push(Math.hypot(g.wishes.positions[i * 3]! - p[0], g.wishes.positions[i * 3 + 2]! - p[2]));
    }
    const top = Math.max(...ys);
    const bottom = Math.min(...ys);
    // Вістря — одна точка внизу; угорі — дві лопаті, між ними западинка.
    const nearBottom = xs.filter((_, i) => ys[i]! < bottom + (top - bottom) * 0.05);
    expect(Math.max(...nearBottom)).toBeLessThan((top - bottom) * 0.15);
    const width = Math.max(...xs);
    expect(width).toBeGreaterThan((top - bottom) * 0.4);
  });
});

describe('стовбур без щілин (власник, 2026-10-06: «тріщини, які просвітлюють дерево зсередини»)', () => {
  it.each(['oak', 'sakura', 'spruce'] as const)('%s: бічна поверхня стовбура — суцільна труба, відкриті лише низ і верх', async (form) => {
    const { WOOD_SIDES } = await import('./geometry');
    const g = buildTreeV2Geometry(OLD, form);
    const trunk = treeV2Skeleton(OLD, form).branches.filter((b) => b.order === 0);
    // Стовбур у буфері перший: по 2·WOOD_SIDES бічних трикутників на сегмент,
    // а за непродовженим (верхнім) сегментом — ковпачок.
    const edges = new Map<string, number>();
    const key = (i: number) => [0, 1, 2].map((c) => g.wood.positions[i * 3 + c]!.toFixed(5)).join(',');
    let tri = 0;
    for (let s = 0; s < trunk.length; s += 1) {
      for (let k = 0; k < 2 * WOOD_SIDES; k += 1, tri += 1) {
        const v = [key(tri * 3), key(tri * 3 + 1), key(tri * 3 + 2)];
        for (const [a, b] of [[v[0], v[1]], [v[1], v[2]], [v[2], v[0]]] as const) {
          const e = a! < b! ? `${a}|${b}` : `${b}|${a}`;
          edges.set(e, (edges.get(e) ?? 0) + 1);
        }
      }
      if (s === trunk.length - 1) break;
    }
    // Відкриті ребра (належать одному трикутнику) — лише нижнє й верхнє кільце.
    const open = [...edges.values()].filter((n) => n === 1).length;
    expect(open).toBe(2 * WOOD_SIDES);
  });
});
