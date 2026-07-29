import { useMemo, useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useEvents } from '@/features/_shared/events';
import { useUsers } from '@/features/_shared/useUsers';
import { useMapPins } from '@/features/map/useMapPins';
import { useMemories } from '@/features/memories/useMemories';
import { usePlans } from '@/features/plans/usePlans';
import { useShoppingItems } from '@/features/shopping/useShoppingItems';
import {
  fetchPersonalWishlistEvolutionArchive,
  fetchSharedWishlistEvolutionArchive,
  type WishlistEvolutionArchiveItem,
} from '@/features/wishlist/wishlistEvolutionArchive';
import { useStartDate } from '@/features/home/useHome';
import {
  buildArtifactFromSnapshot,
  type AdapterDiagnostic,
  type EvolutionSourceSnapshot,
  type MemoryLinkSource,
  type WishlistSource,
} from '@/engine/evolution/adapters';
import {
  buildCrystalSpeciesBlueprint,
  crystalToGrowthBlueprint,
  type CrystalSpeciesBlueprint,
} from '@/engine/species/crystal';
import {
  DEFAULT_GROWTH_ENGINE_CONFIG,
  buildGrowthState,
  type GrowthState,
} from '@/engine/growth';
import {
  DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
  buildCrystalComposition,
  type CrystalCompositionState,
} from '@/engine/composition';
import {
  DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
  buildCrystalGeometry,
  type CrystalGeometryState,
} from '@/engine/geometry';
import {
  DEFAULT_CRYSTAL_MATERIAL_CONFIG,
  buildCrystalMaterialState,
  type CrystalMaterialQuality,
  type CrystalMaterialState,
} from '@/engine/material';
import {
  DEFAULT_CRYSTAL_LIFE_CONFIG,
  buildCrystalLifeState,
  type CrystalLifeState,
} from '@/engine/life';
import { resolveCrystalRendererQuality } from '@/engine/renderer';

const ENGINE_VERSION = '1.0.0';
const SPECIES_RULES_VERSION = '1.0.0';
const COUPLE_TIME_ZONE = 'Europe/Kyiv';
const ALLOWED_MEMORY_SOURCES = new Set(['wish', 'place', 'goal', 'event']);

export interface EvolutionCrystalMetrics {
  buildMs: number;
  normalizedEventCount: number;
  bodyCount: number;
  meshCount: number;
  usedVertices: number;
  usedTriangles: number;
  materialCount: number;
  quality: CrystalMaterialQuality;
}

export interface EvolutionCrystalPipeline {
  species: CrystalSpeciesBlueprint;
  growth: GrowthState;
  composition: CrystalCompositionState;
  geometry: CrystalGeometryState;
  material: CrystalMaterialState;
  life: CrystalLifeState;
  diagnostics: AdapterDiagnostic[];
  metrics: EvolutionCrystalMetrics;
}

export interface UseEvolutionCrystalPipelineResult {
  pipeline: EvolutionCrystalPipeline | null;
  isPending: boolean;
  error: Error | null;
}

function readQuality(): CrystalMaterialQuality {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'fallback';
  const extendedNavigator = navigator as Navigator & { deviceMemory?: number };
  return resolveCrystalRendererQuality({
    webgl: true,
    webgl2: typeof WebGL2RenderingContext !== 'undefined',
    deviceMemoryGb: typeof extendedNavigator.deviceMemory === 'number'
      ? extendedNavigator.deviceMemory
      : null,
    hardwareConcurrency: Number.isFinite(navigator.hardwareConcurrency)
      ? navigator.hardwareConcurrency
      : null,
    devicePixelRatio: window.devicePixelRatio,
  });
}

export function archiveToWishlistSource(
  item: WishlistEvolutionArchiveItem,
  isShared: boolean,
): WishlistSource {
  return {
    id: item.id,
    fulfilled: true,
    fulfilledAt: item.fulfilled_at ?? item.completed_at,
    giftDate: item.completed_at,
    isShared,
    priority: item.priority,
  };
}

export function dedupeEvolutionWishlist(
  personal: readonly WishlistEvolutionArchiveItem[],
  shared: readonly WishlistEvolutionArchiveItem[],
): WishlistSource[] {
  const byId = new Map<number, WishlistSource>();
  for (const item of personal) byId.set(item.id, archiveToWishlistSource(item, false));
  // Shared wins if a backend scope ever returns the same row in both archives.
  for (const item of shared) byId.set(item.id, archiveToWishlistSource(item, true));
  return [...byId.values()].sort((left, right) => left.id - right.id);
}

export function buildEvolutionMemoryLinks(
  linkIds: Record<number, Partial<Record<string, number>>>,
): MemoryLinkSource[] {
  const links: MemoryLinkSource[] = [];
  for (const [memoryIdText, sources] of Object.entries(linkIds)) {
    const memoryId = Number(memoryIdText);
    if (!Number.isSafeInteger(memoryId)) continue;
    for (const [sourceType, sourceId] of Object.entries(sources)) {
      if (!ALLOWED_MEMORY_SOURCES.has(sourceType) || !Number.isSafeInteger(sourceId)) continue;
      links.push({
        memoryId,
        sourceType: sourceType as MemoryLinkSource['sourceType'],
        sourceId,
      });
    }
  }
  return links.sort((left, right) =>
    left.memoryId - right.memoryId
      || left.sourceType.localeCompare(right.sourceType)
      || left.sourceId - right.sourceId,
  );
}

export function buildEvolutionSourceSnapshot(input: {
  events: NonNullable<ReturnType<typeof useEvents>['data']>;
  plans: NonNullable<ReturnType<typeof usePlans>['data']>;
  wishlist: WishlistSource[];
  pins: NonNullable<ReturnType<typeof useMapPins>['data']>;
  archive: NonNullable<ReturnType<typeof useMemories>['data']>;
  shopping: NonNullable<ReturnType<typeof useShoppingItems>['data']>;
}): EvolutionSourceSnapshot {
  return {
    calendarEvents: input.events.map((event) => ({
      id: event.id,
      date: event.date,
      type: event.type,
      yearly: event.yearly,
      isMilestone: event.is_milestone,
    })),
    plans: input.plans.map((plan) => ({
      id: plan.id,
      category: plan.category,
      status: plan.status,
      startDate: plan.start_date,
      endDate: plan.end_date,
      completedAt: plan.completed_at,
      createdAt: plan.created_at,
    })),
    wishlistItems: input.wishlist,
    mapPlaces: input.pins.map((pin) => ({
      id: pin.id,
      category: pin.category,
      visitedAt: pin.visited_at,
      createdAt: pin.created_at,
      rating: pin.rating,
      city: pin.city,
      country: pin.country,
    })),
    memories: input.archive.photos.map((memory) => ({
      id: memory.id,
      memoryDate: memory.memory_date,
      datePrecision: memory.date_precision,
      takenAt: memory.taken_at,
      createdAt: memory.created_at,
    })),
    memoryLinks: buildEvolutionMemoryLinks(
      input.archive.linkIds as Record<number, Partial<Record<string, number>>>,
    ),
    shoppingItems: input.shopping.map((item) => ({
      id: item.id,
      bought: item.bought,
      boughtAt: item.bought_at,
      createdAt: item.created_at,
    })),
  };
}

function growthBodyLimit(quality: CrystalMaterialQuality): number {
  if (quality === 'high') return 96;
  if (quality === 'balanced') return 64;
  if (quality === 'low') return 36;
  return 18;
}

/**
 * Client orchestration only. Every engine layer below remains pure and receives
 * explicit source rows, clock, time zone and versioned configs.
 */
export function useEvolutionCrystalPipeline(
  reducedMotion: boolean,
): UseEvolutionCrystalPipelineResult {
  const startDate = useStartDate();
  const users = useUsers();
  const events = useEvents();
  const plans = usePlans();
  const pins = useMapPins();
  const archive = useMemories();
  const shopping = useShoppingItems();
  const [asOf] = useState(() => new Date().toISOString());
  const [quality] = useState(readQuality);

  const userIds = useMemo(
    () => (users.data ?? []).map((user) => user.id).sort((left, right) => left - right),
    [users.data],
  );
  const personalArchives = useQueries({
    queries: userIds.map((ownerId) => ({
      queryKey: ['wishlist', 'evolution-archive', ownerId],
      queryFn: () => fetchPersonalWishlistEvolutionArchive(ownerId),
      staleTime: 5 * 60_000,
    })),
  });
  const sharedArchive = useQuery({
    queryKey: ['wishlist', 'evolution-archive', 'shared'],
    queryFn: fetchSharedWishlistEvolutionArchive,
    staleTime: 5 * 60_000,
  });

  const personalPending = personalArchives.some((query) => query.isPending);
  const personalError = personalArchives.find((query) => query.error)?.error;
  const isPending = users.isPending
    || events.isPending
    || plans.isPending
    || pins.isPending
    || archive.isPending
    || shopping.isPending
    || personalPending
    || sharedArchive.isPending
    || !startDate;

  const queryError = users.error
    ?? events.error
    ?? plans.error
    ?? pins.error
    ?? archive.error
    ?? shopping.error
    ?? personalError
    ?? sharedArchive.error;

  const personalItems = useMemo(
    () => personalArchives.flatMap((query) => query.data ?? []),
    [personalArchives],
  );
  const wishlist = useMemo(
    () => dedupeEvolutionWishlist(personalItems, sharedArchive.data ?? []),
    [personalItems, sharedArchive.data],
  );

  return useMemo<UseEvolutionCrystalPipelineResult>(() => {
    if (queryError) {
      return {
        pipeline: null,
        isPending: false,
        error: queryError instanceof Error ? queryError : new Error(String(queryError)),
      };
    }
    if (isPending || !startDate || userIds.length === 0) {
      return { pipeline: null, isPending: true, error: null };
    }

    try {
      const started = performance.now();
      const coupleId = `amore-couple:${userIds.join('-')}`;
      const snapshot = buildEvolutionSourceSnapshot({
        events: events.data ?? [],
        plans: plans.data ?? [],
        wishlist,
        pins: pins.data ?? [],
        archive: archive.data!,
        shopping: shopping.data ?? [],
      });
      const artifactResult = buildArtifactFromSnapshot({
        coupleId,
        asOf,
        snapshot,
        engineConfig: {
          engineVersion: ENGINE_VERSION,
          relationshipStartedAt: startDate,
          timeZone: COUPLE_TIME_ZONE,
          leapDayPolicy: 'feb-28',
        },
      });
      const species = buildCrystalSpeciesBlueprint({
        artifact: artifactResult.blueprint,
        config: { asOf, rulesVersion: SPECIES_RULES_VERSION },
      });
      const growth = buildGrowthState({
        blueprint: crystalToGrowthBlueprint(species),
        config: {
          ...DEFAULT_GROWTH_ENGINE_CONFIG,
          maxBodies: growthBodyLimit(quality),
        },
      });
      const composition = buildCrystalComposition({
        growth,
        config: DEFAULT_CRYSTAL_COMPOSITION_CONFIG,
      });
      const geometry = buildCrystalGeometry({
        growth,
        composition,
        config: DEFAULT_CRYSTAL_GEOMETRY_CONFIG,
      });
      const material = buildCrystalMaterialState({
        species,
        composition,
        geometry,
        config: { ...DEFAULT_CRYSTAL_MATERIAL_CONFIG, quality },
      });
      const life = buildCrystalLifeState({
        species,
        composition,
        material,
        config: {
          ...DEFAULT_CRYSTAL_LIFE_CONFIG,
          quality,
          reducedMotion,
        },
      });
      const finished = performance.now();

      return {
        isPending: false,
        error: null,
        pipeline: {
          species,
          growth,
          composition,
          geometry,
          material,
          life,
          diagnostics: artifactResult.adapterDiagnostics,
          metrics: {
            buildMs: Math.round((finished - started) * 100) / 100,
            normalizedEventCount: artifactResult.blueprint.events.length,
            bodyCount: growth.bodies.length,
            meshCount: geometry.meshes.length,
            usedVertices: geometry.budget.usedVertices,
            usedTriangles: geometry.budget.usedTriangles,
            materialCount: material.diagnostics.uniqueMaterialCount,
            quality,
          },
        },
      };
    } catch (error) {
      return {
        pipeline: null,
        isPending: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, [
    archive.data,
    asOf,
    events.data,
    isPending,
    pins.data,
    plans.data,
    quality,
    queryError,
    reducedMotion,
    shopping.data,
    startDate,
    userIds,
    wishlist,
  ]);
}
