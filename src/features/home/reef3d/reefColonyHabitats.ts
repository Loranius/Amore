import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import type {
  ReefLivingCanopyColony,
  ReefLivingCanopyPlan,
} from './reefLivingCanopy';

export const REEF_COLONY_HABITAT_VERSION = 'reef-colony-habitats-v1';

const TAU = Math.PI * 2;

export type ReefColonyHabitatTier = 'crown' | 'upper' | 'middle' | 'lower';

export interface ReefColonyHabitatSummary {
  id: string;
  sourceInstructionId: string;
  dominantMorphotype: ReefColonyMorphotype;
  tier: ReefColonyHabitatTier;
  center: { x: number; z: number };
  spreadRadius: number;
  memberColonyIds: string[];
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

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
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

/**
 * Replaces the old four global morphotype hotspots with stable ecological
 * colony habitats. Every source growth instruction owns one deterministic
 * centre on a broad limestone terrace, while recruits from that instruction
 * stay grouped around the centre as one visually coherent colony patch.
 *
 * The logical layout, chronological request ids and collision-safe allocator
 * remain untouched. Only renderer preferred anchors change.
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
  const requestByColonyId = new Map<string, ReefLivingCanopyColony['request']>();

  for (const [sourceInstructionId, unorderedMembers] of groups) {
    const members = [...unorderedMembers].sort((left, right) => (
      left.colony.request.sequence - right.colony.request.sequence
      || left.colony.sourceColonyId.localeCompare(right.colony.sourceColonyId)
    ));
    const first = members[0];
    if (!first) continue;

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
    const spreadRadius = round6(Math.min(
      foundationRadius * 0.115,
      Math.max(foundationRadius * 0.045, maximumFootprint * 2.25),
    ));
    const memberPhase = stableUnit(
      identitySeed,
      `${sourceInstructionId}:member-phase`,
    ) * TAU;

    members.forEach((member, memberIndex) => {
      let offsetX = 0;
      let offsetZ = 0;
      if (memberIndex > 0) {
        const zeroIndex = memberIndex - 1;
        const ring = Math.floor(zeroIndex / 6) + 1;
        const slot = zeroIndex % 6;
        const memberAngle = memberPhase
          + slot / 6 * TAU
          + (stableUnit(member.colony.seed, 'habitat-member-angle') - 0.5) * 0.18;
        const targetDistance = maximumFootprint * (1.15 + (ring - 1) * 0.72)
          + spreadRadius * 0.16;
        const distance = Math.min(spreadRadius, targetDistance);
        offsetX = Math.cos(memberAngle) * distance;
        offsetZ = Math.sin(memberAngle) * distance;
      }

      requestByColonyId.set(member.colony.sourceColonyId, {
        ...member.colony.request,
        preferred: {
          x: round6(center.x + offsetX),
          y: member.colony.request.preferred.y,
          z: round6(center.z + offsetZ),
        },
      });
    });

    habitats.push({
      id: `reef:colony-habitat:${sourceInstructionId}`,
      sourceInstructionId,
      dominantMorphotype: dominantMorphotype(members),
      tier,
      center,
      spreadRadius,
      memberColonyIds: members.map((member) => member.colony.sourceColonyId),
    });
  }

  habitats.sort((left, right) => {
    const leftSequence = Math.min(
      ...left.memberColonyIds.map((id) => (
        sourcePlan.colonies.find((colony) => colony.sourceColonyId === id)?.request.sequence
        ?? Number.MAX_SAFE_INTEGER
      )),
    );
    const rightSequence = Math.min(
      ...right.memberColonyIds.map((id) => (
        sourcePlan.colonies.find((colony) => colony.sourceColonyId === id)?.request.sequence
        ?? Number.MAX_SAFE_INTEGER
      )),
    );
    return leftSequence - rightSequence || left.id.localeCompare(right.id);
  });

  const colonies = sourcePlan.colonies.map((colony) => ({
    ...colony,
    request: requestByColonyId.get(colony.sourceColonyId) ?? colony.request,
  }));

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
