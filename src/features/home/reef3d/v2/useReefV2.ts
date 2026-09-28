// ============================================================
// Риф v2: знімок пари → модель → геометрія (ADR-0219).
// ------------------------------------------------------------
// Той самий знімок, що в кристала v2 (`crystalV2SnapshotFrom`): один
// запит на всі види, та сама пісочниця й ті самі кольорові партнери.
// ============================================================
import { useMemo, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { todayLocal } from '@/features/_shared/month';
import { usePortalSources } from '@/features/world/usePortalSources';
import { applyEvolutionSandboxSources, useEvolutionSandbox } from '@/features/home/evolutionSandbox';
import type { CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { buildReefV2Geometry, type ReefV2Geometry } from '@/engine/species/reefV2/geometry';
import { buildReefV2Model, type ReefV2Model } from '@/engine/species/reefV2/model';
import { resolveCrystalColorPartners } from '../../crystal3d/evolution/sourceSnapshot';
import { crystalV2SnapshotFrom } from '../../crystal3d/v2/crystalV2Sources';

export interface ReefV2State {
  snapshot: CrystalV2Snapshot;
  model: ReefV2Model;
  geometry: ReefV2Geometry;
}

export function useReefV2(): { state: ReefV2State | null; isPending: boolean; error: Error | null } {
  const me = useCurrentUser();
  const users = useUsers();
  const [asOf] = useState(() => new Date().toISOString());
  const [day] = useState(todayLocal);
  const sources = usePortalSources('reef', me.id, asOf);
  const { enabled: sandboxEnabled, values: sandboxValues } = useEvolutionSandbox();
  const partners = useMemo(() => resolveCrystalColorPartners(users.data ?? []), [users.data]);
  const isPending = sources.isPending || users.isPending;
  const queryError = sources.error ?? users.error;

  return useMemo(() => {
    if (queryError) {
      return { state: null, isPending: false, error: queryError instanceof Error ? queryError : new Error(String(queryError)) };
    }
    if (isPending) return { state: null, isPending: true, error: null };
    if (!sources.data) return { state: null, isPending: false, error: new Error('Reef v2 could not assemble the couple snapshot.') };
    try {
      const effective = applyEvolutionSandboxSources({
        enabled: sandboxEnabled,
        values: sandboxValues,
        asOf,
        relationshipStartedAt: sources.data.relationshipStartedAt,
        snapshot: sources.data.snapshot,
        sharedDaysOff: sources.data.sharedDaysOff,
      });
      const snapshot = crystalV2SnapshotFrom({
        relationshipStartedAt: effective.relationshipStartedAt,
        asOf: day,
        snapshot: effective.snapshot,
        sharedDaysOff: effective.sharedDaysOff,
        partners,
      });
      const model = buildReefV2Model(snapshot);
      return { state: { snapshot, model, geometry: buildReefV2Geometry(model) }, isPending: false, error: null };
    } catch (error) {
      return { state: null, isPending: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }, [asOf, day, isPending, partners, queryError, sandboxEnabled, sandboxValues, sources.data]);
}
