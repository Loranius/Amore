// ============================================================
// useWhereTo — дані «Куди піти» (порт whereto.js даних)
// ------------------------------------------------------------
// Локація в settings (JSON). Пошук — events-finder (web search) з
// одним авторетраєм. Вихідні пари з графіка — підказка для функції.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase, invokeFn } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { wtDateStr } from './whereToConstants';
import type { WhereToLocation, WhereToEvent, FreeDayInfo, AppUser } from '@/types';

const SETTING_KEY = 'whereto_location';

// ── Локація (settings) ───────────────────────────────────────
export function useWhereToLocation() {
  return useQuery({
    queryKey: [...qk.settings(), SETTING_KEY],
    queryFn: async (): Promise<WhereToLocation | null> => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      if (!data || typeof data.value !== 'string') return null;
      try {
        return JSON.parse(data.value) as WhereToLocation;
      } catch {
        return null;
      }
    },
  });
}

export function useSaveLocation() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (loc: WhereToLocation) => {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: SETTING_KEY, value: JSON.stringify(loc) }, { onConflict: 'key' });
      if (error) throw error;
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: [...qk.settings(), SETTING_KEY] }),
    onError: () => toast.show('Не вдалось зберегти місто'),
  });
}

// ── Вихідні пари на найближчі 7 днів ─────────────────────────
async function loadFreeDays(users: AppUser[]): Promise<FreeDayInfo[]> {
  if (!users.length) return [];
  const { data } = await supabase
    .from('work_schedule')
    .select('date,user_id')
    .eq('mark', 'Х')
    .gte('date', wtDateStr(0))
    .lte('date', wtDateStr(7));
  const byDate = new Map<string, number[]>();
  for (const r of data ?? []) (byDate.get(r.date) ?? byDate.set(r.date, []).get(r.date)!).push(r.user_id);
  return [...byDate.keys()].sort().map((date) => ({
    date,
    off: byDate
      .get(date)!
      .map((id) => users.find((u) => u.id === id)?.name)
      .filter((n): n is string => !!n),
  }));
}

// ── Виклик events-finder з одним ретраєм ─────────────────────
async function callFinder(
  city: string,
  region: string,
  avoid: string[],
  freeDays: FreeDayInfo[],
): Promise<WhereToEvent[]> {
  const body = { city, region, avoid, freeDays };
  let data;
  try {
    data = await invokeFn('events-finder', body);
  } catch {
    await new Promise((r) => setTimeout(r, 1500)); // свіжий slug/мережа — лікується повтором
    data = await invokeFn('events-finder', body);
  }
  if (!data || !Array.isArray(data.events) || !data.events.length) {
    const detail = (data as { error?: unknown }).error;
    throw new Error(typeof detail === 'string' ? detail : 'Порожня відповідь');
  }
  return data.events;
}

/** Мутація пошуку: приймає avoid+локацію, повертає події. */
export function useEventsSearch() {
  const { data: users = [] } = useUsers();
  return useMutation({
    mutationFn: async (v: { location: WhereToLocation; avoid: string[] }): Promise<WhereToEvent[]> => {
      const freeDays = await loadFreeDays(users);
      return callFinder(v.location.city, v.location.region, v.avoid, freeDays);
    },
  });
}
