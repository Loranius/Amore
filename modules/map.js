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
  let mapInitialized = false;
  const DEFAULT_CENTER = [30.5234, 50.4501];

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
  async function uploadMapPhoto(file, pinId) {
    var ext = file.name.split('.').pop() || 'jpg';
    var path = 'pin-' + pinId + '-' + Date.now() + '.' + ext;
    var { error } = await supabase.storage
      .from(MAP_PHOTO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
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
    map.addControl(new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
    }), 'top-right');

    map.on('click', function(e) {
      openAddModal(e.lngLat.lat, e.lngLat.lng);
    });

    map.on('load', function() {
      loadAndRender();
    });
  }

  // ---------- Завантаження ----------
  async function loadAndRender() {
    var { data, error } = await supabase
      .from('map_pins')
      .select('id, title, note, category, lat, lng, photo_url, rating, review')
      .order('created_at', { ascending: false });

    if (error) { console.error('map_pins error:', error); return; }
    allPins = data || [];

    markers.forEach(function(m) { m.remove(); });
    markers = [];
    allPins.forEach(function(pin) { addMarker(pin); });
    renderPinCards();
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
  function renderPinCards() {
    var wrap = document.getElementById('pin-list');
    if (!wrap) return;

    if (!allPins.length) {
      wrap.innerHTML = '<p class="empty-state">Натисни на карту щоб додати місце</p>';
      return;
    }

    wrap.innerHTML = '';

    allPins.forEach(function(pin) {
      var cat = CATEGORIES[pin.category] || CATEGORIES.visited;
      var card = document.createElement('div');
      card.className = 'pin-card';

      var photoHtml = pin.photo_url
        ? '<img class="pin-card-photo" src="' + pin.photo_url + '" alt="' + escapeHtml(pin.title) + '">'
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
        '</div>';

      card.addEventListener('click', function() {
        openPinModal(pin);
        map.flyTo({ center: [pin.lng, pin.lat], zoom: 13 });
      });

      wrap.appendChild(card);
    });
  }

  // ---------- Модалка перегляду/редагування піна ----------
  function openPinModal(pin) {
    var cat = CATEGORIES[pin.category] || CATEGORIES.visited;
    var root = document.getElementById('modal-root');
    var selectedRating = pin.rating || 0;

    root.innerHTML =
      '<div class="modal-overlay" id="pin-view-overlay">' +
        '<div class="modal-card pin-view-modal">' +
          (pin.photo_url
            ? '<img class="pin-view-photo" src="' + pin.photo_url + '" alt="">'
            : '<div class="pin-view-photo-placeholder">' + cat.emoji + '</div>') +
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
              '<textarea id="pin-edit-review" rows="3" placeholder="Що сподобалось, атмосфера, страви...">' +
                escapeHtml(pin.review || '') +
              '</textarea>' +
            '</div>' +
            '<div class="form-field">' +
              '<label for="pin-edit-photo">Замінити фото</label>' +
              '<input type="file" id="pin-edit-photo" accept="image/*">' +
            '</div>' +
            '<div class="modal-actions">' +
              '<button class="btn-secondary delete-btn" id="pin-delete-btn">Видалити</button>' +
              '<button class="btn-primary" id="pin-edit-save">Зберегти</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    // Зірки
    var ratingRow = document.getElementById('pin-rating-row');
    ratingRow.querySelectorAll('.map-star').forEach(function(star) {
      star.addEventListener('click', function() {
        selectedRating = parseInt(star.dataset.star);
        ratingRow.innerHTML = starsHtml(selectedRating);
        ratingRow.querySelectorAll('.map-star').forEach(function(s) {
          s.addEventListener('click', function() {
            selectedRating = parseInt(s.dataset.star);
            ratingRow.innerHTML = starsHtml(selectedRating);
          });
        });
      });
    });

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
      saveBtn.textContent = 'Зберігаємо...';
      saveBtn.disabled = true;

      var update = {
        title: title,
        review: review || null,
        rating: selectedRating || null,
      };

      if (photoInput.files && photoInput.files[0]) {
        var url = await uploadMapPhoto(photoInput.files[0], pin.id);
        if (url) update.photo_url = url;
      }

      var { error } = await supabase.from('map_pins').update(update).eq('id', pin.id);
      if (error) { alert('Помилка збереження'); saveBtn.textContent = 'Зберегти'; saveBtn.disabled = false; return; }

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
            '<input type="file" id="pin-photo" accept="image/*">' +
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

    if (photoInput && photoInput.files && photoInput.files[0]) {
      var photoUrl = await uploadMapPhoto(photoInput.files[0], pinData.id);
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

    loadAndRender();
    if (newPin) openPinModal(newPin);
  }

  async function deletePin(id) {
    if (!confirm('Видалити це місце?')) return;
    await supabase.from('map_pins').delete().eq('id', id);
    closeModal();
    loadAndRender();
  }

  function closeModal() {
    document.getElementById('modal-root').innerHTML = '';
  }

  // ---------- Init ----------
  function refresh() {
    if (!mapInitialized) {
      setTimeout(function() { initMap(); }, 100);
    } else {
      map.resize();
      loadAndRender();
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
