import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEvents } from '@/features/_shared/events';
import { useUsers } from '@/features/_shared/useUsers';
import { useMapPins } from '@/features/map/useMapPins';
import { useFinishedMedia } from '@/features/media/useMedia';
import { useMemories } from '@/features/memories/useMemories';
import { usePlans } from '@/features/plans/usePlans';
import { useScheduleTogetherness } from '@/features/schedule/useSharedDaysOff';
import { fetchPairWishlistEvolutionArchive } from '@/features/wishlist/wishlistEvolutionArchive';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import {
  buildArtifactFromSnapshot,
  type AdapterDiagnostic,
} from '@/engine/evolution/adapters';
import {
  buildEvolutionSourceSnapshot,
  evolutionWishlistFromPairArchive,
  stableEvolutionCoupleId,
} from '../crystal3d/evolution/sourceSnapshot';
import {
  buildReefPreviewFromArtifact,
  type ReefPreviewBuild,
} from './buildReefPreview';

const ENGINE_VERSION = '1.0.0';
const COUPLE_TIME_ZONE = 'Europe/Kyiv';

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

/** Read-only portal adapter. It reuses the accepted Evolution snapshot contract. */
export function useReefPortalPreview(): UseReefPortalPreviewResult {
  const startDateQuery = useRelationshipStartDate();
  const users = useUsers();
  const events = useEvents();
  const plans = usePlans();
  const togetherness = useScheduleTogetherness();
  const pins = useMapPins();
  const archive = useMemories();
  const finishedMedia = useFinishedMedia();
  const wishlistArchive = useQuery({
    queryKey: ['wishlist', 'evolution-archive', 'pair'],
    queryFn: fetchPairWishlistEvolutionArchive,
    staleTime: 5 * 60_000,
  });
  const [asOf] = useState(() => coupleDay(new Date(), COUPLE_TIME_ZONE));

  const userIds = useMemo(
    () => (users.data ?? []).map((user) => user.id).sort((left, right) => left - right),
    [users.data],
  );
  const wishlist = useMemo(
    () => evolutionWishlistFromPairArchive(wishlistArchive.data ?? []),
    [wishlistArchive.data],
  );

  const isPending = startDateQuery.isPending
    || users.isPending
    || events.isPending
    || plans.isPending
    || togetherness.isPending
    || pins.isPending
    || archive.isPending
    || finishedMedia.isPending
    || wishlistArchive.isPending;
  const queryError = startDateQuery.error
    ?? users.error
    ?? events.error
    ?? plans.error
    ?? togetherness.error
    ?? pins.error
    ?? archive.error
    ?? finishedMedia.error
    ?? wishlistArchive.error;

  return useMemo<UseReefPortalPreviewResult>(() => {
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
        error: new Error('Reef production preview requires relationship_start_date.'),
      };
    }
    if (userIds.length === 0 || !archive.data) {
      return {
        preview: null,
        isPending: false,
        error: new Error('Reef production preview could not assemble the couple snapshot.'),
      };
    }

    try {
      const snapshot = buildEvolutionSourceSnapshot({
        events: events.data ?? [],
        plans: plans.data ?? [],
        wishlist,
        pins: pins.data ?? [],
        archive: archive.data,
        media: finishedMedia.data ?? [],
      });
      const artifactResult = buildArtifactFromSnapshot({
        coupleId: stableEvolutionCoupleId(userIds),
        asOf,
        snapshot,
        engineConfig: {
          engineVersion: ENGINE_VERSION,
          relationshipStartedAt: startDateQuery.data,
          timeZone: COUPLE_TIME_ZONE,
          leapDayPolicy: 'feb-28',
        },
      });
      const build = buildReefPreviewFromArtifact({
        artifact: artifactResult.blueprint,
        asOf,
        sharedDaysOff: togetherness.data ?? [],
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
    pins.data,
    plans.data,
    queryError,
    finishedMedia.data,
    startDateQuery.data,
    togetherness.data,
    userIds,
    wishlist,
  ]);
}
