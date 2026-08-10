import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useArtifactWorld } from '@/features/world/artifactWorldContext';
import type { WishSubject } from '@/features/home/crystal3d/scene/wishCrystals';
import { WishCard } from './WishCard';
import type { WishlistItemV3 } from './wishlistRpc';

// ============================================================
// Crystal View — бажання показує світ, а не сторінка (бриф §28, §30).
// ------------------------------------------------------------
// Тут немає жодної плитки: тіла малює сцена, і цей компонент лише каже їй, що
// показувати, та лишає доступний шлях до кожного бажання.
//
// **Прихований список — не милиця, а вимога.** §48: «functional use without
// requiring 3D understanding» і «no information available only through spatial
// placement». Тож кожне бажання має справжню кнопку в DOM: її бачить читач
// екрана, до неї доходить Tab, і саме її «натискає» дотик по кристалу. Один
// шлях відкриття замість двох — і той, що працює без WebGL, є первинним.
// ============================================================

export interface WishlistCrystalViewProps {
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

function wishPriority(value: string | null): WishSubject['priority'] {
  if (value === 'high' || value === 'medium' || value === 'low') return value;
  return null;
}

/**
 * Кнопка бажання, яка ще й повідомляє, чи відкрито його аркуш.
 *
 * Окремим компонентом, бо `renderTrigger` викликається під час рендера
 * картки — хука там поставити нікуди, а повідомляти про стан треба ефектом.
 */
function WishTrigger({
  id,
  title,
  detailsOpen,
  openDetails,
  onOpenChange,
  register,
}: {
  id: number;
  title: string;
  detailsOpen: boolean;
  openDetails: () => void;
  onOpenChange: (id: number, open: boolean) => void;
  register: (id: number, node: HTMLButtonElement | null) => void;
}) {
  useEffect(() => {
    onOpenChange(id, detailsOpen);
  }, [id, detailsOpen, onOpenChange]);

  return (
    <button
      type="button"
      className="wl-crystal-trigger"
      ref={(node) => { register(id, node); }}
      onClick={openDetails}
    >
      {title}
    </button>
  );
}

export function WishlistCrystalView({ items, ...card }: WishlistCrystalViewProps) {
  const { showWishBoard } = useArtifactWorld();
  const triggers = useRef(new Map<number, HTMLButtonElement>());
  const [focused, setFocused] = useState<number | null>(null);

  const register = useCallback((id: number, node: HTMLButtonElement | null) => {
    if (node === null) triggers.current.delete(id);
    else triggers.current.set(id, node);
  }, []);

  const onOpenChange = useCallback((id: number, open: boolean) => {
    setFocused((current) => {
      if (open) return id;
      return current === id ? null : current;
    });
  }, []);

  const wishes = useMemo<readonly WishSubject[]>(
    () => items.map((item) => ({
      id: item.id,
      // Оброблене фото має пріоритет — воно вже без фону, тобто всередині
      // кристала виглядає предметом, а не прямокутником.
      photo: item.processed_image_url ?? item.image_url ?? null,
      priority: wishPriority(item.priority),
    })),
    [items],
  );

  useEffect(() => {
    showWishBoard({
      wishes,
      onSelect: (wishId) => { triggers.current.get(wishId)?.click(); },
      focused,
    });
    return () => showWishBoard(null);
  }, [wishes, focused, showWishBoard]);

  return (
    <div className="wl-crystal-view">
      {items.map((item) => (
        <WishCard
          key={item.id}
          item={item}
          isOwn={card.isItemOwn(item)}
          canManageReservation={card.canManageReservation(item)}
          busy={card.busy}
          onPhotoClick={card.onPhotoClick}
          onEdit={card.onEdit}
          onDelete={card.onDelete}
          onReserve={card.onReserve}
          onPurchased={card.onPurchased}
          onFulfill={card.onFulfill}
          onMove={card.onMove}
          renderTrigger={({ openDetails, detailsOpen }) => (
            <WishTrigger
              id={item.id}
              title={item.title}
              detailsOpen={detailsOpen}
              openDetails={openDetails}
              onOpenChange={onOpenChange}
              register={register}
            />
          )}
        />
      ))}
    </div>
  );
}
