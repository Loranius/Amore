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
  it('gives each event exactly one crystal and nothing growing on it', () => {
    // ADR-0003: a centre used to publish 3-5 local members attached to its
    // dominant, which put growths on the sides of crystals and pushed a
    // typical couple to ~38 bodies. Each event is now one free-standing
    // crystal.
    const growth = blueprint([BASE_EVENT]);
    const centers = growth.growthCenters ?? [];
    const byId = new Map(growth.instructions.map((item) => [item.id, item] as const));

    expect(growth.sourceBlueprintVersion).toBe('crystal:1:growth-centers@2');
    expect(centers).toHaveLength(1);

    for (const center of centers) {
      const members = center.instructionIds.map((id) => byId.get(id)!);
      expect(members).toHaveLength(1);

      const dominant = members[0]!;
      expect(dominant.growthCenterRole).toBe('dominant');
      expect(dominant.id).toBe(center.sourceInstructionId);
      expect(dominant.hostPreference).toBe('root');
      expect(dominant.maxGeneration).toBe(1);
    }

    // One crystal per event, plus the monarch as the blueprint root.
    expect(growth.instructions).toHaveLength(1);
    expect(growth.root.growthCenterRole ?? null).toBeNull();
  });

  it('does not change old center instructions when a later event is appended', () => {
    const earlier = blueprint([BASE_EVENT]);
    const later = blueprint([
      BASE_EVENT,
      {
        ...BASE_EVENT,
        id: 'memory-2',
        occurredAt: '2026-05-20T12:00:00Z',
      },
    ]);

    for (const oldInstruction of earlier.instructions) {
      expect(later.instructions.find((item) => item.id === oldInstruction.id)).toEqual(oldInstruction);
    }
  });

  it('gives event-spires a real outward lean instead of growing parallel to the mother', () => {
    // Cluster-composition fix (visual QA, 2026-08-02): a dominant instruction
    // that is almost fully vertical (elevation close to 1) and barely
    // inherits the host surface normal (low directionInheritance) ends up
    // visually hugging the mother's own shaft instead of reading as its own
    // radiating crystal. Both levers must move together for the fix to
    // actually manifest -- see growthDirection() in growth/surface.ts, which
    // blends preferredElevation and directionInheritance before clamping to
    // minUpwardComponent.
    const growth = blueprint([BASE_EVENT]);
    const dominants = growth.instructions.filter(
      (item) => item.growthCenterRole === 'dominant',
    );
    expect(dominants.length).toBeGreaterThan(0);

    for (const dominant of dominants) {
      // elevation=1 is fully vertical; staying well under 1 leaves real
      // room for the surface normal to pull the direction outward.
      expect(dominant.preferredElevation).toBeLessThan(0.8);
      // Below ~0.4 the preferred direction (which ignores the anchor's
      // actual position on the host) would dominate over the true outward
      // surface normal, undoing the fix.
      expect(dominant.directionInheritance).toBeGreaterThanOrEqual(0.4);
    }
  });
});
