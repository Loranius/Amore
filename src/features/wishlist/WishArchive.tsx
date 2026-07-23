// ============================================================
// WishArchive — Gift Archive подарованих і спільно виконаних мрій
// ============================================================
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUsersMap } from '@/features/_shared/useUsers';
import { ProgressivePhoto } from './ProgressivePhoto';
import { useWishlistArchive } from './useWishlistArchive';
import type {
  GiftMemoryArchiveItem,
  WishlistArchiveScope,
} from './wishlistRpc';

type ArchiveGroup = {
  key: string;
  label: string;
  items: GiftMemoryArchiveItem[];
};

interface WishArchiveProps {
  scope: WishlistArchiveScope;
  ownerId?: number | null;
  onPhotoClick: (src: string) => void;
  openRequested?: boolean;
  openRequestKey?: string | null;
  focusWishId?: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

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

export function archiveCountText(count: number, shared: boolean): string {
  const lastTwo = count % 100;
  const last = count % 10;
  const one = shared ? 'здійснена мрія' : 'подарований спогад';
  const few = shared ? 'здійснені мрії' : 'подаровані спогади';
  const many = shared ? 'здійснених мрій' : 'подарованих спогадів';

  if (last === 1 && lastTwo !== 11) return `${count} ${one}`;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return `${count} ${few}`;
  }
  return `${count} ${many}`;
}

export function WishArchive({
  scope,
  ownerId = null,
  onPhotoClick,
  openRequested = false,
  openRequestKey = null,
  focusWishId = null,
  open: controlledOpen,
  onOpenChange,
}: WishArchiveProps) {
  const isShared = scope === 'shared';
  const [internalOpen, setInternalOpen] = useState(openRequested);
  const open = controlledOpen ?? internalOpen;
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: items = [], isPending, isError, refetch } =
    useWishlistArchive(scope, ownerId, open);
  const usersMap = useUsersMap();
  const groups = useMemo(() => groupArchive(items), [items]);
  const latestMoment = groups[0]?.items[0] ? momentValue(groups[0].items[0]) : null;
  const title = isShared ? 'Наші здійснені мрії' : 'Подаровані спогади';
  const entryDescription = isShared
    ? 'Моменти, які ви створили та здійснили разом.'
    : 'Здійснені бажання, подарунки й теплі моменти.';

  const setArchiveOpen = useCallback((value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  }, [controlledOpen, onOpenChange]);

  useEffect(() => {
    if (!openRequested) return;
    setArchiveOpen(true);
  }, [openRequested, openRequestKey, setArchiveOpen]);

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

  if (!open) {
    return (
      <div className="wl-archive-wrap wl-archive-wrap--entry" ref={wrapRef}>
        <button
          type="button"
          className="wl-archive-entry"
          onClick={() => setArchiveOpen(true)}
          aria-label={`Відкрити: ${title}`}
        >
          <span className="wl-archive-entry-icon" aria-hidden="true">
            {isShared ? '✨' : '🎁'}
          </span>
          <span className="wl-archive-entry-copy">
            <strong>{title}</strong>
            <small>
              {items.length > 0 ? archiveCountText(items.length, isShared) : entryDescription}
            </small>
          </span>
          <span className="wl-archive-entry-action">
            Відкрити архів
            <span aria-hidden="true">→</span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="wl-archive-wrap wl-archive-wrap--page" ref={wrapRef}>
      <header className="wl-archive-page-header">
        <button
          type="button"
          className="wl-archive-back"
          onClick={() => setArchiveOpen(false)}
        >
          <span aria-hidden="true">←</span>
          До активних мрій
        </button>

        <div className="wl-archive-page-copy">
          <span className="wl-archive-page-eyebrow">
            {isShared ? 'Спільна історія' : 'Історія подарунків'}
          </span>
          <h2>{title}</h2>
          <p>
            {items.length > 0
              ? archiveCountText(items.length, isShared)
              : entryDescription}
          </p>
        </div>
        <span className="wl-archive-page-symbol" aria-hidden="true">
          {isShared ? '✨' : '🎁'}
        </span>
      </header>

      <div className="wl-archive-body">
        {isPending ? (
          <div className="wl-archive-state" role="status">
            <span className="wl-archive-state-icon" aria-hidden="true">✦</span>
            <strong>Відкриваємо ваші спогади…</strong>
          </div>
        ) : isError ? (
          <div className="wl-archive-state">
            <span className="wl-archive-state-icon" aria-hidden="true">♡</span>
            <strong>Не вдалося відкрити архів</strong>
            <p>Спогади на місці — спробуй завантажити їх ще раз.</p>
            <button type="button" className="btn-secondary" onClick={() => void refetch()}>
              Спробувати ще
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="wl-archive-state wl-archive-state--empty">
            <span className="wl-archive-state-icon" aria-hidden="true">
              {isShared ? '✨' : '🎀'}
            </span>
            <strong>
              {isShared
                ? 'Перша здійснена разом мрія ще попереду'
                : 'Перший подарований спогад ще попереду'}
            </strong>
            <p>
              {isShared
                ? 'Після виконання спільна мрія залишиться тут із фото, відео та вашими словами.'
                : 'Після вручення мрія назавжди залишиться тут. Фото й слова можна додати до спогаду окремо.'}
            </p>
          </div>
        ) : (
          <>
            <div className="wl-archive-summary">
              <span className="wl-archive-summary-icon" aria-hidden="true">✦</span>
              <span className="wl-archive-summary-copy">
                <strong>{archiveCountText(items.length, isShared)}</strong>
                <small>
                  {latestMoment
                    ? `Останній спогад — ${formatMoment(latestMoment)}`
                    : isShared
                      ? 'Ваша спільна історія здійснених мрій'
                      : 'Ваша спільна історія подарунків'}
                </small>
              </span>
            </div>

            <div className="wl-archive-timeline">
              {groups.map((group) => (
                <section className="wl-archive-year" key={group.key} aria-labelledby={`${scope}-archive-year-${group.key}`}>
                  <header className="wl-archive-year-heading">
                    <span id={`${scope}-archive-year-${group.key}`}>{group.label}</span>
                    <small>{group.items.length}</small>
                  </header>

                  <div className="wl-gift-memory-grid">
                    {group.items.map((item) => {
                      const momentDate = momentValue(item);
                      const actorName = item.fulfilled_by != null
                        ? usersMap[item.fulfilled_by] ?? 'Партнер'
                        : 'Партнер';
                      const hasPhoto = Boolean(item.reaction_photo_url);
                      const hasVideo = Boolean(item.reaction_video_url);
                      const hasPersonalMemory = hasPhoto || hasVideo || Boolean(item.memory_comment);
                      const isFocused = focusWishId === item.id;
                      const revealDelayMs = (item.id % 8) * 35;

                      return (
                        <article
                          key={item.id}
                          data-wish-id={item.id}
                          className={`wl-gift-memory-card${isFocused ? ' wl-gift-memory-card--focused' : ''}`}
                        >
                          <div className="wl-gift-memory-media">
                            {item.reaction_photo_url ? (
                              <ProgressivePhoto
                                src={item.reaction_photo_url}
                                alt={`Спогад про мрію «${item.title}»`}
                                ariaLabel={`Відкрити фото моменту: ${item.title}`}
                                buttonClassName="wl-gift-memory-photo"
                                revealDelayMs={revealDelayMs}
                                onOpen={onPhotoClick}
                                fallback={<span className="wl-gift-memory-placeholder" aria-hidden="true">♡</span>}
                              />
                            ) : item.reaction_video_url ? (
                              <video
                                className="wl-gift-memory-cover-video"
                                src={item.reaction_video_url}
                                poster={item.image_url ?? undefined}
                                controls
                                playsInline
                                preload="metadata"
                                aria-label={`Відео моменту: ${item.title}`}
                              />
                            ) : item.image_url ? (
                              <ProgressivePhoto
                                src={item.image_url}
                                alt={item.title}
                                ariaLabel={`Відкрити фото мрії: ${item.title}`}
                                buttonClassName="wl-gift-memory-photo"
                                imageClassName="wl-gift-memory-product"
                                revealDelayMs={revealDelayMs}
                                onOpen={onPhotoClick}
                                fallback={<span className="wl-gift-memory-placeholder" aria-hidden="true">♡</span>}
                              />
                            ) : (
                              <div className="wl-gift-memory-placeholder" aria-hidden="true">♡</div>
                            )}

                            <div className="wl-gift-memory-badge">
                              {isShared
                                ? 'Спільний момент'
                                : hasPersonalMemory
                                  ? 'Наш момент'
                                  : 'Подарована мрія'}
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
                                {item.memory_comment}”
                              </blockquote>
                            )}

                            {hasPhoto && item.reaction_video_url && (
                              <video
                                className="wl-gift-memory-video"
                                src={item.reaction_video_url}
                                controls
                                playsInline
                                preload="metadata"
                                aria-label={`Відео моменту: ${item.title}`}
                              />
                            )}

                            <footer className="wl-gift-memory-footer">
                              <span className="wl-gift-memory-giver">
                                <span aria-hidden="true">{isShared ? '✨' : '🎁'}</span>
                                {isShared ? 'Завершення —' : 'Подарунок від —'} <strong>{actorName}</strong>
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
    </div>
  );
}
