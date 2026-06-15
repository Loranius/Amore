// ============================================================
// FINANCES MODULE
// Транзакції (доходи/витрати), баланс "грошей на руках",
// місячна статистика + графік по категоріях витрат
// ============================================================

const Budget = (() => {

  const MONTHS_UA = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

  const EXPENSE_CATEGORIES = {
    'Їжа': '#FF6B9D',
    'Транспорт': '#E8829C',
    'Дім': '#C45B79',
    'Розваги': '#F6B9CC',
    'Здоров\'я': '#D98AA3',
    'Подарунки': '#F4A6BE',
    'Інше': '#B98A9A'
  };
  const INCOME_CATEGORIES = ['Зарплата', 'Подарунок', 'Фріланс', 'Інше'];

  const FALLBACK_COLORS = ['#FF6B9D', '#E8829C', '#C45B79', '#F6B9CC', '#D98AA3', '#F4A6BE', '#B98A9A'];

  let currentYear, currentMonth; // currentMonth: 0-11
  let chartInstance = null;

  function initMonth() {
    const now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
  }

  function monthRange() {
    const start = new Date(currentYear, currentMonth, 1);
    const end = new Date(currentYear, currentMonth + 1, 1);
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { start: fmt(start), end: fmt(end) };
  }

  // ---------- Завантаження ----------
  async function loadAllTransactions() {
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, type, category, description, date, created_by');

    if (error) {
      console.error('Помилка завантаження транзакцій:', error);
      return [];
    }
    return data || [];
  }

  async function loadMonthTransactions() {
    const { start, end } = monthRange();
    const { data, error } = await supabase
      .from('transactions')
      .select('id, amount, type, category, description, date, created_by')
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: false });

    if (error) {
      console.error('Помилка завантаження транзакцій за місяць:', error);
      return [];
    }
    return data || [];
  }

  function formatAmount(n) {
    const sign = n < 0 ? '-' : '';
    return sign + Math.round(Math.abs(n)).toLocaleString('uk-UA') + ' ₴';
  }

  // ---------- Баланс (за весь час) ----------
  async function refreshBalance() {
    const all = await loadAllTransactions();
    const balance = all.reduce((sum, t) => {
      return sum + (t.type === 'income' ? Number(t.amount) : -Number(t.amount));
    }, 0);
    document.getElementById('balance-total').textContent = formatAmount(balance);
  }

  // ---------- Місячна статистика ----------
  function renderSummary(transactions) {
    document.getElementById('budget-month-label').textContent =
      `${MONTHS_UA[currentMonth]} ${currentYear}`;

    const income = transactions.filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const expense = transactions.filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    document.getElementById('month-income').textContent = formatAmount(income);
    document.getElementById('month-expense').textContent = formatAmount(expense);

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

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (!labels.length) return;

    chartInstance = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderColor: '#FFFFFF',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: 'Inter', size: 12, weight: '600' },
              color: '#4A3540',
              padding: 12
            }
          }
        }
      }
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ---------- Список транзакцій ----------
  function renderList(transactions) {
    const wrap = document.getElementById('budget-list');

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
      item.innerHTML = `
        <div class="expense-info">
          <span class="expense-category">${escapeHtml(t.category || 'Інше')}</span>
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
    if (error) {
      console.error('Помилка видалення транзакції:', error);
      alert('Не вдалось видалити транзакцію');
      return;
    }
    refresh();
  }

  async function refresh() {
    const monthTx = await loadMonthTransactions();
    renderSummary(monthTx);
    renderList(monthTx);
    refreshBalance();
  }

  function changeMonth(delta) {
    currentMonth += delta;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear -= 1;
    } else if (currentMonth > 11) {
      currentMonth = 0;
      currentYear += 1;
    }
    refresh();
  }

  // ---------- Модалка додавання транзакції ----------
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
            <input type="number" id="tx-amount" placeholder="0" min="0" step="0.01">
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
      </div>
    `;

    document.getElementById('tx-date').value = new Date().toISOString().slice(0, 10);

    document.getElementById('tx-cancel').addEventListener('click', closeModal);
    document.getElementById('tx-modal-overlay').addEventListener('click', (e) => {
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

    if (!amount || amount <= 0 || !date) {
      alert('Вкажи суму та дату');
      return;
    }

    const user = Auth.getCurrentUser();

    const { error } = await supabase.from('transactions').insert({
      amount,
      type,
      category,
      date,
      description: description || null,
      created_by: user ? user.id : null
    });

    if (error) {
      console.error('Помилка збереження транзакції:', error);
      alert('Не вдалось зберегти транзакцію');
      return;
    }

    closeModal();
    refresh();
  }

  function init() {
    initMonth();
    document.getElementById('add-expense-btn').addEventListener('click', () => openAddModal('expense'));
    document.getElementById('add-income-btn').addEventListener('click', () => openAddModal('income'));
    document.getElementById('budget-prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('budget-next-month').addEventListener('click', () => changeMonth(1));
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'budget') refresh();
    });
  }

  return { init, refresh };
})();
