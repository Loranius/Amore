// ============================================================
// Заповнення історії: дані екрана й дві дії, які він робить.
// ------------------------------------------------------------
// Крок не зберігається, а виводиться з даних — чому саме так, сказано
// в `sweepModel.ts`, де ця відповідь і живе.
// ============================================================
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrentUser } from '@/providers/AuthProvider';
import { supabase } from '@/lib/supabase';
import { qk } from '@/lib/queryKeys';
import type { InsertRow, MediaType, TmdbSearchResult } from '@/types';
import {
  COUPLE_TIME_ZONE,
  coupleDay,
  fetchPortalSources,
  type PortalSources,
} from '@/features/world/portalSources';
import { ensurePlacePin, type PlacePinOutcome } from '@/features/memories/placePins';
import { useMomentMutations } from '@/features/memories/useMoments';
import type { PhotoImportPlan } from './photoImport';
import type { PlaceCandidate } from '@/features/memories/momentPlace';
import {
  middleOfYear,
  sweepStepOf,
  yearContaining,
  type Milestone,
  type SweepStep,
} from './sweepModel';
import {
  relationshipYearFills,
  type HistoryFillSummary,
  type RelationshipYearFill,
} from './yearFills';

export type { SweepStep };

export interface AnniversaryDraft {
  title: string;
  date: string;
}

export interface MilestoneDraft {
  milestone: Milestone;
  year: RelationshipYearFill;
}

export interface PlaceDraft {
  place: PlaceCandidate;
  year: RelationshipYearFill;
}

export interface WatchedDraft {
  item: TmdbSearchResult;
  type: MediaType;
  year: RelationshipYearFill;
}

/** Скільки вже зроблено — щоб смужка показувала правду, а не спінер. */
export interface ImportProgress {
  days: number;
  totalDays: number;
  photos: number;
  totalPhotos: number;
}

export interface PhotoImportResult {
  createdDays: number;
  createdPhotos: number;
  /**
   * День, на якому спинилось, або `null`.
   *
   * Уже створені спогади НЕ відкочуються: вони справжні, і викидати
   * двадцять успішних днів через двадцять перший означало б покарати
   * пару за чужу мережу.
   */
  failedAt: string | null;
}

/**
 * Що екран скаже парі після дотику по знайденому місцю.
 *
 * Три відповіді, а не «готово», бо третя — це відмова, і мовчазна
 * відмова тут була б найгіршим виходом: пара натиснула, нічого не
 * змінилось, і вона не знає чому.
 */
export type PlaceResult =
  | { kind: 'created' }
  | { kind: 'dated' }
  /** Мітка вже датована іншим роком; `label` — той рік, або `null`. */
  | { kind: 'taken'; label: number | null };

const SOURCES_KEY = ['onboarding', 'portal-sources'] as const;

/** Дати, які пари святкують найчастіше — підказки, а не набір. */
export const ANNIVERSARY_SUGGESTIONS: readonly string[] = [
  'Перше побачення',
  'Перший поцілунок',
  'Почали жити разом',
  'День знайомства',
  'Заручини',
];

export interface HistorySweep {
  step: SweepStep;
  asOf: string;
  isPending: boolean;
  error: Error | null;
  relationshipStartedAt: string;
  /** Щорічні річниці, які вже є: саме вони піднімають усі минулі роки. */
  yearlyAnniversaries: { id: number; date: string }[];
  summary: HistoryFillSummary;
  setStartDate: (date: string) => Promise<void>;
  addAnniversary: (draft: AnniversaryDraft) => Promise<void>;
  addMilestone: (draft: MilestoneDraft) => Promise<void>;
  addPlace: (draft: PlaceDraft) => Promise<PlaceResult>;
  addWatched: (draft: WatchedDraft) => Promise<void>;
  importPhotos: (
    plan: PhotoImportPlan<File>,
    onProgress?: (progress: ImportProgress) => void,
  ) => Promise<PhotoImportResult>;
  /** Скільки віх уже лежить у кожному році стосунків, за номером року. */
  milestonesByYear: Map<number, number>;
  /** Скільки ДАТОВАНИХ міток карти лежить у кожному році. */
  placesByYear: Map<number, number>;
  /** Скільки переглянутого лежить у кожному році. */
  watchedByYear: Map<number, number>;
  isSaving: boolean;
}

export function useHistorySweep(): HistorySweep {
  const user = useCurrentUser();
  const client = useQueryClient();
  const moments = useMomentMutations();
  const [asOf] = useState(() => `${coupleDay(new Date(), COUPLE_TIME_ZONE)}T00:00:00.000Z`);

  const sources = useQuery({
    queryKey: SOURCES_KEY,
    queryFn: fetchPortalSources,
    staleTime: 0,
    retry: 1,
  });

  const refresh = useCallback(async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: SOURCES_KEY }),
      client.invalidateQueries({ queryKey: qk.events() }),
      client.invalidateQueries({ queryKey: qk.settings() }),
      client.invalidateQueries({ queryKey: qk.plans() }),
    ]);
  }, [client]);

  const setStartDate = useMutation({
    mutationFn: async (date: string) => {
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'relationship_start_date', value: date }, { onConflict: 'key' });
      if (error) throw error;
      try {
        // Той самий ключ, яким головна малює лічильник до приходу мережі.
        localStorage.setItem('amore:startDate', date);
      } catch {
        /* сховище може бути закрите — це не привід не зберегти дату в базі */
      }
    },
    onSuccess: refresh,
  });

  const addAnniversary = useMutation({
    mutationFn: async (draft: AnniversaryDraft) => {
      /*
       * `yearly: true` — це і є весь важіль. Адаптер календаря
       * (`adapters/calendar.ts`) для такої події сам породжує по одній
       * події на кожен рік від дати до сьогодні, тож одна відповідь
       * піднімає ВСІ минулі роки, а не той, у який вона потрапила.
       *
       * `significance: 'regular'` навмисно: «початок стосунків» і
       * «одруження» існують у порталі в однині й стережуться частковим
       * унікальним індексом. Онбординг не має права їх зайняти — це
       * вибір пари в календарі, а не побічний ефект підказки.
       */
      const row: InsertRow<'events'> = {
        title: draft.title.trim(),
        date: draft.date,
        type: 'anniversary',
        yearly: true,
        significance: 'regular',
        created_by: user.id,
      };
      const { error } = await supabase.from('events').insert(row);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const addMilestone = useMutation({
    mutationFn: async ({ milestone, year }: MilestoneDraft) => {
      /*
       * Віха — це ВИКОНАНИЙ план, і це не обхідний шлях.
       *
       * Спогад був би природнішим словом, але таблиця спогадів вимагає
       * фотографію (`memories.photo_url NOT NULL`), а власник вирішив, що
       * фото йде окремим кроком пізніше. План же вимагає лише назву, і
       * «ми це зробили» — рівно те, що означає `status: 'done'` з датою в
       * минулому.
       *
       * Категорія вирішує КАНАЛ росту (`adapters/rules.ts`): подорож —
       * exploration, переїзд — stability, весілля — culture. Тобто
       * фішка не лише додає подію, а й вибирає, яким вийде рік.
       */
      const day = middleOfYear(year.startsAt, year.endsAt);
      const row: InsertRow<'plans'> = {
        title: milestone.label,
        category: milestone.category,
        status: 'done',
        start_date: day,
        completed_at: `${day}T12:00:00.000Z`,
        // Пара пам'ятає рік, а не день: портал так і покаже.
        date_precision: 'year',
        created_by: user.id,
      };
      const { error } = await supabase.from('plans').insert(row);
      if (error) throw error;
    },
    onSuccess: refresh,
  });

  const addPlace = useMutation({
    mutationFn: async ({ place, year }: PlaceDraft): Promise<PlacePinOutcome> => {
      /*
       * Мітка карти — другий модуль, і саме тому цей крок узагалі є.
       * Виміряно: сім віх в одному модулі дають 0.473, а план плюс одне
       * ДАТОВАНЕ місце — 0.566. Ширина важить більше за обсяг.
       *
       * Дата — середина року стосунків, як і у віх. Показувати її нікому:
       * `visited_at` у порталі не малюється ніде, він керує лише тим, у
       * який день архіву стане ФОТО мітки, а в мітки з проходу фото
       * немає. Тобто вигаданого дня пара тут не побачить — на відміну від
       * подарунка, чий архів друкує дату (ADR-0078).
       */
      return ensurePlacePin(place, user.id, middleOfYear(year.startsAt, year.endsAt));
    },
    onSuccess: async () => {
      await refresh();
      await client.invalidateQueries({ queryKey: qk.mapPins() });
    },
  });

  const addWatched = useMutation({
    mutationFn: async ({ item, type, year }: WatchedDraft) => {
      /*
       * Четвертий модуль проходу, і він з'явився лише тоді, коли в
       * `media_items` завелась дата завершення (ADR-0080). До неї рушій
       * датував переглянуте днем СТВОРЕННЯ рядка — тобто «ми дивились це
       * у сімнадцятому» лягло б у поточний рік, і крок обіцяв би те,
       * чого не робить.
       *
       * Полудень середини року, як і у віх: пара пам'ятає рік, а не день.
       */
      const day = middleOfYear(year.startsAt, year.endsAt);
      const row: InsertRow<'media_items'> = {
        type,
        title: item.title,
        status: 'done',
        poster_url: item.poster_url,
        created_by: user.id,
        finished_at: `${day}T12:00:00.000Z`,
      };
      const { error } = await supabase.from('media_items').insert(row);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refresh();
      await client.invalidateQueries({ queryKey: qk.media() });
    },
  });

  /**
   * Створити по спогаду на кожен день зі знімків.
   *
   * Через `useMomentMutations.create`, а не власним записом: він уже
   * вміє вантажити фото, ставити обкладинку й відкочувати момент, у
   * якого не завантажилось жодне фото. Другий такий шлях розійшовся б
   * із першим тихо — і саме в тому місці, де в пари зникають світлини.
   */
  const importPhotos = useCallback(async (
    plan: PhotoImportPlan<File>,
    onProgress?: (progress: ImportProgress) => void,
  ): Promise<PhotoImportResult> => {
    const totalPhotos = plan.photoCount;
    let createdDays = 0;
    let createdPhotos = 0;

    for (const day of plan.days) {
      try {
        await moments.create.mutateAsync({
          // Назви немає навмисно: картка показує дату, коли назва
          // порожня, а вигадана назва була б текстом, якого пара не
          // писала, у її власному архіві.
          draft: { title: '', note: null, memoryDate: day.day, placePinId: null },
          photos: day.photos.map((photo) => ({ file: photo.file, takenAt: photo.takenAt })),
          userId: user.id,
          onProgress: (done) => onProgress?.({
            days: createdDays,
            totalDays: plan.days.length,
            photos: createdPhotos + done,
            totalPhotos,
          }),
        });
      } catch {
        // Помилку вже показала мутація. Спиняємось на першому дні, який
        // не поїхав: далі, найімовірніше, те саме, а двадцять однакових
        // тостів — це не звіт.
        return { createdDays, createdPhotos, failedAt: day.day };
      }
      createdDays += 1;
      createdPhotos += day.photos.length;
      onProgress?.({
        days: createdDays, totalDays: plan.days.length, photos: createdPhotos, totalPhotos,
      });
    }

    await refresh();
    return { createdDays, createdPhotos, failedAt: null };
  }, [moments.create, refresh, user.id]);

  const data: PortalSources | undefined = sources.data;
  const relationshipStartedAt = data?.relationshipStartedAt.trim() ?? '';

  const yearlyAnniversaries = useMemo(() => (
    (data?.snapshot.calendarEvents ?? [])
      .filter((event) => event.type === 'anniversary' && event.yearly === true)
      .map((event) => ({ id: event.id, date: event.date }))
  ), [data]);

  const summary = useMemo((): HistoryFillSummary => {
    if (!data || relationshipStartedAt === '') {
      return { years: [], emptyCount: 0, averageFill: 0 };
    }
    return relationshipYearFills(data, asOf, `couple:${data.userIds.join('-')}`);
  }, [data, relationshipStartedAt, asOf]);

  const milestonesByYear = useMemo(() => {
    const counts = new Map<number, number>();
    if (!data) return counts;
    const done = data.snapshot.plans.filter((plan) => plan.status === 'done');
    for (const year of summary.years) {
      const within = done.filter((plan) => {
        const at = plan.completedAt ?? plan.endDate ?? plan.startDate;
        return typeof at === 'string' && at >= year.startsAt && at < year.endsAt;
      });
      counts.set(year.index, within.length);
    }
    return counts;
  }, [data, summary.years]);

  const placesByYear = useMemo(() => {
    const counts = new Map<number, number>();
    if (!data) return counts;
    for (const year of summary.years) {
      const within = data.snapshot.mapPlaces.filter((place) => (
        typeof place.visitedAt === 'string'
        && place.visitedAt.slice(0, 10) >= year.startsAt
        && place.visitedAt.slice(0, 10) < year.endsAt
      ));
      counts.set(year.index, within.length);
    }
    return counts;
  }, [data, summary.years]);

  const watchedByYear = useMemo(() => {
    const counts = new Map<number, number>();
    if (!data) return counts;
    for (const year of summary.years) {
      const within = data.snapshot.media.filter((item) => {
        const at = item.finishedAt ?? item.createdAt;
        return typeof at === 'string'
          && at.slice(0, 10) >= year.startsAt
          && at.slice(0, 10) < year.endsAt;
      });
      counts.set(year.index, within.length);
    }
    return counts;
  }, [data, summary.years]);

  const step = sweepStepOf({
    relationshipStartedAt,
    yearlyAnniversaryCount: yearlyAnniversaries.length,
  });

  return {
    step,
    asOf,
    isPending: sources.isPending,
    error: sources.error instanceof Error ? sources.error : null,
    relationshipStartedAt,
    yearlyAnniversaries,
    summary,
    setStartDate: async (date) => { await setStartDate.mutateAsync(date); },
    addAnniversary: async (draft) => { await addAnniversary.mutateAsync(draft); },
    addMilestone: async (draft) => { await addMilestone.mutateAsync(draft); },
    addPlace: async (draft) => {
      const outcome = await addPlace.mutateAsync(draft);
      if (outcome.kind !== 'taken') return { kind: outcome.kind };
      const year = yearContaining(summary.years, outcome.visitedAt);
      return { kind: 'taken', label: year?.label ?? null };
    },
    addWatched: async (draft) => { await addWatched.mutateAsync(draft); },
    importPhotos,
    milestonesByYear,
    placesByYear,
    watchedByYear,
    isSaving: setStartDate.isPending
      || addAnniversary.isPending
      || addMilestone.isPending
      || addPlace.isPending
      || addWatched.isPending,
  };
}
