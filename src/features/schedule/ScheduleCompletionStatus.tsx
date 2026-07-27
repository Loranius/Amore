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
  onEditUser,
}: {
  users: AppUser[];
  marks: MarksMap;
  total: number;
  onEditUser: (userId: number) => void;
}) {
  if (users.length === 0) return null;

  return (
    <section className="sched-completion" aria-label="Заповнення графіка партнерами">
      {users.map((user) => {
        const filled = countFilled(user.id, marks);
        const missing = Math.max(0, total - filled);
        const progress = total > 0 ? Math.round((filled / total) * 100) : 0;
        const complete = filled === total && total > 0;
        return (
          <article key={user.id} className={`sched-completion-card${complete ? ' is-complete' : ''}`}>
            <div className="sched-completion-copy">
              <strong>{user.name}</strong>
              <span>{complete ? 'Графік заповнено' : filled === 0 ? 'Ще не заповнено' : `${filled} із ${total} днів`}</span>
            </div>
            <div className="sched-completion-value" aria-label={`${progress}%`}>{complete ? '✓' : `${progress}%`}</div>
            {!complete && (
              <button type="button" className="sched-completion-action" onClick={() => onEditUser(user.id)}>
                Заповнити пропуски · {missing}
              </button>
            )}
            <div className="sched-completion-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          </article>
        );
      })}
    </section>
  );
}
