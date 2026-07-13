// ============================================================
// IMG — спільний хелпер стиснення зображень на клієнті
// Зменшує до maxSide по довшій стороні, віддає WebP (з фолбеком на JPEG).
// Використовується там, де Supabase Image Transformations недоступні (Free-план).
// ============================================================
const Img = (() => {

  // Чи підтримує браузер кодування у WebP через canvas
  let _webpSupport = null;
  function supportsWebp() {
    if (_webpSupport !== null) return _webpSupport;
    try {
      const c = document.createElement('canvas');
      c.width = 1; c.height = 1;
      _webpSupport = c.toDataURL('image/webp').indexOf('data:image/webp') === 0;
    } catch (_) { _webpSupport = false; }
    return _webpSupport;
  }

  // ── HEIC/HEIF (iPhone) ──────────────────────────────────────
  // Браузери (крім частково Safari) не декодують HEIC ані в <img>,
  // ані в canvas — тому конвертуємо у JPEG на клієнті ще ДО прев'ю/стиснення.

  // Детекція: MIME або розширення (на Windows/Android type часто порожній)
  function isHeic(file) {
    if (!file) return false;
    const t = (file.type || '').toLowerCase();
    if (t.indexOf('heic') !== -1 || t.indexOf('heif') !== -1) return true;
    return /\.(heic|heif)$/i.test(file.name || '');
  }

  // Лінивий лоадер heic2any (~1.3 МБ) — вантажиться лише коли обрано HEIC
  let _heicLibPromise = null;
  function loadHeicLib() {
    if (window.heic2any) return Promise.resolve();
    if (_heicLibPromise) return _heicLibPromise;
    const CDNS = [
      'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js',
      'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
    ];
    _heicLibPromise = new Promise((resolve, reject) => {
      const tryNext = (i) => {
        if (i >= CDNS.length) {
          _heicLibPromise = null; // дозволяємо повторну спробу пізніше
          reject(new Error('Не вдалося завантажити конвертер HEIC (перевір інтернет)'));
          return;
        }
        const s = document.createElement('script');
        s.src = CDNS[i];
        s.onload = () => resolve();
        s.onerror = () => { s.remove(); tryNext(i + 1); };
        document.head.appendChild(s);
      };
      tryNext(0);
    });
    return _heicLibPromise;
  }

  // file -> Promise<File>: HEIC/HEIF → JPEG, решта форматів — без змін
  async function normalize(file) {
    if (!isHeic(file)) return file;
    await loadHeicLib();
    const res = await window.heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    const jpegBlob = Array.isArray(res) ? res[0] : res; // heic-sequence (burst) → беремо перший кадр
    const name = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
    return new File([jpegBlob], name, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
  }

  // file -> Promise<{ blob, ext, contentType }>
  // maxSide: довша сторона (px), quality: 0..1
  async function compress(file, maxSide, quality) {
    maxSide = maxSide || 1280;
    quality = quality || 0.78;

    // Страховка: HEIC декодуємо в JPEG, інакше Image/canvas впадуть
    file = await normalize(file);

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > maxSide || h > maxSide) {
            const r = Math.min(maxSide / w, maxSide / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);

          const useWebp = supportsWebp();
          const type = useWebp ? 'image/webp' : 'image/jpeg';
          const ext  = useWebp ? 'webp' : 'jpg';
          canvas.toBlob(
            (blob) => {
              if (!blob) { reject(new Error('toBlob failed')); return; }
              resolve({ blob, ext, contentType: type });
            },
            type,
            quality
          );
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  return { compress, supportsWebp, isHeic, normalize };
})();
