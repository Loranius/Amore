// ============================================================
// WishlistPage — вкладка «Бажання»
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { Lightbox } from '@/components/ui/Lightbox';
import { TabBar } from '@/components/ui/TabBar';
import { PortalDecor } from '@/features/auth/PortalDecor';
import { usePartnerQuery } from '@/features/_shared/useUsers';
import { WishCard } from './WishCard';
import { WishFormModal } from './WishFormModal';
import { MoveWishModal } from './MoveWishModal';
import { GiftCompletionModal, type GiftCompletionDraft } from './GiftCompletionModal';
import { WishArchive } from './WishArchive';
import { WishlistGridSkeleton, WishlistPageSkeleton } from './WishlistSkeleton';
import { partnerWishlistTitle } from './partnerLabel';
import { useQuickWishlistCompletion } from './useQuickWishlistCompletion';
import {
  useWishlistItems,
  useSharedWishlistItems,
  useCoupleWishStats,
  useWishlistMutations,
  type WishFormPayload,
} from './useWishlist';
import type { WishlistItemV3 } from './wishlistRpc';
import './wishlistV3.mobile.css';
import './wishlistGiftArchive.css';
import './wishlistFoundation.css';

type Tab = 'me' | 'partner' | 'shared';

function requestedTab(value: string | null): Tab {
  return value === 'partner' || value === 'shared' ? value : 'me';
}

function requestedWishId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export function WishlistPage() {
  const me = useCurrentUser();
  const {
    partner,
    isPending: partnerPending,
    isError: partnerError,
    refetch: refetchPartner,
  } = usePartnerQuery();
  const [searchParams] = useSearchParams();
  const tabFromUrl = requestedTab(searchParams.get('tab'));
  const archiveRequested = searchParams.get('archive') === '1';
  const notificationRequest = searchParams.get('notification');
  const archiveFocusWishId = requestedWishId(searchParams.get('wish'));
  const [tab, setTab] = useState<Tab>(tabFromUrl);
  const actionLock = useRef(false);

  useEffect(() => {
    setTab(tabFromUrl);
  }, [tabFromUrl]);

  const isOwnTab = tab === 'me';
  const ownerId = tab === 'shared' ? null : isOwnTab ? me.id : (partner?.id ?? null);

  const {
    data: ownItems = [],
    isPending: ownPending,
    isFetching: ownFetching,
    isError: ownError,
    refetch: refetchOwn,
  } = useWishlistItems(ownerId);
  const {
    data: sharedItems = [],
    isPending: sharedPending,
    isFetching: sharedFetching,
    isError: sharedError,
    refetch: refetchShared,
  } = useSharedWishlistItems();
  const { data: stats } = useCoupleWishStats();

  const items = tab === 'shared' ? sharedItems : ownItems;
  const isPending = tab === 'shared' ? sharedPending : ownPending;
  const isFetching = tab === 'shared' ? sharedFetching : ownFetching;
  const isError = tab === 'shared' ? sharedError : ownError;
  const refetchItems = tab === 'shared' ? refetchShared : refetchOwn;

  const {
    save,
    remove,
    setReserved,
    markPurchased,
    fulfill,
    changeScope,
  } = useWishlistMutations(ownerId);
  const quickFulfill = useQuickWishlistCompletion();
  const confirmDialog = useConfirm();

  const [editing, setEditing] = useState<WishlistItemV3 | null>(null);
  const [adding, setAdding] = useState(false);
  const [moving, setMoving] = useState<WishlistItemV3 | null>(null);
  const [completing, setCompleting] = useState<WishlistItemV3 | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const mutationBusy =
    save.isPending
    || remove.isPending
    || setReserved.isPending
    || markPurchased.isPending
    || quickFulfill.isPending
    || fulfill.isPending
    || changeScope.isPending;

  const runAction = async (action: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    try {
      await action();
    } finally {
      actionLock.current = false;
    }
  };

  const submit = async (
    id: number | null,
    payload: WishFormPayload,
    scope: { owner: number; isShared: boolean },
  ): Promise<void> => {
    try {
      await save.mutateAsync({
        id,
        payload,
        owner: scope.owner,
        isShared: scope.isShared,
        expectedVersion: editing?.version ?? 0,
      });
    } catch (error) {
      if (id !== null && (error as Error).message.includes('wish_version_conflict')) {
        const refreshed = await refetchItems();
        const freshItem = (refreshed.data ?? []).find((item) => item.id === id);
        if (freshItem) setEditing(freshItem);
      }
      throw error;
    }
  };

  const onDelete = async (id: number) => {
    await runAction(async () => {
      if (await confirmDialog('Видалити бажання?')) await remove.mutateAsync(id);
    });
  };

  const onReserve = async (id: number, reserved: boolean) => {
    await runAction(async () => {
      if (!reserved && !(await confirmDialog('Скасувати планування цього подарунка?'))) return;
      await setReserved.mutateAsync({ id, reserved });
    });
  };

  const onPurchased = async (item: WishlistItemV3) => {
    await runAction(async () => {
      if (
        await confirmDialog(
          `Позначити «${item.title}» як куплений подарунок?\n\nПісля цього скасувати виконання вже не можна.`,
        )
      ) {
        await markPurchased.mutateAsync(item.id);
      }
    });
  };

  const onFulfill = async (item: WishlistItemV3) => {
    if (item.completion_mode === 'shared') {
      setCompleting(item);
      return;
    }

    await runAction(async () => {
      await quickFulfill.mutateAsync(item);
    });
  };

  const completeGift = async (draft: GiftCompletionDraft) => {
    if (!completing) return;
    await fulfill.mutateAsync({ item: completing, ...draft });
    setCompleting(null);
  };

  const isItemOwn = (item: WishlistItemV3) =>
    tab === 'shared' ? item.owner === me.id : isOwnTab;
  const canManageReservation = (item: WishlistItemV3) => item.reserved_by === me.id;

  const pct = stats && stats.total ? Math.round((stats.done / stats.total) * 100) : 0;

  // Не будуємо вкладку партнера до отримання фактичного іншого користувача.
  // Так у DOM ніколи не з'являється тимчасове «Бажання Партнера».
  if (partnerPending) return <WishlistPageSkeleton />;

  if (partnerError || !partner) {
    return (
      <section className="wishlist pink-page">
        <PortalDecor density="light" parallax={false} />
        <div className="empty-state" role="alert">
          <p>Не вдалося визначити іншого користувача в парі.</p>
          <button type="button" className="btn btn-secondary" onClick={() => void refetchPartner()}>
            Спробувати ще
          </button>
        </div>
      </section>
    );
  }

  const partnerTitle = partnerWishlistTitle(partner.name);

  return (
    <section className="wishlist pink-page" aria-busy={isPending || mutationBusy}>
      <PortalDecor density="light" parallax={false} />
      <TabBar<Tab>
        value={tab}
        onChange={setTab}
        items={[
          { value: 'me', label: 'Мої бажання' },
          { value: 'partner', label: partnerTitle },
          { value: 'shared', label: 'Спільне', icon: '🎁' },
        ]}
      />

      <div className="wl-head">
        <h1 className="wl-title">
          {tab === 'me'
            ? 'Мої бажання'
            : tab === 'partner'
              ? partnerTitle
              : '🎁 Спільні бажання'}
        </h1>
        <button type="button" className="btn" disabled={mutationBusy} onClick={() => setAdding(true)}>
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
        <div role="status" aria-live="polite" aria-label="Завантаження бажань">
          <WishlistGridSkeleton />
        </div>
      ) : isError ? (
        <div className="empty-state" role="alert">
          <p>Не вдалось завантажити бажання. Перевір з’єднання й повтори.</p>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={isFetching}
            onClick={() => void refetchItems()}
          >
            {isFetching ? 'Повторюємо…' : 'Спробувати ще'}
          </button>
        </div>
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
                  busy={mutationBusy}
                  onPhotoClick={setLightbox}
                  onEdit={setEditing}
                  onDelete={onDelete}
                  onReserve={onReserve}
                  onPurchased={onPurchased}
                  onFulfill={(wish) => void onFulfill(wish)}
                  onMove={setMoving}
                />
              ))
            )}
          </div>

          {(tab === 'me' || tab === 'shared') && (
            <WishArchive
              scope={tab === 'shared' ? 'shared' : 'personal'}
              ownerId={tab === 'me' ? me.id : null}
              onPhotoClick={setLightbox}
              openRequested={archiveRequested}
              openRequestKey={notificationRequest}
              focusWishId={archiveFocusWishId}
            />
          )}
        </>
      )}

      {(adding || editing) && (
        <WishFormModal
          key={editing ? `edit-${editing.id}-${editing.version}` : 'new-wish'}
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
          saving={changeScope.isPending}
          onClose={() => {
            if (!changeScope.isPending) setMoving(null);
          }}
          onMove={async (owner, isShared) => {
            await changeScope.mutateAsync({ id: moving.id, owner, isShared });
          }}
        />
      )}

      {completing && (
        <GiftCompletionModal
          item={completing}
          saving={fulfill.isPending}
          onClose={() => {
            if (!fulfill.isPending) setCompleting(null);
          }}
          onSubmit={completeGift}
        />
      )}

      <Lightbox src={lightbox} onClose={() => setLightbox(null)} />
    </section>
  );
}
