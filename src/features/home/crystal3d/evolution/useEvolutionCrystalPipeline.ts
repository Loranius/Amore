import { useMemo, useState } from 'react';
import { useCurrentUser } from '@/providers/AuthProvider';
import { useUsers } from '@/features/_shared/useUsers';
import { usePortalSources } from '@/features/world/usePortalSources';
import type { ArtifactBlueprint } from '@/engine/evolution';
import type { AdapterDiagnostic } from '@/engine/evolution/adapters';
import type { CrystalSpeciesBlueprint } from '@/engine/species/crystal';
import type { GrowthState } from '@/engine/growth';
import type { CrystalCompositionState } from '@/engine/composition';
import type { CrystalGeometryState } from '@/engine/geometry';
import type { CrystalMaterialQuality, CrystalMaterialState } from '@/engine/material';
import type { CrystalLifeState } from '@/engine/life';
import { resolveCrystalRendererQuality } from '@/engine/renderer';
import { buildCrystalPipelineStates } from './crystalPipeline';
import {
  applyEvolutionSandboxSources,
  useEvolutionSandbox,
} from '@/features/home/evolutionSandbox';
import {
  resolveCrystalColorPartners,
  stableEvolutionCoupleId,
} from './sourceSnapshot';



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

/**
 * Client orchestration only. Every engine layer below remains pure and receives
 * explicit source rows, clock, time zone and versioned configs.
 */
export function useEvolutionCrystalPipeline(
  reducedMotion: boolean,
): UseEvolutionCrystalPipelineResult {
  const me = useCurrentUser();
  const users = useUsers();
  const [asOf] = useState(() => new Date().toISOString());
  /*
   * ЗНІМОК ПОРТАЛУ ОДИН НА ВСІ ВИДИ (ADR-0189).
   *
   * Тут стояли вісім окремих запитів і власний збирач знімка. Вони давали
   * ІНШЕ число, ніж риф: 328 подій проти 435 того самого дня. Різниця —
   * домішка «сказаних» чисел онбордингу, яку додає `fetchPortalSources`,
   * а цей збирач не бачив. Тобто пара, яка назвала числом тридцять
   * фотографій першого року, бачила їх у рифі й не бачила в кристалі.
   *
   * `asOf` лишився повним ISO-штампом, а не днем пари: його читає рушій,
   * і зміна формату була б окремою зміною артефакта, якої ніхто не
   * просив.
   */
  const sources = usePortalSources('crystal', me.id, asOf);
  const [quality] = useState(readQuality);
  /*
   * Базові значення пісочниці реєструє сам запит (`usePortalSources`):
   * це побічна дія ЗНІМКА, а не того, хто його читає. Доти кожен вид
   * рахував їх по-своєму зі своїх запитів — три підрахунки того самого.
   */
  const { enabled: sandboxEnabled, values: sandboxValues } = useEvolutionSandbox();

  /*
   * Кольорові партнери — єдине, заради чого тут лишився `users`: знімок
   * порталу несе лише `userIds`, а ADR-0004 фарбує рік за тим, хто кому
   * подарував, і йому потрібні самі рядки.
   */
  const colorPartners = useMemo(
    () => resolveCrystalColorPartners(users.data ?? []),
    [users.data],
  );

  const isPending = sources.isPending || users.isPending;
  const queryError = sources.error ?? users.error;

  return useMemo<UseEvolutionCrystalPipelineResult>(() => {
    if (queryError) {
      return {
        pipeline: null,
        isPending: false,
        error: queryError instanceof Error ? queryError : new Error(String(queryError)),
      };
    }
    if (isPending) return { pipeline: null, isPending: true, error: null };
    if (!sources.data) {
      return {
        pipeline: null,
        isPending: false,
        error: new Error('Evolution preview could not assemble the couple snapshot.'),
      };
    }

    try {
      const started = performance.now();
      const coupleId = stableEvolutionCoupleId(sources.data.userIds);
      const effectiveSources = applyEvolutionSandboxSources({
        enabled: sandboxEnabled,
        values: sandboxValues,
        asOf,
        relationshipStartedAt: sources.data.relationshipStartedAt,
        snapshot: sources.data.snapshot,
        sharedDaysOff: sources.data.sharedDaysOff,
      });
      /*
       * Сам ланцюг живе в `crystalPipeline.ts` — його ділить лабораторія
       * кристала, і друга копія тут означала б, що вимір із лабораторії
       * нічого не доводить про портал.
       */
      const states = buildCrystalPipelineStates({
        coupleId,
        asOf,
        relationshipStartedAt: effectiveSources.relationshipStartedAt,
        snapshot: effectiveSources.snapshot,
        sharedDaysOff: effectiveSources.sharedDaysOff,
        quality,
        reducedMotion,
        ...(colorPartners ? { colorPartners } : {}),
      });
      const { species, growth, composition, geometry, material, life } = states;
      const artifactResult = {
        blueprint: states.artifact,
        adapterDiagnostics: states.adapterDiagnostics,
      };
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
    asOf,
    colorPartners,
    isPending,
    quality,
    queryError,
    reducedMotion,
    sandboxEnabled,
    sandboxValues,
    sources.data,
  ]);
}
