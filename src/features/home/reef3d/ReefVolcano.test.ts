import { describe, expect, it } from 'vitest';
import {
  calculateReefVolcanoGrowth,
  isReefVolcanoEruptionActive,
} from './ReefVolcano';

describe('ReefVolcano growth', () => {
  it('reaches the fully formed state by fifty relationship years', () => {
    const state = calculateReefVolcanoGrowth({
      daysTogether: Math.ceil(50 * 365.2425),
      moduleFill: 0,
    });

    expect(state.ageProgress).toBe(1);
    expect(state.growth).toBe(1);
  });

  it('lets module fill accelerate a young volcano without skipping to maturity', () => {
    const empty = calculateReefVolcanoGrowth({
      daysTogether: 365,
      moduleFill: 0,
    });
    const active = calculateReefVolcanoGrowth({
      daysTogether: 365,
      moduleFill: 1,
    });

    expect(active.growth).toBeGreaterThan(empty.growth);
    expect(active.growth).toBeLessThan(1);
  });
});

describe('ReefVolcano eruption schedule', () => {
  it.each([0, 6, 12, 18])(
    'is active for exactly five minutes from %i:00 local time',
    (hour) => {
      expect(isReefVolcanoEruptionActive(new Date(2026, 7, 15, hour, 0, 0))).toBe(true);
      expect(isReefVolcanoEruptionActive(new Date(2026, 7, 15, hour, 4, 59))).toBe(true);
      expect(isReefVolcanoEruptionActive(new Date(2026, 7, 15, hour, 5, 0))).toBe(false);
    },
  );

  it('stays dormant between scheduled windows', () => {
    expect(isReefVolcanoEruptionActive(new Date(2026, 7, 15, 3, 30, 0))).toBe(false);
    expect(isReefVolcanoEruptionActive(new Date(2026, 7, 15, 9, 15, 0))).toBe(false);
    expect(isReefVolcanoEruptionActive(new Date(2026, 7, 15, 21, 45, 0))).toBe(false);
  });
});
