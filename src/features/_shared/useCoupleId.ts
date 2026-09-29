// ============================================================
// Номер пари того, хто увійшов (`portal_me`).
// ------------------------------------------------------------
// Пару питаємо в бази, а не виводимо з id людини: id людей нових пар
// довільні. Кеш цього запиту стирається разом із сесією (ADR-0236), тож
// після входу іншою парою він не віддасть чужий номер.
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';

export function useCoupleId(): { coupleId: number | null; isPending: boolean } {
  const query = useQuery({
    queryKey: qk.myCouple(),
    staleTime: Infinity,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('portal_me');
      if (error) throw error;
      const row = Array.isArray(data) ? (data[0] as { couple_id?: unknown } | undefined) : undefined;
      if (typeof row?.couple_id !== 'number') throw new Error('portal_me: немає пари');
      return row.couple_id;
    },
  });
  return { coupleId: query.data ?? null, isPending: query.isPending };
}
