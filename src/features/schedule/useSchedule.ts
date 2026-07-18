// ============================================================
// useSchedule — графік роботи (порт schedule.js даних)
// ------------------------------------------------------------
// Місячний запит work_schedule → мапа { user_id: { 'YYYY-MM-DD': mark } }.
// Тап по клітинці циклічно змінює позначку ('' → Р → Х → '') з
// оптимістичним upsert/delete. Realtime підтягне зміни партнера.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { monthRange, monthKeyOf } from '@/features/_shared/month';
import { useToast } from '@/providers/ToastProvider';
import type { WorkScheduleRow } from '@/types';

/** user_id → (date → mark). */
export type MarksMap = Record<number, Record<string, string>>;

/** Цикл позначки при кожному тапі. */
export const MARK_CYCLE: Record<string, string> = { '': 'Р', Р: 'Х', Х: '' };

function buildMarks(rows: WorkScheduleRow[]): MarksMap {
  const map: MarksMap = {};
  for (const r of rows) {
    (map[r.user_id] ??= {})[r.date] = r.mark;
  }
  return map;
}

export function useSchedule(yr: number, mo: number) {
  return useQuery({
    queryKey: qk.schedule(monthKeyOf(yr, mo)),
    queryFn: async (): Promise<MarksMap> => {
      const { from, to } = monthRange(yr, mo);
      const { data, error } = await supabase
        .from('work_schedule')
        .select('date,user_id,mark')
        .gte('date', from)
        .lte('date', to);
      if (error) throw error;
      return buildMarks(data ?? []);
    },
  });
}

export function useScheduleMutation(yr: number, mo: number) {
  const client = useQueryClient();
  const toast = useToast();
  const key = qk.schedule(monthKeyOf(yr, mo));

  return useMutation({
    mutationFn: async (v: { userId: number; date: string; mark: string }) => {
      if (!v.mark) {
        const { error } = await supabase
          .from('work_schedule')
          .delete()
          .eq('date', v.date)
          .eq('user_id', v.userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('work_schedule').upsert(
          { date: v.date, user_id: v.userId, mark: v.mark, updated_at: new Date().toISOString() },
          { onConflict: 'date,user_id' },
        );
        if (error) throw error;
      }
    },
    onMutate: async (v) => {
      await client.cancelQueries({ queryKey: key });
      const prev = client.getQueryData<MarksMap>(key);
      client.setQueryData<MarksMap>(key, (old) => {
        const next: MarksMap = { ...(old ?? {}) };
        const userMarks = { ...(next[v.userId] ?? {}) };
        if (v.mark) userMarks[v.date] = v.mark;
        else delete userMarks[v.date];
        next[v.userId] = userMarks;
        return next;
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) client.setQueryData(key, ctx.prev);
      toast.show('Не вдалося зберегти позначку. Спробуй ще.');
    },
    onSettled: () => void client.invalidateQueries({ queryKey: key }),
  });
}
