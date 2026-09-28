// ============================================================
// useHome — базові дані головної (дата старту стосунків, пул фото)
// ============================================================
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { listCoupleRoot } from '@/lib/couplePath';

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

const CRYSTAL_SEED_LS = 'amore:crystalSeed';

/** Персистентна «генетика» кристала (settings.crystal_seed) — миттєво з localStorage. */
export function useCrystalSeed(): { seed: string | null; isPending: boolean } {
  let cached: string | null = null;
  try {
    cached = localStorage.getItem(CRYSTAL_SEED_LS);
  } catch {
    /* ignore */
  }

  const query = useQuery({
    queryKey: [...qk.settings(), 'crystal_seed'],
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'crystal_seed')
        .maybeSingle();
      if (error) throw error;
      return typeof data?.value === 'string' ? data.value : null;
    },
  });

  useEffect(() => {
    if (query.data) {
      try {
        localStorage.setItem(CRYSTAL_SEED_LS, query.data);
      } catch {
        /* ignore */
      }
    }
  }, [query.data]);

  return { seed: query.data ?? cached, isPending: query.isPending && !cached };
}

/** Пул фото зі Storage (для грані «Фотографії» кристала). */
const PHOTO_BUCKET = 'family_photos';

/** Фото з ДАТОЮ завантаження. Дата тут не косметика: без неї фото —
 *  недатований агрегат, і Evolution Engine не має права пускати їх у форму
 *  кристала (див. artifact/species/crystalConstraints.ts: недатований факт
 *  зрушив би всю вже відкладену масу й зламав append-only). Storage і так
 *  віддає `created_at` — раніше воно просто викидалось. */
export interface PhotoAsset {
  url: string;
  /** ISO-дата (YYYY-MM-DD) завантаження; null, якщо Storage її не дав. */
  date: string | null;
}

export function usePhotoPool() {
  return useQuery({
    queryKey: qk.photos(),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PhotoAsset[]> => {
      const files = await listCoupleRoot(PHOTO_BUCKET, 50);
      return files.map((f) => ({
        url: publicUrl(PHOTO_BUCKET, f.path),
        date: f.created_at ? f.created_at.slice(0, 10) : null,
      }));
    },
  });
}
