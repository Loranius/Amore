import { describe, expect, it } from 'vitest';
import {
  formatGoalDate,
  formatGoalMonth,
  isValidDesiredDate,
  localTodayIso,
} from './forecastModel';

describe('forecastModel', () => {
  it('builds a local calendar date without UTC shifting', () => {
    expect(localTodayIso(new Date(2026, 6, 26, 23, 30))).toBe('2026-07-26');
  });

  it('accepts today and future dates but rejects past or impossible dates', () => {
    expect(isValidDesiredDate('2026-07-26', '2026-07-26')).toBe(true);
    expect(isValidDesiredDate('2026-08-01', '2026-07-26')).toBe(true);
    expect(isValidDesiredDate('2026-07-25', '2026-07-26')).toBe(false);
    expect(isValidDesiredDate('2026-02-30', '2026-01-01')).toBe(false);
    expect(isValidDesiredDate('', '2026-07-26')).toBe(false);
  });

  it('formats dates in Ukrainian', () => {
    expect(formatGoalDate('2026-12-05')).toContain('2026');
    expect(formatGoalMonth('2026-12-05')).toContain('2026');
  });
});
