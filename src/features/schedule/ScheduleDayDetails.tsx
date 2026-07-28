// ============================================================
// Панель одного дня графіка: хто вихідний і що на нього заплановано.
// ------------------------------------------------------------
// Плани приходять із модуля «Плани», а не з колишньої таблиці `dates`.
// Тому рядок веде на сторінку плану, а кнопка — у самі «Плани»:
// графік показує, а створюють в одному місці.
// ============================================================
import { type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { todayLocal } from '@/features/_shared/month';
import { PLAN_CATEGORIES, PLAN_STATUSES } from '@/features/plans/planConstants';
import type { PlanRow } from '@/types';
import type { DayStatus } from './scheduleViewModel';
import { fmtLongDate, statusText } from './scheduleViewModel';

export function ScheduleDayDetails({ date, status, plans, onClose, onPlan }: {
  date: string;
  status: DayStatus;
  plans: PlanRow[];
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
            {plans.map((plan) => {
              const cat = PLAN_CATEGORIES[plan.category];
              return (
                <Link key={plan.id} to={`/plans/${plan.id}`} className="sched-day-plan">
                  {/* Непідтверджена пропозиція мусить читатись як питання,
                      а не як домовленість — так само, як було в побаченнях. */}
                  <span className={`sched-day-plan-status ${plan.confirmed ? 'confirmed' : 'pending'}`}>
                    {plan.confirmed ? PLAN_STATUSES[plan.status].label : 'Очікує'}
                  </span>
                  <strong>{plan.title}</strong>
                  <small style={{ color: cat.color }}>
                    {plan.start_time ? plan.start_time.slice(0, 5) : cat.label}
                    {plan.location_name ? ` · ${plan.location_name}` : ''}
                  </small>
                </Link>
              );
            })}
          </div>
        ) : <p className="sched-day-empty">На цей день спільних планів ще немає.</p>}
        {canPlan && <button type="button" className="btn sched-day-plan-btn" onClick={onPlan}>Запланувати</button>}
      </section>
    </div>
  );
}
