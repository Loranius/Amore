import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '@/engine/evolution';
import { buildReefPreviewFromArtifact } from './buildReefPreview';
import { buildReefLivingCanopyPlan } from './reefLivingCanopy';
import {
  buildReefColonyHabitatPlan,
  REEF_COLONY_HABITAT_VERSION,
  type ReefColonyHabitatTier,
} from './reefColonyHabitats';

const EVENTS: EvolutionEventInput[] = [
  ...Array.from({ length: 8 }, (_value, index): EvolutionEventInput => ({
    id: `wish:habitat:${index}`,
    occurredAt: `2024-${String(3 + (index % 6)).padStart(2, '0')}-12`,
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { achievement: 0.52, significance: 0.34, remembrance: 0.12 },
    portalActivity: 0.22,
  })),
  ...Array.from({ length: 5 }, (_value, index): EvolutionEventInput => ({
    id: `memory:habitat:${index}`,
    occurredAt: `2025-${String(2 + index).padStart(2, '0')}-18`,
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.72, significance: 0.18 },
    portalActivity: 0.16,
  })),
  {
    id: 'calendar:habitat:landmark',
    occurredAt: '2025-09-21',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.94, remembrance: 0.54 },
    portalActivity: 0.28,
  },
];

function buildFixture() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:reef-colony-habitat-test',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  return buildReefPreviewFromArtifact({ artifact, asOf: '2026-07-31' });
}

function expectedRatioRange(tier: ReefColonyHabitatTier): readonly [number, number] {
  switch (tier) {
    case 'crown': return [0.16, 0.2];
    case 'upper': return [0.36, 0.44];
    case 'middle': return [0.57, 0.67];
    case 'lower': return [0.8, 0.92];
  }
}

describe('reef colony habitats', () => {
  it('creates one stable dominant-morphotype habitat per growth instruction', () => {
    const build = buildFixture();
    const sourcePlan = buildReefLivingCanopyPlan(build);
    const result = buildReefColonyHabitatPlan(sourcePlan, build);
    const sourceInstructionIds = new Set(
      build.layout.colonies.map((colony) => colony.sourceInstructionId),
    );

    expect(result.version).toBe(REEF_COLONY_HABITAT_VERSION);
    expect(result.habitats).toHaveLength(sourceInstructionIds.size);

    for (const habitat of result.habitats) {
      const sourceColonies = build.layout.colonies.filter(
        (colony) => colony.sourceInstructionId === habitat.sourceInstructionId,
      );
      expect(sourceColonies.length).toBeGreaterThan(0);
      expect(new Set(sourceColonies.map((colony) => colony.morphotype)).size).toBe(1);
      expect(habitat.dominantMorphotype).toBe(sourceColonies[0]?.morphotype);
      expect([...habitat.memberColonyIds].sort())
        .toEqual(sourceColonies.map((colony) => colony.id).sort());
      expect(habitat.maturity).toBeGreaterThanOrEqual(0);
      expect(habitat.maturity).toBeLessThanOrEqual(1);
      expect(habitat.activeRadius).toBeLessThanOrEqual(habitat.spreadRadius + 1e-6);
    }
  });

  it('places habitat centres on broad crown, upper, middle or lower terrace bands', () => {
    const build = buildFixture();
    const sourcePlan = buildReefLivingCanopyPlan(build);
    const result = buildReefColonyHabitatPlan(sourcePlan, build);
    const radius = build.structures.visibleFoundationRadius;
    const requestBySourceColonyId = new Map(
      result.plan.colonies.map((colony) => [colony.sourceColonyId, colony.request] as const),
    );

    for (const habitat of result.habitats) {
      const radialRatio = Math.hypot(habitat.center.x, habitat.center.z) / radius;
      const [minimum, maximum] = expectedRatioRange(habitat.tier);
      expect(radialRatio).toBeGreaterThanOrEqual(minimum);
      expect(radialRatio).toBeLessThanOrEqual(maximum);

      for (const memberId of habitat.memberColonyIds) {
        const request = requestBySourceColonyId.get(memberId);
        expect(request).toBeDefined();
        const distance = Math.hypot(
          (request?.preferred.x ?? 0) - habitat.center.x,
          (request?.preferred.z ?? 0) - habitat.center.z,
        );
        expect(distance).toBeLessThanOrEqual(habitat.spreadRadius + 1e-5);
      }
    }
  });

  it('grows chronologically from an old core toward a deterministic perimeter', () => {
    const build = buildFixture();
    const sourcePlan = buildReefLivingCanopyPlan(build);
    const result = buildReefColonyHabitatPlan(sourcePlan, build);
    const habitat = result.habitats.find((candidate) => candidate.growth.length >= 2);

    expect(habitat).toBeDefined();
    if (!habitat) return;

    expect(habitat.growth[0]?.stage).toBe('core');
    expect(habitat.growth[0]?.distanceFromCenter).toBe(0);

    for (let index = 1; index < habitat.growth.length; index += 1) {
      const previous = habitat.growth[index - 1]!;
      const current = habitat.growth[index]!;
      expect(current.sequence).toBeGreaterThanOrEqual(previous.sequence);
      expect(current.distanceFromCenter + 1e-6)
        .toBeGreaterThanOrEqual(previous.distanceFromCenter);
      expect(current.distanceRatio).toBeGreaterThanOrEqual(0);
      expect(current.distanceRatio).toBeLessThanOrEqual(1);
    }

    if (habitat.growth.length >= 5) {
      expect(habitat.growth.at(-1)?.stage).toBe('frontier');
    }
  });

  it('keeps established members fixed when the newest recruit is removed', () => {
    const build = buildFixture();
    const sourcePlan = buildReefLivingCanopyPlan(build);
    const full = buildReefColonyHabitatPlan(sourcePlan, build);
    const habitat = full.habitats.find((candidate) => candidate.memberColonyIds.length >= 2);

    expect(habitat).toBeDefined();
    if (!habitat) return;

    const removedId = habitat.memberColonyIds.at(-1)!;
    const trimmedColonies = sourcePlan.colonies.filter(
      (colony) => colony.sourceColonyId !== removedId,
    );
    const trimmed = buildReefColonyHabitatPlan({
      ...sourcePlan,
      colonies: trimmedColonies,
      requests: trimmedColonies.map((colony) => colony.request),
    }, build);
    const trimmedHabitat = trimmed.habitats.find(
      (candidate) => candidate.sourceInstructionId === habitat.sourceInstructionId,
    );

    expect(trimmedHabitat).toBeDefined();
    expect(trimmedHabitat?.center).toEqual(habitat.center);

    const fullById = new Map(
      full.plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
    );
    const trimmedById = new Map(
      trimmed.plan.colonies.map((colony) => [colony.sourceColonyId, colony] as const),
    );
    for (const memberId of habitat.memberColonyIds.slice(0, -1)) {
      expect(trimmedById.get(memberId)?.request.preferred)
        .toEqual(fullById.get(memberId)?.request.preferred);
      expect(trimmedById.get(memberId)?.facingRad)
        .toEqual(fullById.get(memberId)?.facingRad);
    }
  });

  it('does not move habitat centres when canopy input order changes', () => {
    const build = buildFixture();
    const sourcePlan = buildReefLivingCanopyPlan(build);
    const first = buildReefColonyHabitatPlan(sourcePlan, build);
    const reversed = buildReefColonyHabitatPlan({
      ...sourcePlan,
      colonies: [...sourcePlan.colonies].reverse(),
      requests: [...sourcePlan.requests].reverse(),
    }, build);

    expect(reversed.habitats).toEqual(first.habitats);
  });
});
