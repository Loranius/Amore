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
// ============================================================
const DataCache = (() => {
  const store    = new Map(); // key -> data
  const inflight = new Map(); // key -> Promise (запит у польоті)

  function get(key)  { return store.has(key) ? store.get(key) : undefined; }
  function set(key, data) { store.set(key, data); }
  function has(key)  { return store.has(key); }

  function invalidate(key) {
    if (key === undefined || key === null) { store.clear(); inflight.clear(); return; }
    store.delete(key);
    inflight.delete(key);
  }

  // Викидає всі ключі, що починаються з префікса (напр. усі 'media:*')
  function invalidatePrefix(prefix) {
    [...store.keys()].forEach(k => { if (k.startsWith(prefix)) store.delete(k); });
    [...inflight.keys()].forEach(k => { if (k.startsWith(prefix)) inflight.delete(k); });
  }

  // Внутрішнє: один мережевий запит на ключ (дедуплікація)
  function _fetch(key, fetcher) {
    if (inflight.has(key)) return inflight.get(key);
    const p = Promise.resolve()
      .then(fetcher)
      .then(res => { store.set(key, res); inflight.delete(key); return res; })
      .catch(err => { inflight.delete(key); throw err; });
    inflight.set(key, p);
    return p;
  }

  // Stale-while-revalidate
  async function swr(key, fetcher, onData) {
    const cached = get(key);
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

  // Повернути кешоване або один раз завантажити (без рендер-колбека).
  // Зручно для майже-статичних довідників (напр. список користувачів).
  async function ensure(key, fetcher) {
    const cached = get(key);
    if (cached !== undefined) return cached;
    return _fetch(key, fetcher);
  }

  return { get, set, has, invalidate, invalidatePrefix, swr, ensure };
})();

window.DataCache = DataCache;
