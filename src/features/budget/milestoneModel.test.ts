import { describe, expect, it } from 'vitest';
import { calculateGoalProgress, getGoalMilestoneState } from './milestoneModel';

describe('milestoneModel', () => {
  it('clamps invalid and overfunded progress safely', () => {
    expect(calculateGoalProgress(20, 0)).toBe(0);
    expect(calculateGoalProgress(-10, 100)).toBe(0);
    expect(calculateGoalProgress(150, 100)).toBe(100);
  });

  it('changes milestones only after the exact threshold is reached', () => {
    expect(getGoalMilestoneState(24.9, 100).current).toBeNull();
    expect(getGoalMilestoneState(25, 100).current).toBe(25);
    expect(getGoalMilestoneState(49.9, 100).current).toBe(25);
    expect(getGoalMilestoneState(50, 100).current).toBe(50);
    expect(getGoalMilestoneState(75, 100).current).toBe(75);
    expect(getGoalMilestoneState(100, 100).current).toBe(100);
  });

  it('returns all reached stages without partner comparisons', () => {
    const state = getGoalMilestoneState(7600, 10000);

    expect(state.reached).toEqual([25, 50, 75]);
    expect(state.displayProgress).toBe(76);
    expect(state.message).toBe('Більша частина шляху вже позаду 🌿');
  });
});
