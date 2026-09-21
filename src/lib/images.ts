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

/**
 * normalize() + прев'ю як data URL — той самий блок коду був
 * продубльований у WishFormModal.tsx і PhotoDayModal.tsx (HEIC →
 * нормалізація → FileReader → dataURL для миттєвого прев'ю ще до
 * завантаження). Кидає з тим самим текстом помилки, що й раніше —
 * виклик обгортає try/catch і сам показує тост.
 */
export async function normalizeToPreview(file: File): Promise<{ file: File; previewSrc: string }> {
  const normalized = await normalize(file);
  const previewSrc = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Не вдалося прочитати файл'));
    reader.onload = (e) => resolve((e.target?.result as string) ?? '');
    reader.readAsDataURL(normalized);
  });
  return { file: normalized, previewSrc };
}

// ── compress: canvas, WebP з фолбеком на JPEG ────────────────
export interface CompressResult {
  blob: Blob;
  ext: string;
  contentType: string;
}

/**
 * ОДНЕ ЧИСЛО ЯКОСТІ НА ДВА ФОРМАТИ — ЦЕ ДВІ РІЗНІ ЯКОСТІ.
 *
 * `compress` віддає WebP там, де полотно вміє його кодувати, і JPEG там,
 * де не вміє. Це не наш вибір: `canvas.toDataURL('image/webp')` є в
 * Chrome (андроїд, віндовс) і довго не було в Safari — тобто формат
 * майстер-файла вирішує ТЕЛЕФОН, з якого пара додала знімок.
 *
 * Поки число було спільним, 0.78 означало помітно різну картинку: WebP
 * на 0.78 приблизно відповідає JPEG на 0.88, а JPEG на 0.78 уже дає
 * блоки на градієнтах — на небі, на шкірі, на розмитому тлі. Той самий
 * кадр, доданий з айфона й з андроїда, зберігався по-різному, і різницю
 * було видно на ВСІХ платформах, бо майстер-файл один на всіх.
 *
 * Тому число, яке передає місце виклику, тепер означає якість У ШКАЛІ
 * WEBP, а JPEG дістає свій відповідник. Кожне місце й далі каже, чого
 * вартий саме його знімок («обкладинка — 0.84»), і каже це один раз.
 *
 * ЧИСЛО ТУТ НЕ ВИМІРЯНЕ. Виміряти чужий кодувальник у пісочниці без
 * браузера нічим; +0.10 узято з відомого співвідношення форматів і
 * записано як припущення, а не як вимір.
 */
const WEBP_QUALITY = 0.78;
const JPEG_OVER_WEBP = 0.1;
const JPEG_CEILING = 0.95;

/** Якість JPEG, приблизно рівноцінна заданій якості WebP. */
export function jpegEquivalent(webpQuality: number): number {
  const safe = Number.isFinite(webpQuality) ? Math.min(1, Math.max(0, webpQuality)) : WEBP_QUALITY;
  return Math.min(JPEG_CEILING, safe + JPEG_OVER_WEBP);
}

/** Полотно потрібного розміру → блоб. Спільний хвіст обох шляхів. */
function encode(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  w: number,
  h: number,
  quality: number,
): Promise<CompressResult> {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('canvas 2d context недоступний'));
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  draw(ctx, w, h);

  const useWebp = supportsWebp();
  const type = useWebp ? 'image/webp' : 'image/jpeg';
  const ext = useWebp ? 'webp' : 'jpg';
  const chosen = useWebp ? quality : jpegEquivalent(quality);
  return new Promise<CompressResult>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, ext, contentType: type }) : reject(new Error('toBlob failed'))),
      type,
      chosen,
    );
  });
}

/**
 * ЗАПАСНИЙ ШЛЯХ ДЛЯ ВЕЛЕТНІВ: декодувати ОДРАЗУ в потрібний розмір.
 *
 * Головний шлях (нижче) читає файл у `<img>`, тобто розпаковує ВЕСЬ
 * растр у пам'ять, щоб потім намалювати з нього кадр 1600 пікселів
 * завширшки. На знімку 6144×8160 — а такий у архіві пари є, 50
 * мегапікселів і 11.4 МБ — це 200 МБ самого лише растру.
 *
 * ЧЕСНА МЕЖА: чому саме той знімок не стиснувся на телефоні пари, ми
 * НЕ знаємо — помилки з того телефона немає, є лише оригінал у сховищі.
 * Пам'ять — здогад, і він тут названий здогадом. Твердо відомо інше:
 * стиснення впало, а старий код на це відповідав тим, що клав у сховище
 * оригінал. Цей шлях існує, щоб на падіння відповідати спробою, а не
 * капітуляцією, — хай би яка була причина.
 *
 * `createImageBitmap` із `resizeWidth` просить браузер віддати вже
 * зменшене зображення, не тримаючи повного растру. Перевірено на живому
 * модулі в справжньому Chromium зі зламаним головним декодером:
 * 4000×3000 доходить сюди й виходить **1600×1200**.
 *
 * ЧИСЛА В МІЛІСЕКУНДАХ ТУТ НЕ ЗАПИСАНІ НАВМИСНО. Єдиний браузер, який у
 * цій пісочниці є, малює програмно, і час у ньому йде приблизно вдвадцятеро
 * повільніше (пастка №7 у `scripts/live/README.md`). Виміряти, що саме
 * швидше, тут можна; сказати, скільки це на телефоні пари, — ні.
 *
 * ЧОМУ ЦЕ ЗАПАСНИЙ ШЛЯХ, А НЕ ГОЛОВНИЙ. `resizeWidth` працює в обидва
 * боки: знімок 400×300 він РОЗТЯГНЕ до 1600×1200, і ми поклали б у
 * сховище більший файл, ніж принесли. Дізнатись справжні сторони
 * наперед можна лише декодуванням, тобто тим самим, чого ми уникаємо.
 * Тому порядок такий: спершу чесний шлях, який ніколи не збільшує, а
 * коли він не впорався — цей.
 *
 * Той самий прийом уже живе в `components/ui/Photo.tsx` (рятунок
 * завеликого оригіналу) і той самий порядок «два декодери по черзі» —
 * у `normalize` вище: різні файли валять різні декодери.
 *
 * ШИРИНА ЗАДАЄТЬСЯ ОДНА. Якщо передати обидві сторони, браузер стискає
 * зображення саме в ці числа й **пропорції гинуть**: 200×100 при обох
 * сторонах по 64 дає рівно 64×64, а сама лише ширина — 64×32. Довгу
 * сторону доводить до межі вже полотно, і це безкоштовно: до нього
 * доїжджає вже маленький растр.
 *
 * Перевірено на цьому модулі, а не на здогаді: зі зламаним `<img>`
 * знімок 200×100 виходить звідси **1600×800**, а 100×200 — **800×1600**.
 * З двома сторонами обидва дали б 1600×1600.
 */
async function compressViaBitmap(
  file: Blob,
  maxSide: number,
  quality: number,
): Promise<CompressResult> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap недоступний');
  }
  const bitmap = await createImageBitmap(file, {
    resizeWidth: maxSide,
    resizeQuality: 'high',
    // Орієнтація явно — з тієї ж причини, що й у `Photo.tsx`: типове
    // значення міняли між редакціями специфікації, і без цього рядка
    // знімок міг лягти поверненим на 90° лише на частині браузерів.
    imageOrientation: 'from-image',
  });
  try {
    let w = bitmap.width;
    let h = bitmap.height;
    if (h > maxSide) {
      const r = maxSide / h;
      w = Math.round(w * r);
      h = Math.round(h * r);
    }
    return await encode((ctx, cw, ch) => ctx.drawImage(bitmap, 0, 0, cw, ch), w, h, quality);
  } finally {
    bitmap.close();
  }
}

export function compress(
  file: File,
  maxSide = 1280,
  /** Якість у шкалі WebP; для JPEG перекладається `jpegEquivalent`. */
  quality = WEBP_QUALITY,
): Promise<CompressResult> {
  return normalize(file).then(
    (normalized) =>
      new Promise<CompressResult>((resolve, reject) => {
        /*
         * Об'єктний URL, а не читання файлу в рядок base64.
         *
         * Base64 роздуває файл приблизно на третину: 11 МБ знімка ставали
         * рядком на ~14.5 МБ, який мусив лежати в пам'яті ПОРУЧ із
         * розпакованим растром. Об'єктний URL не копіює нічого.
         */
        const url = URL.createObjectURL(normalized);
        const img = new Image();
        const done = <T,>(fn: (value: T) => void) => (value: T) => {
          URL.revokeObjectURL(url);
          fn(value);
        };
        const fail = done(reject);
        img.onerror = () => fail(new Error('не вдалося прочитати зображення'));
        img.onload = () => {
          let w = img.naturalWidth;
          let h = img.naturalHeight;
          if (w > maxSide || h > maxSide) {
            const r = Math.min(maxSide / w, maxSide / h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          encode((ctx, cw, ch) => ctx.drawImage(img, 0, 0, cw, ch), w, h, quality)
            .then(done(resolve), fail);
        };
        img.src = url;
      })
        /*
         * НЕ ЗДАЄМОСЬ МОВЧКИ — І НЕ ЗДАЄМОСЬ ОРИГІНАЛОМ.
         *
         * Тут закінчувалось усе, а троє викликачів ловили помилку й лили
         * в сховище ОРИГІНАЛ, пишучи про це лише в консоль. Пара не
         * бачила нічого, а в сховищі осідав знімок на 11 МБ, який
         * Supabase відмовляється трансформувати («The source image
         * resolution is too large to process»), тож кожен показ коштував
         * рятівного декодування в `Photo.tsx`: браузер розпаковує всі
         * 50 мегапікселів заради кадру 96 пікселів завширшки.
         *
         * Тепер невдача головного шляху — привід СПРОБУВАТИ ІНАКШЕ, а не
         * привід підсунути те, чого портал не вміє показати.
         */
        .catch(() => compressViaBitmap(normalized, maxSide, quality)),
  );
}
