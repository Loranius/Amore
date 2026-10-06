import { describe, expect, it } from 'vitest';
import { lavaProximity } from './lavaProximity';

describe('світло рік на схилі (ADR-0246)', () => {
  const lava = new Float32Array([0, 0, 0, 0, 1, 0, 5, 5, 5]);
  const flow = new Float32Array([0.2, 0.8, -1]);

  it('вершина на ріці — повна близькість і flow найближчої точки', () => {
    const out = lavaProximity(new Float32Array([0, 1, 0]), lava, flow, 0.5);
    expect(out[0]).toBeCloseTo(1, 6);
    expect(out[1]).toBeCloseTo(0.8, 6);
  });

  it('чаша (flow < 0) не світить: поруч із нею близькість береться до ріки', () => {
    const out = lavaProximity(new Float32Array([5, 5, 5]), lava, flow, 0.5);
    expect(out[0]).toBeLessThan(1e-6);
    expect(out[1]).not.toBe(-1);
  });

  it('близькість спадає з відстанню і детермінована', () => {
    const rock = new Float32Array([0.25, 0, 0, 0.5, 0, 0]);
    const a = lavaProximity(rock, lava, flow, 0.5);
    expect(a[0]).toBeGreaterThan(a[2]!);
    expect(Array.from(lavaProximity(rock, lava, flow, 0.5))).toEqual(Array.from(a));
  });

  it('без рік — без світла', () => {
    const out = lavaProximity(new Float32Array([0, 0, 0]), lava, new Float32Array([-1, -1, -1]), 0.5);
    expect(out[0]).toBe(0);
  });
});
