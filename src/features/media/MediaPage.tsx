// ============================================================
// MediaPage — «Вотчліст» (порт media.js UI)
// ------------------------------------------------------------
// Вкладки типу, пошук TMDB (фільми/серіали), фільтри за статусом,
// середній рейтинг, сітка карток і згортна панель свайпу. Модалки:
// деталі, відгук, додати/редагувати, додати з пошуку.
// ============================================================
import { useMemo, useState } from 'react';
import { useConfirm } from '@/providers/ConfirmProvider';
import { TabBar } from '@/components/ui/TabBar';
import { STATUS_CONFIG, STATUS_ORDER, MEDIA_TYPES, TYPE_LABELS } from './mediaConstants';
import { useMediaItems, useMediaMutations, type ReviewWho } from './useMedia';
import { useTmdbSearch } from './useTmdb';
import { MediaCard } from './MediaCard';
import { MediaDetailModal } from './MediaDetailModal';
import { ReviewPanel } from './ReviewPanel';
import { MediaFormModal, AddFromSearchModal } from './MediaModals';
import { SwipeDeck } from '@/features/swipe/SwipeDeck';
import { PortalDecor } from '@/features/auth/PortalDecor';
import type { MediaItemRow, MediaType, MediaStatus, TmdbSearchResult } from '@/types';

type Filter = 'all' | MediaStatus;
type ReviewTarget = { item: MediaItemRow; who: ReviewWho };

export function MediaPage() {
  const [type, setType] = useState<MediaType>('movie');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [swipeOpen, setSwipeOpen] = useState(false);

  // Модальні стани.
  const [detail, setDetail] = useState<MediaItemRow | null>(null);
  const [review, setReview] = useState<ReviewTarget | null>(null);
  const [form, setForm] = useState<{ item: MediaItemRow | null } | null>(null);
  const [fromSearch, setFromSearch] = useState<TmdbSearchResult | null>(null);

  const { data: items = [], isPending } = useMediaItems(type);
  const { add, addFromSearch, saveReview, edit, remove } = useMediaMutations(type);
  const { data: searchResults = [], isFetching: searching } = useTmdbSearch(query, type);
  const confirmDialog = useConfirm();

  const switchType = (t: MediaType) => {
    setType(t);
    setFilter('all');
    setQuery('');
  };

  const avgRating = useMemo(() => {
    const all = items.flatMap((i) => [i.rating_dima, i.rating_lena]).filter((r): r is number => !!r);
    return all.length ? (all.reduce((a, b) => a + b, 0) / all.length).toFixed(1) : null;
  }, [items]);

  const counts = useMemo(() => {
    const c = { all: items.length } as Record<Filter, number>;
    for (const s of STATUS_ORDER) c[s] = items.filter((i) => i.status === s).length;
    return c;
  }, [items]);

  const shown = useMemo(() => {
    if (filter === 'all') {
      return [...items].sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status));
    }
    return items.filter((i) => i.status === filter);
  }, [items, filter]);

  const onDelete = async (id: number) => {
    if (await confirmDialog('Видалити цей елемент?')) remove.mutate(id);
  };

  return (
    <section className="media pink-page">
      <PortalDecor density="light" parallax={false} />
      <div className="media-head">
        <h1>Вотчліст</h1>
        <button type="button" className="btn" onClick={() => setForm({ item: null })}>
          + Додати
        </button>
      </div>

      {/* Вкладки типу */}
      <TabBar<MediaType>
        value={type}
        onChange={switchType}
        items={MEDIA_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
      />

      {/* Пошук TMDB — лише фільми/серіали */}
      {type !== 'book' && (
        <div className="media-search-wrap">
          <input
            id="media-search"
            name="search"
            type="text"
            className="media-search-inp"
            placeholder="Пошук на TMDB…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.trim() && (
            <div className="media-search-results">
              {searching ? (
                <p className="media-search-empty">Пошук…</p>
              ) : searchResults.length === 0 ? (
                <p className="media-search-empty">Нічого не знайдено 🔍</p>
              ) : (
                searchResults.map((r) => (
                  <div key={r.tmdb_id} className="media-search-card">
                    {r.poster_url ? (
                      <img className="media-search-poster" src={r.poster_url} alt="" loading="lazy" />
                    ) : (
                      <div className="media-search-poster-empty">🎬</div>
                    )}
                    <div className="media-search-info">
                      <div className="media-search-title">{r.title}</div>
                      <div className="media-search-meta">
                        {r.year && <span>{r.year}</span>}
                        {r.rating && <span>★ {r.rating}</span>}
                      </div>
                      {r.overview && (
                        <div className="media-search-overview">{r.overview.slice(0, 90)}</div>
                      )}
                    </div>
                    <button
                      type="button"
                      className="media-search-add-btn"
                      onClick={() => setFromSearch(r)}
                      aria-label="Додати"
                    >
                      +
                    </button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Панель свайпу (згорнута за замовч.; TMDB не смикаємо доки закрито) */}
      <button
        type="button"
        className={`swipe-toggle-btn${swipeOpen ? ' open' : ''}`}
        onClick={() => setSwipeOpen((v) => !v)}
      >
        🔥 Свайп {swipeOpen ? '▲' : '▼'}
      </button>
      {swipeOpen && (
        <div className="swipe-panel open">
          <SwipeDeck enabled={swipeOpen} />
        </div>
      )}

      {/* Статистика */}
      {avgRating && (
        <div className="media-stats">
          <div className="media-stat">
            <span className="media-stat-num">★ {avgRating}</span>
            <span className="media-stat-label">сер. рейтинг</span>
          </div>
        </div>
      )}

      {/* Фільтри статусів */}
      <div className="media-filters">
        <button
          type="button"
          className={`media-filter-btn${filter === 'all' ? ' active' : ''}`}
          onClick={() => setFilter('all')}
        >
          Всі ({counts.all})
        </button>
        {STATUS_ORDER.filter((s) => counts[s] > 0).map((s) => (
          <button
            key={s}
            type="button"
            className={`media-filter-btn${filter === s ? ' active' : ''}`}
            onClick={() => setFilter(s)}
          >
            {STATUS_CONFIG[type][s]} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Сітка */}
      {isPending ? (
        <p className="empty-state">Завантаження…</p>
      ) : shown.length === 0 ? (
        <p className="empty-state">Тут порожньо. Додай щось!</p>
      ) : (
        <div className="media-grid">
          {shown.map((item) => (
            <MediaCard
              key={item.id}
              item={item}
              onOpen={setDetail}
              onReview={(it) => setReview({ item: it, who: 'dima' })}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}

      {/* Модалки */}
      {detail && (
        <MediaDetailModal
          item={detail}
          onClose={() => setDetail(null)}
          onEdit={(it) => {
            setDetail(null);
            setForm({ item: it });
          }}
          onReview={(it, who) => {
            setDetail(null);
            setReview({ item: it, who });
          }}
        />
      )}
      {review && (
        <ReviewPanel
          item={review.item}
          preselect={review.who}
          onClose={() => setReview(null)}
          onSave={(v) => saveReview.mutate(v)}
        />
      )}
      {form && (
        <MediaFormModal
          type={type}
          item={form.item}
          onClose={() => setForm(null)}
          onAdd={(v) => add.mutate(v)}
          onEdit={(v) => edit.mutate(v)}
        />
      )}
      {fromSearch && (
        <AddFromSearchModal
          type={type}
          item={fromSearch}
          onClose={() => setFromSearch(null)}
          onAdd={(v) => addFromSearch.mutate(v)}
        />
      )}
    </section>
  );
}
