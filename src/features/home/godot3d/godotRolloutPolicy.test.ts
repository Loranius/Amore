import { describe, expect, it } from 'vitest';
import {
  GODOT_ROLLOUT_STORAGE_KEY,
  getOrCreateGodotCohortKey,
  parseGodotRolloutPercent,
  resolveGodotRolloutEligibility,
  stableGodotCohortBucket,
} from './godotRolloutPolicy';

describe('Godot progressive rollout policy', () => {
  it.each([
    [undefined, 100],
    ['', 100],
    ['invalid', 100],
    ['0', 0],
    ['25.4', 25],
    ['101', 100],
    ['-5', 0],
  ])('parses rollout value %s as %s', (value, expected) => {
    expect(parseGodotRolloutPercent(value)).toBe(expected);
  });

  it('assigns a stable bucket for the same cohort key', () => {
    const first = stableGodotCohortBucket('pixel-8-pro-session');
    const second = stableGodotCohortBucket('pixel-8-pro-session');
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThan(100);
  });

  it('always enables preview and gates production by percentage', () => {
    const key = 'stable-cohort';
    const bucket = stableGodotCohortBucket(key);
    expect(resolveGodotRolloutEligibility({ mode: 'preview', rolloutPercent: 0, cohortKey: key })).toBe(true);
    expect(resolveGodotRolloutEligibility({ mode: 'disabled', rolloutPercent: 100, cohortKey: key })).toBe(false);
    expect(resolveGodotRolloutEligibility({
      mode: 'production',
      rolloutPercent: bucket,
      cohortKey: key,
    })).toBe(false);
    expect(resolveGodotRolloutEligibility({
      mode: 'production',
      rolloutPercent: bucket + 1,
      cohortKey: key,
    })).toBe(true);
  });

  it('persists one browser cohort key', () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    };
    const first = getOrCreateGodotCohortKey(storage, () => 'cohort-a');
    const second = getOrCreateGodotCohortKey(storage, () => 'cohort-b');
    expect(first).toBe('cohort-a');
    expect(second).toBe('cohort-a');
    expect(values.get(GODOT_ROLLOUT_STORAGE_KEY)).toBe('cohort-a');
  });
});
