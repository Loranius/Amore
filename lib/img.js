// ============================================================
// IMG — спільний хелпер стиснення зображень на клієнті
// Зменшує до maxSide по довшій стороні, віддає WebP (з фолбеком на JPEG).
// Використовується там, де Supabase Image Transformations недоступні (Free-план).
//
// Типізація: JSDoc + types.d.ts (див. jsconfig.json). Рантайму не торкається.
//
// libheif/HeicTo/heic2any — CDN-бібліотеки без npm-типів, той самий
// свідомий виняток `any`, що й для supabase/mapboxgl (types.d.ts).
// ============================================================
const Img = (() => {

  /** @typedef {{ kind: 'browser', mime: string, ext: string } | { kind: 'heif', brand: string } | { kind: 'unknown' }} SniffResult */

  // Чи підтримує браузер кодування у WebP через canvas
  /** @type {boolean | null} */
  let _webpSupport = null;
  /** @returns {boolean} */
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
  /**
   * @param {File | null | undefined} file
   * @returns {boolean}
   */
  function isHeic(file) {
    if (!file) return false;
    const t = (file.type || '').toLowerCase();
    if (t.indexOf('heic') !== -1 || t.indexOf('heif') !== -1) return true;
    return /\.(heic|heif)$/i.test(file.name || '');
  }

  // Універсальний лінивий лоадер скрипта з фолбеком по списку CDN
  /** @type {Record<string, Promise<void> | null>} */
  const _libPromises = {};
  /**
   * @param {string} key
   * @param {string[]} urls
   * @param {() => boolean} isReady
   * @returns {Promise<void>}
   */
  function loadScriptOnce(key, urls, isReady) {
    if (isReady()) return Promise.resolve();
    if (_libPromises[key]) return /** @type {Promise<void>} */ (_libPromises[key]);
    _libPromises[key] = new Promise((resolve, reject) => {
      const tryNext = (/** @type {number} */ i) => {
        if (i >= urls.length) {
          _libPromises[key] = null; // дозволяємо повторну спробу пізніше
          reject(new Error('Не вдалося завантажити ' + key + ' (перевір інтернет)'));
          return;
        }
        const s = document.createElement('script');
        s.src = urls[i];
        s.onload = () => {
          if (isReady()) resolve();
          else { s.remove(); tryNext(i + 1); }
        };
        s.onerror = () => { s.remove(); tryNext(i + 1); };
        document.head.appendChild(s);
      };
      tryNext(0);
    });
    return /** @type {Promise<void>} */ (_libPromises[key]);
  }

  // Магічні байти: що НАСПРАВДІ всередині файлу. Чимало «.heic» — це
  // перейменовані JPEG (месенджери/конвертери), і libheif на них падає з
  // «Could not parse HEIF file», хоча браузер прочитав би їх сам.
  /**
   * @param {File} file
   * @returns {Promise<SniffResult>}
   */
  async function sniffImage(file) {
    /** @type {Uint8Array} */
    let b;
    try { b = new Uint8Array(await file.slice(0, 16).arrayBuffer()); }
    catch (_) { return { kind: 'unknown' }; }

    if (b.length >= 3 && b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF)
      return { kind: 'browser', mime: 'image/jpeg', ext: 'jpg' };
    if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47)
      return { kind: 'browser', mime: 'image/png', ext: 'png' };
    if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
      return { kind: 'browser', mime: 'image/gif', ext: 'gif' };
    if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
        b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
      return { kind: 'browser', mime: 'image/webp', ext: 'webp' };

    // ISO-BMFF: "ftyp" на зсуві 4, бренд на 8..11
    if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
      const brand = String.fromCharCode(b[8], b[9], b[10], b[11]).toLowerCase();
      if (brand === 'avif' || brand === 'avis')
        return { kind: 'browser', mime: 'image/avif', ext: 'avif' }; // сучасні браузери декодують AVIF нативно
      return { kind: 'heif', brand }; // heic/heix/mif1/msf1/hevc/…
    }
    return { kind: 'unknown' };
  }

  // Конвертер №1: libheif-js напряму — актуальний libheif, asm.js-збірка
  // з глобалом window.libheif (перевірений роками CDN-шлях). Декодуємо в canvas самі.
  /**
   * @param {File} file
   * @returns {Promise<Blob>}
   */
  async function convertViaLibheif(file) {
    await loadScriptOnce('libheif-js', [
      'https://cdn.jsdelivr.net/npm/libheif-js@1/libheif/libheif.js',
      'https://unpkg.com/libheif-js@1/libheif/libheif.js',
    ], () => !!(/** @type {any} */ (window).libheif));

    // Збірка може бути глобалом, фабрикою або мати .ready — приводимо до інстансу
    let lh = /** @type {any} */ (window).libheif;
    if (typeof lh === 'function') lh = lh();
    if (lh && typeof lh.then === 'function') lh = await lh;
    if (lh && lh.ready && typeof lh.ready.then === 'function') { try { await lh.ready; } catch (_) {} }
    if (!lh || typeof lh.HeifDecoder !== 'function') throw new Error('libheif: HeifDecoder недоступний');

    const buf = new Uint8Array(await file.arrayBuffer());
    const images = new lh.HeifDecoder().decode(buf);
    if (!images || !images.length) throw new Error('у файлі не знайдено зображень');

    const image = images[0]; // burst/sequence → основний кадр
    const w = image.get_width(), h = image.get_height();
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context недоступний');
    const imageData = ctx.createImageData(w, h);
    await new Promise((resolve, reject) => {
      image.display(imageData, (/** @type {boolean} */ ok) => ok ? resolve(undefined) : reject(new Error('не вдалося декодувати кадр HEIC')));
    });
    try { images.forEach((/** @type {any} */ im) => { if (typeof im.free === 'function') im.free(); }); } catch (_) {}
    ctx.putImageData(imageData, 0, 0);

    return new Promise((resolve, reject) =>
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/jpeg', 0.9)
    );
  }

  // Конвертер №2: heic-to (свіжий libheif). IIFE-збірки на CDN може не бути,
  // тому запасний шлях — ESM через jsdelivr /+esm (динамічний import()
  // працює і зі звичайних, не-module скриптів)
  /**
   * @param {File} file
   * @returns {Promise<Blob>}
   */
  async function convertViaHeicTo(file) {
    let fn = /** @type {any} */ (window).HeicTo || null;
    if (!fn) {
      try {
        await loadScriptOnce('heic-to', [
          'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/dist/iife/heic-to.js',
        ], () => !!(/** @type {any} */ (window).HeicTo));
        fn = /** @type {any} */ (window).HeicTo;
      } catch (_) {
        // URL у змінній (не рядковий літерал напряму в import()) — інакше
        // TS намагається статично резолвити модуль і падає з TS2307.
        const heicToEsmUrl = 'https://cdn.jsdelivr.net/npm/heic-to@1.5.2/+esm';
        const m = /** @type {any} */ (await import(heicToEsmUrl));
        fn = m.heicTo || (m.default && m.default.heicTo) || m.default;
      }
    }
    if (typeof fn !== 'function') throw new Error('heic-to недоступний');
    return fn({ blob: file, type: 'image/jpeg', quality: 0.9 });
  }

  // Конвертер №3 (останній шанс): heic2any — старий libheif, нові HEIC часто не парсить
  /**
   * @param {File} file
   * @returns {Promise<Blob>}
   */
  async function convertViaHeic2any(file) {
    await loadScriptOnce('heic2any', [
      'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js',
      'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js',
    ], () => !!(/** @type {any} */ (window).heic2any));
    const res = await (/** @type {any} */ (window).heic2any)({ blob: file, toType: 'image/jpeg', quality: 0.9 });
    return Array.isArray(res) ? res[0] : res; // heic-sequence (burst) → перший кадр
  }

  // file -> Promise<File>: HEIC/HEIF → JPEG, решта форматів — без змін
  /**
   * @param {File} file
   * @returns {Promise<File>}
   */
  async function normalize(file) {
    if (!isHeic(file)) return file;

    const sniff = await sniffImage(file);

    // Файл лише названий .heic, а всередині звичайний формат — конвертер не потрібен
    if (sniff.kind === 'browser') {
      const name = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.' + sniff.ext;
      return new File([file], name, { type: sniff.mime, lastModified: file.lastModified || Date.now() });
    }

    // Справжній HEIF (або невідомий контейнер): конвертери по черзі
    if (sniff.kind === 'heif') console.info('[Img] HEIF, бренд «' + sniff.brand + '» — конвертую в JPEG…');
    /** @type {unknown} */
    let lastErr = null;
    const converters = [convertViaLibheif, convertViaHeicTo, convertViaHeic2any];
    for (let i = 0; i < converters.length; i++) {
      try {
        const jpegBlob = await converters[i](file);
        const name = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
        return new File([jpegBlob], name, { type: 'image/jpeg', lastModified: file.lastModified || Date.now() });
      } catch (e) {
        lastErr = e;
        console.warn('[Img] конвертер HEIC #' + (i + 1) + ' не впорався:', e);
      }
    }
    const e = /** @type {{ message?: unknown }} */ (typeof lastErr === 'object' && lastErr !== null ? lastErr : {});
    throw new Error(e.message ? String(e.message) : 'формат не підтримується');
  }

  // file -> Promise<{ blob, ext, contentType }>
  // maxSide: довша сторона (px), quality: 0..1
  /**
   * @param {File} file
   * @param {number} [maxSide]
   * @param {number} [quality]
   * @returns {Promise<{ blob: Blob, ext: string, contentType: string }>}
   */
  async function compress(file, maxSide, quality) {
    maxSide = maxSide || 1280;
    quality = quality || 0.78;

    // Страховка: HEIC декодуємо в JPEG, інакше Image/canvas впадуть
    file = await normalize(file);
    const side = maxSide;
    const q = quality;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
          let w = img.naturalWidth, h = img.naturalHeight;
          if (w > side || h > side) {
            const r = Math.min(side / w, side / h);
            w = Math.round(w * r); h = Math.round(h * r);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('canvas 2d context недоступний')); return; }
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
            q
          );
        };
        // readAsDataURL гарантує, що result — рядок (не ArrayBuffer)
        img.src = /** @type {string} */ (e.target?.result);
      };
      reader.readAsDataURL(file);
    });
  }

  return { compress, supportsWebp, isHeic, normalize };
})();
