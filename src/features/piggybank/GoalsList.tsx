// ============================================================
// GoalsList — спільні цілі
// ------------------------------------------------------------
// Pending-цілі лишаються у безпечному сценарії голосування.
// Підтверджені цілі мають власну мобільну композицію: картка дій,
// окремий прогрес і окремий м’який прогноз.
// ============================================================
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { ProposalCard } from '@/components/ui/ProposalCard';
import { GoalComments } from './GoalComments';
import { GoalContributions } from './GoalContributions';
import { GoalDesiredDateModal, GoalForecastCard } from './GoalForecast';
import { GoalMilestones } from './GoalMilestones';
import { useGoalForecastMutations, useGoalForecasts } from './useGoalForecast';
import { SparkIcon } from '@/components/icons/EventIcon';
import { PlansIcon } from '@/components/icons/NavIcon';
import { usePlans } from '@/features/plans/usePlans';
import { TargetIcon } from '@/components/icons/PlanIcon';
import { CheckIcon, CommentIcon, ExternalLinkIcon, ListIcon, PauseIcon, PlayIcon } from '@/components/icons/UiIcon';
import {
  CONTRIBUTION_NOTE_MAX,
  isValidContributionAmount,
  normalizeContributionNote,
} from './contributionModel';
import {
  fmtMoney,
  useGoals,
  useGoalMutations,
  type BudgetGoalRow,
  type NewGoalInput,
} from './useBudget';

export function GoalsList() {
  const me = useCurrentUser();
  const confirmDialog = useConfirm();
  const { data: goals = [], isPending, isError, refetch } = useGoals();
  const { data: forecasts = [], isPending: forecastsPending } = useGoalForecasts();
  const {
    add,
    confirm,
    reject,
    remove,
    pause,
    resume,
    addContribution,
  } = useGoalMutations();
  const { setDesiredDate } = useGoalForecastMutations();
  // Лише назви: сама сторінка плану лишається за посиланням, а тягнути
  // сюди весь модуль планів заради одного рядка не треба.
  const { data: plans = [] } = usePlans();
  const planTitles = new Map(plans.map((p) => [p.id, p.title]));

  const [adding, setAdding] = useState(false);
  const [funding, setFunding] = useState<BudgetGoalRow | null>(null);
  const [historyGoalId, setHistoryGoalId] = useState<string | null>(null);
  const [commentsGoalId, setCommentsGoalId] = useState<string | null>(null);
  const [dateGoalId, setDateGoalId] = useState<string | null>(null);

  const forecastByGoal = new Map(forecasts.map((forecast) => [forecast.goalId, forecast]));
  const historyGoal = historyGoalId
    ? goals.find((goal) => goal.id === historyGoalId) ?? null
    : null;
  const commentsGoal = commentsGoalId
    ? goals.find((goal) => goal.id === commentsGoalId) ?? null
    : null;
  const dateGoal = dateGoalId
    ? goals.find((goal) => goal.id === dateGoalId) ?? null
    : null;
  const dateForecast = dateGoalId ? forecastByGoal.get(dateGoalId) ?? null : null;

  const deleteConfirmedGoal = async (goal: BudgetGoalRow) => {
    const accepted = await confirmDialog(`Видалити ціль «${goal.name}» разом з її історією?`);
    if (accepted) remove.mutate(goal.id);
  };

  return (
    <section className="finance-goals" aria-labelledby="finance-goals-title">
      <header className="finance-goals-hero">
        <span className="finance-goals-hero-icon" aria-hidden="true"><TargetIcon size={26} /></span>
        <div className="finance-goals-hero-copy">
          <h2 id="finance-goals-title">Спільні цілі</h2>
          <p>Крок за кроком до наших мрій</p>
        </div>
        <button type="button" className="btn finance-add-goal-btn" onClick={() => setAdding(true)}>
          + Ціль
        </button>
      </header>

      {isPending ? (
        <div className="finance-goals-state">Завантаження…</div>
      ) : isError ? (
        /* Без цієї гілки провал запиту виглядав як «цілей ще немає»:
           `goals` порожній, isPending уже false — і екран впевнено
           повідомляв, що спільних цілей не існує. Помилку треба називати
           помилкою й давати кнопку повтору, як це вже роблять історія
           внесків, обговорення та архів бажань. */
        <div className="finance-goals-state" role="alert">
          <span>Не вдалося завантажити цілі.</span>
          <button type="button" className="btn-secondary" onClick={() => void refetch()}>
            Спробувати ще
          </button>
        </div>
      ) : goals.length === 0 ? (
        <div className="finance-goals-empty">
          <SparkIcon size={26} />
          <strong>Спільних цілей ще немає</strong>
          <p>Створіть першу мрію, до якої хочеться рухатися разом.</p>
        </div>
      ) : (
        <div className="goals-list">
          {goals.map((goal) => {
            const pending = goal.status === 'pending';
            const paused = goal.paused_at !== null;
            const target = Math.max(0, Number(goal.target_amount ?? 0));
            const saved = Math.max(0, Number(goal.saved_amount ?? 0));
            const pauseBusy = pause.isPending && pause.variables === goal.id;
            const resumeBusy = resume.isPending && resume.variables === goal.id;
            const contributionBusy = addContribution.isPending
              && addContribution.variables?.id === goal.id;

            if (pending) {
              return (
                <div className="finance-pending-card" key={goal.id}>
                  <ProposalCard
                    pending
                    proposedBy={goal.proposed_by ?? ''}
                    meName={me.name}
                    onConfirm={() => confirm.mutate(goal.id)}
                    onReject={() => reject.mutate(goal.id)}
                    onDelete={() => remove.mutate(goal.id)}
                    info={
                      <>
                        <span className="goal-row-name">{goal.name}</span>
                        {/* Саме тут план потрібен найбільше: партнер бачить
                            пропозицію першим і мусить розуміти, на що
                            голосує, не відкриваючи інший розділ. */}
                        {goal.plan_id !== null && planTitles.has(goal.plan_id) && (
                          <Link className="finance-goal-plan" to={`/plans/${goal.plan_id}`}>
                            <PlansIcon size={12} /> {planTitles.get(goal.plan_id)}
                          </Link>
                        )}
                        {goal.description && <span className="goal-row-desc">{goal.description}</span>}
                        {goal.url && (
                          <a className="goal-row-link" href={goal.url} target="_blank" rel="noopener noreferrer">
                            Відкрити посилання
                          </a>
                        )}
                      </>
                    }
                    extraActions={<span className="goal-row-price">{fmtMoney(target)}</span>}
                  />
                </div>
              );
            }

            return (
              <article className={`finance-goal${paused ? ' is-paused' : ''}`} key={goal.id}>
                <section className="finance-goal-main-card">
                  <header className="finance-goal-head">
                    <span className="finance-goal-cover" aria-hidden="true"><TargetIcon size={22} /></span>
                    <div className="finance-goal-heading-copy">
                      <h3>{goal.name}</h3>
                      {/* Зв'язок мусить читатись з обох боків: зі сторінки
                          плану видно ціль, а тут — заради чого збираємо.
                          Інакше «Карпати» у скарбничці лишались би просто
                          сумою без причини. */}
                      {goal.plan_id !== null && planTitles.has(goal.plan_id) && (
                        <Link className="finance-goal-plan" to={`/plans/${goal.plan_id}`}>
                          <PlansIcon size={12} /> {planTitles.get(goal.plan_id)}
                        </Link>
                      )}
                      {goal.description && <p>{goal.description}</p>}
                      {goal.url && (
                        <a href={goal.url} target="_blank" rel="noopener noreferrer">
                          Відкрити посилання <ExternalLinkIcon size={13} />
                        </a>
                      )}
                    </div>
                    <strong className="finance-goal-target">{fmtMoney(target)}</strong>
                  </header>

                  <div className="finance-goal-actions" aria-label="Дії з ціллю">
                    <button type="button" onClick={() => setHistoryGoalId(goal.id)}>
                      <ListIcon size={16} />
                      Історія
                    </button>
                    <button type="button" onClick={() => setCommentsGoalId(goal.id)}>
                      <CommentIcon size={16} />
                      Обговорення
                    </button>
                    <button
                      type="button"
                      onClick={() => paused ? resume.mutate(goal.id) : pause.mutate(goal.id)}
                      disabled={pause.isPending || resume.isPending}
                    >
                      {paused ? <PlayIcon size={15} /> : <PauseIcon size={15} />}
                      {paused
                        ? (resumeBusy ? 'Відновлюємо…' : 'Відновити')
                        : (pauseBusy ? 'Зупиняємо…' : 'Пауза')}
                    </button>
                  </div>

                  {paused ? (
                    <div className="finance-goal-paused-note">
                      Накопичення призупинено. Прогрес та вся історія збережені.
                    </div>
                  ) : (
                    <QuickContribution
                      goal={goal}
                      busy={contributionBusy}
                      onDetailed={() => setFunding(goal)}
                      onSubmit={(amount) => addContribution.mutateAsync({
                        id: goal.id,
                        amount,
                        note: null,
                      })}
                    />
                  )}

                  <footer className="finance-goal-status-row">
                    <span className={paused ? 'is-paused' : 'is-confirmed'}>
                      {paused ? <PauseIcon size={14} /> : <CheckIcon size={14} />}
                      {paused ? 'На паузі' : 'Підтверджено'}
                    </span>
                    <button
                      type="button"
                      className="finance-goal-delete"
                      onClick={() => void deleteConfirmedGoal(goal)}
                      disabled={remove.isPending}
                      aria-label={`Видалити ціль ${goal.name}`}
                    >
                      ×
                    </button>
                  </footer>
                </section>

                <GoalMilestones savedAmount={saved} targetAmount={target} />
                <GoalForecastCard
                  forecast={forecastByGoal.get(goal.id) ?? null}
                  isLoading={forecastsPending}
                  paused={paused}
                  onEdit={() => setDateGoalId(goal.id)}
                />
              </article>
            );
          })}
        </div>
      )}

      {adding && (
        <AddGoalModal
          onClose={() => setAdding(false)}
          onSubmit={(value) => add.mutateAsync(value)}
        />
      )}
      {funding && (
        <AddFundsModal
          goal={funding}
          onClose={() => setFunding(null)}
          onSubmit={({ amount, note }) =>
            addContribution.mutateAsync({ id: funding.id, amount, note })
          }
        />
      )}
      {historyGoal && (
        <GoalContributions
          goal={historyGoal}
          onClose={() => setHistoryGoalId(null)}
        />
      )}
      {commentsGoal && (
        <GoalComments
          goal={commentsGoal}
          onClose={() => setCommentsGoalId(null)}
        />
      )}
      {dateGoal && (
        <GoalDesiredDateModal
          goalName={dateGoal.name}
          currentDate={dateForecast?.desiredDate ?? null}
          onClose={() => setDateGoalId(null)}
          onSubmit={(desiredDate) =>
            setDesiredDate.mutateAsync({ goalId: dateGoal.id, desiredDate })
          }
        />
      )}
    </section>
  );
}

function QuickContribution({
  goal,
  busy,
  onDetailed,
  onSubmit,
}: {
  goal: BudgetGoalRow;
  busy: boolean;
  onDetailed: () => void;
  onSubmit: (amount: number) => Promise<unknown>;
}) {
  const [amount, setAmount] = useState('');
  const contribution = Number(amount);
  const valid = isValidContributionAmount(contribution);

  const save = async () => {
    if (!valid || busy) return;
    await onSubmit(contribution);
    setAmount('');
  };

  return (
    <div className="finance-quick-contribution">
      <div className="finance-quick-label">
        <label htmlFor={`goal-quick-${goal.id}`}>Внести велику суму</label>
        <button type="button" onClick={onDetailed}>Додати примітку</button>
      </div>
      <div className="finance-quick-field">
        <input
          id={`goal-quick-${goal.id}`}
          name={`goal-quick-${goal.id}`}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void save();
          }}
          placeholder="Введіть суму"
        />
        <button type="button" onClick={() => void save()} disabled={!valid || busy}>
          {busy ? 'Вносимо…' : 'Внести'}
        </button>
      </div>
    </div>
  );
}

// ── Модалка: нова ціль ───────────────────────────────────────
function AddGoalModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (value: NewGoalInput) => Promise<unknown>;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const targetAmount = Number(price);
  const validTarget = Number.isFinite(targetAmount) && targetAmount > 0;

  const save = async () => {
    const normalizedName = name.trim();
    if (!normalizedName || !validTarget || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({
        name: normalizedName,
        description: description.trim() || null,
        target_amount: targetAmount,
        url: url.trim() || null,
      });
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && !submitting && onClose()}
    >
      <div className="modal-sheet finance-modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Спільна ціль</h2>
        <label className="form-field">
          <span>Назва</span>
          <input
            id="goal-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Що плануємо?"
            autoFocus
          />
        </label>
        <label className="form-field">
          <span>Навіщо</span>
          <input
            id="goal-description"
            name="description"
            type="text"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Опис"
          />
        </label>
        <label className="form-field">
          <span>Вартість, ₴</span>
          <input
            id="goal-price"
            name="price"
            type="number"
            min={1}
            step={1}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            placeholder="0"
          />
        </label>
        <label className="form-field">
          <span>Посилання</span>
          <input
            id="goal-url"
            name="url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://…"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void save()}
            disabled={submitting || !name.trim() || !validTarget}
          >
            {submitting ? 'Надсилаємо…' : 'Відправити →'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Модалка: внесок із приміткою ──────────────────────────────
function AddFundsModal({
  goal,
  onClose,
  onSubmit,
}: {
  goal: BudgetGoalRow;
  onClose: () => void;
  onSubmit: (input: { amount: number; note: string | null }) => Promise<unknown>;
}) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const saved = Math.max(0, Number(goal.saved_amount ?? 0));
  const contribution = Number(amount);
  const validContribution = isValidContributionAmount(contribution);

  const save = async () => {
    if (!validContribution || submitting) return;

    setSubmitting(true);
    try {
      await onSubmit({
        amount: contribution,
        note: normalizeContributionNote(note),
      });
      onClose();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && !submitting && onClose()}
    >
      <div className="modal-sheet finance-modal-sheet" role="dialog" aria-modal="true">
        <h2 className="modal-title">Внесок у ціль</h2>
        <p className="fin-hint">
          «{goal.name}» — накопичено {fmtMoney(saved)} з {fmtMoney(goal.target_amount)}
        </p>
        <label className="form-field">
          <span>Сума внеску, ₴</span>
          <input
            id="goal-funds-amount"
            name="amount"
            type="number"
            min={1}
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="0 ₴"
            autoFocus
          />
        </label>
        <label className="form-field">
          <span>Коротка примітка <small>необов’язково</small></span>
          <textarea
            id="goal-funds-note"
            name="note"
            rows={3}
            maxLength={CONTRIBUTION_NOTE_MAX}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Наприклад: ще один крок до подорожі"
          />
          <small className="goal-note-counter">
            {note.length}/{CONTRIBUTION_NOTE_MAX}
          </small>
        </label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>
            Скасувати
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => void save()}
            disabled={submitting || !validContribution}
          >
            {submitting ? 'Додаємо…' : 'Додати внесок'}
          </button>
        </div>
      </div>
    </div>
  );
}
