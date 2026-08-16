import type { ReefLivingCanopyPlan } from './reefLivingCanopy';
import type {
  ReefColonyHabitatSummary,
  ReefColonyHabitatTier,
} from './reefColonyHabitats';

export const REEF_CORAL_TIER_BALANCE_VERSION = 'reef-coral-tier-balance-v1';

export interface ReefCoralTierVisualProfile {
  footprintScale: number;
  heightScale: number;
  weightScale: number;
}

export interface ReefCoralTierBalanceResult {
  version: typeof REEF_CORAL_TIER_BALANCE_VERSION;
  plan: ReefLivingCanopyPlan;
}

const TIER_VISUAL_PROFILES: Readonly<Record<ReefColonyHabitatTier, ReefCoralTierVisualProfile>> = {
  crown: {
    footprintScale: 0.94,
    heightScale: 0.98,
    weightScale: 0.98,
  },
  upper: {
    footprintScale: 1.04,
    heightScale: 1.16,
    weightScale: 1.02,
  },
  middle: {
    footprintScale: 1.08,
    heightScale: 1.28,
    weightScale: 1.04,
  },
  lower: {
    footprintScale: 1.05,
    heightScale: 1.18,
    weightScale: 1.02,
  },
};

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function reefCoralTierVisualProfile(
  tier: ReefColonyHabitatTier,
): ReefCoralTierVisualProfile {
  return TIER_VISUAL_PROFILES[tier];
}

export function applyReefCoralTierBalance({
  plan,
  habitats,
}: {
  plan: ReefLivingCanopyPlan;
  habitats: readonly ReefColonyHabitatSummary[];
}): ReefCoralTierBalanceResult {
  const tierByColonyId = new Map<string, ReefColonyHabitatTier>();
  for (const habitat of habitats) {
    for (const colonyId of habitat.memberColonyIds) {
      tierByColonyId.set(colonyId, habitat.tier);
    }
  }

  const colonies = plan.colonies.map((colony) => {
    const tier = tierByColonyId.get(colony.sourceColonyId);
    if (!tier) return colony;
    const profile = reefCoralTierVisualProfile(tier);
    const footprintRadius = round6(Math.max(0.045, colony.footprintRadius * profile.footprintScale));

    return {
      ...colony,
      footprintRadius,
      targetHeight: round6(Math.max(0.045, colony.targetHeight * profile.heightScale)),
      weight: round6(Math.max(0, Math.min(1, colony.weight * profile.weightScale))),
      request: {
        ...colony.request,
        footprintRadius,
      },
    };
  });

  return {
    version: REEF_CORAL_TIER_BALANCE_VERSION,
    plan: {
      ...plan,
      colonies,
      requests: colonies.map((colony) => colony.request),
    },
  };
}
