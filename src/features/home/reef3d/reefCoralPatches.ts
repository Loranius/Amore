import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import type {
  ReefLivingCanopyColony,
  ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import {
  reefColonyShapeProfile,
  type ReefColonyGrowthStage,
  type ReefColonyHabitatPlan,
  type ReefColonyHabitatSummary,
  type ReefColonyHabitatTier,
} from './reefColonyHabitats';

export const REEF_CORAL_PATCH_VERSION = 'reef-coral-patches-v2-tier-density';

const TAU = Math.PI * 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const MORPHOTYPES: readonly ReefColonyMorphotype[] = [
  'branching',
  'massive',
  'plating',
  'encrusting',
  'soft-coral',
  'sea-fan',
];

export interface ReefCoralPatchPlan extends ReefColonyHabitatPlan {
  patchVersion: typeof REEF_CORAL_PATCH_VERSION;
}

interface PatchMember {
  colony: ReefLivingCanopyColony;
  tier: ReefColonyHabitatTier;
  sourceInstructionId: string;
}

function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
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

function normalizeAngle(value: number): number {
  return ((value % TAU) + TAU) % TAU;
}

function patchCapacity(morphotype: ReefColonyMorphotype): number {
  switch (morphotype) {
    case 'branching': return 9;
    case 'massive': return 7;
    case 'plating': return 7;
    case 'encrusting': return 10;
    case 'soft-coral': return 9;
    case 'sea-fan': return 7;
  }
}

function tierRadiusRatio(tier: ReefColonyHabitatTier): number {
  switch (tier) {
    case 'crown': return 0.18;
    case 'upper': return 0.4;
    case 'middle': return 0.63;
    case 'lower': return 0.86;
  }
}

function tierSpreadRatio(tier: ReefColonyHabitatTier): number {
  switch (tier) {
    case 'crown': return 0.07;
    case 'upper': return 0.082;
    case 'middle': return 0.095;
    case 'lower': return 0.105;
  }
}

function tierMemberSpacingScale(tier: ReefColonyHabitatTier): number {
  switch (tier) {
    case 'crown': return 0.92;
    case 'upper': return 0.88;
    case 'middle': return 0.82;
    case 'lower': return 0.86;
  }
}

function habitatMaturity(members: readonly PatchMember[]): number {
  if (members.length === 0) return 0;
  const value = members.reduce((total, member, index) => {
    const chronologyWeight = 1 + Math.max(0, members.length - index - 1) * 0.06;
    return total + clamp01(member.colony.maturity) * chronologyWeight;
  }, 0);
  const weight = members.reduce(
    (total, _member, index) => total + 1 + Math.max(0, members.length - index - 1) * 0.06,
    0,
  );
  return round6(clamp01(value / Math.max(1e-6, weight)));
}

function growthStage(memberIndex: number): ReefColonyGrowthStage {
  if (memberIndex === 0) return 'core';
  if (memberIndex <= 3) return 'inner';
  return 'frontier';
}

function tierForOrphan(
  colony: ReefLivingCanopyColony,
  foundationRadius: number,
): ReefColonyHabitatTier {
  const share = Math.hypot(
    colony.request.preferred.x,
    colony.request.preferred.z,
  ) / Math.max(0.8, foundationRadius);
  if (share < 0.28) return 'crown';
  if (share < 0.52) return 'upper';
  if (share < 0.76) return 'middle';
  return 'lower';
}

function patchCenter({
  identitySeed,
  foundationRadius,
  tier,
  morphotype,
  patchIndex,
}: {
  identitySeed: number;
  foundationRadius: number;
  tier: ReefColonyHabitatTier;
  morphotype: ReefColonyMorphotype;
  patchIndex: number;
}): { x: number; z: number; angle: number } {
  const morphotypeIndex = Math.max(0, MORPHOTYPES.indexOf(morphotype));
  const tierPhase = stableUnit(identitySeed, `reef:coral-patch:${tier}:phase`) * TAU;
  const ordinal = morphotypeIndex + patchIndex * MORPHOTYPES.length;
  const angle = normalizeAngle(
    tierPhase
      + ordinal * GOLDEN_ANGLE
      + (stableUnit(identitySeed, `reef:coral-patch:${tier}:${morphotype}:${patchIndex}:jitter`) - 0.5)
        * 0.22,
  );
  const radialVariation = 0.96
    + stableUnit(identitySeed, `reef:coral-patch:${tier}:${morphotype}:${patchIndex}:radius`) * 0.08;
  const radius = foundationRadius * tierRadiusRatio(tier) * radialVariation;
  return {
    x: round6(Math.cos(angle) * radius),
    z: round6(Math.sin(angle) * radius),
    angle,
  };
}

function shapedOffset({
  colony,
  memberIndex,
  patchAngle,
  foundationRadius,
  tier,
}: {
  colony: ReefLivingCanopyColony;
  memberIndex: number;
  patchAngle: number;
  foundationRadius: number;
  tier: ReefColonyHabitatTier;
}): { x: number; z: number; distance: number; facingRad: number } {
  if (memberIndex === 0) {
    return {
      x: 0,
      z: 0,
      distance: 0,
      facingRad: normalizeAngle(
        patchAngle + (stableUnit(colony.seed, 'reef:patch-core-facing') - 0.5) * 0.34,
      ),
    };
  }

  const profile = reefColonyShapeProfile(colony.morphotype);
  const baseStep = Math.max(
    foundationRadius * 0.026,
    Math.min(foundationRadius * 0.055, colony.footprintRadius * 1.08),
  );
  const maximumDistance = foundationRadius * 0.11 * profile.spreadMultiplier;
  const irregularity = 0.84 + stableUnit(colony.seed, 'reef:patch-distance') * 0.28;
  const distance = Math.min(
    maximumDistance,
    baseStep
      * Math.sqrt(memberIndex)
      * profile.spacingMultiplier
      * tierMemberSpacingScale(tier)
      * irregularity,
  );
  const angle = patchAngle
    + memberIndex * GOLDEN_ANGLE
    + (stableUnit(colony.seed, 'reef:patch-angle') - 0.5) * profile.angularJitterRad * 1.4;
  const relative = angle - patchAngle;
  let radial = Math.cos(relative) * profile.radialStretch;
  let tangential = Math.sin(relative) * profile.tangentialStretch;
  const magnitude = Math.hypot(radial, tangential);
  if (magnitude > 1e-8) {
    radial /= magnitude;
    tangential /= magnitude;
  }

  const radialX = Math.cos(patchAngle);
  const radialZ = Math.sin(patchAngle);
  const tangentX = -radialZ;
  const tangentZ = radialX;
  const x = (radialX * radial + tangentX * tangential) * distance;
  const z = (radialZ * radial + tangentZ * tangential) * distance;
  const offsetAngle = Math.atan2(z, x);
  const yawJitter = (stableUnit(colony.seed, 'reef:patch-facing') - 0.5) * 0.7;
  const facingRad = profile.facingMode === 'tangent'
    ? patchAngle + (tangential < 0 ? -Math.PI * 0.5 : Math.PI * 0.5) + yawJitter
    : profile.facingMode === 'outward'
      ? offsetAngle + yawJitter
      : colony.facingRad + yawJitter + Math.sin(relative) * 0.16;

  return {
    x: round6(x),
    z: round6(z),
    distance: round6(distance),
    facingRad: round6(normalizeAngle(facingRad)),
  };
}

function patchSpreadRadius({
  tier,
  morphotype,
  foundationRadius,
}: {
  tier: ReefColonyHabitatTier;
  morphotype: ReefColonyMorphotype;
  foundationRadius: number;
}): number {
  return round6(
    foundationRadius
      * tierSpreadRatio(tier)
      * reefColonyShapeProfile(morphotype).spreadMultiplier,
  );
}

export function buildReefCoralPatchPlan(
  source: ReefColonyHabitatPlan,
  build: ReefPreviewBuild,
): ReefCoralPatchPlan {
  const foundationRadius = Math.max(0.8, build.structures.visibleFoundationRadius);
  const identitySeed = build.species.moduleEvolution.identitySeed;
  const originalHabitatByColonyId = new Map<string, ReefColonyHabitatSummary>();
  for (const habitat of source.habitats) {
    for (const colonyId of habitat.memberColonyIds) {
      originalHabitatByColonyId.set(colonyId, habitat);
    }
  }

  const grouped = new Map<string, PatchMember[]>();
  for (const colony of source.plan.colonies) {
    const original = originalHabitatByColonyId.get(colony.sourceColonyId);
    const tier = original?.tier ?? tierForOrphan(colony, foundationRadius);
    const sourceInstructionId = original?.sourceInstructionId
      ?? `renderer:${colony.sourceColonyId}`;
    const key = `${tier}:${colony.morphotype}`;
    const members = grouped.get(key) ?? [];
    members.push({ colony, tier, sourceInstructionId });
    grouped.set(key, members);
  }

  const renderByColonyId = new Map<string, {
    request: ReefLivingCanopyColony['request'];
    facingRad: number;
  }>();
  const habitats: ReefColonyHabitatSummary[] = [];

  for (const membersForSpecies of grouped.values()) {
    const ordered = [...membersForSpecies].sort((left, right) => (
      left.colony.request.sequence - right.colony.request.sequence
      || left.colony.sourceColonyId.localeCompare(right.colony.sourceColonyId)
    ));
    const first = ordered[0];
    if (!first) continue;
    const capacity = patchCapacity(first.colony.morphotype);

    for (let start = 0; start < ordered.length; start += capacity) {
      const members = ordered.slice(start, start + capacity);
      const patchIndex = Math.floor(start / capacity);
      const morphotype = first.colony.morphotype;
      const tier = first.tier;
      const center = patchCenter({
        identitySeed,
        foundationRadius,
        tier,
        morphotype,
        patchIndex,
      });
      const spreadRadius = patchSpreadRadius({ tier, morphotype, foundationRadius });
      const growth: ReefColonyHabitatSummary['growth'] = [];
      let activeRadius = 0;

      members.forEach((member, memberIndex) => {
        const offset = shapedOffset({
          colony: member.colony,
          memberIndex,
          patchAngle: center.angle,
          foundationRadius,
          tier,
        });
        activeRadius = Math.max(activeRadius, offset.distance);
        renderByColonyId.set(member.colony.sourceColonyId, {
          request: {
            ...member.colony.request,
            preferred: {
              x: round6(center.x + offset.x),
              y: member.colony.request.preferred.y,
              z: round6(center.z + offset.z),
            },
          },
          facingRad: offset.facingRad,
        });
        growth.push({
          colonyId: member.colony.sourceColonyId,
          sequence: member.colony.request.sequence,
          stage: growthStage(memberIndex),
          distanceFromCenter: offset.distance,
          distanceRatio: spreadRadius <= 1e-6
            ? 0
            : round6(Math.min(1, offset.distance / spreadRadius)),
        });
      });

      habitats.push({
        id: `reef:coral-patch:${tier}:${morphotype}:${patchIndex}`,
        sourceInstructionId: members[0]?.sourceInstructionId ?? first.sourceInstructionId,
        dominantMorphotype: morphotype,
        tier,
        center: { x: center.x, z: center.z },
        spreadRadius,
        activeRadius: round6(activeRadius),
        maturity: habitatMaturity(members),
        shapeProfile: reefColonyShapeProfile(morphotype),
        memberColonyIds: members.map((member) => member.colony.sourceColonyId),
        growth,
      });
    }
  }

  const sequenceById = new Map(
    source.plan.colonies.map((colony) => [colony.sourceColonyId, colony.request.sequence] as const),
  );
  habitats.sort((left, right) => {
    const leftSequence = Math.min(
      ...left.memberColonyIds.map((id) => sequenceById.get(id) ?? Number.MAX_SAFE_INTEGER),
    );
    const rightSequence = Math.min(
      ...right.memberColonyIds.map((id) => sequenceById.get(id) ?? Number.MAX_SAFE_INTEGER),
    );
    return leftSequence - rightSequence || left.id.localeCompare(right.id);
  });

  const colonies = source.plan.colonies.map((colony) => {
    const render = renderByColonyId.get(colony.sourceColonyId);
    return render
      ? { ...colony, request: render.request, facingRad: render.facingRad }
      : colony;
  });
  const plan: ReefLivingCanopyPlan = {
    ...source.plan,
    colonies,
    requests: colonies.map((colony) => colony.request),
  };

  return {
    ...source,
    patchVersion: REEF_CORAL_PATCH_VERSION,
    plan,
    habitats,
  };
}
