// ============================================================
// MediaCard — картка елемента списку (порт media-card)
// ============================================================
import { STATUS_CONFIG } from './mediaConstants';
import type { MediaItemRow } from '@/types';

interface MediaCardProps {
  item: MediaItemRow;
  onOpen: (item: MediaItemRow) => void;
  onReview: (item: MediaItemRow) => void;
  onDelete: (id: number) => void;
}

export function MediaCard({ item, onOpen, onReview, onDelete }: MediaCardProps) {
  const statusLabel = STATUS_CONFIG[item.type][item.status];
  const rD = item.rating_dima ? `★ ${item.rating_dima}/10` : null;
  const rL = item.rating_lena ? `★ ${item.rating_lena}/10` : null;
  const hasReviews = rD || rL || item.comment_dima || item.comment_lena;

  return (
    <div className="media-card">
      <button type="button" className="media-poster-wrap" onClick={() => onOpen(item)} title="Детальніше">
        {item.poster_url ? (
          <img className="media-poster" src={item.poster_url} alt={item.title} loading="lazy" />
        ) : (
          <div className="media-poster-placeholder">🎬</div>
        )}
      </button>

      <div className="media-card-body">
        <p className="media-card-title">{item.title}</p>
        <span className="media-status-badge">{statusLabel}</span>
        <button type="button" className="media-review-btn" onClick={() => onReview(item)}>
          {hasReviews ? '✏️ Відгук' : '+ Відгук'}
        </button>
        {(rD || rL) && (
          <div className="media-ratings-mini">
            {rD && <span className="media-rating-mini">Д: {rD}</span>}
            {rL && <span className="media-rating-mini">Л: {rL}</span>}
          </div>
        )}
      </div>

      <button
        type="button"
        className="delete-btn media-card-delete"
        onClick={() => onDelete(item.id)}
        aria-label="Видалити"
      >
        ×
      </button>
    </div>
  );
}
