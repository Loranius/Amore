// ============================================================
// IMAGES — HEIC-нормалізація + клієнтське стиснення (порт lib/img.js)
// ------------------------------------------------------------
// КРИТИЧНО (Фаза 4): логіка HEIC→JPEG і стиснення на клієнті перед
// завантаженням у Supabase Storage збережена. Що змінилось відносно
// старого коду: замість інжекту CDN-скриптів конвертери тепер —
// npm-пакети, підвантажені ДИНАМІЧНО (import()), тож важкі декодери
// HEIC потрапляють в окремий чанк і вантажаться лише коли реально
// обрано HEIC. Magic-byte sniffing (розпізнавання «фейкових» .heic,
// нативного AVIF тощо) — портований 1:1.
//
// Типи бібліотек heic-to / heic2any на межі виклику звужуємо вручну:
// це той самий свідомий виняток, що й для supabase-патча — ми не
// контролюємо форму чужого коду, лише власні дані.
// ============================================================

// ── Підтримка WebP через canvas ──────────────────────────────
let webpSupport: boolean | null = null;
export function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

// ── Детекція HEIC (MIME або розширення) ──────────────────────
export function isHeic(file: File | null | undefined): boolean {
  if (!file) return false;
  const t = (file.type || '').toLowerCase();
  if (t.includes('heic') || t.includes('heif')) return true;
  return /\.(heic|heif)$/i.test(file.name || '');
}

// ── Sniff за магічними байтами ───────────────────────────────
type SniffResult =
  | { kind: 'browser'; mime: string; ext: string }
  | { kind: 'heif'; brand: string }
  | { kind: 'unknown' };

async function sniffImage(file: File): Promise<SniffResult> {
  let b: Uint8Array;
  try {
    b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  } catch {
    return { kind: 'unknown' };
  }

  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff)
    return { kind: 'browser', mime: 'image/jpeg', ext: 'jpg' };
  if (b.length >= 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return { kind: 'browser', mime: 'image/png', ext: 'png' };
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38)
    return { kind: 'browser', mime: 'image/gif', ext: 'gif' };
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  )
    return { kind: 'browser', mime: 'image/webp', ext: 'webp' };

  // ISO-BMFF: 'ftyp' на зсуві 4, бренд на 8..11.
  if (b.length >= 12 && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8]!, b[9]!, b[10]!, b[11]!).toLowerCase();
    if (brand === 'avif' || brand === 'avis')
      return { kind: 'browser', mime: 'image/avif', ext: 'avif' };
    return { kind: 'heif', brand };
  }
  return { kind: 'unknown' };
}

// ── Конвертери HEIC (динамічний import) ──────────────────────
async function convertViaHeicTo(file: File): Promise<Blob> {
  const mod = (await import('heic-to')) as {
    heicTo?: (o: { blob: Blob; type: string; quality?: number }) => Promise<Blob>;
  };
  const fn = mod.heicTo;
  if (typeof fn !== 'function') throw new Error('heic-to недоступний');
  return fn({ blob: file, type: 'image/jpeg', quality: 0.9 });
}

async function convertViaHeic2any(file: File): Promise<Blob> {
  const mod = (await import('heic2any')) as {
    default: (o: { blob: Blob; toType: string; quality?: number }) => Promise<Blob | Blob[]>;
  };
  const res = await mod.default({ blob: file, toType: 'image/jpeg', quality: 0.9 });
  return Array.isArray(res) ? res[0]! : res; // burst-sequence → перший кадр
}

// ── normalize: HEIC/HEIF → JPEG; решта — без змін ────────────
export async function normalize(file: File): Promise<File> {
  if (!isHeic(file)) return file;

  const sniff = await sniffImage(file);

  // «.heic» лише за назвою, всередині звичайний формат — конвертер не потрібен.
  if (sniff.kind === 'browser') {
    const name = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.' + sniff.ext;
    return new File([file], name, {
      type: sniff.mime,
      lastModified: file.lastModified || Date.now(),
    });
  }

  if (sniff.kind === 'heif') {
    console.info(`[Images] HEIF, бренд «${sniff.brand}» — конвертую в JPEG…`);
  }

  // По черзі: свіжий heic-to, потім запасний heic2any (різні файли
  // валять різні декодери — саме тому їх два, як у старому коді).
  let lastErr: unknown = null;
  for (const convert of [convertViaHeicTo, convertViaHeic2any]) {
    try {
      const jpeg = await convert(file);
      const name = (file.name || 'photo').replace(/\.(heic|heif)$/i, '') + '.jpg';
      return new File([jpeg], name, {
        type: 'image/jpeg',
        lastModified: file.lastModified || Date.now(),
      });
    } catch (e) {
      lastErr = e;
      console.warn('[Images] конвертер HEIC не впорався:', e);
    }
  }
  const msg =
    lastErr && typeof lastErr === 'object' && 'message' in lastErr
      ? String((lastErr as { message: unknown }).message)
      : 'формат не підтримується';
  throw new Error(msg);
}

// ── compress: canvas, WebP з фолбеком на JPEG ────────────────
export interface CompressResult {
  blob: Blob;
  ext: string;
  contentType: string;
}

export function compress(file: File, maxSide = 1280, quality = 0.78): Promise<CompressResult> {
  return normalize(file).then(
    (normalized) =>
      new Promise<CompressResult>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
          const img = new Image();
          img.onerror = reject;
          img.onload = () => {
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > maxSide || h > maxSide) {
              const r = Math.min(maxSide / w, maxSide / h);
              w = Math.round(w * r);
              h = Math.round(h * r);
            }
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('canvas 2d context недоступний'));
              return;
            }
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, w, h);

            const useWebp = supportsWebp();
            const type = useWebp ? 'image/webp' : 'image/jpeg';
            const ext = useWebp ? 'webp' : 'jpg';
            canvas.toBlob(
              (blob) =>
                blob
                  ? resolve({ blob, ext, contentType: type })
                  : reject(new Error('toBlob failed')),
              type,
              quality,
            );
          };
          img.src = e.target?.result as string;
        };
        reader.readAsDataURL(normalized);
      }),
  );
}
