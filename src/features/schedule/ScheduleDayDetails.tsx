import { type MouseEvent } from 'react';
import { todayLocal } from '@/features/_shared/month';
import type { DateRow } from '@/types';
import type { DayStatus } from './scheduleViewModel';
import { fmtLongDate, statusText } from './scheduleViewModel';

export function ScheduleDayDetails({ date, status, plans, onClose, onPlan }: {
  date: string;
  status: DayStatus;
  plans: DateRow[];
  onClose: () => void;
  onPlan: () => void;
}) {
  const canPlan = status === 'both-off' && date >= todayLocal();
  return (
    <div className="sched-day-overlay" onClick={(event: MouseEvent<HTMLDivElement>) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="sched-day-sheet" role="dialog" aria-modal="true" aria-label={`Деталі за ${fmtLongDate(date)}`}>
        <div className="sched-day-handle" />
        <div className="sched-day-head">
          <div><span>{fmtLongDate(date)}</span><h2>{statusText(status)}</h2></div>
          <button type="button" onClick={onClose} aria-label="Закрити">×</button>
        </div>
        {plans.length > 0 ? (
          <div className="sched-day-plans">
            {plans.map((plan) => (
              <article key={plan.id} className="sched-day-plan">
                <span className={`sched-day-plan-status ${plan.status}`}>{plan.status === 'confirmed' ? 'Підтверджено' : 'Очікує'}</span>
                <strong>{plan.title}</strong>
                <small>{plan.time ? plan.time.slice(0, 5) : 'Час не вказано'}{plan.place ? ` · ${plan.place}` : ''}</small>
              </article>
            ))}
          </div>
        ) : <p className="sched-day-empty">На цей день спільних планів ще немає.</p>}
        {canPlan && <button type="button" className="btn sched-day-plan-btn" onClick={onPlan}>Запланувати побачення</button>}
      </section>
    </div>
  );
}
