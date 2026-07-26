import { useCurrentUser } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import {
  fmtMoney,
  useGoalContributions,
  useGoalMutations,
  type BudgetGoalRow,
} from './useBudget';
import { canCancelContribution } from './contributionModel';

function contributionMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GoalContributions({
  goal,
  onClose,
}: {
  goal: BudgetGoalRow;
  onClose: () => void;
}) {
  const me = useCurrentUser();
  const confirmDialog = useConfirm();
  const { data: contributions = [], isPending, isError, refetch } = useGoalContributions(goal.id);
  const { deleteContribution } = useGoalMutations();

  const saved = Math.max(0, Number(goal.saved_amount ?? 0));
  const target = Math.max(0, Number(goal.target_amount ?? 0));

  const cancelContribution = async (contributionId: string) => {
    const accepted = await confirmDialog(
      'Скасувати цей внесок? Сума буде віднята від спільного прогресу цілі.',
    );
    if (!accepted) return;

    deleteContribution.mutate({ contributionId, goalId: goal.id });
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && !deleteContribution.isPending && onClose()}
    >
      <div
        className="modal-sheet goal-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-history-title"
      >
        <div className="goal-history-heading">
          <div>
            <span className="goal-history-kicker">Історія внесків</span>
            <h2 id="goal-history-title" className="modal-title">{goal.name}</h2>
            <p className="fin-hint">
              Разом накопичено {fmtMoney(saved)} з {fmtMoney(target)}
            </p>
          </div>
          <button
            type="button"
            className="goal-history-close"
            onClick={onClose}
            disabled={deleteContribution.isPending}
            aria-label="Закрити історію"
          >
            ×
          </button>
        </div>

        {isPending ? (
          <div className="goal-history-state">Завантажуємо кроки до цілі…</div>
        ) : isError ? (
          <div className="goal-history-state">
            Не вдалося відкрити історію.
            <button type="button" className="btn-secondary" onClick={() => void refetch()}>
              Спробувати ще
            </button>
          </div>
        ) : contributions.length === 0 ? (
          <div className="goal-history-empty">
            <span aria-hidden="true">✨</span>
            <p>Перший внесок стане початком історії цієї цілі.</p>
          </div>
        ) : (
          <div className="goal-history-list">
            {contributions.map((contribution) => {
              const mine = canCancelContribution(contribution.contributedBy, me.id);
              return (
                <article className="goal-history-entry" key={contribution.id}>
                  <div className="goal-history-entry-main">
                    <strong>+ {fmtMoney(contribution.amount)}</strong>
                    <span className="goal-history-person">{contribution.contributorName}</span>
                    {contribution.note && (
                      <p className="goal-history-note">«{contribution.note}»</p>
                    )}
                  </div>
                  <div className="goal-history-entry-meta">
                    <time dateTime={contribution.createdAt}>
                      {contributionMoment(contribution.createdAt)}
                    </time>
                    {mine && (
                      <button
                        type="button"
                        className="goal-history-cancel"
                        disabled={deleteContribution.isPending}
                        onClick={() => void cancelContribution(contribution.id)}
                      >
                        Скасувати
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="goal-history-footnote">
          Тут немає порівнянь чи рейтингів — лише спільні кроки до бажаного.
        </p>
      </div>
    </div>
  );
}
