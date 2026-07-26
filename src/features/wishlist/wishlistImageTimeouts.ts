// ============================================================
// wishlistImageTimeouts — жодне очікування в конвеєрі зображень
// не сміє тривати вічно.
// ------------------------------------------------------------
// ЧОМУ ЦЕ ОКРЕМИЙ МОДУЛЬ. Обробка картинок бажань іде через ОДНУ
// послідовну чергу (`WishlistImageProcessingQueue`): наступне завдання
// стартує лише після попереднього. Це правильно — паралельна сегментація
// вбила б телефон, — але має жорсткий наслідок: **одне завдання, яке
// ніколи не завершиться, назавжди зупиняє обробку всіх інших картинок**
// до перезавантаження сторінки. Саме так виглядає «зависло завантаження»:
// частина бажань лишається з вічним плейсхолдером.
//
// У конвеєрі було три місця, де очікування нічим не обмежене:
//
//  1. `fetch(src)` у `fetchImageBlob` — по чужих CDN магазинів. З'єднання,
//     яке прийняли й не відповіли, тримає проміс безкінечно;
//  2. `supabase.functions.invoke('wishlist-image-proxy')` — те саме;
//  3. `await requestAnimationFrame(...)` у `processImage`. rAF **не
//     викликається у прихованій вкладці**. Планувальник перевіряє
//     видимість ПЕРЕД постановкою в чергу, але вкладку можна згорнути
//     через мить після перевірки — і завдання застрягає назавжди;
//  4. динамічний `import()` моделі сегментації з CDN — так само без межі.
//
// Плюс кеші тримають самі ПРОМІСИ (`cutoutCache`, `portraitCache`), тож
// зависла обіцянка поверталася б кожному наступному викликачеві.
//
// Тут — мінімальні примітиви, які роблять кожне таке очікування
// скінченним. Вони не скасовують саму роботу (fetch зі скасуванням —
// окремо, через AbortSignal): вони гарантують, що ПРОМІС завершиться.
// ============================================================

/** Мережеві операції по чужих доменах. 15 с — вище за будь-яку розумну
 *  затримку CDN і нижче за поріг, на якому користувач вирішує, що зламалось. */
export const WISHLIST_IMAGE_FETCH_TIMEOUT_MS = 15_000;

/** Завантаження моделі сегментації (важче за картинку, тож більше). */
export const WISHLIST_IMAGE_MODEL_TIMEOUT_MS = 30_000;

/** Стеля на ЦІЛЕ завдання черги — остання лінія оборони. Навіть якщо в
 *  конвеєрі колись з'явиться нове необмежене очікування, черга не
 *  замре: завдання впаде, наступне піде далі. */
export const WISHLIST_IMAGE_TASK_TIMEOUT_MS = 45_000;

/** Кадр анімації є сенс чекати лише мить; далі однаково працюємо. */
export const WISHLIST_IMAGE_FRAME_TIMEOUT_MS = 250;

export class WishlistImageTimeoutError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'WishlistImageTimeoutError';
  }
}

/**
 * Обмежує проміс у часі. Сама операція продовжує виконуватись — ми лише
 * перестаємо на неї чекати; для мережі скасування дає окремий
 * `AbortSignal`. Таймер завжди знімається, інакше в Node тест висів би на
 * відкритому хендлі.
 */
export function withWishlistImageTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  code: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const guard = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new WishlistImageTimeoutError(code)), timeoutMs);
  });
  return Promise.race([operation, guard]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  }) as Promise<T>;
}

/**
 * Чекає кадр анімації, але не довше за `timeoutMs`. Пауза потрібна, щоб
 * важка обробка не почалась просто в кадрі взаємодії; вічно чекати на неї
 * не можна — у прихованій вкладці rAF мовчить.
 */
export function nextWishlistImageFrame(
  timeoutMs: number = WISHLIST_IMAGE_FRAME_TIMEOUT_MS,
): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const timer = setTimeout(done, timeoutMs);
    requestAnimationFrame(done);
  });
}

/** Сигнал скасування для мережевих викликів конвеєра. */
export function wishlistImageAbortSignal(
  timeoutMs: number = WISHLIST_IMAGE_FETCH_TIMEOUT_MS,
): AbortSignal | undefined {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(timeoutMs)
    : undefined;
}
