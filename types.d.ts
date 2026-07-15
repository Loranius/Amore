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
// lib/retry.js, lib/img.js, lib/error-boundary.js, lib/confetti.js,
// modules/wishlist.js, modules/map.js, modules/auth.js). Для модулів,
// які ЩЕ не підключені (mapboxgl/supabase з CDN) — нижче є мінімальні
// `declare const` контракти, щоб типізовані файли могли їх викликати.
// Коли дійде черга типізувати самі ці модулі — відповідний declare тут
// видаляється, і jsconfig.json підхоплює РЕАЛЬНИЙ виведений тип із
// самого файла (так уже сталось із Auth, Retry, Img, ErrorBoundary, Confetti).
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

// ---------- Календар (modules/calendar.js) ----------

type EventType = 'birthday' | 'anniversary' | 'holiday' | 'other';

/** Рядок таблиці `events`. */
interface CalendarEvent {
  id: number;
  title: string;
  description: string | null;
  date: string;
  created_by: number | null;
  type: EventType | null;
  yearly: boolean | null;
}

/** events + обчислена дата найближчого настання (renderEvents). */
interface EnrichedEvent extends CalendarEvent {
  nextDate: Date;
  days: number;
  passed: boolean;
}

type PlanCategory = 'date' | 'dream' | 'trip' | 'goal' | 'other';
type PlanStatus = 'planned' | 'active' | 'done';

/**
 * "План" — це CalendarEvent з type:'other', де cat/status/doneAt
 * закодовані як [cat:x][status:y][doneAt:z]-теги всередині description
 * (parsePlan у calendar.js їх звідти витягує й прибирає з тексту нотатки).
 */
interface ParsedPlan extends EnrichedEvent {
  cat: PlanCategory;
  status: PlanStatus;
  doneAt: string | null;
  note: string;
}

// ---------- Капсула часу (modules/capsule.js) ----------

/** Рядок таблиці `time_capsules`. */
interface TimeCapsule {
  id: number;
  title: string;
  content: string;
  open_date: string;
  created_by: number | null;
}

// ---------- Медіа (modules/media.js) ----------

type MediaType = 'movie' | 'series' | 'book';
type MediaStatus = 'want' | 'watching' | 'done' | 'dropped';

/** Рядок таблиці `media_items`. */
interface MediaItem {
  id: number;
  type: MediaType;
  title: string;
  status: MediaStatus;
  poster_url: string | null;
  rating_dima: number | null;
  rating_lena: number | null;
  comment_dima: string | null;
  comment_lena: string | null;
  created_by: number | null;
}

/** Результат пошуку TMDB (tmdbSearch), уже приведений до нашої форми. */
interface TmdbSearchResult {
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  year: string;
  rating: string | null;
  overview: string;
}

/** Деталі фільму/серіалу з TMDB (fetchTmdbDetails) — те, що реально використовується. */
interface TmdbDetails {
  title: string;
  overview: string;
  year: string;
  rating: string | null;
  runtime: number | null;
  genres: string[];
  backdrop: string | null;
  poster: string | null;
  youtubeKey: string | null;
}

// ---------- Свайп-вотчліст (modules/swipe.js) ----------

type SwipeType = 'movie' | 'series';
type SwipeDirection = 'up' | 'down' | 'left' | 'right';

/** Картка з TMDB-фіда, приведена до форми, яку рендерить renderCard(). */
interface SwipeCard {
  tmdb_id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  year: string;
  rating: string | null;
}

// ---------- Список покупок (modules/shopping.js) ----------

/** Рядок таблиці `shopping_items`. id — рядок лише для оптимістичних temp_-записів до відповіді БД. */
interface ShoppingItem {
  id: number | string;
  title: string;
  qty: string | null;
  category: string;
  bought: boolean;
  created_by: number | null;
  bought_by: number | null;
  bought_at: string | null;
}

/** Одна позиція з fallback- чи AI-парсингу вводу (ще без id — до insert). */
interface ParsedShoppingLine {
  title: string;
  qty: string | null;
  category: string;
}

// ---------- Налаштування (modules/settings.js) ----------

/** Рядок таблиці `settings` (key/value; value або 'true'/'false', або boolean). */
interface AppSettingRow {
  key: string;
  value: string | boolean;
}

/** Мінімум полів файла зі Supabase Storage list(), які реально читаються. */
interface StorageFile {
  name: string;
}

/** Рядок таблиці `user_sizes`. */
interface UserSizes {
  user_id: number;
  height: number | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  intl_size: string | null;
  eu_size: string | null;
  ua_size: string | null;
  insole_cm: number | null;
  shoe_eu: string | null;
  shoe_us: string | null;
  bra: string | null;
  underwear: string | null;
  ring_ring: string | null;
  ring_index: string | null;
}

// ---------- Питання дня (modules/question.js) ----------

/** Рядок таблиці `daily_question_log`. */
interface DailyQuestionLog {
  id: number;
  date: string;
  question_id: number | null;
  answer_dima: string | null;
  answer_lena: string | null;
}

type AnswerField = 'answer_dima' | 'answer_lena';

/** Рядок таблиці `daily_questions`, або те саме з Edge Function daily-question-ai. */
interface QuestionPoolItem {
  id: number;
  text: string;
}

// ---------- Графік (modules/schedule.js) ----------

/** Рядок таблиці `work_schedule`. */
interface WorkScheduleRow {
  date: string;
  user_id: number;
  mark: string;
}

// ---------- Фотокалендар (modules/photo-calendar.js) ----------

/** Рядок таблиці `photo_calendar`. */
interface PhotoCalendarRow {
  id: number;
  date: string;
  user_id: number;
  photo_url: string;
  comment: string | null;
}

// ---------- Фінанси (modules/budget.js) ----------

/** Рядок таблиці `free_limit` (єдиний рядок, id=1). */
interface FreeLimitRow {
  limit_value: number | null;
  proposal_value: number | null;
  proposed_by: string | null;
}

/** Локально обчислена пропозиція ліміту (з FreeLimitRow, коли proposal_value є). */
interface FreeLimitProposal {
  value: number;
  proposedBy: string | null;
}

type GoalStatus = 'pending' | 'confirmed';

/** Рядок таблиці `savings_goals`. */
interface SavingsGoal {
  id: number;
  name: string;
  target_amount: number | null;
  url: string | null;
  description: string | null;
  status: GoalStatus;
  proposed_by: string | null;
  saved_amount: number | null;
}

// ---------- Куди піти (modules/whereto.js) ----------

/** Локація пари, збережена в settings (key: whereto_location, значення — JSON). */
interface WhereToLocation {
  region: string;
  city: string;
}

type EventKind = 'подія' | 'місце';

/** Один результат від Edge Function events-finder. */
interface WhereToEvent {
  kind: EventKind;
  title: string;
  price: string | null;
  when: string | null;
  place: string | null;
  off_note: string | null;
  description: string | null;
  url: string | null;
}

/** Спільний вихідний на найближчі дні (з work_schedule), для підказки events-finder. */
interface FreeDayInfo {
  date: string;
  off: string[];
}

/** Тіло запиту до events-finder. */
interface EventsFinderRequest {
  city: string;
  region: string;
  avoid: string[];
  freeDays: FreeDayInfo[];
}

// ---------- Realtime (lib/realtime.js) ----------

/** Один запис карти MAP у realtime.js: як реагувати на зміну таблиці. */
interface RealtimeTableConfig {
  keys?: string[];
  prefix?: string;
  views?: string[];
  refresh?: () => void;
  onChange?: () => void;
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

/** Глобальний хелпер закриття модалок, оголошений inline-скриптом у index.html. */
declare function closeModalAnimated(rootId?: string): void;

/** modules/router.js — ще не типізований, мінімальний контракт для інших модулів. */
declare const Router: {
  showView(name: string): void;
  getCurrentView(): string;
};

/** modules/random.js (Кулінарія) — ще не типізований, мінімальний контракт для Realtime. */
declare const RandomModule: {
  refresh(): void;
};
