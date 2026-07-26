import type { CSSProperties } from 'react';
import { fmtMoney } from './useBudget';
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
  const saved = Math.max(0, Number(savedAmount) || 0);
  const target = Math.max(0, Number(targetAmount) || 0);
  const remaining = Math.max(0, target - saved);
  const ringStyle = {
    '--goal-progress-angle': `${state.progress * 3.6}deg`,
  } as CSSProperties;

  return (
    <section
      className="goal-progress-card"
      aria-label={`Прогрес спільної цілі: ${state.displayProgress}%`}
    >
      <div className="goal-progress-summary">
        <div className="goal-progress-ring" style={ringStyle}>
          <span>{state.displayProgress}%</span>
        </div>

        <div className="goal-progress-stat">
          <span>Зібрано</span>
          <strong>{fmtMoney(saved)}</strong>
          <small>з {fmtMoney(target)}</small>
        </div>

        <div className="goal-progress-stat goal-progress-remaining">
          <span>Ще залишилось</span>
          <strong>{fmtMoney(remaining)}</strong>
        </div>
      </div>

      <div className="goal-progress-track" aria-hidden="true">
        <span className="goal-progress-fill" style={{ width: `${state.progress}%` }} />
        {GOAL_MILESTONES.slice(0, -1).map((level) => (
          <span
            className={`goal-progress-checkpoint${state.reached.includes(level) ? ' is-reached' : ''}`}
            style={{ left: `${level}%` }}
            key={level}
          />
        ))}
      </div>

      <div className="goal-progress-scale" aria-hidden="true">
        <span>0%</span>
        <span>{fmtMoney(target)}</span>
      </div>

      <div className="goal-progress-message" aria-live="polite">
        <span className="goal-progress-message-icon" aria-hidden="true">♧</span>
        <div>
          <strong>{state.message}</strong>
          <p>
            {state.progress >= 100
              ? 'Це ваш спільний результат і тепла частина історії цієї мрії.'
              : 'Разом цей шлях стає ближчим із кожним комфортним внеском.'}
          </p>
        </div>
      </div>
    </section>
  );
}
