// ============================================================
// Доступ до планів і їхніх завдань.
// ------------------------------------------------------------
// Плани більше не рядки `events` із JSONB-metadata: у них власна
// таблиця, і разом із нею — власний ключ кешу `qk.plans()`.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { publicUrl, supabase } from '@/lib/supabase';
import { compress } from '@/lib/images';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { PlanCategory, PlanDatePrecision, PlanRow, PlanStatus, PlanTaskRow } from '@/types';

const PLAN_COLUMNS = 'id,title,description,category,status,cover_url,url,start_date,end_date,start_time,date_precision,location_name,place_id,budget,proposed_by,confirmed,created_by,created_at,updated_at,completed_at';
const TASK_COLUMNS = 'id,plan_id,title,assigned_to,due_date,done,done_at,sort_order,created_at';
const PLAN_COVERS_BUCKET = 'plan-covers';

export interface NewPlanInput {
  title: string;
  category: PlanCategory;
  description: string | null;
  coverFile: File | null;
}

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

interface UploadedPlanCover {
  path: string;
  url: string;
}

async function uploadPlanCover(file: File, userId: number): Promise<UploadedPlanCover> {
  let blob: Blob = file;
  let ext = 'jpg';
  let contentType = 'image/jpeg';

  try {
    const output = await compress(file, 1600, 0.84);
    blob = output.blob;
    ext = output.ext;
    contentType = output.contentType;
  } catch (error) {
    console.warn('[Плани] стиснення обкладинки не вдалося, вантажу оригінал:', error);
    const originalExt = file.name.split('.').pop()?.toLowerCase();
    if (originalExt && /^[a-z0-9]{2,5}$/.test(originalExt)) ext = originalExt;
    if (file.type) contentType = file.type;
  }

  const unique = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const path = `${userId}/${unique}.${ext}`;
  const { error } = await supabase.storage
    .from(PLAN_COVERS_BUCKET)
    .upload(path, blob, { upsert: false, contentType });
  if (error) throw error;

  return { path, url: publicUrl(PLAN_COVERS_BUCKET, path) };
}

function planCoverPath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${PLAN_COVERS_BUCKET}/`;
  const index = url.indexOf(marker);
  if (index < 0) return null;
  return decodeURIComponent(url.slice(index + marker.length));
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
      if (planId === null) return [];
      const { data, error } = await supabase
        .from('plan_tasks')
        .select(TASK_COLUMNS)
        .eq('plan_id', planId)
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
  const onError = (error: unknown) => toast.show('Помилка: ' + (error as Error).message);

  const addPlan = useMutation({
    mutationFn: async (input: NewPlanInput): Promise<PlanRow> => {
      let uploaded: UploadedPlanCover | null = null;
      if (input.coverFile) uploaded = await uploadPlanCover(input.coverFile, me.id);

      const { data, error } = await supabase
        .from('plans')
        .insert({
          title: input.title,
          category: input.category,
          description: input.description,
          cover_url: uploaded?.url ?? null,
          status: 'idea',
          created_by: me.id,
        })
        .select(PLAN_COLUMNS)
        .single();

      if (error) {
        if (uploaded) {
          await supabase.storage.from(PLAN_COVERS_BUCKET).remove([uploaded.path]).catch(() => undefined);
        }
        throw new Error(error.message);
      }
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
      const { data: row } = await supabase
        .from('plans')
        .select('cover_url')
        .eq('id', id)
        .maybeSingle();
      const path = planCoverPath((row as { cover_url?: string | null } | null)?.cover_url ?? null);

      const { error } = await supabase.from('plans').delete().eq('id', id);
      if (error) throw new Error(error.message);

      if (path) {
        await supabase.storage.from(PLAN_COVERS_BUCKET).remove([path]).catch((storageError) => {
          console.warn('[Плани] не вдалося прибрати стару обкладинку:', storageError);
        });
      }
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
    onSuccess: (_result, variables) => invalidateTasks(variables.planId),
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
    onSuccess: (_result, variables) => invalidateTasks(variables.task.plan_id),
    onError,
  });

  const removeTask = useMutation({
    mutationFn: async ({ task }: { task: PlanTaskRow }) => {
      const { error } = await supabase.from('plan_tasks').delete().eq('id', task.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: (_result, variables) => invalidateTasks(variables.task.plan_id),
    onError,
  });

  return {
    addPlan, updatePlan, setStatus, confirmPlan, removePlan,
    addTask, toggleTask, removeTask,
  };
}
