import type { WishlistImageDisplayMode } from './wishlistImageModes';

export interface WishlistProcessedImageRow {
  id: number;
  image_url: string | null;
  processed_image_url: string | null;
  image_mode: WishlistImageDisplayMode | null;
}

export interface WishlistStoredVisual {
  src: string;
  mode: WishlistImageDisplayMode;
}

interface RegisteredWishImage {
  wishId: number;
  processedSrc: string | null;
  mode: WishlistImageDisplayMode | null;
}

const recordsBySource = new Map<string, Map<number, RegisteredWishImage>>();

function normalizedSource(value: string | null | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

export function registerWishlistProcessedRows(rows: WishlistProcessedImageRow[]): void {
  for (const row of rows) {
    const source = normalizedSource(row.image_url);
    if (!source) continue;

    const records = recordsBySource.get(source) ?? new Map<number, RegisteredWishImage>();
    records.set(row.id, {
      wishId: row.id,
      processedSrc: normalizedSource(row.processed_image_url),
      mode: row.image_mode,
    });
    recordsBySource.set(source, records);
  }
}

export function wishlistStoredVisual(sourceUrl: string): WishlistStoredVisual | null {
  const records = recordsBySource.get(sourceUrl.trim());
  if (!records) return null;

  // A transparent persisted visual is more informative than a fallback marker.
  for (const record of records.values()) {
    if (record.processedSrc && (
      record.mode === 'product-cutout' || record.mode === 'portrait-cutout'
    )) {
      return { src: record.processedSrc, mode: record.mode };
    }
  }

  for (const record of records.values()) {
    if (record.mode === 'photo-cover') {
      return { src: sourceUrl, mode: 'photo-cover' };
    }
  }

  return null;
}

export function wishlistIdsForImageSource(sourceUrl: string): number[] {
  return [...(recordsBySource.get(sourceUrl.trim())?.keys() ?? [])];
}

export function updateWishlistStoredVisual(
  sourceUrl: string,
  wishId: number,
  visual: WishlistStoredVisual,
): void {
  const source = sourceUrl.trim();
  if (!source) return;

  const records = recordsBySource.get(source) ?? new Map<number, RegisteredWishImage>();
  records.set(wishId, {
    wishId,
    processedSrc: visual.mode === 'photo-cover' ? null : visual.src,
    mode: visual.mode,
  });
  recordsBySource.set(source, records);
}
