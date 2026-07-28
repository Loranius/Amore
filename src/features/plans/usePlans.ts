// ============================================================
// Доступ до планів і їхніх завдань.
// ------------------------------------------------------------
// Плани більше не рядки `events` із JSONB-metadata: у них власна
// таблиця, і разом із нею — власний ключ кешу `qk.plans()`, який досі
// був оголошений і не використовувався.
//
// Завдання лежать окремим запитом на конкретний план, а не тягнуться
// разом зі списком: на оглядовому екрані вони не потрібні жодному
// плану, крім найближчого, і вантажити їх усі означало б платити за
// сторінку, яку ще не відкрили.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { PlanCategory, PlanDatePrecision, PlanRow, PlanStatus, PlanTaskRow } from '@/types';

// Один рядок-літерал, а не конкатенація: supabase-js виводить форму
// відповіді з ТЕКСТУ select'а, і склеєний рядок для нього — просто
// `string`, після чого data стає GenericStringError[].
const PLAN_COLUMNS = 'id,title,description,category,status,cover_url,url,start_date,end_date,start_time,date_precision,location_name,place_id,budget,proposed_by,confirmed,created_by,created_at,updated_at,completed_at';

const TASK_COLUMNS = 'id,plan_id,title,assigned_to,due_date,done,done_at,sort_order,created_at';

export interface NewPlanInput {
  title: string;
  category: PlanCategory;
  description: string | null;
}

/** Поля, які редагуються на сторінці плану. Статус міняється окремо. */
export interface PlanPatch {
  title?: string;
  description?: string | null;
  category?: PlanCategory;
  cover_url?: string | null;
  url?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  start_time?: string | null;
  date_precision?: PlanDatePrecision;
  location_name?: string | null;
  place_id?: number | null;
  budget?: number | null;
}

export function usePlans() {
  return useQuery({
    queryKey: qk.plans(),
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await supabase
        .from('plans')
        .select(PLAN_COLUMNS)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanRow[];
    },
  });
}

export function usePlanTasks(planId: number | null) {
  return useQuery({
    queryKey: qk.planTasks(planId ?? undefined),
    enabled: planId !== null,
    queryFn: async (): Promise<PlanTaskRow[]> => {
      const { data, error } = await supabase
        .from('plan_tasks')
        .select(TASK_COLUMNS)
        .eq('plan_id', planId!)
        .order('sort_order', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanTaskRow[];
    },
  });
}

export function usePlanMutations() {
  const client = useQueryClient();
  const toast = useToast();
  const me = useCurrentUser();

  const invalidatePlans = () => void client.invalidateQueries({ queryKey: qk.plans() });
  const invalidateTasks = (planId: number) =>
    void client.invalidateQueries({ queryKey: qk.planTasks(planId) });
  const onError = (e: unknown) => toast.show('Помилка: ' + (e as Error).message);

  const addPlan = useMutation({
    mutationFn: async (input: NewPlanInput): Promise<PlanRow> => {
      // Мінімальне створення (§8): назва, категорія, опис. Дата, місце,
      // завдання й обкладинка додаються потім — інакше кожна ідея
      // вимагала б заповнити десять полів, щоб узагалі зберегтись.
      const { data, error } = await supabase
        .from('plans')
        .insert({
          title: input.title,
          category: input.category,
          description: input.description,
          status: 'idea',
          created_by: me.id,
        })
        .select(PLAN_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return data as PlanRow;
    },
    onSuccess: invalidatePlans,
    onError,
  });

  const updatePlan = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: PlanPatch }) => {
      const { error } = await supabase
        .from('plans')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidatePlans,
    onError,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: PlanStatus }) => {
      // completed_at ставиться разом зі статусом і знімається разом із
      // ним: інакше повернутий у роботу план носив би дату виконання.
      const { error } = await supabase
        .from('plans')
        .update({
          status,
          completed_at: status === 'done' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidatePlans,
    onError,
  });

  /** Підтвердження запропонованого побачення другим партнером. */
  const confirmPlan = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from('plans')
        .update({ confirmed: true, status: 'planning', updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidatePlans,
    onError,
  });

  const removePlan = useMutation({
    mutationFn: async (id: number) => {
      // Завдання зникають каскадом (on delete cascade), окремо їх
      // прибирати не треба.
      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidatePlans,
    onError,
  });

  const addTask = useMutation({
    mutationFn: async ({ planId, title, order }: { planId: number; title: string; order: number }) => {
      const { error } = await supabase
        .from('plan_tasks')
        .insert({ plan_id: planId, title, sort_order: order });
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, v) => invalidateTasks(v.planId),
    onError,
  });

  const toggleTask = useMutation({
    mutationFn: async ({ task }: { task: PlanTaskRow }) => {
      const done = !task.done;
      const { error } = await supabase
        .from('plan_tasks')
        .update({ done, done_at: done ? new Date().toISOString() : null })
        .eq('id', task.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, v) => invalidateTasks(v.task.plan_id),
    onError,
  });

  const removeTask = useMutation({
    mutationFn: async ({ task }: { task: PlanTaskRow }) => {
      const { error } = await supabase.from('plan_tasks').delete().eq('id', task.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_r, v) => invalidateTasks(v.task.plan_id),
    onError,
  });

  return {
    addPlan, updatePlan, setStatus, confirmPlan, removePlan,
    addTask, toggleTask, removeTask,
  };
}
