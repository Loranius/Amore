// ============================================================
// WHERE TO MODULE (вкладка «Куди піти»)
// Claude з web search (Edge Function events-finder) шукає
// 3 актуальні події/місця у місті пари. Місто+область
// зберігаються в settings (key: whereto_location).
// Квитки: спроба відкрити у вбудованому вікні (iframe) з
// fallback «Відкрити у браузері» — квиткові сайти часто
// забороняють embed.
// ============================================================

const WhereTo = (() => {

  const el = id => document.getElementById(id);
  const SETTING_KEY = 'whereto_location';

  // Повна Україна (кордони до 2014): 24 області + АР Крим + міста
  const OBLASTS = [
    'Вінницька', 'Волинська', 'Дніпропетровська', 'Донецька', 'Житомирська',
    'Закарпатська', 'Запорізька', 'Івано-Франківська', 'Київська', 'Кіровоградська',
    'Луганська', 'Львівська', 'Миколаївська', 'Одеська', 'Полтавська',
    'Рівненська', 'Сумська', 'Тернопільська', 'Харківська', 'Херсонська',
    'Хмельницька', 'Черкаська', 'Чернівецька', 'Чернігівська',
    'АР Крим', 'м. Київ', 'м. Севастополь',
  ];

  let location = null;   // {region, city}
  let lastResults = [];  // останні знайдені події
  let avoid = [];        // назви вже показаних (для «ще варіанти»)

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  // ── Локація: load/save у settings ──────────────────────────
  async function loadLocation() {
    const { data } = await supabase
      .from('settings').select('value').eq('key', SETTING_KEY).maybeSingle();
    if (data && data.value) {
      try { location = JSON.parse(data.value); } catch (e) { location = null; }
    }
    renderCityChip();
  }

  async function saveLocation(region, city) {
    location = { region, city };
    const { error } = await supabase
      .from('settings')
      .upsert({ key: SETTING_KEY, value: JSON.stringify(location) }, { onConflict: 'key' });
    if (error) {
      ErrorBoundary.showToast('Не вдалось зберегти місто');
      return false;
    }
    renderCityChip();
    return true;
  }

  function renderCityChip() {
    const chip = el('wt-city-btn');
    if (!chip) return;
    chip.textContent = location
      ? `📍 ${location.city} · змінити`
      : '📍 Обрати місто';
  }

  // ── Модалка вибору міста ────────────────────────────────────
  function openCityModal() {
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Де ви зараз?</h3>
        <div class="form-field">
          <label>Область</label>
          <select class="fin-inp" id="wt-region">
            ${OBLASTS.map(o => `<option value="${o}"${location && location.region === o ? ' selected' : ''}>${o}</option>`).join('')}
          </select>
        </div>
        <div class="form-field">
          <label>Місто</label>
          <input class="fin-inp" id="wt-city" placeholder="Наприклад: Дніпро" value="${esc(location ? location.city : '')}">
        </div>
        <div class="modal-actions">
          <button class="btn-secondary" id="wt-city-cancel">Скасувати</button>
          <button class="btn-primary" id="wt-city-save">Зберегти</button>
        </div>
      </div>`;
    root.innerHTML = ''; root.appendChild(overlay);

    overlay.querySelector('#wt-city-cancel').addEventListener('click', () => root.innerHTML = '');
    overlay.addEventListener('click', e => { if (e.target === overlay) root.innerHTML = ''; });
    overlay.querySelector('#wt-city-save').addEventListener('click', async () => {
      const region = overlay.querySelector('#wt-region').value;
      const city = overlay.querySelector('#wt-city').value.trim();
      if (!city) { ErrorBoundary.showToast('Вкажи місто'); return; }
      if (await saveLocation(region, city)) root.innerHTML = '';
    });
  }

  // ── Пошук подій ────────────────────────────────────────────
  async function search(more = false) {
    if (!location) { openCityModal(); return; }

    const btn = el('wt-search-btn');
    const box = el('wt-results');
    btn.disabled = true;
    btn.textContent = '🔎 Шукаю…';
    if (!more) {
      avoid = [];
      box.innerHTML = `
        <div class="cul-loading">
          <div class="cul-loading-emoji">🗺️</div>
          <p class="cul-loading-text">Клод моніторить ${esc(location.city)}…</p>
          <p class="cul-step-hint">Шукаю події і цікаві місця на найближчі дні</p>
        </div>`;
    }

    try {
      const { data, error } = await supabase.functions.invoke('events-finder', {
        body: { city: location.city, region: location.region, avoid },
      });
      if (error) throw error;
      if (!data || !Array.isArray(data.events) || !data.events.length) {
        throw new Error(data && data.error ? data.error : 'порожня відповідь');
      }

      lastResults = data.events;
      data.events.forEach(ev => avoid.push(ev.title));
      renderResults(box);
    } catch (e) {
      console.error('events-finder:', e);
      let detail = '';
      try {
        if (e && e.context && typeof e.context.json === 'function') {
          const j = await e.context.json();
          if (j && j.error) detail = String(j.error);
        } else if (e && e.message) detail = e.message;
      } catch (_) { /* ignore */ }
      box.innerHTML = `
        <div class="cul-loading">
          <div class="cul-loading-emoji">😕</div>
          <p class="cul-loading-text">Не вдалось знайти події</p>
          <p class="cul-step-hint">${detail ? esc(detail) : 'Спробуй ще раз за хвилину'}</p>
        </div>`;
    } finally {
      btn.disabled = false;
      btn.textContent = '🔎 Пошук подій';
    }
  }

  function kindBadge(kind) {
    return kind === 'місце'
      ? '<span class="wt-badge wt-badge--place">🌳 місце</span>'
      : '<span class="wt-badge wt-badge--event">🎫 подія</span>';
  }

  function renderResults(box) {
    box.innerHTML = lastResults.map((ev, i) => `
      <div class="card wt-card">
        <div class="wt-card-head">
          ${kindBadge(ev.kind)}
          ${ev.price ? `<span class="wt-price">${esc(ev.price)}</span>` : ''}
        </div>
        <p class="wt-title">${esc(ev.title)}</p>
        <p class="wt-meta">${esc([ev.when, ev.place].filter(Boolean).join(' · '))}</p>
        <p class="wt-desc">${esc(ev.description || '')}</p>
        ${ev.url ? `<button class="btn-primary wt-open-btn" data-idx="${i}">✨ Прийняти й відкрити</button>` : ''}
      </div>`).join('') + `
      <button class="btn-secondary wt-more-btn" id="wt-more-btn">🔄 Ще варіанти</button>`;

    box.querySelectorAll('.wt-open-btn').forEach(b => {
      b.addEventListener('click', () => openEmbed(lastResults[b.dataset.idx]));
    });
    el('wt-more-btn').addEventListener('click', () => search(true));
  }

  // ── Вбудований перегляд сайту (з fallback у браузер) ───────
  function openEmbed(ev) {
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay wt-embed-overlay';
    overlay.innerHTML = `
      <div class="wt-embed">
        <div class="wt-embed-bar">
          <span class="wt-embed-title">${esc(ev.title)}</span>
          <a class="wt-embed-ext" href="${esc(ev.url)}" target="_blank" rel="noopener">У браузері ↗</a>
          <button class="wt-embed-close" id="wt-embed-close">✕</button>
        </div>
        <p class="wt-embed-hint">Якщо нижче порожньо — сайт заборонив вбудовування, тисни «У браузері»</p>
        <iframe class="wt-embed-frame" src="${esc(ev.url)}" referrerpolicy="no-referrer"></iframe>
      </div>`;
    root.innerHTML = ''; root.appendChild(overlay);
    overlay.querySelector('#wt-embed-close').addEventListener('click', () => root.innerHTML = '');
  }

  // ── Init ────────────────────────────────────────────────────
  function init() {
    el('wt-search-btn')?.addEventListener('click', () => search(false));
    el('wt-city-btn')?.addEventListener('click', openCityModal);

    window.addEventListener('portal:auth', loadLocation);
    window.addEventListener('portal:view', (e) => {
      if (e.detail && e.detail.view === 'whereto' && !location) {
        // перший вхід — одразу пропонуємо обрати місто
        setTimeout(openCityModal, 300);
      }
    });
  }

  return { init };
})();
