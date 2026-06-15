// ============================================================
// BUDGET MODULE
// Витрати: список, місячний підсумок, графік по категоріях
// ============================================================

const Budget = (() => {

  const MONTHS_UA = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень',
                      'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];

  const CATEGORY_COLORS = {
    'Їжа': '#FF6B9D',
    'Транспорт': '#E8829C',
    'Дім': '#C45B79',
    'Розваги': '#F6B9CC',
    'Здоров\'я': '#D98AA3',
    'Подарунки': '#F4A6BE',
    'Інше': '#B98A9A'
  };
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

  async function loadExpenses() {
    const { start, end } = monthRange();
    const { data, error } = await supabase
      .from('expenses')
      .select('id, amount, category, description, date, created_by')
      .gte('date', start)
      .lt('date', end)
      .order('date', { ascending: false });

    if (error) {
      console.error('Помилка завантаження витрат:', error);
      return [];
    }
    return data || [];
  }

  function formatAmount(n) {
    return Math.round(n).toLocaleString('uk-UA') + ' ₴';
  }

  function renderSummary(expenses) {
    document.getElementById('budget-month-label').textContent =
      `${MONTHS_UA[currentMonth]} ${currentYear}`;

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    document.getElementById('budget-total').textContent = formatAmount(total);

    renderChart(expenses);
  }

  function renderChart(expenses) {
    const byCategory = {};
    expenses.forEach(e => {
      const cat = e.category || 'Інше';
      byCategory[cat] = (byCategory[cat] || 0) + Number(e.amount);
    });

    const labels = Object.keys(byCategory);
    const values = Object.values(byCategory);
    const colors = labels.map((cat, i) => CATEGORY_COLORS[cat] || FALLBACK_COLORS[i % FALLBACK_COLORS.length]);

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

  function renderList(expenses) {
    const wrap = document.getElementById('budget-list');

    if (!expenses.length) {
      wrap.innerHTML = '<p class="empty-state">Витрат за цей місяць ще немає.</p>';
      return;
    }

    wrap.innerHTML = '';
    expenses.forEach(e => {
      const d = new Date(e.date);
      const item = document.createElement('div');
      item.className = 'expense-item';
      item.innerHTML = `
        <div class="expense-info">
          <span class="expense-category">${escapeHtml(e.category || 'Інше')}</span>
          ${e.description ? `<p class="expense-desc">${escapeHtml(e.description)}</p>` : ''}
          <p class="expense-meta">${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}</p>
        </div>
        <div class="expense-amount">${formatAmount(e.amount)}</div>
      `;
      wrap.appendChild(item);
    });
  }

  async function refresh() {
    const expenses = await loadExpenses();
    renderSummary(expenses);
    renderList(expenses);
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

  // ---------- Модалка додавання витрати ----------
  function openAddModal() {
    const root = document.getElementById('modal-root');
    const categories = Object.keys(CATEGORY_COLORS);

    root.innerHTML = `
      <div class="modal-overlay" id="expense-modal-overlay">
        <div class="modal-card">
          <h3>Нова витрата</h3>
          <div class="form-field">
            <label for="expense-amount">Сума, ₴</label>
            <input type="number" id="expense-amount" placeholder="0" min="0" step="0.01">
          </div>
          <div class="form-field">
            <label for="expense-category">Категорія</label>
            <select id="expense-category">
              ${categories.map(c => `<option value="${c}">${c}</option>`).join('')}
            </select>
          </div>
          <div class="form-field">
            <label for="expense-date">Дата</label>
            <input type="date" id="expense-date">
          </div>
          <div class="form-field">
            <label for="expense-desc">Опис (необов'язково)</label>
            <input type="text" id="expense-desc" placeholder="На що витратили">
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="expense-cancel">Скасувати</button>
            <button class="btn-primary" id="expense-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    // встановити сьогоднішню дату за замовчуванням
    document.getElementById('expense-date').value = new Date().toISOString().slice(0, 10);

    document.getElementById('expense-cancel').addEventListener('click', closeModal);
    document.getElementById('expense-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'expense-modal-overlay') closeModal();
    });
    document.getElementById('expense-save').addEventListener('click', saveExpense);

    // select select styling
    const select = document.getElementById('expense-category');
    select.style.fontFamily = 'var(--font-body)';
    select.style.fontSize = '14px';
    select.style.padding = '8px 12px';
    select.style.border = '1px solid var(--line)';
    select.style.borderRadius = 'var(--radius-sm)';
    select.style.background = 'var(--bg)';
    select.style.color = 'var(--text)';
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  async function saveExpense() {
    const amount = parseFloat(document.getElementById('expense-amount').value);
    const category = document.getElementById('expense-category').value;
    const date = document.getElementById('expense-date').value;
    const description = document.getElementById('expense-desc').value.trim();

    if (!amount || amount <= 0 || !date) {
      alert('Вкажи суму та дату');
      return;
    }

    const user = Auth.getCurrentUser();

    const { error } = await supabase.from('expenses').insert({
      amount,
      category,
      date,
      description: description || null,
      created_by: user ? user.id : null
    });

    if (error) {
      console.error('Помилка збереження витрати:', error);
      alert('Не вдалось зберегти витрату');
      return;
    }

    closeModal();
    refresh();
  }

  function init() {
    initMonth();
    document.getElementById('add-expense-btn').addEventListener('click', openAddModal);
    document.getElementById('budget-prev-month').addEventListener('click', () => changeMonth(-1));
    document.getElementById('budget-next-month').addEventListener('click', () => changeMonth(1));
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'budget') refresh();
    });
  }

  return { init, refresh };
})();
