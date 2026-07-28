import { DAYS_UA, daysInMonth, firstMondayOffset, ymd } from '@/features/_shared/month';
import type { PlanRow } from '@/types';
import type { DayStatus } from './scheduleViewModel';
import { fmtLongDate, statusText } from './scheduleViewModel';

export function ScheduleMonthOverview({
  yr,
  mo,
  today,
  usersCount,
  statusCounts,
  statusOf,
  plansByDate,
  onSelectDate,
}: {
  yr: number;
  mo: number;
  today: string;
  usersCount: number;
  statusCounts: { both: number; lena: number; dima: number };
  statusOf: Map<string, DayStatus>;
  plansByDate: Map<string, PlanRow[]>;
  onSelectDate: (date: string) => void;
}) {
  const total = daysInMonth(yr, mo);
  const offset = firstMondayOffset(yr, mo);

  return (
    <>
      {usersCount >= 2 && (
        <div className="sched-stats" aria-label="Статистика вихідних цього місяця">
          <div className="sched-stat sched-stat--shared"><strong>{statusCounts.both}</strong><span>спільні</span></div>
          <div className="sched-stat"><strong>{statusCounts.dima}</strong><span>Діма вільний</span></div>
          <div className="sched-stat"><strong>{statusCounts.lena}</strong><span>Лєна вільна</span></div>
        </div>
      )}

      <div className="card sched-board sched-board--overview">
        <div className="sched-grid">
          {DAYS_UA.map((dayName) => <div key={dayName} className="pcal-dow">{dayName}</div>)}
          {Array.from({ length: offset }).map((_, index) => <div key={`empty-${index}`} className="sched-cell sched-cell--empty" />)}
          {Array.from({ length: total }).map((_, index) => {
            const day = index + 1;
            const date = ymd(yr, mo, day);
            const status = statusOf.get(date) ?? 'none';
            const plans = plansByDate.get(date) ?? [];
            // Крапка «підтверджено» — про згоду партнера, а не про статус
            // підготовки: саме це питання ставлять, дивлячись на графік.
            const confirmed = plans.some((plan) => plan.confirmed);
            return (
              <button
                key={date}
                type="button"
                className={`sched-cell sched-cell--interactive sched-cell--${status}${date === today ? ' sched-cell--today' : ''}`}
                onClick={() => onSelectDate(date)}
                aria-label={`${fmtLongDate(date)}. ${statusText(status)}${plans.length ? '. Є план на цей день' : ''}`}
              >
                <span className="sched-cell-num">{day}</span>
                <span className="sched-cell-symbol" aria-hidden="true">{status === 'both-off' ? '♥' : status === 'lena-off' ? 'Л' : status === 'dima-off' ? 'Д' : ''}</span>
                {plans.length > 0 && <span className={`sched-cell-plan-dot${confirmed ? ' is-confirmed' : ''}`} title={confirmed ? 'Підтверджений план' : 'Запропонований план'} />}
              </button>
            );
          })}
        </div>
      </div>

      {usersCount >= 2 && (
        <div className="heat-legend">
          <span><i className="heat-swatch heat-swatch--both-off" /> обоє вільні</span>
          <span><i className="heat-swatch heat-swatch--lena-off" /> Лєна вільна</span>
          <span><i className="heat-swatch heat-swatch--dima-off" /> Діма вільний</span>
          <span><i className="heat-swatch heat-swatch--plan" /> є план</span>
        </div>
      )}
    </>
  );
}
