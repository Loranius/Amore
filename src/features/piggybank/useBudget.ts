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
  if (message.includes('finance_goal_paused')) {
    return 'Ціль зараз на паузі. Спочатку віднови її.';
  }
  if (message.includes('finance_goal_already_paused')) {
    return 'Ціль уже на паузі. Дані оновлено.';
  }
  if (message.includes('finance_goal_not_paused')) {
    return 'Ціль уже активна. Дані оновлено.';
  }
  if (message.includes('finance_goal_pause_state_invalid')) {
    return 'Не вдалося відновити ціль. Спробуй ще.';
  }
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
export type BudgetGoalRow = Omit<SavingsGoalRow, 'id'> & {
  id: string;
  paused_at: string | null;
};

interface GoalSelectChain {
  order(
    column: string,
    options: { ascending: boolean },
  ): Promise<{ data: unknown[] | null; error: RpcError | null }>;
}

interface GoalTableReader {
  select(columns: string): GoalSelectChain;
}

function normalizeGoalRow(value: unknown): BudgetGoalRow {
  if (!value || typeof value !== 'object') {
    throw new Error('savings_goals повернув некоректний рядок');
  }

  const row = value as Record<string, unknown>;
  const id = row.id;
  const pausedAt = row.paused_at;
  const planId = row.plan_id;

  if (
    typeof id !== 'string'
    || id.length === 0
    || (pausedAt !== null && typeof pausedAt !== 'string')
  ) {
    throw new Error('savings_goals повернув некоректний UUID або стан паузи');
  }

  // plan_id приходить із PostgREST як number або null. Мовчки лишити тут
  // рядок означало б, що порівняння `goal.plan_id === plan.id` тихо не
  // спрацює й ціль не знайде свій план.
  return {
    ...(value as BudgetGoalRow),
    plan_id: planId === null || planId === undefined ? null : Number(planId),
  };
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
      // `maybeSingle`, а не `single`: `single` кидає помилку, коли рядка
      // немає, тож запасне значення нижче було недосяжним, а порожня
      // таблиця перетворювалась на вічну помилку замість «ліміт ще не
      // задано». Пара з чистою базою бачила б збій на головному екрані
      // фінансів.
      const { data, error } = await supabase
        .from('free_limit')
        .select('limit_value,proposal_value,proposed_by')
        .eq('id', 1)
        .maybeSingle();
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
      // paused_at щойно доданий міграцією і ще не входить до згенерованих типів.
      const table = supabase.from('savings_goals') as unknown as GoalTableReader;
      const { data, error } = await table
        .select('id,name,target_amount,url,description,status,proposed_by,saved_amount,paused_at,plan_id')
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
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
  /** Коли ціль заводять зі сторінки плану — вона одразу його. */
  plan_id?: number | null;
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
    void client.invalidateQueries({ queryKey: ['savingsGoalForecasts'] });
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
      // v3 замість v1 лише коли ціль заводять під план: створити, а
      // потім прив'язати окремим викликом означало б вікно, у якому
      // ціль уже видно обом, але вона ще нічия — на грошах із
      // підтвердженням партнера це зайве питання «а це на що?».
      if (input.plan_id != null) {
        await callFinanceRpc('finance_create_savings_goal_v3', {
          p_name: input.name,
          p_description: input.description,
          p_target_amount: input.target_amount,
          p_url: input.url,
          p_desired_date: null,
          p_plan_id: input.plan_id,
        });
        return;
      }
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

  /** Прив'язати ціль до плану або відв'язати (planId === null). */
  const setGoalPlan = useMutation({
    mutationFn: async ({ goalId, planId }: { goalId: string; planId: number | null }) => {
      await callFinanceRpc('finance_set_savings_goal_plan_v1', {
        p_goal_id: goalId,
        p_plan_id: planId,
      });
    },
    onError,
    onSettled: (_data, _error, vars) => invalidateGoal(vars.goalId),
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

  const pause = useMutation({
    mutationFn: async (id: string) => {
      await callFinanceRpc('finance_pause_savings_goal_v1', { p_goal_id: id });
    },
    onSuccess: () => toast.show('Ціль поставлено на паузу. Усе збережено.'),
    onError,
    onSettled: (_data, _error, id) => invalidateGoal(id),
  });

  const resume = useMutation({
    mutationFn: async (id: string) => {
      await callFinanceRpc('finance_resume_savings_goal_v1', { p_goal_id: id });
    },
    onSuccess: () => toast.show('Ціль знову активна.'),
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
    pause,
    resume,
    addContribution,
    deleteContribution,
    addFunds,
    setGoalPlan,
  };
}
