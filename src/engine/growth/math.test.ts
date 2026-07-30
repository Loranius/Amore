import { describe, expect, it } from 'vitest';
import { ensureUpward } from './math';

describe('Growth math', () => {
  it('enforces the requested upward component after normalization', () => {
    const direction = ensureUpward({ x: 0.92, y: 0.04, z: -0.38 }, 0.24);

    expect(direction.y).toBeCloseTo(0.24, 12);
    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 12);
  });

  it('does not alter a direction that already satisfies the floor', () => {
    const direction = ensureUpward({ x: 0.2, y: 0.9, z: 0.1 }, 0.24);

    expect(direction.y).toBeGreaterThanOrEqual(0.24);
    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 12);
  });

  it('handles a vertical downward input without producing non-finite values', () => {
    const direction = ensureUpward({ x: 0, y: -1, z: 0 }, 0.34);

    expect(direction.y).toBeCloseTo(0.34, 12);
    expect(direction.x).toBeGreaterThan(0);
    expect(Math.hypot(direction.x, direction.y, direction.z)).toBeCloseTo(1, 12);
    expect(Object.values(direction).every(Number.isFinite)).toBe(true);
  });
});
