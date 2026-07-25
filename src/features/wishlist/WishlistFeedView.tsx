import { WishCard } from './WishCard';
import { WishlistFeedCard } from './WishlistFeedCard';
import type { WishlistItemV3 } from './wishlistRpc';

interface WishlistFeedViewProps {
  items: WishlistItemV3[];
  busy: boolean;
  isItemOwn: (item: WishlistItemV3) => boolean;
  canManageReservation: (item: WishlistItemV3) => boolean;
  onPhotoClick: (src: string) => void;
  onEdit: (item: WishlistItemV3) => void;
  onDelete: (id: number) => void;
  onReserve: (id: number, reserved: boolean) => void;
  onPurchased: (item: WishlistItemV3) => void;
  onFulfill: (item: WishlistItemV3) => void;
  onMove: (item: WishlistItemV3) => void;
}

export function WishlistFeedView({
  items,
  busy,
  isItemOwn,
  canManageReservation,
  onPhotoClick,
  onEdit,
  onDelete,
  onReserve,
  onPurchased,
  onFulfill,
  onMove,
}: WishlistFeedViewProps) {
  return (
    <div className="wl-feed-view" aria-label="Стрічка бажань">
      {items.map((item) => (
        <WishCard
          key={item.id}
          item={item}
          isOwn={isItemOwn(item)}
          canManageReservation={canManageReservation(item)}
          busy={busy}
          onPhotoClick={onPhotoClick}
          onEdit={onEdit}
          onDelete={onDelete}
          onReserve={onReserve}
          onPurchased={onPurchased}
          onFulfill={onFulfill}
          onMove={onMove}
          renderTrigger={({ openDetails, detailsOpen }) => (
            <WishlistFeedCard
              item={item}
              busy={busy}
              detailsOpen={detailsOpen}
              onOpen={openDetails}
            />
          )}
        />
      ))}
    </div>
  );
}
