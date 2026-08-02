import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildCrystalSpeciesBlueprint } from './crystalSpecies';
import { crystalToGrowthBlueprint } from './growthAdapter';

const BASE_EVENT: EvolutionEventInput = {
  id: 'memory-1',
  occurredAt: '2025-01-05T14:00:00Z',
  source: 'memories@1',
  evidence: 'verified',
  channels: { remembrance: 0.8, significance: 0.4 },
  portalActivity: 0.2,
};

function blueprint(events: readonly EvolutionEventInput[]) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'crystal-basal-growth-test',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  return crystalToGrowthBlueprint(buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-29T09:00:00Z', rulesVersion: '1.0.0' },
  }));
}

describe('Crystal Growth Center adapter', () => {
  it('gives each formation exactly one crystal and nothing growing on it', () => {
    // ADR-0003: a centre used to publish 3-5 local members attached to its
    // dominant, which put growths on the sides of crystals and pushed a
    // typical couple to ~38 bodies. A formation is now one free-standing
    // crystal — and since ADR-0004 a formation is a year or a finished plan,
    // not a portal row.
    const growth = blueprint([BASE_EVENT]);
    const centers = growth.growthCenters ?? [];
    const byId = new Map(growth.instructions.map((item) => [item.id, item] as const));

    expect(growth.sourceBlueprintVersion).toBe('crystal:1:growth-centers@2');
    // Three relationship years between 2024-02-14 and the 2026-07-29 clock,
    // and one crystal for each of them — the count follows the calendar, not
    // the single event this fixture logs (ADR-0004).
    expect(centers).toHaveLength(3);

    for (const center of centers) {
      const members = center.instructionIds.map((id) => byId.get(id)!);
      expect(members).toHaveLength(1);

      const dominant = members[0]!;
      expect(dominant.growthCenterRole).toBe('dominant');
      expect(dominant.id).toBe(center.sourceInstructionId);
      expect(dominant.hostPreference).toBe('root');
      expect(dominant.maxGeneration).toBe(1);
    }

    // One crystal per formation, plus the monarch as the blueprint root.
    expect(growth.instructions).toHaveLength(3);
    expect(growth.root.growthCenterRole ?? null).toBeNull();
  });

  it('does not change a closed year when a later event is appended', () => {
    const earlier = blueprint([BASE_EVENT]);
    const later = blueprint([
      BASE_EVENT,
      {
        ...BASE_EVENT,
        id: 'memory-2',
        occurredAt: '2026-05-20T12:00:00Z',
      },
    ]);

    // A closed year stops filling: nothing dated outside it may raise its
    // share (ADR-0004). Its absolute size still tracks the monarch, so the
    // comparison is on `weight` — the fill — not on the whole instruction.
    // The year in progress is excluded: filling with new activity is its job.
    const closed = earlier.instructions.filter((item) => item.maturity === 1);
    expect(closed.length).toBeGreaterThan(0);
    for (const oldInstruction of closed) {
      const next = later.instructions.find((item) => item.id === oldInstruction.id)!;
      expect(next.weight).toBe(oldInstruction.weight);
      expect(next.preferredAzimuthRad).toBe(oldInstruction.preferredAzimuthRad);
    }
  });

  it('stands each year at the distance its own history earned', () => {
    // Replaces a test about event-spires leaning away from the mother. That
    // lean existed because companions grew out of her shaft; since ADR-0003
    // they stand in the ground, and since ADR-0004 their distance is stated
    // outright rather than derived from the monarch's girth — which used to
    // mean thickening her shifted the whole druse.
    const growth = blueprint([BASE_EVENT]);
    const dominants = growth.instructions.filter(
      (item) => item.growthCenterRole === 'dominant',
    );
    expect(dominants.length).toBeGreaterThan(0);

    for (const dominant of dominants) {
      // A stated distance, not an inherited one.
      expect(dominant.ringDistance).not.toBeNull();
      expect(dominant.ringDistance!).toBeGreaterThan(0);
      // Clear of the monarch's own footprint by more than her radius.
      expect(dominant.ringDistance!).toBeGreaterThan(growth.root.radialScale);
      // Standing in the ground, so it grows upward rather than out of a host.
      expect(dominant.minUpwardComponent).toBeGreaterThan(0.5);
    }
  });
});
