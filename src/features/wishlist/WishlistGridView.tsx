// ============================================================
// Сітка мрій 2×N.
// ------------------------------------------------------------
// Один із ДВОХ виглядів вішліста; другий — бульбашки. Раніше їх було
// три: «стрічка» й «полароїд» показували те саме різними обгортками
// (ADR-0056).
//
// Оболонка лишається `WishCard` — вона тримає аркуш деталей і дії; сітка
// дає лише тригер. Тому перехід між виглядами не міняє нічого, крім
// того, як мрія виглядає до дотику.
// ============================================================
import { WishCard } from './WishCard';
import { WishlistGridCard } from './WishlistGridCard';
import type { WishlistItemV3 } from './wishlistRpc';

interface WishlistGridViewProps {
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

export function WishlistGridView({
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
}: WishlistGridViewProps) {
  return (
    <div className="wl-grid-view" aria-label="Сітка бажань">
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
            <WishlistGridCard
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
