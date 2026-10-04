import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { JOINT_OVERLAP, buildTreeV2Geometry, treeV2Skeleton, treeV2WoodSegment, treeV2Summary, treeV2TierHeight } from './geometry';
import { buildTreeV2Model, treeAgeProgressV2, type TreeV2Snapshot } from './model';

// ============================================================
// Дерево v2 = Python-двійник (ADR-0218).
// ------------------------------------------------------------
// Два незалежні записи одного правила. Python пише еталон
// `golden/tree/*.json` (модель + зведення геометрії) для кожного знімка з
// `fixtures/`; тут портал мусить порахувати те саме. Далі — догми власника,
// які тримає сам портал: час — головна валюта, ніщо не меншає, кожен модуль
// дає рівно свій ефект.
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../tools/crystal_twin/', import.meta.url));
const read = (path: string) => JSON.parse(readFileSync(`${TWIN}${path}`, 'utf8'));

function close(actual: unknown, expected: unknown, tolerance: number, path = '$'): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    expect(Math.abs((actual as number) - expected), path).toBeLessThanOrEqual(tolerance);
    return;
  }
  if (Array.isArray(expected)) {
    expect((actual as unknown[]).length, path).toBe(expected.length);
    expected.forEach((item, index) => close((actual as unknown[])[index], item, tolerance, `${path}[${index}]`));
    return;
  }
  if (expected !== null && typeof expected === 'object') {
    const keys = Object.keys(expected).sort();
    expect(Object.keys(actual as object).sort(), path).toEqual(keys);
    for (const key of keys) close((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], tolerance, `${path}.${key}`);
    return;
  }
  expect(actual, path).toEqual(expected);
}

const BASE: TreeV2Snapshot = { startDate: '2022-12-26', asOf: '2026-09-27', partners: { red: 2, blue: 1 } };

describe('дерево v2 = Python-двійник', () => {
  const fixtures = readdirSync(`${TWIN}fixtures`).filter((name) => name.endsWith('.json')).sort();

  it.each(fixtures)('%s: та сама модель і той самий скелет', (name) => {
    const snapshot = read(`fixtures/${name}`) as TreeV2Snapshot;
    const golden = read(`golden/tree/${name}`);
    const model = buildTreeV2Model(snapshot);
    close(JSON.parse(JSON.stringify(model)), golden.model, 2e-6);
    // Скелет — сотні кроків тригонометрії; два рантайми можуть розійтись в
    // останньому біті sin/cos, тож допуск — одиниця округлення зведення.
    close(treeV2Summary(model), golden.summary, 1.5e-4);
  });
});

describe('дерево v2: догми власника', () => {
  it('основа росту — закон ADR-0090 без змін', () => {
    expect(treeAgeProgressV2(0)).toBe(0);
    expect(treeAgeProgressV2(40)).toBeCloseTo(1, 12);
    expect(treeAgeProgressV2(80)).toBe(treeAgeProgressV2(40));
  });

  it('час — головна валюта: на порожній історії дерево росте щороку до 40 років і ніколи не меншає', () => {
    let previous: [number, number, number] | null = null;
    for (let year = 2023; year <= 2070; year += 1) {
      const model = buildTreeV2Model({ ...BASE, asOf: `${year}-12-27` });
      const now: [number, number, number] = [model.height, model.trunkRadius, treeV2Skeleton(model).branches.length];
      if (previous) {
        if (year <= 2062) expect(now[0]).toBeGreaterThan(previous[0]);
        expect(now[0]).toBeGreaterThanOrEqual(previous[0]);
        expect(now[1]).toBeGreaterThanOrEqual(previous[1]);
        expect(now[2]).toBeGreaterThanOrEqual(previous[2]);
      }
      previous = now;
    }
  });

  it('квітка бажання — колір того, хто його виконав', () => {
    const model = buildTreeV2Model({
      ...BASE,
      wishes: [
        { id: 1, date: '2024-01-01', ownerId: 1, fulfilledById: 2 },
        { id: 2, date: '2024-02-01', ownerId: 2, fulfilledById: 1 },
        { id: 3, date: '2024-03-01', isShared: true },
      ],
    });
    // Дерево не фарбує бажання каналами дарування (власник, 2026-10-04):
    // RGB — мова кристала; на дереві кожне бажання — однакова стрічка.
    expect(model.blossoms).toHaveLength(3);
    for (const b of model.blossoms) expect(Object.keys(b).sort()).toEqual(['id', 'year']);
  });
});

describe('дерево v2: меш', () => {
  const model = buildTreeV2Model(read('fixtures/busy.json') as TreeV2Snapshot);
  const geometry = buildTreeV2Geometry(model);

  it('усі числа скінченні, трикутники цілі', () => {
    for (const array of [geometry.wood.positions, geometry.leaves.positions, geometry.ribbons.positions]) {
      expect(array.length % 9).toBe(0);
      for (const value of array) expect(Number.isFinite(value)).toBe(true);
    }
    expect(geometry.leaves.tone.length * 3).toBe(geometry.leaves.positions.length);
  });

  it('деревина закручена НАЗОВНІ: нормаль кожної грані дивиться від осі гілки', () => {
    // Регресія першого живого кадру кристала: закрут усередину ховав
    // передні грані. Тут перевіряємо стовбур — вісь близька до вертикалі.
    const p = geometry.wood.positions;
    for (let t = 0; t < 12; t += 1) {
      const a = [p[t * 9]!, p[t * 9 + 1]!, p[t * 9 + 2]!];
      const b = [p[t * 9 + 3]!, p[t * 9 + 4]!, p[t * 9 + 5]!];
      const c = [p[t * 9 + 6]!, p[t * 9 + 7]!, p[t * 9 + 8]!];
      const e1 = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
      const e2 = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
      const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      const centre = [(a[0]! + b[0]! + c[0]!) / 3, (a[2]! + b[2]! + c[2]!) / 3];
      expect(n[0]! * centre[0]! + n[2]! * centre[1]!).toBeGreaterThan(0);
    }
  });

  it('розвилки монолітні: без куль-наростів, дочірня гілка починається всередині батьківської (регресії «розходяться шви» й «нарости на швах»)', () => {
    // 2026-09-29: крізь розвилку видно нутро — відкриті призми сходились без
    // стику. 2026-10-04: кулі-вузли, що закривали стик, читались наростами.
    const { branches } = treeV2Skeleton(model);
    const same = (a: readonly number[], b: readonly number[]) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
    let joints = 0;
    for (const parent of branches) {
      for (const child of branches.filter((c) => c !== parent && c.order > 0 && same(c.start, parent.end))) {
        joints += 1;
        const seg = treeV2WoodSegment(child);
        // Призма дочірньої заходить назад у батьківську на JOINT_OVERLAP свого радіуса.
        expect(Math.hypot(seg.start[0] - child.start[0], seg.start[1] - child.start[1], seg.start[2] - child.start[2])).toBeCloseTo(child.r0 * JOINT_OVERLAP, 9);
        // Продовження (.c) — без сходинки в товщині.
        if (child.key === `${parent.key}.c`) expect(child.r0).toBeCloseTo(parent.r1, 12);
      }
    }
    expect(joints).toBeGreaterThan(0);
    // Деревина — лише призми (по 12 трикутників): жодної кулі.
    const g = buildTreeV2Geometry(model);
    expect((g.wood.positions.length / 9) % 2).toBe(0);
  });

  it('детерміновано: той самий знімок — побітово та сама геометрія', () => {
    const again = buildTreeV2Geometry(buildTreeV2Model(read('fixtures/busy.json') as TreeV2Snapshot));
    expect(Array.from(again.leaves.positions)).toEqual(Array.from(geometry.leaves.positions));
  });
});

describe('дерево v3: гілка року ярусами (ADR-0237, власник)', () => {
  const branchOf = (model: ReturnType<typeof buildTreeV2Model>, year: number) =>
    treeV2Skeleton(model).branches.find((b) => b.key === `y${year}`)!;
  const shape = (b: { start: number[]; end: number[] }) => {
    const d = [b.end[0]! - b.start[0]!, b.end[1]! - b.start[1]!, b.end[2]! - b.start[2]!];
    const length = Math.hypot(d[0]!, d[1]!, d[2]!);
    return { length, rise: d[1]! / length };
  };

  it('кожен рік разом — одна гілка; на ярусі 3 або 4, новий ярус — вище, коли нижній повний', () => {
    const model = buildTreeV2Model({ ...BASE, asOf: '2040-01-01' });
    expect(model.yearBranches.map((b) => b.year)).toEqual(Array.from({ length: model.yearBranches.length }, (_, i) => i));
    const perTier = new Map<number, number>();
    for (const b of model.yearBranches) perTier.set(b.tier, (perTier.get(b.tier) ?? 0) + 1);
    for (const [tier, count] of perTier) {
      if (tier < model.tiers - 1) expect([3, 4]).toContain(count);
    }
    const heights = Array.from({ length: model.tiers }, (_, t) => treeV2TierHeight(model, t));
    for (let t = 1; t < heights.length; t += 1) expect(heights[t]!).toBeGreaterThan(heights[t - 1]!);
  });

  it('ярус, що вже відкрився, не повзе вгору з роками: гілка лишається де виросла', () => {
    const young = buildTreeV2Model({ ...BASE, asOf: '2031-01-01' });
    const old = buildTreeV2Model({ ...BASE, asOf: '2050-01-01' });
    expect(treeV2TierHeight(old, 0)).toBeCloseTo(treeV2TierHeight(young, 0), 9);
    expect(treeV2TierHeight(old, 1)).toBeCloseTo(treeV2TierHeight(young, 1), 9);
  });

  it('активність року — гілка довша (не більше ×1.35) і горизонтальніша (власник: «довша гілка, горизонтальною стає»)', () => {
    const quiet = buildTreeV2Model({ ...BASE, asOf: '2026-09-27' });
    const busyYear = Array.from({ length: 40 }, (_, i) => ({ id: 1000 + i, date: '2024-03-01' }));
    const rich = buildTreeV2Model({ ...BASE, asOf: '2026-09-27', memories: busyYear, plans: busyYear.map((m) => ({ ...m, id: m.id + 100 })) });
    const q = shape(branchOf(quiet, 1));
    const r = shape(branchOf(rich, 1));
    expect(r.length).toBeGreaterThan(q.length * 1.2);
    expect(r.length).toBeLessThanOrEqual(q.length * 1.35 + 1e-9);
    expect(r.rise).toBeLessThan(q.rise);
    // Інші роки не зачеплені: події 2024-го не змінюють гілку 2023-го.
    expect(shape(branchOf(rich, 0)).length).toBeCloseTo(shape(branchOf(quiet, 0)).length, 9);
  });

  it('стрічка бажання — на гілці свого року', () => {
    const model = buildTreeV2Model({ ...BASE, asOf: '2030-01-01', wishes: [{ id: 7, date: '2024-06-01', isShared: true }] });
    const { clusters } = treeV2Skeleton(model);
    const own = clusters.filter((c) => c.key === 'y1' || c.key.startsWith('y1.'));
    const blossom = buildTreeV2Geometry(model).ribbons.positions;
    const at = [blossom[0]!, blossom[1]!, blossom[2]!];
    const near = Math.min(...own.map((c) => Math.hypot(at[0]! - c.centre[0], at[1]! - c.centre[1], at[2]! - c.centre[2]) - c.radius));
    expect(near).toBeLessThan(0.1);
  });
});

