// ============================================================
// RETRY — автоматичні повторні спроби з exponential backoff
// Затримки: 1с → 3с → 9с
//
// Використання:
//   const data = await Retry.run(() => supabase.from('x').select());
//   const data = await Retry.query(() => supabase.from('x').select());  // + перевірка .error
// ============================================================
const Retry = (() => {

  const DELAYS = [1000, 3000, 9000]; // затримки між спробами

  // Перевіряємо чи помилка варта повторної спроби
  // (мережеві помилки — так; 400/403/404 — ні, це баги)
  function isRetryable(err) {
    if (!err) return false;
    const msg = String(err?.message || err).toLowerCase();
    if (msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('load failed') ||
        msg.includes('timeout') ||
        err?.status >= 500) return true;
    return false;
  }

  // Базова функція повторів
  async function run(fn, { attempts = 3, onRetry } = {}) {
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err) || i >= attempts - 1) throw err;
        const delay = DELAYS[i] ?? 9000;
        console.info(`[Retry] спроба ${i + 2}/${attempts} через ${delay / 1000}с:`, err?.message || err);
        if (onRetry) onRetry(i + 1, delay);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  // Обгортка для Supabase-запитів: перевіряє { error } у відповіді
  async function query(fn, options = {}) {
    return run(async () => {
      const result = await fn();
      if (result?.error) {
        const err = result.error;
        // Статус 5xx → retryable, решта → одразу кидаємо
        if (isRetryable(err)) throw err;
        return result; // повертаємо як є, caller сам перевірить error
      }
      return result;
    }, options);
  }

  return { run, query, isRetryable };
})();

window.Retry = Retry;
