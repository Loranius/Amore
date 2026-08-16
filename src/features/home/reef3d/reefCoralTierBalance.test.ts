import { describe, expect, it } from 'vitest';
import type { ReefLivingCanopyColony, ReefLivingCanopyPlan } from './reefLivingCanopy';
import type { ReefColonyHabitatSummary } from './reefColonyHabitats';
import {
  applyReefCoralTierBalance,
  reefCoralTierVisualProfile,
  REEF_CORAL_TIER_BALANCE_VERSION,
} from './reefCoralTierBalance';

function colony(id: string, sequence: number): ReefLivingCanopyColony {
  return {
    id: `living:${id}`,
    sourceColonyId: id,
    sourceModule: 'relationship',
    morphotype: 'branching',
    tier: 'primary',
    seed: sequence + 1,
    emphasized: false,
    weight: 0.6,
    maturity: 0.7,
    footprintRadius: 0.1,
    targetHeight: 0.2,
    facingRad: 0,
    request: {
      id: `request:${id}`,
      sequence,
      preferred: { x: sequence, y: 0, z: 0 },
      footprintRadius: 0.1,
    },
  };
}

function habitat(
  id: string,
  tier: ReefColonyHabitatSummary['tier'],
  colonyId: string,
): ReefColonyHabitatSummary {
  return {
    id,
    sourceInstructionId: id,
    dominantMorphotype: 'branching',
    tier,
    center: { x: 0, z: 0 },
    spreadRadius: 0.4,
    activeRadius: 0,
    maturity: 0.7,
    shapeProfile: {
      footprintShape: 'cluster',
      radialStretch: 1,
      tangentialStretch: 1,
      spreadMultiplier: 1,
      spacingMultiplier: 1,
      angularJitterRad: 0,
      facingMode: 'outward',
    },
    memberColonyIds: [colonyId],
    growth: [{
      colonyId,
      sequence: 0,
      stage: 'core',
      distanceFromCenter: 0,
      distanceRatio: 0,
    }],
  };
}

describe('reef coral tier balance', () => {
  it('makes the middle terrace the strongest visual life band', () => {
    const crown = reefCoralTierVisualProfile('crown');
    const upper = reefCoralTierVisualProfile('upper');
    const middle = reefCoralTierVisualProfile('middle');
    const lower = reefCoralTierVisualProfile('lower');

    expect(middle.heightScale).toBeGreaterThan(upper.heightScale);
    expect(middle.heightScale).toBeGreaterThan(lower.heightScale);
    expect(middle.heightScale).toBeGreaterThan(crown.heightScale);
    expect(middle.footprintScale).toBeGreaterThan(crown.footprintScale);
  });

  it('scales colonies without moving their stable placement requests', () => {
    const crownColony = colony('crown', 0);
    const middleColony = colony('middle', 1);
    const plan: ReefLivingCanopyPlan = {
      colonies: [crownColony, middleColony],
      requests: [crownColony.request, middleColony.request],
      morphotypeCounts: {
        branching: 2,
        massive: 0,
        plating: 0,
        encrusting: 0,
        'soft-coral': 0,
        'sea-fan': 0,
      },
    };
    const result = applyReefCoralTierBalance({
      plan,
      habitats: [
        habitat('crown-habitat', 'crown', 'crown'),
        habitat('middle-habitat', 'middle', 'middle'),
      ],
    });
    const crown = result.plan.colonies[0]!;
    const middle = result.plan.colonies[1]!;

    expect(result.version).toBe(REEF_CORAL_TIER_BALANCE_VERSION);
    expect(crown.request.preferred).toEqual(crownColony.request.preferred);
    expect(middle.request.preferred).toEqual(middleColony.request.preferred);
    expect(middle.targetHeight).toBeGreaterThan(crown.targetHeight);
    expect(middle.footprintRadius).toBeGreaterThan(crown.footprintRadius);
    expect(middle.request.footprintRadius).toBe(middle.footprintRadius);
  });
});
