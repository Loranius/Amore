// ============================================================
// useBudget — фінанси: вільний ліміт + спільні цілі
// ------------------------------------------------------------
// Читання лишається через типізовані таблиці, а всі записи проходять
// через security-definer RPC: сервер перевіряє автора/партнера, стан
// пропозиції та виконує внески атомарно.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import type { FreeLimitRow, SavingsGoalRow } from '@/types';

/** Сума → «1 234 ₴». */
export const fmtMoney = (n: number | null | undefined): string =>
  Math.round(Math.abs(Number(n) || 0)).toLocaleString('uk-UA') + ' ₴';

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

// Database.Functions поки описує лише стабільні старі контракти. Нові RPC
// викликаємо через вузький локальний адаптер, не розмиваючи типи всього клієнта.
const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

async function callFinanceRpc(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

function isStaleFinanceError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('finance_stale');
}

/** Реальний PK savings_goals у Supabase — UUID, не number. */
export type BudgetGoalRow = Omit<SavingsGoalRow, 'id'> & { id: string };

function normalizeGoalRow(row: SavingsGoalRow): BudgetGoalRow {
  const id = (row as unknown as { id?: unknown }).id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new Error('savings_goals повернув некоректний UUID');
  }
  return row as unknown as BudgetGoalRow;
}

// ── Вільний ліміт ────────────────────────────────────────────
type FreeLimit = Pick<FreeLimitRow, 'limit_value' | 'proposal_value' | 'proposed_by'>;

export interface FreeLimitProposalSnapshot {
  value: number;
  proposedBy: string;
}

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
      return data ?? { limit_value: 0, proposal_value: null, proposed_by: null };
    },
  });
}

export function useFreeLimitMutations() {
  const client = useQueryClient();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.freeLimit() });
  const onError = (error: unknown) => {
    console.error('Finance free-limit mutation failed:', error);
    toast.show(isStaleFinanceError(error) ? 'Пропозиція вже змінилася. Дані оновлено.' : 'Помилка. Спробуй ще.');
  };

  const propose = useMutation({
    mutationFn: async (value: number) => {
      await callFinanceRpc('finance_propose_free_limit_v1', { p_value: value });
    },
    onError,
    onSettled: invalidate,
  });

  const confirm = useMutation({
    mutationFn: async ({ value, proposedBy }: FreeLimitProposalSnapshot) => {
      await callFinanceRpc('finance_confirm_free_limit_v1', {
        p_expected_value: value,
        p_expected_proposed_by: proposedBy,
      });
    },
    onError,
    onSettled: invalidate,
  });

  const reject = useMutation({
    mutationFn: async ({ value, proposedBy }: FreeLimitProposalSnapshot) => {
      await callFinanceRpc('finance_reject_free_limit_v1', {
        p_expected_value: value,
        p_expected_proposed_by: proposedBy,
      });
    },
    onError,
    onSettled: invalidate,
  });

  return { propose, confirm, reject };
}

// ── Спільні цілі ─────────────────────────────────────────────
export function useGoals() {
  return useQuery({
    queryKey: qk.savingsGoals(),
    queryFn: async (): Promise<BudgetGoalRow[]> => {
      const { data, error } = await supabase
        .from('savings_goals')
        .select('id,name,target_amount,url,description,status,proposed_by,saved_amount')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(normalizeGoalRow);
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
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.savingsGoals() });
  const onError = (error: unknown) => {
    console.error('Finance goal mutation failed:', error);
    toast.show(isStaleFinanceError(error) ? 'Ціль уже змінилася. Дані оновлено.' : 'Помилка. Спробуй ще.');
  };

  const add = useMutation({
    mutationFn: async (input: NewGoalInput) => {
      await callFinanceRpc('finance_create_savings_goal_v1', {
        p_name: input.name,
        p_description: input.description,
        p_target_amount: input.target_amount,
        p_url: input.url,
      });
    },
    onError,
    onSettled: invalidate,
  });

  const confirm = useMutation({
    mutationFn: async (id: string) => {
      await callFinanceRpc('finance_confirm_savings_goal_v1', { p_goal_id: id });
    },
    onError,
    onSettled: invalidate,
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      await callFinanceRpc('finance_reject_savings_goal_v1', { p_goal_id: id });
    },
    onError,
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await callFinanceRpc('finance_delete_savings_goal_v1', { p_goal_id: id });
    },
    onError,
    onSettled: invalidate,
  });

  const addFunds = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      await callFinanceRpc('finance_add_savings_goal_funds_v1', {
        p_goal_id: id,
        p_amount: amount,
      });
    },
    onError,
    onSettled: invalidate,
  });

  return { add, confirm, reject, remove, addFunds };
}
