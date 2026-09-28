import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { CrystalV2Snapshot } from '../crystalV2/model';
import { buildReefV2Geometry, reefV2Summary } from './geometry';
import { buildReefV2Model, reefHeadScaleV2 } from './model';

// ============================================================
// Риф v2 = Python-двійник (ADR-0219).
// ------------------------------------------------------------
// Python пише еталон `golden/reef/*.json` (модель + зведення геометрії);
// тут портал мусить порахувати те саме. Далі — догми власника: час —
// головна валюта, ніщо не меншає, минуле не переписується.
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

const BASE: CrystalV2Snapshot = { startDate: '2022-12-26', asOf: '2026-09-27', partners: { red: 2, blue: 1 } };

describe('риф v2 = Python-двійник', () => {
  const fixtures = readdirSync(`${TWIN}fixtures`).filter((name) => name.endsWith('.json')).sort();
  it.each(fixtures)('%s: та сама модель і те саме зведення', (name) => {
    const golden = read(`golden/reef/${name}`);
    const model = buildReefV2Model(read(`fixtures/${name}`) as CrystalV2Snapshot);
    close(JSON.parse(JSON.stringify(model)), golden.model, 2e-6);
    close(reefV2Summary(model), golden.summary, 1.5e-4);
  });
});

describe('риф v2: догми власника', () => {
  it('основа росту — закон голови рифу без змін', () => {
    expect(reefHeadScaleV2(0)).toBe(0.25);
    expect(reefHeadScaleV2(25)).toBe(1);
    expect(reefHeadScaleV2(60)).toBe(1);
  });

  it('час — головна валюта: на порожній історії щороку нова колонія, і нічого не меншає', () => {
    let previous: ReturnType<typeof buildReefV2Model> | null = null;
    for (let year = 2023; year <= 2060; year += 1) {
      const model = buildReefV2Model({ ...BASE, asOf: `${year}-12-27` });
      if (previous) {
        expect(model.radius).toBeGreaterThanOrEqual(previous.radius);
        if (year <= 2047) expect(model.radius).toBeGreaterThan(previous.radius);
        expect(model.colonies.length).toBe(previous.colonies.length + 1);
        previous.colonies.forEach((c, i) => expect(model.colonies[i]!.size).toBeGreaterThanOrEqual(c.size));
      }
      previous = model;
    }
  });

  it('актинія бажання — колір того, хто його виконав', () => {
    const model = buildReefV2Model({
      ...BASE,
      wishes: [
        { id: 1, date: '2024-01-01', ownerId: 1, fulfilledById: 2 },
        { id: 2, date: '2024-02-01', ownerId: 2, fulfilledById: 1 },
        { id: 3, date: '2024-03-01', isShared: true },
      ],
    });
    expect(model.anemones.map((a) => a.channel)).toEqual(['red', 'blue', 'green']);
  });
});

describe('риф v2: меш', () => {
  const model = buildReefV2Model(read('fixtures/busy.json') as CrystalV2Snapshot);
  const geometry = buildReefV2Geometry(model);

  it('усі числа скінченні, трикутники цілі, атрибути на кожну вершину', () => {
    for (const array of [geometry.rock.positions, geometry.corals.positions, geometry.critters.positions, geometry.starfish.positions]) {
      expect(array.length % 9).toBe(0);
      for (const value of array) expect(Number.isFinite(value)).toBe(true);
    }
    const vertices = geometry.corals.positions.length / 3;
    for (const attr of [geometry.corals.tone, geometry.corals.form, geometry.corals.hue, geometry.corals.rise]) {
      expect(attr.length).toBe(vertices);
    }
  });

  it('детерміновано: той самий знімок — побітово та сама геометрія', () => {
    const again = buildReefV2Geometry(buildReefV2Model(read('fixtures/busy.json') as CrystalV2Snapshot));
    expect(Array.from(again.corals.positions)).toEqual(Array.from(geometry.corals.positions));
  });
});
