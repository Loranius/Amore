// ============================================================
// RETRY — автоматичні повторні спроби з exponential backoff
// Затримки: 1с → 3с → 9с
//
// Використання:
//   const data = await Retry.run(() => supabase.from('x').select());
//   const data = await Retry.query(() => supabase.from('x').select());  // + перевірка .error
//
// Типізація: JSDoc + types.d.ts (див. jsconfig.json). Рантайму не торкається.
// ============================================================
const Retry = (() => {

  const DELAYS = [1000, 3000, 9000]; // затримки між спробами

  /** @typedef {{ message?: unknown, status?: unknown }} ErrorLike */

  // Перевіряємо чи помилка варта повторної спроби
  // (мережеві помилки — так; 400/403/404 — ні, це баги).
  // err типізований як unknown (може прилетіти що завгодно — Error,
  // Supabase-подібний {message,status}, рядок), тому пряме err.message/
  // err.status без звуження типу тут неприпустиме — кастуємо через
  // ErrorLike (усі поля опціональні, тож підходить під що завгодно).
  /**
   * @param {unknown} err
   * @returns {boolean}
   */
  function isRetryable(err) {
    if (!err) return false;
    const e = /** @type {ErrorLike} */ (typeof err === 'object' && err !== null ? err : {});
    const msg = String(e.message ?? err).toLowerCase();
    const status = typeof e.status === 'number' ? e.status : undefined;
    if (msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('network request failed') ||
        msg.includes('load failed') ||
        msg.includes('timeout') ||
        (status !== undefined && status >= 500)) return true;
    return false;
  }

  // Базова функція повторів.
  /**
   * @template T
   * @param {() => Promise<T>} fn
   * @param {{ attempts?: number, onRetry?: (attempt: number, delay: number) => void }} [options]
   * @returns {Promise<T>}
   */
  async function run(fn, { attempts = 3, onRetry } = {}) {
    /** @type {unknown} */
    let lastErr;
    for (let i = 0; i < attempts; i++) {
      try {
        return await fn();
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err) || i >= attempts - 1) throw err;
        const delay = DELAYS[i] ?? 9000;
        const e = /** @type {ErrorLike} */ (typeof err === 'object' && err !== null ? err : {});
        console.info(`[Retry] спроба ${i + 2}/${attempts} через ${delay / 1000}с:`, e.message ?? err);
        if (onRetry) onRetry(i + 1, delay);
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw lastErr;
  }

  // Обгортка для Supabase-запитів: перевіряє { error } у відповіді.
  // T звужений до "форми з опціональним error" — саме так виглядають усі
  // відповіді supabase.from(...).select/insert/update/delete(...), для
  // яких і призначена ця обгортка (на відміну від run(), який приймає
  // геть будь-яку функцію).
  /**
   * @template {{ error?: unknown }} T
   * @param {() => Promise<T>} fn
   * @param {{ attempts?: number, onRetry?: (attempt: number, delay: number) => void }} [options]
   * @returns {Promise<T>}
   */
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

// window.X = X — стандартний спосіб публікувати глобаль у цьому проєкті
// (немає модулів). TS не знає про Retry на Window без module-augmentation,
// тому вузький, разовий каст тут — той самий "немає білду" виняток,
// що й для DataCache/Confetti.
/** @type {any} */ (window).Retry = Retry;
