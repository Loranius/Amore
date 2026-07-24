import { remoteImageFile } from './wishlistImageCutout';
import type { WishlistImageDisplayMode } from './wishlistImageModes';

const MEDIAPIPE_VERSION = '0.10.31';
const TASKS_VISION_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}`;
const WASM_URL = `${TASKS_VISION_URL}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
const MAX_SIDE = 760;
const MIN_FOREGROUND_RATIO = 0.06;
const MAX_FOREGROUND_RATIO = 0.92;
const MIN_STRONG_FOREGROUND_RATIO = 0.018;

export interface WishlistPortraitResult {
  src: string;
  mode: WishlistImageDisplayMode;
}

interface MediaPipeMask {
  width: number;
  height: number;
  getAsFloat32Array: () => Float32Array;
  close?: () => void;
}

interface ImageSegmenterResult {
  confidenceMasks?: MediaPipeMask[];
}

interface ImageSegmenter {
  segment: (image: ImageBitmap | HTMLImageElement) => ImageSegmenterResult;
}

interface TasksVisionModule {
  FilesetResolver: {
    forVisionTasks: (wasmRoot: string) => Promise<unknown>;
  };
  ImageSegmenter: {
    createFromOptions: (
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate?: 'CPU' | 'GPU' };
        runningMode: 'IMAGE';
        outputConfidenceMasks: boolean;
        outputCategoryMask: boolean;
      },
    ) => Promise<ImageSegmenter>;
  };
}

let segmenterPromise: Promise<ImageSegmenter> | null = null;
const portraitCache = new Map<string, Promise<WishlistPortraitResult>>();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

async function importTasksVision(): Promise<TasksVisionModule> {
  return import(/* @vite-ignore */ `${TASKS_VISION_URL}/+esm`) as Promise<TasksVisionModule>;
}

async function getSegmenter(): Promise<ImageSegmenter> {
  if (segmenterPromise) return segmenterPromise;

  segmenterPromise = (async () => {
    const vision = await importTasksVision();
    const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
    return vision.ImageSegmenter.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'IMAGE',
      outputConfidenceMasks: true,
      outputCategoryMask: false,
    });
  })().catch((error) => {
    segmenterPromise = null;
    throw error;
  });

  return segmenterPromise;
}

async function decodeBlob(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Safari may still decode the image through HTMLImageElement.
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

function dimensions(image: ImageBitmap | HTMLImageElement): { width: number; height: number } {
  return 'naturalWidth' in image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };
}

function chooseForegroundMask(masks: MediaPipeMask[]): MediaPipeMask | null {
  if (masks.length === 0) return null;
  // Selfie Segmenter exposes one person-confidence mask. For models that expose
  // background + foreground channels, the final channel is the foreground.
  return masks[masks.length - 1] ?? null;
}

export function portraitMaskLooksUsable(values: Float32Array): boolean {
  if (values.length === 0) return false;

  let foreground = 0;
  let strongForeground = 0;
  for (const value of values) {
    if (value >= 0.34) foreground += 1;
    if (value >= 0.72) strongForeground += 1;
  }

  const foregroundRatio = foreground / values.length;
  const strongRatio = strongForeground / values.length;
  return foregroundRatio >= MIN_FOREGROUND_RATIO
    && foregroundRatio <= MAX_FOREGROUND_RATIO
    && strongRatio >= MIN_STRONG_FOREGROUND_RATIO;
}

function buildPortraitCutout(
  image: ImageBitmap | HTMLImageElement,
  mask: MediaPipeMask,
): string | null {
  const source = dimensions(image);
  if (!source.width || !source.height) return null;

  const scale = Math.min(1, MAX_SIDE / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const maskValues = mask.getAsFloat32Array();
  if (!portraitMaskLooksUsable(maskValues)) return null;

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) return null;
  sourceContext.imageSmoothingEnabled = true;
  sourceContext.imageSmoothingQuality = 'high';
  sourceContext.drawImage(image, 0, 0, width, height);
  const imageData = sourceContext.getImageData(0, 0, width, height);

  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  const maskWidth = Math.max(1, mask.width);
  const maskHeight = Math.max(1, mask.height);

  for (let y = 0; y < height; y += 1) {
    const maskY = Math.min(maskHeight - 1, Math.floor((y / height) * maskHeight));
    for (let x = 0; x < width; x += 1) {
      const maskX = Math.min(maskWidth - 1, Math.floor((x / width) * maskWidth));
      const confidence = maskValues[maskY * maskWidth + maskX] ?? 0;
      const alpha = smoothstep(0.18, 0.72, confidence);
      const offset = (y * width + x) * 4;
      imageData.data[offset + 3] = Math.round((imageData.data[offset + 3] ?? 255) * alpha);
      if (alpha > 0.08) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) return null;
  sourceContext.putImageData(imageData, 0, 0);

  const objectWidth = right - left + 1;
  const objectHeight = bottom - top + 1;
  const padding = Math.round(Math.max(objectWidth, objectHeight) * 0.045);
  const cropLeft = Math.max(0, left - padding);
  const cropTop = Math.max(0, top - padding);
  const cropRight = Math.min(width - 1, right + padding);
  const cropBottom = Math.min(height - 1, bottom + padding);
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
    sourceCanvas,
    cropLeft,
    cropTop,
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight,
  );

  const webp = output.toDataURL('image/webp', 0.92);
  return webp.startsWith('data:image/webp') ? webp : output.toDataURL('image/png');
}

async function segmentPortrait(src: string): Promise<WishlistPortraitResult> {
  let decoded: ImageBitmap | HTMLImageElement | null = null;
  let masks: MediaPipeMask[] = [];

  try {
    const file = await remoteImageFile(src);
    decoded = await decodeBlob(file);
    const segmenter = await getSegmenter();
    const result = segmenter.segment(decoded);
    masks = result.confidenceMasks ?? [];
    const foregroundMask = chooseForegroundMask(masks);
    if (!foregroundMask) return { src, mode: 'photo-cover' };

    const cutout = buildPortraitCutout(decoded, foregroundMask);
    return cutout
      ? { src: cutout, mode: 'portrait-cutout' }
      : { src, mode: 'photo-cover' };
  } catch (error) {
    console.info('[Wishlist] portrait segmentation skipped:', error);
    return { src, mode: 'photo-cover' };
  } finally {
    for (const mask of masks) mask.close?.();
    if (decoded && 'close' in decoded && typeof decoded.close === 'function') decoded.close();
  }
}

export function resolveWishlistPortrait(src: string): Promise<WishlistPortraitResult> {
  const cached = portraitCache.get(src);
  if (cached) return cached;
  const promise = segmentPortrait(src);
  portraitCache.set(src, promise);
  return promise;
}
