// ============================================================
// SWIPE MODULE — Tinder для фільмів і серіалів
// TMDB API → свайп вгору/вліво/вправо → матч → media_items
// ============================================================

const Swipe = (() => {

  const TMDB_API_KEY = '1b28cacaab2f90a8c2bd0c383c636f01';
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMG  = 'https://image.tmdb.org/t/p/w500';

  let activeType = 'movie'; // 'movie' | 'series'
  let sessionId = null;
  let cards = [];
  let currentIndex = 0;
  let page = 1;

  // Touch/swipe стан
  let startX = 0;
  let startY = 0;
  let isDragging = false;
  let currentCard = null;

  // ---------- TMDB ----------
  async function fetchTmdb(endpoint) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(`${TMDB_BASE}${endpoint}${sep}api_key=${TMDB_API_KEY}&language=uk-UA`);
    return res.json();
  }

  async function loadCards() {
    const endpoint = activeType === 'movie'
      ? `/discover/movie?sort_by=popularity.desc&page=${page}`
      : `/discover/tv?sort_by=popularity.desc&page=${page}`;

    try {
      const data = await fetchTmdb(endpoint);
      if (!data.results) {
        console.error('TMDB response error:', data);
        return [];
      }
      const results = (data.results || []).map((item) => ({
        tmdb_id: item.id,
        title: item.title || item.name,
        overview: item.overview,
        poster_path: item.poster_path ? `${TMDB_IMG}${item.poster_path}` : null,
        year: (item.release_date || item.first_air_date || '').slice(0, 4),
        rating: item.vote_average?.toFixed(1),
      }));
      page++;
      return results;
    } catch (err) {
      console.error('loadCards error:', err);
      return [];
    }
  }

  // ---------- Сесія ----------
  async function getOrCreateSession() {
    if (sessionId) return sessionId;

    const { data, error } = await supabase
      .from('swipe_sessions')
      .insert({ type: activeType })
      .select('id')
      .single();

    if (error) throw error;
    sessionId = data.id;
    return data.id;
  }

  // ---------- Збереження свайпу ----------
  async function saveVote(card, direction) {
    const sid = await getOrCreateSession();
    const user = Auth.getCurrentUser();
    if (!user) return;

    // Зберігаємо голос
    await supabase.from('swipe_votes').upsert({
      session_id: sid,
      user_id: user.id,
      tmdb_id: card.tmdb_id,
      title: card.title,
      poster_path: card.poster_path,
      direction,
    }, { onConflict: 'session_id,user_id,tmdb_id' });

    if (direction === 'skip') return;

    // Перевіряємо матч (чи інший також свайпнув так само)
    const { data: votes } = await supabase
      .from('swipe_votes')
      .select('user_id, direction')
      .eq('session_id', sid)
      .eq('tmdb_id', card.tmdb_id)
      .neq('direction', 'skip');

    if (!votes || votes.length < 2) return;

    const dirs = votes.map((v) => v.direction);
    const isMatch = dirs[0] === dirs[1];

    if (isMatch) {
      await handleMatch(card, direction);
    }
  }

  async function handleMatch(card, direction) {
    // Додаємо в media_items якщо ще немає
    const mediaType = activeType === 'movie' ? 'movie' : 'series';
    const status = direction === 'up' ? 'done' : 'want';

    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('type', mediaType)
      .ilike('title', card.title)
      .maybeSingle();

    if (!existing) {
      await supabase.from('media_items').insert({
        type: mediaType,
        title: card.title,
        poster_url: card.poster_path,
        status,
      });
    }

    // Показати матч-повідомлення
    showMatchBanner(card, direction);
  }

  function showMatchBanner(card, direction) {
    const label = direction === 'up' ? 'Бачили! 🎉' : 'В планах! 📋';
    const banner = document.createElement('div');
    banner.className = 'swipe-match-banner';
    banner.innerHTML = `
      <div class="swipe-match-inner">
        <p class="swipe-match-emoji">💛</p>
        <p class="swipe-match-title">Матч!</p>
        <p class="swipe-match-subtitle">«${card.title}» — ${label}</p>
        <p class="swipe-match-note">Додано в список</p>
      </div>
    `;
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 3000);
  }

  // ---------- Рендер картки ----------
  function renderCard(card) {
    const el = document.createElement('div');
    el.className = 'swipe-card';
    el.dataset.tmdbId = String(card.tmdb_id);

    el.innerHTML = `
      ${card.poster_path
        ? `<img class="swipe-poster" src="${card.poster_path}" alt="${card.title}" loading="lazy">`
        : `<div class="swipe-poster-placeholder">🎬</div>`}
      <div class="swipe-card-info">
        <p class="swipe-card-title">${card.title}</p>
        <div class="swipe-card-meta">
          ${card.year ? `<span>${card.year}</span>` : ''}
          ${card.rating ? `<span>★ ${card.rating}</span>` : ''}
        </div>
        ${card.overview ? `<p class="swipe-card-overview">${card.overview.slice(0, 100)}${card.overview.length > 100 ? '…' : ''}</p>` : ''}
      </div>

      <div class="swipe-hint swipe-hint-up">👍 Бачили</div>
      <div class="swipe-hint swipe-hint-left">📋 Планую</div>
      <div class="swipe-hint swipe-hint-right">✕ Пропустити</div>
    `;

    attachTouchHandlers(el, card);
    return el;
  }

  // ---------- Touch/drag handlers ----------
  function attachTouchHandlers(el, card) {
    el.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
      currentCard = el;
      el.style.transition = 'none';
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      const rotate = dx * 0.08;

      el.style.transform = `translateX(${dx}px) translateY(${dy}px) rotate(${rotate}deg)`;

      // Показуємо hint залежно від напрямку
      el.querySelectorAll('.swipe-hint').forEach(h => h.style.opacity = '0');
      if (Math.abs(dy) > Math.abs(dx) && dy < -40) {
        el.querySelector('.swipe-hint-up').style.opacity = '1';
      } else if (dx < -40) {
        el.querySelector('.swipe-hint-left').style.opacity = '1';
      } else if (dx > 40) {
        el.querySelector('.swipe-hint-right').style.opacity = '1';
      }
    }, { passive: true });

    el.addEventListener('touchend', (e) => {
      if (!isDragging) return;
      isDragging = false;

      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;

      const THRESHOLD = 80;

      if (Math.abs(dy) > Math.abs(dx) && dy < -THRESHOLD) {
        flyOut(el, 'up', card);
      } else if (dx < -THRESHOLD) {
        flyOut(el, 'left', card);
      } else if (dx > THRESHOLD) {
        flyOut(el, 'skip', card);
      } else {
        // Повернути на місце
        el.style.transition = 'transform 0.3s ease';
        el.style.transform = '';
        el.querySelectorAll('.swipe-hint').forEach(h => h.style.opacity = '0');
      }
    }, { passive: true });

    // Кнопки під карткою
  }

  function flyOut(el, direction, card) {
    el.style.transition = 'transform 0.4s ease, opacity 0.4s ease';

    if (direction === 'up') {
      el.style.transform = 'translateY(-130%) rotate(-5deg)';
    } else if (direction === 'left') {
      el.style.transform = 'translateX(-140%) rotate(-20deg)';
    } else {
      el.style.transform = 'translateX(140%) rotate(20deg)';
    }

    el.style.opacity = '0';
    el.addEventListener('transitionend', () => el.remove(), { once: true });

    saveVote(card, direction);
    nextCard();
  }

  async function nextCard() {
    currentIndex++;
    if (currentIndex >= cards.length - 2) {
      // Підвантажуємо ще
      const more = await loadCards();
      cards = cards.concat(more);
      const stack = document.getElementById('swipe-stack');
      if (stack && more.length > 0) {
        const newCard = renderCard(more[0]);
        newCard.style.zIndex = '0';
        stack.insertBefore(newCard, stack.firstChild);
      }
    }
  }

  // ---------- Кнопки-дії ----------
  function bindActionButtons() {
    document.getElementById('swipe-btn-up')?.addEventListener('click', () => {
      const top = document.querySelector('#swipe-stack .swipe-card:last-child');
      if (top) {
        const card = cards[currentIndex];
        flyOut(top, 'up', card);
      }
    });
    document.getElementById('swipe-btn-left')?.addEventListener('click', () => {
      const top = document.querySelector('#swipe-stack .swipe-card:last-child');
      if (top) flyOut(top, 'left', cards[currentIndex]);
    });
    document.getElementById('swipe-btn-skip')?.addEventListener('click', () => {
      const top = document.querySelector('#swipe-stack .swipe-card:last-child');
      if (top) flyOut(top, 'skip', cards[currentIndex]);
    });
  }

  // ---------- Ініціалізація стека ----------
  async function initStack() {
    const stack = document.getElementById('swipe-stack');
    if (!stack) return;

    stack.innerHTML = '<p class="empty-state">Завантаження...</p>';

    try {
      page = 1;
      cards = await loadCards();
      currentIndex = 0;
      sessionId = null;

      if (!cards.length) {
        stack.innerHTML = '<p class="empty-state">Не вдалось завантажити фільми. Перевір з\'єднання.</p>';
        return;
      }

      stack.innerHTML = '';

      const preview = cards.slice(0, 3).reverse();
      preview.forEach((card, i) => {
        const el = renderCard(card);
        el.style.zIndex = String(i);
        stack.appendChild(el);
      });
    } catch (err) {
      console.error('Swipe initStack error:', err);
      stack.innerHTML = `<p class="empty-state">Помилка: ${err.message}</p>`;
    }
  }

  // ---------- Перемикання типу ----------
  function renderTypeTabs() {
    document.querySelectorAll('.swipe-type-btn').forEach(btn => {
      (btn).classList.toggle('active', (btn).dataset.swipeType === activeType);
    });
  }

  // ---------- Init ----------
  async function refresh() {
    renderTypeTabs();
    await initStack();
  }

  function init() {
    document.querySelectorAll('.swipe-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeType = (btn).dataset.swipeType || 'movie';
        refresh();
      });
    });

    bindActionButtons();

    window.addEventListener('portal:view', (e) => {
      if (e.detail.view === 'media') refresh();
    });
  }

  return { init, refresh };
})();
