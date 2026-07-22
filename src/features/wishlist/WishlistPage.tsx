// ============================================================
// WishlistPage — вкладка «Бажання»
// ============================================================
import { useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { Lightbox } from '@/components/ui/Lightbox';
import { TabBar } from '@/components/ui/TabBar';
import { PortalDecor } from '@/features/auth/PortalDecor';
import { WishCard } from './WishCard';
import { WishFormModal } from './WishFormModal';
import { MoveWishModal } from './MoveWishModal';
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
import type { WishlistItemV3 } from './wishlistRpc';
import type { WishlistItemRow } from '@/types';
import './wishlistV3.mobile.css';

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

  const {
    save,
    remove,
    setReserved,
    markPurchased,
    markPreparing,
    fulfill,
    changeScope,
  } = useWishlistMutations(ownerId);
  const confirmDialog = useConfirm();

  const [editing, setEditing] = useState<WishlistItemRow | null>(null);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<WishlistItemRow | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const submit = async (
    id: number | null,
    payload: WishFormPayload,
    scope: { owner: number; isShared: boolean },
  ): Promise<void> => {
    await save.mutateAsync({ id, payload, owner: scope.owner, isShared: scope.isShared });
  };

  const onDelete = async (id: number) => {
    if (await confirmDialog('Видалити бажання?')) remove.mutate(id);
  };

  const onReserve = async (id: number, reserved: boolean) => {
    if (!reserved && !(await confirmDialog('Скасувати бронювання цього подарунка?'))) return;
    setReserved.mutate({ id, reserved });
  };

  const onPurchased = async (item: WishlistItemV3) => {
    if (
      await confirmDialog(
        `Позначити «${item.title}» як куплений подарунок?\n\nПісля цього скасувати бронювання вже не можна.`,
      )
    ) {
      markPurchased.mutate(item.id);
    }
  };

  const onPreparing = (item: WishlistItemV3) => {
    markPreparing.mutate(item.id);
  };

  const onFulfill = async (item: WishlistItemV3) => {
    if (
      await confirmDialog(
        `Підтверджуєш, що подарунок «${item.title}» уже вручено? 🎁\n\nОбидва отримають сповіщення ✉️`,
      )
    ) {
      fulfill.mutate(item);
    }
  };

  const partnerName = partnerGenitive(partner?.name);
  const isItemOwn = (item: WishlistItemV3) =>
    tab === 'shared' ? item.owner === me.id : isOwnTab;
  const canManageReservation = (item: WishlistItemV3) => item.reserved_by === me.id;

  const pct = stats && stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  return (
    <section className="wishlist pink-page">
      <PortalDecor density="light" parallax={false} />
      <TabBar<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'me', label: 'Мої бажання' },
          { value: 'partner', label: `Бажання ${partnerName}` },
          { value: 'shared', label: 'Спільне', icon: '🎁' },
        ]}
      />

      <div className="wl-head">
        <h1 className="wl-title">
          {tab === 'me'
            ? 'Мої бажання'
            : tab === 'partner'
              ? `Бажання ${partnerName}`
              : '🎁 Спільні бажання'}
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
            <p className="wl-year-stat">
              Ви виконали {stats.doneThisYear} бажань разом цього року ❤️
            </p>
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
                  canManageReservation={canManageReservation(item)}
                  onPhotoClick={setLightbox}
                  onEdit={setEditing}
                  onDelete={onDelete}
                  onReserve={onReserve}
                  onPurchased={onPurchased}
                  onPreparing={onPreparing}
                  onFulfill={onFulfill}
                  onMove={setMoving}
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

      {moving && (
        <MoveWishModal
          item={moving}
          partner={partner}
          onClose={() => setMoving(null)}
          onMove={(owner, isShared) => changeScope.mutate({ id: moving.id, owner, isShared })}
        />
      )}

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
