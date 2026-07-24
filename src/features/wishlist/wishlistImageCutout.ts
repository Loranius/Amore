import { supabase } from '@/lib/supabase';

export type WishlistImageMode = 'cover' | 'cutout';

export interface WishlistCutoutResult {
  src: string;
  mode: WishlistImageMode;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface BackgroundEstimate {
  color: Rgb;
  threshold: number;
}

const MAX_PROCESSING_SIDE = 760;
const MIN_REMOVED_RATIO = 0.055;
const MAX_REMOVED_RATIO = 0.9;
const cutoutCache = new Map<string, Promise<WishlistCutoutResult>>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function colorDistance(r: number, g: number, b: number, color: Rgb): number {
  const redMean = (r + color.r) / 2;
  const dr = r - color.r;
  const dg = g - color.g;
  const db = b - color.b;
  return Math.sqrt(
    (2 + redMean / 256) * dr * dr
      + 4 * dg * dg
      + (2 + (255 - redMean) / 256) * db * db,
  );
}

function averageColors(colors: Rgb[]): Rgb {
  const total = colors.reduce(
    (sum, color) => ({
      r: sum.r + color.r,
      g: sum.g + color.g,
      b: sum.b + color.b,
    }),
    { r: 0, g: 0, b: 0 },
  );
  return {
    r: total.r / colors.length,
    g: total.g / colors.length,
    b: total.b / colors.length,
  };
}

function cornerAverage(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  patchWidth: number,
  patchHeight: number,
): Rgb {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(Math.min(patchWidth, patchHeight) / 12));

  for (let y = startY; y < startY + patchHeight; y += step) {
    for (let x = startX; x < startX + patchWidth; x += step) {
      const offset = (y * width + x) * 4;
      if ((pixels[offset + 3] ?? 0) < 20) continue;
      r += pixels[offset] ?? 0;
      g += pixels[offset + 1] ?? 0;
      b += pixels[offset + 2] ?? 0;
      count += 1;
    }
  }

  return count > 0 ? { r: r / count, g: g / count, b: b / count } : { r: 255, g: 255, b: 255 };
}

export function estimateUniformBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): BackgroundEstimate | null {
  if (width < 12 || height < 12) return null;

  const patchWidth = clamp(Math.round(width * 0.075), 4, 46);
  const patchHeight = clamp(Math.round(height * 0.075), 4, 46);
  const corners = [
    cornerAverage(pixels, width, height, 0, 0, patchWidth, patchHeight),
    cornerAverage(pixels, width, height, width - patchWidth, 0, patchWidth, patchHeight),
    cornerAverage(pixels, width, height, 0, height - patchHeight, patchWidth, patchHeight),
    cornerAverage(
      pixels,
      width,
      height,
      width - patchWidth,
      height - patchHeight,
      patchWidth,
      patchHeight,
    ),
  ];
  const color = averageColors(corners);
  const cornerSpread = Math.max(...corners.map((corner) =>
    colorDistance(corner.r, corner.g, corner.b, color)));
  if (cornerSpread > 54) return null;

  const stride = Math.max(1, Math.floor(Math.min(width, height) / 190));
  let borderSamples = 0;
  let closeSamples = 0;
  let squaredDistance = 0;

  const sample = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    if ((pixels[offset + 3] ?? 0) < 20) return;
    const distance = colorDistance(
      pixels[offset] ?? 0,
      pixels[offset + 1] ?? 0,
      pixels[offset + 2] ?? 0,
      color,
    );
    borderSamples += 1;
    squaredDistance += distance * distance;
    if (distance <= 58) closeSamples += 1;
  };

  for (let x = 0; x < width; x += stride) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = stride; y < height - stride; y += stride) {
    sample(0, y);
    sample(width - 1, y);
  }

  if (borderSamples === 0 || closeSamples / borderSamples < 0.68) return null;
  const deviation = Math.sqrt(squaredDistance / borderSamples);
  const luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
  const baseThreshold = luminance < 54 ? 34 : luminance > 205 ? 46 : 40;

  return {
    color,
    threshold: clamp(baseThreshold + deviation * 0.85, 30, 64),
  };
}

function smoothstep(value: number): number {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function removeConnectedBackground(
  imageData: ImageData,
  estimate: BackgroundEstimate,
): { removedRatio: number; bounds: { left: number; top: number; right: number; bottom: number } } | null {
  const { width, height, data } = imageData;
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const canRemove = (index: number): boolean => {
    const offset = index * 4;
    if ((data[offset + 3] ?? 0) < 20) return true;
    return colorDistance(
      data[offset] ?? 0,
      data[offset + 1] ?? 0,
      data[offset + 2] ?? 0,
      estimate.color,
    ) <= estimate.threshold;
  };

  const enqueue = (index: number) => {
    if (visited[index] || !canRemove(index)) return;
    visited[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  const transparentThreshold = estimate.threshold * 0.48;
  let removed = 0;

  while (head < tail) {
    const index = queue[head] ?? 0;
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    const offset = index * 4;
    const distance = colorDistance(
      data[offset] ?? 0,
      data[offset + 1] ?? 0,
      data[offset + 2] ?? 0,
      estimate.color,
    );
    const alphaFactor = distance <= transparentThreshold
      ? 0
      : smoothstep((distance - transparentThreshold) / (estimate.threshold - transparentThreshold));
    data[offset + 3] = Math.round((data[offset + 3] ?? 255) * alphaFactor);
    removed += 1;

    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }

  const removedRatio = removed / pixelCount;
  if (removedRatio < MIN_REMOVED_RATIO || removedRatio > MAX_REMOVED_RATIO) return null;

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3] ?? 0;
      if (alpha <= 20) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }

  if (right < left || bottom < top) return null;
  return { removedRatio, bounds: { left, top, right, bottom } };
}

async function decodeBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Safari may reject a format that HTMLImageElement can still decode.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function decodedDimensions(image: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return 'naturalWidth' in image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };
}

function canvasDataUrl(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.9);
  return webp.startsWith('data:image/webp') ? webp : canvas.toDataURL('image/png');
}

async function createCutout(blob: Blob): Promise<string | null> {
  const decoded = await decodeBlob(blob);
  try {
    const source = decodedDimensions(decoded);
    if (!source.width || !source.height) return null;
    const scale = Math.min(1, MAX_PROCESSING_SIDE / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded, 0, 0, width, height);

    const imageData = context.getImageData(0, 0, width, height);
    const estimate = estimateUniformBackground(imageData.data, width, height);
    if (!estimate) return null;
    const removed = removeConnectedBackground(imageData, estimate);
    if (!removed) return null;
    context.putImageData(imageData, 0, 0);

    const objectWidth = removed.bounds.right - removed.bounds.left + 1;
    const objectHeight = removed.bounds.bottom - removed.bounds.top + 1;
    const padding = Math.round(Math.max(objectWidth, objectHeight) * 0.055);
    const cropLeft = Math.max(0, removed.bounds.left - padding);
    const cropTop = Math.max(0, removed.bounds.top - padding);
    const cropRight = Math.min(width - 1, removed.bounds.right + padding);
    const cropBottom = Math.min(height - 1, removed.bounds.bottom + padding);
    const cropWidth = cropRight - cropLeft + 1;
    const cropHeight = cropBottom - cropTop + 1;

    const output = document.createElement('canvas');
    output.width = cropWidth;
    output.height = cropHeight;
    const outputContext = output.getContext('2d');
    if (!outputContext) return null;
    outputContext.imageSmoothingEnabled = true;
    outputContext.imageSmoothingQuality = 'high';
    outputContext.drawImage(
      canvas,
      cropLeft,
      cropTop,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight,
    );
    return canvasDataUrl(output);
  } finally {
    if ('close' in decoded && typeof decoded.close === 'function') decoded.close();
  }
}

function extensionForMime(type: string): string {
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('avif')) return 'avif';
  if (type.includes('gif')) return 'gif';
  return 'jpg';
}

async function fetchImageBlob(src: string): Promise<Blob> {
  if (src.startsWith('data:') || src.startsWith('blob:')) {
    const response = await fetch(src);
    if (!response.ok) throw new Error('image_fetch_failed');
    return response.blob();
  }

  try {
    const direct = await fetch(src, { credentials: 'omit', mode: 'cors' });
    if (direct.ok && direct.headers.get('content-type')?.toLowerCase().startsWith('image/')) {
      return await direct.blob();
    }
  } catch {
    // Many shop CDNs omit CORS; the authenticated Edge proxy is the fallback.
  }

  const { data, error } = await supabase.functions.invoke<Blob | ArrayBuffer>(
    'wishlist-image-proxy',
    { body: { url: src } },
  );
  if (error) throw error;
  if (data instanceof Blob) return data;
  if (data instanceof ArrayBuffer) return new Blob([data]);
  throw new Error('image_proxy_empty');
}

export function isWishlistCutoutUrl(src: string | null | undefined): boolean {
  return Boolean(src && (src.includes('wish-cutout-') || src.startsWith('data:image/')));
}

export function wishlistImageMode(src: string | null | undefined): WishlistImageMode {
  return isWishlistCutoutUrl(src) ? 'cutout' : 'cover';
}

async function processImage(src: string): Promise<WishlistCutoutResult> {
  if (isWishlistCutoutUrl(src)) return { src, mode: 'cutout' };

  try {
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
    const blob = await fetchImageBlob(src);
    if (!blob.type.toLowerCase().startsWith('image/')) return { src, mode: 'cover' };
    const cutout = await createCutout(blob);
    return cutout ? { src: cutout, mode: 'cutout' } : { src, mode: 'cover' };
  } catch (error) {
    console.info('[Wishlist] фон фото залишено без змін:', error);
    return { src, mode: 'cover' };
  }
}

export function resolveWishlistImage(src: string): Promise<WishlistCutoutResult> {
  const cached = cutoutCache.get(src);
  if (cached) return cached;
  const promise = processImage(src);
  cutoutCache.set(src, promise);
  return promise;
}

export async function remoteImageFile(src: string): Promise<File> {
  const blob = await fetchImageBlob(src);
  const ext = extensionForMime(blob.type);
  return new File([blob], `wishlist-product.${ext}`, { type: blob.type || 'image/jpeg' });
}
