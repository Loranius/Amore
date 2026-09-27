// ============================================================
// Кристал v2: знімок пари → модель → геометрія (ADR-0217).
// ------------------------------------------------------------
// Той самий один запит на всі види (`usePortalSources`, ADR-0189), той
// самий конструктор-пісочниця й ті самі кольорові партнери, що в старому
// конвеєрі. Нового тут лише одне: замість шести томів рушія — одна модель,
// кожен модуль якої дає рівно один ефект, і вона звірена з Python-двійником.
// ============================================================
import { useMemo, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { todayLocal } from '@/features/_shared/month';
import { usePortalSources } from '@/features/world/usePortalSources';
import {
  applyEvolutionSandboxSources,
  useEvolutionSandbox,
} from '@/features/home/evolutionSandbox';
import { buildCrystalV2Geometry, type CrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import { buildCrystalV2Model, type CrystalV2Model, type CrystalV2Snapshot } from '@/engine/species/crystalV2/model';
import { resolveCrystalColorPartners } from '../evolution/sourceSnapshot';
import { crystalV2SnapshotFrom } from './crystalV2Sources';

export interface CrystalV2State {
  snapshot: CrystalV2Snapshot;
  model: CrystalV2Model;
  geometry: CrystalV2Geometry;
}

export interface UseCrystalV2Result {
  state: CrystalV2State | null;
  isPending: boolean;
  error: Error | null;
}

export function useCrystalV2(): UseCrystalV2Result {
  const me = useCurrentUser();
  const users = useUsers();
  // Мить відкриття — для запиту й пісочниці; день пари — для моделі. День
  // рахується в часовому поясі пристрою: пара живе в одному, і річниця
  // має настати о їхній півночі, а не о UTC.
  const [asOf] = useState(() => new Date().toISOString());
  const [day] = useState(todayLocal);
  const sources = usePortalSources('crystal', me.id, asOf);
  const { enabled: sandboxEnabled, values: sandboxValues } = useEvolutionSandbox();
  const partners = useMemo(() => resolveCrystalColorPartners(users.data ?? []), [users.data]);

  const isPending = sources.isPending || users.isPending;
  const queryError = sources.error ?? users.error;

  return useMemo<UseCrystalV2Result>(() => {
    if (queryError) {
      return { state: null, isPending: false, error: queryError instanceof Error ? queryError : new Error(String(queryError)) };
    }
    if (isPending) return { state: null, isPending: true, error: null };
    if (!sources.data) {
      return { state: null, isPending: false, error: new Error('Crystal v2 could not assemble the couple snapshot.') };
    }
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
      const model = buildCrystalV2Model(snapshot);
      return { state: { snapshot, model, geometry: buildCrystalV2Geometry(model) }, isPending: false, error: null };
    } catch (error) {
      return { state: null, isPending: false, error: error instanceof Error ? error : new Error(String(error)) };
    }
  }, [asOf, day, isPending, partners, queryError, sandboxEnabled, sandboxValues, sources.data]);
}
