// ============================================================
// SUPABASE CLIENT + типізований invoke
// ------------------------------------------------------------
// КЛІЄНТ СТВОРЮЄТЬСЯ НА ПЕРШОМУ ВЖИВАННІ, А НЕ НА ІМПОРТІ.
//
// Тут стояло `if (!url || !anonKey) throw` просто в тілі модуля, і це
// коштувало двадцяти трьох червоних збірок поспіль. Ланцюг такий:
// `sourceSnapshot.test.ts` → `portalSources.ts` → `wishlistEvolutionArchive.ts`
// → сюди. У CI немає `.env.local` (він у `.gitignore`, і правильно), тож
// модуль кидав помилку ще ДО того, як vitest встигав зайти в тест: файл не
// запускався взагалі, у CI виконувалась 2721 перевірка проти 2729 локально,
// а кроки `build` і `verify:pages-build` після впалих тестів пропускались.
//
// Локально все було зелене — саме тому вада прожила п'ять днів невидимою.
// Гітігнорений файл оточення робить локальний прогін НЕ показанням про CI.
//
// Чому лінива ініціалізація, а не змінні оточення в CI. Змінні полагодили б
// симптом за хвилину й лишили б причину: чистий тест розкладки не має
// падати від того, що поруч немає ключа до бази. Кидати на імпорті — це
// побічна дія на завантаженні модуля, тобто рівно те, чого `CLAUDE.md`
// не хоче бачити («No hidden global mutable state»). Тепер помилка
// приходить тоді, коли хтось СПРАВДІ йде в базу, — з тим самим текстом і
// без жодного тихого запасного шляху.
//
// МЕЖА, НАЗВАНА ЧЕСНО. Тут стояло «createClient<Database>() робить кожен
// .from('…') повністю типізованим — це головний механізм „жодного any“».
// Це неправда: параметра `Database` у виклику немає й ніколи не було, тож
// `supabase.from('plans')` повертає нетипізований рядок (перевірено: поле
// з вигаданою назвою проходить `tsc` без зауважень). Провести `Database`
// крізь тридцять шість файлів — окрема робота з власною ціною, і вона тут
// не зроблена; збрехати про неї коментарем більше не можна.
// ============================================================
import { createClient, FunctionsHttpError } from '@supabase/supabase-js';
import type { EdgeFunctions, EdgeFunctionName } from '@/types';

/**
 * Тип клієнта виводиться з РЕАЛЬНОГО виклику, а не з `ReturnType<typeof
 * createClient>`. Друге виглядає охайніше й дає `never`: без аргументів
 * узагальнені параметри підставляються своїми типовими значеннями, і
 * `.from()` після цього не типізується взагалі (перевірено — tsc дав
 * чотири помилки в чужих файлах). Тут потрібен саме той тип, що був до
 * зміни, тож і виводиться він там само, де виводився.
 */
function build(url: string, anonKey: string) {
  return createClient(url, anonKey, {
    auth: {
      // Тиха Supabase-сесія для RLS (як у старому signInWithPassword).
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'amore-auth',
    },
  });
}

type Client = ReturnType<typeof build>;

let created: Client | null = null;

/**
 * Справжній клієнт; створюється один раз і кешується.
 *
 * Помилка та сама, що була, і кидається так само гучно — змінилось лише
 * КОЛИ. Мовчазного запасного клієнта тут немає навмисно: портал без бази
 * не працює, і вдавати протилежне означало б сховати причину.
 */
function client(): Client {
  if (created !== null) return created;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'Немає VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — скопіюй .env.local.example у .env.local',
    );
  }

  created = build(url, anonKey);
  return created;
}

/**
 * Той самий `supabase`, що й був, для всіх тридцяти шести місць виклику.
 *
 * Проксі, а не гетер-функція: міняти `supabase.from(…)` на `supabase().from(…)`
 * у тридцяти шести файлах означало б велику зміну там, де потрібна мала.
 *
 * Методи прив'язуються до справжнього клієнта, бо всередині supabase-js вони
 * спираються на `this`; без `bind` перший же `.from()` зламався б.
 */
export const supabase: Client = new Proxy({} as Client, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property) as unknown;
    return typeof value === 'function' ? value.bind(instance) : value;
  },
  has(_target, property) {
    return Reflect.has(client(), property);
  },
});

// ── Типізований виклик Edge Functions ───────────────────────
/**
 * Обгортка над supabase.functions.invoke з контрактом із EdgeFunctions:
 * ім'я функції визначає і тип body, і тип відповіді.
 *
 * ВАЖЛИВО про помилки: supabase-js на non-2xx НЕ кладе тіло у `data`,
 * а повертає FunctionsHttpError, у якого справжня відповідь лежить в
 * `error.context` (об'єкт Response). Старий код читав `data.error` —
 * і тому гілка 'locked' у auth-pin ніколи не показувалась коректно.
 * Тут ми читаємо тіло з context і повертаємо його типізовано.
 *
 * @throws транспортні помилки (немає мережі / relay) — щоб їх ретраїв
 *   React Query. HTTP-помилки зі структурованим тілом НЕ кидаються:
 *   для auth-pin вони є валідною гілкою union-відповіді.
 */
export async function invokeFn<K extends EdgeFunctionName>(
  name: K,
  body: EdgeFunctions[K]['Body'],
): Promise<EdgeFunctions[K]['Response']> {
  const { data, error } = await supabase.functions.invoke<EdgeFunctions[K]['Response']>(name, {
    body,
  });

  if (!error) {
    return data as EdgeFunctions[K]['Response'];
  }

  if (error instanceof FunctionsHttpError) {
    const parsed = (await error.context.json().catch(() => null)) as
      | EdgeFunctions[K]['Response']
      | null;
    if (parsed !== null) {
      // auth-pin моделює свої 4xx-помилки прямо в типі відповіді (union),
      // тому структуроване тіло — валідна відповідь. Функції, що НЕ
      // моделюють помилки (culinary-ai …), повернуть тіло виду {error:…},
      // яке не пройде guard на боці виклику — і це навмисно.
      return parsed;
    }
  }

  // Транспорт або нечитабельне тіло — далі по стеку до retry React Query.
  throw error;
}

/** Публічний URL файлу в Storage-бакеті. */
export function publicUrl(bucket: string, path: string): string {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}
