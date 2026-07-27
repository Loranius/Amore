// ============================================================
// SchedulePage — «Графік»
// ------------------------------------------------------------
// Спільний огляд зайнятості пари, найближчі спільні вихідні,
// побачення та окремий режим редагування графіка кожного партнера.
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
import { ProposalCard } from '@/components/ui/ProposalCard';
import type { AppUser, DateRow } from '@/types';
import './schedule.css';

type DayStatus = 'both-off' | 'lena-off' | 'dima-off' | 'none';

function dayStatus(lena: AppUser | undefined, dima: AppUser | undefined, marks: MarksMap, ds: string): DayStatus {
  const lenaOff = !!lena && marks[lena.id]?.[ds] === 'Х';
  const dimaOff = !!dima && marks[dima.id]?.[ds] === 'Х';
  if (lenaOff && dimaOff) return 'both-off';
  if (lenaOff) return 'lena-off';
  if (dimaOff) return 'dima-off';
  return 'none';
}

function fmtLongDate(d: string): string {
  return new Date(`${d}T12:00:00`).toLocaleDateString('uk-UA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function countdownLabel(date: string, today: string): string {
  const target = new Date(`${date}T12:00:00`).getTime();
  const current = new Date(`${today}T12:00:00`).getTime();
  const days = Math.max(0, Math.round((target - current) / 86_400_000));
  if (days === 0) return 'Сьогодні';
  if (days === 1) return 'Завтра';
  return `Через ${days} дн.`;
}

function statusText(status: DayStatus): string {
  if (status === 'both-off') return 'Ви обоє вільні';
  if (status === 'lena-off') return 'Лєна вільна, Діма працює';
  if (status === 'dima-off') return 'Діма вільний, Лєна працює';
  return 'Спільного вихідного немає';
}

export function SchedulePage() {
  const { data: users = [] } = useUsers();
  const me = useCurrentUser();
  const [{ yr, mo }, setYm] = useState(currentYearMonth);
  const [editMode, setEditMode] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [initialPlanDate, setInitialPlanDate] = useState<string | undefined>();
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
  const activeEditUser =
    users.find((u) => u.id === editUserId) ?? users.find((u) => u.name === me.name) ?? users[0];

  const statusOf = useMemo(() => {
    const map = new Map<string, DayStatus>();
    for (let d = 1; d <= total; d++) {
      const ds = ymd(yr, mo, d);
      map.set(ds, dayStatus(lena, dima, marks, ds));
    }
    return map;
  }, [lena, dima, marks, yr, mo, total]);

  const statusCounts = useMemo(() => {
    const counts = { both: 0, lena: 0, dima: 0 };
    for (const status of statusOf.values()) {
      if (status === 'both-off') counts.both++;
      if (status === 'lena-off' || status === 'both-off') counts.lena++;
      if (status === 'dima-off' || status === 'both-off') counts.dima++;
    }
    return counts;
  }, [statusOf]);

  const plansByDate = useMemo(() => {
    const map = new Map<string, DateRow[]>();
    for (const plan of datePlans) {
      const list = map.get(plan.date) ?? [];
      list.push(plan);
      map.set(plan.date, list);
    }
    return map;
  }, [datePlans]);

  const nextSharedDate = sharedDates[0];
  const selectedStatus = selectedDate
    ? sharedDates.includes(selectedDate)
      ? 'both-off'
      : statusOf.get(selectedDate) ?? 'none'
    : 'none';
  const selectedPlans = selectedDate ? plansByDate.get(selectedDate) ?? [] : [];

  const onCell = (userId: number, date: string, current: string) => {
    if (!editMode || mutation.isPending) return;
    mutation.mutate({ userId, date, mark: MARK_CYCLE[current] ?? 'Р' });
  };

  const toggleEditMode = () => {
    if (!editMode && editUserId === null) {
      setEditUserId(users.find((u) => u.name === me.name)?.id ?? users[0]?.id ?? null);
    }
    setEditMode((value) => !value);
    setSelectedDate(null);
  };

  const openPlanModal = (date?: string) => {
    setInitialPlanDate(date);
    setSelectedDate(null);
    setPlanModalOpen(true);
  };

  return (
    <section className="sched">
      <header className="sched-hero">
        <div>
          <span className="sched-kicker">Календар пари</span>
          <h1 className="sched-title">Графік</h1>
          <p className="sched-subtitle">Побачте, коли ви обоє вільні, та заплануйте час разом.</p>
        </div>
        <button
          type="button"
          className={`sched-edit-toggle${editMode ? ' is-active' : ''}`}
          onClick={toggleEditMode}
        >
          {editMode ? 'Завершити' : 'Редагувати'}
        </button>
      </header>

      {nextSharedDate ? (
        <section className="sched-next-card" aria-label="Наступний спільний вихідний">
          <div className="sched-next-icon" aria-hidden="true">♥</div>
          <div className="sched-next-copy">
            <span>Наступний спільний вихідний</span>
            <strong>{fmtLongDate(nextSharedDate)}</strong>
            <small>{countdownLabel(nextSharedDate, today)}</small>
          </div>
          <button type="button" className="sched-next-action" onClick={() => openPlanModal(nextSharedDate)}>
            Запланувати
          </button>
        </section>
      ) : (
        <section className="sched-next-card sched-next-card--empty">
          <div className="sched-next-icon" aria-hidden="true">♡</div>
          <div className="sched-next-copy">
            <span>Спільний вихідний ще не знайдено</span>
            <strong>Заповніть графік на найближчі дні</strong>
            <small>Ми автоматично покажемо першу вільну дату.</small>
          </div>
        </section>
      )}

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

      {users.length >= 2 && (
        <div className="sched-stats" aria-label="Статистика вихідних цього місяця">
          <div className="sched-stat sched-stat--shared">
            <strong>{statusCounts.both}</strong>
            <span>спільні</span>
          </div>
          <div className="sched-stat">
            <strong>{statusCounts.dima}</strong>
            <span>Діма вільний</span>
          </div>
          <div className="sched-stat">
            <strong>{statusCounts.lena}</strong>
            <span>Лєна вільна</span>
          </div>
        </div>
      )}

      {editMode ? (
        <div className="sched-edit-panel">
          <div className="sched-person-switcher" role="tablist" aria-label="Чий графік редагувати">
            {users.map((user) => (
              <button
                key={user.id}
                type="button"
                role="tab"
                aria-selected={activeEditUser?.id === user.id}
                className={activeEditUser?.id === user.id ? 'is-active' : ''}
                onClick={() => setEditUserId(user.id)}
              >
                {user.name}
              </button>
            ))}
          </div>
          <p className="sched-edit-hint">Торкайся дня: порожньо → робота → вихідний.</p>
          {activeEditUser && (
            <Board
              user={activeEditUser}
              yr={yr}
              mo={mo}
              marks={marks}
              today={today}
              statusOf={statusOf}
              onCell={onCell}
            />
          )}
        </div>
      ) : (
        <div className="card sched-board sched-board--overview">
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
              const dayPlans = plansByDate.get(ds) ?? [];
              const hasConfirmedPlan = dayPlans.some((plan) => plan.status === 'confirmed');
              return (
                <button
                  key={ds}
                  type="button"
                  className={
                    'sched-cell sched-cell--interactive' +
                    ` sched-cell--${status}` +
                    (isToday ? ' sched-cell--today' : '')
                  }
                  onClick={() => setSelectedDate(ds)}
                  aria-label={`${fmtLongDate(ds)}. ${statusText(status)}${dayPlans.length ? '. Є заплановане побачення' : ''}`}
                >
                  <span className="sched-cell-num">{day}</span>
                  <span className="sched-cell-symbol" aria-hidden="true">
                    {status === 'both-off' ? '♥' : status === 'lena-off' ? 'Л' : status === 'dima-off' ? 'Д' : ''}
                  </span>
                  {dayPlans.length > 0 && (
                    <span
                      className={`sched-cell-plan-dot${hasConfirmedPlan ? ' is-confirmed' : ''}`}
                      title={hasConfirmedPlan ? 'Підтверджене побачення' : 'Запропоноване побачення'}
                    />
                  )}
                </button>
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
          <span><i className="heat-swatch heat-swatch--plan" /> є план</span>
        </div>
      )}

      {!editMode && sharedDates.length > 0 && (
        <section className="sched-upcoming">
          <div className="sched-section-head">
            <div>
              <span className="sched-section-kicker">Попереду</span>
              <h2>Найближчі спільні дні</h2>
            </div>
            <button type="button" onClick={() => openPlanModal()}>+ Побачення</button>
          </div>
          <div className="sched-upcoming-list">
            {sharedDates.slice(0, 3).map((date) => {
              const plan = plansByDate.get(date)?.[0];
              return (
                <button key={date} type="button" className="sched-upcoming-row" onClick={() => setSelectedDate(date)}>
                  <span className="sched-upcoming-date">
                    <strong>{new Date(`${date}T12:00:00`).toLocaleDateString('uk-UA', { day: 'numeric' })}</strong>
                    <small>{new Date(`${date}T12:00:00`).toLocaleDateString('uk-UA', { month: 'short' })}</small>
                  </span>
                  <span className="sched-upcoming-copy">
                    <strong>{fmtLongDate(date)}</strong>
                    <small>{plan ? plan.title : 'Планів поки немає'}</small>
                  </span>
                  <span className="sched-upcoming-arrow" aria-hidden="true">›</span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {datePlans.length > 0 && (
        <div className="date-plans">
          <h2 className="date-plans-title">Заплановані побачення</h2>
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

      {selectedDate && (
        <DayDetailsSheet
          date={selectedDate}
          status={selectedStatus}
          plans={selectedPlans}
          onClose={() => setSelectedDate(null)}
          onPlan={() => openPlanModal(selectedDate)}
        />
      )}

      {planModalOpen && (
        <PlanDateModal
          key={initialPlanDate ?? 'default-date'}
          sharedDates={sharedDates}
          initialDate={initialPlanDate}
          onClose={() => setPlanModalOpen(false)}
          onSubmit={(input) => dateMutations.propose.mutate(input)}
        />
      )}
    </section>
  );
}

function DayDetailsSheet({
  date,
  status,
  plans,
  onClose,
  onPlan,
}: {
  date: string;
  status: DayStatus;
  plans: DateRow[];
  onClose: () => void;
  onPlan: () => void;
}) {
  const canPlan = status === 'both-off' && date >= todayLocal();

  return (
    <div
      className="sched-day-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="sched-day-sheet" role="dialog" aria-modal="true" aria-label={`Деталі за ${fmtLongDate(date)}`}>
        <div className="sched-day-handle" />
        <div className="sched-day-head">
          <div>
            <span>{fmtLongDate(date)}</span>
            <h2>{statusText(status)}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрити">×</button>
        </div>

        {plans.length > 0 ? (
          <div className="sched-day-plans">
            {plans.map((plan) => (
              <article key={plan.id} className="sched-day-plan">
                <span className={`sched-day-plan-status ${plan.status}`}>{plan.status === 'confirmed' ? 'Підтверджено' : 'Очікує'}</span>
                <strong>{plan.title}</strong>
                <small>
                  {plan.time ? plan.time.slice(0, 5) : 'Час не вказано'}
                  {plan.place ? ` · ${plan.place}` : ''}
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p className="sched-day-empty">На цей день спільних планів ще немає.</p>
        )}

        {canPlan && (
          <button type="button" className="btn sched-day-plan-btn" onClick={onPlan}>
            Запланувати побачення
          </button>
        )}
      </section>
    </div>
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

  return (
    <ProposalCard
      pending={pending}
      proposedBy={plan.proposed_by}
      meName={meName}
      onConfirm={onConfirm}
      onReject={onReject}
      onDelete={onReject}
      deleteConfirmMessage="Видалити побачення?"
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
    <div className="card sched-board sched-board--editing">
      <h3 className="sched-board-title">Графік: {user.name}</h3>
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
              aria-label={`${fmtLongDate(ds)}. ${mark === 'Р' ? 'Робочий день' : mark === 'Х' ? 'Вихідний' : 'Не вказано'}`}
            >
              <span className="sched-cell-num">{day}</span>
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
