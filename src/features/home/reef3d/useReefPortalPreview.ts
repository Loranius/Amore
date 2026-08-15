import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUsers } from '@/features/_shared/useUsers';
import { qk } from '@/lib/queryKeys';
import { supabase } from '@/lib/supabase';
import {
  buildReefComposition,
  buildReefCoralColonies,
  buildReefCore,
  buildReefSurfaceSystem,
  buildReefYearStructures,
  reefDaysTogether,
  type ReefCompositionManifest,
  type ReefCoralColoniesManifest,
  type ReefCoreManifest,
  type ReefSurfaceManifest,
  type ReefYearStructuresManifest,
} from '@/engine/species/reef';
import { stableEvolutionCoupleId } from '../crystal3d/evolution/sourceSnapshot';

const COUPLE_TIME_ZONE = 'Europe/Kyiv';

export interface ReefPortalPreview {
  core: ReefCoreManifest;
  yearStructures: ReefYearStructuresManifest;
  composition: ReefCompositionManifest;
  surfaces: ReefSurfaceManifest;
  colonies: ReefCoralColoniesManifest;
  asOf: string;
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

/** Phase 5 portal adapter: deterministic geology, surfaces and baseline coral colonization. */
export function useReefPortalPreview(): UseReefPortalPreviewResult {
  const startDateQuery = useRelationshipStartDate();
  const users = useUsers();
  const [asOf] = useState(() => coupleDay(new Date(), COUPLE_TIME_ZONE));

  const userIds = useMemo(
    () => (users.data ?? []).map((user) => user.id).sort((left, right) => left - right),
    [users.data],
  );
  const isPending = startDateQuery.isPending || users.isPending;
  const queryError = startDateQuery.error ?? users.error;

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
        error: new Error('Reef Core requires relationship_start_date.'),
      };
    }
    if (userIds.length === 0) {
      return {
        preview: null,
        isPending: false,
        error: new Error('Reef Core could not resolve the couple identity.'),
      };
    }

    try {
      const daysTogether = reefDaysTogether(startDateQuery.data, asOf);
      if (daysTogether === null) {
        throw new Error('Reef Core could not derive daysTogether from relationship_start_date.');
      }
      const core = buildReefCore({
        coupleId: stableEvolutionCoupleId(userIds),
        relationshipStartDate: startDateQuery.data,
        daysTogether,
      });
      const yearStructures = buildReefYearStructures({ core });
      const composition = buildReefComposition({ core, yearStructures });
      const surfaces = buildReefSurfaceSystem({ core, composition });
      const colonies = buildReefCoralColonies({ core, surfaces });
      return {
        preview: { core, yearStructures, composition, surfaces, colonies, asOf },
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
  }, [asOf, isPending, queryError, startDateQuery.data, userIds]);
}
