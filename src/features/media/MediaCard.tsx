// ============================================================
// MediaCard — картка елемента списку (порт media-card)
// ============================================================
import { StarIcon } from '@/components/icons/UiIcon';
import { FilmIcon } from '@/components/icons/NavIcon';
import { PencilIcon, PlusIcon, TrashIcon } from '@/components/icons/UiIcon';
import { STATUS_CONFIG } from './mediaConstants';
import { usePeople } from '@/features/_shared/useUsers';
import type { MediaItem } from '@/types';

interface MediaCardProps {
  item: MediaItem;
  onOpen: (item: MediaItem) => void;
  onReview: (item: MediaItem) => void;
  onDelete: (id: number) => void;
}

export function MediaCard({ item, onOpen, onReview, onDelete }: MediaCardProps) {
  const statusLabel = STATUS_CONFIG[item.type][item.status];
  const people = usePeople();
  const hasReviews = item.reviews.length > 0;
  // Оцінки — у порядку людей пари, з першою літерою підпису замість
  // вшитих «Д:»/«Л:».
  const ratings = people
    .map((person) => ({ person, rating: item.reviews.find((r) => r.user_id === person.id)?.rating ?? null }))
    .filter((one): one is { person: typeof one.person; rating: number } => one.rating !== null);

  return (
    <div className="media-card">
      <button type="button" className="media-poster-wrap" onClick={() => onOpen(item)} title="Детальніше">
        {item.poster_url ? (
          <img className="media-poster" src={item.poster_url} alt={item.title} loading="lazy" />
        ) : (
          <div className="media-poster-placeholder" aria-hidden="true"><FilmIcon size={26} /></div>
        )}
      </button>

      <div className="media-card-body">
        <p className="media-card-title">{item.title}</p>
        <span className="media-status-badge">{statusLabel}</span>
        <button type="button" className="media-review-btn" onClick={() => onReview(item)}>
          {hasReviews ? <PencilIcon size={14} /> : <PlusIcon size={14} />}
          <span>Відгук</span>
        </button>
        {ratings.length > 0 && (
          <div className="media-ratings-mini">
            {ratings.map(({ person, rating }) => (
              <span key={person.id} className="media-rating-mini" title={person.displayName}>
                <StarIcon size={11} /> {person.displayName.slice(0, 1)}: {rating}/10
              </span>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className="delete-btn media-card-delete"
        onClick={() => onDelete(item.id)}
        aria-label="Видалити"
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
}
