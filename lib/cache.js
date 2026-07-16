// ============================================================
// DATA CACHE — stale-while-revalidate шар над Supabase
// ------------------------------------------------------------
// Мета: перехід між вкладками має бути МИТТЄВИМ.
//   • swr(key, fetcher, onData):
//       1) якщо в кеші вже є дані — одразу малюємо їх (onData(data, true));
//       2) у фоні робимо запит; якщо результат ЗМІНИВСЯ — перемальовуємо.
//   • Одночасні запити одного ключа дедуплікуються (один мережевий виклик).
//   • invalidate(key) — викидаємо ключ із кешу (після мутацій), щоб
//       наступний refresh підтягнув свіже без показу застарілого.
//
// Кеш живе лише в пам'яті вкладки (скидається при перезавантаженні).
//
// Типізація: кеш зберігає РІЗНІ типи даних під різними ключами (map_pins,
// wishlist:123, users, ...), тому store/inflight типізовані як
// Map<string, unknown> — конкретний тип T підставляється per-call через
// generic-параметр кожної функції. Викликач у .js не може передати
// явний type argument (немає синтаксису на кшталт get<Foo>(key) у
// рантайм-JS), тому TS виводить T як unknown, якщо не закастувати
// результат на місці виклику — це очікувано й типобезпечно (краще явний
// каст, ніж мовчазний any).
// ============================================================
import { Retry } from './retry.js';

/** @type {Map<string, unknown>} */
const store    = new Map(); // key -> data
/** @type {Map<string, Promise<unknown>>} */
const inflight = new Map(); // key -> Promise (запит у польоті)

/**
 * @template T
 * @param {string} key
 * @returns {T | undefined}
 */
function get(key) {
  return store.has(key) ? /** @type {T} */ (store.get(key)) : undefined;
}

/**
 * @template T
 * @param {string} key
 * @param {T} data
 * @returns {void}
 */
function set(key, data) { store.set(key, data); }

/**
 * @param {string} [key] без ключа очищає весь кеш повністю.
 * @returns {void}
 */
function invalidate(key) {
  if (key === undefined || key === null) { store.clear(); inflight.clear(); return; }
  store.delete(key);
  inflight.delete(key);
}

/**
 * Викидає всі ключі, що починаються з префікса (напр. усі 'media:*').
 * @param {string} prefix
 * @returns {void}
 */
function invalidatePrefix(prefix) {
  [...store.keys()].forEach(k => { if (k.startsWith(prefix)) store.delete(k); });
  [...inflight.keys()].forEach(k => { if (k.startsWith(prefix)) inflight.delete(k); });
}

/**
 * Внутрішнє: один мережевий запит на ключ (дедуплікація + retry).
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @returns {Promise<T>}
 */
function _fetch(key, fetcher) {
  if (inflight.has(key)) return /** @type {Promise<T>} */ (inflight.get(key));
  const p = Promise.resolve()
    .then(() => {
      // Використовуємо retry якщо він підключений
      const fn = typeof Retry !== 'undefined'
        ? () => Retry.run(fetcher)
        : fetcher;
      return fn();
    })
    .then(res => { store.set(key, res); inflight.delete(key); return res; })
    .catch(err => { inflight.delete(key); throw err; });
  inflight.set(key, p);
  return p;
}

/**
 * Stale-while-revalidate.
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @param {(data: T | null, fromCache: boolean) => void} [onData]
 * @returns {Promise<T | null>}
 */
async function swr(key, fetcher, onData) {
  const cached = /** @type {T | undefined} */ (get(key));
  const cb = typeof onData === 'function' ? onData : null;

  if (cached !== undefined && cb) cb(cached, true); // миттєво з кешу

  try {
    const fresh = await _fetch(key, fetcher);
    const changed = cached === undefined ||
      JSON.stringify(cached) !== JSON.stringify(fresh);
    if (changed && cb) cb(fresh, false);
    return fresh;
  } catch (err) {
    console.warn('[DataCache] fetch failed:', key, err);
    if (cached === undefined && cb) cb(null, false);
    return cached !== undefined ? cached : null;
  }
}

/**
 * Повернути кешоване або один раз завантажити (без рендер-колбека).
 * Зручно для майже-статичних довідників (напр. список користувачів).
 * @template T
 * @param {string} key
 * @param {() => Promise<T>} fetcher
 * @returns {Promise<T>}
 */
async function ensure(key, fetcher) {
  const cached = /** @type {T | undefined} */ (get(key));
  if (cached !== undefined) return cached;
  return _fetch(key, fetcher);
}

/**
 * Обгорнути рендер-функцію так, щоб після вставки fresh-даних
 * контейнер отримував клас 'content-loaded' (fade-in анімація).
 * Використання: DataCache.swr(key, fetcher, DataCache.fadeRender(el, renderFn))
 * @template T
 * @param {HTMLElement | null} containerEl
 * @param {(data: T | null) => void} renderFn
 * @returns {(data: T | null, fromCache: boolean) => void}
 */
function fadeRender(containerEl, renderFn) {
  return (data, fromCache) => {
    renderFn(data);
    if (!fromCache && containerEl) {
      containerEl.classList.remove('content-loaded');
      // Форсуємо reflow щоб анімація перестартувала
      void containerEl.offsetWidth;
      containerEl.classList.add('content-loaded');
    }
  };
}

export const DataCache = { get, set, invalidate, invalidatePrefix, swr, ensure, fadeRender };
