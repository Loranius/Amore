import { describe, expect, it } from 'vitest';
import {
  canDeleteGoalComment,
  GOAL_COMMENT_MAX,
  isValidGoalComment,
  normalizeGoalComment,
} from './commentModel';

describe('commentModel', () => {
  it('normalizes surrounding whitespace', () => {
    expect(normalizeGoalComment('  Домовимося про колір  ')).toBe('Домовимося про колір');
  });

  it('accepts only non-empty comments within the limit', () => {
    expect(isValidGoalComment('Разом оберемо варіант')).toBe(true);
    expect(isValidGoalComment('   ')).toBe(false);
    expect(isValidGoalComment('а'.repeat(GOAL_COMMENT_MAX))).toBe(true);
    expect(isValidGoalComment('а'.repeat(GOAL_COMMENT_MAX + 1))).toBe(false);
  });

  it('allows deleting only the current user comment', () => {
    expect(canDeleteGoalComment(1, 1)).toBe(true);
    expect(canDeleteGoalComment(2, 1)).toBe(false);
  });
});
