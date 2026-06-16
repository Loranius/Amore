// SWIPE MODULE — Tinder для фільмів і серіалів

const Swipe = (() => {

  const TMDB_API_KEY = '1b28cacaab2f90a8c2bd0c383c636f01';
  const TMDB_BASE = 'https://api.themoviedb.org/3';
  const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

  let activeType = 'movie';
  let sessionId = null;
  let cards = [];
  let currentIndex = 0;
  let page = 1;
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  // ---------- TMDB ----------
  async function fetchTmdb(endpoint) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const url = `${TMDB_BASE}${endpoint}${sep}api_key=${TMDB_API_KEY}&language=uk-UA`;
    const res = await fetch(url);
    return res.json();
  }

  async function loadCards() {
    const endpoint = activeType === 'movie'
      ? `/discover/movie?sort_by=popularity.desc&page=${page}`
      : `/discover/tv?sort_by=popularity.desc&page=${page}`;

    try {
      const data = await fetchTmdb(endpoint);
      if (!data.results) {
        console.error('TMDB error:', data);
        return [];
      }
      page++;
      return data.results.map(function(item) {
        return {
          tmdb_id: item.id,
          title: item.title || item.name || '?',
          overview: item.overview || '',
          poster_path: item.poster_path ? (TMDB_IMG + item.poster_path) : null,
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
    const user = Auth.getCurrentUser();
    if (!user) return [];
    const { data } = await supabase
      .from('swipe_votes')
      .select('tmdb_id')
      .eq('user_id', user.id);
    return (data || []).map(function(r) { return r.tmdb_id; });
  }

  async function saveVote(card, direction) {
    const user = Auth.getCurrentUser();
    if (!user) return;

    await supabase.from('swipe_votes').upsert({
      user_id: user.id,
      tmdb_id: card.tmdb_id,
      title: card.title,
      poster_path: card.poster_path,
      direction: direction,
      session_id: null,
    }, { onConflict: 'user_id,tmdb_id' });

    if (direction === 'skip') return;

    const mediaType = activeType === 'movie' ? 'movie' : 'series';
    // вниз = дивимось (watching), вгору = переглянуто (done), вліво = плануємо (want)
    var status = direction === 'down' ? 'watching' : direction === 'up' ? 'done' : 'want';

    const { data: existing } = await supabase
      .from('media_items')
      .select('id')
      .eq('type', mediaType)
      .eq('title', card.title)
      .maybeSingle();

    if (!existing) {
      await supabase.from('media_items').insert({
        type: mediaType,
        title: card.title,
        poster_url: card.poster_path,
        status: status,
        created_by: user.id,
      });
    }
  }

  // ---------- Деталі фільму + трейлер ----------
  async function openDetailModal(card) {
    var root = document.getElementById('modal-root');

    // Показуємо модалку одразу з базовою інфою
    root.innerHTML =
      '<div class="modal-overlay" id="detail-modal-overlay">' +
        '<div class="modal-card detail-modal">' +
          (card.poster_path
            ? '<img class="detail-poster" src="' + card.poster_path + '" alt="' + card.title + '">'
            : '') +
          '<h3 class="detail-title">' + card.title + '</h3>' +
          '<div class="detail-meta">' +
            (card.year ? '<span>' + card.year + '</span>' : '') +
            (card.rating ? '<span>★ ' + card.rating + '</span>' : '') +
          '</div>' +
          (card.overview ? '<p class="detail-overview">' + card.overview + '</p>' : '') +
          '<div id="detail-trailer">⏳ Шукаємо трейлер...</div>' +
          '<div class="modal-actions">' +
            '<button class="btn-secondary" id="detail-close">Закрити</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('detail-close').addEventListener('click', closeDetailModal);
    document.getElementById('detail-modal-overlay').addEventListener('click', function(e) {
      if (e.target.id === 'detail-modal-overlay') closeDetailModal();
    });

    // Підвантажуємо трейлер
    try {
      var typeEndpoint = activeType === 'movie' ? 'movie' : 'tv';
      var sep = '?';
      var url = TMDB_BASE + '/' + typeEndpoint + '/' + card.tmdb_id + '/videos' + sep + 'api_key=' + TMDB_API_KEY;
      var res = await fetch(url);
      var data = await res.json();
      var trailerEl = document.getElementById('detail-trailer');
      if (!trailerEl) return;

      var trailer = (data.results || []).find(function(v) {
        return v.site === 'YouTube' && (v.type === 'Trailer' || v.type === 'Teaser');
      });

      if (trailer) {
        trailerEl.innerHTML =
          '<div class="detail-player-wrap">' +
            '<iframe ' +
              'src="https://www.youtube.com/embed/' + trailer.key + '?autoplay=0&rel=0" ' +
              'frameborder="0" ' +
              'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" ' +
              'allowfullscreen ' +
              'class="detail-player">' +
            '</iframe>' +
          '</div>';
      } else {
        trailerEl.innerHTML = '<p class="detail-no-trailer">Трейлер не знайдено</p>';
      }
    } catch (err) {
      var trailerEl2 = document.getElementById('detail-trailer');
      if (trailerEl2) trailerEl2.innerHTML = '<p class="detail-no-trailer">Не вдалось завантажити трейлер</p>';
    }
  }

  function closeDetailModal() {
    var root = document.getElementById('modal-root');
    // Зупиняємо відео перед закриттям
    var iframe = root.querySelector('iframe');
    if (iframe) iframe.src = iframe.src;
    root.innerHTML = '';
  }
  function renderCard(card) {
    var el = document.createElement('div');
    el.className = 'swipe-card';

    var posterHtml = card.poster_path
      ? '<img class="swipe-poster" src="' + card.poster_path + '" alt="' + card.title + '" loading="lazy">'
      : '<div class="swipe-poster-placeholder">🎬</div>';

    var metaHtml = '';
    if (card.year) metaHtml += '<span>' + card.year + '</span>';
    if (card.rating) metaHtml += '<span>★ ' + card.rating + '</span>';

    var overviewHtml = '';
    if (card.overview) {
      var short = card.overview.length > 100 ? card.overview.slice(0, 100) + '…' : card.overview;
      overviewHtml = '<p class="swipe-card-overview">' + short + '</p>';
    }

    el.innerHTML =
      posterHtml +
      '<div class="swipe-card-info">' +
        '<p class="swipe-card-title">' + card.title + '</p>' +
        '<div class="swipe-card-meta">' + metaHtml + '</div>' +
        overviewHtml +
      '</div>' +
      '<div class="swipe-hint swipe-hint-up">✅ Переглянуто</div>' +
      '<div class="swipe-hint swipe-hint-down">▶ Дивимось</div>' +
      '<div class="swipe-hint swipe-hint-left">📋 Плануємо</div>' +
      '<div class="swipe-hint swipe-hint-right">✕ Пропустити</div>';

    attachTouch(el, card);
    return el;
  }

  function attachTouch(el, card) {
    var didDrag = false;

    el.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
      didDrag = false;
      el.style.transition = 'none';
    }, { passive: true });

    el.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      // Поріг 15px для визначення drag (щоб тап відпрацьовував)
      if (Math.abs(dx) > 15 || Math.abs(dy) > 15) didDrag = true;

      var rotate = Math.abs(dy) > Math.abs(dx) ? 0 : dx * 0.06;
      el.style.transform = 'translateX(' + dx + 'px) translateY(' + dy + 'px) rotate(' + rotate + 'deg)';

      el.querySelectorAll('.swipe-hint').forEach(function(h) { h.style.opacity = '0'; });
      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < -40) {
          el.querySelector('.swipe-hint-up').style.opacity = '1';
        } else if (dy > 40) {
          el.querySelector('.swipe-hint-down').style.opacity = '1';
        }
      } else {
        if (dx < -40) {
          el.querySelector('.swipe-hint-left').style.opacity = '1';
        } else if (dx > 40) {
          el.querySelector('.swipe-hint-right').style.opacity = '1';
        }
      }
    }, { passive: true });

    el.addEventListener('touchend', function(e) {
      if (!isDragging) return;
      isDragging = false;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      var THRESHOLD = 80;

      if (!didDrag) {
        // Чистий тап — відкрити деталі
        el.style.transition = 'transform 0.3s ease';
        el.style.transform = '';
        openDetailModal(card);
        return;
      }

      if (Math.abs(dy) > Math.abs(dx)) {
        if (dy < -THRESHOLD) {
          flyOut(el, 'up', card);   // вгору = переглянуто
        } else if (dy > THRESHOLD) {
          flyOut(el, 'down', card); // вниз = дивимось
        } else {
          resetCard(el);
        }
      } else {
        if (dx < -THRESHOLD) {
          flyOut(el, 'left', card); // вліво = планую
        } else if (dx > THRESHOLD) {
          flyOut(el, 'skip', card); // вправо = пропустити
        } else {
          resetCard(el);
        }
      }
    }, { passive: true });
  }

  function resetCard(el) {
    el.style.transition = 'transform 0.3s ease';
    el.style.transform = '';
    el.querySelectorAll('.swipe-hint').forEach(function(h) { h.style.opacity = '0'; });
  }

  function flyOut(el, direction, card) {
    el.style.transition = 'transform 0.4s ease, opacity 0.4s ease';
    if (direction === 'up') {
      el.style.transform = 'translateY(-130%) rotate(-3deg)';
    } else if (direction === 'down') {
      el.style.transform = 'translateY(130%) rotate(3deg)';
    } else if (direction === 'left') {
      el.style.transform = 'translateX(-140%) rotate(-20deg)';
    } else {
      el.style.transform = 'translateX(140%) rotate(20deg)';
    }
    el.style.opacity = '0';
    el.addEventListener('transitionend', function() { el.remove(); }, { once: true });
    saveVote(card, direction);
    nextCard();
  }

  async function nextCard() {
    currentIndex++;
    if (currentIndex >= cards.length - 2) {
      var more = await loadCards();
      cards = cards.concat(more);
      var stack = document.getElementById('swipe-stack');
      if (stack && more.length > 0) {
        var newEl = renderCard(more[0]);
        newEl.style.zIndex = '0';
        stack.insertBefore(newEl, stack.firstChild);
      }
    }
  }

  // ---------- Кнопки ----------
  function bindActionButtons() {
    var btnUp   = document.getElementById('swipe-btn-up');
    var btnDown = document.getElementById('swipe-btn-down');
    var btnLeft = document.getElementById('swipe-btn-left');
    var btnSkip = document.getElementById('swipe-btn-skip');

    function topCard() {
      return document.querySelector('#swipe-stack .swipe-card:last-child');
    }

    if (btnUp)   btnUp.addEventListener('click',   function() { var t = topCard(); if (t && cards[currentIndex]) flyOut(t, 'up',   cards[currentIndex]); });
    if (btnDown) btnDown.addEventListener('click',  function() { var t = topCard(); if (t && cards[currentIndex]) flyOut(t, 'down', cards[currentIndex]); });
    if (btnLeft) btnLeft.addEventListener('click',  function() { var t = topCard(); if (t && cards[currentIndex]) flyOut(t, 'left', cards[currentIndex]); });
    if (btnSkip) btnSkip.addEventListener('click',  function() { var t = topCard(); if (t && cards[currentIndex]) flyOut(t, 'skip', cards[currentIndex]); });
  }

  // ---------- Стек ----------
  async function initStack() {
    if (isLoading) return;
    isLoading = true;

    var stack = document.getElementById('swipe-stack');
    if (!stack) { isLoading = false; return; }

    stack.innerHTML = '<p class="empty-state">Завантаження...</p>';

    try {
      page = 1;
      var swipedIds = await getSwipedIds();
      cards = [];

      // Завантажуємо поки не наберемо 10 нових карток
      while (cards.length < 10) {
        var batch = await loadCards();
        if (!batch.length) break;
        var fresh = batch.filter(function(c) {
          return swipedIds.indexOf(c.tmdb_id) === -1;
        });
        cards = cards.concat(fresh);
      }

      currentIndex = 0;

      if (!cards.length) {
        stack.innerHTML = '<p class="empty-state">Всі фільми переглянуто!</p>';
        return;
      }

      stack.innerHTML = '';
      var preview = cards.slice(0, 3).reverse();
      preview.forEach(function(card, i) {
        var el = renderCard(card);
        el.style.zIndex = String(i);
        stack.appendChild(el);
      });
    } catch (err) {
      console.error('initStack error:', err);
      if (stack) stack.innerHTML = '<p class="empty-state">Помилка: ' + err.message + '</p>';
    } finally {
      isLoading = false;
    }
  }

  // ---------- Таби ----------
  function renderTypeTabs() {
    document.querySelectorAll('.swipe-type-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.swipeType === activeType);
    });
  }

  async function refresh() {
    var stack = document.getElementById('swipe-stack');
    // Не перезавантажуємо якщо картки вже є
    if (stack && stack.querySelector('.swipe-card')) return;
    renderTypeTabs();
    await initStack();
  }

  let initialized = false;
  let isLoading = false;

  function init() {
    document.querySelectorAll('.swipe-type-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeType = btn.dataset.swipeType || 'movie';
        initialized = false;
        isLoading = false;
        renderTypeTabs();
        initStack();
      });
    });

    bindActionButtons();

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
