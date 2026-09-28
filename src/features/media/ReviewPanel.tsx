// ============================================================
// ReviewPanel — відгук (порт openReviewPanel)
// ------------------------------------------------------------
// Автор (хтось із пари) + оцінка 1–10 + коментар. Перемикання автора
// підтягує його поточні значення.
// ============================================================
import { useState } from 'react';
import { ModalClose } from '@/components/ui/ModalClose';
import { usePeople } from '@/features/_shared/useUsers';
import type { MediaItem } from '@/types';
import { reviewOf, type ReviewWho } from './useMedia';

interface ReviewPanelProps {
  item: MediaItem;
  /** Чий відгук відкрити першим — id людини пари. */
  preselect: ReviewWho;
  onClose: () => void;
  onSave: (v: { id: number; who: ReviewWho; rating: number | null; comment: string | null }) => void;
}

export function ReviewPanel({ item, preselect, onClose, onSave }: ReviewPanelProps) {
  const people = usePeople();
  const [who, setWho] = useState<ReviewWho>(preselect);
  const current = reviewOf(item, who);

  const [score, setScore] = useState<number | null>(current?.rating ?? null);
  const [comment, setComment] = useState(current?.comment ?? '');

  const switchWho = (w: ReviewWho) => {
    const next = reviewOf(item, w);
    setWho(w);
    setScore(next?.rating ?? null);
    setComment(next?.comment ?? '');
  };

  const save = () => {
    onSave({ id: item.id, who, rating: score, comment: comment.trim() || null });
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet" role="dialog" aria-modal="true">
        <ModalClose onClose={onClose} />
        <h2 className="modal-title">Відгук — {item.title}</h2>

        <div className="form-field">
          <span>Хто залишає відгук</span>
          <div className="chips">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                className={`chip${who === person.id ? ' active' : ''}`}
                onClick={() => switchWho(person.id)}
              >
                {person.displayName}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <span>Оцінка (1–10)</span>
          <div className="rate-number-row">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                className={`rate-num-btn${score === n ? ' active' : ''}`}
                onClick={() => setScore(n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <label className="form-field">
          <span>Коментар</span>
          <textarea
            id="media-review-comment"
            name="comment"
            rows={3}
            placeholder="Враження, думки…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Скасувати
          </button>
          <button type="button" className="btn" onClick={save}>
            Зберегти
          </button>
        </div>
      </div>
    </div>
  );
}
