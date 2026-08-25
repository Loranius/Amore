// ============================================================
// Гак нової сцени: історія пари → план рифа.
// ------------------------------------------------------------
// Усе рішення про ріст лишається в рушії (`species/reef/reefAssembly`).
// Тут лише склеювання: джерела → артефакт Еволюції → план.
//
// Пісочниця («що було б, якби рік був повніший») діє й тут — тим самим
// викликом, що й у кристала. Інакше повзунки міняли б один вид і не
// міняли б інший, і пара побачила б два різні минулі.
// ============================================================
import { useMemo } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { buildArtifactFromSnapshot } from '@/engine/evolution/adapters';
import { applyEvolutionSandboxSources, useEvolutionSandbox } from '@/features/home/evolutionSandbox';
import {
  buildReefPlan,
  reefHistoryFromArtifact,
  type ReefPlan,
} from '@/engine/species/reef/reefAssembly';
import type { ReefTheme } from '@/engine/species/reef/coralPalette';
import { stableEvolutionCoupleId } from '../../crystal3d/evolution/sourceSnapshot';
import {
  COUPLE_TIME_ZONE,
  ENGINE_VERSION,
  useCoupleDay,
  useReefPortalSources,
} from './reefPortalSources';

export interface UseReefPlanResult {
  plan: ReefPlan | null;
  asOf: string;
  coupleId: string | null;
  eventCount: number;
  isPending: boolean;
  error: Error | null;
}

export function useReefPlan(theme: ReefTheme): UseReefPlanResult {
  const me = useCurrentUser();
  const asOf = useCoupleDay();
  const { enabled: sandboxEnabled, values: sandboxValues } = useEvolutionSandbox();
  const sources = useReefPortalSources(me.id, asOf);

  return useMemo<UseReefPlanResult>(() => {
    const data = sources.data;
    if (!data) {
      if (sources.error) {
        return {
          plan: null,
          asOf,
          coupleId: null,
          eventCount: 0,
          isPending: false,
          error: sources.error instanceof Error
            ? sources.error
            : new Error(String(sources.error)),
        };
      }
      return {
        plan: null, asOf, coupleId: null, eventCount: 0,
        isPending: sources.isPending, error: null,
      };
    }

    try {
      const effective = applyEvolutionSandboxSources({
        enabled: sandboxEnabled,
        values: sandboxValues,
        asOf,
        relationshipStartedAt: data.relationshipStartedAt,
        snapshot: data.snapshot,
        sharedDaysOff: data.sharedDaysOff,
      });
      const coupleId = stableEvolutionCoupleId(data.userIds);
      const artifact = buildArtifactFromSnapshot({
        coupleId,
        asOf,
        snapshot: effective.snapshot,
        engineConfig: {
          engineVersion: ENGINE_VERSION,
          relationshipStartedAt: effective.relationshipStartedAt,
          timeZone: COUPLE_TIME_ZONE,
          leapDayPolicy: 'feb-28',
        },
      }).blueprint;

      return {
        plan: buildReefPlan({
          relationshipStartedAt: artifact.relationshipStartedAt,
          asOf,
          leapDayPolicy: artifact.leapDayPolicy,
          seed: artifact.deterministicSeed,
          events: reefHistoryFromArtifact(artifact),
          sharedDaysOff: effective.sharedDaysOff,
          theme,
        }),
        asOf,
        coupleId,
        eventCount: artifact.events.length,
        isPending: false,
        error: null,
      };
    } catch (error) {
      return {
        plan: null,
        asOf,
        coupleId: null,
        eventCount: 0,
        isPending: false,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }, [asOf, sandboxEnabled, sandboxValues, sources.data, sources.error, sources.isPending, theme]);
}
