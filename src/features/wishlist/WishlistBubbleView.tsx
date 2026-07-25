import { WishCard } from './WishCard';
import { WishlistBubbleCard } from './WishlistBubbleCard';
import { WishlistBubblePhysics } from './WishlistBubblePhysics';
import type { WishlistItemV3 } from './wishlistRpc';

interface WishlistBubbleViewProps {
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

export function WishlistBubbleView({
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
}: WishlistBubbleViewProps) {
  return (
    <>
      <div className="wishlist-grid wl-bubble-view" aria-label="Бульбашки бажань">
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
              <WishlistBubbleCard
                item={item}
                busy={busy}
                detailsOpen={detailsOpen}
                onOpen={openDetails}
              />
            )}
          />
        ))}
      </div>
      <WishlistBubblePhysics />
    </>
  );
}
