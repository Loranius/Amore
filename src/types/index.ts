// ============================================================
// Amore — типові контракти (Фаза 1 міграції на React + TS)
// ------------------------------------------------------------
// Єдине джерело правди про форму даних. Файл суто типовий
// (erasable): жодного рантайм-коду, імпортується через
// `import type { ... } from '@/types'`.
//
// Джерела: аудит modules/*.js, lib/*.js, types.d.ts,
// supabase/functions/*/index.ts та supabase/migrations.sql
// старого (vanilla) коду.
//
// Runtime-перевірки (type guards: isUserName, isPlanMetadata …)
// живуть у src/lib/guards.ts — тут лише декларації.
// ============================================================

// ────────────────────────────────────────────────────────────
// 1. КОРИСТУВАЧІ
// ────────────────────────────────────────────────────────────

/**
 * У системі рівно два користувачі. Літеральна унія — навмисно:
 * ловить друкарські помилки в порівняннях (`name === 'Лена'` не
 * скомпілюється). На межі з БД значення валідується guard'ом
 * `isUserName` (lib/guards.ts), а не сліпим кастом.
 */
export type UserName = 'Діма' | 'Лєна';

/**
 * Користувач, як його бачить клієнт після auth-pin.
 * id — СТРОГО number по всьому коду. Порівняння id ніде не
 * робиться через String(...) — це і був клас багів shopping.js.
 */
export interface AppUser {
  id: number;
  name: UserName;
}

// ────────────────────────────────────────────────────────────
// 2. ДОВІДНИКОВІ УНІЇ (категорії / статуси)
// ────────────────────────────────────────────────────────────

/** Категорії покупок. Порядок = порядок відображення секцій.
 *  Синхронізовано з Edge Functions shopping-parse і tg-commands. */
export type ShoppingCategory =
  | 'Овочі' | 'Фрукти' | "М'ясо" | 'Морепродукти' | 'Напої' | 'Побут'
  | 'Посуд' | 'Гігієна' | 'Косметика' | 'Канцелярія' | 'Спорт' | 'Інше';

export type WishPriority = 'high' | 'medium' | 'low';

export type PinCategory = 'visited' | 'restaurant' | 'plan' | 'favorite';

export type EventType = 'birthday' | 'anniversary' | 'holiday' | 'other';

export type PlanCategory = 'date' | 'dream' | 'trip' | 'goal' | 'other';
export type PlanStatus = 'planned' | 'active' | 'done';

export type MediaType = 'movie' | 'series' | 'book';
export type MediaStatus = 'want' | 'watching' | 'done' | 'dropped';

export type SwipeType = 'movie' | 'series';
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export type DishCategory = 'meat' | 'vegan' | 'fast' | 'other';

export type GoalStatus = 'pending' | 'confirmed';

/** «подія» / «місце» — саме українськими словами, так повертає events-finder. */
export type WhereToKind = 'подія' | 'місце';

// ────────────────────────────────────────────────────────────
// 3. JSONB-ФОРМИ
// ────────────────────────────────────────────────────────────

/** Один інгредієнт у dishes.recipe. shop_cat додає лише culinary-ai. */
export interface RecipeIngredient {
  name: string;
  amount: string;
  unit: string;
  shop_cat?: ShoppingCategory;
}

/** Форма jsonb-колонки `dishes.recipe`. */
export interface Recipe {
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
}

/**
 * Метадані «Плану» — типізована заміна старих тегів
 * `[cat:x][status:y][doneAt:z]` всередині events.description.
 *
 * ⚠️ Потребує міграції (застосувати ДО деплою React-версії):
 *
 *   alter table public.events add column if not exists metadata jsonb;
 *   -- одноразовий бекфіл старих тегів → окремий скрипт міграції даних.
 *
 * Після бекфілу description містить лише чистий текст нотатки.
 */
export interface PlanMetadata {
  cat: PlanCategory;
  status: PlanStatus;
  /** ISO-дата виконання; null поки статус ≠ 'done'. */
  done_at: string | null;
}

// ────────────────────────────────────────────────────────────
// 4. РЯДКИ ТАБЛИЦЬ (Row)
// ------------------------------------------------------------
// Row = колонки, ВИДИМІ клієнту (anon/authenticated).
// Закриті колонки (users.pin_hash / email / chat_id — revoke
// select) свідомо відсутні: їх читає лише service_role в Edge
// Functions. Дати/таймстемпи — ISO-рядки, як їх віддає PostgREST.
// ────────────────────────────────────────────────────────────

export interface UsersRow {
  id: number;
  name: UserName;
}

export interface EventRow {
  id: number;
  title: string;
  description: string | null;
  /** 'YYYY-MM-DD' */
  date: string;
  created_by: number | null;
  type: EventType | null;
  yearly: boolean | null;
  /** Плани: заповнено лише для type:'other', інакше null. Див. PlanMetadata. */
  metadata: PlanMetadata | null;
}

export interface TimeCapsuleRow {
  id: number;
  title: string;
  content: string;
  /** 'YYYY-MM-DD' — дата, після якої капсулу можна відкрити. */
  open_date: string;
  created_by: number | null;
}

export interface MediaItemRow {
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

/** PK — композитний (user_id, tmdb_id): upsert з onConflict: 'user_id,tmdb_id'. */
export interface SwipeVoteRow {
  user_id: number;
  tmdb_id: number;
  title: string;
  poster_path: string | null;
  direction: SwipeDirection;
}

export interface ShoppingItemRow {
  /**
   * СТРОГО number. Оптимістичні записи до відповіді БД отримують
   * тимчасовий ВІД'ЄМНИЙ id (-Date.now()) і підмінюються справжнім
   * у onSuccess мутації — жодних 'temp_…'-рядків, як у старому коді.
   */
  id: number;
  title: string;
  qty: string | null;
  category: ShoppingCategory;
  bought: boolean;
  created_by: number | null;
  bought_by: number | null;
  bought_at: string | null;
  /** Час створення (серверний default). Читається лише для сортування списку. */
  created_at: string;
}

/**
 * key/value-сховище налаштувань. value історично неоднорідне:
 * булеві прапорці лежать і як 'true'/'false', і як boolean.
 * Читати ТІЛЬКИ через типізовані аксесори (lib/settings.ts),
 * які нормалізують значення за SettingsValueMap.
 */
export interface SettingsRow {
  key: string;
  value: string | boolean;
}

/** Відомі ключі settings та їхні розпарсені типи значень. */
export interface SettingsValueMap {
  /** ISO-дата початку стосунків (лічильник на головній). */
  relationship_start_date: string;
  /** JSON-рядок WhereToLocation. */
  whereto_location: WhereToLocation;
}
export type KnownSettingKey = keyof SettingsValueMap;

export interface UserSizesRow {
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

export interface DailyQuestionLogRow {
  id: number;
  /** 'YYYY-MM-DD' — один рядок на день. */
  date: string;
  question_id: number | null;
  answer_dima: string | null;
  answer_lena: string | null;
}

/** Колонка відповіді поточного користувача (обчислюється з AppUser.name). */
export type AnswerField = 'answer_dima' | 'answer_lena';

export interface DailyQuestionRow {
  id: number;
  text: string;
}

export interface WorkScheduleRow {
  /** 'YYYY-MM-DD' */
  date: string;
  user_id: number;
  /** Позначка зміни (синк із порталу «Тифліс»): 'Р' | 'Х'. */
  mark: string;
  /** Оновлюється при кожному записі (для onConflict-upsert). */
  updated_at?: string;
}

export interface PhotoCalendarRow {
  id: number;
  /** 'YYYY-MM-DD' */
  date: string;
  user_id: number;
  photo_url: string;
  comment: string | null;
}

/** Єдиний рядок (id = 1) — ліміт «вільних» витрат + поточна пропозиція. */
export interface FreeLimitRow {
  id: number;
  limit_value: number | null;
  proposal_value: number | null;
  /** Ім'я того, хто запропонував (історично текст, не FK). */
  proposed_by: string | null;
}

export interface SavingsGoalRow {
  id: number;
  name: string;
  target_amount: number | null;
  url: string | null;
  description: string | null;
  status: GoalStatus;
  /** Ім'я того, хто запропонував (історично текст, не FK). */
  proposed_by: string | null;
  saved_amount: number | null;
}

export interface MapPinRow {
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
  created_by: number | null;
}

/** Архів чекінів (останні 24 год). */
export interface LocationHistoryRow {
  user_id: number;
  lat: number;
  lng: number;
  address: string | null;
  city: string | null;
  created_at: string;
}

/** Поточне місцезнаходження (один рядок на користувача). */
export interface UserLocationRow {
  user_id: number;
  lat: number;
  lng: number;
  updated_at: string;
}

export interface WishlistItemRow {
  id: number;
  title: string;
  description: string | null;
  link: string | null;
  image_url: string | null;
  gift_date: string | null;
  owner: number;
  is_shared: boolean;
  reserved: boolean;
  reserved_by: number | null;
  price: number | null;
  priority: WishPriority | null;
  fulfilled: boolean;
  fulfilled_by: number | null;
  fulfilled_at: string | null;
}

export interface DishRow {
  id: number;
  title: string;
  category: DishCategory;
  recipe: Recipe | null;
  created_by: number | null;
}

// ────────────────────────────────────────────────────────────
// 5. DATABASE — контракт для createClient<Database>()
// ------------------------------------------------------------
// Формат сумісний із supabase-js v2: після
//   createClient<Database>(url, key)
// кожен .from('…').select/insert/update/delete типізований
// автоматично — це і є головний механізм «жодного any».
// ────────────────────────────────────────────────────────────

/** Insert: перелічені ключі обов'язкові, решта (id, дефолтні, nullable) — опційні. */
type InsertOf<R, RequiredK extends keyof R> = Pick<R, RequiredK> & Partial<Omit<R, RequiredK>>;

type TableDef<R, RequiredK extends keyof R> = {
  Row: R;
  Insert: InsertOf<R, RequiredK>;
  Update: Partial<R>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      users:              TableDef<UsersRow, 'name'>;
      events:             TableDef<EventRow, 'title' | 'date'>;
      time_capsules:      TableDef<TimeCapsuleRow, 'title' | 'content' | 'open_date'>;
      media_items:        TableDef<MediaItemRow, 'type' | 'title' | 'status'>;
      swipe_votes:        TableDef<SwipeVoteRow, 'user_id' | 'tmdb_id' | 'title' | 'direction'>;
      shopping_items:     TableDef<ShoppingItemRow, 'title' | 'category'>;
      settings:           TableDef<SettingsRow, 'key' | 'value'>;
      user_sizes:         TableDef<UserSizesRow, 'user_id'>;
      daily_question_log: TableDef<DailyQuestionLogRow, 'date'>;
      daily_questions:    TableDef<DailyQuestionRow, 'text'>;
      work_schedule:      TableDef<WorkScheduleRow, 'date' | 'user_id' | 'mark'>;
      photo_calendar:     TableDef<PhotoCalendarRow, 'date' | 'user_id' | 'photo_url'>;
      free_limit:         TableDef<FreeLimitRow, 'id'>;
      savings_goals:      TableDef<SavingsGoalRow, 'name'>;
      map_pins:           TableDef<MapPinRow, 'title' | 'category' | 'lat' | 'lng'>;
      location_history:   TableDef<LocationHistoryRow, 'user_id' | 'lat' | 'lng'>;
      user_locations:     TableDef<UserLocationRow, 'user_id' | 'lat' | 'lng'>;
      wishlist_items:     TableDef<WishlistItemRow, 'title' | 'owner'>;
      dishes:             TableDef<DishRow, 'title' | 'category'>;
      // pin_attempts і закриті колонки users — лише service_role
      // (Edge Function auth-pin); у клієнтському контракті їх немає.
    };
    Views: { [_ in never]: never };
    Functions: {
      // register_pin_attempt: EXECUTE відкликано в anon/authenticated —
      // клієнт її викликати не може, тому й не декларуємо.
      [_ in never]: never;
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

/** Зручні аліаси поверх Database. */
export type TableName = keyof Database['public']['Tables'];
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];
export type InsertRow<T extends TableName> = Database['public']['Tables'][T]['Insert'];
export type UpdateRow<T extends TableName> = Database['public']['Tables'][T]['Update'];

// ────────────────────────────────────────────────────────────
// 6. STORAGE
// ────────────────────────────────────────────────────────────

export type StorageBucket =
  | 'family_photos'    // полароїд-стіна на головній
  | 'map-photos'       // фото пінів карти
  | 'media-posters'    // постери фільмів/серіалів/книг
  | 'photo-calendar'   // фото дня
  | 'wishlist-photos'; // фото бажань

/** Мінімум полів файла зі storage.list(), які реально читаються. */
export interface StorageFile {
  name: string;
}

// ────────────────────────────────────────────────────────────
// 7. EDGE FUNCTIONS — контракти invoke
// ------------------------------------------------------------
// Типізований wrapper (lib/supabase.ts → invokeFn) бере Body/
// Response звідси. ВАЖЛИВО: supabase-js на non-2xx кладе тіло
// помилки НЕ в data, а у FunctionsHttpError.context — wrapper
// нормалізує це до дискримінованих уній нижче.
// ────────────────────────────────────────────────────────────

export interface AuthPinRequest {
  user_id: number;
  /** Рівно 8 цифр. */
  pin: string;
}

/**
 * Дискримінована унія за `ok`: TS сам звужує email/password до
 * обов'язкових рівно в тій гілці, де вони існують.
 */
export type AuthPinResponse =
  | { ok: true; email: string; password: string }
  | {
      ok?: false;
      error: 'invalid' | 'locked' | 'bad_request' | 'server_error';
      retryAfterSeconds?: number;
    };

/** Ключі кроків конструктора страв (порядок = порядок кроків майстра). */
export type CulinaryStepKey =
  | 'type' | 'taste' | 'base' | 'ingredients' | 'effort' | 'cuisine';

/** Відповіді майстра: обрані опції по кожному кроку (завжди масив). */
export type CulinaryAnswers = Partial<Record<CulinaryStepKey, string[]>>;

export interface CulinaryAiRequest {
  answers: CulinaryAnswers;
  /** Назви вже запропонованих страв — щоб «ще варіант» не повторювався. */
  avoid: string[];
}

/** Страва, згенерована culinary-ai. */
export interface CulinaryDish {
  title: string;
  description?: string;
  cuisine?: string;
  time_minutes?: number;
  difficulty?: string;
  tools?: string[];
  servings?: number;
  ingredients: RecipeIngredient[];
  steps?: string[];
}

export interface ShoppingParseRequest {
  text: string;
}

/** Одна розпарсена позиція (ще без id — до insert). */
export interface ParsedShoppingLine {
  title: string;
  qty: string | null;
  category: ShoppingCategory;
}

export interface ShoppingParseResponse {
  items: ParsedShoppingLine[];
}

export interface DailyQuestionAiRequest {
  /** 'YYYY-MM-DD' */
  date: string;
}

export interface DailyQuestionAiResponse {
  id: number;
  text: string;
}

/** Локація пари, збережена в settings.whereto_location. */
export interface WhereToLocation {
  region: string;
  city: string;
}

/** Спільний вихідний найближчими днями (з work_schedule) — підказка для events-finder. */
export interface FreeDayInfo {
  date: string;
  off: string[];
}

export interface EventsFinderRequest {
  city: string;
  region: string;
  avoid: string[];
  freeDays: FreeDayInfo[];
}

/** Один результат events-finder. */
export interface WhereToEvent {
  kind: WhereToKind;
  title: string;
  price: string | null;
  when: string | null;
  place: string | null;
  off_note: string | null;
  description: string | null;
  url: string | null;
}

export interface EventsFinderResponse {
  events: WhereToEvent[];
}

/** Сповіщення в Telegram через db-notify (унія — розширювана). */
export type DbNotifyRequest = {
  type: 'wish_fulfilled';
  itemTitle: string;
  ownerId: number | undefined;
  buyerId: number;
};

export type DbNotifyResponse = { ok: boolean };

/** Мапа ім'я функції → контракт. Джерело правди для invokeFn<K>. */
export interface EdgeFunctions {
  'auth-pin':          { Body: AuthPinRequest; Response: AuthPinResponse };
  'culinary-ai':       { Body: CulinaryAiRequest; Response: CulinaryDish };
  'shopping-parse':    { Body: ShoppingParseRequest; Response: ShoppingParseResponse };
  'daily-question-ai': { Body: DailyQuestionAiRequest; Response: DailyQuestionAiResponse };
  'events-finder':     { Body: EventsFinderRequest; Response: EventsFinderResponse };
  'db-notify':         { Body: DbNotifyRequest; Response: DbNotifyResponse };
}

export type EdgeFunctionName = keyof EdgeFunctions;

// ────────────────────────────────────────────────────────────
// 8. REALTIME
// ────────────────────────────────────────────────────────────

/** Таблиці, на які підписується клієнт (публікація supabase_realtime). */
export type RealtimeTable =
  | 'events' | 'free_limit' | 'savings_goals' | 'time_capsules'
  | 'daily_question_log' | 'media_items' | 'dishes' | 'wishlist_items'
  | 'shopping_items' | 'photo_calendar' | 'work_schedule'
  | 'map_pins' | 'user_locations';

export type RealtimeEventType = 'INSERT' | 'UPDATE' | 'DELETE';

/**
 * Полегшений тип payload'а postgres_changes: new/old — Partial,
 * бо для DELETE приходить лише old (і то за REPLICA IDENTITY),
 * а для INSERT — лише new.
 */
export interface RealtimeChange<T extends RealtimeTable = RealtimeTable> {
  eventType: RealtimeEventType;
  table: T;
  new: Partial<Row<T>>;
  old: Partial<Row<T>>;
}

// ────────────────────────────────────────────────────────────
// 9. ЗОВНІШНІ API (TMDB, Mapbox)
// ────────────────────────────────────────────────────────────

/** Результат пошуку TMDB, уже приведений до нашої форми. */
export interface TmdbSearchResult {
  tmdb_id: number;
  title: string;
  poster_url: string | null;
  year: string;
  rating: string | null;
  overview: string;
}

/** Деталі фільму/серіалу з TMDB — те, що реально використовується. */
export interface TmdbDetails {
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

/** Картка TMDB-фіда для свайп-стеку. */
export interface SwipeCard {
  tmdb_id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  year: string;
  rating: string | null;
}

/** Мінімум полів фічі Mapbox Geocoding API, які реально читаються. */
export interface MapboxFeature {
  text?: string;
  place_name?: string;
  center: [number, number];
  place_type?: string[];
  address?: string;
  context?: Array<{ id: string; text?: string }>;
}

/** Результат reverseGeocode(). */
export interface GeocodeResult {
  address: string;
  city: string;
}

// ────────────────────────────────────────────────────────────
// 10. ПОХІДНІ UI-ТИПИ (обчислюються на клієнті)
// ────────────────────────────────────────────────────────────

/** Подія + обчислена дата найближчого настання (для списку подій). */
export interface EnrichedEvent extends EventRow {
  nextDate: Date;
  days: number;
  passed: boolean;
}

/**
 * «План» — подія type:'other' з обов'язковими metadata.
 * Заміна старого ParsedPlan: жодного парсингу description регулярками.
 */
export type Plan = EventRow & {
  type: 'other';
  metadata: PlanMetadata;
};

/** Архівний запис виконаного бажання (підмножина колонок, які тягне запит). */
export type FulfilledWishlistItem = Pick<
  WishlistItemRow,
  'id' | 'title' | 'description' | 'link' | 'image_url'
  | 'price' | 'priority' | 'fulfilled_at' | 'fulfilled_by'
>;

/** Група пінів за містом для списку під картою. */
export interface PinCityGroup {
  city: string;
  pins: MapPinRow[];
}

/** Один крок майстра конструктора страв (константа CUL_STEPS). */
export interface CulinaryStepDef {
  key: CulinaryStepKey;
  title: string;
  hint: string;
  multi: boolean;
  max?: number;
  options: string[];
}

/** Стан конструктора, що персиститься в localStorage 'amore:culinary'. */
export interface CulinaryPersistedState {
  dish: CulinaryDish | null;
  answers: CulinaryAnswers;
  avoid: string[];
}

/**
 * Позначка оптимістичного запису в кеші React Query: рядок уже
 * намальований, але ще не підтверджений БД (id < 0). Прапорець
 * readonly і опційний — справжні рядки з БД йому відповідають
 * автоматично.
 */
export type Optimistic<T> = T & { readonly __optimistic?: true };

/**
 * Імена вкладок старого роутера. Потрібні перехідно: realtime-конфіг
 * і збережений sessionStorage `portal:lastView` оперують ними;
 * мапа view → URL живе в src/app/routes.ts.
 */
export type ViewName =
  | 'home' | 'wishlist' | 'budget'
  | 'calendar' | 'schedule' | 'photo-calendar'
  | 'question' | 'capsule'
  | 'media' | 'whereto' | 'map' | 'shopping'
  | 'random' | 'game';

// ────────────────────────────────────────────────────────────
// 11. БРАУЗЕРНІ ДОПОВНЕННЯ
// ────────────────────────────────────────────────────────────

/** Нестандартна подія Chrome для банера встановлення PWA (немає в lib.dom.d.ts). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
