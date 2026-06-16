// ============================================================
// FINANCES MODULE v2
// Транзакції + Burn Rate + Кишенькові + Тумбочка + Трешхолд
// ============================================================

const Budget = (() => {

  const MONTHS_UA = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                     'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

  const EXPENSE_CATEGORIES = {
    'Їжа': '#FF6B9D', 'Транспорт': '#E8829C', 'Дім': '#C45B79',
    'Розваги': '#F6B9CC', "Здоров'я": '#D98AA3', 'Подарунки': '#F4A6BE', 'Інше': '#B98A9A'
  };
  const INCOME_CATEGORIES = ['Зарплата', 'Подарунок', 'Фріланс', 'Кишенькові Діми', 'Кишенькові Лєни', 'Інше'];
  const FALLBACK_COLORS = ['#FF6B9D', '#E8829C', '#C45B79', '#F6B9CC', '#D98AA3', '#F4A6BE', '#B98A9A'];

  let currentYear, currentMonth;
  let chartInstance = null;

  // ── НАЛАШТУВАННЯ (зберігаються в localStorage) ──
  const SETTINGS_KEY = 'amore_budget_settings';
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch { return {}; }
  }
  function saveSettings(obj) {
    const s = loadSettings();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(Object.assign(s, obj)));
  }

  function initMonth() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
  }

  function monthRange() {
    const start = new Date(currentYear, currentMonth, 1);
    const end   = new Date(currentYear, currentMonth + 1, 1);
    const fmt = d => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }

  function formatAmount(n) {
    const sign = n < 0 ? '-' : '';
    return sign + Math.round(Math.abs(n)).toLocaleString('uk-UA') + ' ₴';
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  }

  // ── ЗАВАНТАЖЕННЯ ──
  async function loadAllTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, type, category, description, date, created_by');
    if (error) { console.error(error); return []; }
    return data || [];
  }

  async function loadMonthTransactions() {
    const { start, end } = monthRange();
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, type, category, description, date, created_by')
      .gte('date', start).lt('date', end)
      .order('date', { ascending: false });
    if (error) { console.error(error); return []; }
    return data || [];
  }

  // ── БАЛАНС ──
  async function refreshBalance() {
    const all = await loadAllTransactions();
    const balance = all.reduce((sum, t) =>
      sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);
    const el = document.getElementById('balance-total');
    if (el) el.textContent = formatAmount(balance);
    return balance;
  }

  // ── BURN RATE ──
  function renderBurnRate(balance) {
    const now = new Date();
    // Наступна зп — 1-е наступного місяця (можна налаштувати)
    const s = loadSettings();
    const paydayDay = s.paydayDay || 1;
    let nextPay = new Date(now.getFullYear(), now.getMonth() + 1, paydayDay);
    const daysLeft = Math.max(1, Math.ceil((nextPay - now) / 86400000));

    const daily = Math.round(balance / daysLeft);

    const amountEl = document.getElementById('burn-daily');
    const barEl    = document.getElementById('burn-bar');
    const statusEl = document.getElementById('burn-status');
    const daysEl   = document.getElementById('burn-days');
    if (!amountEl) return;

    amountEl.textContent = daily > 0 ? daily.toLocaleString('uk-UA') : '0';
    if (daysEl) daysEl.textContent = daysLeft + ' дн. до зп';

    const maxOk = 2000;
    let cls, text;
    if (daily >= maxOk * 0.6) { cls = 'burn-ok';     text = '✓ Нормальний темп'; }
    else if (daily >= maxOk * 0.3) { cls = 'burn-warn'; text = '⚠ Трохи напружено'; }
    else                          { cls = 'burn-danger'; text = '🚨 Режим економії!'; }

    if (statusEl) { statusEl.className = 'burn-status ' + cls; statusEl.textContent = text; }
    if (barEl) {
      const pct = Math.min(100, Math.max(0, (daily / maxOk) * 100));
      barEl.style.width = pct + '%';
      barEl.className = 'burn-bar-fill ' + cls;
    }
  }

  // ── МІСЯЧНА СТАТИСТИКА ──
  function renderSummary(transactions) {
    const lbl = document.getElementById('budget-month-label');
    if (lbl) lbl.textContent = `${MONTHS_UA[currentMonth]} ${currentYear}`;

    const income  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

    const inc = document.getElementById('month-income');
    const exp = document.getElementById('month-expense');
    if (inc) inc.textContent = formatAmount(income);
    if (exp) exp.textContent = formatAmount(expense);

    renderChart(transactions.filter(t => t.type === 'expense'));
  }

  function renderChart(expenses) {
    const byCategory = {};
    expenses.forEach(e => {
      const cat = e.category || 'Інше';
      byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount);
    });
    const labels = Object.keys(byCategory);
    const values = Object.values(byCategory);
    const colors = labels.map((cat, i) => EXPENSE_CATEGORIES[cat] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]);
    const canvas = document.getElementById('budget-chart');
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    if (!labels.length || !canvas) return;
    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderColor: '#FFFFFF', borderWidth: 2 }] },
      options: {
        responsive: true,
        plugins: { legend: { position: 'bottom', labels: { font: { family: 'Inter', size: 12, weight: '600' }, color: '#4A3540', padding: 12 } } }
      }
    });
  }

  // ── СПИСОК ТРАНЗАКЦІЙ ──
  function renderList(transactions) {
    const wrap = document.getElementById('budget-list');
    if (!wrap) return;
    if (!transactions.length) {
      wrap.innerHTML = '<p class="empty-state">Транзакцій за цей місяць ще немає.</p>';
      return;
    }
    wrap.innerHTML = '';
    transactions.forEach(t => {
      const d = new Date(t.date);
      const isIncome = t.type === 'income';
      const item = document.createElement('div');
      item.className = 'expense-item';

      // Трешхолд — попередження якщо витрата більша за ліміт
      const s = loadSettings();
      const threshold = s.threshold || 2000;
      const isLarge = !isIncome && Number(t.amount) >= threshold;

      item.innerHTML = `
        <div class="expense-info">
          <span class="expense-category">${escapeHtml(t.category || 'Інше')}${isLarge ? ' <span class="tx-large-badge">📢</span>' : ''}</span>
          ${t.description ? `<p class="expense-desc">${escapeHtml(t.description)}</p>` : ''}
          <p class="expense-meta">${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}</p>
        </div>
        <div class="expense-amount ${isIncome ? 'income' : 'expense'}">${isIncome ? '+' : '−'}${formatAmount(t.amount)}</div>
        <button class="delete-btn" data-delete-id="${t.id}" title="Видалити">×</button>
      `;
      wrap.appendChild(item);
    });
    wrap.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => deleteTransaction(btn.dataset.deleteId));
    });
  }

  async function deleteTransaction(id) {
    if (!confirm('Видалити цю транзакцію?')) return;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) { alert('Не вдалось видалити'); return; }
    refresh();
  }

  // ── КИШЕНЬКОВІ ──
  function renderPockets(monthTransactions) {
    const s = loadSettings();
    const quota = s.pocketQuota || 3000;

    // Вхідні кишенькові цього місяця
    const dimaIncome = monthTransactions
      .filter(t => t.type === 'income' && t.category === 'Кишенькові Діми')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const lenaIncome = monthTransactions
      .filter(t => t.type === 'income' && t.category === 'Кишенькові Лєни')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const dimaLeft = quota - dimaIncome;
    const lenaLeft = quota - lenaIncome;

    const el = id => document.getElementById(id);
    if (!el('pocket-dima-amount')) return;

    el('pocket-dima-amount').textContent = dimaLeft.toLocaleString('uk-UA') + ' ₴';
    el('pocket-dima-sub').textContent = `з ${quota.toLocaleString('uk-UA')} ₴ залишилось`;
    el('pocket-dima-bar').style.width = Math.max(0, Math.min(100, (dimaLeft / quota) * 100)) + '%';

    el('pocket-lena-amount').textContent = lenaLeft.toLocaleString('uk-UA') + ' ₴';
    el('pocket-lena-sub').textContent = `з ${quota.toLocaleString('uk-UA')} ₴ залишилось`;
    el('pocket-lena-bar').style.width = Math.max(0, Math.min(100, (lenaLeft / quota) * 100)) + '%';

    // Вхідне поле квоти
    const inp = document.getElementById('pocket-quota-input');
    if (inp && !inp.dataset.bound) {
      inp.value = quota;
      inp.dataset.bound = '1';
      inp.addEventListener('change', () => {
        saveSettings({ pocketQuota: parseInt(inp.value) || 3000 });
        refresh();
      });
    }

    // Кнопки "Нарахувати"
    const btnDima = document.getElementById('pocket-charge-dima');
    const btnLena = document.getElementById('pocket-charge-lena');
    if (btnDima && !btnDima.dataset.bound) {
      btnDima.dataset.bound = '1';
      btnDima.addEventListener('click', () => chargePocket('dima', quota));
    }
    if (btnLena && !btnLena.dataset.bound) {
      btnLena.dataset.bound = '1';
      btnLena.addEventListener('click', () => chargePocket('lena', quota));
    }
  }

  async function chargePocket(person, quota) {
    const user = Auth.getCurrentUser();
    const category = person === 'dima' ? 'Кишенькові Діми' : 'Кишенькові Лєни';
    const name = person === 'dima' ? 'Діми' : 'Лєни';
    if (!confirm(`Нарахувати ${quota.toLocaleString('uk-UA')} ₴ кишенькових ${name}?`)) return;
    const { error } = await supabase.from('transactions').insert({
      amount: quota, type: 'income', category,
      date: new Date().toISOString().slice(0, 10),
      description: `Кишенькові ${name} — ${MONTHS_UA[currentMonth]}`,
      created_by: user ? user.id : null
    });
    if (error) { alert('Помилка збереження'); return; }
    refresh();
  }

  // ── ТУМБОЧКА ──
  function renderTumbochka(allTransactions) {
    const tumbTotal = allTransactions
      .filter(t => t.category === 'Тумбочка')
      .reduce((sum, t) => sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);

    const el = document.getElementById('tumbochka-total');
    if (el) el.textContent = tumbTotal.toLocaleString('uk-UA') + ' ₴';
  }

  function bindTumbochka() {
    const inp    = document.getElementById('tumbochka-income-input');
    const btn    = document.getElementById('tumbochka-income-btn');
    const modal  = document.getElementById('tumbochka-modal');
    const optBtns = document.querySelectorAll('.tumbo-opt');
    const calcEl = document.getElementById('tumbo-calc-amount');
    const confirmBtn = document.getElementById('tumbo-confirm');

    if (!inp || inp.dataset.bound) return;
    inp.dataset.bound = '1';

    let currentIncome = 0;
    let currentPct = 15;

    function updateCalc() {
      const amount = Math.round(currentIncome * currentPct / 100);
      if (calcEl) calcEl.textContent = amount.toLocaleString('uk-UA') + ' ₴';
    }

    btn.addEventListener('click', () => {
      const val = parseInt(inp.value);
      if (!val || val <= 0) {
        inp.style.borderColor = 'var(--danger)';
        setTimeout(() => inp.style.borderColor = '', 1500);
        return;
      }
      currentIncome = val;
      document.getElementById('tumbo-income-display').textContent = val.toLocaleString('uk-UA') + ' ₴';
      // скинути вибір на 15%
      optBtns.forEach(b => b.classList.toggle('active', b.dataset.pct === '15'));
      currentPct = 15;
      updateCalc();
      if (modal) modal.classList.add('visible');
    });

    inp.addEventListener('keydown', e => { if (e.key === 'Enter') btn.click(); });

    optBtns.forEach(b => {
      b.addEventListener('click', () => {
        currentPct = parseInt(b.dataset.pct) || 0;
        optBtns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        updateCalc();
      });
    });

    if (confirmBtn && !confirmBtn.dataset.bound) {
      confirmBtn.dataset.bound = '1';
      confirmBtn.addEventListener('click', async () => {
        const user = Auth.getCurrentUser();
        const toSave = Math.round(currentIncome * currentPct / 100);
        const toBalance = currentIncome - toSave;

        // Основний дохід
        await supabase.from('transactions').insert({
          amount: currentIncome, type: 'income', category: 'Зарплата',
          date: new Date().toISOString().slice(0, 10),
          description: 'Дохід', created_by: user ? user.id : null
        });

        // Тумбочка (якщо обрали > 0%)
        if (toSave > 0) {
          await supabase.from('transactions').insert({
            amount: toSave, type: 'expense', category: 'Тумбочка',
            date: new Date().toISOString().slice(0, 10),
            description: 'Відкладено в тумбочку', created_by: user ? user.id : null
          });
        }

        if (modal) modal.classList.remove('visible');
        inp.value = '';
        refresh();
      });
    }
  }

  // ── ТРЕШХОЛД ──
  function bindThreshold() {
    const slider = document.getElementById('threshold-slider');
    const display = document.getElementById('threshold-display');
    if (!slider || slider.dataset.bound) return;
    slider.dataset.bound = '1';

    const s = loadSettings();
    slider.value = s.threshold || 2000;
    if (display) display.textContent = (s.threshold || 2000).toLocaleString('uk-UA') + ' ₴';

    slider.addEventListener('input', () => {
      const val = parseInt(slider.value);
      saveSettings({ threshold: val });
      if (display) display.textContent = val.toLocaleString('uk-UA') + ' ₴';
    });
  }

  // ── МОДАЛКА ДОДАВАННЯ ТРАНЗАКЦІЇ ──
  function openAddModal(type) {
    const root = document.getElementById('modal-root');
    const isIncome = type === 'income';
    const categories = isIncome ? INCOME_CATEGORIES : Object.keys(EXPENSE_CATEGORIES);

    root.innerHTML = `
      <div class="modal-overlay" id="tx-modal-overlay">
        <div class="modal-card">
          <h3>${isIncome ? 'Новий дохід' : 'Нова витрата'}</h3>
          <div class="form-field">
            <label for="tx-amount">Сума, ₴</label>
            <input type="number" id="tx-amount" placeholder="0" min="0" step="1">
          </div>
          <div class="form-field">
            <label for="tx-category">Категорія</label>
            <select id="tx-category">
              ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="tx-date">Дата</label>
            <input type="date" id="tx-date">
          </div>
          <div class="form-field">
            <label for="tx-desc">Опис (необов'язково)</label>
            <input type="text" id="tx-desc" placeholder="${isIncome ? 'Звідки гроші' : 'На що витратили'}">
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="tx-cancel">Скасувати</button>
            <button class="btn-primary" id="tx-save">Зберегти</button>
          </div>
        </div>
      </div>`;

    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);
    document.getElementById('tx-cancel').addEventListener('click', closeModal);
    document.getElementById('tx-modal-overlay').addEventListener('click', e => {
      if (e.target.id === 'tx-modal-overlay') closeModal();
    });
    document.getElementById('tx-save').addEventListener('click', () => saveTransaction(type));
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  async function saveTransaction(type) {
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const category = document.getElementById('tx-category').value;
    const date = document.getElementById('tx-date').value;
    const description = document.getElementById('tx-desc').value.trim();
    if (!amount || amount <= 0 || !date) { alert('Вкажи суму та дату'); return; }
    const user = Auth.getCurrentUser();
    const { error } = await supabase.from('transactions').insert({
      amount, type, category, date,
      description: description || null,
      created_by: user ? user.id : null
    });
    if (error) { alert('Не вдалось зберегти'); return; }
    closeModal();
    refresh();
  }

  // ── ГОЛОВНИЙ РЕФРЕШ ──
  async function refresh() {
    const [monthTx, allTx] = await Promise.all([
      loadMonthTransactions(),
      loadAllTransactions()
    ]);

    const balance = allTx.reduce((sum, t) =>
      sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount)), 0);

    const balEl = document.getElementById('balance-total');
    if (balEl) balEl.textContent = formatAmount(balance);

    renderBurnRate(balance);
    renderSummary(monthTx);
    renderList(monthTx);
    renderPockets(monthTx);
    renderTumbochka(allTx);
    bindTumbochka();
    bindThreshold();
  }

  function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0)  { currentMonth = 11; currentYear -= 1; }
    if (currentMonth > 11) { currentMonth = 0;  currentYear += 1; }
    refresh();
  }

  function init() {
    initMonth();
    const addExp = document.getElementById('add-expense-btn');
    const addInc = document.getElementById('add-income-btn');
    const prev   = document.getElementById('budget-prev-month');
    const next   = document.getElementById('budget-next-month');
    if (addExp) addExp.addEventListener('click', () => openAddModal('expense'));
    if (addInc) addInc.addEventListener('click', () => openAddModal('income'));
    if (prev)   prev.addEventListener('click', () => changeMonth(-1));
    if (next)   next.addEventListener('click', () => changeMonth(1));
    window.addEventListener('portal:view', e => {
      if (e.detail.view === 'budget') refresh();
    });
  }

  return { init, refresh };
})();
