import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CRYSTAL_FORMS, buildCrystalV2Geometry } from '../crystalV2/geometry';
import { buildCrystalV2Model, type CrystalV2Snapshot } from '../crystalV2/model';
import { TREE_FORMS, buildTreeV2Geometry, treeV2Roots, treeV2Skeleton, treeV2SpruceSkirts, treeV2WishPoints, treeV2WoodFrames, WOOD_SIDES } from '../treeV2/geometry';
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

  it('деревина без коробів і брусків: грані продовження йдуть з гранями батьківської, переріз круглий (≥8 граней), кінчики закриті (власник, 2026-10-04)', () => {
    for (const form of TREE_FORMS) {
      const { branches } = treeV2Skeleton(model, form);
      const frames = treeV2WoodFrames(branches);
      const dirOf = (b: (typeof branches)[number]) => {
        const d = [b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2]];
        const l = Math.hypot(d[0]!, d[1]!, d[2]!);
        return d.map((x) => x / l);
      };
      const byKey = new Map(branches.map((b) => [b.key, b]));
      for (const b of branches) {
        const a = frames.get(b.key)!;
        const d = dirOf(b);
        // Вісь грані лежить поперек гілки.
        expect(Math.abs(a[0] * d[0]! + a[1] * d[1]! + a[2] * d[2]!)).toBeLessThan(1e-9);
        const dot = b.key.lastIndexOf('.');
        if (dot < 0) continue;
        const parent = byKey.get(b.key.slice(0, dot))!;
        const pa = frames.get(parent.key)!;
        const pd = dirOf(parent);
        // Паралельне перенесення: грань повертається не більше, ніж сама гілка.
        const bend = pd[0]! * d[0]! + pd[1]! * d[1]! + pd[2]! * d[2]!;
        expect(pa[0] * a[0] + pa[1] * a[1] + pa[2] * a[2]).toBeGreaterThanOrEqual(bend - 1e-9);
      }
    }
    // Гілка року біля стовбура — не товща за 0.45 стовбура там: товща
    // читалась брусом («прибери і ці брусочки біля основи гілок»).
    for (const form of TREE_FORMS) {
      const { branches } = treeV2Skeleton(model, form);
      const trunk = branches.filter((b) => b.order === 0);
      // Біля стовбура лежить вихід гілки (`y12~`), якщо він є; інакше сама гілка.
      const keys = new Set(branches.map((x) => x.key));
      for (const b of branches.filter((x) => /^y\d+~$/.test(x.key) || (/^y\d+$/.test(x.key) && !keys.has(`${x.key}~`)))) {
        const seg = trunk.reduce((best, t) => (Math.abs(t.end[1] - b.start[1]) < Math.abs(best.end[1] - b.start[1]) ? t : best));
        expect(b.r0).toBeLessThanOrEqual(seg.r1 * 0.45);
      }
    }
    // Кожна гілка — 2·WOOD_SIDES трикутників боків; корені — 10.
    const oak = buildTreeV2Geometry(model, 'oak');
    const { branches } = treeV2Skeleton(model, 'oak');
    expect(WOOD_SIDES).toBeGreaterThanOrEqual(8);
    // Ковпачок — лише на кінчиках, де гілка не продовжується (на лікті він
    // стирчав тупим кінцем-брусочком); стовбур закритий лише згори.
    const parents = new Set(branches.filter((b) => b.order > 0 && b.key.includes('.')).map((b) => b.key.slice(0, b.key.lastIndexOf('.'))));
    // Вихід гілки зі стовбура (`y12~`) продовжується самою гілкою — не кінчик.
    for (const b of branches) if (b.key.endsWith('~')) parents.add(b.key);
    const trunk = branches.filter((b) => b.order === 0).length;
    const tips = branches.filter((b) => b.order > 0 && !parents.has(b.key)).length + 1;
    expect(oak.wood.positions.length / 9).toBe(branches.length * WOOD_SIDES * 2 + tips * WOOD_SIDES + treeV2Roots(model).length * 10);
    expect(trunk).toBeGreaterThan(1);
  });

  it('квітка сакури тримається за листя: одна точка кріплення на квітку, власного гойдання немає', () => {
    const g = buildTreeV2Geometry(model, 'sakura');
    const points = treeV2WishPoints(model, 'sakura');
    const anchors = new Set<string>();
    for (let i = 0; i < g.wishes.anchor.length; i += 3) anchors.add(Array.from(g.wishes.anchor.slice(i, i + 3)).map((x) => x.toFixed(5)).join(','));
    expect(anchors).toEqual(new Set(points.map((p) => p.map((x) => Math.fround(x).toFixed(5)).join(','))));
    expect(Array.from(g.wishes.sway).every((x) => x === 0)).toBe(true);
    // Кругла квітка: п'ять пелюсток по десять клинців обрису.
    expect(g.wishes.positions.length / 9 / points.length).toBeGreaterThanOrEqual(50);
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
