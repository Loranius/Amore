// ============================================================
// Один знімок порталу на всі три види.
// ------------------------------------------------------------
// Переїхало з `reef3d/world/reefPortalSources.ts` разом із кешем і
// реєстрацією базових значень пісочниці. Рифовим цей гак був лише тому,
// що рифові він знадобився першим; запит усередині про вид не знає
// зроду (`portalSources.ts`).
//
// ЧОМУ ПЕРЕЇХАВ САМЕ ЗАРАЗ (ADR-0189). Доти кожен вид збирав знімок сам:
// риф — цим запитом, кристал і дерево — власними гаками React Query.
// Числа розійшлись, і різниця виявилась не дрібною: того самого дня
// кристал нарахував 328 подій, а риф 435. Сто сім із них — домішка
// «сказаних» чисел онбордингу, яку `fetchPortalSources` додає до знімка,
// а два інші збирачі не бачили. Тобто пара, яка назвала числом тридцять
// фотографій першого року, бачила їх у рифі й не бачила в кристалі.
//
// Заголовок `portalSources.ts` попереджав про це з самого початку: «два
// знімки одного порталу, які тихо розходяться». Тепер знімок один, і
// запит теж один — той самий ключ, той самий кеш на всі види.
// ============================================================
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  relationshipDaysBetween,
  useEvolutionSandbox,
  type EvolutionSandboxArtifact,
} from '@/features/home/evolutionSandbox';
import {
  COUPLE_TIME_ZONE,
  coupleDay,
  fetchPortalSources,
  type PortalSources,
} from './portalSources';

export { COUPLE_TIME_ZONE, ENGINE_VERSION, coupleDay } from './portalSources';
export type { PortalSources } from './portalSources';

const SOURCE_CACHE_VERSION = 1;
const SOURCE_CACHE_MAX_AGE = 30 * 24 * 60 * 60_000;

interface PortalSourceCacheEnvelope {
  version: number;
  userId: number;
  cachedAt: number;
  sources: PortalSources;
}

/*
 * Ключ портальний, а не рифовий: доки він звався `amore:reef-evolution`,
 * усе виглядало так, ніби кеш належить одному виду. Перейменування
 * коштує рівно одного зайвого походу в базу на пристрій.
 */
function sourceCacheKey(userId: number): string {
  return `amore:portal-evolution:${SOURCE_CACHE_VERSION}:${userId}`;
}

function readCachedSources(userId: number): PortalSources | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const raw = window.localStorage.getItem(sourceCacheKey(userId));
    if (!raw) return undefined;
    const cached = JSON.parse(raw) as Partial<PortalSourceCacheEnvelope>;
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
    const cached: PortalSourceCacheEnvelope = {
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
 * Спільний запит джерел: один ключ, один кеш, усі види.
 *
 * Запис у локальний кеш і реєстрація базових значень пісочниці живуть
 * тут, бо це побічні дії САМОГО запиту, а не того, хто його читає. Доки
 * читачів було двоє, другий мусив би повторити обидві.
 *
 * `species` потрібен рівно для пісочниці: повзунки показують, від чого
 * саме відштовхується цей вид. На сам знімок він не впливає ніяк — і не
 * має, бо весь сенс цього гака в тому, що знімок один.
 */
export function usePortalSources(
  species: EvolutionSandboxArtifact,
  userId: number,
  asOf: string,
): {
  data: PortalSources | undefined;
  error: unknown;
  isPending: boolean;
} {
  const { registerBaseline } = useEvolutionSandbox();
  const sourceQuery = useQuery({
    queryKey: ['portal', 'evolution-sources', SOURCE_CACHE_VERSION, userId],
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
    registerBaseline(species, {
      relationshipDays: relationshipDaysBetween(sources.relationshipStartedAt, asOf),
      calendarEvents: sources.snapshot.calendarEvents.length,
      completedPlans: sources.snapshot.plans.filter((plan) => plan.status === 'done').length,
      fulfilledWishes: sources.snapshot.wishlistItems.filter((wish) => wish.fulfilled).length,
      visitedPlaces: sources.snapshot.mapPlaces.filter((place) => Boolean(place.visitedAt)).length,
      memories: sources.snapshot.memories.length,
      finishedMedia: sources.snapshot.media.filter((item) => item.status === 'done').length,
      sharedDaysOff: sources.sharedDaysOff.length,
    });
  }, [asOf, registerBaseline, sourceQuery.data, species]);

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
