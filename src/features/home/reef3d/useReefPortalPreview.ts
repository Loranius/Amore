import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCurrentUser } from '@/providers/AuthProvider';
import { fetchPairWishlistEvolutionArchive } from '@/features/wishlist/wishlistEvolutionArchive';
import { supabase } from '@/lib/supabase';
import {
  buildArtifactFromSnapshot,
  type AdapterDiagnostic,
  type EvolutionSourceSnapshot,
} from '@/engine/evolution/adapters';
import {
  applyEvolutionSandboxSources,
  relationshipDaysBetween,
  useEvolutionSandbox,
} from '@/features/home/evolutionSandbox';
import {
  buildEvolutionMemoryLinks,
  evolutionWishlistFromPairArchive,
  stableEvolutionCoupleId,
} from '../crystal3d/evolution/sourceSnapshot';
import {
  buildReefPreviewFromArtifact,
  type ReefPreviewBuild,
} from './buildReefPreview';

const ENGINE_VERSION = '1.0.0';
const COUPLE_TIME_ZONE = 'Europe/Kyiv';
const SOURCE_CACHE_VERSION = 1;
const SOURCE_CACHE_MAX_AGE = 30 * 24 * 60 * 60_000;

interface ReefPortalSources {
  relationshipStartedAt: string;
  userIds: number[];
  sharedDaysOff: string[];
  snapshot: EvolutionSourceSnapshot;
}

interface ReefSourceCacheEnvelope {
  version: number;
  userId: number;
  cachedAt: number;
  sources: ReefPortalSources;
}

export interface ReefPortalPreview {
  build: ReefPreviewBuild;
  diagnostics: AdapterDiagnostic[];
  normalizedEventCount: number;
}

export interface UseReefPortalPreviewResult {
  preview: ReefPortalPreview | null;
  isPending: boolean;
  error: Error | null;
}

function coupleDay(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => (
    parts.find((part) => part.type === type)?.value ?? ''
  );
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function sourceCacheKey(userId: number): string {
  return `amore:reef-evolution:${SOURCE_CACHE_VERSION}:${userId}`;
}

function readCachedSources(userId: number): ReefPortalSources | undefined {
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

function writeCachedSources(userId: number, sources: ReefPortalSources): void {
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

async function fetchReefPortalSources(): Promise<ReefPortalSources> {
  const [
    startDateResult,
    usersResult,
    eventsResult,
    plansResult,
    scheduleResult,
    pinsResult,
    memoriesResult,
    memoryLinksResult,
    mediaResult,
    wishlistArchive,
  ] = await Promise.all([
    supabase
      .from('settings')
      .select('value')
      .eq('key', 'relationship_start_date')
      .maybeSingle(),
    supabase.from('users').select('id').order('id', { ascending: true }),
    supabase
      .from('events')
      .select('id,date,type,yearly,is_milestone')
      .or('type.neq.other,is_milestone.eq.true')
      .order('date', { ascending: true }),
    supabase
      .from('plans')
      .select('id,category,status,start_date,end_date,completed_at,created_at'),
    supabase
      .from('work_schedule')
      .select('date,user_id')
      .eq('mark', 'Х')
      .order('date', { ascending: true }),
    supabase
      .from('map_pins')
      .select('id,category,visited_at,created_at,rating,city,country'),
    supabase
      .from('memories')
      .select('id,memory_date,date_precision,taken_at,created_at')
      .order('memory_date', { ascending: false }),
    supabase.from('memory_links').select('memory_id,source_type,source_id'),
    supabase
      .from('media_items')
      .select('id,status,created_at')
      .eq('status', 'done'),
    fetchPairWishlistEvolutionArchive(),
  ]);

  if (startDateResult.error) throw startDateResult.error;
  if (usersResult.error) throw usersResult.error;
  if (eventsResult.error) throw eventsResult.error;
  if (plansResult.error) throw plansResult.error;
  if (scheduleResult.error) throw scheduleResult.error;
  if (pinsResult.error) throw pinsResult.error;
  if (memoriesResult.error) throw memoriesResult.error;
  if (memoryLinksResult.error) throw memoryLinksResult.error;
  if (mediaResult.error) throw mediaResult.error;

  const relationshipStartedAt = typeof startDateResult.data?.value === 'string'
    ? startDateResult.data.value.trim()
    : '';
  if (!relationshipStartedAt) {
    throw new Error('Reef production preview requires relationship_start_date.');
  }

  const userIds = (usersResult.data ?? [])
    .map((user) => user.id)
    .filter(Number.isSafeInteger)
    .sort((left, right) => left - right);
  if (userIds.length === 0) {
    throw new Error('Reef production preview could not assemble the couple snapshot.');
  }

  const offByDate = new Map<string, Set<number>>();
  for (const row of scheduleResult.data ?? []) {
    if (typeof row.date !== 'string') continue;
    const users = offByDate.get(row.date) ?? new Set<number>();
    users.add(row.user_id);
    offByDate.set(row.date, users);
  }
  const sharedDaysOff = [...offByDate.entries()]
    .filter(([, ids]) => userIds.every((id) => ids.has(id)))
    .map(([date]) => date)
    .sort();

  const linkIds: Record<number, Partial<Record<string, number>>> = {};
  for (const row of memoryLinksResult.data ?? []) {
    if (!Number.isSafeInteger(row.memory_id) || !Number.isSafeInteger(row.source_id)) continue;
    const entry = (linkIds[row.memory_id] ??= {});
    entry[row.source_type] ??= row.source_id;
  }

  const snapshot: EvolutionSourceSnapshot = {
    calendarEvents: (eventsResult.data ?? []).map((event) => ({
      id: event.id,
      date: event.date,
      type: event.type,
      yearly: event.yearly,
      isMilestone: event.is_milestone,
    })),
    plans: (plansResult.data ?? []).map((plan) => ({
      id: plan.id,
      category: plan.category,
      status: plan.status,
      startDate: plan.start_date,
      endDate: plan.end_date,
      completedAt: plan.completed_at,
      createdAt: plan.created_at,
    })),
    wishlistItems: evolutionWishlistFromPairArchive(wishlistArchive),
    mapPlaces: (pinsResult.data ?? []).map((pin) => ({
      id: pin.id,
      category: pin.category,
      visitedAt: pin.visited_at,
      createdAt: pin.created_at,
      rating: pin.rating,
      city: pin.city,
      country: pin.country,
    })),
    memories: (memoriesResult.data ?? []).map((memory) => ({
      id: memory.id,
      memoryDate: memory.memory_date,
      datePrecision: memory.date_precision,
      takenAt: memory.taken_at,
      createdAt: memory.created_at,
    })),
    memoryLinks: buildEvolutionMemoryLinks(linkIds),
    media: (mediaResult.data ?? []).map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: item.created_at,
    })),
  };

  return {
    relationshipStartedAt,
    userIds,
    sharedDaysOff,
    snapshot,
  };
}

export function useReefPortalPreview(): UseReefPortalPreviewResult {
  const me = useCurrentUser();
  const [asOf] = useState(() => coupleDay(new Date(), COUPLE_TIME_ZONE));
  const {
    enabled: sandboxEnabled,
    values: sandboxValues,
    registerBaseline,
  } = useEvolutionSandbox();
  const sourceQuery = useQuery({
    queryKey: ['reef', 'evolution-sources', SOURCE_CACHE_VERSION, me.id],
    queryFn: fetchReefPortalSources,
    initialData: () => readCachedSources(me.id),
    initialDataUpdatedAt: 0,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  useEffect(() => {
    if (!sourceQuery.data || sourceQuery.dataUpdatedAt <= 0) return;
    writeCachedSources(me.id, sourceQuery.data);
  }, [me.id, sourceQuery.data, sourceQuery.dataUpdatedAt]);

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

  return useMemo<UseReefPortalPreviewResult>(() => {
    const sources = sourceQuery.data;
    if (!sources) {
      if (sourceQuery.error) {
        return {
          preview: null,
          isPending: false,
          error: sourceQuery.error instanceof Error
            ? sourceQuery.error
            : new Error(String(sourceQuery.error)),
        };
      }
      return { preview: null, isPending: sourceQuery.isPending, error: null };
    }

    try {
      const effectiveSources = applyEvolutionSandboxSources({
        enabled: sandboxEnabled,
        values: sandboxValues,
        asOf,
        relationshipStartedAt: sources.relationshipStartedAt,
        snapshot: sources.snapshot,
        sharedDaysOff: sources.sharedDaysOff,
      });
      const artifactResult = buildArtifactFromSnapshot({
        coupleId: stableEvolutionCoupleId(sources.userIds),
        asOf,
        snapshot: effectiveSources.snapshot,
        engineConfig: {
          engineVersion: ENGINE_VERSION,
          relationshipStartedAt: effectiveSources.relationshipStartedAt,
          timeZone: COUPLE_TIME_ZONE,
          leapDayPolicy: 'feb-28',
        },
      });
      const build = buildReefPreviewFromArtifact({
        artifact: artifactResult.blueprint,
        asOf,
        sharedDaysOff: effectiveSources.sharedDaysOff,
      });
      return {
        preview: {
          build,
          diagnostics: artifactResult.adapterDiagnostics,
          normalizedEventCount: artifactResult.blueprint.events.length,
        },
        isPending: false,
        error: null,
      };
    } catch (error) {
      return {
        preview: null,
        isPending: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, [
    asOf,
    sandboxEnabled,
    sandboxValues,
    sourceQuery.data,
    sourceQuery.error,
    sourceQuery.isPending,
  ]);
}
