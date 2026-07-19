// ============================================================
// WishlistPage — вкладка «Бажання» (порт wishlist.js UI)
// ------------------------------------------------------------
// Три підвкладки: «Мої бажання» (редаговані, з архівом), «Бажання
// партнера» (бронь/виконання) і «Спільне» (видимо обом, isOwn — по
// кожній картці окремо, бо власники змішані). Прогрес-бар і річна
// статистика — для пари загалом, показуються на всіх вкладках.
// ============================================================
import { useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { Lightbox } from '@/components/ui/Lightbox';
import { WishCard } from './WishCard';
import { WishFormModal } from './WishFormModal';
import { WishArchive } from './WishArchive';
import {
  usePartner,
  partnerGenitive,
  useWishlistItems,
  useSharedWishlistItems,
  useCoupleWishStats,
  useWishlistMutations,
  type WishFormPayload,
} from './useWishlist';
import type { WishlistItemRow } from '@/types';

type Tab = 'me' | 'partner' | 'shared';

export function WishlistPage() {
  const me = useCurrentUser();
  const partner = usePartner();
  const [tab, setTab] = useState<Tab>('me');

  const isOwnTab = tab === 'me';
  const ownerId = tab === 'shared' ? null : isOwnTab ? me.id : (partner?.id ?? null);

  const { data: ownItems = [], isPending: ownPending, isError: ownError } =
    useWishlistItems(ownerId);
  const { data: sharedItems = [], isPending: sharedPending, isError: sharedError } =
    useSharedWishlistItems();
  const { data: stats } = useCoupleWishStats();

  const items = tab === 'shared' ? sharedItems : ownItems;
  const isPending = tab === 'shared' ? sharedPending : ownPending;
  const isError = tab === 'shared' ? sharedError : ownError;

  const { save, remove, setReserved, fulfill } = useWishlistMutations(ownerId);

  const [editing, setEditing] = useState<WishlistItemRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const submit = (
    id: number | null,
    payload: WishFormPayload,
    scope: { owner: number; isShared: boolean },
  ) => save.mutate({ id, payload, owner: scope.owner, isShared: scope.isShared });

  const onDelete = (id: number) => {
    if (confirm('Видалити бажання?')) remove.mutate(id);
  };
  const onReserve = (id: number, reserved: boolean) => {
    if (!reserved && !confirm('Скасувати бронювання цього подарунка?')) return;
    setReserved.mutate({ id, reserved });
  };
  const onFulfill = (item: WishlistItemRow) => {
    if (confirm(`Підтверджуєш, що купив(ла) «${item.title}»? 🎁\n\nОбидва отримають сповіщення ✉️`)) {
      fulfill.mutate(item);
    }
  };

  const partnerName = partnerGenitive(partner?.name);
  const isItemOwn = (item: WishlistItemRow) => (tab === 'shared' ? item.owner === me.id : isOwnTab);

  const pct = stats && stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <section className="wishlist">
      <div className="wl-sub-tabs">
        <button
          type="button"
          className={`wl-sub-btn${tab === 'me' ? ' active' : ''}`}
          onClick={() => setTab('me')}
        >
          Мої бажання
        </button>
        <button
          type="button"
          className={`wl-sub-btn${tab === 'partner' ? ' active' : ''}`}
          onClick={() => setTab('partner')}
        >
          Бажання {partnerName}
        </button>
        <button
          type="button"
          className={`wl-sub-btn${tab === 'shared' ? ' active' : ''}`}
          onClick={() => setTab('shared')}
        >
          🎁 Спільне
        </button>
      </div>

      <div className="wl-head">
        <h1 className="wl-title">
          {tab === 'me' ? 'Мої бажання' : tab === 'partner' ? `Бажання ${partnerName}` : '🎁 Спільні бажання'}
        </h1>
        <button type="button" className="btn" onClick={() => setAdding(true)}>
          + Додати
        </button>
      </div>

      {stats && stats.total > 0 && (
        <div className="plans-stat-banner">
          <div className="plans-stat-row">
            <div className="plans-stat-info">
              <span className="plans-stat-num">{stats.done}</span>
              <span className="plans-stat-sep">/</span>
              <span className="plans-stat-total">{stats.total}</span>
              <span className="plans-stat-label">бажань виконано</span>
            </div>
            <div className="plans-stat-pct">{pct}%</div>
          </div>
          <div className="plans-progress-bar">
            <div className="plans-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          {stats.doneThisYear > 0 && (
            <p className="wl-year-stat">Ви виконали {stats.doneThisYear} бажань разом цього року ❤️</p>
          )}
        </div>
      )}

      {ownerId === null && tab !== 'shared' ? (
        <p className="empty-state">Користувача не знайдено.</p>
      ) : isPending ? (
        <p className="empty-state">Завантаження…</p>
      ) : isError ? (
        <p className="empty-state">Не вдалось завантажити бажання.</p>
      ) : (
        <>
          <div className="wishlist-grid">
            {items.length === 0 ? (
              <p className="empty-state">
                {tab === 'me'
                  ? 'Твій список порожній. Час додати нову забаганку.'
                  : tab === 'partner'
                    ? 'Партнер ще не додав жодного бажання.'
                    : 'Спільних бажань ще немає. Додайте перше!'}
              </p>
            ) : (
              items.map((item) => (
                <WishCard
                  key={item.id}
                  item={item}
                  isOwn={isItemOwn(item)}
                  onPhotoClick={setLightbox}
                  onEdit={setEditing}
                  onDelete={onDelete}
                  onReserve={onReserve}
                  onFulfill={onFulfill}
                />
              ))
            )}
          </div>

          {tab === 'me' && <WishArchive ownerId={me.id} />}
        </>
      )}

      {(adding || editing) && (
        <WishFormModal
          item={editing}
          partner={partner}
          defaultScope={tab}
          onClose={() => {
            setAdding(false);
            setEditing(null);
          }}
          onSubmit={submit}
          onPhotoClick={setLightbox}
        />
      )}

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
