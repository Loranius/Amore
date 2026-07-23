import { supabase } from '@/lib/supabase';
import { compress, normalize } from '@/lib/images';

const BUCKET = 'wishlist-memories';
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 12 * 60 * 60;
const ALLOWED_VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);
const ALLOWED_VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov']);

export interface GiftMemoryFiles {
  photo: File | null;
  video: File | null;
}

export interface UploadedGiftMemoryAssets {
  photoPath: string | null;
  videoPath: string | null;
  /** Лише об'єкти, реально створені поточною спробою. */
  uploadedPaths: string[];
}

function extensionFromName(name: string, fallback: string): string {
  const match = name.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return match?.[1] ?? fallback;
}

function videoExtension(file: File): 'mp4' | 'webm' | 'mov' {
  const fromName = extensionFromName(file.name, '');
  if (ALLOWED_VIDEO_EXTENSIONS.has(fromName)) return fromName as 'mp4' | 'webm' | 'mov';
  if (file.type === 'video/webm') return 'webm';
  if (file.type === 'video/quicktime') return 'mov';
  return 'mp4';
}

function videoContentType(file: File, ext: 'mp4' | 'webm' | 'mov'): string {
  if (file.type) return file.type;
  if (ext === 'webm') return 'video/webm';
  if (ext === 'mov') return 'video/quicktime';
  return 'video/mp4';
}

/**
 * Швидкий стабільний fingerprint без читання всього 50 МБ відео у пам'ять.
 * Повтор з тим самим File дає той самий path; замінений файл — інший path.
 */
export function giftMemoryAssetFingerprint(file: File): string {
  const source = [
    file.name.toLowerCase(),
    file.type.toLowerCase(),
    String(file.size),
    String(file.lastModified),
  ].join('|');

  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function isStorageObjectAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const status = Number(record.statusCode ?? record.status ?? 0);
  const message = String(record.message ?? '').toLowerCase();
  return status === 409 || message.includes('already exists') || message.includes('resource exists');
}

export function validateGiftMemoryPhoto(file: File): void {
  const isImage = file.type.startsWith('image/') || /\.(heic|heif)$/i.test(file.name);
  if (!isImage) throw new Error('Обери файл зображення.');
  if (file.size > MAX_PHOTO_BYTES) throw new Error('Фото має бути не більше 15 МБ.');
}

export function validateGiftMemoryVideo(file: File): void {
  const ext = extensionFromName(file.name, '');
  const supported = ALLOWED_VIDEO_TYPES.has(file.type) || ALLOWED_VIDEO_EXTENSIONS.has(ext);
  if (!supported) throw new Error('Підтримуються відео MP4, WebM або MOV.');
  if (file.size > MAX_VIDEO_BYTES) throw new Error('Відео має бути не більше 50 МБ.');
}

async function removePaths(paths: string[]): Promise<void> {
  if (paths.length === 0) return;
  const { error } = await supabase.storage.from(BUCKET).remove(paths);
  if (error) console.warn('[Wishlist] не вдалося прибрати незбережені memory-файли:', error);
}

async function uploadOrReuse(
  path: string,
  body: Blob,
  options: { cacheControl: string; contentType: string },
): Promise<'uploaded' | 'existing'> {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    ...options,
    upsert: false,
  });
  if (!error) return 'uploaded';
  if (isStorageObjectAlreadyExistsError(error)) return 'existing';
  throw error;
}

export async function uploadGiftMemoryAssets(input: {
  wishId: number;
  userId: number;
  idempotencyKey: string;
  files: GiftMemoryFiles;
}): Promise<UploadedGiftMemoryAssets> {
  const prefix = `${input.userId}/${input.wishId}/${input.idempotencyKey}`;
  const uploadedPaths: string[] = [];
  let photoPath: string | null = null;
  let videoPath: string | null = null;

  try {
    if (input.files.photo) {
      validateGiftMemoryPhoto(input.files.photo);
      const fingerprint = giftMemoryAssetFingerprint(input.files.photo);
      const normalized = await normalize(input.files.photo);

      let body: Blob = normalized;
      let ext = extensionFromName(normalized.name, 'jpg');
      let contentType = normalized.type || 'image/jpeg';

      try {
        const compressed = await compress(normalized, 1600, 0.82);
        body = compressed.blob;
        ext = compressed.ext;
        contentType = compressed.contentType;
      } catch (error) {
        console.warn('[Wishlist] memory-фото не стиснулося, завантажуємо нормалізований файл:', error);
      }

      photoPath = `${prefix}/photo-${fingerprint}.${ext}`;
      const result = await uploadOrReuse(photoPath, body, {
        cacheControl: '3600',
        contentType,
      });
      if (result === 'uploaded') uploadedPaths.push(photoPath);
    }

    if (input.files.video) {
      validateGiftMemoryVideo(input.files.video);
      const ext = videoExtension(input.files.video);
      const fingerprint = giftMemoryAssetFingerprint(input.files.video);
      videoPath = `${prefix}/video-${fingerprint}.${ext}`;
      const result = await uploadOrReuse(videoPath, input.files.video, {
        cacheControl: '3600',
        contentType: videoContentType(input.files.video, ext),
      });
      if (result === 'uploaded') uploadedPaths.push(videoPath);
    }

    return { photoPath, videoPath, uploadedPaths };
  } catch (error) {
    // Не видаляємо об'єкти, які існували до цієї спроби: вони можуть бути
    // частиною completion, чия успішна відповідь загубилася в мережі.
    await removePaths(uploadedPaths);
    throw error;
  }
}

export async function removeGiftMemoryAssets(paths: string[]): Promise<void> {
  await removePaths(paths);
}

export async function createGiftMemorySignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) {
    console.warn('[Wishlist] не вдалося підписати memory-файл:', error);
    return null;
  }
  return data.signedUrl;
}
