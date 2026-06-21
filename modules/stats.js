// ============================================================
// STATS MODULE — лічильники на головній сторінці
// Показує: фото цього місяця / виконані бажання / фільми
// Дані завантажуються з кешем — не блокують рендер
// ============================================================
const Stats = (() => {

  async function fetchStats() {
    const now      = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthFrom = monthStr + '-01';
    const monthTo   = monthStr + '-31';

    const [photos, wishes, media] = await Promise.all([
      // Фото цього місяця у фото-календарі
      supabase.from('photo_calendar')
        .select('id', { count: 'exact', head: true })
        .gte('date', monthFrom)
        .lte('date', monthTo),

      // Виконані бажання (всього)
      supabase.from('wishlist_items')
        .select('id', { count: 'exact', head: true })
        .eq('fulfilled', true),

      // Медіа зі статусом 'done'
      supabase.from('media_items')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'done'),
    ]);

    return {
      photos:  photos.count  ?? 0,
      wishes:  wishes.count  ?? 0,
      media:   media.count   ?? 0,
    };
  }

  function paint(stats) {
    const wrap = document.getElementById('home-stats');
    if (!wrap) return;
    wrap.innerHTML = `
      <div class="home-stat-card">
        <span class="home-stat-emoji">📸</span>
        <span class="home-stat-num">${stats.photos}</span>
        <span class="home-stat-label">фото цього місяця</span>
      </div>
      <div class="home-stat-card">
        <span class="home-stat-emoji">🎁</span>
        <span class="home-stat-num">${stats.wishes}</span>
        <span class="home-stat-label">бажань виконано</span>
      </div>
      <div class="home-stat-card">
        <span class="home-stat-emoji">🎬</span>
        <span class="home-stat-num">${stats.media}</span>
        <span class="home-stat-label">переглянуто</span>
      </div>`;
  }

  function refresh() {
    DataCache.swr('home:stats', fetchStats, paint);
  }

  function init() {
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'home') refresh();
    });
    window.addEventListener('portal:auth', refresh);
  }

  return { init, refresh };
})();

window.Stats = Stats;
