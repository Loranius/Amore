// ============================================================
// REALTIME — живі оновлення від партнера через Supabase Realtime
// ------------------------------------------------------------
// Підписуємось на зміни (INSERT/UPDATE/DELETE) у таблицях даних.
// При зміні:
//   1) скидаємо відповідний ключ DataCache (щоб застаріле не показувалось);
//   2) якщо відповідна вкладка зараз ВІДКРИТА — перемальовуємо її наживо;
//      якщо ні — нічого не малюємо, наступний перехід підтягне свіже.
//
// ⚠️  ВАЖЛИВО (налаштування на боці Supabase):
//   Realtime спрацьовує лише для таблиць, доданих у публікацію
//   `supabase_realtime`. Якщо вкладка не оновлюється наживо — увімкни
//   реплікацію для таблиці (Dashboard → Database → Replication) або SQL:
//
//     alter publication supabase_realtime add table
//       events, transactions, free_limit, savings_goals, time_capsules,
//       daily_question_log, media_items, randomizer_categories, dishes,
//       wishlist_items, user_sizes, shopping_items, photo_calendar, map_pins;
//
//   RLS теж застосовується до realtime — політики мають дозволяти SELECT.
// ============================================================
const Realtime = (() => {

  let channel = null;
  const timers = {}; // дебаунс по таблиці

  // ── Придушення «луни» власних змін ───────────────────────────
  // Локальний запис позначає таблицю; якщо realtime-подія по цій таблиці
  // приходить протягом вікна — це наша ж зміна (вже відмальована локально),
  // тож зайвий рефетч пропускаємо. Партнерські зміни сюди не потрапляють.
  const SUPPRESS_MS = 2500;
  const selfWrites = {}; // table -> timestamp
  function markSelf(table) { selfWrites[table] = Date.now(); }
  function isSelfEcho(table) {
    const t = selfWrites[table];
    if (t && (Date.now() - t) < SUPPRESS_MS) { delete selfWrites[table]; return true; }
    return false;
  }

  // table -> як реагувати. keys/prefix — що інвалідувати;
  // views — на яких вкладках варто перемалювати; refresh — чим малювати.
  // onChange — кастомний обробник (має пріоритет над views/refresh).
  const MAP = {
    events: {
      keys: ['events'],
      onChange() {
        const v = Router.getCurrentView();
        if (v === 'calendar' && window.CalendarModule) CalendarModule.refresh();
        if ((v === 'home' || v === 'calendar') && window.Counter) Counter.render();
      },
    },
    transactions:          { prefix: 'tumbo:',          views: ['budget'],   refresh: () => Budget.refresh() },
    free_limit:            { keys: ['free_limit'],      views: ['budget'],   refresh: () => Budget.refresh() },
    savings_goals:         { keys: ['savings_goals'],   views: ['budget'],   refresh: () => Budget.refresh() },
    time_capsules:         { keys: ['time_capsules'],   views: ['capsule'],  refresh: () => Capsule.refresh() },
    daily_question_log:    { prefix: 'question:log:',   views: ['question'], refresh: () => DailyQuestion.refreshLive() },
    media_items:           { prefix: 'media:',          views: ['media'],    refresh: () => Media.refresh() },
    randomizer_categories: { keys: ['randcats'],        views: ['random'],   refresh: () => RandomModule.refresh() },
    dishes:                { keys: ['dishes'],           views: ['random'],   refresh: () => RandomModule.refresh() },
    wishlist_items:        { prefix: 'wishlist:',        views: ['wishlist'], refresh: () => Wishlist.refreshLive() },
    user_sizes:            { prefix: 'sizes:',           views: ['wishlist'], refresh: () => Wishlist.refreshLive() },
    shopping_items:        { keys: ['shopping:items'],   views: ['shopping'], refresh: () => Shopping.refresh() },
    photo_calendar:        { prefix: 'pcal:',            views: ['photo-calendar'], refresh: () => PhotoCalendar.refresh() },
    map_pins:              { keys: ['map_pins'],         views: ['map'],      refresh: () => MapModule.refresh() },
    user_locations:        { keys: ['user_locations'],   views: ['map'],      refresh: () => MapModule.refreshLocations() },
  };

  function invalidate(cfg) {
    (cfg.keys || []).forEach(k => DataCache.invalidate(k));
    if (cfg.prefix) DataCache.invalidatePrefix(cfg.prefix);
  }

  function handle(table) {
    const cfg = MAP[table];
    if (!cfg) return;
    // Наша ж зміна вже відмальована локально → не робимо зайвий рефетч
    if (isSelfEcho(table)) return;
    invalidate(cfg);
    try {
      if (cfg.onChange) { cfg.onChange(); return; }
      const active = cfg.views ? cfg.views.includes(Router.getCurrentView()) : true;
      if (active && cfg.refresh) cfg.refresh();
    } catch (e) {
      console.warn('[Realtime] handler error:', table, e);
    }
  }

  // Дебаунс: пакетні зміни (напр. вставка кількох товарів) → один рендер
  function schedule(table) {
    clearTimeout(timers[table]);
    timers[table] = setTimeout(() => handle(table), 150);
  }

  function start() {
    if (channel) return;
    channel = supabase.channel('amore-live');
    Object.keys(MAP).forEach(table => {
      channel.on('postgres_changes',
        { event: '*', schema: 'public', table },
        () => schedule(table));
    });
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') console.info('[Realtime] підключено ✓');
      else if (status === 'CHANNEL_ERROR') console.warn('[Realtime] помилка каналу (перевір публікацію supabase_realtime)');
    });
  }

  function stop() {
    if (channel) { supabase.removeChannel(channel); channel = null; }
  }

  function init() {
    // Стартуємо після входу (потрібна жива Supabase-сесія для RLS)
    window.addEventListener('portal:auth', start);
  }

  return { init, start, stop, markSelf };
})();

window.Realtime = Realtime;

// ============================================================
// Перехоплення локальних записів: будь-який insert/update/upsert/delete
// через supabase.from(table) позначає таблицю як «свою зміну».
// Завдяки цьому realtime не робить зайвий рефетч на власну луну.
// Читання (.select) не зачіпаються. Робиться один раз.
// ============================================================
(function patchSupabaseWrites() {
  if (!window.supabase || typeof window.supabase.from !== 'function') return;
  if (window.supabase.__amoreWritePatched) return;
  window.supabase.__amoreWritePatched = true;

  const _from = window.supabase.from.bind(window.supabase);
  window.supabase.from = function (table) {
    const qb = _from(table);
    ['insert', 'update', 'upsert', 'delete'].forEach((m) => {
      const orig = qb[m];
      if (typeof orig === 'function') {
        qb[m] = function (...args) {
          try { Realtime.markSelf(table); } catch (e) {}
          return orig.apply(qb, args);
        };
      }
    });
    return qb;
  };
})();
