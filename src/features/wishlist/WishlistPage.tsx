// ============================================================
// WishlistPage — вкладка «Бажання»
// ============================================================
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useConfirm } from '@/providers/ConfirmProvider';
import { useToast } from '@/providers/ToastProvider';
import { Lightbox } from '@/components/ui/Lightbox';
import { TabBar, type TabBarItem } from '@/components/ui/TabBar';
import { PortalDecor } from '@/features/auth/PortalDecor';
import { usePartnerQuery } from '@/features/_shared/useUsers';
import { WishCard } from './WishCard';
import { WishFormModal } from './WishFormModal';
import { MoveWishModal } from './MoveWishModal';
import { GiftCompletionModal, type GiftCompletionDraft } from './GiftCompletionModal';
import { WishArchive } from './WishArchive';
import { WishlistGridSkeleton, WishlistPageSkeleton } from './WishlistSkeleton';
import { WishlistHero } from './WishlistHero';
import { WishlistPartnerToolbar } from './WishlistPartnerToolbar';
import { WishlistSharedToolbar } from './WishlistSharedToolbar';
import { WishlistBoardToolbar } from './WishlistBoardToolbar';
import {
  filterPartnerWishes,
  partnerWishFilterCounts,
  type PartnerWishFilter,
} from './partnerWishFilter';
import {
  filterSharedWishes,
  sharedWishFilterCounts,
  type SharedWishFilter,
} from './sharedWishFilter';
import {
  applyWishlistBoardView,
  DEFAULT_WISHLIST_BOARD_VIEW,
  wishlistPriorityFilterCounts,
  type WishlistBoardViewState,
} from './wishlistBoardView';
import { partnerGenitive } from './partnerLabel';
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
import './wishlistArchiveRedesign.css';
import './wishlistFoundation.css';
import './wishlistHero.css';

type Tab = 'me' | 'partner' | 'shared';
type BoardViews = Record<Tab, WishlistBoardViewState>;

function requestedTab(value: string | null): Tab {
  return value === 'partner' || value === 'shared' ? value : 'me';
}

function requestedWishId(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function initialBoardViews(): BoardViews {
  return {
    me: { ...DEFAULT_WISHLIST_BOARD_VIEW },
    partner: { ...DEFAULT_WISHLIST_BOARD_VIEW },
    shared: { ...DEFAULT_WISHLIST_BOARD_VIEW },
  };
}

function partnerEmptyState(filter: PartnerWishFilter) {
  if (filter === 'available') {
    return {
      icon: '✓',
      title: 'Усі активні бажання вже заплановані',
      description: 'Переглянь «Мої подарунки» або відкрий повний список.',
    };
  }

  if (filter === 'mine') {
    return {
      icon: '🎁',
      title: 'Ти ще не запланував жодного подарунка',
      description: 'У вкладці «Доступні» можна обрати бажання партнера.',
    };
  }

  return {
    icon: '♡',
    title: 'У партнера поки немає активних бажань',
    description: 'Нові мрії з’являться тут одразу після додавання.',
  };
}

function sharedEmptyState(filter: SharedWishFilter, partnerName: string) {
  if (filter === 'mine') {
    return {
      title: 'Ти ще не додав спільних ідей',
      description: 'Створи мрію, яку ви зможете редагувати й здійснити разом.',
    };
  }

  if (filter === 'partner') {
    return {
      title: `Ідей від ${partnerGenitive(partnerName)} поки немає`,
      description: 'Ідеї партнера з’являться тут одразу після створення.',
    };
  }

  return {
    title: 'Спільних мрій поки немає',
    description: 'Додайте першу ідею для подорожі, враження або спільної покупки.',
  };
}

export function WishlistPage() {
  const me = useCurrentUser();
  const toast = useToast();
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
  const [archiveOpen, setArchiveOpen] = useState(
    archiveRequested && tabFromUrl !== 'partner',
  );
  const [partnerFilter, setPartnerFilter] = useState<PartnerWishFilter>('available');
  const [sharedFilter, setSharedFilter] = useState<SharedWishFilter>('all');
  const [boardViews, setBoardViews] = useState<BoardViews>(initialBoardViews);
  const actionLock = useRef(false);

  useEffect(() => {
    setTab(tabFromUrl);
    if (tabFromUrl === 'partner') setArchiveOpen(false);
  }, [tabFromUrl]);

  useEffect(() => {
    if (archiveRequested && tabFromUrl !== 'partner') setArchiveOpen(true);
  }, [archiveRequested, notificationRequest, tabFromUrl]);

  const isOwnTab = tab === 'me';
  const ownerId = tab === 'shared' ? null : isOwnTab ? me.id : (partner?.id ?? null);

  // All three active scopes load in parallel. This keeps tab counters accurate
  // and makes switching tabs instant without changing the RPC contract.
  const ownQuery = useWishlistItems(me.id);
  const partnerWishlistQuery = useWishlistItems(partner?.id ?? null);
  const sharedQuery = useSharedWishlistItems();
  const { data: stats } = useCoupleWishStats();

  const ownItems = ownQuery.data ?? [];
  const partnerItems = partnerWishlistQuery.data ?? [];
  const sharedItems = sharedQuery.data ?? [];
  const activeQuery = tab === 'me'
    ? ownQuery
    : tab === 'partner'
      ? partnerWishlistQuery
      : sharedQuery;
  const items = tab === 'me' ? ownItems : tab === 'partner' ? partnerItems : sharedItems;
  const isPending = activeQuery.isPending;
  const isFetching = activeQuery.isFetching;
  const isError = activeQuery.isError;
  const refetchItems = activeQuery.refetch;
  const partnerCounts = partnerWishFilterCounts(partnerItems, me.id);
  const sharedCounts = sharedWishFilterCounts(sharedItems, me.id, partner?.id ?? -1);
  const contextItems = tab === 'partner'
    ? filterPartnerWishes(partnerItems, partnerFilter, me.id)
    : tab === 'shared' && partner
      ? filterSharedWishes(sharedItems, sharedFilter, me.id, partner.id)
      : items;
  const activeBoardView = boardViews[tab];
  const boardFilterCounts = wishlistPriorityFilterCounts(contextItems);
  const visibleItems = applyWishlistBoardView(contextItems, activeBoardView);

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
        toast.show('Партнер щойно оновив цю мрію. Ми завантажили актуальну версію.');
        throw new Error('Перевір оновлені дані та збережи мрію ще раз.');
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

  const tabs: TabBarItem<Tab>[] = [
    {
      value: 'me',
      label: 'Мої',
      ...(!ownQuery.isPending && !ownQuery.isError ? { count: ownItems.length } : {}),
    },
    {
      value: 'partner',
      label: partnerGenitive(partner.name),
      ...(!partnerWishlistQuery.isPending && !partnerWishlistQuery.isError
        ? { count: partnerItems.length }
        : {}),
    },
    {
      value: 'shared',
      label: 'Спільні',
      ...(!sharedQuery.isPending && !sharedQuery.isError ? { count: sharedItems.length } : {}),
    },
  ];

  const partnerEmptyCopy = tab === 'partner' ? partnerEmptyState(partnerFilter) : null;
  const sharedEmptyCopy = tab === 'shared' ? sharedEmptyState(sharedFilter, partner.name) : null;
  const canShowArchive = tab === 'me' || tab === 'shared';

  const changeTab = (nextTab: Tab) => {
    setTab(nextTab);
    if (nextTab === 'partner') setArchiveOpen(false);
  };

  const changeBoardView = (nextView: WishlistBoardViewState) => {
    setBoardViews((current) => ({ ...current, [tab]: nextView }));
  };

  return (
    <section
      className="wishlist pink-page"
      aria-busy={(!archiveOpen && isPending) || mutationBusy}
    >
      <PortalDecor density="light" parallax={false} />

      {!archiveOpen && (
        <WishlistHero
          tab={tab}
          meName={me.name}
          partnerName={partner.name}
          activeCount={isPending || isError ? null : items.length}
          stats={stats}
          busy={mutationBusy}
          onAdd={() => setAdding(true)}
        />
      )}

      <TabBar<Tab> value={tab} onChange={changeTab} items={tabs} />

      {archiveOpen && canShowArchive ? (
        <WishArchive
          scope={tab === 'shared' ? 'shared' : 'personal'}
          ownerId={tab === 'me' ? me.id : null}
          onPhotoClick={setLightbox}
          openRequested={archiveRequested}
          openRequestKey={notificationRequest}
          focusWishId={archiveFocusWishId}
          open
          onOpenChange={setArchiveOpen}
        />
      ) : (
        <>
          {tab === 'partner' && !isPending && !isError && (
            <WishlistPartnerToolbar
              value={partnerFilter}
              counts={partnerCounts}
              onChange={setPartnerFilter}
            />
          )}

          {tab === 'shared' && !isPending && !isError && (
            <WishlistSharedToolbar
              value={sharedFilter}
              partnerName={partner.name}
              counts={sharedCounts}
              onChange={setSharedFilter}
            />
          )}

          {!isPending && !isError && contextItems.length > 0 && (
            <WishlistBoardToolbar
              value={activeBoardView}
              counts={boardFilterCounts}
              resultCount={visibleItems.length}
              onChange={changeBoardView}
            />
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
                {visibleItems.length === 0 ? (
                  contextItems.length > 0 ? (
                    <div className="wl-board-filter-empty">
                      <div>
                        <span aria-hidden="true">✦</span>
                        <strong>За цим фільтром бажань немає</strong>
                        <p>Обери «Усі» або зміни пріоритет, щоб повернути картки.</p>
                      </div>
                    </div>
                  ) : tab === 'partner' && partnerEmptyCopy ? (
                    <div className="wl-partner-empty">
                      <div>
                        <span aria-hidden="true">{partnerEmptyCopy.icon}</span>
                        <strong>{partnerEmptyCopy.title}</strong>
                        <p>{partnerEmptyCopy.description}</p>
                      </div>
                    </div>
                  ) : tab === 'shared' && sharedEmptyCopy ? (
                    <div className="wl-shared-empty">
                      <div>
                        <span aria-hidden="true">✨</span>
                        <strong>{sharedEmptyCopy.title}</strong>
                        <p>{sharedEmptyCopy.description}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="empty-state">Твій список порожній. Час додати нову забаганку.</p>
                  )
                ) : (
                  visibleItems.map((item) => (
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

              {canShowArchive && (
                <WishArchive
                  scope={tab === 'shared' ? 'shared' : 'personal'}
                  ownerId={tab === 'me' ? me.id : null}
                  onPhotoClick={setLightbox}
                  openRequested={archiveRequested}
                  openRequestKey={notificationRequest}
                  focusWishId={archiveFocusWishId}
                  open={false}
                  onOpenChange={setArchiveOpen}
                />
              )}
            </>
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
