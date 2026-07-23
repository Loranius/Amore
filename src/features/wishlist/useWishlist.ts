// ============================================================
// useWishlist — дані вкладки «Бажання»
// ------------------------------------------------------------
// Wishlist v3 читає дані лише через role-safe RPC: власник не отримує
// reserved_by та не бачить приватні стадії purchased/preparing_surprise.
// Усі доменні зміни виконуються серверними RPC із перевіркою ролі й стану.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, invokeFn, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress, normalize } from '@/lib/images';
import { burstConfetti } from '@/lib/confetti';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsers, usePartner } from '@/features/_shared/useUsers';
import {
  cancelWishlistReservation,
  completeWishlistGift,
  createWishlistItem,
  fetchFulfilledWishlistV3,
  fetchWishlistStatsV3,
  fetchWishlistV3,
  markWishlistPreparing,
  markWishlistPurchased,
  moveWishlistItem,
  reserveWishlistItem,
  softDeleteWishlistItem,
  updateWishlistItem,
  type GiftMemoryArchiveItem,
  type WishlistItemV3,
} from './wishlistRpc';
import {
  removeGiftMemoryAssets,
  uploadGiftMemoryAssets,
  type GiftMemoryFiles,
} from './giftMemory';
import type { WishlistItemRow, UserName } from '@/types';

const BUCKET = 'wishlist-photos';
const ARCHIVE_SIGNED_URL_REFRESH_MS = 5 * 60 * 60 * 1000;
const ARCHIVE_STALE_TIME_MS = 4 * 60 * 60 * 1000;

const GENITIVE: Record<UserName, string> = { Діма: 'Діми', Лєна: 'Лєни' };
export function partnerGenitive(name: string | undefined): string {
  return name && name in GENITIVE ? GENITIVE[name as UserName] : (name ?? 'Партнера');
}

export { usePartner };

// ── Запити ───────────────────────────────────────────────────
export function useWishlistItems(ownerId: number | null) {
  return useQuery({
    queryKey: qk.wishlist(ownerId ?? -1),
    enabled: ownerId !== null,
    queryFn: async (): Promise<WishlistItemV3[]> =>
      fetchWishlistV3({ ownerId, shared: false }),
  });
}

/** Спільні бажання («Спільне») — видимі обом, незалежно від owner. */
export function useSharedWishlistItems() {
  return useQuery({
    queryKey: qk.wishlistShared(),
    queryFn: async (): Promise<WishlistItemV3[]> =>
      fetchWishlistV3({ ownerId: null, shared: true }),
  });
}

/** Прогрес пари без прямого читання таблиці або приватних полів бронювання. */
export function useCoupleWishStats() {
  return useQuery({
    queryKey: qk.wishlistStats(),
    queryFn: fetchWishlistStatsV3,
  });
}

export function useFulfilledWishes(ownerId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.wishlistFulfilled(ownerId ?? -1),
    enabled: enabled && ownerId !== null,
    queryFn: async (): Promise<GiftMemoryArchiveItem[]> =>
      fetchFulfilledWishlistV3(ownerId!),
    staleTime: ARCHIVE_STALE_TIME_MS,
    refetchInterval: enabled ? ARCHIVE_SIGNED_URL_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

// ── Завантаження фото ────────────────────────────────────────
export async function uploadWishPhoto(file: File, userId: number): Promise<string> {
  const normalized = await normalize(file);

  let blob: Blob = normalized;
  let ext = (normalized.name.split('.').pop() || 'jpg').toLowerCase();
  let contentType = normalized.type;
  try {
    const out = await compress(normalized, 1080, 0.78);
    blob = out.blob;
    ext = out.ext;
    contentType = out.contentType;
  } catch (e) {
    console.warn('[Wishlist] стиснення не вдалося, вантажимо оригінал:', e);
  }

  const path = `wish-${userId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType,
  });
  if (error) throw error;
  return publicUrl(BUCKET, path);
}

// ── Мутації ──────────────────────────────────────────────────
export interface WishFormPayload {
  title: string;
  link: string | null;
  image_url: string | null;
  price: number | null;
  priority: WishlistItemRow['priority'];
  description: string | null;
}

export interface CompleteGiftInput extends GiftMemoryFiles {
  item: WishlistItemV3;
  comment: string;
}

export function useWishlistMutations(ownerId: number | null) {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();
  const { data: users } = useUsers();
  const key = ownerId !== null ? qk.wishlist(ownerId) : qk.wishlistShared();

  const snapshot = () => client.getQueryData<WishlistItemV3[]>(key);
  const rollback = (prev: WishlistItemV3[] | undefined) => {
    if (prev) client.setQueryData(key, prev);
  };
  const invalidateBoth = () => {
    void client.invalidateQueries({ queryKey: ['wishlist'] });
  };

  const save = useMutation({
    mutationFn: async (input: {
      id: number | null;
      payload: WishFormPayload;
      owner?: number;
      isShared?: boolean;
    }) => {
      if (input.id !== null) {
        await updateWishlistItem(input.id, input.payload);
      } else {
        await createWishlistItem({
          payload: input.payload,
          ownerId: input.owner ?? me.id,
          shared: input.isShared ?? false,
        });
      }
    },
    onSuccess: invalidateBoth,
    onError: (e) => {
      const message = (e as Error).message;
      toast.show(
        message.includes('wish_not_editable')
          ? 'Цю мрію вже не можна редагувати.'
          : 'Не вдалося зберегти бажання. Спробуй ще.',
      );
    },
  });

  const remove = useMutation({
    mutationFn: softDeleteWishlistItem,
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const prev = snapshot();
      client.setQueryData<WishlistItemV3[]>(key, (old) =>
        (old ?? []).filter((i) => i.id !== id),
      );
      return { prev };
    },
    onError: (e, _v, ctx) => {
      rollback(ctx?.prev);
      toast.show(
        (e as Error).message.includes('wish_not_deletable')
          ? 'Заброньовану або завершену мрію видалити не можна.'
          : 'Не вдалося видалити бажання. Спробуй ще.',
      );
    },
    onSettled: invalidateBoth,
  });

  // Без оптимістики: сервер спочатку підтверджує атомарне бронювання.
  const setReserved = useMutation({
    mutationFn: async (v: { id: number; reserved: boolean }) => {
      if (v.reserved) await reserveWishlistItem(v.id);
      else await cancelWishlistReservation(v.id);
    },
    onSuccess: invalidateBoth,
    onError: (e) => {
      const message = (e as Error).message;
      toast.show(
        message.includes('wish_not_reservable')
          ? 'Цю мрію вже хтось узяв на себе.'
          : 'Не вдалося оновити бронювання. Спробуй ще.',
      );
    },
  });

  const markPurchased = useMutation({
    mutationFn: (id: number) => markWishlistPurchased(id),
    onSuccess: invalidateBoth,
    onError: (e) =>
      toast.show(
        (e as Error).message.includes('wish_not_purchasable')
          ? 'Цей подарунок уже не можна позначити як куплений.'
          : 'Не вдалося оновити етап покупки. Спробуй ще.',
      ),
  });

  const markPreparing = useMutation({
    mutationFn: (id: number) => markWishlistPreparing(id),
    onSuccess: invalidateBoth,
    onError: (e) =>
      toast.show(
        (e as Error).message.includes('wish_not_preparable')
          ? 'Спочатку познач подарунок як куплений.'
          : 'Не вдалося почати підготовку сюрпризу.',
      ),
  });

  const changeScope = useMutation({
    mutationFn: async (v: { id: number; owner: number; isShared: boolean }) => {
      await moveWishlistItem(v.id, v.owner, v.isShared);
    },
    onSuccess: invalidateBoth,
    onError: (e) =>
      toast.show(
        (e as Error).message.includes('wish_not_movable')
          ? 'Цю мрію вже не можна переносити.'
          : 'Не вдалося перенести бажання. Спробуй ще.',
      ),
  });

  const fulfill = useMutation({
    mutationFn: async ({ item, photo, video, comment }: CompleteGiftInput) => {
      const idempotencyKey = crypto.randomUUID();
      const uploaded = await uploadGiftMemoryAssets({
        wishId: item.id,
        userId: me.id,
        idempotencyKey,
        files: { photo, video },
      });

      try {
        await completeWishlistGift({
          wishId: item.id,
          idempotencyKey,
          reactionPhotoPath: uploaded.photoPath,
          reactionVideoPath: uploaded.videoPath,
          comment: comment.trim() || null,
        });
      } catch (error) {
        await removeGiftMemoryAssets(uploaded.uploadedPaths);
        throw error;
      }

      const owner = (users ?? []).find((u) => u.id === item.owner);
      try {
        await invokeFn('db-notify', {
          type: 'wish_fulfilled',
          itemTitle: item.title,
          ownerId: owner?.id,
          buyerId: me.id,
        });
      } catch (e) {
        console.warn('[Wishlist] db-notify error:', e);
      }
    },
    onSuccess: () => {
      burstConfetti();
      invalidateBoth();
    },
    onError: (e) => {
      const message = (e as Error).message;
      toast.show(
        message.includes('invalid_reaction_')
          ? 'Не вдалося зберегти медіа реакції. Спробуй обрати файл ще раз.'
          : 'Не вдалося завершити подарунок: ' + message,
      );
    },
  });

  return {
    save,
    remove,
    setReserved,
    markPurchased,
    markPreparing,
    fulfill,
    changeScope,
  };
}
