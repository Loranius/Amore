// ============================================================
// CALENDAR MODULE v2
// ============================================================
const CalendarModule = (() => {

  const MONTHS = ['січня','лютого','березня','квітня','травня','червня',
                  'липня','серпня','вересня','жовтня','листопада','грудня'];

  const TYPES = {
    birthday:    { icon: '🎂', label: 'День народження', color: '#FF6B9D' },
    anniversary: { icon: '💕', label: 'Річниця',         color: '#E8829C' },
    holiday:     { icon: '🎉', label: 'Свято',           color: '#F4A6BE' },
    other:       { icon: '📅', label: 'Плани',            color: '#B98A9A' },
  };

  const esc = s => { const d=document.createElement('div'); d.textContent=s||''; return d.innerHTML; };

  // ── ДАНІ ──
  async function loadEvents() {
    const {data} = await supabase.from('events')
      .select('id,title,description,date,created_by,type,yearly')
      .order('date', {ascending:true});
    return data||[];
  }

  // ── ЛОГІКА ДАТ ──
  function nextOccurrence(ev) {
    const now   = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const orig  = new Date(ev.date);

    if(!ev.yearly) {
      // Одноразова подія
      const d = new Date(orig.getFullYear(), orig.getMonth(), orig.getDate());
      return { date: d, passed: d < today };
    }

    // Щорічна — знаходимо наступне
    let next = new Date(today.getFullYear(), orig.getMonth(), orig.getDate());
    if(next < today) next = new Date(today.getFullYear()+1, orig.getMonth(), orig.getDate());
    return { date: next, passed: false };
  }

  function daysUntil(dateObj) {
    const today = new Date();
    today.setHours(0,0,0,0);
    const diff = dateObj - today;
    return Math.round(diff / 86400000);
  }

  function daysLabel(n) {
    if(n === 0) return '🎊 Сьогодні!';
    if(n === 1) return 'завтра';
    if(n < 0)   return `${Math.abs(n)} дн. тому`;
    if(n < 7)   return `через ${n} дн.`;
    if(n < 30)  return `через ${Math.floor(n/7)} тиж.`;
    if(n < 365) return `через ${Math.floor(n/30)} міс.`;
    return `через ${Math.floor(n/365)} р.`;
  }

  let activeTypeFilter = 'anniversary'; // дефолт — Наші свята

  // ── РЕНДЕР ──
  function renderEvents(events) {
    const wrap = document.getElementById('calendar-list');
    if(!wrap) return;

    if(!events.length) {
      wrap.innerHTML = '<p class="empty-state">Подій ще немає. Додай першу!</p>';
      return;
    }

    // Enriched
    const enriched = events.map(ev => {
      const {date: nextDate, passed} = nextOccurrence(ev);
      const days = daysUntil(nextDate);
      return {...ev, nextDate, days, passed};
    }).sort((a,b) => {
      if(a.passed && !b.passed) return 1;
      if(!a.passed && b.passed) return -1;
      return a.days - b.days;
    });

    wrap.innerHTML = '';

    // Кнопки фільтру по типу
    const TAB_DEFS = [
      { type:'anniversary', label:'💕 Наші свята'     },
      { type:'birthday',    label:'🎂 Дні народження' },
      { type:'holiday',     label:'🎉 Свята'          },
      { type:'other',       label:'📅 Інше'           },
    ];

    const tabBar = document.createElement('div');
    tabBar.className = 'cal-type-filter-bar';
    TAB_DEFS.forEach(def => {
      const count = enriched.filter(e => (e.type||'other') === def.type).length;
      const btn = document.createElement('button');
      btn.className = 'cal-type-filter-btn' + (activeTypeFilter===def.type?' active':'');
      btn.dataset.type = def.type;
      btn.innerHTML = `${def.label}<span class="cal-type-count">${count}</span>`;
      btn.addEventListener('click', () => {
        activeTypeFilter = def.type;
        renderEvents(events);
      });
      tabBar.appendChild(btn);
    });
    wrap.appendChild(tabBar);

    // Фільтруємо по типу
    const filtered = enriched.filter(e => (e.type||'other') === activeTypeFilter);

    if(!filtered.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'У цій категорії поки нічого немає.';
      wrap.appendChild(empty);
      return;
    }

    // Банер найближчої події
    const nextUp = filtered.find(e => !e.passed);
    if(nextUp) {
      const t = TYPES[nextUp.type]||TYPES.other;
      const banner = document.createElement('div');
      banner.className = 'cal-next-banner';
      banner.style.borderColor = t.color;
      banner.innerHTML = `
        <div class="cal-next-icon">${t.icon}</div>
        <div class="cal-next-info">
          <div class="cal-next-label">Найближча</div>
          <div class="cal-next-title">${esc(nextUp.title)}</div>
          <div class="cal-next-when" style="color:${t.color}">${daysLabel(nextUp.days)}</div>
        </div>`;
      wrap.appendChild(banner);
    }

    // Список
    const upcoming = filtered.filter(e => !e.passed);
    const past     = filtered.filter(e =>  e.passed);
    if(upcoming.length) renderSection(wrap, null, upcoming);
    if(past.length)     renderSection(wrap, '✓ Минулі', past, true);
  }

  function renderSection(wrap, title, events, muted=false) {
    const section = document.createElement('div');
    section.className = 'cal-section';

    const hdr = document.createElement('div');
    hdr.className = 'cal-section-title' + (muted?' cal-muted':'');
    hdr.textContent = title;
    section.appendChild(hdr);

    events.forEach(ev => {
      const t   = TYPES[ev.type]||TYPES.other;
      const orig = new Date(ev.date);
      const dateStr = `${orig.getDate()} ${MONTHS[orig.getMonth()]} ${orig.getFullYear()} р.`;

      const item = document.createElement('div');
      item.className = 'cal-event-item' + (muted?' cal-muted':'');
      item.innerHTML = `
        <div class="cal-event-type-bar" style="background:${t.color}"></div>
        <div class="cal-event-icon">${t.icon}</div>
        <div class="cal-event-info">
          <div class="cal-event-title">${esc(ev.title)}</div>
          ${ev.description ? `<div class="cal-event-desc">${esc(ev.description)}</div>` : ''}
          <div class="cal-event-meta">
            <span>${dateStr}</span>
            ${ev.yearly ? '<span class="cal-yearly-badge">↻ щороку</span>' : ''}
            ${!muted ? `<span class="cal-days-badge" style="color:${t.color}">${daysLabel(ev.days)}</span>` : ''}
          </div>
        </div>
        <button class="cal-del-btn" data-id="${ev.id}">×</button>`;
      section.appendChild(item);
    });

    wrap.appendChild(section);

    section.querySelectorAll('[data-id]').forEach(btn =>
      btn.addEventListener('click', () => deleteEvent(btn.dataset.id)));
  }

  async function deleteEvent(id) {
    if(!confirm('Видалити подію?')) return;
    await supabase.from('events').delete().eq('id', id);
    DataCache.invalidate('events');
    refresh();
  }

  // ── МОДАЛКА ──
  function openAddModal() {
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Нова подія</h3>
        <div class="form-field">
          <label>Тип</label>
          <div class="cal-type-chips">
            <button class="cal-type-chip active" data-type="birthday">🎂 День народження</button>
            <button class="cal-type-chip" data-type="anniversary">💕 Річниця</button>
            <button class="cal-type-chip" data-type="holiday">🎉 Свято</button>
            <button class="cal-type-chip" data-type="other">📅 Інше</button>
          </div>
        </div>
        <div class="form-field">
          <label>Назва</label>
          <input class="fin-inp" type="text" id="ev-title" placeholder="Наприклад, день народження мами">
        </div>
        <div class="form-field">
          <label>Дата</label>
          <input class="fin-inp" type="date" id="ev-date">
        </div>
        <div class="form-field">
          <label>Опис (необов'язково)</label>
          <textarea class="fin-inp" id="ev-desc" rows="2" placeholder="Деталі..." style="resize:vertical"></textarea>
        </div>
        <label class="cal-yearly-toggle">
          <input type="checkbox" id="ev-yearly" checked>
          <span>Повторюється щороку</span>
        </label>
        <div class="modal-actions">
          <button class="btn-secondary" id="ev-cancel">Скасувати</button>
          <button class="btn-primary" id="ev-save">Зберегти</button>
        </div>
      </div>`;

    root.innerHTML = '';
    root.appendChild(overlay);

    // Type chips
    let selectedType = 'birthday';
    overlay.querySelectorAll('.cal-type-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.cal-type-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedType = chip.dataset.type;
      });
    });

    overlay.querySelector('#ev-cancel').addEventListener('click', () => root.innerHTML='');
    overlay.addEventListener('click', e => { if(e.target===overlay) root.innerHTML=''; });

    overlay.querySelector('#ev-save').addEventListener('click', async () => {
      const title  = overlay.querySelector('#ev-title').value.trim();
      const date   = overlay.querySelector('#ev-date').value;
      const desc   = overlay.querySelector('#ev-desc').value.trim();
      const yearly = overlay.querySelector('#ev-yearly').checked;
      if(!title||!date){ alert('Заповни назву та дату'); return; }

      const user = Auth.getCurrentUser();
      const {error} = await supabase.from('events').insert({
        title, date,
        description: desc||null,
        type:        selectedType,
        yearly,
        created_by:  user?.id||null,
      });
      if(error){ alert('Помилка: '+error.message); return; }
      root.innerHTML = '';
      DataCache.invalidate('events');
      refresh();
    });
  }

  function refresh() {
    // Миттєво з кешу, потім фонова ревалідація
    DataCache.swr('events', loadEvents, renderEvents);
  }

  function init() {
    document.getElementById('add-event-btn')?.addEventListener('click', openAddModal);
    window.addEventListener('portal:view', e => {
      if(e.detail.view==='calendar') refresh();
    });
  }

  return { init, refresh };
})();
