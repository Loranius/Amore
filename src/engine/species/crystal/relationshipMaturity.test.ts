import { describe, expect, it } from 'vitest';
import { maturityAt, relationshipMaturityAt } from './math';

const START = '2016-01-01';

function atYears(years: number): number {
  const start = new Date(`${START}T00:00:00Z`).getTime();
  const asOf = new Date(start + years * 365 * 86_400_000).toISOString();
  return relationshipMaturityAt(START, asOf);
}

describe('relationship maturity', () => {
  it('separates a young relationship from a long one', () => {
    // The monarch crystal's size is driven entirely by this value, so it is
    // the single number that decides whether a couple's crystal "looks like"
    // their actual history. Reported from the product side (2026-08-02): a
    // 3-year relationship rendered a crystal that read as a decade old.
    const oneYear = atYears(1);
    const threeYears = atYears(3);
    const tenYears = atYears(10);

    // A 3-year relationship should sit around the middle of the range, not
    // pinned near the top.
    expect(threeYears).toBeGreaterThan(0.4);
    expect(threeYears).toBeLessThan(0.62);

    // Ten years is close to, but not at, full growth.
    expect(tenYears).toBeGreaterThan(0.85);
    expect(tenYears).toBeLessThan(0.97);

    // The gap between 3 and 10 years must stay large enough to actually see.
    // The regression this guards against had the two within 4% of each other.
    expect(tenYears - threeYears).toBeGreaterThan(0.3);
    expect(threeYears - oneYear).toBeGreaterThan(0.2);
  });

  it('grows monotonically and saturates instead of running away', () => {
    const samples = [0.5, 1, 2, 3, 5, 10, 20, 40].map(atYears);
    for (let index = 1; index < samples.length; index += 1) {
      expect(samples[index]!).toBeGreaterThan(samples[index - 1]!);
    }
    expect(samples[samples.length - 1]!).toBeLessThanOrEqual(1);
  });

  it('starts at zero for a relationship that has not begun', () => {
    expect(relationshipMaturityAt(START, START)).toBe(0);
    expect(relationshipMaturityAt(START, '2015-06-01')).toBe(0);
  });

  it('stays distinct from the fast event-decay curve it replaced', () => {
    // maturityAt is still correct for events — an event's influence is meant
    // to settle within weeks and then hold. Keeping both curves means a change
    // to one cannot silently redefine the other.
    const asOfThreeYears = new Date(
      new Date(`${START}T00:00:00Z`).getTime() + 3 * 365 * 86_400_000,
    ).toISOString();

    expect(maturityAt(START, asOfThreeYears, 180)).toBeGreaterThan(0.8);
    expect(relationshipMaturityAt(START, asOfThreeYears)).toBeLessThan(0.62);
  });
});
