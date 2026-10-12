// ============================================================
// useHome — базові дані головної (дата старту стосунків, пул фото)
// ============================================================
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, publicUrl } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { listCoupleRoot } from '@/lib/couplePath';
import { mergePhotoPool, type MemoryPhotoRow, type PhotoAsset } from './photoPool';

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

/** Корінь цього бакета — полароїди, покладені до ADR-0248. */
const PHOTO_BUCKET = 'family_photos';

export type { PhotoAsset } from './photoPool';

/**
 * Пул фото для грані «Фотографії» кристала: фото спогадів разом із тим, що
 * вже лежить у корені `family_photos` (`photoPool.ts`, ADR-0248).
 *
 * Ключ лишається `qk.photos()`: зміна `memories` скидає його і з
 * realtime-підписки, і з мутацій спогадів, тож кристал бачить нове фото
 * без перезавантаження.
 */
export function usePhotoPool() {
  return useQuery({
    queryKey: qk.photos(),
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<PhotoAsset[]> => {
      const [files, memoriesRes] = await Promise.all([
        listCoupleRoot(PHOTO_BUCKET, 50),
        supabase.from('memories').select('photo_url,memory_date,moment_id')
          .order('id', { ascending: true }),
      ]);
      if (memoriesRes.error) throw memoriesRes.error;
      return mergePhotoPool(
        files.map((f) => ({ url: publicUrl(PHOTO_BUCKET, f.path), created_at: f.created_at ?? null })),
        (memoriesRes.data ?? []) as MemoryPhotoRow[],
      );
    },
  });
}
