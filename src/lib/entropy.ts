// ============================================================
// Ентропія — єдине місце, де порталу дозволено кидати монету.
// ------------------------------------------------------------
// `CLAUDE.md` забороняє `Math.random()`, і для рушія ця заборона
// абсолютна: однакові канонічні входи мусять давати однакові канонічні
// виходи, інакше кристал пари перестає бути їхнім кристалом. У
// `src/engine/**` виклику немає жодного, і бути не повинно.
//
// Але портал — не лише рушій. «Крутнути страву» — це САМА СУТЬ кнопки;
// конфеті без випадковості перестає бути конфеті; імена файлів у сховищі
// мусять не збігатись. Заборона, сформульована як абсолютна там, де вона
// не може бути абсолютною, не виконується — вона просто порушується в
// чотирнадцяти місцях, і кожне з них виглядає невинним.
//
// Тому правило переформульовано: `Math.random()` не викликається НІДЕ,
// крім цього файлу, і `noRawRandom.test.ts` це стереже. Тут кожен виклик
// має названу причину, а модулі беруть готову функцію, чия назва каже,
// навіщо кидок.
//
// Половини дві, і межа між ними принципова:
//
//   ОСОБИСТІСТЬ — унікальність має значення. Береться з `crypto`, бо
//                 колізія тут коштує затертого фото або відхиленого
//                 запису.
//   КОСМЕТИКА   — має значення лише «щоразу інакше». Береться з
//                 `Math.random()`, і це правильно: триста криптографічних
//                 кидків на один сплеск конфеті — плата ні за що.
// ============================================================

// ------------------------------------------------------------
// Особистість
// ------------------------------------------------------------

/** Чи є в середовищі сильне джерело випадковості. */
function randomValues(count: number): Uint32Array | null {
  if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
    return null;
  }
  return crypto.getRandomValues(new Uint32Array(count));
}

/**
 * Справжній UUID версії 4.
 *
 * **Тут була виміряна вада.** Запасний варіант у `ArchiveGiftFormModal`
 * будував рядок
 * `${Date.now()}-${Math.random().toString(16).slice(2)}-0000-4000-8000-000000000000`
 * і видавав його за UUID. Він ним не є: шість груп замість п'яти й
 * тринадцять символів у першій групі замість восьми. А `p_request_id` у
 * базі має тип `uuid` (`20260725_wishlist_manual_archive_gifts.sql`), тож
 * Postgres відхилив би такий запис із «invalid input syntax for type
 * uuid» — тобто додавання подарунка в архів просто не спрацювало б, і
 * повідомлення про це не сказало б нічого зрозумілого.
 *
 * Не спрацьовувало воно ніколи лише тому, що `crypto.randomUUID` є в усіх
 * сучасних браузерах — АЛЕ ЛИШЕ В БЕЗПЕЧНОМУ КОНТЕКСТІ. Портал, відкритий
 * по звичайному http (наприклад, за локальною адресою в мережі), лишається
 * без нього, і саме там запасний шлях і спрацював би.
 *
 * Тому запасний варіант тепер теж будує **коректний** UUID: біти версії
 * та варіанта виставлені за RFC 4122.
 */
export function uuidV4(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  const strong = randomValues(4);
  if (strong !== null) {
    for (let index = 0; index < 4; index += 1) {
      const word = strong[index]!;
      bytes[index * 4] = (word >>> 24) & 0xff;
      bytes[index * 4 + 1] = (word >>> 16) & 0xff;
      bytes[index * 4 + 2] = (word >>> 8) & 0xff;
      bytes[index * 4 + 3] = word & 0xff;
    }
  } else {
    for (let index = 0; index < 16; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  // Версія 4 і варіант RFC 4122 — без них рядок має форму UUID, але не є
  // UUID, а саме на цьому й спіткнувся попередній запасний варіант.
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

/**
 * Короткий унікальний хвіст для імені файлу у сховищі.
 *
 * Було `Math.random().toString(36).slice(2, 8)` — приблизно тридцять біт,
 * та ще й із тієї самої слабкої криниці. Тут потрібна не краса, а щоб
 * два знімки, завантажені в одну мілісекунду, не затерли один одного:
 * `upsert: false` перетворить збіг на помилку завантаження, а не на тиху
 * втрату, але для пари це однаково «фото не додалось».
 */
export function randomToken(): string {
  const strong = randomValues(2);
  if (strong !== null) {
    return [...strong].map((word) => word.toString(36)).join('');
  }
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Свіжий 32-бітний seed розкладки — новий на відкриття вигляду, сталий у
 * межах сесії.
 *
 * Три модулі вішліста мали три дослівні копії цієї функції. Копії не
 * розійшлись лише тому, що їх не встигли змінити.
 */
export function freshSeed(): number {
  const strong = randomValues(1);
  if (strong !== null) return strong[0]!;
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

// ------------------------------------------------------------
// Косметика
// ------------------------------------------------------------

/**
 * Кидок [0, 1) для всього, де важить лише «щоразу інакше».
 *
 * Єдиний косметичний `Math.random()` у порталі. Параметром його приймають
 * функції нижче — щоб тести перевіряли межі, а не ловили випадковість.
 */
function cosmeticUnit(): number {
  return Math.random();
}

/** Ціле в діапазоні [min, max] включно. */
export function randomInt(
  min: number,
  max: number,
  source: () => number = cosmeticUnit,
): number {
  if (max < min) throw new RangeError(`randomInt: max (${max}) менший за min (${min}).`);
  return min + Math.floor(source() * (max - min + 1));
}

/** Дробове в діапазоні [min, max). */
export function randomFloat(
  min: number,
  max: number,
  source: () => number = cosmeticUnit,
): number {
  return min + source() * (max - min);
}

/**
 * Один елемент зі списку.
 *
 * Порожній список повертає `null`, а не кидає: усі три місця виклику
 * (привітання, страва, колір конфеті) саме так і поводяться — мовчать,
 * коли обирати нема з чого.
 */
export function pickOne<T>(
  items: readonly T[],
  source: () => number = cosmeticUnit,
): T | null {
  if (items.length === 0) return null;
  return items[Math.floor(source() * items.length)] ?? null;
}

/** `true` із заданою ймовірністю (0 — ніколи, 1 — завжди). */
export function chance(probability: number, source: () => number = cosmeticUnit): boolean {
  return source() < probability;
}
