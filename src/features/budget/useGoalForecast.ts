import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';

const FORECAST_QUERY_KEY = ['savingsGoalForecasts'] as const;

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;

const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

async function callFinanceRpc(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export interface GoalForecast {
  goalId: string;
  contributionCount: number;
  monthlyPace: number | null;
  forecastDate: string | null;
  desiredDate: string | null;
  monthlyNeeded: number | null;
  remainingAmount: number;
}

function normalizeNullableNumber(value: unknown): number | null {
  if (value === null) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

function normalizeForecast(value: unknown): GoalForecast {
  if (!value || typeof value !== 'object') {
    throw new Error('Finance forecast RPC returned an invalid row');
  }

  const row = value as Record<string, unknown>;
  const goalId = row.goal_id;
  const contributionCount = Number(row.contribution_count);
  const remainingAmount = Number(row.remaining_amount);
  const forecastDate = row.forecast_date;
  const desiredDate = row.desired_date;

  if (
    typeof goalId !== 'string'
    || !Number.isSafeInteger(contributionCount)
    || !Number.isFinite(remainingAmount)
    || (forecastDate !== null && typeof forecastDate !== 'string')
    || (desiredDate !== null && typeof desiredDate !== 'string')
  ) {
    throw new Error('Finance forecast RPC returned an invalid payload');
  }

  return {
    goalId,
    contributionCount,
    monthlyPace: normalizeNullableNumber(row.monthly_pace),
    forecastDate: forecastDate as string | null,
    desiredDate: desiredDate as string | null,
    monthlyNeeded: normalizeNullableNumber(row.monthly_needed),
    remainingAmount,
  };
}

export function useGoalForecasts() {
  const client = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void client.invalidateQueries({ queryKey: FORECAST_QUERY_KEY });
    };

    const channel = supabase
      .channel('finance-soft-forecast-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_goals' },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'savings_goal_contributions' },
        invalidate,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [client]);

  return useQuery({
    queryKey: FORECAST_QUERY_KEY,
    queryFn: async (): Promise<GoalForecast[]> => {
      const data = await callFinanceRpc('finance_get_savings_goal_forecasts_v1');
      if (!Array.isArray(data)) {
        throw new Error('Finance forecast RPC returned an invalid result');
      }
      return data.map(normalizeForecast);
    },
  });
}

export interface SetDesiredDateInput {
  goalId: string;
  desiredDate: string | null;
}

export function useGoalForecastMutations() {
  const client = useQueryClient();
  const toast = useToast();

  const setDesiredDate = useMutation({
    mutationFn: async ({ goalId, desiredDate }: SetDesiredDateInput) => {
      await callFinanceRpc('finance_set_savings_goal_desired_date_v1', {
        p_goal_id: goalId,
        p_desired_date: desiredDate,
      });
    },
    onError: (error: unknown) => {
      console.error('Finance forecast mutation failed:', error);
      const message = error instanceof Error ? error.message : '';
      toast.show(
        message.includes('finance_goal_desired_date_in_past')
          ? 'Обери сьогоднішню або майбутню дату.'
          : 'Не вдалося змінити орієнтир. Спробуй ще.',
      );
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: FORECAST_QUERY_KEY });
    },
  });

  return { setDesiredDate };
}
