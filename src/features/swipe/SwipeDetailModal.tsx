// ============================================================
// SwipeDetailModal — деталі картки свайпу + трейлер (порт openDetailModal)
// ============================================================
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tmdbTrailer } from '@/lib/tmdb';
import type { SwipeCard, SwipeType } from '@/types';

interface Props {
  card: SwipeCard;
  type: SwipeType;
  onClose: () => void;
}

export function SwipeDetailModal({ card, type, onClose }: Props) {
  const { data: trailerKey, isPending } = useQuery({
    queryKey: ['tmdb', 'trailer', type, card.tmdb_id],
    staleTime: 30 * 60_000,
    queryFn: () => tmdbTrailer(type, card.tmdb_id),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-sheet detail-modal" role="dialog" aria-modal="true">
        {card.poster_path && <img className="detail-poster" src={card.poster_path} alt="" />}
        <h3 className="detail-title">{card.title}</h3>
        <div className="detail-meta">
          {card.year && <span>{card.year}</span>}
          {card.rating && <span>★ {card.rating}</span>}
        </div>
        {card.overview && <p className="detail-overview">{card.overview}</p>}

        <div className="detail-trailer">
          {isPending ? (
            <p className="detail-no-trailer">⏳ Шукаємо трейлер…</p>
          ) : trailerKey ? (
            <div className="detail-player-wrap">
              <iframe
                className="detail-player"
                src={`https://www.youtube.com/embed/${trailerKey}?rel=0`}
                allowFullScreen
                title="Трейлер"
              />
            </div>
          ) : (
            <p className="detail-no-trailer">Трейлер не знайдено</p>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
