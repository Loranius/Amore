// ============================================================
// WishArchive — Gift Archive виконаних бажань
// ------------------------------------------------------------
// Показується лише у власному списку. Дані вантажаться ліниво —
// тільки коли блок розгорнуто (enabled). Медіа completion-запису
// приходять як короткоживучі signed URLs із приватного bucket.
// ============================================================
import { useState } from 'react';
import { useFulfilledWishes } from './useWishlist';
import { useUsersMap } from '@/features/_shared/useUsers';

export function WishArchive({
  ownerId,
  onPhotoClick,
}: {
  ownerId: number;
  onPhotoClick: (src: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: items = [], isPending, isError, refetch } = useFulfilledWishes(ownerId, open);
  const usersMap = useUsersMap();

  return (
    <div className="wl-archive-wrap">
      <button
        type="button"
        className="wl-archive-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="wl-archive-toggle-label">🎁 Gift Archive</span>
        <span className="wl-archive-toggle-subtitle">Подаровані мрії та ваші спогади</span>
        <span className="wl-archive-toggle-arrow" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="wl-archive-body">
          {isPending ? (
            <p className="empty-state">Відкриваємо архів…</p>
          ) : isError ? (
            <div className="empty-state">
              <p>Не вдалося відкрити Gift Archive.</p>
              <button type="button" className="btn-secondary" onClick={() => void refetch()}>
                Спробувати ще
              </button>
            </div>
          ) : items.length === 0 ? (
            <p className="empty-state">Тут з’являться ваші подаровані мрії ✨</p>
          ) : (
            <div className="wl-gift-memory-grid">
              {items.map((item) => {
                const momentDate = item.completed_at ?? item.fulfilled_at;
                const hasPersonalMedia = Boolean(item.reaction_photo_url || item.reaction_video_url);

                return (
                  <article key={item.id} className="wl-gift-memory-card">
                    <div className="wl-gift-memory-media">
                      {item.reaction_photo_url ? (
                        <button
                          type="button"
                          className="wl-gift-memory-photo"
                          onClick={() => onPhotoClick(item.reaction_photo_url!)}
                          aria-label={`Відкрити фото реакції: ${item.title}`}
                        >
                          <img src={item.reaction_photo_url} loading="lazy" alt={`Реакція на ${item.title}`} />
                        </button>
                      ) : item.image_url ? (
                        <img
                          className="wl-gift-memory-product"
                          src={item.image_url}
                          loading="lazy"
                          alt={item.title}
                        />
                      ) : (
                        <div className="wl-gift-memory-placeholder" aria-hidden="true">♡</div>
                      )}

                      <div className="wl-gift-memory-badge">
                        {hasPersonalMedia ? 'Наш момент' : 'Подарована мрія'}
                      </div>
                    </div>

                    <div className="wl-gift-memory-content">
                      <div className="wl-gift-memory-heading">
                        {item.link ? (
                          <a href={item.link} target="_blank" rel="noopener noreferrer">
                            {item.title}
                          </a>
                        ) : (
                          <h3>{item.title}</h3>
                        )}
                        {item.price != null && (
                          <span>{item.price.toLocaleString('uk-UA')} ₴</span>
                        )}
                      </div>

                      {item.memory_comment && (
                        <blockquote className="wl-gift-memory-comment">
                          “{item.memory_comment}”
                        </blockquote>
                      )}

                      {item.reaction_video_url && (
                        <video
                          className="wl-gift-memory-video"
                          src={item.reaction_video_url}
                          controls
                          preload="metadata"
                        />
                      )}

                      <div className="wl-gift-memory-meta">
                        {item.fulfilled_by != null && (
                          <span>Вручив(ла): {usersMap[item.fulfilled_by] ?? '?'}</span>
                        )}
                        {momentDate && (
                          <time dateTime={momentDate}>
                            {new Date(momentDate).toLocaleDateString('uk-UA', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </time>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
