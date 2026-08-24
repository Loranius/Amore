import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { PencilIcon } from '@/components/icons/UiIcon';
import { WishArchive as WishArchiveBase } from './WishArchiveBase';
import { ArchiveWishEditModal } from './ArchiveWishEditModal';
import type { WishlistViewMode } from './wishlistBoardView';
import type { WishlistArchiveScope } from './wishlistRpc';
import './wishlistArchiveCollaborative.css';

interface WishArchiveProps {
  scope: WishlistArchiveScope;
  ownerId?: number | null;
  onPhotoClick: (src: string) => void;
  openRequested?: boolean;
  openRequestKey?: string | null;
  focusWishId?: number | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  view: WishlistViewMode;
  onViewChange: (view: WishlistViewMode) => void;
  showViewPicker: boolean;
}

function ArchiveEditAction({ onEdit }: { onEdit: () => void }) {
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const findTarget = () => {
      const next = document.querySelector<HTMLElement>('.wl-archive-cloud-sheet-content');
      setTarget((current) => current === next ? current : next);
    };

    findTarget();
    const observer = new MutationObserver(findTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!target) return null;

  return createPortal(
    <button type="button" className="wl-archive-edit-completed" onClick={onEdit}>
      <span aria-hidden="true"><PencilIcon size={14} /></span>
      Редагувати бажання
    </button>,
    target,
  );
}

export function WishArchive(props: WishArchiveProps) {
  const [selectedWishId, setSelectedWishId] = useState<number | null>(null);
  const [editingWishId, setEditingWishId] = useState<number | null>(null);

  const captureArchiveSelection = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const card = target.closest('[data-wish-id]') as HTMLElement | null;
    const value = card?.dataset.wishId;
    if (value) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed) && parsed > 0) setSelectedWishId(parsed);
    }

    if (target.closest('.wl-cloud-sheet-close')) setSelectedWishId(null);
  };

  const beginEditing = () => {
    if (!selectedWishId) return;
    document.querySelector<HTMLButtonElement>('.wl-archive-cloud-sheet-close')?.click();
    setEditingWishId(selectedWishId);
    setSelectedWishId(null);
  };

  return (
    <>
      <div className="wl-archive-enhancer" onClickCapture={captureArchiveSelection}>
        <WishArchiveBase {...props} />
      </div>

      {selectedWishId && <ArchiveEditAction onEdit={beginEditing} />}

      {editingWishId && (
        <ArchiveWishEditModal
          wishId={editingWishId}
          ownerId={props.ownerId ?? null}
          shared={props.scope === 'shared'}
          onClose={() => setEditingWishId(null)}
          onPhotoClick={props.onPhotoClick}
        />
      )}
    </>
  );
}
