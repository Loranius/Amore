import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CRYSTAL_FORMS, buildCrystalV2Geometry } from '../crystalV2/geometry';
import { buildCrystalV2Model, type CrystalV2Snapshot } from '../crystalV2/model';
import { TREE_FORMS, buildTreeV2Geometry, treeV2Skeleton, treeV2SpruceSkirts, treeV2WishPoints } from '../treeV2/geometry';
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

  it('ялина за референсом власника: ярусні «спіднички» вужчають догори, гілки сховані, видно стовбур', () => {
    const g = buildTreeV2Geometry(model, 'spruce');
    const p = g.leaves.positions;
    const widthAt = (lo: number, hi: number) => {
      let w = 0;
      for (let i = 0; i < p.length; i += 3) if (p[i + 1]! >= lo && p[i + 1]! < hi) w = Math.max(w, Math.hypot(p[i]!, p[i + 2]!));
      return w;
    };
    const H = model.height;
    expect(widthAt(H * 0.2, H * 0.4)).toBeGreaterThan(widthAt(H * 0.5, H * 0.7));
    expect(widthAt(H * 0.5, H * 0.7)).toBeGreaterThan(widthAt(H * 0.85, H * 1.2));
    // Гостра верхівка над провідником.
    expect(Math.max(...Array.from(p).filter((_, i) => i % 3 === 1))).toBeGreaterThan(H);
    // Нижче першої «спіднички» хвої немає: там видно стовбур.
    expect(Array.from(p).filter((_, i) => i % 3 === 1).every((y) => y > H * 0.06)).toBe(true);
    // Деревина — лише стовбур і коріння: її менше, ніж у дуба з тими ж гілками.
    expect(g.wood.positions.length).toBeLessThan(buildTreeV2Geometry(model, 'oak').wood.positions.length / 2);
  });

  it('ялина: насичений рік — довша лапа «спіднички» в бік своєї гілки', () => {
    const base = buildTreeV2Model(OLD);
    const withFirst = (fertility: number) => ({ ...base, yearBranches: base.yearBranches.map((b, i) => (i === 0 ? { ...b, activity: fertility * 1000, fertility } : b)) });
    const first = base.yearBranches[0]!;
    const toward = (m: typeof base) => {
      const paw = treeV2Skeleton(m, 'spruce').clusters.find((c) => c.key === `y${first.year}:paw`)!;
      const az = Math.atan2(paw.centre[2], paw.centre[0]);
      const p = buildTreeV2Geometry(m, 'spruce').leaves.positions;
      let w = 0;
      for (let i = 0; i < p.length; i += 3) {
        const d = Math.abs(((Math.atan2(p[i + 2]!, p[i]!) - az + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        if (d < 0.2) w = Math.max(w, Math.hypot(p[i]!, p[i + 2]!));
      }
      return w;
    };
    expect(toward(withFirst(1))).toBeGreaterThan(toward(withFirst(0)) * 1.1);
  });

  it('сакура: квітки лежать на гранях листя й розходяться по всій кроні (власник, 2026-10-04: «літають у повітрі»)', () => {
    const g = buildTreeV2Geometry(model, 'sakura');
    const leaf = g.leaves.positions;
    const flowers = treeV2WishPoints(model, 'sakura');
    expect(flowers.length).toBe(model.blossoms.length);
    // Кожна квітка — у центрі однієї з граней листя, а не над ним.
    const centroids: number[][] = [];
    for (let i = 0; i < leaf.length; i += 9) centroids.push([0, 1, 2].map((a) => (leaf[i + a]! + leaf[i + 3 + a]! + leaf[i + 6 + a]!) / 3));
    for (const p of flowers) {
      const gap = Math.min(...centroids.map((c) => Math.hypot(c[0]! - p[0], c[1]! - p[1], c[2]! - p[2])));
      expect(gap).toBeLessThan(1e-4);
    }
    // Рівномірно: жодні дві не злипаються — найближча сусідка щонайменше
    // вдвічі ближча за середню відстань до найближчої.
    const nearest = flowers.map((p, i) => Math.min(...flowers.filter((_, j) => j !== i).map((q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]))));
    const mean = nearest.reduce((a, b) => a + b, 0) / nearest.length;
    expect(Math.min(...nearest)).toBeGreaterThan(mean * 0.5);
    // І по всій кроні: від низу до верху, з усіх боків.
    const ys = flowers.map((p) => p[1]);
    const crown = centroids.map((c) => c[1]!);
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan((Math.max(...crown) - Math.min(...crown)) * 0.5);
    const sides = new Set(flowers.map((p) => Math.floor(((Math.atan2(p[2], p[0]) + Math.PI) / (2 * Math.PI)) * 4) % 4));
    expect(sides.size).toBe(4);
  });

  it('бажання на дереві — за формою: яблука на дубі, квітки на сакурі, шишки на ялині (власник, 2026-10-04)', () => {
    expect(model.blossoms.length).toBeGreaterThan(0);
    const dominant = (form: (typeof TREE_FORMS)[number]) => {
      const c = buildTreeV2Geometry(model, form).wishes.colour;
      let r = 0, g = 0, b = 0;
      for (let i = 0; i < c.length; i += 3) { r += c[i]!; g += c[i + 1]!; b += c[i + 2]!; }
      return [r, g, b].map((v) => v / (c.length / 3)) as [number, number, number];
    };
    const [ar, ag, ab] = dominant('oak');
    expect(ar).toBeGreaterThan(ag + 0.25); // червоні яблука
    expect(ar).toBeGreaterThan(ab + 0.25);
    const [sr, sg] = dominant('sakura');
    expect(sr).toBeGreaterThan(sg + 0.2); // насичено-рожеві пелюстки на блідій кроні
    expect(sr).toBeGreaterThan(0.8);
    const [cr, cg, cb] = dominant('spruce');
    expect(cr).toBeGreaterThan(cb); // коричневі шишки
    expect(Math.max(cr, cg, cb)).toBeLessThan(0.7);
    // Шишка висить на краю лапи — біля вершини «спіднички», не під хвоєю
    // і не в повітрі за нею (власник бачив шишку поза кроною, 2026-10-04).
    const rim = treeV2SpruceSkirts(model, treeV2Skeleton(model, 'spruce').clusters).tris.flat();
    const H = model.height;
    for (const p of treeV2WishPoints(model, 'spruce')) {
      const gap = Math.min(...rim.map((v) => Math.hypot(v[0] - p[0], v[1] - p[1], v[2] - p[2])));
      expect(gap).toBeLessThan(0.12 * H);
      const band = rim.filter((v) => Math.abs(v[1] - p[1]) < 0.1 * H).map((v) => Math.hypot(v[0], v[2]));
      expect(Math.hypot(p[0], p[2])).toBeLessThan(Math.max(...band));
    }
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
