import { useMemo } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import {
  buildArtifactFromSnapshot,
  type AdapterDiagnostic,
} from '@/engine/evolution/adapters';
import { applyEvolutionSandboxSources, useEvolutionSandbox } from '@/features/home/evolutionSandbox';
import { stableEvolutionCoupleId } from '../crystal3d/evolution/sourceSnapshot';
import {
  COUPLE_TIME_ZONE,
  ENGINE_VERSION,
  useCoupleDay,
  useReefPortalSources,
} from './world/reefPortalSources';
import {
  buildReefPreviewFromArtifact,
  type ReefPreviewBuild,
} from './buildReefPreview';

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

export function useReefPortalPreview(): UseReefPortalPreviewResult {
  const me = useCurrentUser();
  const asOf = useCoupleDay();
  const { enabled: sandboxEnabled, values: sandboxValues } = useEvolutionSandbox();
  const sourceQuery = useReefPortalSources(me.id, asOf);

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
