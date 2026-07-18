// ============================================================
// WishlistPage — вкладка «Бажання» (порт wishlist.js UI)
// ------------------------------------------------------------
// Дві підвкладки: «Мої бажання» (редаговані, з архівом) і «Бажання
// партнера» (бронь/виконання). Confirm-діалоги на видалення/бронь/
// виконання збережені як у старому UX.
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
  useWishlistMutations,
  type WishFormPayload,
} from './useWishlist';
import type { WishlistItemRow } from '@/types';

type Tab = 'me' | 'partner';

export function WishlistPage() {
  const me = useCurrentUser();
  const partner = usePartner();
  const [tab, setTab] = useState<Tab>('me');

  const isOwn = tab === 'me';
  const ownerId = isOwn ? me.id : (partner?.id ?? null);

  const { data: items = [], isPending, isError } = useWishlistItems(ownerId);
  const { save, remove, setReserved, fulfill } = useWishlistMutations(ownerId);

  const [editing, setEditing] = useState<WishlistItemRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const submit = (id: number | null, payload: WishFormPayload) => save.mutate({ id, payload });

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

  return (
    <section className="wishlist">
      <div className="wl-sub-tabs">
        <button
          type="button"
          className={`wl-sub-btn${isOwn ? ' active' : ''}`}
          onClick={() => setTab('me')}
        >
          Мої бажання
        </button>
        <button
          type="button"
          className={`wl-sub-btn${!isOwn ? ' active' : ''}`}
          onClick={() => setTab('partner')}
        >
          Бажання {partnerName}
        </button>
      </div>

      <div className="wl-head">
        <h1 className="wl-title">{isOwn ? 'Мої бажання' : `Бажання ${partnerName}`}</h1>
        {isOwn && (
          <button type="button" className="btn" onClick={() => setAdding(true)}>
            + Додати
          </button>
        )}
      </div>

      {ownerId === null ? (
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
                {isOwn
                  ? 'Твій список порожній. Час додати нову забаганку.'
                  : 'Партнер ще не додав жодного бажання.'}
              </p>
            ) : (
              items.map((item) => (
                <WishCard
                  key={item.id}
                  item={item}
                  isOwn={isOwn}
                  onPhotoClick={setLightbox}
                  onEdit={setEditing}
                  onDelete={onDelete}
                  onReserve={onReserve}
                  onFulfill={onFulfill}
                />
              ))
            )}
          </div>

          {isOwn && <WishArchive ownerId={me.id} />}
        </>
      )}

      {(adding || editing) && (
        <WishFormModal
          item={editing}
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
