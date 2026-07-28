// ============================================================
// Сторінка одного плану.
// ------------------------------------------------------------
// Перший рівень відповідає лише на три питання: що це, коли це і що
// робити далі. Технічні можливості не зникли, але відкриваються
// поступово — підготовка, бюджет і зв'язки живуть у disclosure-блоках.
// ============================================================
import { useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useConfirm } from '@/providers/ConfirmProvider';
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  GiftIcon,
  TrashIcon,
} from '@/components/icons/UiIcon';
import { PiggyBankIcon } from '@/components/icons/NavIcon';
import { MapPinIcon } from '@/components/icons/MapIcon';
import { daysLabel } from '@/features/calendar/calendarUtils';
import { fmtMoney, useGoals } from '@/features/piggybank/useBudget';
import {
  PLAN_CATEGORIES,
  PLAN_PRECISION_LABEL,
  PLAN_STATUSES,
  PLAN_STATUS_ORDER,
} from './planConstants';
import {
  daysUntilStart,
  hasPreciseDate,
  isClosed,
  planDateLabel,
  readiness,
} from './planModel';
import { planMoney } from './planMoney';
import { linksOfPlan } from './planLinkModel';
import { usePlanLinks } from './usePlanLinks';
import { usePlanMutations, usePlans, usePlanTasks } from './usePlans';
import { PlanTasks } from './PlanTasks';
import { PlanMoneyBlock } from './PlanMoneyBlock';
import { PlanLinksBlock } from './PlanLinksBlock';
import './plans.css';
import './plansDetail.css';
import type { PlanDatePrecision, PlanStatus } from '@/types';

const PRECISIONS: PlanDatePrecision[] = ['none', 'day', 'range', 'month', 'season', 'year'];
const ACTIVE_STATUSES = PLAN_STATUS_ORDER.filter((key) => !PLAN_STATUSES[key].closed);
const CLOSED_STATUSES = PLAN_STATUS_ORDER.filter((key) => PLAN_STATUSES[key].closed);

const STATUS_HELP: Record<PlanStatus, string> = {
  idea: 'Зберегли задум, але ще нічого не вирішили',
  planning: 'Уточнюєте дату, місце та формат',
  preparing: 'Виконуєте кроки перед подією',
  ready: 'Усе необхідне вже готово',
  done: 'Цей момент уже став частиною вашої історії',
  postponed: 'Повернетеся до нього пізніше',
  cancelled: 'План більше не актуальний',
};

export function PlanDetailsPage() {
  const { id } = useParams();
  const planId = Number(id);
  const navigate = useNavigate();
  const confirmDialog = useConfirm();
  const { data: plans = [], isPending } = usePlans();
  const { data: tasks = [] } = usePlanTasks(planId);
  const { data: goals = [] } = useGoals();
  const { data: allLinks = [] } = usePlanLinks();
  const { updatePlan, setStatus, removePlan } = usePlanMutations();
  const [editingDate, setEditingDate] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [tasksOpen, setTasksOpen] = useState(true);
  const tasksRef = useRef<HTMLDetailsElement>(null);

  const plan = useMemo(() => plans.find((item) => item.id === planId) ?? null, [plans, planId]);

  if (isPending) return <p className="empty-state">Завантаження…</p>;
  if (!plan) {
    return (
      <section className="plan-page plan-detail-page">
        <Link className="plan-back" to="/plans"><ChevronLeftIcon size={16} /> Карта планів</Link>
        <p className="empty-state">Такого плану немає. Можливо, його видалили.</p>
      </section>
    );
  }

  const cat = PLAN_CATEGORIES[plan.category];
  const status = PLAN_STATUSES[plan.status];
  const date = planDateLabel(plan);
  const days = hasPreciseDate(plan) ? daysUntilStart(plan) : null;
  const closed = isClosed(plan);
  const ready = readiness(tasks);
  const money = planMoney(plan, goals);
  const linkedCount = linksOfPlan(plan, allLinks).length;

  const preparationSummary = ready.total > 0
    ? `${ready.done} з ${ready.total} готово`
    : 'Додай перші кроки';
  const moneySummary = plan.budget === null
    ? 'Бюджет ще не визначено'
    : money.saved > 0
      ? `Бюджет ${fmtMoney(plan.budget)} · зібрано ${fmtMoney(money.saved)}`
      : `Бюджет ${fmtMoney(plan.budget)}`;
  const linksSummary = linkedCount > 0
    ? `${linkedCount} пов’язаних елементів`
    : 'Бажання, місця, спогади й покупки';

  const remove = async () => {
    if (await confirmDialog(`Видалити план «${plan.title}» разом із завданнями?`)) {
      removePlan.mutate(plan.id, { onSuccess: () => navigate('/plans') });
    }
  };

  const openPreparation = () => {
    setTasksOpen(true);
    window.requestAnimationFrame(() => {
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
      tasksRef.current?.scrollIntoView({ behavior, block: 'start' });
    });
  };

  const primaryAction = date === null
    ? { label: 'Обрати дату', action: () => setEditingDate(true) }
    : closed
      ? { label: 'Змінити стан', action: () => setStatusOpen(true) }
      : { label: 'Продовжити підготовку', action: openPreparation };

  const detailStyle = { '--plan-detail-accent': cat.color } as CSSProperties;

  return (
    <section className="plan-page plan-detail-page" style={detailStyle}>
      <Link className="plan-back plan-detail-back" to="/plans">
        <ChevronLeftIcon size={16} /> Карта планів
      </Link>

      <header className={`plan-detail-hero${closed ? ' plan-detail-hero--closed' : ''}`}>
        <span className="plan-detail-orbit plan-detail-orbit--one" aria-hidden="true" />
        <span className="plan-detail-orbit plan-detail-orbit--two" aria-hidden="true" />

        <div className="plan-detail-identity">
          <span className="plan-detail-icon" aria-hidden="true"><cat.Icon size={36} /></span>
          <div className="plan-detail-copy">
            <span className="plan-detail-category">{cat.label}</span>
            <h1>{plan.title}</h1>
            {plan.description && <p>{plan.description}</p>}
          </div>
        </div>

        <div className="plan-detail-facts">
          <button type="button" className="plan-detail-fact" onClick={() => setEditingDate(true)}>
            <CalendarIcon size={18} />
            <span>
              <small>Коли</small>
              <b>{date ?? 'Обрати дату'}</b>
            </span>
            {days !== null && !closed && <em>{daysLabel(days)}</em>}
          </button>

          {plan.location_name && (
            <div className="plan-detail-fact plan-detail-fact--static">
              <MapPinIcon size={18} />
              <span>
                <small>Де</small>
                <b>{plan.location_name}</b>
              </span>
            </div>
          )}

          <button type="button" className="plan-detail-fact" onClick={() => setStatusOpen(true)}>
            <status.Icon size={18} />
            <span>
              <small>Стан</small>
              <b>{status.label}</b>
            </span>
            <ChevronDownIcon size={16} />
          </button>
        </div>

        <button type="button" className="plan-detail-primary" onClick={primaryAction.action}>
          {primaryAction.label}
        </button>
      </header>

      <div className="plan-detail-sections">
        <details
          ref={tasksRef}
          className="plan-disclosure"
          open={tasksOpen}
          onToggle={(event) => setTasksOpen(event.currentTarget.open)}
        >
          <summary>
            <span className="plan-disclosure-icon"><CheckIcon size={18} /></span>
            <span className="plan-disclosure-copy">
              <b>Підготовка</b>
              <small>{preparationSummary}</small>
            </span>
            <ChevronDownIcon className="plan-disclosure-chevron" size={18} />
          </summary>
          <div className="plan-disclosure-body">
            <PlanTasks planId={plan.id} accent={cat.color} embedded />
          </div>
        </details>

        <details className="plan-disclosure">
          <summary>
            <span className="plan-disclosure-icon"><PiggyBankIcon size={18} /></span>
            <span className="plan-disclosure-copy">
              <b>Бюджет</b>
              <small>{moneySummary}</small>
            </span>
            <ChevronDownIcon className="plan-disclosure-chevron" size={18} />
          </summary>
          <div className="plan-disclosure-body">
            <PlanMoneyBlock plan={plan} accent={cat.color} embedded />
          </div>
        </details>

        <details className="plan-disclosure">
          <summary>
            <span className="plan-disclosure-icon"><GiftIcon size={18} /></span>
            <span className="plan-disclosure-copy">
              <b>Пов’язане</b>
              <small>{linksSummary}</small>
            </span>
            <ChevronDownIcon className="plan-disclosure-chevron" size={18} />
          </summary>
          <div className="plan-disclosure-body">
            <PlanLinksBlock plan={plan} embedded />
          </div>
        </details>
      </div>

      <button type="button" className="plan-detail-delete" onClick={() => void remove()}>
        <TrashIcon size={15} /> Видалити план
      </button>

      {editingDate && (
        <div className="modal-overlay plan-detail-overlay" onClick={(event) => event.target === event.currentTarget && setEditingDate(false)}>
          <div className="modal-sheet plan-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-date-title">
            <span className="plan-detail-sheet-handle" aria-hidden="true" />
            <h2 id="plan-date-title" className="modal-title">Коли це станеться?</h2>
            <p className="plan-detail-sheet-copy">Дата може бути точною або приблизною — карта збереже правильний порядок.</p>

            <label className="form-field">
              <span>Наскільки визначена дата</span>
              <select
                id="plan-precision"
                name="precision"
                value={plan.date_precision}
                onChange={(event) => {
                  const next = event.target.value as PlanDatePrecision;
                  updatePlan.mutate({
                    id: plan.id,
                    patch: next === 'none'
                      ? { date_precision: 'none', start_date: null, end_date: null }
                      : { date_precision: next, start_date: plan.start_date ?? todayISO() },
                  });
                }}
              >
                {PRECISIONS.map((precision) => (
                  <option key={precision} value={precision}>{PLAN_PRECISION_LABEL[precision]}</option>
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
                  onChange={(event) => updatePlan.mutate({
                    id: plan.id,
                    patch: { start_date: event.target.value || null },
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
                  onChange={(event) => updatePlan.mutate({
                    id: plan.id,
                    patch: { end_date: event.target.value || null },
                  })}
                />
              </label>
            )}

            <button type="button" className="btn plan-detail-sheet-done" onClick={() => setEditingDate(false)}>
              Готово
            </button>
          </div>
        </div>
      )}

      {statusOpen && (
        <div className="modal-overlay plan-detail-overlay" onClick={(event) => event.target === event.currentTarget && setStatusOpen(false)}>
          <div className="modal-sheet plan-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-status-title">
            <span className="plan-detail-sheet-handle" aria-hidden="true" />
            <h2 id="plan-status-title" className="modal-title">Стан плану</h2>
            <p className="plan-detail-sheet-copy">На карті буде видно лише поточний стан, а не всі варіанти одразу.</p>

            <div className="plan-status-sheet-list">
              {ACTIVE_STATUSES.map((key) => (
                <StatusOption
                  key={key}
                  statusKey={key}
                  current={plan.status}
                  disabled={setStatus.isPending}
                  onChoose={() => {
                    setStatus.mutate({ id: plan.id, status: key });
                    setStatusOpen(false);
                  }}
                />
              ))}
            </div>

            <div className="plan-status-sheet-divider"><span>Завершення</span></div>

            <div className="plan-status-sheet-list plan-status-sheet-list--closed">
              {CLOSED_STATUSES.map((key) => (
                <StatusOption
                  key={key}
                  statusKey={key}
                  current={plan.status}
                  disabled={setStatus.isPending}
                  onChoose={() => {
                    setStatus.mutate({ id: plan.id, status: key });
                    setStatusOpen(false);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatusOption({ statusKey, current, disabled, onChoose }: {
  statusKey: PlanStatus;
  current: PlanStatus;
  disabled: boolean;
  onChoose: () => void;
}) {
  const option = PLAN_STATUSES[statusKey];
  const active = current === statusKey;

  return (
    <button
      type="button"
      className={`plan-status-sheet-option${active ? ' active' : ''}`}
      disabled={disabled}
      aria-pressed={active}
      onClick={onChoose}
    >
      <span className="plan-status-sheet-icon"><option.Icon size={18} /></span>
      <span className="plan-status-sheet-copy">
        <b>{option.label}</b>
        <small>{STATUS_HELP[statusKey]}</small>
      </span>
      {active && <CheckIcon size={17} />}
    </button>
  );
}

function todayISO(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
