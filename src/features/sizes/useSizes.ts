// ============================================================
// Заміри — читання й запис.
// ------------------------------------------------------------
// Переїхало з `features/settings/useSettings.ts` разом із самим модулем.
// Логіка та сама: один рядок на людину, `upsert` по `user_id`.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import type { InsertRow, UserSizesRow } from '@/types';

export function useUserSizes(userId: number) {
  return useQuery({
    queryKey: qk.userSizes(userId),
    queryFn: async (): Promise<UserSizesRow | null> => {
      const { data, error } = await supabase
        .from('user_sizes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

export function useSaveSizes() {
  const client = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (patch: InsertRow<'user_sizes'>): Promise<void> => {
      const { error } = await supabase.from('user_sizes').upsert(patch, { onConflict: 'user_id' });
      if (error) throw error;
    },
    onSuccess: (_data, patch) => {
      void client.invalidateQueries({ queryKey: qk.userSizes(patch.user_id) });
      /*
       * Підтвердження вголос, а не тиша.
       *
       * Форма закривається сама, і без тосту це читалось як «вона просто
       * закрилась» — тобто пара не знала, збереглось чи ні, і тиснула
       * «Зберегти» вдруге.
       */
      toast.show('Заміри збережено');
    },
    onError: () => toast.show('Не вдалося зберегти заміри'),
  });
}
