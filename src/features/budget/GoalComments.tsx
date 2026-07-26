import { useEffect, useMemo, useRef, useState } from 'react';
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
  return date.toLocaleTimeString('uk-UA', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function commentDayKey(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function commentDayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const difference = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86_400_000);

  if (difference === 0) return 'Сьогодні';
  if (difference === 1) return 'Вчора';

  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  });
}

function commentCountLabel(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo >= 11 && lastTwo <= 14) return `${count} повідомлень`;
  if (last === 1) return `${count} повідомлення`;
  if (last >= 2 && last <= 4) return `${count} повідомлення`;
  return `${count} повідомлень`;
}

function authorInitial(name: string): string {
  return name.trim().charAt(0).toLocaleUpperCase('uk-UA') || '•';
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
  const paused = goal.paused_at !== null;

  const commentsWithDays = useMemo(() => comments.map((comment, index) => {
    const dayKey = commentDayKey(comment.createdAt);
    const previousDayKey = index > 0 ? commentDayKey(comments[index - 1]!.createdAt) : null;
    return {
      comment,
      dayKey,
      showDay: dayKey !== previousDayKey,
    };
  }), [comments]);

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
      className="modal-overlay goal-comments-overlay"
      onClick={(event) => event.target === event.currentTarget && !busy && onClose()}
    >
      <div
        className="modal-sheet goal-comments-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goal-comments-title"
      >
        <header className="goal-comments-heading">
          <div className="goal-comments-title-row">
            <span className="goal-comments-title-icon" aria-hidden="true">▱</span>
            <div>
              <span className="goal-comments-kicker">Обговорення цілі</span>
              <h2 id="goal-comments-title" className="modal-title">{goal.name}</h2>
              <p>Короткі думки, домовленості й деталі саме про цю ціль.</p>
            </div>
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
        </header>

        <div className="goal-comments-summary" aria-label="Стан обговорення">
          <span className={paused ? 'is-paused' : 'is-active'}>
            <span aria-hidden="true">{paused ? 'Ⅱ' : '●'}</span>
            {paused ? 'Ціль на паузі' : 'Активна ціль'}
          </span>
          <span>{commentCountLabel(comments.length)}</span>
        </div>

        {isPending ? (
          <div className="goal-comments-state">Відкриваємо обговорення…</div>
        ) : isError ? (
          <div className="goal-comments-state">
            <span>Не вдалося завантажити коментарі.</span>
            <button type="button" className="btn-secondary" onClick={() => void refetch()}>
              Спробувати ще
            </button>
          </div>
        ) : comments.length === 0 ? (
          <div className="goal-comments-empty">
            <span className="goal-comments-empty-icon" aria-hidden="true">▱</span>
            <strong>Тут поки тихо</strong>
            <p>Залиште першу коротку думку або домовленість про цю ціль.</p>
          </div>
        ) : (
          <div className="goal-comments-list" ref={listRef} aria-live="polite">
            {commentsWithDays.map(({ comment, dayKey, showDay }) => {
              const mine = canDeleteGoalComment(comment.authorId, me.id);
              return (
                <div className="goal-comment-group" key={comment.id}>
                  {showDay && (
                    <div className="goal-comment-day" key={`day-${dayKey}`}>
                      <span>{commentDayLabel(comment.createdAt)}</span>
                    </div>
                  )}
                  <article className={`goal-comment-row${mine ? ' is-mine' : ' is-partner'}`}>
                    <span className="goal-comment-avatar" aria-hidden="true">
                      {authorInitial(comment.authorName)}
                    </span>
                    <div className="goal-comment-bubble">
                      <div className="goal-comment-meta">
                        <strong>{mine ? 'Ви' : comment.authorName}</strong>
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
                    </div>
                  </article>
                </div>
              );
            })}
          </div>
        )}

        <div className="goal-comments-composer">
          <label htmlFor="goal-comment-body">Додати коротку думку</label>
          <div className="goal-comments-compose-row">
            <textarea
              id="goal-comment-body"
              name="goal-comment-body"
              rows={2}
              maxLength={GOAL_COMMENT_MAX}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              onKeyDown={(event) => {
                if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                  event.preventDefault();
                  void submit();
                }
              }}
              placeholder="Наприклад: давай оберемо варіант разом у вихідні"
              disabled={busy}
            />
            <button
              type="button"
              className="btn goal-comment-submit"
              onClick={() => void submit()}
              disabled={busy || !valid}
              aria-label="Надіслати коментар"
            >
              <span>{addComment.isPending ? 'Додаємо…' : 'Надіслати'}</span>
              <span aria-hidden="true">↑</span>
            </button>
          </div>
          <div className="goal-comments-composer-meta">
            <small>Ctrl/⌘ + Enter — надіслати</small>
            <small>{body.length}/{GOAL_COMMENT_MAX}</small>
          </div>
        </div>

        <p className="goal-comments-footnote">
          Без статусів прочитання й оцінок — лише контекст для вашої спільної цілі.
        </p>
      </div>
    </div>
  );
}
