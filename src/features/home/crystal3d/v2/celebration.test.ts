import { describe, expect, it } from 'vitest';
import {
  CELEBRATION_DELAY_S,
  CELEBRATION_DURATION_S,
  CELEBRATION_REST,
  celebrationAt,
  celebrationEnd,
  celebrationTimeline,
} from './celebration';

// ADR-0261: кристал відповідає на нове з минулого візиту — один ефект на
// вид події, один раз, після появи сцени.
describe('відгук кристала на нове (ADR-0261)', () => {
  it('кожен вид події — свій ефект, як модуль у моделі (ADR-0217)', () => {
    expect(celebrationTimeline(['memory']).map((b) => b.effect)).toEqual(['wave']);
    expect(celebrationTimeline(['plan']).map((b) => b.effect)).toEqual(['crown']);
    expect(celebrationTimeline(['wish']).map((b) => b.effect)).toEqual(['flush']);
    expect(celebrationTimeline(['media']).map((b) => b.effect)).toEqual(['flush']);
    expect(celebrationTimeline(['place']).map((b) => b.effect)).toEqual(['burst']);
    expect(celebrationTimeline(['calendar']).map((b) => b.effect)).toEqual(['burst']);
  });

  it('нічого нового — жодного відгуку; невідомий вид не вигадує ефекту', () => {
    expect(celebrationTimeline([])).toEqual([]);
    expect(celebrationTimeline(['recipe'])).toEqual([]);
    expect(celebrationEnd([])).toBe(0);
    expect(celebrationAt([], 3)).toEqual(CELEBRATION_REST);
  });

  it('кілька видів — по черзі в сталому порядку, кожен ефект один раз', () => {
    const timeline = celebrationTimeline(['wish', 'memory', 'media', 'calendar', 'plan']);
    expect(timeline.map((b) => b.effect)).toEqual(['wave', 'crown', 'flush', 'burst']);
    for (let k = 1; k < timeline.length; k += 1) expect(timeline[k]!.start).toBeGreaterThan(timeline[k - 1]!.start);
    expect(timeline[0]!.start).toBe(CELEBRATION_DELAY_S);
  });

  it('ефект тихий до початку й після кінця, найсильніший посередині', () => {
    const timeline = celebrationTimeline(['plan']);
    const { start, duration } = timeline[0]!;
    expect(celebrationAt(timeline, 0).crown).toBe(0);
    expect(celebrationAt(timeline, start).crown).toBe(0);
    expect(celebrationAt(timeline, start + duration / 2).crown).toBeCloseTo(1, 6);
    expect(celebrationAt(timeline, start + duration).crown).toBeCloseTo(0, 9);
    expect(celebrationAt(timeline, celebrationEnd(timeline) + 1)).toEqual(CELEBRATION_REST);
  });

  it('хвиля спогаду йде від основи до вістря', () => {
    const timeline = celebrationTimeline(['memory']);
    const { start } = timeline[0]!;
    const early = celebrationAt(timeline, start + CELEBRATION_DURATION_S * 0.2);
    const late = celebrationAt(timeline, start + CELEBRATION_DURATION_S * 0.8);
    expect(early.waveAt).toBeLessThan(late.waveAt);
    expect(early.waveAt).toBeLessThan(0.3);
    expect(late.waveAt).toBeGreaterThan(0.8);
  });

  it('детермінований: той самий розклад і мить — той самий стан', () => {
    const a = celebrationAt(celebrationTimeline(['memory', 'wish']), 2.345);
    const b = celebrationAt(celebrationTimeline(['wish', 'memory']), 2.345);
    expect(a).toEqual(b);
  });
});
