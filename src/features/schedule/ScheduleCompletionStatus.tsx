import type { AppUser } from '@/types';
import type { MarksMap } from './useSchedule';
import './scheduleStabilization.css';

function countFilled(userId: number, marks: MarksMap): number {
  return Object.values(marks[userId] ?? {}).filter((mark) => mark === 'Р' || mark === 'Х').length;
}

export function ScheduleCompletionStatus({
  users,
  marks,
  total,
}: {
  users: AppUser[];
  marks: MarksMap;
  total: number;
}) {
  if (users.length === 0) return null;

  return (
    <section className="sched-completion" aria-label="Заповнення графіка партнерами">
      {users.map((user) => {
        const filled = countFilled(user.id, marks);
        const progress = total > 0 ? Math.round((filled / total) * 100) : 0;
        const complete = filled === total && total > 0;
        return (
          <article key={user.id} className={`sched-completion-card${complete ? ' is-complete' : ''}`}>
            <div className="sched-completion-copy">
              <strong>{user.name}</strong>
              <span>{complete ? 'Графік заповнено' : filled === 0 ? 'Ще не заповнено' : `${filled} із ${total} днів`}</span>
            </div>
            <div className="sched-completion-value" aria-label={`${progress}%`}>{complete ? '✓' : `${progress}%`}</div>
            <div className="sched-completion-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          </article>
        );
      })}
    </section>
  );
}
