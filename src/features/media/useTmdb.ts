// ============================================================
// useTmdb — хуки TMDB (пошук із дебаунсом, деталі)
// ------------------------------------------------------------
// Пошук лише для фільмів/серіалів (TMDB не знає про книги). Race
// між типами знімає сам queryKey (тип у ключі) + enabled.
// ============================================================
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { tmdbSearch, tmdbDetails, tmdbGenres } from '@/lib/tmdb';
import type { MediaType, MediaItemRow, SwipeType } from '@/types';

/** Дебаунс значення (400мс, як старий searchTimer). */
function useDebounced<T>(value: T, delay = 400): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function useTmdbSearch(query: string, type: MediaType) {
  const debounced = useDebounced(query.trim());
  const enabled = debounced.length > 0 && type !== 'book';
  return useQuery({
    queryKey: ['tmdb', 'search', type, debounced],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: () => tmdbSearch(debounced, type),
  });
}

/**
 * Список жанрів для фільтра свайпу.
 *
 * `staleTime: Infinity` — не оптимізація «про всяк випадок»: набір
 * жанрів TMDB не змінюється роками, і перепитувати його на кожному
 * відкритті панелі означало б платити запитом за незмінну відповідь.
 * `gcTime` теж довгий, щоб список пережив закриття панелі.
 */
export function useTmdbGenres(type: SwipeType, enabled: boolean) {
  return useQuery({
    queryKey: ['tmdb', 'genres', type],
    enabled,
    staleTime: Infinity,
    gcTime: 24 * 60 * 60_000,
    queryFn: () => tmdbGenres(type),
  });
}

export function useTmdbDetails(item: MediaItemRow | null) {
  return useQuery({
    queryKey: ['tmdb', 'details', item?.type, item?.title],
    enabled: item !== null && item.type !== 'book',
    staleTime: 30 * 60_000,
    queryFn: () => tmdbDetails(item!.title, item!.type, item!.poster_url),
  });
}
