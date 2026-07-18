// ============================================================
// ReviewPanel — відгук (порт openReviewPanel)
// ------------------------------------------------------------
// Автор (Діма/Лєна) + оцінка 1–10 + коментар. Перемикання автора
// підтягує його поточні значення.
// ============================================================
import { useState } from 'react';
import type { MediaItemRow } from '@/types';
import type { ReviewWho } from './useMedia';

interface ReviewPanelProps {
  item: MediaItemRow;
  preselect?: ReviewWho;
  onClose: () => void;
  onSave: (v: { id: number; who: ReviewWho; rating: number | null; comment: string | null }) => void;
}

export function ReviewPanel({ item, preselect = 'dima', onClose, onSave }: ReviewPanelProps) {
  const [who, setWho] = useState<ReviewWho>(preselect);
  const curRating = who === 'dima' ? item.rating_dima : item.rating_lena;
  const curComment = who === 'dima' ? item.comment_dima : item.comment_lena;

  const [score, setScore] = useState<number | null>(curRating);
  const [comment, setComment] = useState(curComment ?? '');

  const switchWho = (w: ReviewWho) => {
    setWho(w);
    setScore(w === 'dima' ? item.rating_dima : item.rating_lena);
    setComment((w === 'dima' ? item.comment_dima : item.comment_lena) ?? '');
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
        <h2 className="modal-title">Відгук — {item.title}</h2>

        <div className="form-field">
          <span>Хто залишає відгук</span>
          <div className="chips">
            <button type="button" className={`chip${who === 'dima' ? ' active' : ''}`} onClick={() => switchWho('dima')}>
              Діма
            </button>
            <button type="button" className={`chip${who === 'lena' ? ' active' : ''}`} onClick={() => switchWho('lena')}>
              Лєна
            </button>
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
