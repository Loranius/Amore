import { describe, expect, it } from 'vitest';
import { seededUnit } from './math';

/**
 * Regression cover for a defect that shaped every seeded decision in the
 * engine. `seededUnit` divided a raw FNV-1a hash, and FNV-1a's final step is
 * `hash ^= char; hash *= PRIME` — so salts differing only in their last
 * character landed about PRIME/2^32 = 0.004 apart. Since practically every call
 * site indexes its salt (`facet:${segment}`, `radius-x:${row}`,
 * `substrate:r:${row}:${segment}`), all of them were reading a near-linear ramp
 * instead of noise: the "irregular" facets were regular and the "lumpy" rock
 * was smooth.
 */
describe('seededUnit', () => {
  const sample = (count: number, seed = 4242): number[] =>
    Array.from({ length: count }, (_, index) => seededUnit(seed, `probe:${index}`));

  it('stays in [0, 1)', () => {
    // Half-open. It divided by 0xffffffff, so it could return exactly 1 — out
    // of range for every caller that uses it to pick an index or a fraction.
    for (const value of sample(5_000)) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('does not walk in small steps as the salt index increments', () => {
    // The defect, stated directly: consecutive salts used to move by ~0.004.
    const values = sample(200);
    let large = 0;
    for (let index = 1; index < values.length; index += 1) {
      if (Math.abs(values[index]! - values[index - 1]!) > 0.2) large += 1;
    }

    // With independent draws roughly two thirds of steps exceed 0.2. Under the
    // old ramp it was zero.
    expect(large).toBeGreaterThan(values.length * 0.4);
  });

  it('spreads evenly across the range', () => {
    const buckets = new Array(10).fill(0);
    const values = sample(20_000);
    for (const value of values) buckets[Math.min(9, Math.floor(value * 10))] += 1;

    for (const count of buckets) {
      expect(count).toBeGreaterThan(values.length / 10 * 0.85);
      expect(count).toBeLessThan(values.length / 10 * 1.15);
    }
  });

  it('decorrelates neighbouring salts rather than merely spreading overall', () => {
    // The old function passed a bucket test too — its values covered the range,
    // just in order. What it could not do is make step N and step N+1
    // independent, so this measures the correlation directly.
    const values = sample(20_000);
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    let covariance = 0;
    let variance = 0;
    for (let index = 1; index < values.length; index += 1) {
      covariance += (values[index]! - mean) * (values[index - 1]! - mean);
      variance += (values[index - 1]! - mean) ** 2;
    }

    expect(Math.abs(covariance / variance)).toBeLessThan(0.05);
  });

  it('separates seeds as well as salts', () => {
    const bySeed = Array.from({ length: 200 }, (_, seed) => seededUnit(seed, 'probe:0'));
    let large = 0;
    for (let index = 1; index < bySeed.length; index += 1) {
      if (Math.abs(bySeed[index]! - bySeed[index - 1]!) > 0.2) large += 1;
    }

    expect(large).toBeGreaterThan(bySeed.length * 0.4);
  });

  it('is still deterministic', () => {
    expect(seededUnit(7, 'salt')).toBe(seededUnit(7, 'salt'));
    expect(seededUnit(7, 'salt')).not.toBe(seededUnit(8, 'salt'));
    expect(seededUnit(7, 'salt')).not.toBe(seededUnit(7, 'salu'));
  });
});
