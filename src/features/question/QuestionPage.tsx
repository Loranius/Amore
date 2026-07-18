// ============================================================
// QuestionPage — питання дня (порт question.js UI)
// ============================================================
import { useEffect, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import {
  todayStr,
  formatToday,
  useDailyQuestion,
  useQuestionLog,
  useQuestionMutations,
} from './useQuestion';

export function QuestionPage() {
  const me = useCurrentUser();
  const date = todayStr();

  const { data: question, isPending: qLoading } = useDailyQuestion(date);
  const { data: log } = useQuestionLog(date, question?.id ?? null);
  const { save, remove, field } = useQuestionMutations(date);

  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);

  // Підставляємо збережену відповідь у поле — але не поки користувач пише.
  const myAnswer = field ? (log?.[field] ?? null) : null;
  useEffect(() => {
    if (!focused) setDraft(myAnswer ?? '');
  }, [myAnswer, focused]);

  const onSave = () => {
    const t = draft.trim();
    if (!t) return;
    save.mutate(t);
  };
  const onDelete = () => {
    if (confirm('Видалити свою відповідь?')) remove.mutate();
  };

  return (
    <section className="question">
      <p className="question-date">{formatToday()}</p>

      <div className="question-card">
        <p className="question-text">
          {qLoading ? '🔮 Клод вигадує питання…' : (question?.text ?? 'Не вдалось отримати питання дня.')}
        </p>
      </div>

      {question && (
        <>
          <div className="question-answers">
            <AnswerBlock
              name="Діма"
              text={log?.answer_dima ?? null}
              canDelete={field === 'answer_dima' && !!log?.answer_dima}
              onDelete={onDelete}
            />
            <AnswerBlock
              name="Лєна"
              text={log?.answer_lena ?? null}
              canDelete={field === 'answer_lena' && !!log?.answer_lena}
              onDelete={onDelete}
            />
          </div>

          {field && (
            <div className="question-input-wrap">
              <textarea
                className="question-input"
                rows={3}
                placeholder="Твоя відповідь…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
              <button
                type="button"
                className="btn question-save"
                onClick={onSave}
                disabled={!draft.trim() || save.isPending}
              >
                {myAnswer ? 'Оновити відповідь' : 'Зберегти'}
              </button>
            </div>
          )}
          {!field && (
            <p className="empty-state">Твій акаунт не {me.name} — поле відповіді приховано.</p>
          )}
        </>
      )}
    </section>
  );
}

function AnswerBlock({
  name,
  text,
  canDelete,
  onDelete,
}: {
  name: string;
  text: string | null;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="answer-block">
      {canDelete && (
        <button type="button" className="delete-btn" onClick={onDelete} aria-label="Видалити відповідь">
          ×
        </button>
      )}
      <p className="answer-name">{name}</p>
      {text ? (
        <p className="answer-text">{text}</p>
      ) : (
        <p className="answer-text empty">Ще немає відповіді</p>
      )}
    </div>
  );
}
