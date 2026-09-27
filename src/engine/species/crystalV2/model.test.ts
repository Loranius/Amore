import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hash32 } from './hash';
import { buildCrystalV2Model, type CrystalV2Snapshot } from './model';

// ============================================================
// Звірка з Python-двійником (ADR-0217).
// ------------------------------------------------------------
// Два незалежні записи одного правила: TypeScript тут і Python у
// `tools/crystal_twin`. Python записує еталон (`golden/*.json`) для кожного
// знімка з `fixtures/`; цей тест вимагає, щоб портал порахував те саме.
// Розбіжність — це помилка в одному з записів, і тест не каже в якому:
// саме тому їх два.
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../tools/crystal_twin/', import.meta.url));
const read = (path: string) => JSON.parse(readFileSync(`${TWIN}${path}`, 'utf8'));

/** Рівність із допуском на останній біт log/exp у двох рантаймах. */
function close(actual: unknown, expected: unknown, path = '$'): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    expect(Math.abs((actual as number) - expected), path).toBeLessThanOrEqual(2e-6);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), path).toBe(true);
    expect((actual as unknown[]).length, path).toBe(expected.length);
    expected.forEach((item, index) => close((actual as unknown[])[index], item, `${path}[${index}]`));
    return;
  }
  if (expected !== null && typeof expected === 'object') {
    const keys = Object.keys(expected).sort();
    expect(Object.keys(actual as object).sort(), path).toEqual(keys);
    for (const key of keys) close((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], `${path}.${key}`);
    return;
  }
  expect(actual, path).toEqual(expected);
}

describe('кристал v2 = Python-двійник', () => {
  const fixtures = readdirSync(`${TWIN}fixtures`).filter((name) => name.endsWith('.json')).sort();

  it('знімків для звірки досить, щоб вона щось означала', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(4);
  });

  it.each(fixtures)('%s: та сама модель, що в Python', (name) => {
    const snapshot = read(`fixtures/${name}`) as CrystalV2Snapshot;
    const golden = read(`golden/${name}`);
    close(JSON.parse(JSON.stringify(buildCrystalV2Model(snapshot))), golden);
  });

  it('хеш побітово той самий (еталонні значення — ті самі, що в Python-тесті)', () => {
    expect(hash32('')).toBe(2872998923);
    expect(hash32('amore')).toBe(1425516499);
    // UTF-8, а не UTF-16: кирилиця дала б інше число.
    expect(hash32('Кристал')).toBe(3800902002);
  });
});

describe('догми власника — і в порталі теж', () => {
  const empty = read('fixtures/empty.json') as CrystalV2Snapshot;

  it('час — головна валюта: порожня історія росте щороку й нічого не меншає', () => {
    let previous: { h: number; r: number; n: number } | null = null;
    for (let year = 2023; year < 2045; year += 1) {
      const model = buildCrystalV2Model({ ...empty, asOf: `${year}-12-27` });
      const now = { h: model.monarch.height, r: model.monarch.radius, n: model.children.length };
      if (previous) {
        expect(now.h).toBeGreaterThan(previous.h);
        expect(now.r).toBeGreaterThan(previous.r);
        expect(now.n).toBeGreaterThan(previous.n);
      }
      previous = now;
    }
  });

  it('детермінований: той самий знімок — та сама модель', () => {
    const busy = read('fixtures/busy.json') as CrystalV2Snapshot;
    expect(JSON.stringify(buildCrystalV2Model(busy))).toBe(JSON.stringify(buildCrystalV2Model(busy)));
  });
});
