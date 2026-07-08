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
    other:       { icon: '🗺️', label: 'Плани',           color: '#9B6EA8' },
  };

  // Категорії для вкладки "Плани"
  const PLAN_CATS = {
    date:  { icon: '💑', label: 'Побачення', color: '#FF6B9D', gradient: 'linear-gradient(135deg,#FF6B9D,#E8829C)' },
    dream: { icon: '✨', label: 'Мрії',      color: '#9B6EA8', gradient: 'linear-gradient(135deg,#9B6EA8,#C084D4)' },
    trip:  { icon: '✈️', label: 'Подорожі', color: '#5BA3D9', gradient: 'linear-gradient(135deg,#5BA3D9,#7EC8E3)' },
    goal:  { icon: '🎯', label: 'Цілі',      color: '#E8829C', gradient: 'linear-gradient(135deg,#E8829C,#F4A6BE)' },
    other: { icon: '🗺️', label: 'Інше',     color: '#B98A9A', gradient: 'linear-gradient(135deg,#B98A9A,#D4B0BC)' },
  };

  // Статуси планів
  const PLAN_STATUS = {
    planned: { label: 'Планується', icon: '⏳', cls: 'plan-status-planned' },
    active:  { label: 'В процесі',  icon: '🔥', cls: 'plan-status-active'  },
    done:    { label: 'Виконано!',  icon: '✅', cls: 'plan-status-done'    },
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
    renderEvents._lastEvents = events;
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
      { type:'other',       label:'🗺️ Плани'          },
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

    // Вкладка Плани — окремий рендер
    if(activeTypeFilter === 'other') {
      renderPlans(wrap, enriched.filter(e => (e.type||'other') === 'other'));
      return;
    }

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
    // Найближча подія вже показана в банері вище — не дублюємо її "через X" в списку
    if(upcoming.length) renderSection(wrap, null, upcoming, false, nextUp?.id);
    if(past.length)     renderSection(wrap, '✓ Минулі', past, true);
  }

  function renderSection(wrap, title, events, muted=false, hideBadgeForId=null) {
    const section = document.createElement('div');
    section.className = 'cal-section';

    if (title) {
      const hdr = document.createElement('div');
      hdr.className = 'cal-section-title' + (muted?' cal-muted':'');
      hdr.textContent = title;
      section.appendChild(hdr);
    }

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
            ${(!muted && ev.id !== hideBadgeForId) ? `<span class="cal-days-badge" style="color:${t.color}">${daysLabel(ev.days)}</span>` : ''}
          </div>
        </div>
        <button class="cal-del-btn" data-id="${ev.id}">×</button>`;
      section.appendChild(item);
    });

    wrap.appendChild(section);

    section.querySelectorAll('[data-id]').forEach(btn =>
      btn.addEventListener('click', () => deleteEvent(btn.dataset.id)));
  }

  // ── ПЛАНИ — окремий рендер ──
  let plansTab = 'active'; // 'active' | 'archive'

  function renderPlans(wrap, plans) {
    function parsePlan(ev) {
      let desc = ev.description || '';
      let cat    = 'other';
      let status = 'planned';
      let doneAt = null;
      const mCat    = desc.match(/\[cat:(\w+)\]/);
      const mStatus = desc.match(/\[status:(\w+)\]/);
      const mDoneAt = desc.match(/\[doneAt:([^\]]+)\]/);
      if (mCat)    { cat    = mCat[1];    desc = desc.replace(mCat[0], ''); }
      if (mStatus) { status = mStatus[1]; desc = desc.replace(mStatus[0], ''); }
      if (mDoneAt) { doneAt = mDoneAt[1]; desc = desc.replace(mDoneAt[0], ''); }
      return { cat, status, doneAt, note: desc.trim() };
    }

    // Розбиваємо на активні / архів
    const parsed = plans.map(ev => ({ ...ev, ...parsePlan(ev) }));
    const active  = parsed.filter(p => p.status !== 'done');
    const archive = parsed.filter(p => p.status === 'done');

    // ── Tab switcher ──
    const tabBar = document.createElement('div');
    tabBar.className = 'plans-tab-bar';
    tabBar.innerHTML = `
      <button class="plans-tab-btn${plansTab==='active'?' active':''}" data-tab="active">
        🗺️ Активні <span class="plans-tab-count">${active.length}</span>
      </button>
      <button class="plans-tab-btn${plansTab==='archive'?' active':''}" data-tab="archive">
        ✅ Архів <span class="plans-tab-count">${archive.length}</span>
      </button>`;
    wrap.appendChild(tabBar);
    tabBar.querySelectorAll('.plans-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        plansTab = btn.dataset.tab;
        if (renderEvents._lastEvents) {
          renderEvents(renderEvents._lastEvents);
        } else {
          refresh();
        }
      });
    });

    const total = plans.length;
    const doneCount = archive.length;
    const pct = total ? Math.round(doneCount / total * 100) : 0;

    // ── Прогрес-банер ──
    const statEl = document.createElement('div');
    statEl.className = 'plans-stat-banner';
    statEl.innerHTML = `
      <div class="plans-stat-row">
        <div class="plans-stat-info">
          <span class="plans-stat-num">${doneCount}</span>
          <span class="plans-stat-sep">/</span>
          <span class="plans-stat-total">${total}</span>
          <span class="plans-stat-label">планів виконано</span>
        </div>
        <div class="plans-stat-pct">${pct}%</div>
      </div>
      <div class="plans-progress-bar">
        <div class="plans-progress-fill" style="width:${pct}%"></div>
      </div>`;
    wrap.appendChild(statEl);

    // ── Архів ──
    if (plansTab === 'archive') {
      if (!archive.length) {
        const empty = document.createElement('div');
        empty.className = 'plans-empty';
        empty.innerHTML = `<div class="plans-empty-icon">📦</div>
          <p class="plans-empty-title">Архів порожній</p>
          <p class="plans-empty-sub">Виконані плани зберігатимуться тут</p>`;
        wrap.appendChild(empty);
        return;
      }
      renderPlanCards(wrap, archive, true);
      return;
    }

    // ── Активні ──
    if (!active.length) {
      const empty = document.createElement('div');
      empty.className = 'plans-empty';
      empty.innerHTML = `<div class="plans-empty-icon">🗺️</div>
        <p class="plans-empty-title">Тут живуть ваші плани</p>
        <p class="plans-empty-sub">Побачення, мрії, подорожі — додай перший!</p>`;
      wrap.appendChild(empty);
      return;
    }
    renderPlanCards(wrap, active, false);
  }

  function renderPlanCards(wrap, plans, isArchive) {
    // Групуємо по категорії
    const bycat = {};
    plans.forEach(ev => {
      if (!bycat[ev.cat]) bycat[ev.cat] = [];
      bycat[ev.cat].push(ev);
    });

    const catOrder = ['date', 'dream', 'trip', 'goal', 'other'];
    catOrder.forEach(catKey => {
      const items = bycat[catKey];
      if (!items || !items.length) return;
      const cat = PLAN_CATS[catKey] || PLAN_CATS.other;

      const section = document.createElement('div');
      section.className = 'plans-section';

      const sHdr = document.createElement('div');
      sHdr.className = 'plans-section-hdr';
      sHdr.innerHTML = `
        <span class="plans-section-icon" style="background:${cat.gradient}">${cat.icon}</span>
        <span class="plans-section-title">${cat.label}</span>
        <span class="plans-section-count">${items.length}</span>`;
      section.appendChild(sHdr);

      const grid = document.createElement('div');
      grid.className = 'plans-grid';

      items.forEach(ev => {
        const st    = PLAN_STATUS[ev.status] || PLAN_STATUS.planned;
        const orig  = new Date(ev.date);
        const dateStr = `${orig.getDate()} ${MONTHS[orig.getMonth()]} ${orig.getFullYear()} р.`;

        const card = document.createElement('div');
        card.className = 'plans-card' + (isArchive ? ' plans-card--done' : '');

        // Час виконання
        let doneInfo = '';
        if (isArchive && ev.doneAt) {
          const doneDate = new Date(ev.doneAt);
          const createdDate = new Date(ev.date);
          const diffMs  = doneDate - createdDate;
          const diffDay = Math.max(0, Math.round(diffMs / 86400000));
          doneInfo = `<span class="plans-card-done-time">✅ ${doneDate.getDate()} ${MONTHS[doneDate.getMonth()]} ${doneDate.getFullYear()} р. · ${diffDay} дн.</span>`;
        }

        card.innerHTML = `
          <div class="plans-card-top" style="background:${cat.gradient}">
            <span class="plans-card-cat-icon">${cat.icon}</span>
            <span class="plans-card-status ${st.cls}">${st.icon} ${st.label}</span>
          </div>
          <div class="plans-card-body">
            <div class="plans-card-title">${esc(ev.title)}</div>
            ${ev.note ? `<div class="plans-card-note">${esc(ev.note)}</div>` : ''}
            <div class="plans-card-footer">
              <span class="plans-card-date">📅 ${dateStr}</span>
              ${!isArchive && ev.days >= 0
                ? `<span class="plans-card-countdown" style="color:${cat.color}">${daysLabel(ev.days)}</span>`
                : doneInfo}
            </div>
          </div>
          <div class="plans-card-actions">
            ${isArchive
              ? `<button class="plans-action-btn plans-view-btn" data-id="${ev.id}" title="Переглянути">👁</button>
                 <button class="plans-action-btn plans-undo-btn" data-id="${ev.id}" title="Повернути">↩️</button>`
              : `<button class="plans-action-btn plans-done-btn plans-done-big" data-id="${ev.id}" title="Позначити виконаним">✅ Позначити виконано</button>`}
            <button class="plans-action-btn plans-del-btn" data-id="${ev.id}" title="Видалити">🗑</button>
          </div>`;

        grid.appendChild(card);
      });

      section.appendChild(grid);
      wrap.appendChild(section);
    });

    // Обробники
    wrap.querySelectorAll('.plans-done-btn').forEach(btn => {
      btn.addEventListener('click', () => markPlanDone(btn.dataset.id));
    });
    wrap.querySelectorAll('.plans-undo-btn').forEach(btn => {
      btn.addEventListener('click', () => markPlanStatus(btn.dataset.id, 'planned'));
    });
    wrap.querySelectorAll('.plans-del-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteEvent(btn.dataset.id));
    });
    wrap.querySelectorAll('.plans-view-btn').forEach(btn => {
      btn.addEventListener('click', () => openPlanArchiveModal(btn.dataset.id));
    });
  }

  async function markPlanDone(id) {
    const { data } = await supabase.from('events').select('description').eq('id', id).single();
    let desc = (data?.description || '')
      .replace(/\[status:\w+\]/, '')
      .replace(/\[doneAt:[^\]]*\]/, '');
    const now = new Date().toISOString();
    desc = `[status:done][doneAt:${now}]` + desc;
    await supabase.from('events').update({ description: desc }).eq('id', id);
    DataCache.invalidate('events');
    plansTab = 'archive'; // відразу переходимо в архів
    refresh();
  }

  async function markPlanStatus(id, newStatus) {
    const { data } = await supabase.from('events').select('description').eq('id', id).single();
    let desc = (data?.description || '')
      .replace(/\[status:\w+\]/, '')
      .replace(/\[doneAt:[^\]]*\]/, '');
    desc = `[status:${newStatus}]` + desc;
    await supabase.from('events').update({ description: desc }).eq('id', id);
    DataCache.invalidate('events');
    refresh();
  }

  function openPlanArchiveModal(id) {
    // Знаходимо план у поточних даних
    DataCache.swr('events', loadEvents, (events) => {
      const ev = events.find(e => String(e.id) === String(id));
      if (!ev) return;

      let desc = ev.description || '';
      let cat = 'other', status = 'done', doneAt = null;
      const mCat    = desc.match(/\[cat:(\w+)\]/);
      const mDoneAt = desc.match(/\[doneAt:([^\]]+)\]/);
      if (mCat)    { cat    = mCat[1];    desc = desc.replace(mCat[0], ''); }
      if (mDoneAt) { doneAt = mDoneAt[1]; desc = desc.replace(mDoneAt[0], ''); }
      desc = desc.replace(/\[status:\w+\]/, '').trim();

      const catInfo = PLAN_CATS[cat] || PLAN_CATS.other;
      const orig    = new Date(ev.date);
      const dateStr = `${orig.getDate()} ${MONTHS[orig.getMonth()]} ${orig.getFullYear()} р.`;

      let doneStr = '—', durationStr = '';
      if (doneAt) {
        const doneDate = new Date(doneAt);
        doneStr = `${doneDate.getDate()} ${MONTHS[doneDate.getMonth()]} ${doneDate.getFullYear()} р.`;
        const diffDay = Math.max(0, Math.round((doneDate - orig) / 86400000));
        if (diffDay === 0)      durationStr = 'Виконано в той самий день';
        else if (diffDay === 1) durationStr = 'Виконано за 1 день';
        else if (diffDay < 30)  durationStr = `Виконано за ${diffDay} днів`;
        else if (diffDay < 365) durationStr = `Виконано за ${Math.floor(diffDay/30)} міс.`;
        else                    durationStr = `Виконано за ${Math.floor(diffDay/365)} р. ${Math.floor((diffDay%365)/30)} міс.`;
      }

      const root = document.getElementById('modal-root');
      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay';
      overlay.innerHTML = `
        <div class="modal-card plan-archive-modal">
          <div class="plan-archive-header" style="background:${catInfo.gradient}">
            <span class="plan-archive-cat-icon">${catInfo.icon}</span>
            <div>
              <div class="plan-archive-cat-label">${catInfo.label}</div>
              <div class="plan-archive-title">${esc(ev.title)}</div>
            </div>
            <span class="plan-archive-done-badge">✅ Виконано</span>
          </div>
          <div class="plan-archive-body">
            ${desc ? `<div class="plan-archive-note">${esc(desc)}</div>` : ''}
            <div class="plan-archive-meta-row">
              <div class="plan-archive-meta-item">
                <div class="plan-archive-meta-label">📅 Дата плану</div>
                <div class="plan-archive-meta-val">${dateStr}</div>
              </div>
              <div class="plan-archive-meta-item">
                <div class="plan-archive-meta-label">🏁 Виконано</div>
                <div class="plan-archive-meta-val">${doneStr}</div>
              </div>
            </div>
            ${durationStr ? `<div class="plan-archive-duration">${durationStr}</div>` : ''}
          </div>
          <div class="modal-actions">
            <button class="btn-primary" id="plan-arch-close">Закрити</button>
          </div>
        </div>`;

      root.innerHTML = '';
      root.appendChild(overlay);
      root.querySelector('#plan-arch-close').addEventListener('click', () => root.innerHTML = '');
      overlay.addEventListener('click', e => { if (e.target === overlay) root.innerHTML = ''; });
    });
  }

  // ── МОДАЛКА ДОДАТИ ПЛАН ──
  function openAddPlanModal() {
    const root = document.getElementById('modal-root');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';

    overlay.innerHTML = `
      <div class="modal-card">
        <h3>Новий план 🗺️</h3>

        <div class="form-field">
          <label>Категорія</label>
          <div class="plans-cat-chips">
            ${Object.entries(PLAN_CATS).map(([key, c], i) =>
              `<button class="plans-cat-chip${i===0?' active':''}" data-cat="${key}" style="${i===0?`--chip-color:${c.color};background:${c.gradient};color:#fff`:''}">${c.icon} ${c.label}</button>`
            ).join('')}
          </div>
        </div>

        <div class="form-field">
          <label>Назва</label>
          <input class="fin-inp" type="text" id="plan-title" placeholder="Наприклад, поїхати на море разом">
        </div>

        <div class="form-field">
          <label>Дата / дедлайн</label>
          <input class="fin-inp" type="date" id="plan-date">
        </div>

        <div class="form-field">
          <label>Нотатка (необов'язково)</label>
          <textarea class="fin-inp" id="plan-note" rows="2" placeholder="Деталі, що хочете зробити..." style="resize:vertical"></textarea>
        </div>

        <div class="form-field">
          <label>Статус</label>
          <div class="plans-status-chips">
            <button class="plans-status-chip active" data-status="planned">⏳ Планується</button>
            <button class="plans-status-chip" data-status="active">🔥 В процесі</button>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn-secondary" id="plan-cancel">Скасувати</button>
          <button class="btn-primary" id="plan-save">Зберегти</button>
        </div>
      </div>`;

    root.innerHTML = '';
    root.appendChild(overlay);

    let selectedCat    = Object.keys(PLAN_CATS)[0];
    let selectedStatus = 'planned';

    // Cat chips
    overlay.querySelectorAll('.plans-cat-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.plans-cat-chip').forEach(c => {
          c.classList.remove('active');
          c.removeAttribute('style');
        });
        chip.classList.add('active');
        const c = PLAN_CATS[chip.dataset.cat];
        chip.style.cssText = `background:${c.gradient};color:#fff`;
        selectedCat = chip.dataset.cat;
      });
    });

    // Status chips
    overlay.querySelectorAll('.plans-status-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.plans-status-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        selectedStatus = chip.dataset.status;
      });
    });

    overlay.querySelector('#plan-cancel').addEventListener('click', () => root.innerHTML='');
    overlay.addEventListener('click', e => { if(e.target===overlay) root.innerHTML=''; });

    overlay.querySelector('#plan-save').addEventListener('click', async () => {
      const title = overlay.querySelector('#plan-title').value.trim();
      const date  = overlay.querySelector('#plan-date').value;
      const note  = overlay.querySelector('#plan-note').value.trim();
      if(!title || !date) { alert('Заповни назву та дату'); return; }

      const desc = `[cat:${selectedCat}][status:${selectedStatus}]${note}`;
      const user = Auth.getCurrentUser();

      const {error} = await supabase.from('events').insert({
        title, date,
        description: desc,
        type: 'other',
        yearly: false,
        created_by: user?.id || null,
      });
      if(error) { alert('Помилка: '+error.message); return; }
      root.innerHTML = '';
      DataCache.invalidate('events');
      refresh();
    });
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
    // Показуємо skeleton якщо кеш порожній
    if (DataCache.get('events') === undefined) {
      const wrap = document.getElementById('calendar-list');
      if (wrap) {
        wrap.innerHTML = '<div class="skeleton-grid">' +
          Array(4).fill(
            '<div class="skeleton-card">' +
              '<div class="skeleton skeleton-avatar" style="width:44px;height:44px;border-radius:50%"></div>' +
              '<div class="skeleton-body">' +
                '<div class="skeleton skeleton-line mid"></div>' +
                '<div class="skeleton skeleton-line short"></div>' +
              '</div>' +
            '</div>'
          ).join('') +
          '</div>';
      }
    }
    DataCache.swr('events', loadEvents,
      DataCache.fadeRender(document.getElementById('calendar-list'), renderEvents));
  }

  function init() {
    document.getElementById('add-event-btn')?.addEventListener('click', () => {
      if(activeTypeFilter === 'other') openAddPlanModal();
      else openAddModal();
    });
    window.addEventListener('portal:view', e => {
      if(e.detail.view==='calendar') refresh();
    });
  }

  return { init, refresh };
})();
