import { useMemo, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { usePortalSources } from '@/features/world/usePortalSources';
import {
  buildArtifactFromSnapshot,
  type AdapterDiagnostic,
} from '@/engine/evolution/adapters';
import type { OrganicMeshLod } from '@/engine/labs/organic';
import { resolveTreeProductionAsOf } from '@/engine/productionAcceptance';
import {
  applyEvolutionSandboxSources,
  useEvolutionSandbox,
} from '@/features/home/evolutionSandbox';
import { stableEvolutionCoupleId } from '../evolution/sourceSnapshot';
import type { GrowthEvent } from '@/features/home/growthSinceLastVisit';
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
  /** Події рушія для каналу приросту — див. `growthChannel.ts`. */
  growthEvents: readonly GrowthEvent[];
}

export interface UseTreeLabPortalPreviewResult {
  preview: TreeLabPortalPreview | null;
  isPending: boolean;
  error: Error | null;
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
  const me = useCurrentUser();
  const [asOf] = useState(() => resolveTreeProductionAsOf(new Date(), COUPLE_TIME_ZONE));
  /*
   * ЗНІМОК ПОРТАЛУ ОДИН НА ВСІ ВИДИ (ADR-0189). Тут стояли сім окремих
   * запитів і власний збирач знімка — третій у порталі. Він, як і
   * кристалів, не бачив домішки «сказаних» чисел онбордингу, тож дерево
   * росло з коротшої історії, ніж риф, на тих самих даних.
   */
  const sources = usePortalSources('tree', me.id, asOf);
  const { enabled: sandboxEnabled, values: sandboxValues } = useEvolutionSandbox();

  const isPending = sources.isPending;

  const queryError = sources.error;

  return useMemo<UseTreeLabPortalPreviewResult>(() => {
    if (queryError) {
      return {
        preview: null,
        isPending: false,
        error: queryError instanceof Error ? queryError : new Error(String(queryError)),
      };
    }
    if (isPending) return { preview: null, isPending: true, error: null };
    if (!sources.data) {
      return {
        preview: null,
        isPending: false,
        error: new Error('Tree portal preview could not assemble the couple snapshot.'),
      };
    }

    try {
      const effectiveSources = applyEvolutionSandboxSources({
        enabled: sandboxEnabled,
        values: sandboxValues,
        asOf,
        relationshipStartedAt: sources.data.relationshipStartedAt,
        snapshot: sources.data.snapshot,
      });
      const artifactResult = buildArtifactFromSnapshot({
        coupleId: stableEvolutionCoupleId(sources.data.userIds),
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
          /*
           * Події для каналу приросту — те саме `artifact.events`, з якого
           * рахують кристал і риф (ADR-0189). Вони тут уже зібрані, і доти
           * просто викидались: дерево було єдиним видом, над яким пара не
           * бачила відповіді на питання «чи змінилось наше життя».
           */
          growthEvents: artifactResult.blueprint.events.map((event): GrowthEvent => ({
            id: event.id,
            actorId: event.attribution?.actorId ?? null,
          })),
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
    isPending,
    lod,
    queryError,
    sandboxEnabled,
    sandboxValues,
    sources.data,
  ]);
}
