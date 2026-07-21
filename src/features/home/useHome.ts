// ============================================================
// useHome — базові дані головної (дата старту стосунків, пул фото)
// ============================================================
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';

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

/** Пул фото зі Storage (для грані «Фотографії» кристала). */
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
