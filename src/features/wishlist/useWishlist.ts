// ============================================================
// useWishlist — дані вкладки «Бажання»
// ------------------------------------------------------------
// Wishlist v3 читає дані лише через role-safe RPC: власник не отримує
// reserved_by та не бачить стадію preparing_surprise. Усі доменні зміни
// виконуються серверними RPC із перевіркою ролі й стану.
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
  fetchWishlistStatsV3,
  fetchWishlistV3,
  moveWishlistItem,
  reserveWishlistItem,
  softDeleteWishlistItem,
  updateWishlistItem,
} from './wishlistRpc';
import type { WishlistItemRow, FulfilledWishlistItem, UserName } from '@/types';

const BUCKET = 'wishlist-photos';

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
    queryFn: async (): Promise<WishlistItemRow[]> =>
      fetchWishlistV3({ ownerId, shared: false }),
  });
}

/** Спільні бажання («Спільне») — видимі обом, незалежно від owner. */
export function useSharedWishlistItems() {
  return useQuery({
    queryKey: qk.wishlistShared(),
    queryFn: async (): Promise<WishlistItemRow[]> =>
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
    queryFn: async (): Promise<FulfilledWishlistItem[]> => {
      const rows = await fetchWishlistV3({
        ownerId,
        shared: false,
        includeArchived: true,
      });

      return rows
        .filter((row) => row.fulfilled)
        .sort((a, b) => (b.fulfilled_at ?? '').localeCompare(a.fulfilled_at ?? ''))
        .map((row) => ({
          id: row.id,
          title: row.title,
          description: row.description,
          link: row.link,
          image_url: row.image_url,
          price: row.price,
          priority: row.priority,
          fulfilled_at: row.fulfilled_at,
          fulfilled_by: row.fulfilled_by,
        }));
    },
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

export function useWishlistMutations(ownerId: number | null) {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();
  const { data: users } = useUsers();
  const key = ownerId !== null ? qk.wishlist(ownerId) : qk.wishlistShared();

  const snapshot = () => client.getQueryData<WishlistItemRow[]>(key);
  const rollback = (prev: WishlistItemRow[] | undefined) => {
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
      client.setQueryData<WishlistItemRow[]>(key, (old) =>
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

  // Поточний UI має одну кнопку «Вже купив(ла)», тому адаптер виконує
  // reserved → preparing_surprise → archived послідовно на сервері.
  const fulfill = useMutation({
    mutationFn: async (item: WishlistItemRow) => {
      await completeWishlistGift(item.id);

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
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  return { save, remove, setReserved, fulfill, changeScope };
}
