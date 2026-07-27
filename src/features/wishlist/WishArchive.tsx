// ============================================================
// WishArchive — подаровані та спільно виконані мрії
// ============================================================
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsersMap } from '@/features/_shared/useUsers';
import { ArchiveGiftFormModal } from './ArchiveGiftFormModal';
import { ProgressivePhoto } from './ProgressivePhoto';
import { WishlistArchiveViewPicker } from './WishlistArchiveViewPicker';
import { WishlistBubblePhysics } from './WishlistBubblePhysics';
import {
  freshWishlistCloudSeed,
  normalizeWishlistCloudPriority,
  wishlistCloudPlacement,
  wishlistCloudPriorityPresentation,
} from './wishlistCloudLayout';
import {
  useCreateManualArchiveGift,
  useWishlistArchive,
} from './useWishlistArchive';
import {
  archivePolaroidLayout,
  freshArchivePolaroidSeed,
  readWishlistArchiveView,
  writeWishlistArchiveView,
  type WishlistArchiveViewMode,
} from './wishlistArchiveView';
import type {
  GiftMemoryArchiveItem,
  WishlistArchiveScope,
} from './wishlistRpc';
import './wishlistArchiveBubbles.css';
import './wishlistArchiveViews.css';

type ArchiveGroup = {
  key: string;
  label: string;
  items: GiftMemoryArchiveItem[];
};

type UsersMap = ReturnType<typeof useUsersMap>;

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

interface ArchiveMemorySheetProps {
  item: GiftMemoryArchiveItem;
  actorName: string;
  isShared: boolean;
  onClose: () => void;
  onPhotoClick: (src: string) => void;
}

interface ArchiveItemProps {
  item: GiftMemoryArchiveItem;
  index: number;
  actorName: string;
  isFocused: boolean;
  onOpen: (item: GiftMemoryArchiveItem) => void;
}

interface ArchiveSeededProps extends ArchiveItemProps {
  seed: number;
}

type ArchivePolaroidProps = ArchiveSeededProps;

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

function archiveBubbleImage(item: GiftMemoryArchiveItem): string | null {
  return item.reaction_photo_url ?? item.image_url;
}

function actorNameFor(item: GiftMemoryArchiveItem, usersMap: UsersMap): string {
  return item.fulfilled_by != null ? usersMap[item.fulfilled_by] ?? 'Партнер' : 'Партнер';
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

function ArchiveBubble({ item, seed, index, isFocused, onOpen }: ArchiveSeededProps) {
  const priority = normalizeWishlistCloudPriority(item.priority);
  const priorityPresentation = wishlistCloudPriorityPresentation(item.priority);
  const placement = useMemo(
    () => wishlistCloudPlacement(seed, `archive-${item.id}`, index),
    [seed, index, item.id],
  );
  const image = archiveBubbleImage(item);
  const dateLabel = formatMoment(momentValue(item));
  const bubbleStyle = {
    '--wl-cloud-size': `${priorityPresentation.size}px`,
    '--wl-cloud-margin-top': `${placement.marginTop}px`,
    '--wl-cloud-margin-right': `${placement.marginRight}px`,
    '--wl-cloud-margin-bottom': `${placement.marginBottom}px`,
    '--wl-cloud-margin-left': `${placement.marginLeft}px`,
    '--wl-cloud-x': `${placement.translateX}px`,
    '--wl-cloud-y': `${placement.translateY}px`,
    '--wl-cloud-rotate': `${placement.rotate}deg`,
    '--wl-cloud-delay': `${placement.delay}s`,
    '--wl-cloud-duration': `${placement.duration}s`,
    '--wl-cloud-z': placement.zIndex,
    '--wl-cloud-drift-x': `${placement.driftX}px`,
    '--wl-cloud-drift-y': `${placement.driftY}px`,
  } as CSSProperties;

  return (
    <article
      className={`wl-cloud-item wl-archive-cloud-item${isFocused ? ' wl-archive-cloud-item--focused' : ''}`}
      style={bubbleStyle}
      data-wish-id={item.id}
    >
      <button
        type="button"
        className="wl-cloud-bubble wl-archive-cloud-bubble"
        data-priority={priority}
        aria-label={`Відкрити подарований спогад «${item.title}». ${dateLabel}`}
        aria-haspopup="dialog"
        onClick={() => onOpen(item)}
      >
        {image ? (
          <span className="wl-cloud-bubble-media wl-archive-cloud-bubble-media">
            <img src={image} alt="" loading="lazy" decoding="async" />
          </span>
        ) : (
          <span className="wl-cloud-bubble-placeholder wl-archive-cloud-bubble-placeholder" aria-hidden="true">
            {item.reaction_video_url ? '▶' : '♡'}
          </span>
        )}
      </button>
    </article>
  );
}

function ArchiveFeedCard({
  item,
  actorName,
  isFocused,
  onOpen,
}: ArchiveItemProps) {
  const image = archiveBubbleImage(item);
  const date = formatMoment(momentValue(item));

  return (
    <article
      className={`wl-archive-feed-card${isFocused ? ' wl-archive-view-card--focused' : ''}`}
      data-wish-id={item.id}
    >
      <button
        type="button"
        className="wl-archive-feed-trigger"
        aria-label={`Відкрити подарований спогад «${item.title}». ${date}`}
        aria-haspopup="dialog"
        onClick={() => onOpen(item)}
      >
        <span className="wl-archive-feed-media">
          {image ? (
            <img src={image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span aria-hidden="true">{item.reaction_video_url ? '▶' : '♡'}</span>
          )}
        </span>

        <span className="wl-archive-feed-copy">
          <span className="wl-archive-feed-kicker">
            <time dateTime={momentValue(item) ?? undefined}>{date}</time>
            <span>Від {actorName}</span>
          </span>
          <strong>{item.title}</strong>
          <span className={`wl-archive-feed-description${item.description ? '' : ' is-empty'}`}>
            {item.description ?? 'Опис до цього спогаду не додано.'}
          </span>
          <span className="wl-archive-feed-meta">
            <span>{item.price != null ? `${item.price.toLocaleString('uk-UA')} ₴` : 'Ціну не вказано'}</span>
            <span aria-hidden="true">Відкрити ›</span>
          </span>
        </span>
      </button>
    </article>
  );
}

function ArchivePolaroidCard({
  item,
  index,
  actorName,
  isFocused,
  seed,
  onOpen,
}: ArchivePolaroidProps) {
  const image = archiveBubbleImage(item);
  const date = formatMoment(momentValue(item));
  const layout = archivePolaroidLayout(seed, item.id, index);
  const style = {
    '--wl-archive-polaroid-rotate': `${layout.rotate}deg`,
    '--wl-archive-polaroid-x': `${layout.x}px`,
    '--wl-archive-polaroid-y': `${layout.y}px`,
    '--wl-archive-polaroid-tape-rotate': `${layout.tapeRotate}deg`,
  } as CSSProperties;

  return (
    <article
      className={`wl-archive-polaroid-card${isFocused ? ' wl-archive-view-card--focused' : ''}`}
      style={style}
      data-wish-id={item.id}
    >
      <button
        type="button"
        className="wl-archive-polaroid-trigger"
        aria-label={`Відкрити подарований спогад «${item.title}». ${date}`}
        aria-haspopup="dialog"
        onClick={() => onOpen(item)}
      >
        <span className="wl-archive-polaroid-media">
          {image ? (
            <img src={image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span aria-hidden="true">{item.reaction_video_url ? '▶' : '♡'}</span>
          )}
        </span>
        <span className="wl-archive-polaroid-caption">
          <strong>{item.title}</strong>
          <small>{date}</small>
          <span>Від {actorName}</span>
        </span>
      </button>
    </article>
  );
}

function ArchiveMemorySheet({
  item,
  actorName,
  isShared,
  onClose,
  onPhotoClick,
}: ArchiveMemorySheetProps) {
  const priority = normalizeWishlistCloudPriority(item.priority);
  const momentDate = momentValue(item);
  const primaryPhoto = archiveBubbleImage(item);
  const hasSecondaryVideo = Boolean(primaryPhoto && item.reaction_video_url);
  const dialogTitleId = `wl-archive-sheet-title-${item.id}`;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const previousOverscrollBehavior = document.body.style.overscrollBehavior;
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';
    document.body.classList.add('wl-cloud-sheet-open');

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onClose();
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscrollBehavior;
      document.body.classList.remove('wl-cloud-sheet-open');
    };
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="wl-cloud-sheet-overlay wl-archive-cloud-overlay"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="wl-cloud-sheet wl-archive-cloud-sheet"
        data-priority={priority}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <div className="wl-cloud-sheet-handle" aria-hidden="true" />
        <button
          type="button"
          className="wl-cloud-sheet-close"
          aria-label="Закрити спогад"
          onClick={onClose}
          autoFocus
        >
          ×
        </button>

        <div className="wl-cloud-sheet-content">
          <div className="wl-cloud-sheet-top">
            <div className="wl-cloud-sheet-hero wl-archive-cloud-sheet-hero">
              {primaryPhoto ? (
                <ProgressivePhoto
                  src={primaryPhoto}
                  alt={`Спогад про мрію «${item.title}»`}
                  ariaLabel={`Відкрити фото моменту: ${item.title}`}
                  buttonClassName="wl-cloud-sheet-photo wl-archive-cloud-sheet-photo"
                  imageClassName="wl-archive-cloud-sheet-image"
                  onOpen={(src) => {
                    onClose();
                    onPhotoClick(src);
                  }}
                  fallback={(
                    <span className="wl-cloud-sheet-photo-placeholder" aria-hidden="true">♡</span>
                  )}
                />
              ) : item.reaction_video_url ? (
                <video
                  className="wl-archive-cloud-sheet-primary-video"
                  src={item.reaction_video_url}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={`Відео моменту: ${item.title}`}
                />
              ) : (
                <div className="wl-cloud-sheet-photo wl-archive-cloud-sheet-photo" aria-label="Спогад без фото">
                  <span className="wl-cloud-sheet-photo-placeholder" aria-hidden="true">♡</span>
                </div>
              )}
            </div>

            <div className="wl-cloud-sheet-summary">
              <div className="wl-cloud-sheet-meta">
                <span className="wl-cloud-sheet-priority">
                  <span aria-hidden="true">{isShared ? '✨' : '🎁'}</span>
                  {isShared ? 'Спільний момент' : 'Подарована мрія'}
                </span>
                <time className="wl-cloud-sheet-state" dateTime={momentDate ?? undefined}>
                  {formatMoment(momentDate)}
                </time>
              </div>

              <p className="wl-cloud-sheet-attribution">
                {isShared ? 'Завершення —' : 'Подарунок від —'} {actorName}
              </p>

              <div className="wl-cloud-sheet-title-row">
                <h2 id={dialogTitleId} className="wl-cloud-sheet-title">{item.title}</h2>
                {item.price != null && (
                  <span className="wl-cloud-sheet-price">
                    {item.price.toLocaleString('uk-UA')} ₴
                  </span>
                )}
              </div>

              {item.description && (
                <p className="wl-cloud-sheet-description">{item.description}</p>
              )}
            </div>
          </div>

          {item.memory_comment && (
            <blockquote className="wl-archive-cloud-sheet-comment">
              “{item.memory_comment}”
            </blockquote>
          )}

          {hasSecondaryVideo && item.reaction_video_url && (
            <video
              className="wl-archive-cloud-sheet-video"
              src={item.reaction_video_url}
              controls
              playsInline
              preload="metadata"
              aria-label={`Відео моменту: ${item.title}`}
            />
          )}

          {item.link && (
            <a
              className="wl-cloud-sheet-link"
              href={item.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span aria-hidden="true">↗</span>
              <span>Відкрити подарунок</span>
              <span aria-hidden="true">›</span>
            </a>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
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
  const me = useCurrentUser();
  const usersMap = useUsersMap();
  const [internalOpen, setInternalOpen] = useState(openRequested);
  const [selectedItem, setSelectedItem] = useState<GiftMemoryArchiveItem | null>(null);
  const [addingGift, setAddingGift] = useState(false);
  const [viewMode, setViewMode] = useState<WishlistArchiveViewMode>(() =>
    readWishlistArchiveView(scope)
  );
  const [polaroidSeed, setPolaroidSeed] = useState(freshArchivePolaroidSeed);
  // Бульбашки архіву — та сама логіка, що й на дошці бажань: розкладка
  // нова на кожне відкриття архіву, стала поки він відкритий.
  const [bubbleSeed] = useState(freshWishlistCloudSeed);
  const open = controlledOpen ?? internalOpen;
  const wrapRef = useRef<HTMLDivElement>(null);
  const { data: items = [], isPending, isError, refetch } =
    useWishlistArchive(scope, ownerId, open);
  const createManualGift = useCreateManualArchiveGift();
  const groups = useMemo(() => groupArchive(items), [items]);
  const orderedItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const latestMoment = orderedItems[0] ? momentValue(orderedItems[0]) : null;
  const title = isShared ? 'Наші здійснені мрії' : 'Подаровані спогади';
  const entryDescription = isShared
    ? 'Моменти, які ви створили та здійснили разом.'
    : 'Здійснені бажання, подарунки й теплі моменти.';
  const partnerName = Object.entries(usersMap).find(([id]) => Number(id) !== me.id)?.[1]
    ?? 'партнера';

  const setArchiveOpen = useCallback((value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value);
    onOpenChange?.(value);
  }, [controlledOpen, onOpenChange]);

  const closeSelectedItem = useCallback(() => setSelectedItem(null), []);
  const openSelectedItem = useCallback((item: GiftMemoryArchiveItem) => {
    setSelectedItem(item);
  }, []);

  const changeViewMode = (nextView: WishlistArchiveViewMode) => {
    if (nextView === 'polaroid') setPolaroidSeed(freshArchivePolaroidSeed());
    setViewMode(nextView);
    writeWishlistArchiveView(scope, nextView);
  };

  useEffect(() => {
    setViewMode(readWishlistArchiveView(scope));
  }, [scope]);

  useEffect(() => {
    if (!openRequested) return;
    setArchiveOpen(true);
  }, [openRequested, openRequestKey, setArchiveOpen]);

  useEffect(() => {
    if (open) return;
    setSelectedItem(null);
    setAddingGift(false);
  }, [open]);

  useEffect(() => {
    if (!open || isPending || items.length === 0) return;

    const timer = window.setTimeout(() => {
      const focused = focusWishId
        ? wrapRef.current?.querySelector<HTMLElement>(`[data-wish-id="${focusWishId}"]`)
        : null;
      (focused ?? wrapRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 140);

    return () => window.clearTimeout(timer);
  }, [focusWishId, isPending, items.length, open, openRequestKey, viewMode]);

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

  const selectedActorName = selectedItem
    ? actorNameFor(selectedItem, usersMap)
    : 'Партнер';

  return (
    <>
      {viewMode === 'bubbles' && items.length > 0 && <WishlistBubblePhysics />}
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

          <div className="wl-archive-page-actions">
            {!isShared && (
              <button
                type="button"
                className="wl-archive-add-gift"
                onClick={() => setAddingGift(true)}
              >
                <span aria-hidden="true">＋</span>
                Давній подарунок
              </button>
            )}
            <span className="wl-archive-page-symbol" aria-hidden="true">
              {isShared ? '✨' : '🎁'}
            </span>
          </div>
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
                  : 'Додай подарунок, який уже отримував раніше, або заверши актуальну мрію.'}
              </p>
              {!isShared && (
                <button type="button" className="btn-primary" onClick={() => setAddingGift(true)}>
                  ＋ Додати давній подарунок
                </button>
              )}
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

              <div className="wl-archive-controls">
                <div className="wl-archive-cloud-years" aria-label="Роки архіву">
                  {groups.map((group) => (
                    <span key={group.key}>
                      {group.label}
                      <small>{group.items.length}</small>
                    </span>
                  ))}
                </div>
                <WishlistArchiveViewPicker value={viewMode} onChange={changeViewMode} />
              </div>

              {viewMode === 'bubbles' ? (
                <div
                  className="wishlist-grid wl-archive-cloud-grid"
                  aria-label={isShared ? 'Бульбашки здійснених мрій' : 'Бульбашки подарованих спогадів'}
                >
                  {orderedItems.map((item, index) => (
                    <ArchiveBubble
                      key={item.id}
                      item={item}
                      seed={bubbleSeed}
                      index={index}
                      actorName={actorNameFor(item, usersMap)}
                      isFocused={focusWishId === item.id}
                      onOpen={openSelectedItem}
                    />
                  ))}
                </div>
              ) : viewMode === 'feed' ? (
                <div className="wl-archive-view-grid wl-archive-view-grid--feed" aria-label="Стрічка подарованих спогадів">
                  {orderedItems.map((item, index) => (
                    <ArchiveFeedCard
                      key={item.id}
                      item={item}
                      index={index}
                      actorName={actorNameFor(item, usersMap)}
                      isFocused={focusWishId === item.id}
                      onOpen={openSelectedItem}
                    />
                  ))}
                </div>
              ) : (
                <div className="wl-archive-view-grid wl-archive-view-grid--polaroid" aria-label="Полароїди подарованих спогадів">
                  {orderedItems.map((item, index) => (
                    <ArchivePolaroidCard
                      key={item.id}
                      item={item}
                      index={index}
                      actorName={actorNameFor(item, usersMap)}
                      isFocused={focusWishId === item.id}
                      seed={polaroidSeed}
                      onOpen={openSelectedItem}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {selectedItem && (
        <ArchiveMemorySheet
          item={selectedItem}
          actorName={selectedActorName}
          isShared={isShared}
          onClose={closeSelectedItem}
          onPhotoClick={onPhotoClick}
        />
      )}

      {addingGift && !isShared && (
        <ArchiveGiftFormModal
          partnerName={partnerName}
          onClose={() => {
            if (!createManualGift.isPending) setAddingGift(false);
          }}
          onSubmit={async (payload) => {
            await createManualGift.mutateAsync(payload);
          }}
        />
      )}
    </>
  );
}
