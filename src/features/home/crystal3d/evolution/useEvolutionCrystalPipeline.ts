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
} from '@/features/wishlist/wishlistEvolutionArchive';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
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
  buildEvolutionSourceSnapshot,
  dedupeEvolutionWishlist,
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

function growthBodyLimit(quality: CrystalMaterialQuality): number {
  if (quality === 'high') return 96;
  if (quality === 'balanced') return 64;
  if (quality === 'low') return 36;
  return 18;
}

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
  const isPending = startDateQuery.isPending
    || users.isPending
    || events.isPending
    || plans.isPending
    || pins.isPending
    || archive.isPending
    || shopping.isPending
    || personalPending
    || sharedArchive.isPending;

  const queryError = startDateQuery.error
    ?? users.error
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
      const snapshot = buildEvolutionSourceSnapshot({
        events: events.data ?? [],
        plans: plans.data ?? [],
        wishlist,
        pins: pins.data ?? [],
        archive: archive.data,
        shopping: shopping.data ?? [],
      });
      const artifactResult = buildArtifactFromSnapshot({
        coupleId,
        asOf,
        snapshot,
        engineConfig: {
          engineVersion: ENGINE_VERSION,
          relationshipStartedAt: startDateQuery.data,
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
    startDateQuery.data,
    userIds,
    wishlist,
  ]);
}
