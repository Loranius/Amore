// ============================================================
// useBudget — фінанси: вільний ліміт + спільні цілі (порт budget.js)
// ------------------------------------------------------------
// free_limit — один рядок (id=1) з пропозицією ↔ підтвердженням.
// savings_goals — спільні цілі (pending/confirmed, прогрес, внески).
// proposed_by історично зберігає ІМ'Я (не FK) — порівнюємо з me.name.
// Realtime синхронізує зміни між партнерами.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { FreeLimitRow, SavingsGoalRow, InsertRow } from '@/types';

/** Сума → «1 234 ₴». */
export const fmtMoney = (n: number | null | undefined): string =>
  Math.round(Math.abs(Number(n) || 0)).toLocaleString('uk-UA') + ' ₴';

// ── Вільний ліміт ────────────────────────────────────────────
type FreeLimit = Pick<FreeLimitRow, 'limit_value' | 'proposal_value' | 'proposed_by'>;

export function useFreeLimit() {
  return useQuery({
    queryKey: qk.freeLimit(),
    queryFn: async (): Promise<FreeLimit> => {
      const { data, error } = await supabase
        .from('free_limit')
        .select('limit_value,proposal_value,proposed_by')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data ?? { limit_value: null, proposal_value: null, proposed_by: null };
    },
  });
}

export function useFreeLimitMutations() {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.freeLimit() });
  const err = () => toast.show('Помилка. Спробуй ще.');

  const propose = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from('free_limit')
        .update({ proposal_value: value, proposed_by: me.name })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const confirm = useMutation({
    mutationFn: async (value: number) => {
      const { error } = await supabase
        .from('free_limit')
        .update({ limit_value: value, proposal_value: null, proposed_by: null })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const reject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('free_limit')
        .update({ proposal_value: null, proposed_by: null })
        .eq('id', 1);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  return { propose, confirm, reject };
}

// ── Спільні цілі ─────────────────────────────────────────────
export function useGoals() {
  return useQuery({
    queryKey: qk.savingsGoals(),
    queryFn: async (): Promise<SavingsGoalRow[]> => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('id,name,target_amount,url,description,status,proposed_by,saved_amount')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface NewGoalInput {
  name: string;
  description: string | null;
  target_amount: number;
  url: string | null;
}

export function useGoalMutations() {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.savingsGoals() });
  const err = () => toast.show('Помилка. Спробуй ще.');

  const add = useMutation({
    mutationFn: async (input: NewGoalInput) => {
      const row: InsertRow<'savings_goals'> = {
        name: input.name,
        description: input.description,
        target_amount: input.target_amount,
        url: input.url,
        status: 'pending',
        proposed_by: me.name,
        saved_amount: 0,
      };
      const { error } = await supabase.from('savings_goals').insert(row);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const confirm = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('savings_goals').update({ status: 'confirmed' }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const addFunds = useMutation({
    mutationFn: async (v: { id: number; current: number; amount: number }) => {
      const { error } = await supabase
        .from('savings_goals')
        .update({ saved_amount: v.current + v.amount })
        .eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  return { add, confirm, remove, addFunds };
}
