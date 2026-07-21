// ============================================================
// useCrystalDNA — «ДНК» кристала: агрегат із наявних даних пари
// ------------------------------------------------------------
// Жодної нової таблиці/схеми — лише 9 уже наявних хуків, зведених
// в один об'єкт. Той самий патерн, що вже є в useCoupleWishStats:
// вузький select, обчислення агрегату на клієнті.
// ============================================================
import { useMemo } from 'react';
import { useStartDate, usePhotoPool } from './useHome';
import { daysBetween } from './homeUtils';
import { useMapPins } from '@/features/map/useMapPins';
import { useMediaItems } from '@/features/media/useMedia';
import { useCoupleWishStats } from '@/features/wishlist/useWishlist';
import { useGoals } from '@/features/budget/useBudget';
import { useEvents } from '@/features/_shared/events';
import { useDishes } from '@/features/culinary/useDishes';

export interface CrystalDNA {
  daysTogether: number;
  photos: number;
  places: number;
  moviesWatched: number;
  booksRead: number;
  wishesDone: number;
  goalsAchieved: number;
  anniversaries: number;
  recipesSaved: number;
}

const EMPTY_DNA: CrystalDNA = {
  daysTogether: 0,
  photos: 0,
  places: 0,
  moviesWatched: 0,
  booksRead: 0,
  wishesDone: 0,
  goalsAchieved: 0,
  anniversaries: 0,
  recipesSaved: 0,
};

export function useCrystalDNA(): { dna: CrystalDNA; isPending: boolean; isError: boolean } {
  const startDate = useStartDate();
  const photos = usePhotoPool();
  const pins = useMapPins();
  const movies = useMediaItems('movie');
  const series = useMediaItems('series');
  const books = useMediaItems('book');
  const wishStats = useCoupleWishStats();
  const goals = useGoals();
  const events = useEvents();
  const dishes = useDishes();

  const queries = [photos, pins, movies, series, books, wishStats, goals, events, dishes];
  const isPending = queries.some((q) => q.isPending);
  const isError = queries.some((q) => q.isError);

  const dna = useMemo<CrystalDNA>(() => {
    if (isPending) return EMPTY_DNA;
    return {
      daysTogether: startDate ? Math.max(0, daysBetween(startDate)) : 0,
      photos: photos.data?.length ?? 0,
      places: pins.data?.length ?? 0,
      moviesWatched: [...(movies.data ?? []), ...(series.data ?? [])].filter((m) => m.status === 'done')
        .length,
      booksRead: (books.data ?? []).filter((b) => b.status === 'done').length,
      wishesDone: wishStats.data?.done ?? 0,
      goalsAchieved: (goals.data ?? []).filter(
        (g) =>
          g.status === 'confirmed' &&
          g.saved_amount != null &&
          g.target_amount != null &&
          g.saved_amount >= g.target_amount,
      ).length,
      anniversaries: (events.data ?? []).filter((e) => e.type === 'anniversary').length,
      recipesSaved: (dishes.data ?? []).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPending,
    startDate,
    photos.data,
    pins.data,
    movies.data,
    series.data,
    books.data,
    wishStats.data,
    goals.data,
    events.data,
    dishes.data,
  ]);

  return { dna, isPending, isError };
}
