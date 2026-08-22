import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { usePartnerQuery } from '@/features/_shared/useUsers';
import { WishFormModal } from './WishFormModal';
import type { WishFormPayload } from './useWishlist';
import {
  fetchWishlistV3,
  updateWishlistItem,
  type WishlistItemV3,
} from './wishlistRpc';

interface ArchiveWishEditModalProps {
  wishId: number;
  ownerId: number | null;
  shared: boolean;
  onClose: () => void;
  onPhotoClick: (src: string) => void;
}

export function ArchiveWishEditModal({
  wishId,
  ownerId,
  shared,
  onClose,
  onPhotoClick,
}: ArchiveWishEditModalProps) {
  const me = useCurrentUser();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { partner } = usePartnerQuery();

  const query = useQuery({
    queryKey: ['wishlist', 'archive-edit', shared ? 'shared' : ownerId, wishId],
    enabled: shared || ownerId !== null,
    queryFn: async (): Promise<WishlistItemV3> => {
      const rows = await fetchWishlistV3({
        ownerId: shared ? null : ownerId,
        shared,
        includeArchived: true,
      });
      const item = rows.find((row) => row.id === wishId && row.fulfilled);
      if (!item) throw new Error('archive_wish_not_found');
      return item;
    },
  });

  if (query.isPending) {
    return (
      <div className="modal-overlay wl-archive-edit-overlay">
        <div className="modal-sheet wl-archive-edit-state" role="status">
          <strong>Відкриваємо виконане бажання…</strong>
          <p>Завантажуємо актуальні дані перед редагуванням.</p>
        </div>
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div
        className="modal-overlay wl-archive-edit-overlay"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="modal-sheet wl-archive-edit-state" role="alert">
          <button type="button" className="gift-memory-close" aria-label="Закрити" onClick={onClose}>
            ×
          </button>
          <strong>Не вдалося відкрити бажання</strong>
          <p>Онови архів і спробуй ще раз.</p>
          <button type="button" className="btn-secondary" onClick={() => void query.refetch()}>
            Спробувати ще
          </button>
        </div>
      </div>
    );
  }

  const item = query.data;
  const defaultScope = item.is_shared
    ? 'shared'
    : item.owner === me.id
      ? 'me'
      : 'partner';

  const submit = async (
    id: number | null,
    payload: WishFormPayload,
  ): Promise<void> => {
    if (id !== item.id) throw new Error('archive_wish_id_mismatch');

    try {
      await updateWishlistItem(item.id, item.version, payload);
      await queryClient.invalidateQueries({ queryKey: ['wishlist'] });
      toast.show('Виконане бажання оновлено.');
    } catch (error) {
      const message = (error as Error).message;
      if (message.includes('wish_version_conflict')) {
        await query.refetch();
        toast.show('Партнер щойно змінив це бажання. Ми завантажили актуальну версію.');
      } else if (message.includes('wish_not_editable')) {
        toast.show('Це бажання більше не доступне для редагування.');
      } else {
        toast.show('Не вдалося зберегти виконане бажання. Спробуй ще.');
      }
      throw error;
    }
  };

  return (
    <WishFormModal
      key={`archive-edit-${item.id}-${item.version}`}
      item={item}
      partner={partner ?? null}
      defaultScope={defaultScope}
      defaultSecret={item.is_secret}
      onClose={onClose}
      onSubmit={submit}
      onPhotoClick={onPhotoClick}
    />
  );
}
