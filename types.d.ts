// ============================================================
// Amore — спільні типи для поступової JSDoc-типізації.
//
// Цей файл НІКОЛИ не підключається через <script> в index.html і не
// впливає на рантайм чи деплой (GitHub Pages про нього навіть не знає).
// Він існує лише для редактора (VS Code) та опційного `tsc --checkJs`.
//
// Немає жодного import/export на верхньому рівні — тому TypeScript
// трактує файл як звичайний global-скрипт (так само, як наші .js через
// <script defer>, без модулів). Це означає: усі типи нижче доступні в
// JSDoc будь-якого .js-файлу просто за іменем, без @typedef {import(...)}.
//
// Стратегія "поступово": jsconfig.json підключає до перевірки лише файли,
// які вже типізовані (зростаючий allowlist — наразі lib/cache.js,
// lib/retry.js, modules/wishlist.js, modules/map.js, modules/auth.js).
// Для модулів, які ЩЕ не підключені (img.js, error-boundary.js,
// confetti.js, mapboxgl/supabase з CDN) — нижче є мінімальні
// `declare const` контракти, щоб типізовані файли могли їх викликати.
// Коли дійде черга типізувати самі ці модулі — відповідний declare тут
// видаляється, і jsconfig.json підхоплює РЕАЛЬНИЙ виведений тип із
// самого файла (так уже сталось із Auth і Retry).
// ============================================================

// ---------- Користувачі ----------

/**
 * Рядок таблиці `users`, як його бачить клієнт. Лише ці дві колонки
 * читабельні для anon/authenticated (pin_hash/email/chat_id закриті —
 * див. supabase/migrations.sql, revoke select).
 */
interface AppUser {
  id: number;
  name: string;
}

// ---------- Supabase — загальна форма відповіді ----------

/** Мінімум полів PostgrestError, які реально читаються в коді (error.message). */
interface SupaError {
  message: string;
}

/** Форма відповіді supabase.from(...).select/insert/update/delete(...). */
interface SupaResult<T> {
  data: T | null;
  error: SupaError | null;
}

// ---------- Wishlist (modules/wishlist.js) ----------

type WishPriority = 'high' | 'medium' | 'low';

/** Рядок таблиці `wishlist_items`. */
interface WishlistItem {
  id: number;
  title: string;
  description: string | null;
  link: string | null;
  image_url: string | null;
  gift_date: string | null;
  owner: number;
  reserved: boolean;
  reserved_by: number | null;
  price: number | null;
  priority: WishPriority | null;
  fulfilled: boolean;
  fulfilled_by: number | null;
  fulfilled_at: string | null;
}

/** Підмножина полів для архіву виконаних — саме це повертає loadFulfilledItems(). */
type FulfilledWishlistItem = Pick<
  WishlistItem,
  'id' | 'title' | 'description' | 'link' | 'image_url' | 'price' | 'priority' | 'fulfilled_at' | 'fulfilled_by'
>;

/** Поля форми модалки додавання/редагування — те, що реально йде в insert/update. */
interface WishlistItemPayload {
  title: string;
  link: string | null;
  image_url: string | null;
  price: number | null;
  priority: WishPriority | null;
  description: string | null;
}

// ---------- Карта (modules/map.js) ----------

type PinCategory = 'visited' | 'restaurant' | 'plan' | 'favorite';

/** Рядок таблиці `map_pins`. */
interface MapPin {
  id: number;
  title: string;
  note: string | null;
  category: PinCategory;
  lat: number;
  lng: number;
  photo_url: string | null;
  rating: number | null;
  review: string | null;
  city: string | null;
}

/** Група пінів за містом для списку під картою (groupPinsByCity). */
interface PinCityGroup {
  city: string;
  pins: MapPin[];
}

/** Результат reverseGeocode() — те, що з нього реально використовується. */
interface GeocodeResult {
  address: string;
  city: string;
}

/** Мінімум полів фічі з Mapbox Geocoding API, які реально читаються. */
interface MapboxFeature {
  text?: string;
  place_name?: string;
  center: [number, number];
  place_type?: string[];
  address?: string;
  context?: Array<{ id: string; text?: string }>;
}

/** Рядок таблиці `location_history` (архів чекінів за 24г). */
interface LocationHistoryRecord {
  user_id: number;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  created_at: string;
}

/** Рядок таблиці `user_locations` (поточне місцезнаходження). */
interface UserLocationRow {
  user_id: number;
  lat: number;
  lng: number;
  updated_at: string;
}

// ---------- Ще не типізовані глобалі з інших модулів ----------
// Мінімальні контракти — прибрати звідси, коли відповідний файл
// приєднається до jsconfig.json "include" зі своєю справжньою JSDoc-типізацією.

/**
 * lib/supabase.js — клієнт @supabase/supabase-js, підключений через CDN
 * (script-тег, без npm). Офіційних .d.ts без npm-інсталяції не отримати,
 * тому лишається `any` — єдиний свідомий і задокументований виняток із
 * "уникай any" у цьому файлі: ми не типізуємо чужу бібліотеку, яку не
 * контролюємо, а типізуємо ДАНІ, що з неї отримуємо (SupaResult<T> +
 * явний @type-каст на місці деструктуризації { data, error }).
 */
declare const supabase: any;

/**
 * Mapbox GL JS — довантажується динамічно в modules/map.js
 * (loadMapboxResources), сам скрипт-тег теж не в репо. Той самий
 * свідомий виняток, що й supabase.
 */
declare const mapboxgl: any;

declare const Img: {
  isHeic(file: File): boolean;
  normalize(file: File): Promise<File>;
  compress(
    file: File,
    maxSize: number,
    quality: number
  ): Promise<{ blob: Blob; ext: string; contentType: string }>;
};

declare const ErrorBoundary: {
  showToast(message: string, kind?: 'success' | 'warn' | 'error'): void;
};

declare const Confetti: {
  burst(count?: number): void;
};

/** Глобальний хелпер закриття модалок, оголошений inline-скриптом у index.html. */
declare function closeModalAnimated(rootId?: string): void;
