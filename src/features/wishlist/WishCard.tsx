// ============================================================
// WishCard — shared details state and explicit view trigger host
// ============================================================
import { useCallback, useState, type ReactNode } from 'react';
import type { WishCardContext } from './wishCardPresentation';
import { WishDetailsSheet } from './WishDetailsSheet';
import type { WishlistItemV3 } from './wishlistRpc';

export interface WishCardTriggerRenderProps {
  detailsOpen: boolean;
  openDetails: () => void;
}

export interface WishCardProps {
  item: WishlistItemV3;
  context?: WishCardContext;
  isOwn: boolean;
  canManageReservation: boolean;
  busy: boolean;
  onPhotoClick: (src: string) => void;
  onEdit: (item: WishlistItemV3) => void;
  onDelete: (id: number) => void;
  onReserve: (id: number, reserved: boolean) => void;
  onPurchased: (item: WishlistItemV3) => void;
  onFulfill: (item: WishlistItemV3) => void;
  onMove: (item: WishlistItemV3) => void;
  renderTrigger: (props: WishCardTriggerRenderProps) => ReactNode;
}

export function WishCard({
  item,
  context,
  isOwn,
  canManageReservation,
  busy,
  onPhotoClick,
  onEdit,
  onDelete,
  onReserve,
  onPurchased,
  onFulfill,
  onMove,
  renderTrigger,
}: WishCardProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const openDetails = useCallback(() => setDetailsOpen(true), []);
  const closeDetails = useCallback(() => setDetailsOpen(false), []);

  return (
    <>
      {renderTrigger({ detailsOpen, openDetails })}
      <WishDetailsSheet
        open={detailsOpen}
        item={item}
        context={context}
        isOwn={isOwn}
        canManageReservation={canManageReservation}
        busy={busy}
        onClose={closeDetails}
        onPhotoClick={onPhotoClick}
        onEdit={onEdit}
        onDelete={onDelete}
        onReserve={onReserve}
        onPurchased={onPurchased}
        onFulfill={onFulfill}
        onMove={onMove}
      />
    </>
  );
}
