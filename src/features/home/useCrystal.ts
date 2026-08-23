// ============================================================
// useCrystalDNA — «ДНК» кристала: агрегат із наявних даних пари
// ------------------------------------------------------------
// Жодної нової таблиці/схеми — лише 9 уже наявних хуків, зведених
// в один об'єкт. Той самий патерн, що вже є в useCoupleWishStats:
// вузький select, обчислення агрегату на клієнті.
// ============================================================
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import { useStartDate, usePhotoPool } from './useHome';
import { daysBetween } from './homeUtils';
import { useMapPins } from '@/features/memories/useMapPins';
import { useMediaItems } from '@/features/media/useMedia';
import { useCoupleWishStats } from '@/features/wishlist/useWishlist';
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
  /** Сума saved_amount по всіх спільних цілях — «фінанси потовщують основу». */
  totalSaved: number;
}

/** Дельти «за цей місяць» — лише там, де це можна порахувати чесно. */
export interface CrystalDeltas {
  wishesDoneThisMonth: number;
  placesThisMonth: number;
  moviesWatchedThisMonth: number;
  booksReadThisMonth: number;
  recipesSavedThisMonth: number;
}

/** Нулі для стану «дані ще не прийшли». Експортується, бо той самий
 *  порожній знімок потрібен і заглушці кристала, поки вантажиться 3D. */
export const EMPTY_DNA: CrystalDNA = {
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
  totalSaved: 0,
};

export const EMPTY_DELTAS: CrystalDeltas = {
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

/** Датоване фото для Evolution Engine: `id` — стабільний порядковий номер
 *  у пулі (Storage не дає числових ключів), `date` — день завантаження. */
export interface CrystalPhoto {
  id: number;
  date: string;
}

export function useCrystalDNA(): {
  dna: CrystalDNA;
  /** Фото з датами — окремо від лічильника `dna.photos`: рушій рахує їх
   *  історично (скільки їх БУЛО на дату кожного тіла), а лічильник лишається
   *  для «порожній кристал?» і для дельт. */
  photos: CrystalPhoto[];
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
  const events = useEvents();
  const dishes = useDishes();

  const queries = [photos, pins, movies, series, books, wishStats, events, dishes];
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
      /*
       * Нуль тут — не заглушка, а факт: модуль «Скарбничка» видалено
       * (ADR-0049), і функції накопичень у порталі більше немає. Модель
       * застарілого рендерера правильно робить кристал щільнішим від
       * відкладених грошей — просто відкладати тепер нíчого.
       */
      goalsAchieved: 0,
      anniversaries: (events.data ?? []).filter((e) => e.type === 'anniversary').length,
      recipesSaved: (dishes.data ?? []).length,
      distinctCountries: new Set(
        (pins.data ?? []).map((p) => p.country).filter((c): c is string => !!c),
      ).size,
      milestones: (events.data ?? []).filter((e) => e.is_milestone).length,
      totalSaved: 0,
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

  // Порядок пулу — за `created_at` спадно (usePhotoPool), тож сортуємо за
  // датою зростаюче й нумеруємо: найстарше фото завжди дістає id 1 і не
  // перенумеровується від нових завантажень (append-only на рівні ключів,
  // той самий принцип, що в bucketByFixedSize).
  const photoItems = useMemo<CrystalPhoto[]>(() => {
    if (isPending) return [];
    return (photos.data ?? [])
      .filter((p): p is { url: string; date: string } => p.date !== null)
      .map((p) => p.date)
      .sort()
      .map((date, i) => ({ id: i + 1, date }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPending, photos.data]);

  return { dna, photos: photoItems, deltas, isPending, isError };
}

export interface MilestoneEvent {
  id: number;
  title: string;
  /** 'YYYY-MM-DD' — «день народження» гілки, звідти рахується її вік/зрілість. */
  date: string;
}

/**
 * Великі життєві події (events.is_milestone) — заручини/весілля/переїзд
 * тощо. На відміну від решти ДНК (лише агреговані числа), кожна подія тут
 * росте власним окремим «великим шпилем» у кристалі (crystalCluster.ts),
 * тому потрібен сам список, а не просто count.
 */
export function useMilestoneEvents(): { milestones: MilestoneEvent[]; isPending: boolean } {
  const events = useEvents();
  const milestones = useMemo(
    () =>
      (events.data ?? [])
        .filter((e) => e.is_milestone)
        .map((e) => ({ id: e.id, title: e.title, date: e.date })),
    [events.data],
  );
  return { milestones, isPending: events.isPending };
}

export interface CrystalPlace {
  /** Стабільний ключ для seed геометрії (назва — бо саме вона унікальна, не id першого піна). */
  name: string;
  /** Дата першого візиту — звідси рахується «вік»/зрілість гілки. */
  firstVisit: string;
}

/**
 * Країни й міста, згруповані з окремою датою ПЕРШОГО візиту кожного —
 * «Країни → величезні структурні мутації», «Міста → середні структурні
 * мутації» (crystalCluster.ts). Дата першого піна в місці = «день
 * народження» відповідної гілки кристала — звідти рахується її вік/зрілість.
 */
export function useCrystalPlaces(): {
  countries: CrystalPlace[];
  cities: CrystalPlace[];
  isPending: boolean;
} {
  const pins = useMapPins();

  return useMemo(() => {
    if (pins.isPending) return { countries: [], cities: [], isPending: true };

    const firstByName = (getName: (p: NonNullable<typeof pins.data>[number]) => string | null) => {
      const map = new Map<string, string>();
      for (const p of pins.data ?? []) {
        const name = getName(p);
        if (!name) continue;
        const prev = map.get(name);
        if (!prev || p.created_at < prev) map.set(name, p.created_at);
      }
      return Array.from(map, ([name, firstVisit]) => ({ name, firstVisit }));
    };

    return {
      countries: firstByName((p) => p.country),
      cities: firstByName((p) => p.city),
      isPending: false,
    };
  }, [pins.data, pins.isPending]);
}

export interface CrystalWish {
  id: number;
  fulfilledAt: string;
}

/**
 * Виконані бажання ОБОХ партнерів (на відміну від useFulfilledWishes —
 * той власницький, для сторінки вішліста). «Бажання → нові маленькі
 * бічні кристали» (crystalCluster.ts): кожне виконане бажання — окремий
 * маленький супутній кристалик, вік якого рахується від fulfilled_at.
 */
export function useCrystalWishes(): { wishes: CrystalWish[]; isPending: boolean } {
  const query = useQuery({
    queryKey: [...qk.wishlist(), 'fulfilled-all'],
    queryFn: async (): Promise<CrystalWish[]> => {
      const { data, error } = await supabase
        .from('wishlist_items')
        .select('id,fulfilled_at')
        .eq('fulfilled', true)
        .returns<{ id: number; fulfilled_at: string | null }[]>();
      if (error) throw error;
      return (data ?? [])
        .filter((r): r is { id: number; fulfilled_at: string } => !!r.fulfilled_at)
        .map((r) => ({ id: r.id, fulfilledAt: r.fulfilled_at }));
    },
  });
  return { wishes: query.data ?? [], isPending: query.isPending };
}

/** id+дата — «сировина» для доменних білдерів Artifact Engine (artifact/artifactNodes.ts). */
export interface DatedItem {
  id: number;
  date: string;
}

/** Річниці (Connection domain) — events.type === 'anniversary'. */
export function useAnniversaryEvents(): { anniversaries: DatedItem[]; isPending: boolean } {
  const events = useEvents();
  const anniversaries = useMemo(
    () => (events.data ?? []).filter((e) => e.type === 'anniversary').map((e) => ({ id: e.id, date: e.date })),
    [events.data],
  );
  return { anniversaries, isPending: events.isPending };
}

/**
 * Рецепти/фільми/книги (Creation domain) — уже наявні хуки (useDishes,
 * useMediaItems), лише спроєктовані до {id, date}. Жодного нового запиту
 * до Supabase — тонка проекція наявних рядків.
 */
export function useCreationSources(): {
  recipes: DatedItem[];
  movies: DatedItem[];
  books: DatedItem[];
  isPending: boolean;
} {
  const dishes = useDishes();
  const movies = useMediaItems('movie');
  const series = useMediaItems('series');
  const books = useMediaItems('book');

  return useMemo(() => {
    const isPending = [dishes, movies, series, books].some((q) => q.isPending);
    if (isPending) return { recipes: [], movies: [], books: [], isPending: true };
    return {
      recipes: (dishes.data ?? []).map((d) => ({ id: d.id, date: d.created_at })),
      movies: [...(movies.data ?? []), ...(series.data ?? [])]
        .filter((m) => m.status === 'done')
        .map((m) => ({ id: m.id, date: m.created_at })),
      books: (books.data ?? []).filter((b) => b.status === 'done').map((b) => ({ id: b.id, date: b.created_at })),
      isPending: false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dishes.data, dishes.isPending, movies.data, movies.isPending, series.data, series.isPending, books.data, books.isPending]);
}
