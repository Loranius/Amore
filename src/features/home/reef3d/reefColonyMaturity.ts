import type { ReefLivingCanopyColony, ReefLivingCanopyPlan } from './reefLivingCanopy';
import type { ReefPreviewBuild } from './buildReefPreview';
import type {
  ReefColonyGrowthStage,
  ReefColonyHabitatPlan,
  ReefColonyHabitatSummary,
} from './reefColonyHabitats';
import {
  buildReefCoralPatchPlan,
  REEF_CORAL_PATCH_VERSION,
} from './reefCoralPatches';
import {
  applyReefCoralCoverage,
  type ReefCoralCoverageSummary,
} from './reefCoralCoverage';
import {
  applyReefCoralTierBalance,
  REEF_CORAL_TIER_BALANCE_VERSION,
} from './reefCoralTierBalance';

export const REEF_COLONY_MATURITY_VERSION = 'reef-colony-maturity-v4-tier-balance';

export type ReefColonyLifecycleStage = 'young' | 'growing' | 'mature';

export interface ReefColonyMaturityState {
  habitatId: string;
  lifecycleStage: ReefColonyLifecycleStage;
  maturityScore: number;
  localZoneMaturity: number;
  localColonization: number;
  ecosystemMaturity: number;
  coverageScale: number;
  heightScale: number;
  recruitmentReadiness: number;
}

export interface ReefColonyMaturityPlan {
  version: typeof REEF_COLONY_MATURITY_VERSION;
  patchVersion: typeof REEF_CORAL_PATCH_VERSION;
  tierBalanceVersion: typeof REEF_CORAL_TIER_BALANCE_VERSION;
  plan: ReefLivingCanopyPlan;
  habitats: ReefColonyHabitatSummary[];
  states: ReefColonyMaturityState[];
  stageCounts: Record<ReefColonyLifecycleStage, number>;
  coverage: ReefCoralCoverageSummary;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t);
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function lifecycleStage(score: number): ReefColonyLifecycleStage {
  if (score < 0.38) return 'young';
  if (score < 0.76) return 'growing';
  return 'mature';
}

function memberStageFactor(
  stage: ReefColonyGrowthStage | undefined,
  lifecycle: ReefColonyLifecycleStage,
): number {
  if (stage === 'core') return 1;
  if (stage === 'inner') return lifecycle === 'young' ? 0.82 : 0.94;
  if (stage === 'frontier') {
    if (lifecycle === 'young') return 0.58;
    if (lifecycle === 'growing') return 0.76;
    return 0.94;
  }
  return 0.9;
}

function effectiveColonyMaturity(
  colony: ReefLivingCanopyColony,
  state: ReefColonyMaturityState,
  growthStage: ReefColonyGrowthStage | undefined,
): number {
  const habitatBlend = clamp01(colony.maturity * 0.56 + state.maturityScore * 0.44);
  return round6(clamp01(
    habitatBlend * memberStageFactor(growthStage, state.lifecycleStage),
  ));
}

function firstHabitatColony(
  ids: readonly string[],
  colonies: ReadonlyMap<string, ReefLivingCanopyColony>,
): ReefLivingCanopyColony | undefined {
  for (const id of ids) {
    const colony = colonies.get(id);
    if (colony) return colony;
  }
  return undefined;
}

export function buildReefColonyMaturityPlan(
  habitatPlan: ReefColonyHabitatPlan,
  build: ReefPreviewBuild,
): ReefColonyMaturityPlan {
  const patchPlan = buildReefCoralPatchPlan(habitatPlan, build);
  const evolution = build.species.moduleEvolution;
  const ecology = evolution.development.ecology;
  const zones = evolution.development.annualZones;
  const colonyBySourceId = new Map(
    patchPlan.plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
  );
  const stateByColonyId = new Map<string, ReefColonyMaturityState>();
  const growthStageByColonyId = new Map<string, ReefColonyGrowthStage>();
  const states: ReefColonyMaturityState[] = [];
  const stageCounts: Record<ReefColonyLifecycleStage, number> = {
    young: 0,
    growing: 0,
    mature: 0,
  };

  for (const habitat of patchPlan.habitats) {
    const firstColony = firstHabitatColony(habitat.memberColonyIds, colonyBySourceId);
    const epochIndex = firstColony?.request.epochIndex ?? 0;
    const zone = zones[Math.min(Math.max(0, epochIndex), Math.max(0, zones.length - 1))];
    const localZoneMaturity = zone?.maturity ?? ecology.maturity;
    const localColonization = zone?.colonization ?? ecology.colonization;
    const localFill = zone?.fill ?? 0;
    const score = round6(clamp01(
      habitat.maturity * 0.34
        + localZoneMaturity * 0.24
        + localColonization * 0.16
        + localFill * 0.1
        + ecology.maturity * 0.08
        + ecology.cohesion * 0.05
        + ecology.colonization * 0.03,
    ));
    const stage = lifecycleStage(score);
    const eased = smoothstep(score);
    const state: ReefColonyMaturityState = {
      habitatId: habitat.id,
      lifecycleStage: stage,
      maturityScore: score,
      localZoneMaturity: round6(localZoneMaturity),
      localColonization: round6(localColonization),
      ecosystemMaturity: round6(ecology.maturity),
      coverageScale: round6(lerp(0.76, 1.06, eased)),
      heightScale: round6(lerp(0.8, 1.08, eased)),
      recruitmentReadiness: round6(clamp01((score - 0.58) / 0.3)),
    };
    states.push(state);
    stageCounts[stage] += 1;

    for (const colonyId of habitat.memberColonyIds) {
      stateByColonyId.set(colonyId, state);
    }
    for (const growth of habitat.growth) {
      growthStageByColonyId.set(growth.colonyId, growth.stage);
    }
  }

  const colonies = patchPlan.plan.colonies.map((colony) => {
    const state = stateByColonyId.get(colony.sourceColonyId);
    if (!state) return colony;
    const effectiveMaturity = effectiveColonyMaturity(
      colony,
      state,
      growthStageByColonyId.get(colony.sourceColonyId),
    );
    const maturityEnvelope = 0.88 + effectiveMaturity * 0.12;
    const footprintRadius = round6(Math.max(
      0.055,
      colony.footprintRadius * state.coverageScale * maturityEnvelope,
    ));
    const targetHeight = round6(Math.max(
      0.045,
      colony.targetHeight * state.heightScale * (0.9 + effectiveMaturity * 0.1),
    ));

    return {
      ...colony,
      maturity: effectiveMaturity,
      footprintRadius,
      targetHeight,
      weight: round6(clamp01(colony.weight * (0.9 + effectiveMaturity * 0.1))),
      request: {
        ...colony.request,
        footprintRadius,
      },
    };
  });

  const maturedPlan: ReefLivingCanopyPlan = {
    ...patchPlan.plan,
    colonies,
    requests: colonies.map((colony) => colony.request),
  };
  const tierBalance = applyReefCoralTierBalance({
    plan: maturedPlan,
    habitats: patchPlan.habitats,
  });
  const coverage = applyReefCoralCoverage({
    plan: tierBalance.plan,
    habitats: patchPlan.habitats,
  });

  return {
    version: REEF_COLONY_MATURITY_VERSION,
    patchVersion: patchPlan.patchVersion,
    tierBalanceVersion: tierBalance.version,
    plan: coverage.plan,
    habitats: coverage.habitats,
    states,
    stageCounts,
    coverage: coverage.summary,
  };
}
