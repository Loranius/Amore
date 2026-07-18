// ============================================================
// REALTIME — живі оновлення від партнера (порт lib/realtime.js)
// ------------------------------------------------------------
// Один канal 'amore-live' на всі таблиці з realtimeInvalidation.
// При зміні (дебаунс 150мс на таблицю):
//   • якщо це НЕ власна луна → invalidateQueries відповідних ключів
//     (React Query сам вирішить, чи рефетчити активні запити);
//   • власну луну придушуємо через markSelf/isSelfEcho (вікно 2.5с).
//
// markSelf ставиться автоматично: патчимо write-методи імпортованого
// (єдиного) supabase-клієнта — будь-який insert/update/upsert/delete
// позначає таблицю «своєю». Читання (.select) не зачіпаються. Це DRY-
// заміна ручного markSelf у кожній мутації (як і в старому коді).
// ============================================================
import { useEffect } from 'react';
import { supabase } from './supabase';
import { queryClient } from './queryClient';
import { realtimeInvalidation } from './queryKeys';
import type { RealtimeTable } from '@/types';

const REALTIME_TABLES = Object.keys(realtimeInvalidation) as RealtimeTable[];

// ── Придушення власної луни ──────────────────────────────────
const SUPPRESS_MS = 2500;
const selfWrites: Record<string, number> = {};

/** Позначити таблицю щойно зміненою цим клієнтом. */
export function markSelf(table: string): void {
  selfWrites[table] = Date.now();
}
function isSelfEcho(table: string): boolean {
  const t = selfWrites[table];
  if (t !== undefined && Date.now() - t < SUPPRESS_MS) {
    delete selfWrites[table];
    return true;
  }
  return false;
}

// ── Дебаунс по таблиці ───────────────────────────────────────
const DEBOUNCE_MS = 150;
const timers: Record<string, ReturnType<typeof setTimeout>> = {};

function handle(table: RealtimeTable): void {
  if (isSelfEcho(table)) return; // наша ж зміна — вже відображена оптимістично
  for (const key of realtimeInvalidation[table]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

function schedule(table: RealtimeTable): void {
  clearTimeout(timers[table]);
  timers[table] = setTimeout(() => handle(table), DEBOUNCE_MS);
}

// ── Життєвий цикл каналу ─────────────────────────────────────
let channel: ReturnType<typeof supabase.channel> | null = null;

function start(): void {
  if (channel) return;
  const ch = supabase.channel('amore-live');
  for (const table of REALTIME_TABLES) {
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table },
      () => schedule(table),
    );
  }
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') console.info('[Realtime] підключено ✓');
    else if (status === 'CHANNEL_ERROR')
      console.warn('[Realtime] помилка каналу (перевір публікацію supabase_realtime)');
  });
  channel = ch;
}

function stop(): void {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
}

/**
 * Підписка на realtime на час життя автентифікованої зони.
 * Викликається в Layout (рендериться лише під RequireAuth, тож
 * жива Supabase-сесія для RLS уже є). React 19 StrictMode двічі
 * монтує ефект у dev — start() ідемпотентний (guard на channel),
 * а cleanup коректно від'єднує.
 */
export function useRealtime(): void {
  useEffect(() => {
    start();
    return () => stop();
  }, []);
}

// ── Автопозначення власних записів (порт patchSupabaseWrites) ──
// Свідомий локальний виняток із «жодного any»: ми патчимо чужий
// клієнт, форму якого не контролюємо, а не власні дані. Той самий
// задокументований виняток, що й `declare const supabase: any` у
// старому types.d.ts.
type PatchableClient = {
  from: (table: string) => Record<string, unknown>;
  __amoreWritePatched?: boolean;
};

function patchSupabaseWrites(client: unknown): void {
  const c = client as PatchableClient;
  if (!c || typeof c.from !== 'function' || c.__amoreWritePatched) return;
  c.__amoreWritePatched = true;

  const from = c.from.bind(c);
  c.from = (table: string) => {
    const qb = from(table);
    for (const m of ['insert', 'update', 'upsert', 'delete'] as const) {
      const orig = qb[m];
      if (typeof orig === 'function') {
        const fn = orig as (...args: unknown[]) => unknown;
        qb[m] = (...args: unknown[]) => {
          markSelf(table);
          return fn.apply(qb, args);
        };
      }
    }
    return qb;
  };
}

patchSupabaseWrites(supabase);
