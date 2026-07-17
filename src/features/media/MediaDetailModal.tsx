// ============================================================
// MediaDetailModal — деталі з TMDB + трейлер + відгуки (порт openMediaDetailModal)
// ------------------------------------------------------------
// TMDB-деталі тягне useTmdbDetails; трейлер вбудовується у <iframe>
// лише за кліком (не автозавантаження). Відгуки — з рядка item.
// ============================================================
import { useEffect, useState } from 'react';
import { useTmdbDetails } from './useTmdb';
import type { MediaItemRow } from '@/types';
import type { ReviewWho } from './useMedia';

interface MediaDetailModalProps {
  item: MediaItemRow;
  onClose: () => void;
  onEdit: (item: MediaItemRow) => void;
  onReview: (item: MediaItemRow, who: ReviewWho) => void;
}

export function MediaDetailModal({ item, onClose, onEdit, onReview }: MediaDetailModalProps) {
  const { data: details, isPending } = useTmdbDetails(item);
  const [playTrailer, setPlayTrailer] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const poster = details?.poster ?? item.poster_url;

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-sheet media-detail-modal" role="dialog" aria-modal="true">
        <div className="media-detail-backdrop">
          {details?.backdrop && <img className="media-detail-backdrop-img" src={details.backdrop} alt="" />}
          <div className="media-detail-hero">
            {poster ? (
              <img className="media-detail-poster" src={poster} alt="" />
            ) : (
              <div className="media-detail-poster-ph">🎬</div>
            )}
            <div className="media-detail-hero-info">
              <div className="media-detail-title">{details?.title ?? item.title}</div>
              <div className="media-detail-meta">
                {isPending ? (
                  <span className="media-detail-badge">⏳ Завантаження…</span>
                ) : details ? (
                  <>
                    {details.year && <span className="media-detail-badge">{details.year}</span>}
                    {details.rating && <span className="media-detail-rating-star">★ {details.rating}</span>}
                    {details.runtime && <span className="media-detail-badge">{details.runtime} хв</span>}
                    {details.genres.map((g) => (
                      <span key={g} className="media-detail-badge">
                        {g}
                      </span>
                    ))}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="media-detail-body">
          {details?.overview && <p className="media-detail-overview">{details.overview}</p>}

          {!isPending &&
            (details?.youtubeKey ? (
              playTrailer ? (
                <div className="media-detail-trailer">
                  <iframe
                    src={`https://www.youtube.com/embed/${details.youtubeKey}?autoplay=1`}
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title="Трейлер"
                  />
                </div>
              ) : (
                <button type="button" className="media-detail-trailer-btn" onClick={() => setPlayTrailer(true)}>
                  ▶ Дивитись трейлер на YouTube
                </button>
              )
            ) : (
              details === null && <div className="media-detail-trailer-loading">Не вдалось завантажити дані TMDB</div>
            ))}

          <div className="media-detail-reviews">
            <div className="media-detail-reviews-title">Відгуки</div>
            {(['dima', 'lena'] as ReviewWho[]).map((who) => {
              const rating = who === 'dima' ? item.rating_dima : item.rating_lena;
              const comment = who === 'dima' ? item.comment_dima : item.comment_lena;
              return (
                <div key={who} className="media-detail-review-row">
                  <span className="media-detail-review-who">{who === 'dima' ? 'Діма' : 'Лєна'}</span>
                  <span className="media-detail-review-rating">{rating ? `★ ${rating}/10` : '—'}</span>
                  <span className="media-detail-review-comment">
                    {comment || <i style={{ color: 'var(--muted)' }}>Немає відгуку</i>}
                  </span>
                  <button
                    type="button"
                    className="media-detail-review-edit"
                    onClick={() => onReview(item, who)}
                  >
                    ✏️
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Закрити
          </button>
          <button type="button" className="btn" onClick={() => onEdit(item)}>
            ✏️ Редагувати
          </button>
        </div>
      </div>
    </div>
  );
}
