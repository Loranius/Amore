// ============================================================
// Гроші плану: очікувана вартість.
// ------------------------------------------------------------
// План не створює фінансову «ціль» і не резервує гроші. Він лише
// зберігає, скільки може коштувати.
//
// Порівняння зі «скарбничкою» звідси пішло разом із самим модулем
// (ADR-0049). Тут був рядок «Зараз у скарбничці» з посиланням на неї та
// смуга «вистачає / не вистачає N» — усе це трималось на чужому модулі
// й показувало суму, яка під цей план однаково не резервувалась.
// ============================================================
import { useState } from 'react';
import { fmtMoney } from '@/lib/money';
import { usePlanMutations } from './usePlans';
import type { PlanRow } from '@/types';

export function PlanMoneyBlock({ plan, embedded = false }: {
  plan: PlanRow;
  embedded?: boolean;
}) {
  const { updatePlan } = usePlanMutations();
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');

  const budget = plan.budget === null ? null : Math.max(0, Number(plan.budget));

  const saveBudget = () => {
    const raw = budgetDraft.trim().replace(/\s/g, '').replace(',', '.');
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    updatePlan.mutate({ id: plan.id, patch: { budget: value } });
    setEditingBudget(false);
  };

  return (
    <section className={`plan-money${embedded ? ' plan-money--embedded' : ''}`}>
      <header className="plan-money-head">
        {!embedded && <h3>Гроші</h3>}
        {!editingBudget && (
          <button
            type="button"
            className="plan-money-budget-btn"
            onClick={() => {
              setBudgetDraft(plan.budget === null ? '' : String(plan.budget));
              setEditingBudget(true);
            }}
          >
            {plan.budget === null ? 'Додати бюджет' : 'Змінити бюджет'}
          </button>
        )}
      </header>

      {editingBudget && (
        <div className="plan-money-editor">
          <label className="form-field">
            <span>Скільки це може коштувати</span>
            <input
              id={`plan-budget-${plan.id}`}
              name="budget"
              type="number"
              min="0"
              step="100"
              inputMode="numeric"
              value={budgetDraft}
              placeholder="Порожньо — ще не рахували"
              onChange={(event) => setBudgetDraft(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') saveBudget(); }}
            />
          </label>
          <div className="plan-money-editor-actions">
            <button type="button" className="btn" onClick={saveBudget} disabled={updatePlan.isPending}>
              {updatePlan.isPending ? 'Зберігаю…' : 'Зберегти'}
            </button>
            <button type="button" className="plan-money-cancel" onClick={() => setEditingBudget(false)}>
              Скасувати
            </button>
          </div>
        </div>
      )}

      {budget === null ? (
        <p className="plan-money-empty">Вкажи приблизну вартість плану, коли вона стане зрозумілою.</p>
      ) : (
        /*
         * Сума стоїть в одному місці, і це тіло блоку, а не кнопка.
         *
         * До цього її несли обидва: кнопка «Змінити бюджет · 25 000 ₴» і
         * рядок «План: 25 000 ₴» під нею. Поки поруч жило порівняння зі
         * «Скарбничкою», тіло блоку мало що додати; коли порівняння пішло
         * (ADR-0049), лишилось те саме число двічі за 40 пікселів.
         */
        <p className="plan-money-sum">
          Очікувана вартість: <b>{fmtMoney(budget)}</b>
        </p>
      )}
    </section>
  );
}
