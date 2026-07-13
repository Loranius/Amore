// ============================================================
// MAP MODULE v2 — Карта спогадів та планів
// ============================================================

const MapModule = (() => {

  const MAPBOX_TOKEN = 'pk.eyJ1IjoiZGVpbW8iLCJhIjoiY21xZ2pzMGh3MDB4ZjJxcG1rdGo1MnRldCJ9.zZLQQDugc3XC14fOWY1Ftw';
  const SUPA_URL = 'https://yicalgoqegluzuagxssk.supabase.co';
  const MAP_PHOTO_BUCKET = 'map-photos';

  const CATEGORIES = {
    visited:    { label: 'Були',      emoji: '📍', color: '#E8829C' },
    restaurant: { label: 'Ресторан',  emoji: '🍽',  color: '#FF6B9D' },
    plan:       { label: 'Плануємо', emoji: '✈️',  color: '#C45B79' },
    favorite:   { label: 'Улюблене', emoji: '⭐',  color: '#F6B9CC' },
  };

  let map = null;
  let markers = [];
  let allPins = [];
  let focusedPinId = null;   // картка, на яку зараз «наведено» (1-й клік — політ, 2-й — модалка)
  let mapInitialized = false;
  let mapboxLoaded = false;
  let searchDebounce = null;
  let activeCatFilter = 'all'; // 'all' | ключ з CATEGORIES
  const DEFAULT_CENTER = [30.5234, 50.4501];

  function directionsUrl(lat, lng) {
    return 'https://www.google.com/maps/dir/?api=1&destination=' + lat + ',' + lng;
  }

  function visiblePins() {
    return activeCatFilter === 'all'
      ? allPins
      : allPins.filter(function(p) { return (p.category || 'visited') === activeCatFilter; });
  }

  // ── Геолокація партнерів ────────────────────────────────────
  // user_id -> { marker: mapboxgl.Marker, popup: mapboxgl.Popup }
  const locationMarkers = {};
  // Конфігурація зовнішнього вигляду для кожного користувача
  // (перший user за алфавітом — Діма 💙, другий — Лєна 💗)
  const USER_LOCATION_STYLES = [
    { emoji: '💙', color: '#4A90D9', label: 'Дімусік' },
    { emoji: '💗', color: '#E8829C', label: 'Лєнусік' },
  ];

  // ── Динамічне завантаження Mapbox (лише при першому відкритті вкладки) ──
  function loadMapboxResources() {
    return new Promise(function(resolve) {
      if (mapboxLoaded) { resolve(); return; }

      // CSS
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css';
      document.head.appendChild(link);

      // JS
      var script = document.createElement('script');
      script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js';
      script.onload = function() { mapboxLoaded = true; resolve(); };
      document.head.appendChild(script);
    });
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  function starsHtml(rating) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      html += '<span class="map-star ' + (rating && i <= rating ? 'filled' : '') + '" data-star="' + i + '">★</span>';
    }
    return html;
  }

  // ---------- Фото ----------
  // onProgress(msg) — необов'язковий колбек для UI
  async function uploadMapPhoto(file, pinId, onProgress) {
    // HEIC з iPhone → JPEG (інакше canvas не декодує, а сирий HEIC не відобразиться)
    if (Img.isHeic(file)) {
      if (onProgress) onProgress('Конвертуємо HEIC…');
      try {
        file = await Img.normalize(file);
      } catch (err) {
        console.error('uploadMapPhoto: конвертація HEIC не вдалася', err);
        ErrorBoundary.showToast('Не вдалося обробити HEIC-фото: ' + err.message);
        return null;
      }
    }

    if (onProgress) onProgress('Стискаємо фото…');

    let blob = file;
    let ext  = (file.name.split('.').pop() || 'jpg').toLowerCase();
    let contentType = file.type;

    try {
      const out = await Img.compress(file, 1080, 0.75);
      blob = out.blob; ext = out.ext; contentType = out.contentType;
      const origKb = (file.size / 1024).toFixed(0);
      const newKb  = (blob.size  / 1024).toFixed(0);
      console.log('Фото стиснуто: ' + origKb + ' KB → ' + newKb + ' KB');
    } catch (err) {
      console.warn('Стиснення не вдалося, завантажуємо оригінал:', err);
    }

    const path = 'pin-' + pinId + '-' + Date.now() + '.' + ext;

    if (onProgress) onProgress('Завантажуємо фото…');

    var { error } = await supabase.storage
      .from(MAP_PHOTO_BUCKET)
      .upload(path, blob, { upsert: true, contentType });

    if (error) { console.error('uploadMapPhoto error:', error); return null; }
    return SUPA_URL + '/storage/v1/object/public/' + MAP_PHOTO_BUCKET + '/' + path;
  }

  // ---------- Карта ----------
  function initMap() {
    if (mapInitialized) return;
    mapInitialized = true;

    mapboxgl.accessToken = MAPBOX_TOKEN;

    map = new mapboxgl.Map({
      container: 'map-container',
      style: 'mapbox://styles/mapbox/streets-v12',
      center: DEFAULT_CENTER,
      zoom: 5,
    });

    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    var geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showAccuracyCircle: true,
      showUserLocation: true,
    });
    map.addControl(geolocateControl, 'top-right');

    // Fallback: якщо GeolocateControl не показав позицію після дозволу —
    // вручну летимо до координат через navigator.geolocation
    geolocateControl.on('error', function() {
      if (!navigator.geolocation) return;
      navigator.geolocation.getCurrentPosition(function(pos) {
        map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 });
      }, null, { enableHighAccuracy: true, timeout: 10000 });
    });

    // Після успішної геолокації — переконуємось що карта відцентрована
    geolocateControl.on('geolocate', function(e) {
      map.flyTo({ center: [e.coords.longitude, e.coords.latitude], zoom: 14 });
    });

    map.on('click', function(e) {
      openAddModal(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('load', function() {
      loadAndRender();
      renderLocationMarkers();
    });
  }

  // ---------- Завантаження ----------
  async function fetchPins() {
    var { data, error } = await supabase
      .from('map_pins')
      .select('id, title, note, category, lat, lng, photo_url, rating, review')
      .order('created_at', { ascending: false });
    if (error) { console.error('map_pins error:', error); return []; }
    return data || [];
  }

  function loadAndRender() {
    // Миттєво з кешу, потім фонова ревалідація
    DataCache.swr('map_pins', fetchPins, function(pins) {
      allPins = pins || [];
      renderCatFilterBar();
      renderMarkersAndCards();
      bindPinSearch();
    });
  }

  function renderMarkersAndCards() {
    markers.forEach(function(m) { m.remove(); });
    markers = [];
    var pins = visiblePins();
    pins.forEach(function(pin) { addMarker(pin); });
    renderPinCards();
    fitBoundsToPins(pins);
  }

  // Авто-зум карти під наявні мітки (замість статичного вигляду всієї країни)
  function fitBoundsToPins(pins) {
    if (!map || !pins.length) return;
    if (pins.length === 1) {
      map.flyTo({ center: [pins[0].lng, pins[0].lat], zoom: 12 });
      return;
    }
    var bounds = new mapboxgl.LngLatBounds();
    pins.forEach(function(p) { bounds.extend([p.lng, p.lat]); });
    map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 600 });
  }

  // Панель фільтрів за категорією
  function renderCatFilterBar() {
    var wrap = document.getElementById('map-cat-filter');
    if (!wrap) return;

    var bar = document.createElement('div');
    bar.className = 'map-cat-filter-bar';

    var allBtn = document.createElement('button');
    allBtn.className = 'map-cat-chip' + (activeCatFilter === 'all' ? ' active' : '');
    allBtn.innerHTML = '🗺️ Всі <span class="map-cat-chip-count">' + allPins.length + '</span>';
    allBtn.addEventListener('click', function() { activeCatFilter = 'all'; renderMarkersAndCards(); renderCatFilterBar(); });
    bar.appendChild(allBtn);

    Object.keys(CATEGORIES).forEach(function(key) {
      var cat = CATEGORIES[key];
      var count = allPins.filter(function(p) { return (p.category || 'visited') === key; }).length;
      var btn = document.createElement('button');
      btn.className = 'map-cat-chip' + (activeCatFilter === key ? ' active' : '');
      btn.innerHTML = cat.emoji + ' ' + cat.label + ' <span class="map-cat-chip-count">' + count + '</span>';
      btn.addEventListener('click', function() { activeCatFilter = key; renderMarkersAndCards(); renderCatFilterBar(); });
      bar.appendChild(btn);
    });

    wrap.innerHTML = '';
    wrap.appendChild(bar);
  }

  // ---------- Маркер ----------
  function addMarker(pin) {
    var cat = CATEGORIES[pin.category] || CATEGORIES.visited;

    var el = document.createElement('div');
    el.className = 'map-marker';
    el.style.background = cat.color;
    el.textContent = cat.emoji;

    el.addEventListener('click', function(e) {
      e.stopPropagation();
      openPinModal(pin);
    });

    var marker = new mapboxgl.Marker(el)
      .setLngLat([pin.lng, pin.lat])
      .addTo(map);

    markers.push(marker);
  }

  // ---------- Картки пінів внизу ----------
  function renderPinCards(filterText) {
    var wrap = document.getElementById('pin-list');
    if (!wrap) return;

    var query = (filterText || '').toLowerCase().trim();
    var base = visiblePins();
    var pins = query
      ? base.filter(function(p) {
          return (p.title || '').toLowerCase().includes(query) ||
                 (p.review || '').toLowerCase().includes(query) ||
                 (p.note || '').toLowerCase().includes(query);
        })
      : base;

    if (!allPins.length) {
      wrap.innerHTML = '<p class="empty-state">Натисни на карту щоб додати місце</p>';
      return;
    }

    if (!base.length) {
      wrap.innerHTML = '<p class="empty-state">У цій категорії поки немає місць 🔍</p>';
      return;
    }

    if (query && !pins.length) {
      wrap.innerHTML = '<p class="empty-state">Нічого не знайдено 🔍</p>';
      return;
    }

    wrap.innerHTML = '';

    pins.forEach(function(pin) {
      var cat = CATEGORIES[pin.category] || CATEGORIES.visited;
      var card = document.createElement('div');
      card.className = 'pin-card' + (pin.id === focusedPinId ? ' pin-card--active' : '');

      var photoHtml = pin.photo_url
        ? '<img class="pin-card-photo" loading="lazy" src="' + pin.photo_url + '" alt="' + escapeHtml(pin.title) + '">'
        : '<div class="pin-card-photo-placeholder">' + cat.emoji + '</div>';

      var ratingHtml = '';
      if (pin.rating) {
        for (var i = 1; i <= 5; i++) {
          ratingHtml += '<span class="' + (i <= pin.rating ? 'map-star filled' : 'map-star') + '">★</span>';
        }
      }

      card.innerHTML =
        photoHtml +
        '<div class="pin-card-body">' +
          '<div class="pin-card-header">' +
            '<p class="pin-card-title">' + escapeHtml(pin.title) + '</p>' +
            '<span class="pin-card-cat">' + cat.emoji + ' ' + cat.label + '</span>' +
          '</div>' +
          (ratingHtml ? '<div class="pin-card-rating">' + ratingHtml + '</div>' : '') +
          (pin.review ? '<p class="pin-card-review">' + escapeHtml(pin.review) + '</p>' : '') +
          '<a class="pin-route-btn" href="' + directionsUrl(pin.lat, pin.lng) + '" target="_blank" rel="noopener">🧭 Маршрут</a>' +
        '</div>';

      card.querySelector('.pin-route-btn').addEventListener('click', function(e) { e.stopPropagation(); });

      card.addEventListener('click', function() {
        if (focusedPinId === pin.id) {
          // Другий клік по тій самій картці → відкриваємо модалку
          openPinModal(pin);
        } else {
          // Перший клік → переносимо карту до місця і підсвічуємо картку
          focusedPinId = pin.id;
          wrap.querySelectorAll('.pin-card').forEach(function(c) { c.classList.remove('pin-card--active'); });
          card.classList.add('pin-card--active');
          if (map) map.flyTo({ center: [pin.lng, pin.lat], zoom: 15 });
        }
      });

      wrap.appendChild(card);
    });
  }

  // ---------- Геокодинг (пошук місць через Mapbox) ----------
  async function geocodePlaces(query) {
    var url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
      encodeURIComponent(query) + '.json' +
      '?access_token=' + MAPBOX_TOKEN +
      '&limit=5&language=uk';
    try {
      var res = await fetch(url);
      if (!res.ok) { console.error('geocode HTTP', res.status); return []; }
      var json = await res.json();
      return json.features || [];
    } catch (e) {
      console.error('geocode error:', e);
      return [];
    }
  }

  function renderGeoResults(features, dropdown, input) {
    if (!features.length) {
      dropdown.innerHTML = '<div style="padding:10px 12px;color:#999;font-size:14px;">Нічого не знайдено 🔍</div>';
      dropdown.style.display = 'block';
      return;
    }
    dropdown.innerHTML = '';
    features.forEach(function(f) {
      var item = document.createElement('div');
      item.style.cssText = 'padding:10px 12px;cursor:pointer;border-bottom:1px solid rgba(0,0,0,0.06);font-size:14px;line-height:1.3;';
      item.innerHTML = '<b>' + escapeHtml(f.text || '') + '</b>' +
        '<div style="color:#888;font-size:12px;">' + escapeHtml(f.place_name || '') + '</div>';
      item.addEventListener('mouseenter', function(){ item.style.background = 'rgba(232,130,156,0.12)'; });
      item.addEventListener('mouseleave', function(){ item.style.background = ''; });
      item.addEventListener('click', function() {
        var lng = f.center[0], lat = f.center[1];
        dropdown.style.display = 'none';
        input.value = '';
        if (map) map.flyTo({ center: [lng, lat], zoom: 14 });
        openAddModal(lat, lng);
        var titleInp = document.getElementById('pin-title');
        if (titleInp) titleInp.value = f.text || f.place_name || '';
      });
      dropdown.appendChild(item);
    });
    dropdown.style.display = 'block';
  }

  function bindPinSearch() {
    var input = document.getElementById('pin-search');
    if (!input || input.dataset.bound) return;
    input.dataset.bound = '1';

    // Випадаючий список результатів пошуку
    var wrap = input.parentNode;
    wrap.style.position = 'relative';
    var dropdown = document.createElement('div');
    dropdown.id = 'pin-search-results';
    dropdown.style.cssText =
      'position:absolute;left:0;right:0;top:' + (input.offsetHeight || 40) + 'px;' +
      'background:#fff;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,0.18);' +
      'z-index:60;display:none;max-height:260px;overflow-y:auto;';
    wrap.appendChild(dropdown);

    input.addEventListener('input', function() {
      var q = input.value.trim();
      // паралельно фільтруємо власні збережені піни внизу
      renderPinCards(input.value);

      clearTimeout(searchDebounce);
      if (q.length < 3) { dropdown.style.display = 'none'; dropdown.innerHTML = ''; return; }
      searchDebounce = setTimeout(async function() {
        var feats = await geocodePlaces(q);
        renderGeoResults(feats, dropdown, input);
      }, 350);
    });

    // Закриття списку при кліку поза ним
    document.addEventListener('click', function(e) {
      if (e.target !== input && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  }

  // ---------- Повноекранний перегляд фото ----------
  function openFullscreenPhoto(url, title) {
    var fs = document.createElement('div');
    fs.id = 'photo-fullscreen';
    fs.style.cssText = 'position:fixed;inset:0;background:#000;z-index:1000;display:flex;flex-direction:column;';

    fs.innerHTML =
      '<div style="display:flex;justify-content:flex-end;padding:12px 16px;">' +
        '<button id="fs-close" style="background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:24px;width:40px;height:40px;border-radius:50%;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div id="fs-img-wrap" style="flex:1;overflow:hidden;display:flex;align-items:center;justify-content:center;">' +
        '<img id="fs-img" src="' + url + '" style="max-width:100%;max-height:100%;object-fit:contain;touch-action:none;transform-origin:center;">' +
      '</div>' +
      (title ? '<p style="color:#fff;text-align:center;padding:12px 16px;font-size:14px;margin:0;">' + escapeHtml(title) + '</p>' : '');

    document.body.appendChild(fs);
    document.getElementById('fs-close').addEventListener('click', function() { fs.remove(); });

    // Пінч-зум
    var img = document.getElementById('fs-img');
    var scale = 1;
    var lastDist = 0;

    fs.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });

    fs.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        var dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        if (lastDist > 0) {
          scale = Math.min(Math.max(scale * (dist / lastDist), 1), 5);
          img.style.transform = 'scale(' + scale + ')';
        }
        lastDist = dist;
      }
    }, { passive: true });

    fs.addEventListener('touchend', function(e) {
      if (e.touches.length < 2) lastDist = 0;
      if (scale < 1.05) {
        scale = 1;
        img.style.transform = 'scale(1)';
      }
    }, { passive: true });

    // Подвійний тап — reset зуму
    var lastTap = 0;
    fs.addEventListener('touchend', function(e) {
      if (e.touches.length > 0) return;
      var now = Date.now();
      if (now - lastTap < 300) {
        scale = scale > 1 ? 1 : 2.5;
        img.style.transition = 'transform 0.3s ease';
        img.style.transform = 'scale(' + scale + ')';
        setTimeout(function() { img.style.transition = ''; }, 300);
      }
      lastTap = now;
    }, { passive: true });
  }

  // ---------- Модалка перегляду/редагування піна ----------
  function openPinModal(pin) {
    focusedPinId = null; // після закриття модалки знову працює «1-й клік = політ»
    var cat = CATEGORIES[pin.category] || CATEGORIES.visited;
    var root = document.getElementById('modal-root');
    var selectedRating = pin.rating || 0;

    root.innerHTML =
      '<div class="modal-overlay" id="pin-view-overlay">' +
        '<div class="modal-card pin-view-modal">' +
          // Фото зверху
          (pin.photo_url
            ? '<div class="pin-view-photo-wrap">' +
                '<img class="pin-view-photo" id="pin-view-img" src="' + pin.photo_url + '" alt="">' +
                '<div class="pin-view-photo-caption">' + escapeHtml(pin.title) + '</div>' +
              '</div>'
            : '<div class="pin-view-photo-placeholder">' + cat.emoji + '</div>') +
          // Тіло модалки
          '<div class="pin-view-body">' +
            '<div class="form-field">' +
              '<label for="pin-edit-title">Назва</label>' +
              '<input type="text" id="pin-edit-title" value="' + escapeHtml(pin.title) + '">' +
            '</div>' +
            '<div class="form-field">' +
              '<label>Оцінка</label>' +
              '<div class="pin-rating-row" id="pin-rating-row">' +
                starsHtml(selectedRating) +
              '</div>' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="pin-edit-review">Враження</label>' +
              '<textarea id="pin-edit-review" rows="3" placeholder="Що сподобалось...">' +
                escapeHtml(pin.review || '') +
              '</textarea>' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="pin-edit-photo">Замінити фото</label>' +
              '<input type="file" id="pin-edit-photo" accept="image/*,.heic,.heif">' +
            '</div>' +
            '<div class="modal-actions">' +
              '<a class="btn-secondary" href="' + directionsUrl(pin.lat, pin.lng) + '" target="_blank" rel="noopener" style="text-decoration:none;text-align:center;">🧭 Маршрут</a>' +
              '<button class="btn-secondary pin-delete-action" id="pin-delete-btn">Видалити</button>' +
              '<button class="btn-primary" id="pin-edit-save">Зберегти</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Тап на фото → повноекранний перегляд
    if (pin.photo_url) {
      document.getElementById('pin-view-img').addEventListener('click', function() {
        openFullscreenPhoto(pin.photo_url, pin.title);
      });
    }

    // Зірки
    function bindStars() {
      document.getElementById('pin-rating-row').querySelectorAll('.map-star').forEach(function(star) {
        star.addEventListener('click', function() {
          selectedRating = parseInt(star.dataset.star);
          document.getElementById('pin-rating-row').innerHTML = starsHtml(selectedRating);
          bindStars();
        });
      });
    }
    bindStars();

    document.getElementById('pin-view-overlay').addEventListener('click', function(e) {
      if (e.target.id === 'pin-view-overlay') closeModal();
    });

    document.getElementById('pin-delete-btn').addEventListener('click', function() {
      deletePin(pin.id);
    });

    document.getElementById('pin-edit-save').addEventListener('click', async function() {
      var title = document.getElementById('pin-edit-title').value.trim();
      var review = document.getElementById('pin-edit-review').value.trim();
      var photoInput = document.getElementById('pin-edit-photo');

      if (!title) { alert('Вкажи назву'); return; }

      var saveBtn = document.getElementById('pin-edit-save');
      saveBtn.disabled = true;

      var update = { title: title, review: review || null, rating: selectedRating || null };

      if (photoInput.files && photoInput.files[0]) {
        var url = await uploadMapPhoto(photoInput.files[0], pin.id, function(msg) {
          saveBtn.textContent = msg;
        });
        if (url) update.photo_url = url;
      }

      saveBtn.textContent = 'Зберігаємо...';
      var { error } = await supabase.from('map_pins').update(update).eq('id', pin.id);
      if (error) { alert('Помилка збереження'); saveBtn.textContent = 'Зберегти'; saveBtn.disabled = false; return; }
      DataCache.invalidate('map_pins');
      closeModal();
      loadAndRender();
    });
  }

  // ---------- Модалка додавання ----------
  function openAddModal(lat, lng) {
    var root = document.getElementById('modal-root');
    root.innerHTML =
      '<div class="modal-overlay" id="pin-add-overlay">' +
        '<div class="modal-card">' +
          '<h3>Нове місце</h3>' +
          '<div class="form-field">' +
            '<label for="pin-title">Назва</label>' +
            '<input type="text" id="pin-title" placeholder="Наприклад, Ресторан Gaspar">' +
          '</div>' +
          '<div class="form-field">' +
            '<label>Категорія</label>' +
            '<div class="pin-category-grid">' +
              Object.entries(CATEGORIES).map(function(entry) {
                var key = entry[0]; var cat = entry[1];
                return '<button class="pin-cat-btn ' + (key === 'visited' ? 'active' : '') + '" data-cat="' + key + '">' +
                  cat.emoji + ' ' + cat.label + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="form-field">' +
            '<label for="pin-photo">Фото місця</label>' +
            '<input type="file" id="pin-photo" accept="image/*,.heic,.heif">' +
            '<div id="pin-photo-preview" style="display:none;margin-top:8px;">' +
              '<img id="pin-photo-preview-img" style="width:100%;max-height:160px;object-fit:cover;border-radius:10px;">' +
              '<p id="pin-photo-preview-size" style="font-size:12px;color:#999;margin:4px 0 0;"></p>' +
            '</div>' +
          '</div>' +
          '<div class="form-field">' +
            '<label for="pin-note">Нотатка</label>' +
            '<textarea id="pin-note" rows="2" placeholder="Враження, деталі..."></textarea>' +
          '</div>' +
          '<p class="pin-coords">📌 ' + lat.toFixed(4) + ', ' + lng.toFixed(4) + '</p>' +
          '<div class="modal-actions">' +
            '<button class="btn-secondary" id="pin-cancel">Скасувати</button>' +
            '<button class="btn-primary" id="pin-save">Зберегти</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    var selectedCat = 'visited';
    document.querySelectorAll('.pin-cat-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        selectedCat = btn.dataset.cat;
        document.querySelectorAll('.pin-cat-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    document.getElementById('pin-cancel').addEventListener('click', closeModal);
    document.getElementById('pin-add-overlay').addEventListener('click', function(e) {
      if (e.target.id === 'pin-add-overlay') closeModal();
    });
    document.getElementById('pin-save').addEventListener('click', function() {
      savePin(lat, lng, selectedCat);
    });

    // Preview фото після вибору
    document.getElementById('pin-photo').addEventListener('change', async function(e) {
      var inp = e.target;
      var file = inp.files && inp.files[0];
      inp._normFile = null;
      if (!file) return;
      // HEIC → JPEG одразу, інакше прев'ю у <img> не відрендериться
      try {
        file = await Img.normalize(file);
      } catch (err) {
        console.error('[Map] конвертація HEIC не вдалася:', err);
        ErrorBoundary.showToast('Не вдалося обробити HEIC-фото: ' + err.message);
        inp.value = '';
        return;
      }
      inp._normFile = file; // savePin бере вже конвертований файл
      var preview = document.getElementById('pin-photo-preview');
      var previewImg = document.getElementById('pin-photo-preview-img');
      var previewSize = document.getElementById('pin-photo-preview-size');
      var url = URL.createObjectURL(file);
      previewImg.src = url;
      previewSize.textContent = 'Оригінал: ' + (file.size / 1024).toFixed(0) + ' KB → буде стиснуто до ~1080px';
      preview.style.display = 'block';
    });
  }

  async function savePin(lat, lng, category) {
    var title = document.getElementById('pin-title').value.trim();
    var note = document.getElementById('pin-note').value.trim();
    var photoInput = document.getElementById('pin-photo');

    if (!title) { alert('Вкажи назву місця'); return; }

    var saveBtn = document.getElementById('pin-save');
    saveBtn.textContent = 'Зберігаємо...';
    saveBtn.disabled = true;

    var user = Auth.getCurrentUser();

    var { data: pinData, error } = await supabase.from('map_pins').insert({
      title: title,
      note: note || null,
      category: category,
      lat: lat,
      lng: lng,
      created_by: user ? user.id : null,
    }).select('id').single();

    if (error) { alert('Помилка збереження'); saveBtn.textContent = 'Зберегти'; saveBtn.disabled = false; return; }

    var pinPhotoFile = photoInput && (photoInput._normFile || (photoInput.files && photoInput.files[0]));
    if (pinPhotoFile) {
      var photoUrl = await uploadMapPhoto(pinPhotoFile, pinData.id, function(msg) {
        saveBtn.textContent = msg;
      });
      if (photoUrl) {
        await supabase.from('map_pins').update({ photo_url: photoUrl }).eq('id', pinData.id);
      }
    }

    closeModal();
    // Одразу відкриваємо модалку редагування для нового піна
    var { data: newPin } = await supabase
      .from('map_pins')
      .select('id, title, note, category, lat, lng, photo_url, rating, review')
      .eq('id', pinData.id)
      .single();

    DataCache.invalidate('map_pins');
    loadAndRender();
    if (newPin) openPinModal(newPin);
  }

  async function deletePin(id) {
    if (!confirm('Видалити це місце?')) return;
    await supabase.from('map_pins').delete().eq('id', id);
    DataCache.invalidate('map_pins');
    closeModal();
    loadAndRender();
  }

  // ============================================================
  // ГЕОЛОКАЦІЯ ПАРТНЕРІВ
  // ============================================================

  // Відправити своє поточне місцезнаходження в Supabase
  // Геокодинг: lat/lng → { address, city }
  async function reverseGeocode(lat, lng) {
    try {
      var url = 'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
        lng + ',' + lat +
        '.json?types=address,place&language=uk&access_token=' + MAPBOX_TOKEN;
      var res = await fetch(url);
      var data = await res.json();
      var features = data.features || [];

      var address = '';
      var city = '';

      // Шукаємо вулицю/адресу
      var addrFeature = features.find(function(f) {
        return f.place_type && f.place_type.includes('address');
      });
      if (addrFeature) {
        address = addrFeature.text || '';
        // Номер будинку
        if (addrFeature.address) address = address + ', ' + addrFeature.address;
      }

      // Шукаємо місто
      var cityFeature = features.find(function(f) {
        return f.place_type && (f.place_type.includes('place') || f.place_type.includes('locality'));
      });
      if (!cityFeature && addrFeature) {
        // Беремо з context
        var ctx = addrFeature.context || [];
        var placeCtx = ctx.find(function(c) { return c.id && c.id.startsWith('place'); });
        if (placeCtx) city = placeCtx.text || '';
      } else if (cityFeature) {
        city = cityFeature.text || '';
      }

      return { address: address, city: city };
    } catch (e) {
      console.warn('geocode error:', e);
      return { address: '', city: '' };
    }
  }

  async function checkinLocation() {
    var btn = document.getElementById('checkin-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    if (!navigator.geolocation) {
      alert('Геолокація не підтримується браузером');
      if (btn) { btn.disabled = false; btn.textContent = '📍 Я тут'; }
      return;
    }

    navigator.geolocation.getCurrentPosition(async function(pos) {
      var lat = pos.coords.latitude;
      var lng = pos.coords.longitude;
      var user = Auth.getCurrentUser();
      if (!user) return;

      // Паралельно: геокодинг + upsert поточного місця
      var geo = await reverseGeocode(lat, lng);

      var now = new Date().toISOString();

      // 1. Оновлюємо поточне місцезнаходження
      var { error: upsertErr } = await supabase.from('user_locations').upsert({
        user_id: user.id,
        lat: lat,
        lng: lng,
        updated_at: now,
      }, { onConflict: 'user_id' });

      if (upsertErr) {
        console.error('checkin error:', upsertErr);
        alert('Не вдалось надіслати місцезнаходження 😔');
        if (btn) { btn.disabled = false; btn.textContent = '📍 Я тут'; }
        return;
      }

      // 2. Записуємо в архів
      await supabase.from('location_history').insert({
        user_id: user.id,
        lat: lat,
        lng: lng,
        address: geo.address,
        city: geo.city,
        created_at: now,
      });

      // 3. Підлітаємо і оновлюємо маркери
      if (map) map.flyTo({ center: [lng, lat], zoom: 14 });
      renderLocationMarkers();

      if (btn) { btn.disabled = false; btn.textContent = '📍 Я тут'; }
    }, function(err) {
      console.warn('geolocation error:', err);
      var msg = err.code === 1
        ? 'Дозвіл на геолокацію відхилено. Надай доступ у налаштуваннях браузера.'
        : 'Не вдалось отримати геолокацію. Спробуй ще раз.';
      alert(msg);
      if (btn) { btn.disabled = false; btn.textContent = '📍 Я тут'; }
    }, { enableHighAccuracy: true, timeout: 10000 });
  }

  // Показати модалку з архівом місцезнаходжень
  async function openLocationHistory() {
    var root = document.getElementById('modal-root');
    root.innerHTML = '<div class="modal-overlay"><div class="modal-card"><p style="text-align:center;padding:24px">⏳ Завантаження...</p></div></div>';

    // Чистимо записи старші 24г і завантажуємо свіжі
    var cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await supabase.from('location_history').delete().lt('created_at', cutoff);

    var users = await Auth.getUsers();
    var { data, error } = await supabase
      .from('location_history')
      .select('user_id, lat, lng, address, city, created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      root.innerHTML = '';
      alert('Не вдалось завантажити архів 😔');
      return;
    }

    var rows = (data || []).map(function(rec) {
      var userIdx = users.findIndex(function(u) { return u.id === rec.user_id; });
      var style = USER_LOCATION_STYLES[userIdx] || USER_LOCATION_STYLES[0];
      var userName = (users[userIdx] || {}).name || style.label;

      var d = new Date(rec.created_at);
      var timeStr = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      var dateStr = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

      var place = [rec.address, rec.city].filter(Boolean).join(', ') || '(адреса невідома)';

      // Посилання на Google Maps
      var mapsUrl = 'https://www.google.com/maps?q=' + rec.lat + ',' + rec.lng;

      return '<div class="loc-hist-row">' +
        '<span class="loc-hist-emoji">' + style.emoji + '</span>' +
        '<div class="loc-hist-info">' +
          '<span class="loc-hist-name">' + escapeHtml(userName) + '</span>' +
          '<a class="loc-hist-place" href="' + mapsUrl + '" target="_blank" rel="noopener">' +
            escapeHtml(place) +
          '</a>' +
        '</div>' +
        '<div class="loc-hist-time">' +
          '<span>' + timeStr + '</span>' +
          '<span class="loc-hist-date">' + dateStr + '</span>' +
        '</div>' +
      '</div>';
    }).join('');

    if (!rows) {
      rows = '<p class="loc-hist-empty">Ще немає записів за останні 24 години 🗺️</p>';
    }

    root.innerHTML =
      '<div class="modal-overlay" id="loc-hist-overlay">' +
        '<div class="modal-card">' +
          '<h3>📋 Архів за 24 год</h3>' +
          '<div class="loc-hist-list">' + rows + '</div>' +
          '<div class="modal-actions">' +
            '<button class="btn-secondary" id="loc-hist-close">Закрити</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    document.getElementById('loc-hist-close').addEventListener('click', closeModal);
    document.getElementById('loc-hist-overlay').addEventListener('click', function(e) {
      if (e.target.id === 'loc-hist-overlay') closeModal();
    });
  }

  // Скидає всі маркери геолокації (викликати при refresh карти)
  function clearLocationMarkers() {
    Object.keys(locationMarkers).forEach(function(uid) {
      try { locationMarkers[uid].marker.remove(); } catch(e) {}
      delete locationMarkers[uid];
    });
  }

  // Завантажити всі check-in координати і намалювати маркери на карті
  async function renderLocationMarkers() {
    if (!map) return;

    // Скидаємо старі маркери — вони могли бути прив'язані до попередньої інстанції map
    clearLocationMarkers();

    var users = await Auth.getUsers();
    var currentUser = Auth.getCurrentUser();

    var { data, error } = await supabase
      .from('user_locations')
      .select('user_id, lat, lng, updated_at');

    if (error) { console.error('user_locations fetch error:', error); return; }
    if (!data || !data.length) return;

    // Зберігаємо дані партнера для кнопки "Де партнер"
    var partnerLoc = null;

    data.forEach(function(loc) {
      var userIdx = users.findIndex(function(u) { return u.id === loc.user_id; });
      var style = USER_LOCATION_STYLES[userIdx] || USER_LOCATION_STYLES[0];

      var diffMs = Date.now() - new Date(loc.updated_at).getTime();
      var diffMin = Math.round(diffMs / 60000);
      var timeAgo = diffMin < 1
        ? 'щойно'
        : diffMin < 60
          ? diffMin + ' хв тому'
          : Math.round(diffMin / 60) + ' год тому';

      var userName = (users[userIdx] || {}).name || style.label;

      // Фіксуємо координати в замиканні правильно
      var locLat = loc.lat;
      var locLng = loc.lng;

      // Якщо це партнер — запам'ятовуємо для кнопки
      if (currentUser && loc.user_id !== currentUser.id) {
        partnerLoc = { lat: locLat, lng: locLng, name: userName };
      }

      var el = document.createElement('div');
      el.className = 'location-marker';
      el.style.cssText =
        'background:' + style.color + ';' +
        'width:40px;height:40px;border-radius:50%;' +
        'display:flex;align-items:center;justify-content:center;' +
        'font-size:20px;box-shadow:0 2px 8px rgba(0,0,0,0.3);' +
        'border:3px solid #fff;cursor:pointer;' +
        'animation:loc-pulse 2s ease-in-out infinite;';
      el.textContent = style.emoji;

      var popupEl = document.createElement('div');
      popupEl.className = 'loc-popup';
      popupEl.innerHTML =
        '<b>' + escapeHtml(userName) + '</b>' +
        ' <span class="loc-time">' + timeAgo + '</span>';

      var popup = new mapboxgl.Popup({
        offset: 25,
        closeButton: false,
        className: 'loc-popup-wrap',
      }).setDOMContent(popupEl);

      var marker = new mapboxgl.Marker(el)
        .setLngLat([locLng, locLat])
        .setPopup(popup)
        .addTo(map);

      el.addEventListener('click', function(e) {
        e.stopPropagation();
        if (popup.isOpen()) {
          popup.remove();
        } else {
          map.flyTo({ center: [locLng, locLat], zoom: 15 });
          marker.togglePopup();
        }
      });

      locationMarkers[loc.user_id] = { marker: marker, popupEl: popupEl };
    });

    // Оновлюємо кнопку "Де партнер"
    updateFindPartnerBtn(partnerLoc);
  }

  // Оновлює кнопку "Де [ім'я партнера]"
  function updateFindPartnerBtn(partnerLoc) {
    var btn = document.getElementById('find-partner-btn');
    if (!btn) return;
    if (partnerLoc) {
      btn.style.display = '';
      btn.title = 'Де ' + partnerLoc.name;
      btn.textContent = '🧭';
      btn.onclick = function() {
        map.flyTo({ center: [partnerLoc.lng, partnerLoc.lat], zoom: 15 });
        // Відкриваємо popup партнера
        var currentUser = Auth.getCurrentUser();
        if (!currentUser) return;
        // Знаходимо маркер партнера
        Object.keys(locationMarkers).forEach(function(uid) {
          if (parseInt(uid) !== currentUser.id) {
            locationMarkers[uid].marker.togglePopup();
          }
        });
      };
    } else {
      btn.style.display = 'none';
    }
  }

  // Видалити своє місцезнаходження (скидання check-in)
  async function clearMyLocation() {
    var user = Auth.getCurrentUser();
    if (!user) return;
    await supabase.from('user_locations').delete().eq('user_id', user.id);

    // Прибираємо маркер з карти
    if (locationMarkers[user.id]) {
      locationMarkers[user.id].marker.remove();
      delete locationMarkers[user.id];
    }
    DataCache.invalidate('user_locations');
  }

  // Публічний метод для Realtime — оновити маркери партнерів
  function refreshLocations() {
    renderLocationMarkers();
  }

  function closeModal() {
    // Глобальна закривалка з fallback-таймером (reduced-motion тощо)
    closeModalAnimated();
  }

  // ---------- Init ----------
  function refresh() {
    if (!mapInitialized) {
      loadMapboxResources().then(function() {
        setTimeout(function() { initMap(); }, 100);
      });
    } else {
      map.resize();
      loadAndRender();
      // Скидаємо і перемальовуємо маркери партнерів
      clearLocationMarkers();
      renderLocationMarkers();
    }
  }

  function bindCheckinBtn() {
    var checkinBtn = document.getElementById('checkin-btn');
    if (checkinBtn && !checkinBtn.dataset.bound) {
      checkinBtn.dataset.bound = '1';
      checkinBtn.addEventListener('click', checkinLocation);
    }
    var histBtn = document.getElementById('location-history-btn');
    if (histBtn && !histBtn.dataset.bound) {
      histBtn.dataset.bound = '1';
      histBtn.addEventListener('click', openLocationHistory);
    }
    // find-partner-btn — onclick призначається динамічно в updateFindPartnerBtn
    // нічого прив'язувати тут не потрібно
  }

  function init() {
    document.getElementById('add-pin-btn').addEventListener('click', function() {
      // Точка за замовчуванням — поточний центр карти (а не завжди Київ)
      if (map) {
        var c = map.getCenter();
        openAddModal(c.lat, c.lng);
      } else {
        openAddModal(DEFAULT_CENTER[1], DEFAULT_CENTER[0]);
      }
    });

    // Прив'язуємо одразу + через rAF як fallback якщо DOM ще не готовий
    bindCheckinBtn();
    requestAnimationFrame(bindCheckinBtn);

    window.addEventListener('portal:view', function(e) {
      if (e.detail.view !== 'map') return;
      bindCheckinBtn(); // ще один fallback при навігації на карту
      refresh();
    });
  }

  return { init: init, refresh: refresh, refreshLocations: refreshLocations };
})();
