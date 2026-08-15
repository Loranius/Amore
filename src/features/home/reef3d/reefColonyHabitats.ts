import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import type {
  ReefLivingCanopyColony,
  ReefLivingCanopyPlan,
} from './reefLivingCanopy';

export const REEF_COLONY_HABITAT_VERSION = 'reef-colony-habitats-v3';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export type ReefColonyHabitatTier = 'crown' | 'upper' | 'middle' | 'lower';
export type ReefColonyGrowthStage = 'core' | 'inner' | 'frontier';
export type ReefColonyFacingMode = 'outward' | 'tangent' | 'mixed';
export type ReefColonyFootprintShape = 'cluster' | 'plate' | 'carpet' | 'grove' | 'fan';

export interface ReefColonyShapeProfile {
  footprintShape: ReefColonyFootprintShape;
  radialStretch: number;
  tangentialStretch: number;
  spreadMultiplier: number;
  spacingMultiplier: number;
  angularJitterRad: number;
  facingMode: ReefColonyFacingMode;
}

export interface ReefColonyHabitatMemberGrowth {
  colonyId: string;
  sequence: number;
  stage: ReefColonyGrowthStage;
  distanceFromCenter: number;
  distanceRatio: number;
}

export interface ReefColonyHabitatSummary {
  id: string;
  sourceInstructionId: string;
  dominantMorphotype: ReefColonyMorphotype;
  tier: ReefColonyHabitatTier;
  center: { x: number; z: number };
  spreadRadius: number;
  activeRadius: number;
  maturity: number;
  shapeProfile: ReefColonyShapeProfile;
  memberColonyIds: string[];
  growth: ReefColonyHabitatMemberGrowth[];
}

export interface ReefColonyHabitatPlan {
  version: typeof REEF_COLONY_HABITAT_VERSION;
  plan: ReefLivingCanopyPlan;
  habitats: ReefColonyHabitatSummary[];
}

interface HabitatMember {
  colony: ReefLivingCanopyColony;
  sourceInstructionId: string;
  radialBand: number;
  preferredAzimuthRad: number;
}

interface HabitatRenderMember {
  request: ReefLivingCanopyColony['request'];
  facingRad: number;
}

const MORPHOTYPE_SHAPES: Readonly<Record<ReefColonyMorphotype, ReefColonyShapeProfile>> = {
  branching: {
    footprintShape: 'cluster',
    radialStretch: 1.02,
    tangentialStretch: 0.9,
    spreadMultiplier: 0.9,
    spacingMultiplier: 0.94,
    angularJitterRad: 0.16,
    facingMode: 'outward',
  },
  massive: {
    footprintShape: 'cluster',
    radialStretch: 0.94,
    tangentialStretch: 0.94,
    spreadMultiplier: 0.8,
    spacingMultiplier: 0.82,
    angularJitterRad: 0.13,
    facingMode: 'mixed',
  },
  plating: {
    footprintShape: 'plate',
    radialStretch: 0.72,
    tangentialStretch: 1.45,
    spreadMultiplier: 1,
    spacingMultiplier: 1.02,
    angularJitterRad: 0.12,
    facingMode: 'tangent',
  },
  encrusting: {
    footprintShape: 'carpet',
    radialStretch: 1.2,
    tangentialStretch: 1.15,
    spreadMultiplier: 0.88,
    spacingMultiplier: 0.72,
    angularJitterRad: 0.24,
    facingMode: 'mixed',
  },
  'soft-coral': {
    footprintShape: 'grove',
    radialStretch: 1.08,
    tangentialStretch: 1.32,
    spreadMultiplier: 1,
    spacingMultiplier: 1.14,
    angularJitterRad: 0.32,
    facingMode: 'mixed',
  },
  'sea-fan': {
    footprintShape: 'fan',
    radialStretch: 0.5,
    tangentialStretch: 1.7,
    spreadMultiplier: 0.96,
    spacingMultiplier: 1.08,
    angularJitterRad: 0.1,
    facingMode: 'tangent',
  },
};

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeAngle(value: number): number {
  return ((value % TAU) + TAU) % TAU;
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

export function reefColonyShapeProfile(
  morphotype: ReefColonyMorphotype,
): ReefColonyShapeProfile {
  return MORPHOTYPE_SHAPES[morphotype];
}

function tierForBand(radialBand: number, radialBandCount: number): ReefColonyHabitatTier {
  const count = Math.max(1, radialBandCount);
  const share = (Math.max(0, radialBand) + 0.5) / count;
  if (share < 0.25) return 'crown';
  if (share < 0.5) return 'upper';
  if (share < 0.75) return 'middle';
  return 'lower';
}

function tierRadiusRatio(tier: ReefColonyHabitatTier): number {
  switch (tier) {
    case 'crown': return 0.18;
    case 'upper': return 0.4;
    case 'middle': return 0.62;
    case 'lower': return 0.87;
  }
}

function fallbackRadialBand(
  colony: ReefLivingCanopyColony,
  foundationRadius: number,
  radialBandCount: number,
): number {
  if (foundationRadius <= 1e-6) return 0;
  const radialShare = Math.min(
    0.999999,
    Math.hypot(colony.request.preferred.x, colony.request.preferred.z) / foundationRadius,
  );
  return Math.min(
    Math.max(0, radialBandCount - 1),
    Math.floor(radialShare * Math.max(1, radialBandCount)),
  );
}

function dominantMorphotype(members: readonly HabitatMember[]): ReefColonyMorphotype {
  const counts = new Map<ReefColonyMorphotype, number>();
  for (const member of members) {
    counts.set(member.colony.morphotype, (counts.get(member.colony.morphotype) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0]?.[0]
    ?? members[0]?.colony.morphotype
    ?? 'branching';
}

function habitatMaturity(members: readonly HabitatMember[]): number {
  if (members.length === 0) return 0;
  const weighted = members.reduce((total, member, index) => {
    const ageWeight = 1 + Math.max(0, members.length - index - 1) * 0.08;
    return total + clamp01(member.colony.maturity) * ageWeight;
  }, 0);
  const weights = members.reduce(
    (total, _member, index) => total + 1 + Math.max(0, members.length - index - 1) * 0.08,
    0,
  );
  return round6(clamp01(weighted / Math.max(1e-6, weights)));
}

function growthStage(memberIndex: number): ReefColonyGrowthStage {
  if (memberIndex === 0) return 'core';
  if (memberIndex <= 3) return 'inner';
  return 'frontier';
}

/**
 * Distance is append-only: it depends on chronological member index, never on
 * final member count. Shape-specific spacing changes colony density without
 * moving any established recruit when a later coral appears.
 */
function memberGrowthDistance({
  memberIndex,
  foundationRadius,
  firstFootprint,
  spreadRadius,
  spacingMultiplier,
}: {
  memberIndex: number;
  foundationRadius: number;
  firstFootprint: number;
  spreadRadius: number;
  spacingMultiplier: number;
}): number {
  if (memberIndex <= 0) return 0;
  const baseStep = Math.max(
    foundationRadius * 0.028,
    Math.min(foundationRadius * 0.052, firstFootprint * 1.18),
  );
  return round6(Math.min(
    spreadRadius,
    baseStep * spacingMultiplier * Math.sqrt(memberIndex) * 1.06,
  ));
}

/**
 * Stretches the spiral direction inside the habitat's radial/tangential frame,
 * then renormalizes it. Distance therefore stays chronological and append-only,
 * while the point cloud becomes a compact mound, plate, carpet, grove or fan.
 */
function shapedOffset({
  memberAngle,
  hubAngle,
  distance,
  profile,
}: {
  memberAngle: number;
  hubAngle: number;
  distance: number;
  profile: ReefColonyShapeProfile;
}): { x: number; z: number; angle: number } {
  if (distance <= 1e-9) return { x: 0, z: 0, angle: hubAngle };

  const relative = memberAngle - hubAngle;
  let radial = Math.cos(relative) * profile.radialStretch;
  let tangential = Math.sin(relative) * profile.tangentialStretch;
  const magnitude = Math.hypot(radial, tangential);
  if (magnitude <= 1e-9) {
    radial = 1;
    tangential = 0;
  } else {
    radial /= magnitude;
    tangential /= magnitude;
  }

  const radialX = Math.cos(hubAngle);
  const radialZ = Math.sin(hubAngle);
  const tangentX = -radialZ;
  const tangentZ = radialX;
  const x = (radialX * radial + tangentX * tangential) * distance;
  const z = (radialZ * radial + tangentZ * tangential) * distance;

  return {
    x,
    z,
    angle: Math.atan2(z, x),
  };
}

function shapeFacing({
  colony,
  profile,
  hubAngle,
  offsetAngle,
  tangentialSide,
}: {
  colony: ReefLivingCanopyColony;
  profile: ReefColonyShapeProfile;
  hubAngle: number;
  offsetAngle: number;
  tangentialSide: number;
}): number {
  const jitter = (stableUnit(colony.seed, 'habitat-facing') - 0.5)
    * (profile.facingMode === 'mixed' ? 0.52 : 0.28);

  switch (profile.facingMode) {
    case 'outward':
      return normalizeAngle(offsetAngle + jitter);
    case 'tangent':
      return normalizeAngle(
        hubAngle + (tangentialSide < 0 ? -Math.PI * 0.5 : Math.PI * 0.5) + jitter,
      );
    case 'mixed':
      return normalizeAngle(
        colony.facingRad
          + jitter
          + Math.sin(offsetAngle - hubAngle) * 0.14,
      );
  }
}

/**
 * Builds one stable ecological habitat per source growth instruction.
 *
 * V3 keeps the chronological core -> inner -> frontier growth from V2, but the
 * physical footprint now depends on the dominant coral morphotype. Branching
 * and massive colonies form compact clusters, plating corals widen along the
 * terrace tangent, encrusting forms make dense carpets, soft corals form looser
 * groves and sea fans organize into narrow fan-like belts. All deformation is
 * seed-stable and index-stable, so future recruits extend rather than reshuffle
 * established coral.
 */
export function buildReefColonyHabitatPlan(
  sourcePlan: ReefLivingCanopyPlan,
  build: ReefPreviewBuild,
): ReefColonyHabitatPlan {
  const foundationRadius = Math.max(0.8, build.structures.visibleFoundationRadius);
  const radialBandCount = Math.max(1, build.species.grammar.radialBandCount);
  const identitySeed = build.species.moduleEvolution.identitySeed;
  const layoutById = new Map(
    build.layout.colonies.map((colony) => [colony.id, colony] as const),
  );
  const instructionById = new Map(
    build.species.growth.map((instruction) => [instruction.id, instruction] as const),
  );
  const groups = new Map<string, HabitatMember[]>();

  for (const colony of sourcePlan.colonies) {
    const layout = layoutById.get(colony.sourceColonyId);
    const sourceInstructionId = layout?.sourceInstructionId
      ?? `renderer:${colony.sourceColonyId}`;
    const instruction = instructionById.get(sourceInstructionId);
    const radialBand = instruction?.radialBand
      ?? layout?.radialBand
      ?? fallbackRadialBand(colony, foundationRadius, radialBandCount);
    const preferredAzimuthRad = instruction?.preferredAzimuthRad
      ?? layout?.azimuthRad
      ?? Math.atan2(colony.request.preferred.z, colony.request.preferred.x);
    const members = groups.get(sourceInstructionId) ?? [];
    members.push({
      colony,
      sourceInstructionId,
      radialBand,
      preferredAzimuthRad,
    });
    groups.set(sourceInstructionId, members);
  }

  const habitats: ReefColonyHabitatSummary[] = [];
  const renderByColonyId = new Map<string, HabitatRenderMember>();

  for (const [sourceInstructionId, unorderedMembers] of groups) {
    const members = [...unorderedMembers].sort((left, right) => (
      left.colony.request.sequence - right.colony.request.sequence
      || left.colony.sourceColonyId.localeCompare(right.colony.sourceColonyId)
    ));
    const first = members[0];
    if (!first) continue;

    const morphotype = dominantMorphotype(members);
    const shapeProfile = reefColonyShapeProfile(morphotype);
    const tier = tierForBand(first.radialBand, radialBandCount);
    const baseRadiusRatio = tierRadiusRatio(tier);
    const radialVariation = 0.96
      + stableUnit(identitySeed, `${sourceInstructionId}:habitat-radius`) * 0.08;
    const hubRadius = foundationRadius * baseRadiusRatio * radialVariation;
    const angleJitter = (
      stableUnit(identitySeed, `${sourceInstructionId}:habitat-angle`) - 0.5
    ) * 0.32;
    const hubAngle = first.preferredAzimuthRad + angleJitter;
    const center = {
      x: round6(Math.cos(hubAngle) * hubRadius),
      z: round6(Math.sin(hubAngle) * hubRadius),
    };
    const maximumFootprint = Math.max(
      0.06,
      ...members.map((member) => member.colony.request.footprintRadius),
    );
    const firstFootprint = Math.max(0.06, first.colony.request.footprintRadius);
    const baseSpreadRadius = Math.min(
      foundationRadius * 0.13,
      Math.max(foundationRadius * 0.055, maximumFootprint * 2.55),
    );
    const spreadRadius = round6(Math.min(
      foundationRadius * 0.14,
      baseSpreadRadius * shapeProfile.spreadMultiplier,
    ));
    const memberPhase = stableUnit(
      identitySeed,
      `${sourceInstructionId}:member-phase`,
    ) * TAU;
    const growth: ReefColonyHabitatMemberGrowth[] = [];
    let activeRadius = 0;

    members.forEach((member, memberIndex) => {
      const distance = memberGrowthDistance({
        memberIndex,
        foundationRadius,
        firstFootprint,
        spreadRadius,
        spacingMultiplier: shapeProfile.spacingMultiplier,
      });
      const memberAngle = memberPhase
        + memberIndex * GOLDEN_ANGLE
        + (stableUnit(member.colony.seed, 'habitat-member-angle') - 0.5)
          * shapeProfile.angularJitterRad;
      const offset = shapedOffset({
        memberAngle,
        hubAngle,
        distance,
        profile: shapeProfile,
      });
      const relative = offset.angle - hubAngle;
      const facingRad = shapeFacing({
        colony: member.colony,
        profile: shapeProfile,
        hubAngle,
        offsetAngle: memberIndex === 0 ? hubAngle : offset.angle,
        tangentialSide: Math.sin(relative),
      });
      activeRadius = Math.max(activeRadius, distance);

      renderByColonyId.set(member.colony.sourceColonyId, {
        request: {
          ...member.colony.request,
          preferred: {
            x: round6(center.x + offset.x),
            y: member.colony.request.preferred.y,
            z: round6(center.z + offset.z),
          },
        },
        facingRad,
      });
      growth.push({
        colonyId: member.colony.sourceColonyId,
        sequence: member.colony.request.sequence,
        stage: growthStage(memberIndex),
        distanceFromCenter: distance,
        distanceRatio: spreadRadius <= 1e-6 ? 0 : round6(distance / spreadRadius),
      });
    });

    habitats.push({
      id: `reef:colony-habitat:${sourceInstructionId}`,
      sourceInstructionId,
      dominantMorphotype: morphotype,
      tier,
      center,
      spreadRadius,
      activeRadius: round6(activeRadius),
      maturity: habitatMaturity(members),
      shapeProfile,
      memberColonyIds: members.map((member) => member.colony.sourceColonyId),
      growth,
    });
  }

  const sequenceByColonyId = new Map(
    sourcePlan.colonies.map((colony) => [colony.sourceColonyId, colony.request.sequence] as const),
  );
  habitats.sort((left, right) => {
    const leftSequence = Math.min(
      ...left.memberColonyIds.map((id) => sequenceByColonyId.get(id) ?? Number.MAX_SAFE_INTEGER),
    );
    const rightSequence = Math.min(
      ...right.memberColonyIds.map((id) => sequenceByColonyId.get(id) ?? Number.MAX_SAFE_INTEGER),
    );
    return leftSequence - rightSequence || left.id.localeCompare(right.id);
  });

  const colonies = sourcePlan.colonies.map((colony) => {
    const render = renderByColonyId.get(colony.sourceColonyId);
    return render
      ? { ...colony, request: render.request, facingRad: render.facingRad }
      : colony;
  });

  return {
    version: REEF_COLONY_HABITAT_VERSION,
    plan: {
      ...sourcePlan,
      colonies,
      requests: colonies.map((colony) => colony.request),
    },
    habitats,
  };
}
