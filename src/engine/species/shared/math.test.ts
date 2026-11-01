import { describe, expect, it } from 'vitest';
import * as shared from './math';
import * as crystal from '../crystal/math';
import * as tree from '../tree/math';
import * as reef from '../reef/math';

// ============================================================
// Одна математика на всі види — і жодної другої копії.
// ------------------------------------------------------------
// Кристал, дерево й риф мали по власній копії цих функцій, і збіг тримався
// лише на тому, що копії колись зробили з першої (ADR-0257). Тест ловить
// не «схожу» функцію, а ту саму: якщо хтось знову скопіює `seededUnit` у
// вид, посів почне залежати від того, чию копію викликали.
// ============================================================

const SPECIES = { crystal, tree, reef } as const;

describe('species math is one implementation', () => {
  for (const [name, mod] of Object.entries(SPECIES)) {
    it(`${name} re-exports the shared functions, not copies`, () => {
      const exported = Object.entries(mod).filter(([key]) => key in shared);
      expect(exported.length).toBeGreaterThan(0);
      for (const [key, value] of exported) {
        expect(value, `${name}/math.${key}`).toBe(shared[key as keyof typeof shared]);
      }
    });
  }

  it('keeps every species-wide helper the three species shared before', () => {
    for (const key of ['clamp01', 'round6', 'seededUnit', 'stableSeed', 'daysBetweenExplicit'] as const) {
      expect(crystal[key]).toBe(shared[key]);
      expect(tree[key]).toBe(shared[key]);
      expect(reef[key]).toBe(shared[key]);
    }
  });

  it('returns exactly what the three copies returned before they were merged', () => {
    // Еталон записано 2026-11-01 з копій `HEAD` перед зведенням (ADR-0257):
    // кристал, дерево й риф дали ці числа однаково, до останнього біта.
    const vector = { achievement: 1, remembrance: 2, exploration: 0, culture: 0, stability: 3, significance: 0 };
    expect(shared.seededUnit(20200614, 'year:3')).toBe(0.09378273971378803);
    expect(shared.stableSeed(42, 'colony')).toBe(482132530);
    expect(shared.daysBetweenExplicit('2020-06-14T00:00:00Z', '2021-06-14T00:00:00Z')).toBe(365);
    expect(shared.round6(1 / 3)).toBe(0.333333);
    expect(shared.clamp01(1.7)).toBe(1);
    expect(shared.saturate(3, 2)).toBe(0.6);
    expect(shared.channelEvenness(vector)).toBe(0.564476);
    expect(shared.maturityAt('2020-01-01T00:00:00Z', '2020-07-01T00:00:00Z', 30)).toBe(0.858491);
  });
});
