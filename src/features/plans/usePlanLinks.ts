// ============================================================
// Зв'язки плану з бажаннями, мітками карти й спогадами.
// ------------------------------------------------------------
// Усі зв'язки читаються одним невеликим запитом. Для карти окремий хук
// завантажує лише мініатюрні поля реально прив'язаних спогадів замість
// усього фотоархіву, описів днів і джерел.
// ============================================================
import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useToast } from '@/providers/ToastProvider';
import type { MemoryRow, PlanLinkRow, PlanLinkTarget } from '@/types';

export type PlanMemoryPreview = Pick<MemoryRow, 'id' | 'photo_url' | 'memory_date'>;

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

/**
 * Легкий запит для оглядової карти.
 *
 * `useMemories()` навмисно повертає весь архів, усі memory_links і
 * memory_days — це правильно для модуля «Спогади», але занадто дорого для
 * карти планів, якій потрібна лише одна обкладинка виконаної точки.
 */
export function usePlanLinkedMemories(memoryIds: readonly number[]) {
  const ids = useMemo(
    () => [...new Set(memoryIds)].sort((left, right) => left - right),
    [memoryIds],
  );

  return useQuery({
    queryKey: ['plan-linked-memory-previews', ids] as const,
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PlanMemoryPreview[]> => {
      const { data, error } = await supabase
        .from('memories')
        .select('id,photo_url,memory_date')
        .in('id', ids)
        .order('memory_date', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as PlanMemoryPreview[];
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
