import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCrystalV2Model, type CrystalV2Snapshot } from '../crystalV2/model';
import { buildVolcanoModel } from '../volcano/model';
import { YEAR_BOOST_CAP, tierSize, tierSlot, yearBoost, yearElements, yearFertility } from './grammar';

// ============================================================
// Одна граматика росту (ADR-0237 §2). Інваріанти — однакові для кожного
// виду, і тому ганяються циклом по видах, а не окремо в кожному:
//   * ніщо не меншає — старший знімок не менший і не бідніший;
//   * минулий рік замкнений — нова подія не змінює елементів минулих років;
//   * стеля — елемент найактивнішого року не більший за тихий ×1.35;
//   * детермінованість.
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../tools/crystal_twin/', import.meta.url));
const BUSY = JSON.parse(readFileSync(`${TWIN}fixtures/busy.json`, 'utf8')) as CrystalV2Snapshot;

/** Вид очима граматики: загальний розмір і розмір елемента кожного року. */
interface SpeciesView {
  size: number;
  elements: Map<number, number>;
}

const SPECIES: Record<string, (snapshot: CrystalV2Snapshot) => SpeciesView> = {
  кристал: (s) => {
    const m = buildCrystalV2Model(s);
    return { size: m.monarch.height, elements: new Map(m.children.map((c) => [c.year, c.height])) };
  },
  вулкан: (s) => {
    const m = buildVolcanoModel(s);
    return { size: m.height, elements: new Map(m.layers.map((l) => [l.year, l.thickness])) };
  },
};

// Знімок `busy` починається 2022-12-26.
const DATES = ['2023-03-01', '2023-12-30', '2024-06-15', '2025-01-01', '2026-09-27', '2031-05-05', '2045-09-29'];

describe('граматика: інваріанти для кожного виду', () => {
  for (const [name, view] of Object.entries(SPECIES)) {
    it(`${name}: ніщо не меншає — ні загальний розмір, ні елемент року, ні їх кількість`, () => {
      let prev: SpeciesView | null = null;
      for (const asOf of DATES) {
        const now = view({ ...BUSY, asOf });
        if (prev) {
          expect(now.size).toBeGreaterThanOrEqual(prev.size);
          expect(now.elements.size).toBeGreaterThanOrEqual(prev.elements.size);
          for (const [year, size] of prev.elements) expect(now.elements.get(year)!).toBeGreaterThanOrEqual(size - 1e-9);
        }
        prev = now;
      }
    });

    it(`${name}: минулий рік замкнений — подія цього року не змінює минулих`, () => {
      const asOf = '2025-06-01';
      const before = view({ ...BUSY, asOf });
      const extra = [...(BUSY.memories ?? []), ...Array.from({ length: 30 }, (_, i) => ({ id: 900_000 + i, date: '2025-05-20' }))];
      const after = view({ ...BUSY, asOf, memories: extra });
      const last = Math.max(...before.elements.keys());
      for (const [year, size] of before.elements) {
        if (year < last) expect(after.elements.get(year)).toBe(size);
      }
      expect(after.elements.get(last)!).toBeGreaterThanOrEqual(before.elements.get(last)!);
    });

    it(`${name}: той самий знімок — той самий результат`, () => {
      expect(view(BUSY)).toEqual(view(JSON.parse(JSON.stringify(BUSY)) as CrystalV2Snapshot));
    });
  }
});

describe('граматика: елемент року', () => {
  it('по одному елементу на кожен рік, що почався; перший є завжди', () => {
    const empty: CrystalV2Snapshot = { startDate: '2020-02-10', asOf: '2020-02-10', partners: {} };
    expect(yearElements(empty).map((e) => e.year)).toEqual([0]);
    const fourYears = yearElements({ ...empty, asOf: '2024-02-11' });
    expect(fourYears.map((e) => e.year)).toEqual([0, 1, 2, 3, 4]);
    expect(fourYears.at(-1)!.lived).toBeLessThan(0.01);
    expect(fourYears[0]!.lived).toBe(1);
  });

  it('активність року — та сама, що бачить кристал (одна арифметика на всі види)', () => {
    const crystal = buildCrystalV2Model(BUSY);
    const elements = yearElements(BUSY);
    expect(elements.map((e) => e.year)).toEqual(crystal.children.map((c) => c.year));
    elements.forEach((e, i) => expect(e.activity).toBeCloseTo(crystal.children[i]!.activity, 6));
  });

  it('стеля: тихий рік — ×1, найбурхливіший — не більше ×1.35', () => {
    expect(yearBoost(0)).toBe(1);
    expect(yearBoost(1e9)).toBeCloseTo(YEAR_BOOST_CAP, 12);
    let prev = 0;
    for (const a of [0, 1, 3, 10, 40, 400]) {
      expect(yearFertility(a)).toBeGreaterThanOrEqual(prev);
      prev = yearFertility(a);
    }
  });
});

describe('граматика: яруси дерева по 3 або 4 гілки (ADR-0237 §7)', () => {
  it('ярус — 3 або 4, у різних пар по-різному, в однієї — завжди однаково', () => {
    const sizes = new Set<number>();
    for (const seed of ['2012-09-29', '2022-12-26', '2019-05-01', '2001-01-01', '2030-07-07']) {
      for (let t = 0; t < 6; t += 1) {
        const size = tierSize(seed, t);
        expect([3, 4]).toContain(size);
        expect(tierSize(seed, t)).toBe(size);
        sizes.add(size);
      }
    }
    expect(sizes).toEqual(new Set([3, 4]));
  });

  it('гілки років заповнюють ярус знизу; новий ярус — лише коли нижній повний', () => {
    const seed = '2022-12-26';
    let expectedTier = 0;
    let slot = 0;
    for (let year = 0; year < 30; year += 1) {
      const place = tierSlot(seed, year);
      expect(place.tier).toBe(expectedTier);
      expect(place.slot).toBe(slot);
      expect(place.size).toBe(tierSize(seed, expectedTier));
      slot += 1;
      if (slot === place.size) { expectedTier += 1; slot = 0; }
    }
  });
});
