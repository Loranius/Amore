import { useQuery } from '@tanstack/react-query';
import { qk } from '@/lib/queryKeys';
import {
  fetchFulfilledWishlistV3,
  fetchSharedWishlistArchiveV3,
  type GiftMemoryArchiveItem,
  type WishlistArchiveScope,
} from './wishlistRpc';

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
