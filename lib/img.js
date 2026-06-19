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

  // file -> Promise<{ blob, ext, contentType }>
  // maxSide: довша сторона (px), quality: 0..1
  function compress(file, maxSide, quality) {
    maxSide = maxSide || 1280;
    quality = quality || 0.78;

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

  return { compress, supportsWebp };
})();
