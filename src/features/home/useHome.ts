// ============================================================
// useHome — дані головної (порт counter/home-widgets/photos даних)
// ============================================================
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { todayStr } from './homeUtils';

const START_LS = 'amore:startDate';

/** Дата старту стосунків: миттєво з localStorage, потім ревалідація з БД. */
export function useStartDate(): string | null {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(START_LS);
  } catch {
    /* ignore */
  }

  const query = useQuery({
    queryKey: [...qk.settings(), 'relationship_start_date'],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'relationship_start_date')
        .maybeSingle();
      if (error) throw error;
      return typeof data?.value === 'string' ? data.value : null;
    },
  });

  useEffect(() => {
    if (query.data) {
      try {
        localStorage.setItem(START_LS, query.data);
      } catch {
        /* ignore */
      }
    }
  }, [query.data]);

  return query.data ?? cached;
}

/** Чи відповів поточний користувач на питання дня (для тизера). */
export function useQuestionAnswered(): boolean {
  const me = useCurrentUser();
  const { data } = useQuery({
    queryKey: ['home', 'questionTeaser', todayStr(), me.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_question_log')
        .select('answer_dima,answer_lena')
        .eq('date', todayStr())
        .maybeSingle();
      if (error) throw error;
      if (!data) return false;
      return me.name === 'Діма' ? !!data.answer_dima : !!data.answer_lena;
    },
  });
  return data ?? true; // поки не знаємо — тизер ховаємо
}

/** Найближчий спільний вихідний (обидва «Х» у графіку) або null. */
export function useSharedDayoff(): string | null {
  const { data: users } = useUsers();
  const ids = (users ?? []).map((u) => u.id);

  const { data } = useQuery({
    queryKey: ['home', 'dayoff', todayStr()],
    enabled: ids.length >= 2,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('work_schedule')
        .select('date,user_id')
        .eq('mark', 'Х')
        .gte('date', todayStr())
        .order('date', { ascending: true })
        .limit(300);
      if (error) throw error;
      const byDate = new Map<string, Set<number>>();
      for (const r of data ?? []) {
        (byDate.get(r.date) ?? byDate.set(r.date, new Set()).get(r.date)!).add(r.user_id);
      }
      const shared = [...byDate.keys()]
        .filter((d) => ids.every((id) => byDate.get(d)!.has(id)))
        .sort();
      return shared[0] ?? null;
    },
  });
  return data ?? null;
}

/** Пул фото зі Storage для полароїд-хмарки. */
const PHOTO_BUCKET = 'family_photos';
export function usePhotoPool() {
  return useQuery({
    queryKey: qk.photos(),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .list('', { limit: 50, sortBy: { column: 'created_at', order: 'desc' } });
      if (error) throw error;
      return (data ?? [])
        .filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(f.name))
        .map((f) => publicUrl(PHOTO_BUCKET, f.name));
    },
  });
}
