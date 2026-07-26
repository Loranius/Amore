import { publicUrl, supabase } from '@/lib/supabase';
import { completeWishlistImageProcessing } from './wishlistRpc';
import {
  updateWishlistStoredVisual,
  type WishlistStoredVisual,
} from './wishlistProcessedImageRegistry';
import type { WishlistImagePreference } from './wishlistImagePreference';

const BUCKET = 'wishlist-photos';
const PUBLIC_PATH_MARKER = `/storage/v1/object/public/${BUCKET}/`;
const pendingBySession = new Map<string, Promise<void>>();

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

async function persistForSession(input: {
  wishId: number;
  sourceUrl: string;
  preference: WishlistImagePreference;
  visual: WishlistStoredVisual;
  processingRevision: number;
  processorVersion: number;
  sessionId: string;
}): Promise<void> {
  const current = pendingBySession.get(input.sessionId);
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
        if (error) throw new Error(`storage_upload_failed:${error.message}`);
        processedImageUrl = publicUrl(BUCKET, uploadedPath);
      }

      const previousProcessedUrl = await completeWishlistImageProcessing({
        wishId: input.wishId,
        sourceImageUrl: input.sourceUrl,
        imagePreference: input.preference,
        processingRevision: input.processingRevision,
        processorVersion: input.processorVersion,
        sessionId: input.sessionId,
        processedImageUrl,
        imageMode: input.visual.mode,
      });

      updateWishlistStoredVisual(
        input.sourceUrl,
        input.wishId,
        {
          src: processedImageUrl ?? input.sourceUrl,
          mode: input.visual.mode,
        },
        input.processorVersion,
      );

      const previousPath = publicStoragePath(previousProcessedUrl);
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
    pendingBySession.delete(input.sessionId);
  });

  pendingBySession.set(input.sessionId, task);
  return task;
}

export async function persistWishlistProcessedVisual(input: {
  wishId: number;
  sourceUrl: string;
  preference: WishlistImagePreference;
  visual: WishlistStoredVisual;
  processingRevision: number;
  processorVersion: number;
  sessionId: string;
}): Promise<void> {
  await persistForSession(input);
}
