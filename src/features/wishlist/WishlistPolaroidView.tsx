import { WishCard } from './WishCard';
import { WishlistPolaroidCard } from './WishlistPolaroidCard';
import type { WishlistItemV3 } from './wishlistRpc';

interface WishlistPolaroidViewProps {
  items: WishlistItemV3[];
  seed: number;
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

export function WishlistPolaroidView({
  items,
  seed,
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
}: WishlistPolaroidViewProps) {
  return (
    <div className="wl-polaroid-view" aria-label="Полароїди бажань">
      {items.map((item, index) => (
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
            <WishlistPolaroidCard
              item={item}
              index={index}
              seed={seed}
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
