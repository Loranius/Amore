// ============================================================
// Скільки карток галерея малює за раз.
// ------------------------------------------------------------
// Галерея малювала ВЕСЬ архів одразу. На тридцяти семи спогадах це
// непомітно, і саме тому питання не поставало; на п'ятистах — це вже
// близько чотирьох тисяч вузлів DOM і до двох із половиною тисяч
// `<img>`, збудованих у першому ж кадрі розділу.
//
// **Чому не `content-visibility: auto`.** Це була перша спроба, і її
// перевірено на живому екрані: правило вмикає ще й containment розміру,
// тож картка перестає брати ширину з сітки — кадри роздулись на всю
// клітинку, віяло поїхало, підписи перенеслись інакше. Тобто рецепт,
// який зазвичай саме для цього й existує, тут ламає саме ту геометрію,
// заради якої галерея й зроблена (`momentStyle.ts`).
//
// **Чому не повна віртуалізація.** Вона знімає картки, які вийшли з
// екрана, і разом із ними — висоту під ними; будь-яка похибка оцінки
// висоти зсуває те, що пара зараз читає. Для архіву, який гортають
// зверху вниз і рідко повертаються, ціна не виправдана.
//
// Тому — нарощування: сторінка ніколи не ЗМЕНШУЄ показане, лише додає
// наступну пачку, коли пара дійшла до кінця. Вже намальоване лишається
// на місці, тож прокрутка не стрибає ніколи, а перший кадр коштує
// стільки ж і на тридцяти семи спогадах, і на п'ятистах.
// ============================================================

/**
 * Перша пачка.
 *
 * На телефоні 412×915 у сітці 2×N видно приблизно дев'ять карток; 24 —
 * це два з половиною екрани запасу, тобто пара встигає почати гортати
 * раніше, ніж дійде до межі.
 */
export const MEMORIES_FIRST_PAGE = 24;

/** Наступні пачки такі самі: причина та сама, що й у першої. */
export const MEMORIES_PAGE_STEP = 24;

/** Скільки карток показати одразу після завантаження архіву. */
export function initialMemoriesCount(
  total: number,
  first: number = MEMORIES_FIRST_PAGE,
): number {
  return Math.min(Math.max(0, total), first);
}

/**
 * Скільки показати після того, як пара догортала до кінця.
 *
 * Ніколи не менше за поточне: зменшення прибрало б із-під пальця те, що
 * вже намальовано, і прокрутка стрибнула б.
 */
export function nextMemoriesCount(
  current: number,
  total: number,
  step: number = MEMORIES_PAGE_STEP,
): number {
  return Math.min(Math.max(0, total), Math.max(current, current + step));
}

/** Чи лишилось іще що показувати. */
export function hasMoreMemories(shown: number, total: number): boolean {
  return shown < total;
}

// ── Місце на нитці після «назад» (ADR-0251) ─────────────────

/**
 * Де пара була на нитці, коли відкрила спогад.
 *
 * Без цього кожне «назад» кидало на початок року: `Layout` прокручує
 * вміст нагору при зміні маршруту, а галерея знову малювала лише першу
 * пачку. Головна робота модуля — гортати й згадувати, і саме вона
 * ламалась на кожному спогаді.
 */
export interface GalleryPlace {
  top: number;
  shown: number;
}

const PLACE_KEY = 'amore:memories-place';

/**
 * Скільки спогадів намалювати, повертаючись на нитку.
 *
 * Не менше, ніж було намальовано, — інакше прокрутка відновилась би в
 * порожнечу під останньою пачкою; і не більше, ніж є в архіві.
 */
export function restoredShown(total: number, saved: GalleryPlace | null): number {
  const first = initialMemoriesCount(total);
  if (!saved) return first;
  return Math.min(Math.max(0, total), Math.max(first, Math.trunc(saved.shown)));
}

/** Сховище може бути недоступне або зіпсоване — тоді місця просто немає. */
export function readGalleryPlace(storage: Pick<Storage, 'getItem'> | null): GalleryPlace | null {
  try {
    const raw = storage?.getItem(PLACE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<GalleryPlace>;
    return Number.isFinite(value.top) && Number.isFinite(value.shown)
      ? { top: value.top as number, shown: value.shown as number }
      : null;
  } catch {
    return null;
  }
}

export function writeGalleryPlace(storage: Pick<Storage, 'setItem'> | null, place: GalleryPlace): void {
  try {
    storage?.setItem(PLACE_KEY, JSON.stringify(place));
  } catch {
    // Повне чи заборонене сховище коштує лише відновлення місця.
  }
}
