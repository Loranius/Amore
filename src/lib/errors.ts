// ============================================================
// ERRORS — визначення «чи варта помилка повторної спроби»
// ------------------------------------------------------------
// Порт lib/retry.js.isRetryable зі старого коду. Спільне джерело
// для queryClient (retry) і ToastProvider (текст тосту).
// Мережеві збої / 5xx → так; 4xx (баги/валідація) → ні.
// ============================================================

interface ErrorLike {
  message?: unknown;
  status?: unknown;
}

/** err може бути будь-чим (Error, {message,status}, рядок) — тому unknown. */
export function isRetryable(err: unknown): boolean {
  if (!err) return false;
  const e: ErrorLike = typeof err === 'object' && err !== null ? (err as ErrorLike) : {};
  const msg = String(e.message ?? err).toLowerCase();
  const status = typeof e.status === 'number' ? e.status : undefined;
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('timeout') ||
    (status !== undefined && status >= 500)
  );
}
