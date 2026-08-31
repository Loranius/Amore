// ============================================================
// Кеш і гак джерел для рифа.
// ------------------------------------------------------------
// Вийняте з `useReefPortalPreview.ts` без зміни поведінки. Причина
// проста: нову сцену будує новий гак, а стара підсистема ще жива, і
// двом гакам потрібен ОДИН запит із одним ключем — інакше пара платила
// б за історію двічі, а два знімки одного порталу могли б розійтись.
//
// Тут немає жодного рішення про ріст. Тільки «сходити й принести».
// ============================================================
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { relationshipDaysBetween, useEvolutionSandbox } from '@/features/home/evolutionSandbox';
import {
  COUPLE_TIME_ZONE,
  coupleDay,
  fetchPortalSources,
  type PortalSources,
} from '@/features/world/portalSources';

/*
 * Портальна частина цього файлу переїхала у `features/world/portalSources.ts`:
 * запит не знав про вид, а читачів у нього стало двоє (риф і онбординг).
 * Тут лишилось те, що справді рифове — його кеш і його гак.
 */
export { COUPLE_TIME_ZONE, ENGINE_VERSION, coupleDay } from '@/features/world/portalSources';
export type { PortalSources } from '@/features/world/portalSources';
const SOURCE_CACHE_VERSION = 1;
const SOURCE_CACHE_MAX_AGE = 30 * 24 * 60 * 60_000;

interface ReefSourceCacheEnvelope {
  version: number;
  userId: number;
  cachedAt: number;
  sources: PortalSources;
}


function sourceCacheKey(userId: number): string {
  return `amore:reef-evolution:${SOURCE_CACHE_VERSION}:${userId}`;
}

function readCachedSources(userId: number): PortalSources | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(sourceCacheKey(userId));
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as Partial<ReefSourceCacheEnvelope>;
    if (
      cached.version !== SOURCE_CACHE_VERSION
      || cached.userId !== userId
      || typeof cached.cachedAt !== 'number'
      || Date.now() - cached.cachedAt > SOURCE_CACHE_MAX_AGE
      || !cached.sources
    ) return undefined;
    return cached.sources;
  } catch {
    return undefined;
  }
}

function writeCachedSources(userId: number, sources: PortalSources): void {
  if (typeof window === 'undefined') return;
  try {
    const cached: ReefSourceCacheEnvelope = {
      version: SOURCE_CACHE_VERSION,
      userId,
      cachedAt: Date.now(),
      sources,
    };
    window.localStorage.setItem(sourceCacheKey(userId), JSON.stringify(cached));
  } catch {
    return;
  }
}

/**
 * Спільний запит джерел: один ключ, один кеш, обидва гаки.
 *
 * Сюди ж переїхали запис у локальний кеш і реєстрація базових значень
 * пісочниці — бо це побічні дії САМОГО запиту, а не того, хто його
 * читає. Доки їх було двоє, другий читач мусив би повторити обидві.
 */
export function useReefPortalSources(userId: number, asOf: string): {
  data: PortalSources | undefined;
  error: unknown;
  isPending: boolean;
} {
  const { registerBaseline } = useEvolutionSandbox();
  const sourceQuery = useQuery({
    queryKey: ['reef', 'evolution-sources', SOURCE_CACHE_VERSION, userId],
    queryFn: fetchPortalSources,
    initialData: () => readCachedSources(userId),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!sourceQuery.data || sourceQuery.dataUpdatedAt <= 0) return;
    writeCachedSources(userId, sourceQuery.data);
  }, [userId, sourceQuery.data, sourceQuery.dataUpdatedAt]);

  useEffect(() => {
    const sources = sourceQuery.data;
    if (!sources) return;
    registerBaseline('reef', {
      relationshipDays: relationshipDaysBetween(sources.relationshipStartedAt, asOf),
      calendarEvents: sources.snapshot.calendarEvents.length,
      completedPlans: sources.snapshot.plans.filter((plan) => plan.status === 'done').length,
      fulfilledWishes: sources.snapshot.wishlistItems.filter((wish) => wish.fulfilled).length,
      visitedPlaces: sources.snapshot.mapPlaces.filter((place) => Boolean(place.visitedAt)).length,
      memories: sources.snapshot.memories.length,
      finishedMedia: sources.snapshot.media.filter((item) => item.status === 'done').length,
      sharedDaysOff: sources.sharedDaysOff.length,
    });
  }, [asOf, registerBaseline, sourceQuery.data]);

  return {
    data: sourceQuery.data,
    error: sourceQuery.error,
    isPending: sourceQuery.isPending,
  };
}

/** Сьогодні очима пари, зафіксоване на весь час життя сцени. */
export function useCoupleDay(): string {
  const [asOf] = useState(() => coupleDay(new Date(), COUPLE_TIME_ZONE));
  return asOf;
}
