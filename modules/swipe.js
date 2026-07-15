// SWIPE MODULE

const Swipe = (() => {

  // ---------- Константи ----------
  const TMDB_API_KEY = '1b28cacaab2f90a8c2bd0c383c636f01';
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

  // ---------- Стан ----------
  /** @type {SwipeType} */
  let activeType = 'movie';
  /** @type {SwipeCard[]} */
  let cards = [];
  let currentIndex = 0;
  let page = 1;
  let isLoading = false;
  let isRefilling = false; // guard: не дає швидким свайпам стартувати кілька TMDB-дозавантажень паралельно

  /** @param {ParentNode} root @param {string} sel @returns {HTMLElement} */
  function q(root, sel) {
    // Використовується лише для елементів, які щойно самі створили через innerHTML
    // (шаблон картки/модалки вище) — тому гарантовано присутні в DOM.
    return /** @type {HTMLElement} */ (root.querySelector(sel));
  }

  // ---------- TMDB ----------
  /** @param {string} endpoint @returns {Promise<any>} */
  async function fetchTmdb(endpoint) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(TMDB_BASE + endpoint + sep + 'api_key=' + TMDB_API_KEY + '&language=uk-UA');
    return res.json();
  }

  /** @returns {Promise<SwipeCard[]>} */
  async function loadCards() {
    const endpoint = activeType === 'movie'
      ? '/discover/movie?sort_by=popularity.desc&page=' + page
      : '/discover/tv?sort_by=popularity.desc&page=' + page;

    try {
      const data = await fetchTmdb(endpoint);
      if (!data.results) return [];
      page++;
      return data.results
        .filter(function(/** @type {any} */ item) {
          const title = item.title || item.name || '';
          // Фільтр ієрогліфів
          return !/[\u3000-\u9fff\uac00-\ud7af\u0600-\u06ff]/.test(title);
        })
        .map(function(/** @type {any} */ item) {
          return /** @type {SwipeCard} */ ({
            tmdb_id: item.id,
            title: item.title || item.name || '?',
            overview: item.overview || '',
            poster_path: item.poster_path ? TMDB_IMG + item.poster_path : null,
            year: (item.release_date || item.first_air_date || '').slice(0, 4),
            rating: item.vote_average ? item.vote_average.toFixed(1) : null,
          });
        });
    } catch (err) {
      console.error('loadCards error:', err);
      return [];
    }
  }

  // ---------- Supabase ----------
  /** @returns {Promise<number[]>} */
  async function getSwipedIds() {
    const user = Auth.getCurrentUser();
    if (!user) return [];
    const result = /** @type {SupaResult<Pick<SwipeCard, 'tmdb_id'>[]>} */ (await supabase
      .from('swipe_votes')
      .select('tmdb_id')
      .eq('user_id', user.id));
    return (result.data || []).map(function(r) { return r.tmdb_id; });
  }

  /** @param {SwipeCard} card @param {SwipeDirection} direction @returns {Promise<void>} */
  async function saveVote(card, direction) {
    const user = Auth.getCurrentUser();
    if (!user) return;

    await supabase.from('swipe_votes').upsert({
      user_id: user.id,
      tmdb_id: card.tmdb_id,
      title: card.title,
      poster_path: card.poster_path,
      direction: direction,
    }, { onConflict: 'user_id,tmdb_id' });

    if (direction === 'down') return; // down = Пропустити

    const mediaType = activeType === 'movie' ? 'movie' : 'series';
    // up=Подивились(done), right=Дивимось(watching), left=В планах(want), down=Пропустити(skip)
    const status = direction === 'up' ? 'done' : direction === 'right' ? 'watching' : 'want';

    const existing = /** @type {SupaResult<Pick<MediaItem, 'id'>>} */ (await supabase
      .from('media_items')
      .select('id')
      .eq('type', mediaType)
      .eq('title', card.title)
      .maybeSingle());

    if (!existing.data) {
      await supabase.from('media_items').insert({
        type: mediaType,
        title: card.title,
        poster_url: card.poster_path,
        status: status,
        created_by: user.id,
      });
      // Список медіа змінився — скидаємо кеш відповідного типу
      if (/** @type {any} */ (window).DataCache) DataCache.invalidate('media:' + mediaType);
    }

    // Оновлюємо список внизу тільки якщо вкладка media активна
    if (typeof Media !== 'undefined' && Media.refresh) {
      const stack = document.getElementById('swipe-stack');
      const mediaViewEl = document.getElementById('view-media');
      if (stack && mediaViewEl && !mediaViewEl.classList.contains('hidden')) {
        Media.refresh();
      }
    }
  }

  /** @param {string} str @returns {string} */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------- Модалка деталей ----------
  /** @param {SwipeCard} card @returns {Promise<void>} */
  async function openDetailModal(card) {
    const root = document.getElementById('modal-root');
    if (!root) return;
    const safeTitle = escapeHtml(card.title);
    const safeOverview = escapeHtml(card.overview);

    root.innerHTML =
      '<div class="modal-overlay" id="detail-overlay">' +
        '<div class="modal-card detail-modal">' +
          (card.poster_path ? '<img class="detail-poster" src="' + card.poster_path + '" alt="">' : '') +
          '<h3 class="detail-title">' + safeTitle + '</h3>' +
          '<div class="detail-meta">' +
            (card.year ? '<span>' + card.year + '</span>' : '') +
            (card.rating ? '<span>★ ' + card.rating + '</span>' : '') +
          '</div>' +
          (card.overview ? '<p class="detail-overview">' + safeOverview + '</p>' : '') +
          '<div id="detail-trailer"><p class="detail-no-trailer">⏳ Шукаємо трейлер...</p></div>' +
          '<div class="modal-actions">' +
            '<button class="btn-secondary" id="detail-close">Закрити</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    q(root, '#detail-close').addEventListener('click', closeDetailModal);
    q(root, '#detail-overlay').addEventListener('click', function(e) {
      if (/** @type {HTMLElement} */ (e.target).id === 'detail-overlay') closeDetailModal();
    });

    // Завантажуємо трейлер
    try {
      const typeStr = activeType === 'movie' ? 'movie' : 'tv';
      const vdata = await fetchTmdb('/' + typeStr + '/' + card.tmdb_id + '/videos');
      const trailerEl = document.getElementById('detail-trailer');
      if (!trailerEl) return;

      const trailer = (vdata.results || []).find(function(/** @type {any} */ v) {
        return v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser');
      });

      if (trailer) {
        trailerEl.innerHTML =
          '<div class="detail-player-wrap">' +
            '<iframe src="https://www.youtube.com/embed/' + trailer.key + '?rel=0" ' +
              'frameborder="0" allowfullscreen class="detail-player"></iframe>' +
          '</div>';
      } else {
        trailerEl.innerHTML = '<p class="detail-no-trailer">Трейлер не знайдено</p>';
      }
    } catch (e) {
      const el = document.getElementById('detail-trailer');
      if (el) el.innerHTML = '<p class="detail-no-trailer">Не вдалось завантажити трейлер</p>';
    }
  }

  function closeDetailModal() {
    const root = document.getElementById('modal-root');
    const iframe = root ? root.querySelector('iframe') : null;
    if (iframe) iframe.src = iframe.src; // зупинити відео
    if (root) root.innerHTML = '';
  }

  // ---------- Рендер картки ----------
  /** @param {SwipeCard} card @returns {HTMLElement} */
  function renderCard(card) {
    const el = document.createElement('div');
    el.className = 'swipe-card';

    let metaHtml = '';
    if (card.year) metaHtml += '<span>' + card.year + '</span>';
    if (card.rating) metaHtml += '<span>★ ' + card.rating + '</span>';

    el.innerHTML =
      (card.poster_path
        ? '<img class="swipe-poster" src="' + card.poster_path + '" loading="lazy">'
        : '<div class="swipe-poster-placeholder">🎬</div>') +
      '<div class="swipe-card-gradient"></div>' +
      '<div class="swipe-card-info">' +
        '<p class="swipe-card-title">' + escapeHtml(card.title) + '</p>' +
        '<div class="swipe-card-meta">' + metaHtml + '</div>' +
      '</div>' +
      '<div class="swipe-hints-wrap">' +
        '<div class="swipe-hint swipe-hint-up"><span class="swipe-hint-icon">✅</span> Подивились</div>' +
        '<div class="swipe-hint swipe-hint-down"><span class="swipe-hint-icon">✕</span> Пропустити</div>' +
        '<div class="swipe-hint swipe-hint-left"><span class="swipe-hint-icon">🕐</span> В планах</div>' +
        '<div class="swipe-hint swipe-hint-right"><span class="swipe-hint-icon">▶</span> Дивимось</div>' +
      '</div>' +
      '<div class="swipe-overlay swipe-overlay-up"></div>' +
      '<div class="swipe-overlay swipe-overlay-down"></div>' +
      '<div class="swipe-overlay swipe-overlay-left"></div>' +
      '<div class="swipe-overlay swipe-overlay-right"></div>';

    attachTouch(el, card);
    return el;
  }

  // ---------- Pointer events (миша + тач) ----------
  /** @param {HTMLElement} el @param {SwipeCard} card @returns {void} */
  function attachTouch(el, card) {
    let dragging = false;
    let moved    = false;
    let x0 = 0, y0 = 0;

    // Єдиний хелпер витягує координати з будь-якої події
    /** @param {any} e @returns {{x: number, y: number}} */
    function coords(e) {
      return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                       : { x: e.clientX,             y: e.clientY             };
    }
    /** @param {any} e @returns {{x: number, y: number}} */
    function endCoords(e) {
      return e.changedTouches ? { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY }
                              : { x: e.clientX,                    y: e.clientY                    };
    }

    /** @param {any} e @returns {void} */
    function onStart(e) {
      // Ігноруємо не-лівий клік мишки
      if (e.type === 'mousedown' && e.button !== 0) return;
      const c = coords(e);
      x0 = c.x; y0 = c.y;
      dragging = true;
      moved    = false;
      el.style.transition = 'none';
      el.style.zIndex = '10';
      // Для миші — слухаємо рух і відпускання на document
      if (e.type === 'mousedown') {
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onEnd);
      }
    }

    /** @param {any} e @returns {void} */
    function onMove(e) {
      if (!dragging) return;
      // Зупиняємо браузерний drag зображення
      if (e.type === 'mousemove') e.preventDefault();

      const c  = coords(e);
      const dx = c.x - x0;
      const dy = c.y - y0;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) moved = true;
      if (!moved) return;

      const rotate = Math.abs(dy) > Math.abs(dx) ? 0 : dx * 0.06;
      el.style.transform = 'translateX(' + dx + 'px) translateY(' + dy + 'px) rotate(' + rotate + 'deg)';

      // Ховаємо всі хінти та оверлеї
      el.querySelectorAll('.swipe-hint, .swipe-overlay').forEach(function(h) { /** @type {HTMLElement} */ (h).style.opacity = '0'; });

      const SHOW = 40;
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < -SHOW) {
          q(el, '.swipe-hint-up').style.opacity    = '1';
          q(el, '.swipe-overlay-up').style.opacity = String(Math.min(Math.abs(dy) / 150, 0.6));
        } else if (dy > SHOW) {
          q(el, '.swipe-hint-down').style.opacity    = '1';
          q(el, '.swipe-overlay-down').style.opacity = String(Math.min(dy / 150, 0.6));
        }
      } else {
        if (dx < -SHOW) {
          q(el, '.swipe-hint-left').style.opacity    = '1';
          q(el, '.swipe-overlay-left').style.opacity = String(Math.min(Math.abs(dx) / 150, 0.6));
        } else if (dx > SHOW) {
          q(el, '.swipe-hint-right').style.opacity    = '1';
          q(el, '.swipe-overlay-right').style.opacity = String(Math.min(dx / 150, 0.6));
        }
      }
    }

    /** @param {any} e @returns {void} */
    function onEnd(e) {
      if (!dragging) return;
      dragging = false;
      // Знімаємо document-слухачі (тільки для миші)
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup',   onEnd);

      const c  = endCoords(e);
      const dx = c.x - x0;
      const dy = c.y - y0;
      const T  = 80;

      if (!moved) {
        el.style.transition = 'transform 0.3s ease';
        el.style.transform  = '';
        openDetailModal(card);
        return;
      }

      if (Math.abs(dy) > Math.abs(dx)) {
        if      (dy < -T) flyOut(el, 'up',   card);
        else if (dy >  T) flyOut(el, 'down', card);
        else              resetCard(el);
      } else {
        if      (dx < -T) flyOut(el, 'left',  card);
        else if (dx >  T) flyOut(el, 'right', card);
        else              resetCard(el);
      }
    }

    // Touch
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove',  onMove,  { passive: true });
    el.addEventListener('touchend',   onEnd,   { passive: true });

    // Mouse
    el.addEventListener('mousedown', onStart);

    // Блокуємо браузерний drag зображень на картці
    el.addEventListener('dragstart', function(e) { e.preventDefault(); });
  }

  /** @param {HTMLElement} stack @returns {void} */
  function updateStackPositions(stack) {
    const allCards = stack.querySelectorAll('.swipe-card');
    const total = allCards.length;
    allCards.forEach(function(card, i) {
      const fromTop = total - 1 - i; // 0 = верхня картка
      const cardEl = /** @type {HTMLElement} */ (card);
      cardEl.style.zIndex = String(i);
      if (fromTop === 0) {
        cardEl.style.transform = '';
        cardEl.style.transition = 'transform 0.3s ease';
      } else if (fromTop === 1) {
        cardEl.style.transform = 'scale(0.95) translateY(10px)';
        cardEl.style.transition = 'transform 0.3s ease';
      } else {
        cardEl.style.transform = 'scale(0.90) translateY(20px)';
        cardEl.style.transition = 'transform 0.3s ease';
      }
    });
  }

  /** @param {HTMLElement} el @returns {void} */
  function resetCard(el) {
    el.style.transition = 'transform 0.3s ease';
    el.style.transform = '';
    el.querySelectorAll('.swipe-hint, .swipe-overlay').forEach(function(h) { /** @type {HTMLElement} */ (h).style.opacity = '0'; });
  }

  /** @param {HTMLElement} el @param {SwipeDirection} direction @param {SwipeCard} card @returns {void} */
  function flyOut(el, direction, card) {
    el.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    if (direction === 'up')    el.style.transform = 'translateY(-130%) rotate(-3deg)';
    else if (direction === 'down') el.style.transform = 'translateY(130%) rotate(3deg)';
    else if (direction === 'left') el.style.transform = 'translateX(-140%) rotate(-20deg)';
    else                       el.style.transform = 'translateX(140%) rotate(20deg)';
    el.style.opacity = '0';

    const stack = el.parentNode;
    el.addEventListener('transitionend', function() {
      el.remove();
      if (stack) updateStackPositions(/** @type {HTMLElement} */ (stack));
    }, { once: true });

    saveVote(card, direction);
    addNextCard();
  }

  /** @returns {Promise<void>} */
  async function addNextCard() {
    currentIndex++;

    // Дозавантаження з захистом від паралельних запитів: при швидких свайпах
    // кілька addNextCard підряд не повинні стартувати кілька TMDB-запитів одночасно
    // (інакше page++ проскакує сторінки й марно палить запити).
    if (currentIndex + 5 >= cards.length && !isRefilling) {
      isRefilling = true;
      try {
        const more = await loadCards();
        if (more.length) cards = cards.concat(more);
      } finally {
        isRefilling = false;
      }
    }

    const stack = document.getElementById('swipe-stack');
    if (!stack) return;

    const inStack = stack.querySelectorAll('.swipe-card').length;
    const toAdd = 3 - inStack;

    for (let i = 0; i < toAdd; i++) {
      const idx = currentIndex + inStack + i;
      if (idx < cards.length) {
        const el = renderCard(cards[idx]);
        // Ставимо нову картку знизу стека без анімації
        el.style.transform = 'scale(0.90) translateY(20px)';
        el.style.zIndex = '0';
        stack.insertBefore(el, stack.firstChild);
      }
    }

    updateStackPositions(stack);
  }

  /** @returns {Promise<void>} */
  async function initStack() {
    if (isLoading) return;
    isLoading = true;

    const stack = document.getElementById('swipe-stack');
    if (!stack) { isLoading = false; return; }

    stack.innerHTML = '<p class="empty-state">Завантаження...</p>';

    try {
      page = Math.floor(Math.random() * 50) + 1; // випадкова сторінка з перших 50
      currentIndex = 0;
      cards = [];

      const swipedIds = await getSwipedIds();

      let attempts = 0;
      while (cards.length < 15 && attempts < 12) {
        attempts++;
        const batch = await loadCards();
        if (!batch.length) {
          page = Math.floor(Math.random() * 100) + 1;
          continue;
        }
        const fresh = batch.filter(function(c) {
          return swipedIds.indexOf(c.tmdb_id) === -1;
        });
        cards = cards.concat(fresh);
      }

      if (!cards.length) {
        stack.innerHTML = '<p class="empty-state">Скинь історію щоб побачити фільми знову</p>';
        return;
      }

      stack.innerHTML = '';
      cards.slice(0, 3).reverse().forEach(function(card, i) {
        const el = renderCard(card);
        el.style.zIndex = String(i);
        stack.appendChild(el);
      });
      updateStackPositions(stack);

    } catch (err) {
      console.error('initStack error:', err);
      if (stack) stack.innerHTML = '<p class="empty-state">Помилка завантаження</p>';
    } finally {
      isLoading = false;
    }
  }

  function renderTypeTabs() {
    document.querySelectorAll('.swipe-type-btn').forEach(function(btn) {
      const btnEl = /** @type {HTMLElement} */ (btn);
      btnEl.classList.toggle('active', btnEl.dataset.swipeType === activeType);
    });
  }

  /** @returns {Promise<void>} */
  async function refresh() {
    const stack = document.getElementById('swipe-stack');
    if (stack && stack.querySelector('.swipe-card')) return;
    renderTypeTabs();
    await initStack();
  }

  function init() {
    document.querySelectorAll('.swipe-type-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeType = /** @type {SwipeType} */ (/** @type {HTMLElement} */ (btn).dataset.swipeType || 'movie');
        isLoading = false;
        renderTypeTabs();
        initStack();
      });
    });

    window.addEventListener('portal:auth', function() {
      isLoading = false;
      cards = [];
    });

    // Стек НЕ вантажиться при вході у «Вотчліст» — панель свайпу
    // за замовчуванням згорнута, тож TMDB-запити (до 12 сторінок)
    // робимо лише коли юзер реально відкриває панель:
    // Media.bindSwipeToggle → Swipe.refresh().
  }

  return { init: init, refresh: refresh };

})();
