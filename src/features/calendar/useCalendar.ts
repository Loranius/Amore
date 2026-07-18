// ============================================================
// useCalendar — дані подій і планів (порт даних calendar.js)
// ------------------------------------------------------------
// Одна вибірка events (з колонкою metadata). Плани — це events із
// type='other'; статус/категорія читаються з metadata, а НЕ парсяться
// з description регулярками (старий підхід видалено).
// ============================================================
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { EventRow, InsertRow, PlanCategory, PlanStatus, PlanMetadata } from '@/types';

// Запит подій живе у _shared (спільний із головною). Реекспорт — щоб
// наявні імпорти календаря не мінялися.
export { useEvents, loadEvents } from '@/features/_shared/events';

// ── Мутації подій/планів ─────────────────────────────────────
export interface NewEventInput {
  title: string;
  date: string;
  description: string | null;
  type: EventRow['type'];
  yearly: boolean;
}

export interface NewPlanInput {
  title: string;
  date: string;
  note: string | null;
  cat: PlanCategory;
  status: Extract<PlanStatus, 'planned' | 'active'>;
}

export function useCalendarMutations() {
  const client = useQueryClient();
  const user = useCurrentUser();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.events() });

  const addEvent = useMutation({
    mutationFn: async (input: NewEventInput) => {
      const row: InsertRow<'events'> = {
        title: input.title,
        date: input.date,
        description: input.description,
        type: input.type,
        yearly: input.yearly,
        created_by: user.id,
      };
      const { error } = await supabase.from('events').insert(row);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  const addPlan = useMutation({
    mutationFn: async (input: NewPlanInput) => {
      const metadata: PlanMetadata = { cat: input.cat, status: input.status, done_at: null };
      const row: InsertRow<'events'> = {
        title: input.title,
        date: input.date,
        description: input.note,
        type: 'other',
        yearly: false,
        created_by: user.id,
        metadata,
      };
      const { error } = await supabase.from('events').insert(row);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  // Зміна статусу плану — пишемо ЦІЛУ metadata (типізовано), без тегів.
  const setPlanStatus = useMutation({
    mutationFn: async (v: { id: number; metadata: PlanMetadata }) => {
      const { error } = await supabase
        .from('events')
        .update({ metadata: v.metadata })
        .eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  return { addEvent, addPlan, setPlanStatus, deleteEvent };
}
