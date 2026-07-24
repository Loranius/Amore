import { publicUrl, supabase } from '@/lib/supabase';
import { setWishlistProcessedImage } from './wishlistRpc';
import {
  updateWishlistStoredVisual,
  wishlistIdsForImageSource,
  type WishlistStoredVisual,
} from './wishlistProcessedImageRegistry';
import type { WishlistImageDisplayMode } from './wishlistImageModes';

const BUCKET = 'wishlist-photos';
const pendingByWish = new Map<string, Promise<void>>();

function persistenceKey(wishId: number, sourceUrl: string): string {
  return `${wishId}:${sourceUrl}`;
}

async function dataUrlBlob(src: string): Promise<Blob> {
  const response = await fetch(src);
  if (!response.ok) throw new Error('processed_image_decode_failed');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('processed_image_invalid_type');
  return blob;
}

async function persistForWish(input: {
  wishId: number;
  sourceUrl: string;
  visual: WishlistStoredVisual;
}): Promise<void> {
  const key = persistenceKey(input.wishId, input.sourceUrl);
  const current = pendingByWish.get(key);
  if (current) return current;

  const task = (async () => {
    let uploadedPath: string | null = null;
    let processedImageUrl: string | null = null;

    try {
      if (input.visual.mode !== 'photo-cover') {
        const blob = await dataUrlBlob(input.visual.src);
        const extension = blob.type.includes('png') ? 'png' : 'webp';
        // Current bucket policies are shared by authenticated users. A random
        // object name prevents another session from guessing and overwriting a
        // processed asset by wish id alone.
        uploadedPath = `processed/${input.wishId}/visual-${crypto.randomUUID()}.${extension}`;
        const { error } = await supabase.storage.from(BUCKET).upload(uploadedPath, blob, {
          upsert: false,
          contentType: blob.type,
          cacheControl: '31536000',
        });
        if (error) throw error;
        processedImageUrl = publicUrl(BUCKET, uploadedPath);
      }

      await setWishlistProcessedImage({
        wishId: input.wishId,
        sourceImageUrl: input.sourceUrl,
        processedImageUrl,
        imageMode: input.visual.mode,
      });

      updateWishlistStoredVisual(input.sourceUrl, input.wishId, {
        src: processedImageUrl ?? input.sourceUrl,
        mode: input.visual.mode,
      });
    } catch (error) {
      // A stale source means the upload is no longer referenced. Best-effort
      // cleanup keeps retries safe without turning a visual cache failure into
      // a user-facing Wishlist error.
      if (uploadedPath) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]).catch(() => undefined);
      }
      throw error;
    }
  })().catch((error) => {
    pendingByWish.delete(key);
    throw error;
  });

  pendingByWish.set(key, task);
  return task;
}

export async function persistWishlistProcessedVisual(
  sourceUrl: string,
  visual: { src: string; mode: WishlistImageDisplayMode },
): Promise<void> {
  const wishIds = wishlistIdsForImageSource(sourceUrl);
  if (wishIds.length === 0) return;

  await Promise.allSettled(
    wishIds.map((wishId) => persistForWish({ wishId, sourceUrl, visual })),
  );
}
