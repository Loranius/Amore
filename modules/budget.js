// ============================================================
// FINANCES MODULE v3
// ============================================================

const Budget = (() => {

  const MONTHS_UA = ['Січень','Лютий','Березень','Квітень','Травень','Червень',
                     'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень'];
  const EXPENSE_CATEGORIES = {
    'Їжа':'#FF6B9D','Транспорт':'#E8829C','Дім':'#C45B79',
    'Розваги':'#F6B9CC',"Здоров'я":'#D98AA3','Подарунки':'#F4A6BE','Інше':'#B98A9A'
  };
  const INCOME_CATEGORIES = ['Зарплата','Подарунок','Фріланс','Кишенькові Діми','Кишенькові Лєни','Інше'];
  const FALLBACK_COLORS = ['#FF6B9D','#E8829C','#C45B79','#F6B9CC','#D98AA3','#F4A6BE','#B98A9A'];

  let currentYear, currentMonth;
  let chartInstance = null;
  let allTxCache = [];
  let monthTxCache = [];

  // ── НАЛАШТУВАННЯ ──
  const SK = 'amore_budget_v3';
  function loadSettings() { try { return JSON.parse(localStorage.getItem(SK)) || {}; } catch { return {}; } }
  function saveSettings(obj) { localStorage.setItem(SK, JSON.stringify(Object.assign(loadSettings(), obj))); }

  function initMonth() { const n = new Date(); currentYear = n.getFullYear(); currentMonth = n.getMonth(); }

  function monthRange() {
    const fmt = d => d.toISOString().slice(0,10);
    return { start: fmt(new Date(currentYear,currentMonth,1)), end: fmt(new Date(currentYear,currentMonth+1,1)) };
  }

  function fmt(n) {
    const sign = n < 0 ? '-' : '';
    return sign + Math.round(Math.abs(n)).toLocaleString('uk-UA') + ' ₴';
  }

  function esc(str) { const d = document.createElement('div'); d.textContent = str||''; return d.innerHTML; }

  function el(id) { return document.getElementById(id); }

  // ── ЗАВАНТАЖЕННЯ ──
  async function loadAll() {
    const { data } = await supabase.from('transactions')
      .select('id,amount,type,category,description,date,created_by').order('date',{ascending:false});
    allTxCache = data || [];
    return allTxCache;
  }

  async function loadMonth() {
    const { start, end } = monthRange();
    const { data } = await supabase.from('transactions')
      .select('id,amount,type,category,description,date,created_by')
      .gte('date',start).lt('date',end).order('date',{ascending:false});
    monthTxCache = data || [];
    return monthTxCache;
  }

  // ── БАЛАНС ──
  function calcBalance(txs) {
    return txs.reduce((s,t) => s + (t.type==='income' ? +t.amount : -t.amount), 0);
  }

  // ── BURN RATE (ручний ліміт) ──
  function renderBurnRate() {
    const s = loadSettings();
    const daily = s.dailyLimit || 0;
    const amEl = el('burn-daily'); if (!amEl) return;
    amEl.textContent = daily > 0 ? daily.toLocaleString('uk-UA') : '—';

    const inp = el('burn-limit-input');
    if (inp && !inp.dataset.bound) {
      inp.dataset.bound = '1';
      inp.value = daily || '';
      inp.addEventListener('change', () => {
        saveSettings({ dailyLimit: parseInt(inp.value)||0 });
        renderBurnRate();
      });
    }
  }

  // ── МІСЯЧНА СТАТИСТИКА ──
  function renderSummary(txs) {
    const lbl = el('budget-month-label');
    if (lbl) lbl.textContent = `${MONTHS_UA[currentMonth]} ${currentYear}`;
    const inc = txs.filter(t=>t.type==='income').reduce((s,t)=>s+ +t.amount,0);
    const exp = txs.filter(t=>t.type==='expense').reduce((s,t)=>s+ +t.amount,0);
    if (el('month-income'))  el('month-income').textContent  = fmt(inc);
    if (el('month-expense')) el('month-expense').textContent = fmt(exp);
    renderChart(txs.filter(t=>t.type==='expense'));
  }

  function renderChart(expenses) {
    const bycat = {};
    expenses.forEach(e => { const c=e.category||'Інше'; bycat[c]=(bycat[c]||0)+ +e.amount; });
    const labels=Object.keys(bycat), values=Object.values(bycat);
    const colors=labels.map((c,i)=>EXPENSE_CATEGORIES[c]||FALLBACK_COLORS[i%FALLBACK_COLORS.length]);
    const canvas=el('budget-chart');
    if (chartInstance) { chartInstance.destroy(); chartInstance=null; }
    if (!labels.length||!canvas) return;
    chartInstance = new Chart(canvas,{
      type:'doughnut',
      data:{labels,datasets:[{data:values,backgroundColor:colors,borderColor:'#FFF',borderWidth:2}]},
      options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'Inter',size:12,weight:'600'},color:'#4A3540',padding:12}}}}
    });
  }

  // ── КАЛЕНДАР ──
  function renderCalendar(txs) {
    const wrap = el('budget-calendar'); if (!wrap) return;
    const now = new Date();
    const yr = currentYear, mo = currentMonth;
    const daysInMonth = new Date(yr, mo+1, 0).getDate();
    const firstDay = new Date(yr, mo, 1).getDay(); // 0=Sun

    // Групуємо по днях
    const byDay = {};
    txs.forEach(t => {
      const d = new Date(t.date).getDate();
      if (!byDay[d]) byDay[d] = { income:0, expense:0 };
      if (t.type==='income')  byDay[d].income  += +t.amount;
      else                    byDay[d].expense += +t.amount;
    });

    const dayNames = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
    let html = '<div class="cal-grid">';
    dayNames.forEach(n => { html += `<div class="cal-head">${n}</div>`; });

    // Зміщення (понеділок = 0)
    const offset = (firstDay + 6) % 7;
    for (let i=0; i<offset; i++) html += '<div class="cal-cell cal-empty"></div>';

    for (let d=1; d<=daysInMonth; d++) {
      const isToday = d===now.getDate() && mo===now.getMonth() && yr===now.getFullYear();
      const data = byDay[d];
      let extra = '';
      if (data) {
        if (data.income)  extra += `<span class="cal-dot cal-dot-in">+${Math.round(data.income/1000)}k</span>`;
        if (data.expense) extra += `<span class="cal-dot cal-dot-ex">-${Math.round(data.expense/1000)}k</span>`;
      }
      html += `<div class="cal-cell${isToday?' cal-today':''}" onclick="Budget._calDay(${d})">${d}${extra}</div>`;
    }
    html += '</div>';
    wrap.innerHTML = html;
  }

  // Клік по дню — показуємо транзакції цього дня
  function showCalDay(day) {
    const { start } = monthRange();
    const dateStr = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const dayTxs = allTxCache.filter(t => t.date && t.date.slice(0,10) === dateStr);
    if (!dayTxs.length) return;

    const root = el('modal-root');
    const rows = dayTxs.map(t => {
      const isInc = t.type==='income';
      const who = getUserName(t.created_by);
      return `<div class="expense-item">
        <div class="expense-info">
          <span class="expense-category">${esc(t.category||'Інше')}</span>
          ${t.description ? `<p class="expense-desc">${esc(t.description)}</p>` : ''}
          ${who ? `<p class="expense-meta">👤 ${esc(who)}</p>` : ''}
        </div>
        <div class="expense-amount ${isInc?'income':'expense'}">${isInc?'+':'−'}${fmt(t.amount)}</div>
      </div>`;
    }).join('');

    root.innerHTML = `
      <div class="modal-overlay" id="cal-day-overlay">
        <div class="modal-card">
          <h3>${day} ${MONTHS_UA[currentMonth]}</h3>
          ${rows}
          <div class="modal-actions">
            <button class="btn-secondary" onclick="document.getElementById('modal-root').innerHTML=''">Закрити</button>
          </div>
        </div>
      </div>`;
    el('cal-day-overlay').addEventListener('click', e => { if(e.target.id==='cal-day-overlay') root.innerHTML=''; });
  }

  function getUserName(userId) {
    if (!userId) return null;
    // Auth.getCurrentUser() дає поточного, але нам треба знайти по id
    // Звертаємось до кешу users через Auth
    try {
      const u = Auth._getUsers ? Auth._getUsers().find(u=>u.id===userId) : null;
      return u ? u.name : null;
    } catch { return null; }
  }

  // ── СПИСОК ТРАНЗАКЦІЙ ──
  function renderList(txs) {
    const wrap = el('budget-list'); if (!wrap) return;
    if (!txs.length) { wrap.innerHTML = '<p class="empty-state">Транзакцій за цей місяць ще немає.</p>'; return; }

    const s = loadSettings();
    const threshold = s.threshold || 2000;
    wrap.innerHTML = '';

    txs.forEach(t => {
      const d = new Date(t.date);
      const isInc = t.type==='income';
      const isLarge = !isInc && +t.amount >= threshold;
      const who = getUserName(t.created_by);
      const item = document.createElement('div');
      item.className = 'expense-item';
      item.innerHTML = `
        <div class="expense-info">
          <span class="expense-category">${esc(t.category||'Інше')}${isLarge?' <span class="tx-large-badge">📢</span>':''}</span>
          ${t.description ? `<p class="expense-desc">${esc(t.description)}</p>` : ''}
          <p class="expense-meta">${d.getDate()}.${String(d.getMonth()+1).padStart(2,'0')}${who ? ` · 👤 ${esc(who)}` : ''}</p>
        </div>
        <div class="expense-amount ${isInc?'income':'expense'}">${isInc?'+':'−'}${fmt(t.amount)}</div>
        <button class="delete-btn" data-del="${t.id}">×</button>`;
      wrap.appendChild(item);
    });

    wrap.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => delTx(btn.dataset.del));
    });
  }

  async function delTx(id) {
    if (!confirm('Видалити транзакцію?')) return;
    await supabase.from('transactions').delete().eq('id', id);
    refresh();
  }

  // ── КИШЕНЬКОВІ ──
  function renderPockets(monthTxs) {
    const s = loadSettings();
    const quota = s.pocketQuota || 3000;
    const dimaInc = monthTxs.filter(t=>t.type==='income'&&t.category==='Кишенькові Діми').reduce((s,t)=>s+ +t.amount,0);
    const lenaInc = monthTxs.filter(t=>t.type==='income'&&t.category==='Кишенькові Лєни').reduce((s,t)=>s+ +t.amount,0);
    const dLeft = quota - dimaInc, lLeft = quota - lenaInc;

    if (!el('pocket-dima-amount')) return;
    el('pocket-dima-amount').textContent = dLeft.toLocaleString('uk-UA')+' ₴';
    el('pocket-dima-sub').textContent    = `з ${quota.toLocaleString('uk-UA')} ₴`;
    el('pocket-dima-bar').style.width    = Math.max(0,Math.min(100,(dLeft/quota)*100))+'%';
    el('pocket-lena-amount').textContent = lLeft.toLocaleString('uk-UA')+' ₴';
    el('pocket-lena-sub').textContent    = `з ${quota.toLocaleString('uk-UA')} ₴`;
    el('pocket-lena-bar').style.width    = Math.max(0,Math.min(100,(lLeft/quota)*100))+'%';

    const qi = el('pocket-quota-input');
    if (qi && !qi.dataset.bound) {
      qi.dataset.bound='1'; qi.value=quota;
      qi.addEventListener('change',()=>{ saveSettings({pocketQuota:parseInt(qi.value)||3000}); refresh(); });
    }
    ['dima','lena'].forEach(p => {
      const b = el('pocket-charge-'+p);
      if (b && !b.dataset.bound) {
        b.dataset.bound='1';
        b.addEventListener('click',()=>chargePocket(p,quota));
      }
    });
  }

  async function chargePocket(person, quota) {
    const user = Auth.getCurrentUser();
    const cat = person==='dima' ? 'Кишенькові Діми' : 'Кишенькові Лєни';
    const name = person==='dima' ? 'Діми' : 'Лєни';
    if (!confirm(`Нарахувати ${quota.toLocaleString('uk-UA')} ₴ кишенькових ${name}?`)) return;
    await supabase.from('transactions').insert({
      amount:quota, type:'income', category:cat,
      date:new Date().toISOString().slice(0,10),
      description:`Кишенькові ${name} — ${MONTHS_UA[currentMonth]}`,
      created_by: user?.id||null
    });
    refresh();
  }

  // ── ТУМБОЧКА ──
  function renderTumbochka(allTxs) {
    const total = allTxs
      .filter(t=>t.category==='Тумбочка')
      .reduce((s,t)=>s+(t.type==='income'?+t.amount:-t.amount),0);
    if (el('tumbochka-total')) el('tumbochka-total').textContent = total.toLocaleString('uk-UA')+' ₴';
  }

  function bindTumbochka() {
    // Кнопка "Внести вручну" (початковий резерв)
    const manualInp = el('tumbo-manual-input');
    const manualBtn = el('tumbo-manual-btn');
    if (manualInp && !manualInp.dataset.bound) {
      manualInp.dataset.bound='1';
      manualBtn.addEventListener('click', async () => {
        const val = parseInt(manualInp.value);
        if (!val||val<=0) { manualInp.style.borderColor='var(--danger)'; setTimeout(()=>manualInp.style.borderColor='',1500); return; }
        const user = Auth.getCurrentUser();
        await supabase.from('transactions').insert({
          amount:val, type:'income', category:'Тумбочка',
          date:new Date().toISOString().slice(0,10),
          description:'Поповнення тумбочки вручну',
          created_by:user?.id||null
        });
        manualInp.value='';
        refresh();
      });
      manualInp.addEventListener('keydown',e=>{ if(e.key==='Enter') manualBtn.click(); });
    }

    // Внести дохід + % в тумбочку
    const incInp  = el('tumbochka-income-input');
    const incBtn  = el('tumbochka-income-btn');
    const modal   = el('tumbochka-modal');
    const optBtns = document.querySelectorAll('.tumbo-opt');
    const calcEl  = el('tumbo-calc-amount');
    const confirmBtn = el('tumbo-confirm');
    if (!incInp || incInp.dataset.bound) return;
    incInp.dataset.bound='1';

    let curIncome=0, curPct=15;

    function updCalc() {
      if (calcEl) calcEl.textContent = Math.round(curIncome*curPct/100).toLocaleString('uk-UA')+' ₴';
    }

    incBtn.addEventListener('click',()=>{
      const v=parseInt(incInp.value);
      if(!v||v<=0){ incInp.style.borderColor='var(--danger)'; setTimeout(()=>incInp.style.borderColor='',1500); return; }
      curIncome=v;
      el('tumbo-income-display').textContent=v.toLocaleString('uk-UA')+' ₴';
      optBtns.forEach(b=>b.classList.toggle('active',b.dataset.pct==='15'));
      curPct=15; updCalc();
      if(modal) modal.classList.add('visible');
    });
    incInp.addEventListener('keydown',e=>{ if(e.key==='Enter') incBtn.click(); });

    optBtns.forEach(b=>b.addEventListener('click',()=>{
      curPct=parseInt(b.dataset.pct)||0;
      optBtns.forEach(x=>x.classList.remove('active')); b.classList.add('active');
      updCalc();
    }));

    if (confirmBtn && !confirmBtn.dataset.bound) {
      confirmBtn.dataset.bound='1';
      confirmBtn.addEventListener('click',async()=>{
        const user=Auth.getCurrentUser();
        const toSave=Math.round(curIncome*curPct/100);
        await supabase.from('transactions').insert({
          amount:curIncome,type:'income',category:'Зарплата',
          date:new Date().toISOString().slice(0,10),
          description:'Дохід',created_by:user?.id||null
        });
        if (toSave>0) {
          await supabase.from('transactions').insert({
            amount:toSave,type:'expense',category:'Тумбочка',
            date:new Date().toISOString().slice(0,10),
            description:'Відкладено в тумбочку',created_by:user?.id||null
          });
        }
        if(modal) modal.classList.remove('visible');
        incInp.value='';
        refresh();
      });
    }
  }

  // ── ТРЕШХОЛД ──
  function bindThreshold() {
    const slider  = el('threshold-slider');
    const display = el('threshold-display');
    if (!slider||slider.dataset.bound) return;
    slider.dataset.bound='1';
    const s = loadSettings();
    slider.value = s.threshold||2000;
    if(display) display.textContent=(s.threshold||2000).toLocaleString('uk-UA')+' ₴';
    slider.addEventListener('input',()=>{
      const v=parseInt(slider.value);
      saveSettings({threshold:v});
      if(display) display.textContent=v.toLocaleString('uk-UA')+' ₴';
      renderList(monthTxCache);
    });
  }

  // ── ЦІЛІ ──
  async function loadGoals() {
    const { data } = await supabase.from('savings_goals')
      .select('id,name,url,target_amount,saved_amount').order('created_at',{ascending:false});
    return data||[];
  }

  async function renderGoals() {
    const wrap = el('goals-list'); if(!wrap) return;
    const goals = await loadGoals();
    if(!goals.length){ wrap.innerHTML='<p class="empty-state">Цілей ще немає.</p>'; return; }
    wrap.innerHTML='';
    goals.forEach(g=>{
      const pct = g.target_amount>0 ? Math.min(100,Math.round((g.saved_amount||0)/g.target_amount*100)) : 0;
      const item=document.createElement('div');
      item.className='goal-item';
      item.innerHTML=`
        <div class="goal-info">
          <span class="goal-name">${esc(g.name)}</span>
          ${g.url ? `<a class="goal-link" href="${esc(g.url)}" target="_blank" rel="noopener">🔗 Переглянути</a>` : ''}
        </div>
        <div class="goal-right">
          <div class="goal-amounts">
            <span class="goal-saved">${(g.saved_amount||0).toLocaleString('uk-UA')} ₴</span>
            <span class="goal-sep">/</span>
            <span class="goal-target">${g.target_amount.toLocaleString('uk-UA')} ₴</span>
          </div>
          <div class="goal-bar-wrap"><div class="goal-bar-fill" style="width:${pct}%"></div></div>
          <span class="goal-pct">${pct}%</span>
        </div>
        <button class="delete-btn" data-goal-del="${g.id}">×</button>`;
      wrap.appendChild(item);
    });
    wrap.querySelectorAll('[data-goal-del]').forEach(btn=>{
      btn.addEventListener('click',()=>delGoal(btn.dataset.goalDel));
    });
  }

  async function delGoal(id) {
    if(!confirm('Видалити ціль?')) return;
    await supabase.from('savings_goals').delete().eq('id',id);
    renderGoals();
  }

  function bindGoals() {
    const btn = el('add-goal-btn');
    if(!btn||btn.dataset.bound) return;
    btn.dataset.bound='1';
    btn.addEventListener('click', openGoalModal);
  }

  function openGoalModal() {
    const root = el('modal-root');
    root.innerHTML=`
      <div class="modal-overlay" id="goal-overlay">
        <div class="modal-card">
          <h3>Нова ціль</h3>
          <div class="form-field">
            <label>Назва</label>
            <input type="text" id="goal-name" placeholder="Наприклад: Телевізор">
          </div>
          <div class="form-field">
            <label>Ціна, ₴</label>
            <input type="number" id="goal-price" placeholder="0" min="0" step="100">
          </div>
          <div class="form-field">
            <label>Посилання (необов'язково)</label>
            <input type="url" id="goal-url" placeholder="https://...">
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="goal-cancel">Скасувати</button>
            <button class="btn-primary" id="goal-save">Зберегти</button>
          </div>
        </div>
      </div>`;
    el('goal-cancel').addEventListener('click',()=>root.innerHTML='');
    el('goal-overlay').addEventListener('click',e=>{ if(e.target.id==='goal-overlay') root.innerHTML=''; });
    el('goal-save').addEventListener('click', saveGoal);
  }

  async function saveGoal() {
    const name  = el('goal-name').value.trim();
    const price = parseFloat(el('goal-price').value);
    const url   = el('goal-url').value.trim();
    if(!name||!price||price<=0){ alert('Вкажи назву та ціну'); return; }
    await supabase.from('savings_goals').insert({
      name, target_amount:price, saved_amount:0, url:url||null
    });
    el('modal-root').innerHTML='';
    renderGoals();
  }

  // ── МОДАЛКА ТРАНЗАКЦІЇ ──
  function openAddModal(type) {
    const root = el('modal-root');
    const isInc = type==='income';
    const cats  = isInc ? INCOME_CATEGORIES : Object.keys(EXPENSE_CATEGORIES);
    root.innerHTML=`
      <div class="modal-overlay" id="tx-overlay">
        <div class="modal-card">
          <h3>${isInc?'Новий дохід':'Нова витрата'}</h3>
          <div class="form-field">
            <label>Сума, ₴</label>
            <input type="number" id="tx-amount" placeholder="0" min="0" step="1">
          </div>
          <div class="form-field">
            <label>Категорія</label>
            <select id="tx-category">${cats.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
          </div>
          <div class="form-field">
            <label>Дата</label>
            <input type="date" id="tx-date">
          </div>
          <div class="form-field">
            <label>Опис (необов'язково)</label>
            <input type="text" id="tx-desc" placeholder="${isInc?'Звідки':'На що'}">
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="tx-cancel">Скасувати</button>
            <button class="btn-primary" id="tx-save">Зберегти</button>
          </div>
        </div>
      </div>`;
    el('tx-date').value = new Date().toISOString().slice(0,10);
    el('tx-cancel').addEventListener('click',()=>root.innerHTML='');
    el('tx-overlay').addEventListener('click',e=>{ if(e.target.id==='tx-overlay') root.innerHTML=''; });
    el('tx-save').addEventListener('click',()=>saveTx(type));
  }

  async function saveTx(type) {
    const amount = parseFloat(el('tx-amount').value);
    const cat    = el('tx-category').value;
    const date   = el('tx-date').value;
    const desc   = el('tx-desc').value.trim();
    if(!amount||amount<=0||!date){ alert('Вкажи суму та дату'); return; }
    const user = Auth.getCurrentUser();
    await supabase.from('transactions').insert({
      amount, type, category:cat, date,
      description:desc||null, created_by:user?.id||null
    });
    el('modal-root').innerHTML='';
    refresh();
  }

  // ── РЕФРЕШ ──
  async function refresh() {
    const [all, month] = await Promise.all([loadAll(), loadMonth()]);
    const balance = calcBalance(all);

    if(el('balance-total')) el('balance-total').textContent = fmt(balance);

    renderBurnRate();
    renderSummary(month);
    renderCalendar(month);
    renderList(month);
    renderPockets(month);
    renderTumbochka(all);
    bindTumbochka();
    bindThreshold();
    renderGoals();
    bindGoals();
  }

  function changeMonth(d) {
    currentMonth += d;
    if(currentMonth<0)  { currentMonth=11; currentYear--; }
    if(currentMonth>11) { currentMonth=0;  currentYear++; }
    refresh();
  }

  function init() {
    initMonth();
    if(el('add-expense-btn')) el('add-expense-btn').addEventListener('click',()=>openAddModal('expense'));
    if(el('add-income-btn'))  el('add-income-btn').addEventListener('click',()=>openAddModal('income'));
    if(el('budget-prev-month')) el('budget-prev-month').addEventListener('click',()=>changeMonth(-1));
    if(el('budget-next-month')) el('budget-next-month').addEventListener('click',()=>changeMonth(1));
    window.addEventListener('portal:view', e=>{ if(e.detail.view==='budget') refresh(); });
  }

  return { init, refresh, _calDay: showCalDay };
})();
