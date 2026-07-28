// ============================================================
// Сторінка одного плану.
// ------------------------------------------------------------
// Тут план перестає бути рядком у списку: дата з потрібною точністю,
// місце, статус, завдання підготовки й гроші — бюджет разом із цілями
// скарбнички, які під нього збирають. Зв'язки з бажаннями, мапою та
// спогадами — наступний етап; сторінка навмисно лишає їм місце внизу,
// а не вбудовує заглушки.
// ============================================================
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '@/providers/ConfirmProvider';
import { ChevronLeftIcon, TrashIcon } from '@/components/icons/UiIcon';
import { daysLabel } from '@/features/calendar/calendarUtils';
import { PLAN_CATEGORIES, PLAN_PRECISION_LABEL, PLAN_STATUSES, PLAN_STATUS_ORDER } from './planConstants';
import { daysUntilStart, hasPreciseDate, isClosed, planDateLabel } from './planModel';
import { usePlanMutations, usePlans } from './usePlans';
import { PlanTasks } from './PlanTasks';
import { PlanMoneyBlock } from './PlanMoneyBlock';
import './plans.css';
import type { PlanDatePrecision } from '@/types';

const PRECISIONS: PlanDatePrecision[] = ['none', 'day', 'range', 'month', 'season', 'year'];

export function PlanDetailsPage() {
  const { id } = useParams();
  const planId = Number(id);
  const navigate = useNavigate();
  const confirmDialog = useConfirm();
  const { data: plans = [], isPending } = usePlans();
  const { updatePlan, setStatus, removePlan } = usePlanMutations();
  const [editingDate, setEditingDate] = useState(false);

  const plan = useMemo(() => plans.find((p) => p.id === planId) ?? null, [plans, planId]);

  if (isPending) return <p className="empty-state">Завантаження…</p>;
  if (!plan) {
    return (
      <section className="plan-page">
        <Link className="plan-back" to="/plans"><ChevronLeftIcon size={16} /> Плани</Link>
        <p className="empty-state">Такого плану немає. Можливо, його видалили.</p>
      </section>
    );
  }

  const cat = PLAN_CATEGORIES[plan.category];
  const date = planDateLabel(plan);
  const days = hasPreciseDate(plan) ? daysUntilStart(plan) : null;
  const closed = isClosed(plan);

  const remove = async () => {
    if (await confirmDialog(`Видалити план «${plan.title}» разом із завданнями?`)) {
      removePlan.mutate(plan.id, { onSuccess: () => navigate('/plans') });
    }
  };

  return (
    <section className="plan-page">
      <Link className="plan-back" to="/plans"><ChevronLeftIcon size={16} /> Плани</Link>

      <header className="plan-page-head" style={{ borderColor: cat.color }}>
        <span className="plan-page-icon" style={{ color: cat.color }}>
          <cat.Icon size={34} />
        </span>
        <div className="plan-page-copy">
          <span className="plan-page-cat" style={{ color: cat.color }}>{cat.label}</span>
          <h1>{plan.title}</h1>
          {plan.description && <p>{plan.description}</p>}
        </div>
      </header>

      <div className="plan-page-facts">
        <button type="button" className="plan-fact" onClick={() => setEditingDate((v) => !v)}>
          <small>Коли</small>
          <b>{date ?? 'Дата не визначена'}</b>
          {days !== null && !closed && <span style={{ color: cat.color }}>{daysLabel(days)}</span>}
        </button>
        {plan.location_name && (
          <div className="plan-fact plan-fact--static">
            <small>Де</small>
            <b>{plan.location_name}</b>
          </div>
        )}
      </div>

      {editingDate && (
        <div className="plan-date-editor">
          <label className="form-field">
            <span>Наскільки визначена дата</span>
            <select
              id="plan-precision"
              name="precision"
              value={plan.date_precision}
              onChange={(e) => {
                const next = e.target.value as PlanDatePrecision;
                // «Дата не визначена» знімає і саму дату: інакше в базі
                // лишився б день, який ніде не показується, і план тихо
                // сортувався б як датований.
                updatePlan.mutate({
                  id: plan.id,
                  patch: next === 'none'
                    ? { date_precision: 'none', start_date: null, end_date: null }
                    : { date_precision: next, start_date: plan.start_date ?? todayISO() },
                });
              }}
            >
              {PRECISIONS.map((p) => (
                <option key={p} value={p}>{PLAN_PRECISION_LABEL[p]}</option>
              ))}
            </select>
          </label>

          {plan.date_precision !== 'none' && (
            <label className="form-field">
              <span>Початок</span>
              <input
                id="plan-start"
                name="start_date"
                type="date"
                value={plan.start_date ?? ''}
                onChange={(e) => updatePlan.mutate({
                  id: plan.id, patch: { start_date: e.target.value || null },
                })}
              />
            </label>
          )}

          {plan.date_precision === 'range' && (
            <label className="form-field">
              <span>Завершення</span>
              <input
                id="plan-end"
                name="end_date"
                type="date"
                value={plan.end_date ?? ''}
                onChange={(e) => updatePlan.mutate({
                  id: plan.id, patch: { end_date: e.target.value || null },
                })}
              />
            </label>
          )}
        </div>
      )}

      <div className="plan-status-row" role="group" aria-label="Статус плану">
        {PLAN_STATUS_ORDER.map((key) => {
          const s = PLAN_STATUSES[key];
          const active = plan.status === key;
          return (
            <button
              key={key}
              type="button"
              className={`plan-status-btn${active ? ' active' : ''}`}
              aria-pressed={active}
              onClick={() => setStatus.mutate({ id: plan.id, status: key })}
            >
              <s.Icon size={14} /> {s.label}
            </button>
          );
        })}
      </div>

      <PlanTasks planId={plan.id} accent={cat.color} />

      <PlanMoneyBlock plan={plan} accent={cat.color} />

      <button type="button" className="plan-delete" onClick={() => void remove()}>
        <TrashIcon size={15} /> Видалити план
      </button>
    </section>
  );
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
