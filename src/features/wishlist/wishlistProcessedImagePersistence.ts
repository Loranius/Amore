import { publicUrl, supabase } from '@/lib/supabase';
import { setWishlistProcessedImage } from './wishlistRpc';
import {
  updateWishlistStoredVisual,
  type WishlistStoredVisual,
} from './wishlistProcessedImageRegistry';

const BUCKET = 'wishlist-photos';
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const pendingByWish = new Map<string, Promise<void>>();

function persistenceKey(wishId: number, sourceUrl: string, revision: number): string {
  return `${wishId}:${revision}:${sourceUrl}`;
}

async function dataUrlBlob(src: string): Promise<Blob> {
  const response = await fetch(src);
  if (!response.ok) throw new Error('processed_image_decode_failed');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) throw new Error('processed_image_invalid_type');
  return blob;
}

function publicStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const pathname = new URL(value).pathname;
    const index = pathname.indexOf(PUBLIC_PATH_MARKER);
    if (index < 0) return null;
    return decodeURIComponent(pathname.slice(index + PUBLIC_PATH_MARKER.length));
  } catch {
    return null;
  }
}

async function persistForWish(input: {
  wishId: number;
  sourceUrl: string;
  visual: WishlistStoredVisual;
  processingRevision: number;
  previousProcessedUrl?: string | null | undefined;
}): Promise<void> {
  const key = persistenceKey(input.wishId, input.sourceUrl, input.processingRevision);
  const current = pendingByWish.get(key);
  if (current) return current;

  const task = (async () => {
    let uploadedPath: string | null = null;
    let processedImageUrl: string | null = null;

    try {
      if (input.visual.mode !== 'photo-cover') {
        const blob = await dataUrlBlob(input.visual.src);
        const extension = blob.type.includes('png') ? 'png' : 'webp';
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

      const previousPath = publicStoragePath(input.previousProcessedUrl);
      if (previousPath && previousPath !== uploadedPath) {
        await supabase.storage.from(BUCKET).remove([previousPath]).catch(() => undefined);
      }
    } catch (error) {
      if (uploadedPath) {
        await supabase.storage.from(BUCKET).remove([uploadedPath]).catch(() => undefined);
      }
      throw error;
    }
  })().finally(() => {
    pendingByWish.delete(key);
  });

  pendingByWish.set(key, task);
  return task;
}

export async function persistWishlistProcessedVisual(input: {
  wishId?: number | undefined;
  sourceUrl: string;
  visual: WishlistStoredVisual;
  processingRevision?: number | undefined;
  previousProcessedUrl?: string | null | undefined;
}): Promise<void> {
  if (input.wishId == null) return;
  await persistForWish({
    wishId: input.wishId,
    sourceUrl: input.sourceUrl,
    visual: input.visual,
    processingRevision: input.processingRevision ?? 0,
    previousProcessedUrl: input.previousProcessedUrl,
  });
}
