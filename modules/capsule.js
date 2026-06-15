// ============================================================
// TIME CAPSULE MODULE
// Листи з датою відкриття: до дати показуємо лише
// повідомлення "лист є", контент закритий
// ============================================================

const Capsule = (() => {

  async function loadCapsules() {
    const { data, error } = await supabase
      .from('time_capsules')
      .select('id, title, content, open_date, created_by')
      .order('open_date', { ascending: true });

    if (error) {
      console.error('Помилка завантаження капсул:', error);
      return [];
    }
    return data || [];
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  function isUnlocked(openDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const open = new Date(openDate);
    open.setHours(0, 0, 0, 0);
    return today >= open;
  }

  function render(capsules) {
    const grid = document.getElementById('capsule-grid');

    if (!capsules.length) {
      grid.innerHTML = '<p class="empty-state">Листів ще немає. Напиши перший!</p>';
      return;
    }

    grid.innerHTML = '';
    capsules.forEach(c => {
      const unlocked = isUnlocked(c.open_date);
      const card = document.createElement('div');
      card.className = 'capsule-card' + (unlocked ? '' : ' locked');

      if (unlocked) {
        card.innerHTML = `
          <span class="capsule-icon">✉️</span>
          <p class="capsule-title">${escapeHtml(c.title)}</p>
          <span class="capsule-date">Відкрито ${formatDate(c.open_date)}</span>
          <p class="capsule-content">${escapeHtml(c.content)}</p>
        `;
      } else {
        card.innerHTML = `
          <span class="capsule-icon">🔒</span>
          <p class="capsule-title">${escapeHtml(c.title)}</p>
          <span class="capsule-date">Відкриється ${formatDate(c.open_date)}</span>
          <p class="capsule-locked-note">Лист чекає на свій день. Текст прихований.</p>
        `;
      }

      grid.appendChild(card);
    });
  }

  async function refresh() {
    const capsules = await loadCapsules();
    render(capsules);
  }

  // ---------- Модалка додавання листа ----------
  function openAddModal() {
    const root = document.getElementById('modal-root');
    root.innerHTML = `
      <div class="modal-overlay" id="capsule-modal-overlay">
        <div class="modal-card">
          <h3>Новий лист у капсулу часу</h3>
          <div class="form-field">
            <label for="capsule-title">Назва</label>
            <input type="text" id="capsule-title" placeholder="Наприклад, До нашої п'ятої річниці">
          </div>
          <div class="form-field">
            <label for="capsule-date">Дата відкриття</label>
            <input type="date" id="capsule-date">
          </div>
          <div class="form-field">
            <label for="capsule-content">Текст листа</label>
            <textarea id="capsule-content" rows="5" placeholder="Напиши, що хочеш сказати в майбутньому..."></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn-secondary" id="capsule-cancel">Скасувати</button>
            <button class="btn-primary" id="capsule-save">Зберегти</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('capsule-cancel').addEventListener('click', closeModal);
    document.getElementById('capsule-modal-overlay').addEventListener('click', (e) => {
      if (e.target.id === 'capsule-modal-overlay') closeModal();
    });
    document.getElementById('capsule-save').addEventListener('click', saveCapsule);
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  async function saveCapsule() {
    const title = document.getElementById('capsule-title').value.trim();
    const openDate = document.getElementById('capsule-date').value;
    const content = document.getElementById('capsule-content').value.trim();

    if (!title || !openDate || !content) {
      alert('Заповни назву, дату та текст листа');
      return;
    }

    const user = Auth.getCurrentUser();

    const { error } = await supabase.from('time_capsules').insert({
      title,
      content,
      open_date: openDate,
      created_by: user ? user.id : null
    });

    if (error) {
      console.error('Помилка збереження капсули:', error);
      alert('Не вдалось зберегти лист');
      return;
    }

    closeModal();
    refresh();
  }

  function init() {
    document.getElementById('add-capsule-btn').addEventListener('click', openAddModal);
    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'capsule') refresh();
    });
  }

  return { init, refresh };
})();
