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
  is_milestone: boolean;
  /** Чий це день народження, якщо людина є в застосунку. */
  person_user_id: number | null;
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
        is_milestone: input.is_milestone,
        person_user_id: input.person_user_id,
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

  // Редагування. Донедавна модуль умів лише створити й видалити: одруківка
  // в назві лікувалась видаленням і повторним створенням — а разом із
  // рядком зникали й `metadata.done_at`, і зв'язок із кристалом (він
  // рахує події за `is_milestone` та `type`).
  const updateEvent = useMutation({
    mutationFn: async (v: { id: number; input: NewEventInput }) => {
      const { error } = await supabase
        .from('events')
        .update({
          title: v.input.title,
          date: v.input.date,
          description: v.input.description,
          type: v.input.type,
          yearly: v.input.yearly,
          is_milestone: v.input.is_milestone,
          person_user_id: v.input.person_user_id,
        })
        .eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  // План редагується разом зі своєю metadata, але `status`/`done_at`
  // беруться з ПОТОЧНОГО стану, а не з форми: інакше правка назви
  // виконаного плану тихо повертала б його в «Планується».
  const updatePlan = useMutation({
    mutationFn: async (v: { id: number; input: NewPlanInput; current: PlanMetadata }) => {
      const metadata: PlanMetadata = {
        cat: v.input.cat,
        status: v.current.status,
        done_at: v.current.done_at,
      };
      const { error } = await supabase
        .from('events')
        .update({
          title: v.input.title,
          date: v.input.date,
          description: v.input.note,
          metadata,
        })
        .eq('id', v.id);
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

  /**
   * Заготовки свят — одним запитом.
   *
   * Десять окремих insert'ів на телефоні в метро це десять шансів
   * обірватись посередині й лишити половину списку.
   */
  const addHolidays = useMutation({
    mutationFn: async (items: Array<{ title: string; date: string }>) => {
      if (items.length === 0) return;
      const rows: InsertRow<'events'>[] = items.map((h) => ({
        title: h.title,
        date: h.date,
        description: null,
        type: 'holiday',
        yearly: true,
        is_milestone: false,
        person_user_id: null,
        created_by: user.id,
      }));
      const { error } = await supabase.from('events').insert(rows);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Не вдалось додати свята: ' + (e as Error).message),
  });

  const deleteEvent = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e) => toast.show('Помилка: ' + (e as Error).message),
  });

  return { addEvent, addPlan, addHolidays, updateEvent, updatePlan, setPlanStatus, deleteEvent };
}
