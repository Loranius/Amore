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

/** Supabase Storage повертає 409, коли retry бачить уже створений path. */
export function isStorageObjectAlreadyExistsError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const record = error as Record<string, unknown>;
  const status = Number(record.statusCode ?? record.status ?? 0);
  const message = String(record.message ?? '').toLowerCase();
  return status === 409 || message.includes('already exists') || message.includes('resource exists');
}
