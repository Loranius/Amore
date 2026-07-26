import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import {
  fetchFulfilledWishlistV3,
  fetchSharedWishlistArchiveV3,
  type GiftMemoryArchiveItem,
  type WishlistArchiveScope,
} from './wishlistRpc';
import {
  createManualArchiveGift,
  type ManualArchiveGiftPayload,
} from './wishlistArchiveMutations';

const ARCHIVE_SIGNED_URL_REFRESH_MS = 5 * 60 * 60 * 1000;
const ARCHIVE_STALE_TIME_MS = 4 * 60 * 60 * 1000;

export function useWishlistArchive(
  scope: WishlistArchiveScope,
  ownerId: number | null,
  enabled: boolean,
) {
  const isShared = scope === 'shared';

  return useQuery({
    queryKey: isShared
      ? qk.wishlistSharedFulfilled()
      : qk.wishlistFulfilled(ownerId ?? -1),
    enabled: enabled && (isShared || ownerId !== null),
    queryFn: async (): Promise<GiftMemoryArchiveItem[]> =>
      isShared
        ? fetchSharedWishlistArchiveV3()
        : fetchFulfilledWishlistV3(ownerId!),
    staleTime: ARCHIVE_STALE_TIME_MS,
    refetchInterval: enabled ? ARCHIVE_SIGNED_URL_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useCreateManualArchiveGift() {
  const client = useQueryClient();
  const toast = useToast();

  return useMutation({
    mutationFn: (payload: ManualArchiveGiftPayload) => createManualArchiveGift(payload),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['wishlist'] });
      toast.show('Подарунок додано до архіву.');
    },
    onError: (error) => {
      const message = (error as Error).message;
      toast.show(
        message.includes('gifted_date_in_future')
          ? 'Дата подарунка не може бути в майбутньому.'
          : message.includes('partner_not_found')
            ? 'Не вдалося визначити партнера.'
            : message.includes('invalid_price')
              ? 'Вкажи коректну ціну або залиш поле порожнім.'
              : 'Не вдалося додати подарунок до архіву. Спробуй ще.',
      );
    },
  });
}
