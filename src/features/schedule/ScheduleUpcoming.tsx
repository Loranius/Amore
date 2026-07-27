import type { DateRow } from '@/types';
import { fmtLongDate } from './scheduleViewModel';

export function ScheduleUpcoming({
  sharedDates,
  plansByDate,
  onSelectDate,
  onPlan,
}: {
  sharedDates: string[];
  plansByDate: Map<string, DateRow[]>;
  onSelectDate: (date: string) => void;
  onPlan: () => void;
}) {
  if (sharedDates.length === 0) return null;

  return (
    <section className="sched-upcoming">
      <div className="sched-section-head">
        <div><span className="sched-section-kicker">Попереду</span><h2>Найближчі спільні дні</h2></div>
        <button type="button" onClick={onPlan}>+ Побачення</button>
      </div>
      <div className="sched-upcoming-list">
        {sharedDates.slice(0, 3).map((date) => {
          const plan = plansByDate.get(date)?.[0];
          const parsed = new Date(`${date}T12:00:00`);
          return (
            <button key={date} type="button" className="sched-upcoming-row" onClick={() => onSelectDate(date)}>
              <span className="sched-upcoming-date">
                <strong>{parsed.toLocaleDateString('uk-UA', { day: 'numeric' })}</strong>
                <small>{parsed.toLocaleDateString('uk-UA', { month: 'short' })}</small>
              </span>
              <span className="sched-upcoming-copy"><strong>{fmtLongDate(date)}</strong><small>{plan ? plan.title : 'Планів поки немає'}</small></span>
              <span className="sched-upcoming-arrow" aria-hidden="true">›</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
