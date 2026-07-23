const AMBIGUOUS_NETWORK_MARKERS = [
  'failed to fetch',
  'fetch failed',
  'networkerror',
  'network error',
  'load failed',
  'timeout',
  'timed out',
  'connection reset',
  'connection closed',
  'aborted',
  'aborterror',
];

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (typeof error === 'string') return error.toLowerCase();
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message).toLowerCase();
  }
  return '';
}

/**
 * Після підтвердженої серверної відмови транзакція не закомічена, тому
 * щойно завантажене фото можна прибрати одразу. Після transport failure
 * результат невідомий: відповідь могла загубитися вже після commit.
 */
export function canRemoveWishPhotoAfterSaveError(error: unknown): boolean {
  const message = errorMessage(error);
  if (!message) return false;
  return !AMBIGUOUS_NETWORK_MARKERS.some((marker) => message.includes(marker));
}
