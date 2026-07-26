import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const SESSION_KEY = 'amore:wishlist-storage-cleanup:v1';
const START_DELAY_MS = 4_000;

type CleanupResponse = {
  ok: boolean;
  status?: 'skipped' | 'completed' | 'dry_run';
  reason?: string;
  memoriesDeleted?: number;
  photosDeleted?: number;
  bytesDeleted?: number;
};

/**
 * Opportunistic cleanup: one quiet request per authenticated browser session.
 * The server is the real authority and allows an actual cleanup at most once
 * per 12 hours, so multiple devices or users cannot race or over-trigger it.
 */
export function useWishlistStorageCleanup(): void {
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;
    sessionStorage.setItem(SESSION_KEY, 'scheduled');

    const timer = window.setTimeout(() => {
      void supabase.functions
        .invoke<CleanupResponse>('wishlist-storage-cleanup', { body: {} })
        .then(({ data, error }) => {
          if (error) throw error;
          sessionStorage.setItem(SESSION_KEY, data?.status ?? 'completed');

          if (
            import.meta.env.DEV
            && data?.status === 'completed'
            && ((data.memoriesDeleted ?? 0) > 0 || (data.photosDeleted ?? 0) > 0)
          ) {
            console.info('[Wishlist] storage cleanup:', data);
          }
        })
        .catch((error: unknown) => {
          sessionStorage.removeItem(SESSION_KEY);
          console.warn('[Wishlist] storage cleanup deferred:', error);
        });
    }, START_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, []);
}
