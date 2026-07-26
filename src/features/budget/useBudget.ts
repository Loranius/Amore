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

function financeErrorText(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('finance_contribution_delete_not_allowed')) {
    return 'Можна скасувати лише власний внесок.';
  }
  if (message.includes('finance_stale_contribution')) {
    return 'Цей внесок уже змінено. Історію оновлено.';
  }
  if (isStaleFinanceError(error)) {
    return 'Дані вже змінилися. Сторінку оновлено.';
  }
  return 'Помилка. Спробуй ще.';
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

export interface GoalContribution {
  id: string;
  goalId: string;
  amount: number;
  note: string | null;
  contributedBy: number;
  contributorName: string;
  createdAt: string;
}

function normalizeContribution(value: unknown): GoalContribution {
  if (!value || typeof value !== 'object') {
    throw new Error('Finance contribution RPC returned an invalid row');
  }

  const row = value as Record<string, unknown>;
  const id = row.id;
  const goalId = row.goal_id;
  const amount = Number(row.amount);
  const contributedBy = Number(row.contributed_by);
  const contributorName = row.contributor_name;
  const createdAt = row.created_at;
  const note = row.note;

  if (
    typeof id !== 'string'
    || typeof goalId !== 'string'
    || !Number.isFinite(amount)
    || !Number.isSafeInteger(contributedBy)
    || typeof contributorName !== 'string'
    || typeof createdAt !== 'string'
    || (note !== null && typeof note !== 'string')
  ) {
    throw new Error('Finance contribution RPC returned an invalid payload');
  }

  return {
    id,
    goalId,
    amount,
    note: note as string | null,
    contributedBy,
    contributorName,
    createdAt,
  };
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

export function useGoalContributions(goalId: string | null) {
  return useQuery({
    queryKey: qk.savingsGoalContributions(goalId ?? undefined),
    enabled: goalId !== null,
    queryFn: async (): Promise<GoalContribution[]> => {
      if (!goalId) return [];
      const data = await callFinanceRpc('finance_get_savings_goal_contributions_v1', {
        p_goal_id: goalId,
      });
      if (!Array.isArray(data)) {
        throw new Error('Finance contribution history returned an invalid payload');
      }
      return data.map(normalizeContribution);
    },
  });
}

export interface NewGoalInput {
  name: string;
  description: string | null;
  target_amount: number;
  url: string | null;
}

export interface AddContributionInput {
  id: string;
  amount: number;
  note: string | null;
}

export interface DeleteContributionInput {
  contributionId: string;
  goalId: string;
}

export function useGoalMutations() {
  const client = useQueryClient();
  const toast = useToast();

  const invalidateGoal = (goalId?: string) => {
    void client.invalidateQueries({ queryKey: qk.savingsGoals() });
    if (goalId) {
      void client.invalidateQueries({ queryKey: qk.savingsGoalContributions(goalId) });
    }
  };

  const onError = (error: unknown) => {
    console.error('Finance goal mutation failed:', error);
    toast.show(financeErrorText(error));
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
    onSettled: () => invalidateGoal(),
  });

  const confirm = useMutation({
    mutationFn: async (id: string) => {
      await callFinanceRpc('finance_confirm_savings_goal_v1', { p_goal_id: id });
    },
    onError,
    onSettled: (_data, _error, id) => invalidateGoal(id),
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      await callFinanceRpc('finance_reject_savings_goal_v1', { p_goal_id: id });
    },
    onError,
    onSettled: (_data, _error, id) => invalidateGoal(id),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await callFinanceRpc('finance_delete_savings_goal_v1', { p_goal_id: id });
    },
    onError,
    onSettled: (_data, _error, id) => invalidateGoal(id),
  });

  const addContribution = useMutation({
    mutationFn: async ({ id, amount, note }: AddContributionInput) => {
      await callFinanceRpc('finance_add_savings_goal_contribution_v1', {
        p_goal_id: id,
        p_amount: amount,
        p_note: note,
      });
    },
    onError,
    onSettled: (_data, _error, input) => invalidateGoal(input.id),
  });

  const deleteContribution = useMutation({
    mutationFn: async ({ contributionId }: DeleteContributionInput) => {
      await callFinanceRpc('finance_delete_savings_goal_contribution_v1', {
        p_contribution_id: contributionId,
      });
    },
    onError,
    onSettled: (_data, _error, input) => invalidateGoal(input.goalId),
  });

  // Залишаємо старий mutation-контракт для місць, які ще не передають примітку.
  const addFunds = useMutation({
    mutationFn: async ({ id, amount }: { id: string; amount: number }) => {
      await callFinanceRpc('finance_add_savings_goal_funds_v1', {
        p_goal_id: id,
        p_amount: amount,
      });
    },
    onError,
    onSettled: (_data, _error, input) => invalidateGoal(input.id),
  });

  return {
    add,
    confirm,
    reject,
    remove,
    addContribution,
    deleteContribution,
    addFunds,
  };
}
