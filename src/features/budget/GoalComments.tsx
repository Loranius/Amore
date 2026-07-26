import { useEffect, useRef, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import {
  canDeleteGoalComment,
  GOAL_COMMENT_MAX,
  isValidGoalComment,
  normalizeGoalComment,
} from './commentModel';
import { useGoalCommentMutations, useGoalComments } from './useGoalComments';
import type { BudgetGoalRow } from './useBudget';
import './goalComments.css';

function commentMoment(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('uk-UA', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function GoalComments({
  goal,
  onClose,
}: {
  goal: BudgetGoalRow;
  onClose: () => void;
}) {
  const me = useCurrentUser();
  const confirmDialog = useConfirm();
  const [body, setBody] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const { data: comments = [], isPending, isError, refetch } = useGoalComments(goal.id);
  const { addComment, deleteComment } = useGoalCommentMutations(goal.id);
  const busy = addComment.isPending || deleteComment.isPending;
  const valid = isValidGoalComment(body);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [comments.length]);

  const submit = async () => {
    const normalized = normalizeGoalComment(body);
    if (!isValidGoalComment(normalized) || busy) return;

    try {
      await addComment.mutateAsync(normalized);
      setBody('');
    } catch {
      // Тост показує mutation; текст лишається, щоб його можна було повторити.
    }
  };

  const remove = async (commentId: string) => {
    const accepted = await confirmDialog('Видалити цей коментар з обговорення цілі?');
    if (!accepted) return;
    deleteComment.mutate(commentId);
  };

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div
        className="modal-sheet goal-comments-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-comments-title"
      >
        <div className="goal-comments-heading">
          <div>
            <span className="goal-comments-kicker">Обговорення цілі</span>
            <h2 id="goal-comments-title" className="modal-title">{goal.name}</h2>
            <p className="fin-hint">Короткі думки, домовленості та деталі в одному місці.</p>
          </div>
          <button
            type="button"
            className="goal-comments-close"
            onClick={onClose}
            disabled={busy}
            aria-label="Закрити обговорення"
          >
            ×
          </button>
        </div>

        {isPending ? (
          <div className="goal-comments-state">Відкриваємо обговорення…</div>
        ) : isError ? (
          <div className="goal-comments-state">
            Не вдалося завантажити коментарі.
            <button type="button" className="btn-secondary" onClick={() => void refetch()}>
              Спробувати ще
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="goal-comments-empty">
            <span aria-hidden="true">💬</span>
            <p>Тут можна залишити першу коротку думку про цю ціль.</p>
          </div>
        ) : (
          <div className="goal-comments-list" ref={listRef} aria-live="polite">
            {comments.map((comment) => {
              const mine = canDeleteGoalComment(comment.authorId, me.id);
              return (
                <article
                  className={`goal-comment-entry${mine ? ' goal-comment-mine' : ''}`}
                  key={comment.id}
                >
                  <div className="goal-comment-meta">
                    <strong>{comment.authorName}</strong>
                    <time dateTime={comment.createdAt}>{commentMoment(comment.createdAt)}</time>
                  </div>
                  <p>{comment.body}</p>
                  {mine && (
                    <button
                      type="button"
                      className="goal-comment-delete"
                      disabled={busy}
                      onClick={() => void remove(comment.id)}
                    >
                      Видалити
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}

        <div className="goal-comments-composer">
          <label className="form-field">
            <span>Короткий коментар</span>
            <textarea
              id="goal-comment-body"
              name="goal-comment-body"
              rows={3}
              maxLength={GOAL_COMMENT_MAX}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Наприклад: давай оберемо варіант разом у вихідні"
              disabled={busy}
            />
            <small className="goal-comment-counter">
              {body.length}/{GOAL_COMMENT_MAX}
            </small>
          </label>
          <button
            type="button"
            className="btn goal-comment-submit"
            onClick={() => void submit()}
            disabled={busy || !valid}
          >
            {addComment.isPending ? 'Додаємо…' : 'Додати'}
          </button>
        </div>

        <p className="goal-comments-footnote">
          Без статусів прочитання та оцінок — лише контекст для вашої спільної цілі.
        </p>
      </div>
    </div>
  );
}
