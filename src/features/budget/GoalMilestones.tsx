import { GOAL_MILESTONES, getGoalMilestoneState } from './milestoneModel';
import './milestones.css';

export function GoalMilestones({
  savedAmount,
  targetAmount,
}: {
  savedAmount: number;
  targetAmount: number;
}) {
  const state = getGoalMilestoneState(savedAmount, targetAmount);

  return (
    <section
      className="goal-milestones"
      aria-label={`Етапи спільної цілі: ${state.displayProgress}%`}
    >
      <div className="goal-milestones-track" aria-hidden="true">
        <span
          className="goal-milestones-fill"
          style={{ width: `${state.progress}%` }}
        />
        {GOAL_MILESTONES.map((level) => {
          const reached = state.reached.includes(level);
          const current = state.current === level;

          return (
            <span
              key={level}
              className={`goal-milestone-marker${reached ? ' is-reached' : ''}${current ? ' is-current' : ''}`}
              style={{ left: `${level}%` }}
            >
              <span className="goal-milestone-dot">{reached ? '✓' : ''}</span>
              <span className="goal-milestone-label">{level}%</span>
            </span>
          );
        })}
      </div>
      <p className="goal-milestone-message" aria-live="polite">
        {state.message}
      </p>
    </section>
  );
}
