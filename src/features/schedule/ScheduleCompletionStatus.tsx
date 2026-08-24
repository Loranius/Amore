import { CheckIcon } from '@/components/icons/UiIcon';
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
  currentUserId,
  canRemind,
  remindingUserId,
  remindedUserIds,
  onEditUser,
  onRemindUser,
}: {
  users: AppUser[];
  marks: MarksMap;
  total: number;
  currentUserId: number | null;
  canRemind: boolean;
  remindingUserId: number | null;
  remindedUserIds: ReadonlySet<number>;
  onEditUser: (userId: number) => void;
  onRemindUser: (userId: number) => void;
}) {
  if (users.length === 0) return null;

  return (
    <section className="sched-completion" aria-label="Заповнення графіка партнерами">
      {users.map((user) => {
        const filled = countFilled(user.id, marks);
        const missing = Math.max(0, total - filled);
        const progress = total > 0 ? Math.round((filled / total) * 100) : 0;
        const complete = filled === total && total > 0;
        const isPartner = currentUserId !== null && user.id !== currentUserId;
        const reminded = remindedUserIds.has(user.id);
        const reminding = remindingUserId === user.id;

        return (
          <article key={user.id} className={`sched-completion-card${complete ? ' is-complete' : ''}`}>
            <div className="sched-completion-copy">
              <strong>{user.name}</strong>
              <span>{complete ? 'Графік заповнено' : filled === 0 ? 'Ще не заповнено' : `${filled} із ${total} днів`}</span>
            </div>
            <div className="sched-completion-value" aria-label={`${progress}%`}>{complete ? <CheckIcon size={15} /> : `${progress}%`}</div>
            {!complete && (
              <div className="sched-completion-actions">
                <button type="button" className="sched-completion-action" onClick={() => onEditUser(user.id)}>
                  Заповнити пропуски · {missing}
                </button>
                {isPartner && canRemind && (
                  <button
                    type="button"
                    className={`sched-completion-remind${reminded ? ' is-sent' : ''}`}
                    onClick={() => onRemindUser(user.id)}
                    disabled={reminded || reminding}
                  >
                    {reminded ? 'Надіслано сьогодні' : reminding ? 'Надсилаємо…' : 'Нагадати'}
                  </button>
                )}
              </div>
            )}
            <div className="sched-completion-track" aria-hidden="true"><span style={{ width: `${progress}%` }} /></div>
          </article>
        );
      })}
    </section>
  );
}
