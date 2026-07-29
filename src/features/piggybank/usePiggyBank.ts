import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/providers/ToastProvider';

const PIGGY_BANK_KEY = ['piggyBankBalance'] as const;

type RpcError = { message: string };
type RpcResponse = Promise<{ data: unknown; error: RpcError | null }>;
type RpcCaller = (fn: string, args?: Record<string, unknown>) => RpcResponse;
const rpc = supabase.rpc.bind(supabase) as unknown as RpcCaller;

export interface PiggyBankSnapshot {
  balance: number;
  updatedBy: number | null;
  updatedByName: string | null;
  updatedAt: string | null;
}

function normalizeSnapshot(value: unknown): PiggyBankSnapshot {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object') {
    return { balance: 0, updatedBy: null, updatedByName: null, updatedAt: null };
  }

  const record = row as Record<string, unknown>;
  const balance = Number(record.balance ?? 0);
  const updatedBy = record.updated_by;
  const updatedByName = record.updated_by_name;
  const updatedAt = record.updated_at;

  if (!Number.isFinite(balance) || balance < 0) {
    throw new Error('Скарбничка повернула некоректну суму.');
  }

  return {
    balance,
    updatedBy: updatedBy === null || updatedBy === undefined ? null : Number(updatedBy),
    updatedByName: typeof updatedByName === 'string' ? updatedByName : null,
    updatedAt: typeof updatedAt === 'string' ? updatedAt : null,
  };
}

async function callRpc(fn: string, args?: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export function usePiggyBank() {
  return useQuery({
    queryKey: PIGGY_BANK_KEY,
    queryFn: async () => normalizeSnapshot(await callRpc('finance_get_piggy_bank_v1')),
  });
}

export function usePiggyBankMutations() {
  const client = useQueryClient();
  const toast = useToast();

  const setBalance = useMutation({
    mutationFn: async ({ balance, expectedUpdatedAt }: {
      balance: number;
      expectedUpdatedAt: string | null;
    }) => {
      if (!Number.isFinite(balance) || balance < 0) {
        throw new Error('finance_piggy_bank_balance_invalid');
      }
      await callRpc('finance_set_piggy_bank_balance_v1', {
        p_balance: balance,
        p_expected_updated_at: expectedUpdatedAt,
      });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: PIGGY_BANK_KEY });
      toast.show('Суму в скарбничці оновлено');
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('finance_stale')) {
        toast.show('Суму вже змінив партнер. Дані оновлено.');
        void client.invalidateQueries({ queryKey: PIGGY_BANK_KEY });
        return;
      }
      toast.show('Не вдалося оновити скарбничку. Спробуй ще.');
    },
  });

  return { setBalance };
}
