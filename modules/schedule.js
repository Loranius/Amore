// ============================================================
// SCHEDULE MODULE ("Графік") v1
// Робочі графіки обох користувачів: позначки Р (робочий) і
// Х (вихідний) на кожен день місяця. Спільний перегляд для
// Діми і Лєни, зберігається одразу в Supabase при кожній зміні.
// Таблиця: public.work_schedule (date, user_id, mark)
// ------------------------------------------------------------
// SQL для Supabase (вже виконано, лишаю для довідки):
//
//   create table public.work_schedule (
//     id bigint generated always as identity primary key,
//     date date not null,
//     user_id integer not null references public.users(id) on delete cascade,
//     mark text not null check (mark in ('Р','Х')),
//     updated_at timestamptz not null default now(),
//     unique (date, user_id)
//   );
//   alter table public.work_schedule enable row level security;
//   create policy "sched_select" on public.work_schedule for select using (true);
//   create policy "sched_insert" on public.work_schedule for insert with check (true);
//   create policy "sched_update" on public.work_schedule for update using (true);
//   create policy "sched_delete" on public.work_schedule for delete using (true);
//   alter publication supabase_realtime add table work_schedule;
// ============================================================
const Schedule = (() => {

  // ── УТИЛІТИ ─────────────────────────────────────────────────
  const el  = id => document.getElementById(id);
  const esc = s  => { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; };
  const pad = n  => String(n).padStart(2, '0');
  const dstr = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
  const todayStr = () => new Date().toISOString().slice(0, 10);

  const MONTHS_UA = [
    'Січень','Лютий','Березень','Квітень','Травень','Червень',
    'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'
  ];
  const DAYS_UA = ['ПН','ВТ','СР','ЧТ','ПТ','СБ','НД'];

  // Цикл позначки при кожному тапі: пусто → Р → Х → пусто
  const CYCLE = { '': 'Р', 'Р': 'Х', 'Х': '' };

  // ── СТАН ────────────────────────────────────────────────────
  let yr = 0, mo = 0;      // поточні рік і місяць
  let users = [];          // [{id, name}] — обидва користувачі, стабільний порядок
  let marks = {};          // { user_id: { 'YYYY-MM-DD': 'Р'|'Х' } }
  let editMode = false;    // false = лише перегляд (захист від випадкових тапів при свайпі)
  const saving = new Set();// ключі "userId:date" що зараз зберігаються (анти-даблклік)

  function monthKey() { return 'sched:' + yr + '-' + pad(mo); }

  // ── ДАНІ ────────────────────────────────────────────────────
  async function fetchUsers() {
    if (users.length) return users;
    users = await Auth.getUsers();
    return users;
  }

  async function fetchMonthRows() {
    const lastDay = new Date(yr, mo, 0).getDate();
    const from = dstr(yr, mo, 1);
    const to   = dstr(yr, mo, lastDay);
    const { data, error } = await supabase
      .from('work_schedule')
      .select('date,user_id,mark')
      .gte('date', from).lte('date', to);
    if (error) { console.error('schedule load error:', error); return []; }
    return data || [];
  }

  function buildMonthMap(rows) {
    marks = {};
    (rows || []).forEach(r => {
      if (!marks[r.user_id]) marks[r.user_id] = {};
      marks[r.user_id][r.date] = r.mark;
    });
  }

  // Миттєво з кешу місяця, потім ревалідація; рендер у колбеку.
  function loadMonth() {
    return DataCache.swr(monthKey(), fetchMonthRows, (rows) => {
      buildMonthMap(rows || []);
      renderAll();
    });
  }

  // ── РЕНДЕР ──────────────────────────────────────────────────
  function ensureBoards() {
    const wrap = el('sched-boards');
    if (!wrap) return;
    // Перебудовуємо DOM карток лише якщо склад юзерів реально змінився
    const wantIds = users.map(u => String(u.id)).join(',');
    if (wrap.dataset.builtFor === wantIds) return;
    wrap.dataset.builtFor = wantIds;
    wrap.innerHTML = users.map(u => `
      <div class="card sched-board" data-user-id="${esc(u.id)}">
        <h3 class="sched-board-title">${esc(u.name)}</h3>
        <div class="sched-grid" id="sched-grid-${esc(u.id)}"></div>
      </div>
    `).join('');
  }

  function renderAll() {
    ensureBoards();
    const daysInMonth = new Date(yr, mo, 0).getDate();
    const commonOff = computeCommonOff(daysInMonth);
    users.forEach(u => renderGrid(u.id, commonOff));
    const lbl = el('sched-month-label');
    if (lbl) lbl.textContent = `${MONTHS_UA[mo - 1]} ${yr}`;
  }

  // Дати, коли в ОБОХ користувачів стоїть "Х" — спільний вихідний
  function computeCommonOff(daysInMonth) {
    const set = new Set();
    if (users.length < 2) return set;
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dstr(yr, mo, d);
      const allOff = users.every(u => (marks[u.id] || {})[ds] === 'Х');
      if (allOff) set.add(ds);
    }
    return set;
  }

  function renderGrid(userId, commonOff) {
    const grid = el('sched-grid-' + userId);
    if (!grid) return;
    const today = todayStr();
    const daysInMonth = new Date(yr, mo, 0).getDate();

    // getDay() 0=Нд → робимо понеділок першим (ПН=0..НД=6)
    let firstDow = new Date(yr, mo - 1, 1).getDay();
    firstDow = firstDow === 0 ? 6 : firstDow - 1;

    grid.innerHTML = '';

    DAYS_UA.forEach(d => {
      const h = document.createElement('div');
      h.className = 'pcal-dow';
      h.textContent = d;
      grid.appendChild(h);
    });

    for (let i = 0; i < firstDow; i++) {
      const e = document.createElement('div');
      e.className = 'sched-cell sched-cell--empty';
      grid.appendChild(e);
    }

    const userMarks = marks[userId] || {};
    for (let d = 1; d <= daysInMonth; d++) {
      const ds     = dstr(yr, mo, d);
      const mark   = userMarks[ds] || '';
      const isToday = ds === today;
      const isCommon = !!(commonOff && commonOff.has(ds));

      const cell = document.createElement('button');
      cell.className = 'sched-cell'
        + (isToday  ? ' sched-cell--today'      : '')
        + (isCommon ? ' sched-cell--common-off' : '');
      cell.dataset.date = ds;
      cell.dataset.user = userId;
      cell.innerHTML = `
        <span class="sched-cell-num">${d}${isCommon ? '<span class="sched-cell-heart">♥</span>' : ''}</span>
        <span class="sched-cell-letter${mark === 'Р' ? ' sched-cell-letter--work' : ''}${mark === 'Х' ? ' sched-cell-letter--off' : ''}">${mark}</span>
      `;
      cell.addEventListener('click', () => onCellClick(userId, ds, mark));
      grid.appendChild(cell);
    }
  }

  // ── ЗМІНА ПОЗНАЧКИ (миттєве збереження) ──────────────────────
  async function onCellClick(userId, ds, currentMark) {
    if (!editMode) return; // захист від випадкових тапів (напр. під час свайпу між вкладками)

    const lockKey = userId + ':' + ds;
    if (saving.has(lockKey)) return;
    saving.add(lockKey);

    const next = CYCLE[currentMark] ?? 'Р';

    // Оптимістичний рендер одразу, без очікування відповіді сервера.
    // Перемальовуємо ОБИДВІ картки — позначка спільного вихідного залежить від обох.
    if (!marks[userId]) marks[userId] = {};
    if (next) marks[userId][ds] = next; else delete marks[userId][ds];
    renderAll();

    try {
      if (!next) {
        const { error } = await supabase.from('work_schedule')
          .delete().eq('date', ds).eq('user_id', userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('work_schedule')
          .upsert(
            { date: ds, user_id: userId, mark: next, updated_at: new Date().toISOString() },
            { onConflict: 'date,user_id' }
          );
        if (error) throw error;
      }
      DataCache.invalidate(monthKey());
    } catch (e) {
      console.error('schedule save error:', e);
      // Відкат UI при помилці збереження
      if (currentMark) marks[userId][ds] = currentMark; else delete (marks[userId] || {})[ds];
      renderAll();
      alert('Не вдалося зберегти позначку: ' + (e.message || String(e)));
    } finally {
      saving.delete(lockKey);
    }
  }

  // ── РЕЖИМ РЕДАГУВАННЯ ─────────────────────────────────────────
  // За замовчуванням графік лише для перегляду — тапи нічого не міняють.
  // Явне увімкнення захищає від випадкових змін під час свайпу/скролу.
  function setEditMode(v) {
    editMode = v;
    const btn = el('sched-edit-toggle');
    const boards = el('sched-boards');
    if (btn) {
      btn.textContent = v ? '✅ Завершити редагування' : '✏️ Редагувати графік';
      btn.classList.toggle('is-active', v);
    }
    if (boards) boards.classList.toggle('sched-boards--editing', v);
  }

  // ── НАВІГАЦІЯ ПО МІСЯЦЯХ ──────────────────────────────────────
  async function changeMonth(delta) {
    mo += delta;
    if (mo > 12) { mo = 1; yr++; }
    if (mo < 1)  { mo = 12; yr--; }
    await loadMonth();
  }

  // ── РЕФРЕШ / ІНІТ ─────────────────────────────────────────────
  async function refresh() {
    await fetchUsers();
    if (!yr) {
      const now = new Date();
      yr = now.getFullYear();
      mo = now.getMonth() + 1;
    }
    setEditMode(false); // при кожному вході на вкладку — знову режим перегляду
    ensureBoards();
    await loadMonth();
  }

  function init() {
    el('sched-prev')?.addEventListener('click', () => changeMonth(-1));
    el('sched-next')?.addEventListener('click', () => changeMonth(+1));
    el('sched-edit-toggle')?.addEventListener('click', () => setEditMode(!editMode));
    window.addEventListener('portal:view', e => {
      if (e.detail.view === 'schedule') refresh();
      else if (editMode) setEditMode(false); // вийшли з вкладки — вимикаємо редагування
    });
  }

  return { init, refresh };
})();
