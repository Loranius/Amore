import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type {
  ReefLivingCanopyColony,
  ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import { reefMorphologyProminence } from './reefMorphologyFamilies';
import type {
  ReefAllocatedSurfaceSlot,
  ReefSurfaceCandidateScorer,
  ReefSurfaceScoreCandidate,
  ReefSurfaceScoreContext,
} from './reefSurfaceSlots';

export const REEF_COLONY_NUCLEATION_VERSION = 'reef-colony-nucleation-v1';
export const REEF_COLONY_NUCLEATION_PASS = 'ecological-settlement-with-open-growth-zones';

const TAU = Math.PI * 2;
const HABITAT_ANGLES = [0.08, 2.12, 4.22] as const;
const OPEN_CHANNEL_HALF_WIDTH = 0.31;

interface MorphologySettlementPreference {
  habitatIndex: 0 | 1 | 2;
  radialRatio: number;
  anchorStrength: number;
  normalY: number;
  exposure: number;
  elevationOffset: number;
  neighborRatio: number;
  areaNeed: number;
  channelAversion: number;
}

const SETTLEMENT_PREFERENCES: Readonly<Record<ReefColonyMorphotype, MorphologySettlementPreference>> = Object.freeze({
  branching: {
    habitatIndex: 0,
    radialRatio: 0.43,
    anchorStrength: 0.62,
    normalY: 0.88,
    exposure: 0.7,
    elevationOffset: 0.11,
    neighborRatio: 3,
    areaNeed: 0.66,
    channelAversion: 0.76,
  },
  massive: {
    habitatIndex: 2,
    radialRatio: 0.56,
    anchorStrength: 0.58,
    normalY: 0.96,
    exposure: 0.46,
    elevationOffset: 0.02,
    neighborRatio: 2.35,
    areaNeed: 0.78,
    channelAversion: 0.72,
  },
  plating: {
    habitatIndex: 1,
    radialRatio: 0.69,
    anchorStrength: 0.64,
    normalY: 0.9,
    exposure: 0.86,
    elevationOffset: 0.17,
    neighborRatio: 3.45,
    areaNeed: 0.96,
    channelAversion: 0.9,
  },
  encrusting: {
    habitatIndex: 2,
    radialRatio: 0.5,
    anchorStrength: 0.54,
    normalY: 0.7,
    exposure: 0.34,
    elevationOffset: -0.03,
    neighborRatio: 1.5,
    areaNeed: 0.34,
    channelAversion: 0.48,
  },
  'soft-coral': {
    habitatIndex: 0,
    radialRatio: 0.5,
    anchorStrength: 0.56,
    normalY: 0.82,
    exposure: 0.62,
    elevationOffset: 0.08,
    neighborRatio: 2.15,
    areaNeed: 0.54,
    channelAversion: 0.68,
  },
  'sea-fan': {
    habitatIndex: 1,
    radialRatio: 0.73,
    anchorStrength: 0.6,
    normalY: 0.77,
    exposure: 0.9,
    elevationOffset: 0.2,
    neighborRatio: 3.65,
    areaNeed: 0.86,
    channelAversion: 0.94,
  },
});

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function stableUnit(seed: number, label: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0xffffffff;
}

function angleDistance(left: number, right: number): number {
  const delta = Math.abs((left - right) % TAU);
  return Math.min(delta, TAU - delta);
}

function habitatBasePhase(seed: number): number {
  return stableUnit(seed, 'reef:morphology-habitats:phase') * TAU;
}

function openChannelAngles(seed: number): readonly number[] {
  const phase = habitatBasePhase(seed);
  return HABITAT_ANGLES.map((angle, index) => {
    const next = HABITAT_ANGLES[(index + 1) % HABITAT_ANGLES.length] ?? HABITAT_ANGLES[0];
    const nextUnwrapped = index === HABITAT_ANGLES.length - 1 ? next + TAU : next;
    return (phase + (angle + nextUnwrapped) * 0.5) % TAU;
  });
}

function nearestHorizontalDistance(
  candidate: ReefSurfaceScoreCandidate,
  occupied: readonly ReefAllocatedSurfaceSlot[],
): number | null {
  let nearest = Number.POSITIVE_INFINITY;
  for (const slot of occupied) {
    const dx = candidate.position.x - slot.position.x;
    const dz = candidate.position.z - slot.position.z;
    nearest = Math.min(nearest, Math.hypot(dx, dz));
  }
  return Number.isFinite(nearest) ? nearest : null;
}

function supportAreaRatio(
  candidate: ReefSurfaceScoreCandidate,
  requestFootprint: number,
  nearestDistance: number | null,
): number {
  const authoredRadius = candidate.maxFootprintRadius ?? candidate.supportRadius;
  const authored = authoredRadius === undefined
    ? 0.72
    : clamp((authoredRadius / Math.max(0.04, requestFootprint) - 0.82) / 0.9, 0, 1);
  const neighborhood = nearestDistance === null
    ? 1
    : clamp(
        (nearestDistance - requestFootprint * 1.15)
          / Math.max(0.12, requestFootprint * 2.9),
        0,
        1,
      );
  return authored * 0.46 + neighborhood * 0.54;
}

/**
 * Stage 4 nucleation starts from the Stage 3 family layout but weakens the
 * direct positional pull. Colonies receive broad morphology habitats; the real
 * support-scoring pass chooses the final settlement point from valid substrate.
 */
export function buildReefColonyNucleationPlan({
  plan,
  foundationRadius,
  seed,
}: {
  plan: ReefLivingCanopyPlan;
  foundationRadius: number;
  seed: number;
}): ReefLivingCanopyPlan {
  const phase = habitatBasePhase(seed);
  const colonies = plan.colonies.map((colony) => {
    const preference = SETTLEMENT_PREFERENCES[colony.morphotype];
    const prominence = reefMorphologyProminence(colony);
    const sequenceAnchor = colony.request.sequence % 19 === 0;
    const dominant = colony.emphasized || prominence >= 0.94 || sequenceAnchor;
    const visualWidthScale = dominant ? 1.26 : 1;
    const visualHeightScale = dominant ? 1.18 : 1;
    const habitatAngle = phase
      + HABITAT_ANGLES[preference.habitatIndex]
      + (stableUnit(colony.seed, 'reef:nucleation:habitat-angle') - 0.5)
        * (dominant ? 0.26 : 0.56);
    const radialJitter = dominant
      ? 0.96 + stableUnit(colony.seed, 'reef:nucleation:radius') * 0.06
      : 0.87 + stableUnit(colony.seed, 'reef:nucleation:radius') * 0.25;
    const localRadius = foundationRadius * preference.radialRatio * radialJitter;
    const targetX = Math.cos(habitatAngle) * localRadius;
    const targetZ = Math.sin(habitatAngle) * localRadius;
    const strength = clamp(
      preference.anchorStrength + (dominant ? 0.06 : 0),
      0.48,
      0.72,
    );
    const request = {
      ...colony.request,
      preferred: {
        x: lerp(colony.request.preferred.x, targetX, strength),
        y: colony.request.preferred.y,
        z: lerp(colony.request.preferred.z, targetZ, strength),
      },
    };

    return {
      ...colony,
      emphasized: dominant,
      footprintRadius: colony.footprintRadius * visualWidthScale,
      targetHeight: colony.targetHeight * visualHeightScale,
      request,
    };
  });

  return {
    ...plan,
    colonies,
    requests: colonies.map((colony) => colony.request),
  };
}

function colonyByRequestId(plan: ReefLivingCanopyPlan): Map<string, ReefLivingCanopyColony> {
  return new Map(plan.colonies.map((colony) => [colony.request.id, colony] as const));
}

function scoreSettlementCandidate({
  context,
  colony,
  foundationRadius,
  seed,
}: {
  context: ReefSurfaceScoreContext;
  colony: ReefLivingCanopyColony;
  foundationRadius: number;
  seed: number;
}): number {
  const { candidate, request, occupied, baseScore } = context;
  const preference = SETTLEMENT_PREFERENCES[colony.morphotype];
  const normalY = clamp(candidate.normalY ?? 1, -1, 1);
  const orientationPenalty = Math.abs(normalY - preference.normalY);
  const radialRatio = clamp(
    Math.hypot(candidate.position.x, candidate.position.z)
      / Math.max(0.5, foundationRadius),
    0,
    1.2,
  );
  const elevationDelta = candidate.position.y - request.preferred.y;
  const elevationPenalty = clamp(
    Math.abs(elevationDelta - preference.elevationOffset) / 0.72,
    0,
    1.6,
  );
  const heightExposure = clamp((elevationDelta + 0.24) / 0.78, 0, 1);
  const exposure = clamp(radialRatio * 0.72 + heightExposure * 0.28, 0, 1);
  const exposurePenalty = Math.abs(exposure - preference.exposure);
  const nearestDistance = nearestHorizontalDistance(candidate, occupied);
  const neighborRatio = nearestDistance === null
    ? preference.neighborRatio
    : nearestDistance / Math.max(0.07, request.footprintRadius);
  const neighborPenalty = nearestDistance === null
    ? 0
    : clamp(
        Math.abs(neighborRatio - preference.neighborRatio)
          / Math.max(1.1, preference.neighborRatio),
        0,
        1.4,
      );
  const areaRatio = supportAreaRatio(candidate, request.footprintRadius, nearestDistance);
  const areaPenalty = 1 - areaRatio;
  const candidateRadius = Math.hypot(candidate.position.x, candidate.position.z);
  const candidateAngle = Math.atan2(candidate.position.z, candidate.position.x);
  const nearestChannel = candidateRadius < foundationRadius * 0.2
    ? Number.POSITIVE_INFINITY
    : Math.min(...openChannelAngles(seed).map((angle) => angleDistance(candidateAngle, angle)));
  const channelPenalty = Number.isFinite(nearestChannel)
    ? clamp((OPEN_CHANNEL_HALF_WIDTH - nearestChannel) / OPEN_CHANNEL_HALF_WIDTH, 0, 1)
    : 0;
  const deterministicTieBreak = stableUnit(
    colony.seed,
    `reef:nucleation:candidate:${candidate.id}`,
  ) * 0.018;

  return baseScore * 0.14
    + orientationPenalty * 0.82
    + exposurePenalty * 0.72
    + elevationPenalty * 0.48
    + neighborPenalty * 0.36
    + areaPenalty * preference.areaNeed * 0.62
    + channelPenalty * preference.channelAversion * 0.94
    + deterministicTieBreak;
}

/**
 * Morphology-aware deterministic settlement scorer. It ranks only already valid
 * supports; allocation still enforces surface bounds, collision clearance,
 * growth epochs and authored footprint limits.
 */
export function createReefColonyNucleationScorer({
  plan,
  foundationRadius,
  seed,
}: {
  plan: ReefLivingCanopyPlan;
  foundationRadius: number;
  seed: number;
}): ReefSurfaceCandidateScorer {
  const colonies = colonyByRequestId(plan);
  return (context) => {
    const colony = colonies.get(context.request.id);
    if (!colony) return context.baseScore;
    return scoreSettlementCandidate({
      context,
      colony,
      foundationRadius,
      seed,
    });
  };
}
