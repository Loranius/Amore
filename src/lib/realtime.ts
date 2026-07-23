// ============================================================
// REALTIME — живі оновлення від партнера (порт lib/realtime.js)
// ------------------------------------------------------------
// Один канал 'amore-live' на доменні таблиці. При зміні кеші React Query
// інвалідуються; app_notifications підключена окремо, бо це read-only inbox,
// а не клієнтська writable-таблиця з Database contract.
// ============================================================
import { useEffect } from 'react';
import { supabase } from './supabase';
import { queryClient } from './queryClient';
import { qk, realtimeInvalidation } from './queryKeys';
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
  if (isSelfEcho(table)) return;
  for (const key of realtimeInvalidation[table]) {
    void queryClient.invalidateQueries({ queryKey: key });
  }
}

function schedule(table: RealtimeTable): void {
  clearTimeout(timers[table]);
  timers[table] = setTimeout(() => handle(table), DEBOUNCE_MS);
}

function scheduleNotificationInbox(): void {
  clearTimeout(timers.app_notifications);
  timers.app_notifications = setTimeout(() => {
    void queryClient.invalidateQueries({ queryKey: qk.notifications() });
  }, DEBOUNCE_MS);
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

  ch.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'app_notifications' },
    scheduleNotificationInbox,
  );

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

/** Підписка на realtime на час життя автентифікованої зони. */
export function useRealtime(): void {
  useEffect(() => {
    start();
    return () => stop();
  }, []);
}

// ── Автопозначення власних записів ───────────────────────────
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
    for (const method of ['insert', 'update', 'upsert', 'delete'] as const) {
      const original = qb[method];
      if (typeof original === 'function') {
        const fn = original as (...args: unknown[]) => unknown;
        qb[method] = (...args: unknown[]) => {
          markSelf(table);
          return fn.apply(qb, args);
        };
      }
    }
    return qb;
  };
}

patchSupabaseWrites(supabase);
