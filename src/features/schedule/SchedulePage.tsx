// ============================================================
// SchedulePage — «Графік» (порт schedule.js UI)
// ------------------------------------------------------------
// За замовчуванням (перегляд) — ОДИН спільний графік: клітинка дня
// пофарбована за тим, хто вільний («Х») — обоє (темно-рожевий),
// лише Лєна, лише Діма; де обоє працюють — колір не міняється.
// У режимі редагування — окремі дошки на кожного (тап циклічно
// міняє позначку саме тій людині; спільний вигляд для цього не
// підходить — треба однозначно знати, чию мітку міняєш).
// ============================================================
import { useMemo, useState } from 'react';
import { useUsers } from '@/features/_shared/useUsers';
import { useCurrentUser } from '@/providers/AuthProvider';
import {
  MONTHS_UA,
  DAYS_UA,
  ymd,
  todayLocal,
  daysInMonth,
  firstMondayOffset,
  currentYearMonth,
  stepMonth,
} from '@/features/_shared/month';
import { useSchedule, useScheduleMutation, MARK_CYCLE, type MarksMap } from './useSchedule';
import { useSharedDaysOff, useDatePlans, useDateMutations } from './useDates';
import { PlanDateModal } from './PlanDateModal';
import { TintedRow } from '@/components/ui/TintedRow';
import type { AppUser, DateRow } from '@/types';

type DayStatus = 'both-off' | 'lena-off' | 'dima-off' | 'none';

function dayStatus(lena: AppUser | undefined, dima: AppUser | undefined, marks: MarksMap, ds: string): DayStatus {
  const lenaOff = !!lena && marks[lena.id]?.[ds] === 'Х';
  const dimaOff = !!dima && marks[dima.id]?.[ds] === 'Х';
  if (lenaOff && dimaOff) return 'both-off';
  if (lenaOff) return 'lena-off';
  if (dimaOff) return 'dima-off';
  return 'none';
}

export function SchedulePage() {
  const { data: users = [] } = useUsers();
  const me = useCurrentUser();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const [editMode, setEditMode] = useState(false);
  const [planModalOpen, setPlanModalOpen] = useState(false);

  const { data: marks = {} } = useSchedule(yr, mo);
  const mutation = useScheduleMutation(yr, mo);

  const { data: sharedDates = [] } = useSharedDaysOff();
  const { data: datePlans = [] } = useDatePlans();
  const dateMutations = useDateMutations();

  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);
  const today = todayLocal();

  const lena = users.find((u) => u.name === 'Лєна');
  const dima = users.find((u) => u.name === 'Діма');

  const statusOf = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (let d = 1; d <= total; d++) {
      const ds = ymd(yr, mo, d);
      map.set(ds, dayStatus(lena, dima, marks, ds));
    }
    return map;
  }, [lena, dima, marks, yr, mo, total]);

  const bothOffCount = useMemo(() => {
    let n = 0;
    for (const s of statusOf.values()) if (s === 'both-off') n++;
    return n;
  }, [statusOf]);

  const onCell = (userId: number, date: string, current: string) => {
    if (!editMode || mutation.isPending) return;
    mutation.mutate({ userId, date, mark: MARK_CYCLE[current] ?? 'Р' });
  };

  return (
    <section className="sched">
      <div className="sched-nav">
        <button
          type="button"
          className="sched-nav-btn"
          onClick={() => setYm(stepMonth(yr, mo, -1))}
          aria-label="Попередній місяць"
        >
          ‹
        </button>
        <span className="sched-month-label">
          {MONTHS_UA[mo - 1]} {yr}
        </span>
        <button
          type="button"
          className="sched-nav-btn"
          onClick={() => setYm(stepMonth(yr, mo, +1))}
          aria-label="Наступний місяць"
        >
          ›
        </button>
      </div>

      {users.length >= 2 && bothOffCount > 0 && (
        <p className="heat-summary">
          💗 {bothOffCount} {bothOffCount === 1 ? 'спільний вихідний' : 'спільних вихідних'} цього місяця
        </p>
      )}

      {sharedDates.length > 0 && (
        <button type="button" className="btn date-plan-cta" onClick={() => setPlanModalOpen(true)}>
          💗 Запланувати побачення
        </button>
      )}

      <button
        type="button"
        className={`sched-edit-toggle${editMode ? ' is-active' : ''}`}
        onClick={() => setEditMode((v) => !v)}
      >
        {editMode ? '✅ Завершити редагування' : '✏️ Редагувати графік'}
      </button>

      {editMode ? (
        <div className="sched-boards sched-boards--editing">
          {users.map((u) => (
            <Board
              key={u.id}
              user={u}
              yr={yr}
              mo={mo}
              marks={marks}
              today={today}
              statusOf={statusOf}
              onCell={onCell}
            />
          ))}
        </div>
      ) : (
        <div className="card sched-board">
          <div className="sched-grid">
            {DAYS_UA.map((d) => (
              <div key={d} className="pcal-dow">
                {d}
              </div>
            ))}
            {Array.from({ length: offset }).map((_, i) => (
              <div key={`e${i}`} className="sched-cell sched-cell--empty" />
            ))}
            {Array.from({ length: total }).map((_, i) => {
              const day = i + 1;
              const ds = ymd(yr, mo, day);
              const isToday = ds === today;
              const status = statusOf.get(ds) ?? 'none';
              return (
                <div
                  key={ds}
                  className={
                    'sched-cell' +
                    ` sched-cell--${status}` +
                    (isToday ? ' sched-cell--today' : '')
                  }
                >
                  <span className="sched-cell-num">
                    {day}
                    {status === 'both-off' && <span className="sched-cell-heart">♥</span>}
                    {status === 'lena-off' && <span className="sched-cell-who">Л</span>}
                    {status === 'dima-off' && <span className="sched-cell-who">Д</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {users.length >= 2 && (
        <div className="heat-legend">
          <span><i className="heat-swatch heat-swatch--both-off" /> обоє вільні</span>
          <span><i className="heat-swatch heat-swatch--lena-off" /> Лєна вільна</span>
          <span><i className="heat-swatch heat-swatch--dima-off" /> Діма вільний</span>
        </div>
      )}

      {datePlans.length > 0 && (
        <div className="date-plans">
          <h2 className="date-plans-title">💗 Заплановані побачення</h2>
          {datePlans.map((d) => (
            <DatePlanCard
              key={d.id}
              plan={d}
              meName={me.name}
              onConfirm={() => dateMutations.confirm.mutate(d.id)}
              onReject={() => dateMutations.remove.mutate(d.id)}
            />
          ))}
        </div>
      )}

      {planModalOpen && (
        <PlanDateModal
          sharedDates={sharedDates}
          onClose={() => setPlanModalOpen(false)}
          onSubmit={(input) => dateMutations.propose.mutate(input)}
        />
      )}
    </section>
  );
}

function fmtDatePlanDate(d: string): string {
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', weekday: 'short' });
}

function DatePlanCard({
  plan,
  meName,
  onConfirm,
  onReject,
}: {
  plan: DateRow;
  meName: string;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const pending = plan.status === 'pending';
  const canVote = pending && plan.proposed_by !== meName;
  const partnerGen = meName === 'Діма' ? 'Лєни' : 'Діми';

  return (
    <TintedRow
      pending={pending}
      info={
        <>
          <span className="date-plan-card-title">{plan.title}</span>
          <span className="date-plan-card-date">📅 {fmtDatePlanDate(plan.date)}{plan.time ? ` · ${plan.time.slice(0, 5)}` : ''}</span>
          {plan.place && <span className="date-plan-card-place">📍 {plan.place}</span>}
          {plan.description && <span className="date-plan-card-desc">{plan.description}</span>}
          {plan.url && (
            <a className="date-plan-card-link" href={plan.url} target="_blank" rel="noopener noreferrer">
              🔗
            </a>
          )}
          {pending ? (
            <span className="goal-status-badge">⏳ Очікує {partnerGen}</span>
          ) : (
            <span className="goal-status-badge goal-confirmed">✅ Підтверджено</span>
          )}
        </>
      }
      actions={
        <>
          {canVote && (
            <div className="goal-vote-btns">
              <button type="button" className="btn goal-vote-yes" onClick={onConfirm}>
                ✓
              </button>
              <button
                type="button"
                className="btn-secondary goal-vote-no"
                onClick={() => confirm('Відхилити?') && onReject()}
              >
                ✕
              </button>
            </div>
          )}
          {(!pending || plan.proposed_by === meName) && (
            <button
              type="button"
              className="fin-del-btn"
              onClick={() => confirm('Видалити побачення?') && onReject()}
              aria-label="Видалити"
            >
              ×
            </button>
          )}
        </>
      }
    />
  );
}

interface BoardProps {
  user: AppUser;
  yr: number;
  mo: number;
  marks: MarksMap;
  today: string;
  statusOf: Map<string, DayStatus>;
  onCell: (userId: number, date: string, current: string) => void;
}

function Board({ user, yr, mo, marks, today, statusOf, onCell }: BoardProps) {
  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);
  const userMarks = marks[user.id] ?? {};

  return (
    <div className="card sched-board">
      <h3 className="sched-board-title">{user.name}</h3>
      <div className="sched-grid">
        {DAYS_UA.map((d) => (
          <div key={d} className="pcal-dow">
            {d}
          </div>
        ))}
        {Array.from({ length: offset }).map((_, i) => (
          <div key={`e${i}`} className="sched-cell sched-cell--empty" />
        ))}
        {Array.from({ length: total }).map((_, i) => {
          const day = i + 1;
          const ds = ymd(yr, mo, day);
          const mark = userMarks[ds] ?? '';
          const isToday = ds === today;
          const status = statusOf.get(ds) ?? 'none';
          return (
            <button
              key={ds}
              type="button"
              className={
                'sched-cell' +
                ` sched-cell--${status}` +
                (isToday ? ' sched-cell--today' : '')
              }
              onClick={() => onCell(user.id, ds, mark)}
            >
              <span className="sched-cell-num">
                {day}
                {status === 'both-off' && <span className="sched-cell-heart">♥</span>}
              </span>
              <span
                className={
                  'sched-cell-letter' +
                  (mark === 'Р' ? ' sched-cell-letter--work' : '') +
                  (mark === 'Х' ? ' sched-cell-letter--off' : '')
                }
              >
                {mark}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
