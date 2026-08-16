import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEvents } from '@/features/_shared/events';
import { useUsers } from '@/features/_shared/useUsers';
import { useMapPins } from '@/features/map/useMapPins';
import { useFinishedMedia } from '@/features/media/useMedia';
import { useMemories } from '@/features/memories/useMemories';
import { usePlans } from '@/features/plans/usePlans';
import { fetchPairWishlistEvolutionArchive } from '@/features/wishlist/wishlistEvolutionArchive';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import {
  buildArtifactFromSnapshot,
  type AdapterDiagnostic,
} from '@/engine/evolution/adapters';
import type { OrganicMeshLod } from '@/engine/labs/organic';
import { resolveTreeProductionAsOf } from '@/engine/productionAcceptance';
import {
  applyEvolutionSandboxSources,
  relationshipDaysBetween,
  useEvolutionSandbox,
} from '@/features/home/evolutionSandbox';
import {
  buildEvolutionSourceSnapshot,
  evolutionWishlistFromPairArchive,
  stableEvolutionCoupleId,
} from '../evolution/sourceSnapshot';
import {
  buildTreeLabPreviewFromArtifact,
  type TreeLabPreviewBuild,
} from './buildTreeLabPreview';

const ENGINE_VERSION = '1.0.0';
const COUPLE_TIME_ZONE = 'Europe/Kyiv';
const TREE_PORTAL_RULES_VERSION = 'tree-species-portal-v1.0.0';

export interface TreeLabPortalPreview {
  build: TreeLabPreviewBuild;
  diagnostics: AdapterDiagnostic[];
  normalizedEventCount: number;
}

export interface UseTreeLabPortalPreviewResult {
  preview: TreeLabPortalPreview | null;
  isPending: boolean;
  error: Error | null;
}

function useRelationshipStartDate() {
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
 * Read-only portal adapter for the production Tree pipeline. Module rows are
 * normalized through the existing Evolution adapters before Tree Species sees
 * them. `asOf` is pinned to the current relationship-local day so identical
 * history produces the same contract after a reload.
 */
export function useTreeLabPortalPreview(
  lod: OrganicMeshLod,
): UseTreeLabPortalPreviewResult {
  const startDateQuery = useRelationshipStartDate();
  const users = useUsers();
  const events = useEvents();
  const plans = usePlans();
  const pins = useMapPins();
  const archive = useMemories();
  const finishedMedia = useFinishedMedia();
  const wishlistArchive = useQuery({
    queryKey: ['wishlist', 'evolution-archive', 'pair'],
    queryFn: fetchPairWishlistEvolutionArchive,
    staleTime: 5 * 60_000,
  });
  const [asOf] = useState(() => resolveTreeProductionAsOf(new Date(), COUPLE_TIME_ZONE));
  const {
    enabled: sandboxEnabled,
    values: sandboxValues,
    registerBaseline,
  } = useEvolutionSandbox();

  const userIds = useMemo(
    () => (users.data ?? []).map((user) => user.id).sort((left, right) => left - right),
    [users.data],
  );
  const wishlist = useMemo(
    () => evolutionWishlistFromPairArchive(wishlistArchive.data ?? []),
    [wishlistArchive.data],
  );

  useEffect(() => {
    if (!startDateQuery.data) return;
    registerBaseline('tree', {
      relationshipDays: relationshipDaysBetween(startDateQuery.data, asOf),
      calendarEvents: (events.data ?? []).length,
      completedPlans: (plans.data ?? []).filter((plan) => plan.status === 'done').length,
      fulfilledWishes: wishlist.filter((wish) => wish.fulfilled).length,
      visitedPlaces: (pins.data ?? []).filter((pin) => Boolean(pin.visited_at)).length,
      memories: archive.data?.photos.length ?? 0,
      finishedMedia: (finishedMedia.data ?? []).length,
      sharedDaysOff: 0,
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
    wishlist,
  ]);

  const isPending = startDateQuery.isPending
    || users.isPending
    || events.isPending
    || plans.isPending
    || pins.isPending
    || archive.isPending
    || finishedMedia.isPending
    || wishlistArchive.isPending;

  const queryError = startDateQuery.error
    ?? users.error
    ?? events.error
    ?? plans.error
    ?? pins.error
    ?? archive.error
    ?? finishedMedia.error
    ?? wishlistArchive.error;

  return useMemo<UseTreeLabPortalPreviewResult>(() => {
    if (queryError) {
      return {
        preview: null,
        isPending: false,
        error: queryError instanceof Error ? queryError : new Error(String(queryError)),
      };
    }
    if (isPending) return { preview: null, isPending: true, error: null };
    if (!startDateQuery.data) {
      return {
        preview: null,
        isPending: false,
        error: new Error('Tree portal preview requires relationship_start_date.'),
      };
    }
    if (userIds.length === 0 || !archive.data) {
      return {
        preview: null,
        isPending: false,
        error: new Error('Tree portal preview could not assemble the couple snapshot.'),
      };
    }

    try {
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
      });
      const artifactResult = buildArtifactFromSnapshot({
        coupleId: stableEvolutionCoupleId(userIds),
        asOf,
        snapshot: effectiveSources.snapshot,
        engineConfig: {
          engineVersion: ENGINE_VERSION,
          relationshipStartedAt: effectiveSources.relationshipStartedAt,
          timeZone: COUPLE_TIME_ZONE,
          leapDayPolicy: 'feb-28',
        },
      });
      const build = buildTreeLabPreviewFromArtifact({
        artifact: artifactResult.blueprint,
        asOf,
        lod,
        rulesVersion: TREE_PORTAL_RULES_VERSION,
        asOfPolicy: 'couple-day',
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
    archive.data,
    asOf,
    events.data,
    isPending,
    lod,
    pins.data,
    plans.data,
    queryError,
    finishedMedia.data,
    sandboxEnabled,
    sandboxValues,
    startDateQuery.data,
    userIds,
    wishlist,
  ]);
}
