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

    // Зберігаємо голос
    await supabase.from('swipe_votes').upsert({
      user_id: user.id,
      tmdb_id: card.tmdb_id,
      title: card.title,
      poster_path: card.poster_path,
      direction: direction,
      session_id: null,
    }, { onConflict: 'user_id,tmdb_id' });

    if (direction === 'skip') return;

    // Одразу додаємо в список
    const mediaType = activeType === 'movie' ? 'movie' : 'series';
    const status = direction === 'up' ? 'done' : 'want';

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

  // ---------- Картка ----------
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
      '<div class="swipe-hint swipe-hint-up">👍 Бачили</div>' +
      '<div class="swipe-hint swipe-hint-left">📋 Планую</div>' +
      '<div class="swipe-hint swipe-hint-right">✕ Пропустити</div>';

    attachTouch(el, card);
    return el;
  }

  function attachTouch(el, card) {
    el.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isDragging = true;
      el.style.transition = 'none';
    }, { passive: true });

    el.addEventListener('touchmove', function(e) {
      if (!isDragging) return;
      var dx = e.touches[0].clientX - startX;
      var dy = e.touches[0].clientY - startY;
      el.style.transform = 'translateX(' + dx + 'px) translateY(' + dy + 'px) rotate(' + (dx * 0.08) + 'deg)';

      el.querySelectorAll('.swipe-hint').forEach(function(h) { h.style.opacity = '0'; });
      if (Math.abs(dy) > Math.abs(dx) && dy < -40) {
        el.querySelector('.swipe-hint-up').style.opacity = '1';
      } else if (dx < -40) {
        el.querySelector('.swipe-hint-left').style.opacity = '1';
      } else if (dx > 40) {
        el.querySelector('.swipe-hint-right').style.opacity = '1';
      }
    }, { passive: true });

    el.addEventListener('touchend', function(e) {
      if (!isDragging) return;
      isDragging = false;
      var dx = e.changedTouches[0].clientX - startX;
      var dy = e.changedTouches[0].clientY - startY;
      var THRESHOLD = 80;

      if (Math.abs(dy) > Math.abs(dx) && dy < -THRESHOLD) {
        flyOut(el, 'up', card);
      } else if (dx < -THRESHOLD) {
        flyOut(el, 'left', card);
      } else if (dx > THRESHOLD) {
        flyOut(el, 'skip', card);
      } else {
        el.style.transition = 'transform 0.3s ease';
        el.style.transform = '';
        el.querySelectorAll('.swipe-hint').forEach(function(h) { h.style.opacity = '0'; });
      }
    }, { passive: true });
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
    var btnUp = document.getElementById('swipe-btn-up');
    var btnLeft = document.getElementById('swipe-btn-left');
    var btnSkip = document.getElementById('swipe-btn-skip');

    if (btnUp) {
      btnUp.addEventListener('click', function() {
        var top = document.querySelector('#swipe-stack .swipe-card:last-child');
        if (top && cards[currentIndex]) flyOut(top, 'up', cards[currentIndex]);
      });
    }
    if (btnLeft) {
      btnLeft.addEventListener('click', function() {
        var top = document.querySelector('#swipe-stack .swipe-card:last-child');
        if (top && cards[currentIndex]) flyOut(top, 'left', cards[currentIndex]);
      });
    }
    if (btnSkip) {
      btnSkip.addEventListener('click', function() {
        var top = document.querySelector('#swipe-stack .swipe-card:last-child');
        if (top && cards[currentIndex]) flyOut(top, 'skip', cards[currentIndex]);
      });
    }
  }

  // ---------- Стек ----------
  async function initStack() {
    var stack = document.getElementById('swipe-stack');
    if (!stack) return;

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
    }
  }

  // ---------- Таби ----------
  function renderTypeTabs() {
    document.querySelectorAll('.swipe-type-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.swipeType === activeType);
    });
  }

  async function refresh() {
    renderTypeTabs();
    await initStack();
  }

  let initialized = false;

  function init() {
    document.querySelectorAll('.swipe-type-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        activeType = btn.dataset.swipeType || 'movie';
        refresh();
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
