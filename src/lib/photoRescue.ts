// ============================================================
// Рятунок завеликих оригіналів (винесено з <Photo>, ADR-0212).
// ------------------------------------------------------------
// Supabase не трансформує знімки понад свою межу роздільності і віддає 400
// («The source image resolution is too large to process»). В архіві пари
// такий є — 6144×8160, 11.4 МБ. <Photo> рятував його сам, а повноекранний
// перегляд і мапа спогадів брали мініатюру напряму — і показували биту
// картинку. Тепер рятунок спільний.
//
// Пам'ять про такі знімки — у `localStorage`: інакше кожен візит спершу
// платить за гарантований 400. Сховище може бути недоступне (приватний
// режим) — тоді пам'ять живе до кінця сесії, і це лише повільніше, а не
// зламано.
// ============================================================

const STORAGE_KEY = 'amore:oversized-photos';
const LIMIT = 200;

/** Адреса без `?t=…`: той самий файл після перезавантаження — той самий ключ. */
function keyOf(url: string): string {
  return url.split('?', 1)[0] ?? url;
}

let known: Set<string> | null = null;

function load(): Set<string> {
  if (known !== null) return known;
  known = new Set();
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw === null ? [] : JSON.parse(raw);
    if (Array.isArray(parsed)) for (const item of parsed) if (typeof item === 'string') known.add(item);
  } catch (error) {
    console.warn('[photoRescue] пам\'ять про завеликі знімки не прочиталась:', error);
  }
  return known;
}

/** Чи вже відомо, що сховище не зменшить цей знімок. */
export function isOversizedPhoto(url: string | null | undefined): boolean {
  if (!url) return false;
  return load().has(keyOf(url));
}

/** Запам'ятати, що мініатюра цього знімка впала. */
export function markOversizedPhoto(url: string | null | undefined): void {
  if (!url) return;
  const set = load();
  const key = keyOf(url);
  if (set.has(key)) return;
  set.add(key);
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...set].slice(-LIMIT)));
    }
  } catch (error) {
    console.warn('[photoRescue] пам\'ять про завеликі знімки не записалась:', error);
  }
}

/** Лише для тестів: забути все, що модуль пам'ятає в цій сесії. */
export function resetOversizedPhotosForTest(): void {
  known = null;
}

/**
 * Оригінал → маленький blob, декодований одразу в потрібний розмір.
 *
 * `null`, коли рятувати нічим (немає `createImageBitmap`, мережа
 * підвела чи файл узагалі не зображення) — тоді компонент показує
 * порожню рамку, а не застигає на повному оригіналі вдруге.
 */
export async function rescueOversizedOriginal(url: string, targetPx: number): Promise<Blob | null> {
  if (typeof createImageBitmap !== 'function') return null;
  const response = await fetch(url);
  if (!response.ok) return null;
  const source = await response.blob();
  const bitmap = await createImageBitmap(source, {
    /*
     * СТОРОНА ОДНА, І ЦЕ ВИПРАВЛЕННЯ.
     *
     * Тут стояли ОБИДВІ — `resizeWidth` і `resizeHeight` з тим самим
     * числом, — а це не «вписати в квадрат», це «стиснути рівно в ці
     * числа». Виміряно в справжньому Chromium на знімку 200×100:
     * обидві сторони по 64 дають 64×64, тобто пропорції гинуть; сама
     * лише ширина дає 64×32.
     *
     * Тобто кожне неквадратне фото, яке доходило до рятунку, лягало на
     * екран розплющеним. Помітно це було рівно там, де рятунок і потрібен
     * — на великих знімках у повний екран.
     *
     * Довгу сторону доводить до межі полотно нижче: до нього доїжджає вже
     * маленький растр, тож це безкоштовно.
     */
    resizeWidth: targetPx,
    resizeQuality: 'medium',
    /*
     * ОРІЄНТАЦІЯ ЗАДАЄТЬСЯ ЯВНО, і це не педантизм.
     *
     * `<img>` повертає знімок за EXIF сам (`image-orientation: from-image`
     * — типове значення), а `createImageBitmap` довгий час цього не
     * робив: у першій редакції специфікації типовим було `none`, і
     * браузери переходили на `from-image` у різні роки. Отже рятівний
     * шлях міг покласти на екран знімок, повернутий на 90°, — і саме там,
     * де інші шляхи його повертають правильно, тобто по-різному на різних
     * платформах.
     *
     * Один рядок прибирає залежність від версії браузера.
     */
    imageOrientation: 'from-image',
  });
  try {
    // Портретний знімок після `resizeWidth` лишається вищим за межу —
    // доводимо довгу сторону тут.
    let w = bitmap.width;
    let h = bitmap.height;
    if (h > targetPx) {
      const r = targetPx / h;
      w = Math.max(1, Math.round(w * r));
      h = Math.max(1, Math.round(h * r));
    }
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });
  } finally {
    bitmap.close();
  }
}

