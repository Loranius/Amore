// ============================================================
// useSharedDaysOff — майбутні дні, коли ОБОЄ мають вихідний.
// ------------------------------------------------------------
// Мірор /weekends у tg-commands: у графіку обидва користувачі мають
// позначку 'Х'. Це єдине, що лишилось від файла useDates.ts — самі
// побачення переїхали в «Плани» разом із датою й підтвердженням, і
// таблиця `dates` більше не має жодного екрана.
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { todayLocal } from '@/features/_shared/month';

export function useSharedDaysOff() {
  return useQuery({
    queryKey: qk.sharedDaysOff(),
    queryFn: async (): Promise<string[]> => {
      const { data: users, error: usersError } = await supabase.from('users').select('id');
      if (usersError) throw usersError;
      const userIds = (users ?? []).map((u) => u.id);
      if (userIds.length < 2) return [];

      const { data, error } = await supabase
        .from('work_schedule')
        .select('date,user_id,mark')
        .eq('mark', 'Х')
        .gte('date', todayLocal())
        .order('date', { ascending: true });
      if (error) throw error;

      const byDate = new Map<string, Set<number>>();
      for (const r of data ?? []) {
        if (!byDate.has(r.date)) byDate.set(r.date, new Set());
        byDate.get(r.date)!.add(r.user_id);
      }
      return [...byDate.entries()]
        .filter(([, ids]) => userIds.every((id) => ids.has(id)))
        .map(([d]) => d)
        .sort();
    },
  });
}

/**
 * Every past date both partners marked as a day off.
 *
 * The crystal's only use for the work schedule (ADR-0017): a year's crystal
 * grows a little for the days the two of them actually had together, and the
 * term can only ever add — so a couple who has never opened this module simply
 * gets an empty list and an unchanged artifact.
 *
 * Deliberately unbounded in time and deliberately three columns: a couple of
 * years of daily marks for two people is a few thousand short rows, and the
 * alternative — a month-scoped fetch per year — is a request per year.
 */
export function useScheduleTogetherness() {
  return useQuery({
    queryKey: qk.scheduleTogetherness(),
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data: users, error: usersError } = await supabase.from('users').select('id');
      if (usersError) throw usersError;
      const userIds = (users ?? []).map((u) => u.id);
      if (userIds.length < 2) return [];

      const { data, error } = await supabase
        .from('work_schedule')
        .select('date,user_id,mark')
        .eq('mark', 'Х')
        .order('date', { ascending: true });
      if (error) throw error;

      const offByDate = new Map<string, Set<number>>();
      for (const row of data ?? []) {
        if (typeof row.date !== 'string') continue;
        if (!offByDate.has(row.date)) offByDate.set(row.date, new Set());
        offByDate.get(row.date)!.add(row.user_id);
      }

      return [...offByDate.entries()]
        .filter(([, ids]) => userIds.every((id) => ids.has(id)))
        .map(([date]) => date)
        .sort();
    },
  });
}
