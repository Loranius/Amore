import { useMemo, useRef, useState } from 'react';
import { WishCard } from './WishCard';
import { WishlistBubbleCard } from './WishlistBubbleCard';
import { WishlistBubblePhysics } from './WishlistBubblePhysics';
import { freshWishlistCloudSeed } from './wishlistCloudLayout';
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
  const boardRef = useRef<HTMLDivElement>(null);
  // Свіжий seed на монтування вигляду: дошка щоразу складається інакше, але
  // поки користувач у ній — нічого не стрибає. Ініціалізатор `useState`
  // виконується один раз, тож це нуль роботи в кадрі.
  const [seed] = useState(freshWishlistCloudSeed);
  const contentKey = useMemo(
    () => items.map((item) => `${item.id}:${item.version}`).join('|'),
    [items],
  );

  return (
    <>
      <div
        ref={boardRef}
        className="wishlist-grid wl-bubble-view"
        aria-label="Бульбашки бажань"
      >
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
                seed={seed}
                busy={busy}
                detailsOpen={detailsOpen}
                onOpen={openDetails}
              />
            )}
          />
        ))}
      </div>
      <WishlistBubblePhysics containerRef={boardRef} contentKey={contentKey} />
    </>
  );
}
