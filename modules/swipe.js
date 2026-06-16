// SWIPE MODULE

const Swipe = (() => {

  // ---------- Константи ----------
  const TMDB_API_KEY = '1b28cacaab2f90a8c2bd0c383c636f01';
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

  // ---------- Стан ----------
  var activeType = 'movie';
  var cards = [];
  var currentIndex = 0;
  var page = 1;
  var isLoading = false;
  var initialized = false;

  // ---------- TMDB ----------
  async function fetchTmdb(endpoint) {
    var sep = endpoint.includes('?') ? '&' : '?';
    var res = await fetch(TMDB_BASE + endpoint + sep + 'api_key=' + TMDB_API_KEY + '&language=uk-UA');
    return res.json();
  }

  async function loadCards() {
    var endpoint = activeType === 'movie'
      ? '/discover/movie?sort_by=popularity.desc&page=' + page
      : '/discover/tv?sort_by=popularity.desc&page=' + page;

    try {
      var data = await fetchTmdb(endpoint);
      if (!data.results) return [];
      page++;
      return data.results
        .filter(function(item) {
          var title = item.title || item.name || '';
          // Фільтр ієрогліфів
          return !/[\u3000-\u9fff\uac00-\ud7af\u0600-\u06ff]/.test(title);
        })
        .map(function(item) {
          return {
            tmdb_id: item.id,
            title: item.title || item.name || '?',
            overview: item.overview || '',
            poster_path: item.poster_path ? TMDB_IMG + item.poster_path : null,
            year: (item.release_date || item.first_air_date || '').slice(0, 4),
            rating: item.vote_average ? item.vote_average.toFixed(1) : null,
          };
        });
    } catch (err) {
      console.error('loadCards error:', err);
      return [];
    }
  }

  // ---------- Supabase ----------
  async function getSwipedIds() {
    var user = Auth.getCurrentUser();
    if (!user) return [];
    var result = await supabase
      .from('swipe_votes')
      .select('tmdb_id')
      .eq('user_id', user.id);
    return (result.data || []).map(function(r) { return r.tmdb_id; });
  }

  async function saveVote(card, direction) {
    var user = Auth.getCurrentUser();
    if (!user) return;

    await supabase.from('swipe_votes').upsert({
      user_id: user.id,
      tmdb_id: card.tmdb_id,
      title: card.title,
      poster_path: card.poster_path,
      direction: direction,
    }, { onConflict: 'user_id,tmdb_id' });

    if (direction === 'skip') return;

    var mediaType = activeType === 'movie' ? 'movie' : 'series';
    var status = direction === 'up' ? 'done' : direction === 'down' ? 'watching' : 'want';

    var existing = await supabase
      .from('media_items')
      .select('id')
      .eq('type', mediaType)
      .eq('title', card.title)
      .maybeSingle();

    if (!existing.data) {
      await supabase.from('media_items').insert({
        type: mediaType,
        title: card.title,
        poster_url: card.poster_path,
        status: status,
        created_by: user.id,
      });
    }

    // Оновлюємо список внизу тільки якщо вкладка media активна
    if (typeof Media !== 'undefined' && Media.refresh) {
      var stack = document.getElementById('swipe-stack');
      if (stack && document.getElementById('view-media') &&
          !document.getElementById('view-media').classList.contains('hidden')) {
        Media.refresh();
      }
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---------- Модалка деталей ----------
  async function openDetailModal(card) {
    var root = document.getElementById('modal-root');
    var safeTitle = escapeHtml(card.title);
    var safeOverview = escapeHtml(card.overview);

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

    document.getElementById('detail-close').addEventListener('click', closeDetailModal);
    document.getElementById('detail-overlay').addEventListener('click', function(e) {
      if (e.target.id === 'detail-overlay') closeDetailModal();
    });

    // Завантажуємо трейлер
    try {
      var typeStr = activeType === 'movie' ? 'movie' : 'tv';
      var vdata = await fetchTmdb('/' + typeStr + '/' + card.tmdb_id + '/videos');
      var trailerEl = document.getElementById('detail-trailer');
      if (!trailerEl) return;

      var trailer = (vdata.results || []).find(function(v) {
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
      var el = document.getElementById('detail-trailer');
      if (el) el.innerHTML = '<p class="detail-no-trailer">Не вдалось завантажити трейлер</p>';
    }
  }

  function closeDetailModal() {
    var root = document.getElementById('modal-root');
    var iframe = root ? root.querySelector('iframe') : null;
    if (iframe) iframe.src = iframe.src; // зупинити відео
    if (root) root.innerHTML = '';
  }

  // ---------- Рендер картки ----------
  function renderCard(card) {
    var el = document.createElement('div');
    el.className = 'swipe-card';

    var metaHtml = '';
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
      '<div class="swipe-hint swipe-hint-up"><span class="swipe-hint-icon">✅</span> Переглянуто</div>' +
      '<div class="swipe-hint swipe-hint-down"><span class="swipe-hint-icon">▶</span> Дивимось</div>' +
      '<div class="swipe-hint swipe-hint-left"><span class="swipe-hint-icon">📋</span> Плануємо</div>' +
      '<div class="swipe-hint swipe-hint-right"><span class="swipe-hint-icon">✕</span> Пропустити</div>' +
      '<div class="swipe-overlay swipe-overlay-up"></div>' +
      '<div class="swipe-overlay swipe-overlay-down"></div>' +
      '<div class="swipe-overlay swipe-overlay-left"></div>' +
      '<div class="swipe-overlay swipe-overlay-right"></div>';

    attachTouch(el, card);
    return el;
  }

  // ---------- Touch ----------
  function attachTouch(el, card) {
    var dragging = false;
    var moved = false;
    var x0 = 0;
    var y0 = 0;

    el.addEventListener('touchstart', function(e) {
      x0 = e.touches[0].clientX;
      y0 = e.touches[0].clientY;
      dragging = true;
      moved = false;
      el.style.transition = 'none';
      el.style.zIndex = '10'; // підіймаємо над іншими під час свайпу
    }, { passive: true });

    el.addEventListener('touchmove', function(e) {
      if (!dragging) return;
      var dx = e.touches[0].clientX - x0;
      var dy = e.touches[0].clientY - y0;
      if (Math.abs(dx) > 15 || Math.abs(dy) > 15) moved = true;
      if (!moved) return;

      var rotate = Math.abs(dy) > Math.abs(dx) ? 0 : dx * 0.06;
      el.style.transform = 'translateX(' + dx + 'px) translateY(' + dy + 'px) rotate(' + rotate + 'deg)';

      // Сховати всі оверлеї і хінти
      el.querySelectorAll('.swipe-hint, .swipe-overlay').forEach(function(h) { h.style.opacity = '0'; });

      var SHOW = 40;
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < -SHOW) {
          el.querySelector('.swipe-hint-up').style.opacity = '1';
          el.querySelector('.swipe-overlay-up').style.opacity = String(Math.min(Math.abs(dy) / 150, 0.6));
        } else if (dy > SHOW) {
          el.querySelector('.swipe-hint-down').style.opacity = '1';
          el.querySelector('.swipe-overlay-down').style.opacity = String(Math.min(dy / 150, 0.6));
        }
      } else {
        if (dx < -SHOW) {
          el.querySelector('.swipe-hint-left').style.opacity = '1';
          el.querySelector('.swipe-overlay-left').style.opacity = String(Math.min(Math.abs(dx) / 150, 0.6));
        } else if (dx > SHOW) {
          el.querySelector('.swipe-hint-right').style.opacity = '1';
          el.querySelector('.swipe-overlay-right').style.opacity = String(Math.min(dx / 150, 0.6));
        }
      }
    }, { passive: true });

    el.addEventListener('touchend', function(e) {
      if (!dragging) return;
      dragging = false;

      var dx = e.changedTouches[0].clientX - x0;
      var dy = e.changedTouches[0].clientY - y0;
      var T = 80;

      if (!moved) {
        el.style.transition = 'transform 0.3s ease';
        el.style.transform = '';
        openDetailModal(card);
        return;
      }

      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < -T) flyOut(el, 'up', card);
        else if (dy > T) flyOut(el, 'down', card);
        else resetCard(el);
      } else {
        if (dx < -T) flyOut(el, 'left', card);
        else if (dx > T) flyOut(el, 'skip', card);
        else resetCard(el);
      }
    }, { passive: true });
  }

  function updateStackPositions(stack) {
    var allCards = stack.querySelectorAll('.swipe-card');
    var total = allCards.length;
    allCards.forEach(function(card, i) {
      var fromTop = total - 1 - i; // 0 = верхня картка
      card.style.zIndex = String(i);
      if (fromTop === 0) {
        card.style.transform = '';
        card.style.transition = 'transform 0.3s ease';
      } else if (fromTop === 1) {
        card.style.transform = 'scale(0.95) translateY(10px)';
        card.style.transition = 'transform 0.3s ease';
      } else {
        card.style.transform = 'scale(0.90) translateY(20px)';
        card.style.transition = 'transform 0.3s ease';
      }
    });
  }

  function resetCard(el) {
    el.style.transition = 'transform 0.3s ease';
    el.style.transform = '';
    el.querySelectorAll('.swipe-hint, .swipe-overlay').forEach(function(h) { h.style.opacity = '0'; });
  }

  function flyOut(el, direction, card) {
    el.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    if (direction === 'up')    el.style.transform = 'translateY(-130%) rotate(-3deg)';
    else if (direction === 'down') el.style.transform = 'translateY(130%) rotate(3deg)';
    else if (direction === 'left') el.style.transform = 'translateX(-140%) rotate(-20deg)';
    else                       el.style.transform = 'translateX(140%) rotate(20deg)';
    el.style.opacity = '0';

    var stack = el.parentNode;
    el.addEventListener('transitionend', function() {
      el.remove();
      if (stack) updateStackPositions(stack);
    }, { once: true });

    saveVote(card, direction);
    addNextCard();
  }

  async function addNextCard() {
    currentIndex++;

    if (currentIndex + 5 >= cards.length) {
      var more = await loadCards();
      if (more.length) cards = cards.concat(more);
    }

    var stack = document.getElementById('swipe-stack');
    if (!stack) return;

    var inStack = stack.querySelectorAll('.swipe-card').length;
    var toAdd = 3 - inStack;

    for (var i = 0; i < toAdd; i++) {
      var idx = currentIndex + inStack + i;
      if (idx < cards.length) {
        var el = renderCard(cards[idx]);
        // Ставимо нову картку знизу стека без анімації
        el.style.transform = 'scale(0.90) translateY(20px)';
        el.style.zIndex = '0';
        stack.insertBefore(el, stack.firstChild);
      }
    }

    updateStackPositions(stack);
  }

  // ---------- Кнопки ----------
  function bindButtons() {
    function top() { return document.querySelector('#swipe-stack .swipe-card:last-child'); }
    function cur() { return cards[currentIndex]; }

    var u = document.getElementById('swipe-btn-up');
    var d = document.getElementById('swipe-btn-down');
    var l = document.getElementById('swipe-btn-left');
    var s = document.getElementById('swipe-btn-skip');

    if (u) u.addEventListener('click', function() { var t = top(); if (t && cur()) flyOut(t, 'up',   cur()); });
    if (d) d.addEventListener('click', function() { var t = top(); if (t && cur()) flyOut(t, 'down', cur()); });
    if (l) l.addEventListener('click', function() { var t = top(); if (t && cur()) flyOut(t, 'left', cur()); });
    if (s) s.addEventListener('click', function() { var t = top(); if (t && cur()) flyOut(t, 'skip', cur()); });
  }

  // ---------- Стек ----------
  async function initStack() {
    if (isLoading) return;
    isLoading = true;

    var stack = document.getElementById('swipe-stack');
    if (!stack) { isLoading = false; return; }

    stack.innerHTML = '<p class="empty-state">Завантаження...</p>';

    try {
      page = Math.floor(Math.random() * 50) + 1; // випадкова сторінка з перших 50
      currentIndex = 0;
      cards = [];

      var swipedIds = await getSwipedIds();

      var attempts = 0;
      while (cards.length < 15 && attempts < 12) {
        attempts++;
        var batch = await loadCards();
        if (!batch.length) {
          page = Math.floor(Math.random() * 100) + 1;
          continue;
        }
        var fresh = batch.filter(function(c) {
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
        var el = renderCard(card);
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
      btn.classList.toggle('active', btn.dataset.swipeType === activeType);
    });
  }

  async function refresh() {
    var stack = document.getElementById('swipe-stack');
    if (stack && stack.querySelector('.swipe-card')) return;
    renderTypeTabs();
    await initStack();
  }

  function init() {
    document.querySelectorAll('.swipe-type-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeType = btn.dataset.swipeType || 'movie';
        isLoading = false;
        initialized = false;
        renderTypeTabs();
        initStack();
      });
    });

    bindButtons();

    window.addEventListener('portal:auth', function() {
      initialized = false;
      isLoading = false;
      cards = [];
    });

    window.addEventListener('portal:view', function(e) {
      if (e.detail.view === 'media') {
        if (!initialized) {
          initialized = true;
          refresh();
        }
      }
    });
  }

  return { init: init, refresh: refresh };

})();
