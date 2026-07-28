// ============================================================
// Гроші плану: бюджет і цілі скарбнички під нього.
// ------------------------------------------------------------
// Досі «скільки це коштуватиме» і «скільки ми зібрали» жили в різних
// кінцях застосунку й не знали одне про одного. Тут вони поруч, і
// питання «чи вистачає нам на Карпати» має одну відповідь замість двох
// напіввідповідей.
//
// Ціль створюється ЗАПРОПОНОВАНОЮ (це правило скарбнички, не наше):
// партнер підтверджує її там само, де й будь-яку іншу. Тому тут прямо
// сказано, що ціль піде на підтвердження — інакше вона виглядала б
// створеною, а в скарбничці чекала б голосу.
// ============================================================
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useConfirm } from '@/providers/ConfirmProvider';
import { CloseIcon, PlusIcon, SwapIcon } from '@/components/icons/UiIcon';
import { PiggyBankIcon } from '@/components/icons/NavIcon';
import { fmtMoney, useGoalMutations, useGoals, type BudgetGoalRow } from '@/features/piggybank/useBudget';
import { goalsOfPlan, planMoney } from './planMoney';
import { usePlanMutations } from './usePlans';
import type { PlanRow } from '@/types';

export function PlanMoneyBlock({ plan, accent }: { plan: PlanRow; accent: string }) {
  const { data: goals = [], isPending } = useGoals();
  const { add, setGoalPlan } = useGoalMutations();
  const { updatePlan } = usePlanMutations();
  const confirmDialog = useConfirm();

  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState('');
  const [creating, setCreating] = useState(false);
  const [linking, setLinking] = useState(false);

  const money = planMoney(plan, goals);
  const mine = goalsOfPlan(plan, goals);
  // Прив'язати можна лише вільну ціль: перевішувати чужу означало б
  // мовчки забрати гроші в іншого плану.
  const free = goals.filter((g) => g.plan_id === null);

  const saveBudget = () => {
    const raw = budgetDraft.trim().replace(/\s/g, '').replace(',', '.');
    const value = raw === '' ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    updatePlan.mutate({ id: plan.id, patch: { budget: value } });
    setEditingBudget(false);
  };

  const unlink = async (goal: BudgetGoalRow) => {
    if (await confirmDialog(`Відв'язати ціль «${goal.name}» від плану? Гроші лишаться у скарбничці.`)) {
      setGoalPlan.mutate({ goalId: goal.id, planId: null });
    }
  };

  return (
    <section className="plan-money">
      <header className="plan-money-head">
        <h3>Гроші</h3>
        {!editingBudget && (
          <button
            type="button"
            className="plan-money-budget-btn"
            onClick={() => {
              setBudgetDraft(plan.budget === null ? '' : String(plan.budget));
              setEditingBudget(true);
            }}
          >
            {plan.budget === null ? 'Додати бюджет' : `Бюджет ${fmtMoney(plan.budget)}`}
          </button>
        )}
      </header>

      {editingBudget && (
        <div className="plan-money-editor">
          <label className="form-field">
            <span>Скільки це коштуватиме</span>
            <input
              id={`plan-budget-${plan.id}`}
              name="budget"
              type="number"
              min="0"
              step="100"
              inputMode="numeric"
              value={budgetDraft}
              placeholder="Порожньо — грошей не потребує"
              onChange={(e) => setBudgetDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') saveBudget(); }}
            />
          </label>
          <div className="plan-money-editor-actions">
            <button type="button" className="btn" onClick={saveBudget}>Зберегти</button>
            <button type="button" className="plan-money-cancel" onClick={() => setEditingBudget(false)}>
              Скасувати
            </button>
          </div>
        </div>
      )}

      {(money.saved > 0 || money.goals > 0) && (
        <>
          <div className="plan-money-bar" aria-hidden="true">
            <span style={{ width: `${money.percent}%`, background: accent }} />
          </div>
          <p className="plan-money-sum">
            Зібрано <b>{fmtMoney(money.saved)}</b>
            {money.gap !== null && money.gap > 0 && <> · лишилось {fmtMoney(money.gap)}</>}
            {money.gap === 0 && plan.budget !== null && <> · бюджет закритий</>}
          </p>
        </>
      )}

      {isPending ? (
        <p className="plan-money-empty">Завантаження…</p>
      ) : mine.length === 0 ? (
        <p className="plan-money-empty">
          Цілей у скарбничці під цей план ще немає.
        </p>
      ) : (
        <ul className="plan-goal-list">
          {mine.map((goal) => (
            <li key={goal.id} className="plan-goal">
              <Link className="plan-goal-open" to="/piggybank">
                <span className="plan-goal-name">
                  {goal.name}
                  {goal.status === 'pending' && <em className="plan-goal-pending">на підтвердженні</em>}
                </span>
                <small>
                  {fmtMoney(goal.saved_amount)} з {fmtMoney(goal.target_amount)}
                </small>
              </Link>
              <button
                type="button"
                className="plan-goal-unlink"
                aria-label={`Відв'язати «${goal.name}» від плану`}
                onClick={() => void unlink(goal)}
              >
                {/* Хрестик, а не кошик: кнопка знімає ЗВ'ЯЗОК, а не
                    видаляє ціль. Кошик поруч із грошима читався б як
                    «стерти накопичення» — і колись хтось на це натиснув би. */}
                <CloseIcon size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="plan-money-actions">
        <button type="button" className="plan-money-action" onClick={() => setCreating(true)}>
          <PlusIcon size={14} /> Збирати в скарбничці
        </button>
        {free.length > 0 && (
          <button type="button" className="plan-money-action" onClick={() => setLinking((v) => !v)}>
            <SwapIcon size={14} /> Прив'язати наявну
          </button>
        )}
      </div>

      {linking && free.length > 0 && (
        <ul className="plan-goal-picker">
          {free.map((goal) => (
            <li key={goal.id}>
              <button
                type="button"
                onClick={() => {
                  setGoalPlan.mutate({ goalId: goal.id, planId: plan.id });
                  setLinking(false);
                }}
              >
                <PiggyBankIcon size={16} />
                <span>{goal.name}</span>
                <small>{fmtMoney(goal.saved_amount)} з {fmtMoney(goal.target_amount)}</small>
              </button>
            </li>
          ))}
        </ul>
      )}

      {creating && (
        <NewGoalForPlan
          plan={plan}
          busy={add.isPending}
          onClose={() => setCreating(false)}
          onSubmit={(name, target) => {
            add.mutate(
              { name, description: null, target_amount: target, url: null, plan_id: plan.id },
              { onSuccess: () => setCreating(false) },
            );
          }}
        />
      )}
    </section>
  );
}

/**
 * Форма нової цілі під план.
 *
 * Назва й сума підставляються з плану: у дев'яти випадках із десяти
 * ціль зветься так само, як план, і дорівнює його бюджету. Лишити поля
 * порожніми означало б змусити двічі набирати те, що вже відоме.
 */
function NewGoalForPlan({ plan, busy, onClose, onSubmit }: {
  plan: PlanRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (name: string, target: number) => void;
}) {
  const [name, setName] = useState(plan.title);
  const [target, setTarget] = useState(plan.budget === null ? '' : String(plan.budget));

  const amount = Number(target.trim().replace(/\s/g, '').replace(',', '.'));
  const valid = name.trim().length > 0 && Number.isFinite(amount) && amount > 0;

  return (
    <div className="plan-money-editor">
      <label className="form-field">
        <span>Назва цілі</span>
        <input
          id={`plan-goal-name-${plan.id}`}
          name="goal_name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="form-field">
        <span>Скільки зібрати</span>
        <input
          id={`plan-goal-target-${plan.id}`}
          name="goal_target"
          type="number"
          min="1"
          step="100"
          inputMode="numeric"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        />
      </label>
      <p className="plan-money-hint">
        Ціль з'явиться у скарбничці як пропозиція — партнер її підтвердить.
      </p>
      <div className="plan-money-editor-actions">
        <button
          type="button"
          className="btn"
          disabled={!valid || busy}
          onClick={() => onSubmit(name.trim(), amount)}
        >
          {busy ? 'Створюю…' : 'Створити ціль'}
        </button>
        <button type="button" className="plan-money-cancel" onClick={onClose}>Скасувати</button>
      </div>
    </div>
  );
}
