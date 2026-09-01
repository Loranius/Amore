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

// «plan» прибрано: категорія прожила весь час модуля з нулем міток —
// планування живе в календарі, де в події є дата, нагадування й статус.
export type PinCategory = 'visited' | 'restaurant' | 'favorite';

export type EventType = 'birthday' | 'anniversary' | 'holiday' | 'other';

/**
 * Вага події в історії пари. Три рівні, з яких верхній — закритий набір:
 * ключовою можна зробити лише початок відносин або одруження, і кожне з
 * них існує в однині.
 *
 * Закритість тут не обмеження заради обмеження. Поки рівень був вільним
 * прапорцем, у пари-власника ключових набралось чотири, і ядром сузір'я
 * стала «Річниця першого повідомлення» замість початку відносин.
 */
export type EventSignificance = 'regular' | 'important' | 'relationship_start' | 'marriage';

/** Ключові події — ті, що можуть бути ядром сузір'я. Одруження старше. */
export const KEY_SIGNIFICANCE = ['marriage', 'relationship_start'] as const;

export type KeySignificance = (typeof KEY_SIGNIFICANCE)[number];

export function isKeySignificance(value: EventSignificance): value is KeySignificance {
  return value === 'marriage' || value === 'relationship_start';
}

/**
 * Категорії й статуси модуля «Плани».
 *
 * Старий набір (`date|dream|trip|goal|other` × `planned|active|done`) жив
 * у JSONB `events.metadata`, поки плани були вкладкою календаря. Він
 * змішував різні речі: «Мрії» — це бажання без дії, «Цілі» — це
 * накопичення, і жодне з двох не описує, ЩО пара збирається зробити.
 */
export type PlanCategory =
  | 'date' | 'trip' | 'ride' | 'place' | 'event' | 'activity'
  | 'rest' | 'holiday' | 'learning' | 'home' | 'other';

export type PlanStatus =
  | 'idea' | 'planning' | 'preparing' | 'ready' | 'done' | 'postponed' | 'cancelled';

/**
 * Наскільки визначена дата плану.
 *
 * Та сама конвенція, що в «Спогадах»: `start_date` завжди зберігає
 * ПОЧАТОК періоду, а точність каже, як його показати. Завдяки цьому одне
 * сортування працює і для «12 серпня», і для «осінь 2026».
 */
export type PlanDatePrecision = 'day' | 'range' | 'month' | 'season' | 'year' | 'none';

export interface PlanRow {
  id: number;
  title: string;
  description: string | null;
  category: PlanCategory;
  status: PlanStatus;
  cover_url: string | null;
  url: string | null;
  /** Завжди ПОЧАТОК періоду; як показати — каже date_precision. */
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  date_precision: PlanDatePrecision;
  location_name: string | null;
  /** map_pins.id, без зовнішнього ключа: мітку можна видалити. */
  place_id: number | null;
  /** Скільки план коштуватиме. null — грошей не потребує або ще не рахували. */
  budget: number | null;
  /** Заповнений лише коли план запропонував один партнер другому. */
  proposed_by: number | null;
  confirmed: boolean;
  created_by: number | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

/** Тип сутності, з якою пов'язаний план. Ті самі слова, що в
 *  memory_links.source_type — щоб «місце» означало одне й те саме скрізь. */
export type PlanLinkTarget = 'wish' | 'place' | 'memory';

export interface PlanLinkRow {
  plan_id: number;
  target_type: PlanLinkTarget;
  /** Без зовнішнього ключа: ціль можна видалити, план від цього не зникає. */
  target_id: number;
  created_at: string;
}

export interface PlanTaskRow {
  id: number;
  plan_id: number;
  title: string;
  assigned_to: number | null;
  due_date: string | null;
  done: boolean;
  done_at: string | null;
  sort_order: number;
  created_at: string;
}

export type MediaType = 'movie' | 'series' | 'book';
export type MediaStatus = 'want' | 'watching' | 'done' | 'dropped';

export type SwipeType = 'movie' | 'series';
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';

export type DishCategory = 'meat' | 'vegan' | 'fast' | 'other';

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
  /** Стара категорія: 'date'|'dream'|'trip'|'goal'|'other'. */
  cat: string;
  /** Старий статус: 'planned'|'active'|'done'. */
  status: string;
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
  /**
   * Вага події. Ключових видів рівно два, і кожен існує в парі в однині —
   * це стереже частковий унікальний індекс у БД, а не модалка.
   */
  significance: EventSignificance;
  /**
   * Рахується базою як `significance <> 'regular'` (generated column).
   * Лишається входом рушія й наявних запитів; писати в неї не можна.
   */
  is_milestone: boolean;
  /** Кого стосується подія, якщо це користувач застосунку. null — людина
   *  поза застосунком (батьки, друзі) або подія взагалі не про людину. */
  person_user_id: number | null;
  /**
   * Колір зірки в «Нашому шляху» — ТОКЕН палітри, не сирий колір.
   *
   * База стереже перелік через `CHECK`, бо значення звідси йде прямо в
   * уніформу шейдера. `null` — пара не обирала, і відтінок береться з родини
   * за рівнем події (`starPalette.ts`).
   */
  star_color: string | null;
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
  created_at: string;
  /**
   * Коли пара це закінчила. Пише портал при переході в `done`.
   *
   * Рядки, створені до 2026-09-01, засіяні з `created_at` — для них це
   * оцінка, а не факт, і саме тому адаптер медіа й далі позначає всі свої
   * події як `historical-estimate` (ADR-0080).
   */
  finished_at: string | null;
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

// ── «Спогади» — центральний фотоархів ────────────────────────
/** Що саме відомо про дату спогаду. Див. features/memories/memoriesDate.ts. */
export type MemoryPrecision = 'day' | 'month' | 'year' | 'approx';

/** Модуль, який приніс фото в архів. Спогад без жодного зв'язку — доданий вручну. */
export type MemorySource = 'wish' | 'place' | 'goal' | 'event';

/**
 * Спогад пари — назва, короткий опис, дата, місце й обкладинка.
 *
 * **Фото лежать в іншій таблиці, і вона зветься `memories`.** Це виглядає
 * плутано, і причина названа тут, щоб ніхто не «полагодив» це мимохідь:
 * таблицю `memories` читають ще плани (`usePlanLinks`) і риф-прев'ю рушія
 * Еволюції (`useReefPortalPreview`), а живі реакції продуктових модулів у
 * рушій заборонено чіпати до фази інтеграції. Тож перейменувати її не можна,
 * і момент дістав власне ім'я замість того, щоб забрати чуже.
 */
export interface MemoryMomentRow {
  id: number;
  /**
   * Може бути порожньою, і це не недогляд: у 37 днів, які мігрували з
   * пофотографічної моделі, заголовка ніколи не існувало, а вигадувати його
   * за пару не можна. Порожню назву інтерфейс показує датою.
   */
  title: string;
  /** Кілька слів про момент. Стеля 30 символів стоїть у `CHECK` бази. */
  note: string | null;
  /** Дата САМОГО моменту, окремо від `created_at`. */
  memory_date: string;
  /** Обкладинка — `memories.id`. Перше додане фото стає нею автоматично. */
  cover_photo_id: number | null;
  /** Місце — мітка з «Нашої карти» (`map_pins.id`), а не власні координати. */
  place_pin_id: number | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

/**
 * Одне ФОТО в архіві.
 *
 * Ім'я таблиці (`memories`) старше за модель: колись спогад і був одним
 * знімком. Див. `MemoryMomentRow` про те, чому вона так і лишилась.
 */
export interface MemoryRow {
  id: number;
  photo_url: string;
  /** До якого спогаду належить. `null` — знімок ще не прив'язаний. */
  moment_id: number | null;
  /** Заповнені лише для файлів, завантажених самим архівом; для чужих — null. */
  storage_bucket: string | null;
  storage_path: string | null;
  /** Завжди початок періоду відповідно до date_precision. */
  memory_date: string;
  date_precision: MemoryPrecision;
  /** Час зйомки з метаданих, якщо відомий. */
  taken_at: string | null;
  caption: string | null;
  uploaded_by: number | null;
  sort_order: number;
  created_at: string;
}

export interface MemoryLinkRow {
  memory_id: number;
  source_type: MemorySource;
  source_id: number;
}

export interface MemoryDayRow {
  memory_date: string;
  description: string | null;
  updated_by: number | null;
}

/*
 * `FreeLimitRow` і `SavingsGoalRow` жили тут під модуль «Скарбничка».
 * Модуль видалено (ADR-0049), і типи пішли за ним: тип таблиці, яку
 * ніхто не читає, — це обіцянка коду, що модуль ось-ось повернеться.
 *
 * Самі таблиці в базі ЛИШИЛИСЬ. Видалити код можна назад одним `git
 * revert`, видалити рядки пари — ні, і про це власника ніхто не просив.
 */


export interface MapPinRow {
  /** 'YYYY-MM-DD' — коли пара там була. Керує датою фото в «Спогадах». */
  visited_at: string | null;
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
  country: string | null;
  created_by: number | null;
  created_at: string;
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
  is_secret: boolean;
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
  created_at: string;
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
type InsertOf<R, RequiredK extends keyof R, GeneratedK extends keyof R = never> =
  Pick<R, RequiredK> & Partial<Omit<R, RequiredK | GeneratedK>>;

/**
 * `GeneratedK` — колонки, які рахує сама база (generated always as …).
 * Читати їх можна, писати — ні, і тип має казати те саме, що БД: інакше
 * помилка знайдеться лише під час запиту, вже на телефоні пари.
 */
type TableDef<R, RequiredK extends keyof R, GeneratedK extends keyof R = never> = {
  Row: R;
  Insert: InsertOf<R, RequiredK, GeneratedK>;
  Update: Partial<Omit<R, GeneratedK>>;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      users:              TableDef<UsersRow, 'name'>;
      events:             TableDef<EventRow, 'title' | 'date', 'is_milestone'>;
      media_items:        TableDef<MediaItemRow, 'type' | 'title' | 'status'>;
      swipe_votes:        TableDef<SwipeVoteRow, 'user_id' | 'tmdb_id' | 'title' | 'direction'>;
      shopping_items:     TableDef<ShoppingItemRow, 'title' | 'category'>;
      settings:           TableDef<SettingsRow, 'key' | 'value'>;
      user_sizes:         TableDef<UserSizesRow, 'user_id'>;
      work_schedule:      TableDef<WorkScheduleRow, 'date' | 'user_id' | 'mark'>;
      photo_calendar:     TableDef<PhotoCalendarRow, 'date' | 'user_id' | 'photo_url'>;
      memories:           TableDef<MemoryRow, 'photo_url' | 'memory_date'>;
      memory_moments:     TableDef<MemoryMomentRow, 'memory_date'>;
      memory_days:        TableDef<MemoryDayRow, 'memory_date'>;
      memory_links:       TableDef<MemoryLinkRow, 'memory_id' | 'source_type' | 'source_id'>;
      plans:              TableDef<PlanRow, 'title'>;
      plan_tasks:         TableDef<PlanTaskRow, 'plan_id' | 'title'>;
      plan_links:         TableDef<PlanLinkRow, 'plan_id' | 'target_type' | 'target_id'>;
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
  'events-finder':     { Body: EventsFinderRequest; Response: EventsFinderResponse };
  'db-notify':         { Body: DbNotifyRequest; Response: DbNotifyResponse };
}

export type EdgeFunctionName = keyof EdgeFunctions;

// ────────────────────────────────────────────────────────────
// 8. REALTIME
// ────────────────────────────────────────────────────────────

/** Таблиці, на які підписується клієнт (публікація supabase_realtime). */
export type RealtimeTable =
  | 'events'
  | 'media_items' | 'dishes' | 'wishlist_items'
  | 'shopping_items' | 'photo_calendar' | 'work_schedule'
  | 'map_pins' | 'user_locations'
  | 'memories' | 'memory_moments' | 'memory_links' | 'memory_days'
  | 'plans' | 'plan_tasks' | 'plan_links';

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
// 9. ЗОВНІШНІ API (TMDB, геокодер)
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

/** Жанр TMDB: рівно те, чим підписана кнопка фільтра свайпу. */
export interface TmdbGenre {
  id: number;
  name: string;
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

/**
 * Мінімум полів геокодованого місця, які портал реально читає.
 *
 * Форма успадкована від Mapbox Geocoding API й пережила його: перехід на
 * Nominatim (ADR-0039) торкнувся джерела, а не читача. `center` лишається
 * в порядку [довгота, широта] — його розбирає `placeFromFeature`, і
 * переставлені місцями координати ставили б мітки в океан.
 */
export interface GeoFeature {
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
  country: string;
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

// ────────────────────────────────────────────────────────────
// 11. БРАУЗЕРНІ ДОПОВНЕННЯ
// ────────────────────────────────────────────────────────────

/** Нестандартна подія Chrome для банера встановлення PWA (немає в lib.dom.d.ts). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}
