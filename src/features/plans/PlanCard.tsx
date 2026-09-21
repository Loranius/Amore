// ============================================================
// Картка плану у списку.
// ------------------------------------------------------------
// Відкриття — накладка-кнопка на всю картку, а не div з onClick: інакше
// картку не сфокусувати з клавіатури й читалка не знає, що вона
// клікабельна. Той самий патерн, що в картці місця на карті.
// ============================================================
import { Link } from 'react-router-dom';
import { PLAN_CATEGORIES, PLAN_STATUSES } from './planConstants';
import { isClosed, planCountdown, planDateLabel } from './planModel';
import type { PlanRow } from '@/types';

export function PlanCard({ plan, onConfirm }: {
  plan: PlanRow;
  /** Показується лише для запропонованого й ще не підтвердженого плану. */
  onConfirm?: (id: number) => void;
}) {
  const cat = PLAN_CATEGORIES[plan.category];
  const status = PLAN_STATUSES[plan.status];
  const date = planDateLabel(plan);
  // Відлік, його підпис і фаза — одна відповідь на всі три місця, де це
  // показують (`planCountdown`). Тут лишається саме рішення про показ.
  const countdown = planCountdown(plan);
  const closed = isClosed(plan);
  // Прострочене показуємо лише поки план у роботі: у виконаного
  // «−9 днів» означало б докір за те, що вже зроблено.
  const overdue = !closed && countdown?.phase === 'past';

  return (
    <article className={`plan-card${closed ? ' plan-card--closed' : ''}`}>
      <span className="plan-card-bar" style={{ background: cat.color }} aria-hidden="true" />
      <Link className="plan-card-open" to={`/plans/${plan.id}`} aria-label={`Відкрити «${plan.title}»`} />

      <div className="plan-card-body">
        <div className="plan-card-head">
          <span className="plan-card-cat" style={{ color: cat.color }}>
            <cat.Icon size={13} /> {cat.label}
          </span>
          <span className="plan-card-status">
            <status.Icon size={12} /> {status.label}
          </span>
        </div>

        <p className="plan-card-title">{plan.title}</p>
        {plan.description && <p className="plan-card-desc">{plan.description}</p>}

        <div className="plan-card-meta">
          {date && <span>{date}</span>}
          {plan.location_name && <span>{plan.location_name}</span>}
          {countdown !== null && !closed && (
            <span className={overdue ? 'plan-card-overdue' : 'plan-card-when'}>
              {countdown.label}
            </span>
          )}
        </div>

        {!plan.confirmed && onConfirm && (
          <button
            type="button"
            className="plan-card-confirm"
            onClick={() => onConfirm(plan.id)}
          >
            Підтвердити
          </button>
        )}
      </div>
    </article>
  );
}
