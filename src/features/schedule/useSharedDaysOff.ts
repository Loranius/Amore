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
