// ============================================================
// useWishlist — дані вкладки «Бажання» (порт wishlist.js)
// ------------------------------------------------------------
// Активні бажання, архів виконаних, партнер, завантаження фото у
// Storage і мутації (додати/редагувати/видалити/бронь/виконати).
// Оптимістика — там, де стара версія малювала «напряму» (бронь,
// видалення), решта — invalidate. db-notify і конфеті на fulfill.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, invokeFn, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { compress, normalize } from '@/lib/images';
import { burstConfetti } from '@/lib/confetti';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsers, usePartner } from '@/features/_shared/useUsers';
import type {
  WishlistItemRow,
  FulfilledWishlistItem,
  InsertRow,
  UserName,
} from '@/types';

const BUCKET = 'wishlist-photos';

// Присвійна форма імені партнера («Бажання Діми / Лєни»).
const GENITIVE: Record<UserName, string> = { Діма: 'Діми', Лєна: 'Лєни' };
export function partnerGenitive(name: string | undefined): string {
  return name && name in GENITIVE ? GENITIVE[name as UserName] : (name ?? 'Партнера');
}

export { usePartner };

// ── Запити ───────────────────────────────────────────────────
const ACTIVE_COLS =
  'id,title,description,link,image_url,gift_date,owner,is_shared,reserved,reserved_by,price,priority,fulfilled,fulfilled_by,fulfilled_at';

export function useWishlistItems(ownerId: number | null) {
  return useQuery({
    queryKey: qk.wishlist(ownerId ?? -1),
    enabled: ownerId !== null,
    queryFn: async (): Promise<WishlistItemRow[]> => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select(ACTIVE_COLS)
        .eq('owner', ownerId!)
        .eq('is_shared', false)
        .or('fulfilled.is.null,fulfilled.eq.false')
        .order('id', { ascending: false })
        .returns<WishlistItemRow[]>();
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Спільні бажання («Спільне») — видимі обом, незалежно від owner. */
export function useSharedWishlistItems() {
  return useQuery({
    queryKey: qk.wishlistShared(),
    queryFn: async (): Promise<WishlistItemRow[]> => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select(ACTIVE_COLS)
        .eq('is_shared', true)
        .or('fulfilled.is.null,fulfilled.eq.false')
        .order('id', { ascending: false })
        .returns<WishlistItemRow[]>();
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Прогрес пари: скільки бажань (усіх, обох) виконано загалом і цього року. */
export function useCoupleWishStats() {
  return useQuery({
    queryKey: qk.wishlistStats(),
    queryFn: async (): Promise<{ total: number; done: number; doneThisYear: number }> => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('fulfilled,fulfilled_at')
        .returns<{ fulfilled: boolean; fulfilled_at: string | null }[]>();
      if (error) throw error;
      const rows = data ?? [];
      const thisYear = new Date().getFullYear();
      const done = rows.filter((r) => r.fulfilled).length;
      const doneThisYear = rows.filter(
        (r) => r.fulfilled && r.fulfilled_at && new Date(r.fulfilled_at).getFullYear() === thisYear,
      ).length;
      return { total: rows.length, done, doneThisYear };
    },
  });
}

export function useFulfilledWishes(ownerId: number | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.wishlistFulfilled(ownerId ?? -1),
    enabled: enabled && ownerId !== null,
    queryFn: async (): Promise<FulfilledWishlistItem[]> => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('id,title,description,link,image_url,price,priority,fulfilled_at,fulfilled_by')
        .eq('owner', ownerId!)
        .eq('fulfilled', true)
        .order('fulfilled_at', { ascending: false })
        .returns<FulfilledWishlistItem[]>();
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Завантаження фото (HEIC-normalize + compress → Storage) ──
export async function uploadWishPhoto(file: File, userId: number): Promise<string> {
  const normalized = await normalize(file); // HEIC → JPEG (може кинути)

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

  // ДОДАТИ / РЕДАГУВАТИ (фото вантажиться в компоненті до виклику).
  // owner/isShared — лише для створення (вибір «Моє/Для партнера/Спільне»);
  // на редагуванні ігноруються, власність не міняється.
  const save = useMutation({
    mutationFn: async (input: {
      id: number | null;
      payload: WishFormPayload;
      owner?: number;
      isShared?: boolean;
    }) => {
      if (input.id !== null) {
        const { error } = await supabase
          .from('wishlist_items')
          .update(input.payload)
          .eq('id', input.id);
        if (error) throw error;
      } else {
        const row: InsertRow<'wishlist_items'> = {
          ...input.payload,
          owner: input.owner ?? me.id,
          is_shared: input.isShared ?? false,
          reserved: false,
          reserved_by: null,
          fulfilled: false,
        };
        const { error } = await supabase.from('wishlist_items').insert(row);
        if (error) throw error;
      }
    },
    onSuccess: invalidateBoth,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  // ВИДАЛИТИ — оптимістично.
  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('wishlist_items').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: key });
      const prev = snapshot();
      client.setQueryData<WishlistItemRow[]>(key, (old) =>
        (old ?? []).filter((i) => i.id !== id),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      rollback(ctx?.prev);
      toast.show('Не вдалось видалити бажання. Спробуй ще.');
    },
    onSettled: invalidateBoth,
  });

  // БРОНЬ / СКАСУВАННЯ БРОНІ — оптимістично.
  const setReserved = useMutation({
    mutationFn: async (v: { id: number; reserved: boolean }) => {
      const { error } = await supabase
        .from('wishlist_items')
        .update({ reserved: v.reserved, reserved_by: v.reserved ? me.id : null })
        .eq('id', v.id);
      if (error) throw error;
    },
    onMutate: async (v) => {
      await client.cancelQueries({ queryKey: key });
      const prev = snapshot();
      client.setQueryData<WishlistItemRow[]>(key, (old) =>
        (old ?? []).map((i) =>
          i.id === v.id
            ? { ...i, reserved: v.reserved, reserved_by: v.reserved ? me.id : null }
            : i,
        ),
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      rollback(ctx?.prev);
      toast.show('Не вдалось оновити бажання. Спробуй ще.');
    },
    onSettled: invalidateBoth,
  });

  // ВИКОНАТИ БАЖАННЯ (+ db-notify + конфеті).
  const fulfill = useMutation({
    mutationFn: async (item: WishlistItemRow) => {
      const { error } = await supabase
        .from('wishlist_items')
        .update({
          fulfilled: true,
          fulfilled_by: me.id,
          fulfilled_at: new Date().toISOString(),
          reserved: true,
          reserved_by: me.id,
        })
        .eq('id', item.id);
      if (error) throw error;

      // Сповіщення в Telegram — не блокує успіх (текст будує Edge Function).
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

  return { save, remove, setReserved, fulfill };
}
