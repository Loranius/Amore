// ============================================================
// SUPABASE CLIENT + типізований invoke
// ------------------------------------------------------------
// createClient<Database>() робить кожен .from('…') повністю
// типізованим — це головний механізм «жодного any» зі старого
// коду, де supabase був `declare const supabase: any`.
// ============================================================
import { createClient, FunctionsHttpError } from '@supabase/supabase-js';
import type { Database, EdgeFunctions, EdgeFunctionName } from '@/types';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    'Немає VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — скопіюй .env.local.example у .env.local',
  );
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    // Тиха Supabase-сесія для RLS (як у старому signInWithPassword).
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'amore-auth',
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
