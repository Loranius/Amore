// ============================================================
// MAP MODULE — Карта спогадів та планів
// Mapbox GL JS + Supabase (map_pins)
// ============================================================

const MapModule = (() => {

  const MAPBOX_TOKEN = 'pk.eyJ1IjoiZGVpbW8iLCJhIjoiY21xZ2pzMGh3MDB4ZjJxcG1rdGo1MnRldCJ9.zZLQQDugc3XC14fOWY1Ftw';

  const CATEGORIES = {
    visited:    { label: 'Були',      emoji: '📍', color: '#E8829C' },
    restaurant: { label: 'Ресторан',  emoji: '🍽',  color: '#FF6B9D' },
    plan:       { label: 'Плануємо', emoji: '✈️',  color: '#C45B79' },
    favorite:   { label: 'Улюблене', emoji: '⭐',  color: '#F6B9CC' },
  };

  let map = null;
  let markers = [];
  let allPins = [];
  let mapInitialized = false;
  // Центр за замовчуванням — Київ
  const DEFAULT_CENTER = [30.5234, 50.4501];

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  }

  // ---------- Ініціалізація карти ----------
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
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
    }), 'top-right');

    // Клік на карту для додавання піна
    map.on('click', function(e) {
      openAddModal(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('load', function() {
      loadAndRenderPins();
    });
  }

  // ---------- Завантаження пінів ----------
  async function loadAndRenderPins() {
    var { data, error } = await supabase
      .from('map_pins')
      .select('id, title, note, category, lat, lng, created_by')
      .order('created_at', { ascending: false });

    if (error) { console.error('map_pins load error:', error); return; }
    allPins = data || [];

    // Очищаємо старі маркери
    markers.forEach(function(m) { m.remove(); });
    markers = [];

    allPins.forEach(function(pin) { addMarker(pin); });
    renderPinList();
  }

  // ---------- Маркер на карті ----------
  function addMarker(pin) {
    var cat = CATEGORIES[pin.category] || CATEGORIES.visited;

    var el = document.createElement('div');
    el.className = 'map-marker';
    el.style.background = cat.color;
    el.textContent = cat.emoji;
    el.title = pin.title;

    var popup = new mapboxgl.Popup({ offset: 25, closeButton: true })
      .setHTML(
        '<div class="map-popup">' +
        '<p class="map-popup-title">' + escapeHtml(pin.title) + '</p>' +
        '<span class="map-popup-cat">' + cat.emoji + ' ' + cat.label + '</span>' +
        (pin.note ? '<p class="map-popup-note">' + escapeHtml(pin.note) + '</p>' : '') +
        '<button class="map-popup-delete" data-pin-id="' + pin.id + '">Видалити</button>' +
        '</div>'
      );

    popup.on('open', function() {
      setTimeout(function() {
        var btn = document.querySelector('.map-popup-delete[data-pin-id="' + pin.id + '"]');
        if (btn) btn.addEventListener('click', function() { deletePin(pin.id); });
      }, 100);
    });

    var marker = new mapboxgl.Marker(el)
      .setLngLat([pin.lng, pin.lat])
      .setPopup(popup)
      .addTo(map);

    markers.push(marker);
  }

  // ---------- Список пінів внизу ----------
  function renderPinList() {
    var wrap = document.getElementById('pin-list');
    if (!wrap) return;

    if (!allPins.length) {
      wrap.innerHTML = '<p class="empty-state">Натисни на карту щоб додати місце</p>';
      return;
    }

    wrap.innerHTML = '';
    allPins.forEach(function(pin) {
      var cat = CATEGORIES[pin.category] || CATEGORIES.visited;
      var row = document.createElement('div');
      row.className = 'pin-row';
      row.innerHTML =
        '<span class="pin-row-emoji">' + cat.emoji + '</span>' +
        '<div class="pin-row-info">' +
          '<p class="pin-row-title">' + escapeHtml(pin.title) + '</p>' +
          (pin.note ? '<p class="pin-row-note">' + escapeHtml(pin.note) + '</p>' : '') +
        '</div>' +
        '<button class="delete-btn" data-del-pin="' + pin.id + '">×</button>';

      // Клік на рядок — центрувати карту
      row.querySelector('.pin-row-info').addEventListener('click', function() {
        map.flyTo({ center: [pin.lng, pin.lat], zoom: 13 });
      });

      wrap.appendChild(row);
    });

    wrap.querySelectorAll('[data-del-pin]').forEach(function(btn) {
      btn.addEventListener('click', function() { deletePin(btn.dataset.delPin); });
    });
  }

  // ---------- Видалення ----------
  async function deletePin(id) {
    if (!confirm('Видалити це місце?')) return;
    await supabase.from('map_pins').delete().eq('id', id);
    loadAndRenderPins();
    document.getElementById('modal-root').innerHTML = '';
  }

  // ---------- Модалка додавання ----------
  function openAddModal(lat, lng) {
    var root = document.getElementById('modal-root');
    root.innerHTML =
      '<div class="modal-overlay" id="pin-modal-overlay">' +
        '<div class="modal-card">' +
          '<h3>Нове місце</h3>' +
          '<div class="form-field">' +
            '<label for="pin-title">Назва</label>' +
            '<input type="text" id="pin-title" placeholder="Наприклад, Ресторан Gaspar">' +
          '</div>' +
          '<div class="form-field">' +
            '<label for="pin-category">Категорія</label>' +
            '<div class="pin-category-grid" id="pin-category-grid">' +
              Object.entries(CATEGORIES).map(function(entry) {
                var key = entry[0]; var cat = entry[1];
                return '<button class="pin-cat-btn" data-cat="' + key + '">' +
                  cat.emoji + ' ' + cat.label + '</button>';
              }).join('') +
            '</div>' +
          '</div>' +
          '<div class="form-field">' +
            '<label for="pin-note">Нотатка (необов\'язково)</label>' +
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
    root.querySelectorAll('.pin-cat-btn').forEach(function(btn) {
      if (btn.dataset.cat === selectedCat) btn.classList.add('active');
      btn.addEventListener('click', function() {
        selectedCat = btn.dataset.cat;
        root.querySelectorAll('.pin-cat-btn').forEach(function(b) { b.classList.remove('active'); });
        btn.classList.add('active');
      });
    });

    document.getElementById('pin-cancel').addEventListener('click', closeModal);
    document.getElementById('pin-modal-overlay').addEventListener('click', function(e) {
      if (e.target.id === 'pin-modal-overlay') closeModal();
    });
    document.getElementById('pin-save').addEventListener('click', function() {
      savePin(lat, lng, selectedCat);
    });
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  async function savePin(lat, lng, category) {
    var title = document.getElementById('pin-title').value.trim();
    var note = document.getElementById('pin-note').value.trim();

    if (!title) { alert('Вкажи назву місця'); return; }

    var user = Auth.getCurrentUser();

    var { error } = await supabase.from('map_pins').insert({
      title: title,
      note: note || null,
      category: category,
      lat: lat,
      lng: lng,
      created_by: user ? user.id : null,
    });

    if (error) { alert('Помилка збереження'); return; }
    closeModal();
    loadAndRenderPins();
  }

  // ---------- Init ----------
  function refresh() {
    if (!mapInitialized) {
      setTimeout(function() {
        initMap();
      }, 100);
    } else {
      map.resize();
      loadAndRenderPins();
    }
  }

  function init() {
    document.getElementById('add-pin-btn').addEventListener('click', function() {
      openAddModal(DEFAULT_CENTER[1], DEFAULT_CENTER[0]);
    });

    window.addEventListener('portal:view', function(e) {
      if (e.detail.view === 'map') refresh();
    });
  }

  return { init: init, refresh: refresh };
})();
