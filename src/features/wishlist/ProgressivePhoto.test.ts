import { describe, expect, it } from 'vitest';
import { normalizeRevealDelay } from './ProgressivePhoto';

describe('normalizeRevealDelay', () => {
  it('uses zero for missing or invalid values', () => {
    expect(normalizeRevealDelay(undefined)).toBe(0);
    expect(normalizeRevealDelay(Number.NaN)).toBe(0);
  });

  it('rounds and clamps the stagger delay', () => {
    expect(normalizeRevealDelay(34.6)).toBe(35);
    expect(normalizeRevealDelay(-20)).toBe(0);
    expect(normalizeRevealDelay(900)).toBe(280);
  });
});
