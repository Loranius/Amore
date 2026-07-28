// ============================================================
// Зв'язки плану з бажаннями, мітками карти й спогадами.
// ------------------------------------------------------------
// Одна таблиця на всі типи (взірець memory_links) і ОДИН запит на всі
// плани: рядків тут одиниці, а окремий запит на кожен план означав би
// N запитів на списку планів заради трьох рядків.
//
// Ціль зв'язку не має зовнішнього ключа, тож рядок може пережити своє
// бажання. Розв'язує це не база, а показ: назву для осиротілого
// зв'язку нема звідки взяти, і клієнт його просто не малює.
// ============================================================
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import type { PlanLinkRow, PlanLinkTarget } from '@/types';

export function usePlanLinks() {
  return useQuery({
    queryKey: qk.planLinks(),
    queryFn: async (): Promise<PlanLinkRow[]> => {
      const { data, error } = await supabase
        .from('plan_links')
        .select('plan_id,target_type,target_id,created_at');
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanLinkRow[];
    },
  });
}

export interface PlanLinkInput {
  planId: number;
  targetType: PlanLinkTarget;
  targetId: number;
}

export function usePlanLinkMutations() {
  const client = useQueryClient();
  const toast = useToast();

  const invalidate = () => void client.invalidateQueries({ queryKey: qk.planLinks() });
  const onError = (e: unknown) => toast.show('Помилка: ' + (e as Error).message);

  const link = useMutation({
    mutationFn: async ({ planId, targetType, targetId }: PlanLinkInput) => {
      // Повторна прив'язка того самого — не помилка, а «вже так і є».
      // Без ignoreDuplicates подвійний тап падав би на первинному ключі.
      const { error } = await supabase
        .from('plan_links')
        .upsert(
          { plan_id: planId, target_type: targetType, target_id: targetId },
          { onConflict: 'plan_id,target_type,target_id', ignoreDuplicates: true },
        );
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError,
  });

  const unlink = useMutation({
    mutationFn: async ({ planId, targetType, targetId }: PlanLinkInput) => {
      const { error } = await supabase
        .from('plan_links')
        .delete()
        .eq('plan_id', planId)
        .eq('target_type', targetType)
        .eq('target_id', targetId);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError,
  });

  return { link, unlink };
}
