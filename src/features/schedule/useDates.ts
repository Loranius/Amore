// ============================================================
// useDates — «Побачення» на спільний вихідний
// ------------------------------------------------------------
// Той самий патерн pending/confirmed + proposed_by, що спільні цілі
// (useGoalMutations у features/budget/useBudget.ts): пропозиція йде
// в Telegram партнеру з кнопками ✅/❌ (тригер БД → db-notify), а
// підтвердити/відхилити можна і звідти, і з сайту (дзвіночок або
// список на цій сторінці).
//
// useSharedDaysOff — список майбутніх дат, де в графіку ОБИДВА
// користувачі мають позначку 'Х' (мірор /weekends у tg-commands) —
// саме з нього модалка пропозиції бере доступні для вибору дати.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { todayLocal } from '@/features/_shared/month';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { DateRow, InsertRow } from '@/types';

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

export function useDatePlans() {
  return useQuery({
    queryKey: qk.dates(),
    queryFn: async (): Promise<DateRow[]> => {
      const { data, error } = await supabase
        .from('dates')
        .select('id,title,place,date,time,description,url,status,proposed_by,created_at')
        .order('date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface NewDateInput {
  title: string;
  place: string | null;
  date: string;
  time: string | null;
  description: string | null;
  url: string | null;
}

export function useDateMutations() {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.dates() });
  const err = () => toast.show('Помилка. Спробуй ще.');

  const propose = useMutation({
    mutationFn: async (input: NewDateInput) => {
      const row: InsertRow<'dates'> = {
        title: input.title,
        place: input.place,
        date: input.date,
        time: input.time,
        description: input.description,
        url: input.url,
        status: 'pending',
        proposed_by: me.name,
      };
      const { error } = await supabase.from('dates').insert(row);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const confirm = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('dates').update({ status: 'confirmed' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('dates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  return { propose, confirm, remove };
}
