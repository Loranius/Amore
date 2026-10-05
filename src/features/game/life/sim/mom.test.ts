import { describe, expect, it } from 'vitest';
import { momPlan } from './mom';

const at = (hh: number, mm = 0) => hh * 60 + mm;

describe('мама за розкладом дня (власник, 2026-10-05)', () => {
  it('за день готує, порається на городі й у садку, годує курей і відпочиває у своїй кімнаті', () => {
    const spots = new Set<string>();
    for (let m = 0; m < 24 * 60; m += 10) spots.add(momPlan(m, 'summer').spot);
    for (const s of ['kitchen', 'garden', 'orchard', 'chickens', 'bed']) expect(spots.has(s), s).toBe(true);
  });

  it('уночі й в обідній відпочинок — у хаті, на ліжку', () => {
    expect(momPlan(at(3), 'summer')).toMatchObject({ spot: 'bed', outside: false });
    expect(momPlan(at(13, 30), 'summer')).toMatchObject({ spot: 'bed', outside: false });
    expect(momPlan(at(12), 'summer')).toMatchObject({ spot: 'kitchen', outside: true });
  });

  it('узимку на город і в сад не ходить', () => {
    for (let m = 0; m < 24 * 60; m += 10) expect(['garden', 'orchard']).not.toContain(momPlan(m, 'winter').spot);
  });
});
