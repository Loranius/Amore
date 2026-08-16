import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEvents } from '@/features/_shared/events';
import { useUsers } from '@/features/_shared/useUsers';
import { useMapPins } from '@/features/map/useMapPins';
import { useFinishedMedia } from '@/features/media/useMedia';
import { useMemories } from '@/features/memories/useMemories';
import { useScheduleTogetherness } from '@/features/schedule/useSharedDaysOff';
import { usePlans } from '@/features/plans/usePlans';
import { fetchPairWishlistEvolutionArchive } from '@/features/wishlist/wishlistEvolutionArchive';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import type { ArtifactBlueprint } from '@/engine/evolution';
import {
  buildArtifactFromSnapshot,
  type AdapterDiagnostic,
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
import {
  applyEvolutionSandboxSources,
  relationshipDaysBetween,
  useEvolutionSandbox,
} from '@/features/home/evolutionSandbox';
import {
  buildEvolutionSourceSnapshot,
  evolutionWishlistFromPairArchive,
  resolveCrystalColorPartners,
  stableEvolutionCoupleId,
} from './sourceSnapshot';

const ENGINE_VERSION = '1.0.0';
const SPECIES_RULES_VERSION = '1.0.0';
const COUPLE_TIME_ZONE = 'Europe/Kyiv';

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
  artifact: ArtifactBlueprint;
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

/**
 * Hard ceiling on published bodies, identical on every device.
 *
 * This used to be a function of the quality profile (96/64/36/18), which made
 * the performance budget quietly do the product's job: the same couple got a
 * different artifact on a different phone, and because the growth engine keeps
 * the *oldest* instructions when it truncates, everything recent simply
 * vanished — a real couple had 69 of their 104 events dropped, including every
 * plan and every fulfilled wish.
 *
 * Since ADR-0004 the body count follows the couple's years, so it is bounded
 * by construction: roughly one per year plus the skirt. This is now only a
 * safety valve against absurd input, never a design lever. Quality still
 * governs level of detail, sparkles and optical features — things that may
 * differ between devices without changing what the couple's crystal *is*.
 */
const MAX_PUBLISHED_BODIES = 128;

function useEvolutionStartDate() {
  return useQuery({
    queryKey: [...qk.settings(), 'relationship_start_date'],
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'relationship_start_date')
        .maybeSingle();
      if (error) throw error;
      return typeof data?.value === 'string' && data.value.trim() ? data.value : null;
    },
  });
}

/**
 * Client orchestration only. Every engine layer below remains pure and receives
 * explicit source rows, clock, time zone and versioned configs.
 */
export function useEvolutionCrystalPipeline(
  reducedMotion: boolean,
): UseEvolutionCrystalPipelineResult {
  const startDateQuery = useEvolutionStartDate();
  const users = useUsers();
  const events = useEvents();
  const plans = usePlans();
  const pins = useMapPins();
  const archive = useMemories();
  const finishedMedia = useFinishedMedia();
  const togetherness = useScheduleTogetherness();
  const wishlistArchive = useQuery({
    queryKey: ['wishlist', 'evolution-archive', 'pair'],
    queryFn: fetchPairWishlistEvolutionArchive,
    staleTime: 5 * 60_000,
  });
  const [asOf] = useState(() => new Date().toISOString());
  const [quality] = useState(readQuality);
  const {
    enabled: sandboxEnabled,
    values: sandboxValues,
    registerBaseline,
  } = useEvolutionSandbox();

  const userIds = useMemo(
    () => (users.data ?? []).map((user) => user.id).sort((left, right) => left - right),
    [users.data],
  );
  const colorPartners = useMemo(
    () => resolveCrystalColorPartners(users.data ?? []),
    [users.data],
  );
  const wishlist = useMemo(
    () => evolutionWishlistFromPairArchive(wishlistArchive.data ?? []),
    [wishlistArchive.data],
  );

  useEffect(() => {
    if (!startDateQuery.data) return;
    registerBaseline('crystal', {
      relationshipDays: relationshipDaysBetween(startDateQuery.data, asOf),
      calendarEvents: (events.data ?? []).length,
      completedPlans: (plans.data ?? []).filter((plan) => plan.status === 'done').length,
      fulfilledWishes: wishlist.filter((wish) => wish.fulfilled).length,
      visitedPlaces: (pins.data ?? []).filter((pin) => Boolean(pin.visited_at)).length,
      memories: archive.data?.photos.length ?? 0,
      finishedMedia: (finishedMedia.data ?? []).length,
      sharedDaysOff: (togetherness.data ?? []).length,
    });
  }, [
    archive.data,
    asOf,
    events.data,
    finishedMedia.data,
    pins.data,
    plans.data,
    registerBaseline,
    startDateQuery.data,
    togetherness.data,
    wishlist,
  ]);

  const isPending = startDateQuery.isPending
    || users.isPending
    || events.isPending
    || plans.isPending
    || pins.isPending
    || archive.isPending
    || finishedMedia.isPending
    || togetherness.isPending
    || wishlistArchive.isPending;

  const queryError = startDateQuery.error
    ?? users.error
    ?? events.error
    ?? plans.error
    ?? pins.error
    ?? archive.error
    ?? finishedMedia.error
    ?? togetherness.error
    ?? wishlistArchive.error;

  return useMemo<UseEvolutionCrystalPipelineResult>(() => {
    if (queryError) {
      return {
        pipeline: null,
        isPending: false,
        error: queryError instanceof Error ? queryError : new Error(String(queryError)),
      };
    }
    if (isPending) return { pipeline: null, isPending: true, error: null };
    if (!startDateQuery.data) {
      return {
        pipeline: null,
        isPending: false,
        error: new Error('Evolution preview requires relationship_start_date.'),
      };
    }
    if (userIds.length === 0 || !archive.data) {
      return {
        pipeline: null,
        isPending: false,
        error: new Error('Evolution preview could not assemble the couple snapshot.'),
      };
    }

    try {
      const started = performance.now();
      const coupleId = stableEvolutionCoupleId(userIds);
      const sourceSnapshot = buildEvolutionSourceSnapshot({
        events: events.data ?? [],
        plans: plans.data ?? [],
        wishlist,
        pins: pins.data ?? [],
        archive: archive.data,
        media: finishedMedia.data ?? [],
      });
      const effectiveSources = applyEvolutionSandboxSources({
        enabled: sandboxEnabled,
        values: sandboxValues,
        asOf,
        relationshipStartedAt: startDateQuery.data,
        snapshot: sourceSnapshot,
        sharedDaysOff: togetherness.data ?? [],
      });
      const artifactResult = buildArtifactFromSnapshot({
        coupleId,
        asOf,
        snapshot: effectiveSources.snapshot,
        engineConfig: {
          engineVersion: ENGINE_VERSION,
          relationshipStartedAt: effectiveSources.relationshipStartedAt,
          timeZone: COUPLE_TIME_ZONE,
          leapDayPolicy: 'feb-28',
        },
      });
      const species = buildCrystalSpeciesBlueprint({
        artifact: artifactResult.blueprint,
        config: {
          asOf,
          rulesVersion: SPECIES_RULES_VERSION,
          ...(colorPartners ? { colorPartners } : {}),
          // Days the two of them had off together. Not portal events — see
          // `CrystalSpeciesConfig`.
          sharedDaysOff: effectiveSources.sharedDaysOff,
        },
      });
      const growth = buildGrowthState({
        blueprint: crystalToGrowthBlueprint(species),
        config: {
          ...DEFAULT_GROWTH_ENGINE_CONFIG,
          maxBodies: MAX_PUBLISHED_BODIES,
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
          mediaFinishedCount: effectiveSources.snapshot.media.length,
        },
      });
      const finished = performance.now();

      return {
        isPending: false,
        error: null,
        pipeline: {
          artifact: artifactResult.blueprint,
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
    colorPartners,
    events.data,
    finishedMedia.data,
    togetherness.data,
    isPending,
    pins.data,
    plans.data,
    quality,
    queryError,
    reducedMotion,
    sandboxEnabled,
    sandboxValues,
    startDateQuery.data,
    userIds,
    wishlist,
  ]);
}
