import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildTreeV2Geometry, treeV2Skeleton, treeV2Summary } from './geometry';
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
    expect(model.blossoms.map((b) => b.channel)).toEqual(['red', 'blue', 'green']);
  });
});

describe('дерево v2: меш', () => {
  const model = buildTreeV2Model(read('fixtures/busy.json') as TreeV2Snapshot);
  const geometry = buildTreeV2Geometry(model);

  it('усі числа скінченні, трикутники цілі', () => {
    for (const array of [geometry.wood.positions, geometry.leaves.positions, geometry.blossoms.positions]) {
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

  it('детерміновано: той самий знімок — побітово та сама геометрія', () => {
    const again = buildTreeV2Geometry(buildTreeV2Model(read('fixtures/busy.json') as TreeV2Snapshot));
    expect(Array.from(again.leaves.positions)).toEqual(Array.from(geometry.leaves.positions));
  });
});
