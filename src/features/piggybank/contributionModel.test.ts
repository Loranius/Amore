import { describe, expect, it } from 'vitest';
import {
  canCancelContribution,
  isValidContributionAmount,
  normalizeContributionNote,
} from './contributionModel';

describe('contributionModel', () => {
  it('accepts only positive whole hryvnia amounts', () => {
    expect(isValidContributionAmount(1)).toBe(true);
    expect(isValidContributionAmount(1500)).toBe(true);
    expect(isValidContributionAmount(0)).toBe(false);
    expect(isValidContributionAmount(-20)).toBe(false);
    expect(isValidContributionAmount(10.5)).toBe(false);
    expect(isValidContributionAmount(Number.NaN)).toBe(false);
  });

  it('normalizes an optional note without inventing content', () => {
    expect(normalizeContributionNote('  Ще один крок  ')).toBe('Ще один крок');
    expect(normalizeContributionNote('   ')).toBeNull();
  });

  it('allows cancelling only the current user contribution', () => {
    expect(canCancelContribution(1, 1)).toBe(true);
    expect(canCancelContribution(2, 1)).toBe(false);
  });
});
