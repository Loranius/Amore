// ============================================================
// useCapsule — капсули часу (порт capsule.js даних)
// ------------------------------------------------------------
// Листи з датою відкриття. До дати партнер бачить лише факт листа;
// автор бачить/редагує завжди.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import { useCurrentUser } from '@/providers/AuthProvider';
import type { TimeCapsuleRow, InsertRow } from '@/types';

export function isUnlocked(openDate: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const open = new Date(openDate);
  open.setHours(0, 0, 0, 0);
  return today >= open;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function useCapsules() {
  return useQuery({
    queryKey: qk.capsules(),
    queryFn: async (): Promise<TimeCapsuleRow[]> => {
      const { data, error } = await supabase
        .from('time_capsules')
        .select('id,title,content,open_date,created_by')
        .order('open_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export interface CapsuleInput {
  title: string;
  content: string;
  open_date: string;
}

export function useCapsuleMutations() {
  const client = useQueryClient();
  const me = useCurrentUser();
  const toast = useToast();
  const invalidate = () => void client.invalidateQueries({ queryKey: qk.capsules() });
  const err = () => toast.show('Помилка. Спробуй ще.');

  const add = useMutation({
    mutationFn: async (input: CapsuleInput) => {
      const row: InsertRow<'time_capsules'> = { ...input, created_by: me.id };
      const { error } = await supabase.from('time_capsules').insert(row);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const edit = useMutation({
    mutationFn: async (v: { id: number; input: CapsuleInput }) => {
      const { error } = await supabase.from('time_capsules').update(v.input).eq('id', v.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  const remove = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.from('time_capsules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: err,
  });

  return { add, edit, remove };
}
