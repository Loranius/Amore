import type { WishlistImageDisplayMode } from './wishlistImageModes';
import type { WishlistImagePreference } from './wishlistImagePreference';

export interface WishlistProcessedImageRow {
  id: number;
  image_url: string | null;
  processed_image_url: string | null;
  image_mode: WishlistImageDisplayMode | null;
  image_preference: WishlistImagePreference;
  image_processing_revision: number;
}

export interface WishlistStoredVisual {
  src: string;
  mode: WishlistImageDisplayMode;
}

export interface WishlistRegisteredImageSettings {
  wishId: number;
  processedSrc: string | null;
  mode: WishlistImageDisplayMode | null;
  preference: WishlistImagePreference;
  revision: number;
}

interface RegisteredWishImage extends WishlistRegisteredImageSettings {
  source: string;
}

const recordsByWish = new Map<number, RegisteredWishImage>();

function normalizedSource(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

export function registerWishlistProcessedRows(rows: WishlistProcessedImageRow[]): void {
  for (const row of rows) {
    const source = normalizedSource(row.image_url);
    if (!source) {
      recordsByWish.delete(row.id);
      continue;
    }

    recordsByWish.set(row.id, {
      wishId: row.id,
      source,
      processedSrc: normalizedSource(row.processed_image_url),
      mode: row.image_mode,
      preference: row.image_preference,
      revision: Number(row.image_processing_revision ?? 0),
    });
  }
}

export function wishlistRegisteredImage(
  wishId: number | undefined,
  sourceUrl: string,
): WishlistRegisteredImageSettings | null {
  const source = sourceUrl.trim();
  if (wishId != null) {
    const exact = recordsByWish.get(wishId);
    if (!exact || exact.source !== source) return null;
    return {
      wishId: exact.wishId,
      processedSrc: exact.processedSrc,
      mode: exact.mode,
      preference: exact.preference,
      revision: exact.revision,
    };
  }

  // Older call sites only know the image URL. Resolve them safely when the URL
  // belongs to exactly one wish; ambiguous duplicate URLs never borrow settings.
  const matches = [...recordsByWish.values()].filter((record) => record.source === source);
  if (matches.length !== 1) return null;
  const [record] = matches;
  if (!record) return null;
  return {
    wishId: record.wishId,
    processedSrc: record.processedSrc,
    mode: record.mode,
    preference: record.preference,
    revision: record.revision,
  };
}

export function wishlistStoredVisual(
  wishId: number | undefined,
  sourceUrl: string,
): WishlistStoredVisual | null {
  const record = wishlistRegisteredImage(wishId, sourceUrl);
  if (!record) return null;

  if (record.processedSrc && (
    record.mode === 'product-cutout' || record.mode === 'portrait-cutout'
  )) {
    return { src: record.processedSrc, mode: record.mode };
  }

  if (record.mode === 'photo-cover') {
    return { src: sourceUrl, mode: 'photo-cover' };
  }

  return null;
}

export function updateWishlistStoredVisual(
  sourceUrl: string,
  wishId: number,
  visual: WishlistStoredVisual,
): void {
  const source = sourceUrl.trim();
  if (!source) return;

  const current = recordsByWish.get(wishId);
  recordsByWish.set(wishId, {
    wishId,
    source,
    processedSrc: visual.mode === 'photo-cover' ? null : visual.src,
    mode: visual.mode,
    preference: current?.preference ?? 'auto',
    revision: current?.revision ?? 0,
  });
}

export function clearWishlistStoredVisual(
  wishId: number,
  sourceUrl: string,
  preference?: WishlistImagePreference,
  revision?: number,
): void {
  const source = sourceUrl.trim();
  if (!source) {
    recordsByWish.delete(wishId);
    return;
  }

  const current = recordsByWish.get(wishId);
  recordsByWish.set(wishId, {
    wishId,
    source,
    processedSrc: null,
    mode: null,
    preference: preference ?? current?.preference ?? 'auto',
    revision: revision ?? current?.revision ?? 0,
  });
}
