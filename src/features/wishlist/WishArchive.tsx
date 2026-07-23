// ============================================================
// WishArchive — Gift Archive подарованих мрій
// ------------------------------------------------------------
// Архів відкривається ліниво, групує спогади хронологічно та може
// сфокусувати конкретну мрію після переходу зі сповіщення.
// ============================================================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFulfilledWishes } from './useWishlist';
import { useUsersMap } from '@/features/_shared/useUsers';
import type { GiftMemoryArchiveItem } from './wishlistRpc';
import './wishlistGiftArchive.css';

type ArchiveGroup = {
  key: string;
  label: string;
  items: GiftMemoryArchiveItem[];
};

function momentValue(item: GiftMemoryArchiveItem): string | null {
  return item.completed_at ?? item.fulfilled_at;
}

function momentTimestamp(item: GiftMemoryArchiveItem): number {
  const value = momentValue(item);
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function formatMoment(value: string | null): string {
  if (!value) return 'Дата не вказана';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Дата не вказана';
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function groupArchive(items: GiftMemoryArchiveItem[]): ArchiveGroup[] {
  const sorted = [...items].sort((a, b) => momentTimestamp(b) - momentTimestamp(a));
  const groups = new Map<string, ArchiveGroup>();

  for (const item of sorted) {
    const value = momentValue(item);
    const date = value ? new Date(value) : null;
    const validDate = date && !Number.isNaN(date.getTime());
    const key = validDate ? String(date.getFullYear()) : 'unknown';
    const label = validDate ? String(date.getFullYear()) : 'Без дати';
    const group = groups.get(key) ?? { key, label, items: [] };
    group.items.push(item);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function archiveCountText(count: number): string {
  const lastTwo = count % 100;
  const last = count % 10;
  if (last === 1 && lastTwo !== 11) return `${count} подарована мрія`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} подаровані мрії`;
  }
  return `${count} подарованих мрій`;
}

export function WishArchive({
  ownerId,
  onPhotoClick,
  openRequested = false,
  openRequestKey = null,
  focusWishId = null,
}: {
  ownerId: number;
  onPhotoClick: (src: string) => void;
  openRequested?: boolean;
  openRequestKey?: string | null;
  focusWishId?: number | null;
}) {
  const [open, setOpen] = useState(openRequested);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: items = [], isPending, isError, refetch } = useFulfilledWishes(ownerId, open);
  const usersMap = useUsersMap();
  const groups = useMemo(() => groupArchive(items), [items]);
  const latestMoment = groups[0]?.items[0] ? momentValue(groups[0].items[0]) : null;

  useEffect(() => {
    if (!openRequested) return;
    setOpen(true);
  }, [openRequested, openRequestKey]);

  useEffect(() => {
    if (!open || isPending || items.length === 0) return;

    const timer = window.setTimeout(() => {
      const focused = focusWishId
        ? wrapRef.current?.querySelector<HTMLElement>(`[data-wish-id="${focusWishId}"]`)
        : null;
      (focused ?? wrapRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 140);

    return () => window.clearTimeout(timer);
  }, [focusWishId, isPending, items.length, open, openRequestKey]);

  return (
    <div className="wl-archive-wrap" ref={wrapRef}>
      <button
        type="button"
        className={`wl-archive-toggle${open ? ' wl-archive-toggle--open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span className="wl-archive-toggle-icon" aria-hidden="true">🎁</span>
        <span className="wl-archive-toggle-copy">
          <span className="wl-archive-toggle-label">Gift Archive</span>
          <span className="wl-archive-toggle-subtitle">
            {items.length > 0 ? archiveCountText(items.length) : 'Подаровані мрії та ваші спогади'}
          </span>
        </span>
        <span className="wl-archive-toggle-arrow" aria-hidden="true">{open ? '−' : '+'}</span>
      </button>

      {open && (
        <div className="wl-archive-body">
          {isPending ? (
            <div className="wl-archive-state" role="status">
              <span className="wl-archive-state-icon" aria-hidden="true">✦</span>
              <strong>Відкриваємо ваші спогади…</strong>
            </div>
          ) : isError ? (
            <div className="wl-archive-state">
              <span className="wl-archive-state-icon" aria-hidden="true">♡</span>
              <strong>Не вдалося відкрити Gift Archive</strong>
              <p>Спогади на місці — спробуй завантажити їх ще раз.</p>
              <button type="button" className="btn-secondary" onClick={() => void refetch()}>
                Спробувати ще
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="wl-archive-state wl-archive-state--empty">
              <span className="wl-archive-state-icon" aria-hidden="true">🎀</span>
              <strong>Перший подарований спогад ще попереду</strong>
              <p>Після вручення мрія назавжди залишиться тут із фото, відео та вашими словами.</p>
            </div>
          ) : (
            <>
              <div className="wl-archive-summary">
                <span className="wl-archive-summary-icon" aria-hidden="true">✦</span>
                <span className="wl-archive-summary-copy">
                  <strong>{archiveCountText(items.length)}</strong>
                  <small>
                    {latestMoment
                      ? `Останній спогад — ${formatMoment(latestMoment)}`
                      : 'Ваша спільна історія подарунків'}
                  </small>
                </span>
              </div>

              <div className="wl-archive-timeline">
                {groups.map((group) => (
                  <section className="wl-archive-year" key={group.key} aria-labelledby={`archive-year-${group.key}`}>
                    <header className="wl-archive-year-heading">
                      <span id={`archive-year-${group.key}`}>{group.label}</span>
                      <small>{group.items.length}</small>
                    </header>

                    <div className="wl-gift-memory-grid">
                      {group.items.map((item) => {
                        const momentDate = momentValue(item);
                        const giverName = item.fulfilled_by != null
                          ? usersMap[item.fulfilled_by] ?? 'Партнер'
                          : 'Партнер';
                        const hasPhoto = Boolean(item.reaction_photo_url);
                        const hasVideo = Boolean(item.reaction_video_url);
                        const hasPersonalMemory = hasPhoto || hasVideo || Boolean(item.memory_comment);
                        const isFocused = focusWishId === item.id;

                        return (
                          <article
                            key={item.id}
                            data-wish-id={item.id}
                            className={`wl-gift-memory-card${isFocused ? ' wl-gift-memory-card--focused' : ''}`}
                          >
                            <div className="wl-gift-memory-media">
                              {item.reaction_photo_url ? (
                                <button
                                  type="button"
                                  className="wl-gift-memory-photo"
                                  onClick={() => onPhotoClick(item.reaction_photo_url!)}
                                  aria-label={`Відкрити фото реакції: ${item.title}`}
                                >
                                  <img
                                    src={item.reaction_photo_url}
                                    loading="lazy"
                                    alt={`Реакція на подарунок «${item.title}»`}
                                  />
                                </button>
                              ) : item.reaction_video_url ? (
                                <video
                                  className="wl-gift-memory-cover-video"
                                  src={item.reaction_video_url}
                                  poster={item.image_url ?? undefined}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  aria-label={`Відео реакції: ${item.title}`}
                                />
                              ) : item.image_url ? (
                                <button
                                  type="button"
                                  className="wl-gift-memory-photo"
                                  onClick={() => onPhotoClick(item.image_url!)}
                                  aria-label={`Відкрити фото подарунка: ${item.title}`}
                                >
                                  <img
                                    className="wl-gift-memory-product"
                                    src={item.image_url}
                                    loading="lazy"
                                    alt={item.title}
                                  />
                                </button>
                              ) : (
                                <div className="wl-gift-memory-placeholder" aria-hidden="true">♡</div>
                              )}

                              <div className="wl-gift-memory-badge">
                                {hasPersonalMemory ? 'Наш момент' : 'Подарована мрія'}
                              </div>
                              <time className="wl-gift-memory-date" dateTime={momentDate ?? undefined}>
                                {formatMoment(momentDate)}
                              </time>
                            </div>

                            <div className="wl-gift-memory-content">
                              <div className="wl-gift-memory-heading">
                                <h3>{item.title}</h3>
                                {item.price != null && (
                                  <span>{item.price.toLocaleString('uk-UA')} ₴</span>
                                )}
                              </div>

                              {item.description && (
                                <p className="wl-gift-memory-description">{item.description}</p>
                              )}

                              {item.memory_comment && (
                                <blockquote className="wl-gift-memory-comment">
                                  “{item.memory_comment}”
                                </blockquote>
                              )}

                              {hasPhoto && item.reaction_video_url && (
                                <video
                                  className="wl-gift-memory-video"
                                  src={item.reaction_video_url}
                                  controls
                                  playsInline
                                  preload="metadata"
                                  aria-label={`Відео реакції: ${item.title}`}
                                />
                              )}

                              <footer className="wl-gift-memory-footer">
                                <span className="wl-gift-memory-giver">
                                  <span aria-hidden="true">🎁</span>
                                  Подарував(ла): <strong>{giverName}</strong>
                                </span>
                                {item.link && (
                                  <a href={item.link} target="_blank" rel="noopener noreferrer">
                                    Відкрити бажання ↗
                                  </a>
                                )}
                              </footer>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
