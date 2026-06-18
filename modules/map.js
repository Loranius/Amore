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

  // Стиснення зображення через Canvas без втрати видимої якості
  // maxW/maxH — максимальний розмір сторони (px), quality — JPEG якість 0..1
  function compressImage(file, maxW, maxH, quality) {
    maxW = maxW || 1920;
    maxH = maxH || 1920;
    quality = quality || 0.82;

    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.onerror = reject;
      reader.onload = function(e) {
        var img = new Image();
        img.onerror = reject;
        img.onload = function() {
          var w = img.naturalWidth;
          var h = img.naturalHeight;

          // Масштабуємо пропорційно, якщо потрібно
          if (w > maxW || h > maxH) {
            var ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;

          var ctx = canvas.getContext('2d');
          // Легке згладжування для зменшеного зображення
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          canvas.toBlob(
            function(blob) {
              if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
              resolve(blob);
            },
            'image/jpeg',
            quality
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  async function uploadMapPhoto(file, pinId) {
    var path = 'pin-' + pinId + '-' + Date.now() + '.jpg';

    var blob;
    try {
      // Стискаємо до макс. 1920px по довшій стороні, JPEG 82%
      blob = await compressImage(file, 1920, 1920, 0.82);
      console.log(
        'Фото стиснуто: ' + (file.size / 1024).toFixed(0) + ' KB → ' +
        (blob.size / 1024).toFixed(0) + ' KB'
      );
    } catch (err) {
      console.warn('Стиснення не вдалося, завантажуємо оригінал:', err);
      blob = file;
      path = 'pin-' + pinId + '-' + Date.now() + '.' + (file.name.split('.').pop() || 'jpg');
    }

    var { error } = await supabase.storage
      .from(MAP_PHOTO_BUCKET)
      .upload(path, blob, { upsert: true, contentType: 'image/jpeg' });

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
              '<input type="file" id="pin-edit-photo" accept="image/*">' +
            '</div>' +
            '<div class="modal-actions">' +
              '<button class="btn-secondary delete-btn" id="pin-delete-btn">Видалити</button>' +
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
      saveBtn.textContent = 'Зберігаємо...';
      saveBtn.disabled = true;

      var update = { title: title, review: review || null, rating: selectedRating || null };

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
