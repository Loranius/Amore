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
  distinctCountries: number;
  milestones: number;
}

/** Дельти «за цей місяць» — лише там, де це можна порахувати чесно. */
export interface CrystalDeltas {
  wishesDoneThisMonth: number;
  placesThisMonth: number;
  moviesWatchedThisMonth: number;
  booksReadThisMonth: number;
  recipesSavedThisMonth: number;
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
  distinctCountries: 0,
  milestones: 0,
};

const EMPTY_DELTAS: CrystalDeltas = {
  wishesDoneThisMonth: 0,
  placesThisMonth: 0,
  moviesWatchedThisMonth: 0,
  booksReadThisMonth: 0,
  recipesSavedThisMonth: 0,
};

function isThisMonth(dateStr: string, now: Date): boolean {
  const d = new Date(dateStr);
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export function useCrystalDNA(): {
  dna: CrystalDNA;
  deltas: CrystalDeltas;
  isPending: boolean;
  isError: boolean;
} {
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
      distinctCountries: new Set(
        (pins.data ?? []).map((p) => p.country).filter((c): c is string => !!c),
      ).size,
      milestones: (events.data ?? []).filter((e) => e.is_milestone).length,
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

  const deltas = useMemo<CrystalDeltas>(() => {
    if (isPending) return EMPTY_DELTAS;
    const now = new Date();
    return {
      wishesDoneThisMonth: wishStats.data?.doneThisMonth ?? 0,
      placesThisMonth: (pins.data ?? []).filter((p) => isThisMonth(p.created_at, now)).length,
      moviesWatchedThisMonth: [...(movies.data ?? []), ...(series.data ?? [])].filter(
        (m) => m.status === 'done' && isThisMonth(m.created_at, now),
      ).length,
      booksReadThisMonth: (books.data ?? []).filter(
        (b) => b.status === 'done' && isThisMonth(b.created_at, now),
      ).length,
      recipesSavedThisMonth: (dishes.data ?? []).filter((d) => isThisMonth(d.created_at, now)).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, pins.data, movies.data, series.data, books.data, wishStats.data, dishes.data]);

  return { dna, deltas, isPending, isError };
}
