// ============================================================
// useSchedule — графік роботи
// ------------------------------------------------------------
// Місячний запит work_schedule → мапа { user_id: { date: mark } }.
// Окрема одиночна мутація лишається для простих змін, а batch-мутація
// обслуговує масове редагування, шаблони та копіювання місяця.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { monthRange, monthKeyOf } from '@/features/_shared/month';
import { useToast } from '@/providers/ToastProvider';
import type { WorkScheduleRow } from '@/types';

export type ScheduleMark = '' | 'Р' | 'Х';

/** user_id → (date → mark). */
export type MarksMap = Record<number, Record<string, string>>;

export interface ScheduleChange {
  userId: number;
  date: string;
  mark: ScheduleMark;
}

interface ScheduleBatchInput {
  changes: ScheduleChange[];
  successMessage?: string | undefined;
}

/** Цикл позначки для сумісності зі старими сценаріями. */
export const MARK_CYCLE: Record<string, ScheduleMark> = { '': 'Р', Р: 'Х', Х: '' };

function buildMarks(rows: WorkScheduleRow[]): MarksMap {
  const map: MarksMap = {};
  for (const row of rows) {
    (map[row.user_id] ??= {})[row.date] = row.mark;
  }
  return map;
}

function applyChanges(current: MarksMap | undefined, changes: ScheduleChange[]): MarksMap {
  const next: MarksMap = { ...(current ?? {}) };
  const touchedUsers = new Map<number, Record<string, string>>();

  for (const change of changes) {
    let userMarks = touchedUsers.get(change.userId);
    if (!userMarks) {
      userMarks = { ...(next[change.userId] ?? {}) };
      touchedUsers.set(change.userId, userMarks);
      next[change.userId] = userMarks;
    }

    if (change.mark) userMarks[change.date] = change.mark;
    else delete userMarks[change.date];
  }

  return next;
}

async function persistChanges(changes: ScheduleChange[]): Promise<void> {
  const upserts = changes
    .filter((change) => change.mark !== '')
    .map((change) => ({
      date: change.date,
      user_id: change.userId,
      mark: change.mark,
      updated_at: new Date().toISOString(),
    }));

  if (upserts.length > 0) {
    const { error } = await supabase
      .from('work_schedule')
      .upsert(upserts, { onConflict: 'date,user_id' });
    if (error) throw error;
  }

  const deletesByUser = new Map<number, string[]>();
  for (const change of changes) {
    if (change.mark !== '') continue;
    const dates = deletesByUser.get(change.userId) ?? [];
    dates.push(change.date);
    deletesByUser.set(change.userId, dates);
  }

  for (const [userId, dates] of deletesByUser) {
    if (dates.length === 0) continue;
    const { error } = await supabase
      .from('work_schedule')
      .delete()
      .eq('user_id', userId)
      .in('date', dates);
    if (error) throw error;
  }
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
    mutationFn: async (change: ScheduleChange) => persistChanges([change]),
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<MarksMap>(key);
      client.setQueryData<MarksMap>(key, (current) => applyChanges(current, [change]));
      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      toast.show('Не вдалося зберегти позначку. Спробуй ще.');
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: qk.sharedDaysOff() });
    },
  });
}

export function useScheduleBatchMutation(yr: number, mo: number) {
  const client = useQueryClient();
  const toast = useToast();
  const key = qk.schedule(monthKeyOf(yr, mo));

  return useMutation({
    mutationFn: async (input: ScheduleBatchInput) => {
      if (input.changes.length === 0) return;
      await persistChanges(input.changes);
    },
    onMutate: async (input) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData<MarksMap>(key);
      client.setQueryData<MarksMap>(key, (current) => applyChanges(current, input.changes));
      return { previous };
    },
    onSuccess: (_data, input) => {
      if (input.successMessage) toast.show(input.successMessage);
    },
    onError: (_error, _input, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
      toast.show('Не вдалося застосувати зміни графіка. Спробуй ще.');
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: qk.sharedDaysOff() });
    },
  });
}
