import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildCrystalSpeciesBlueprint } from './crystalSpecies';
import { crystalToGrowthBlueprint } from './growthAdapter';

const AS_OF = '2026-07-29T09:00:00Z';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'proposal',
    occurredAt: '2024-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 1, stability: 0.7 },
    portalActivity: 0.4,
  },
  {
    id: 'trip',
    occurredAt: '2024-08-10T12:00:00Z',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.86, remembrance: 0.28 },
    portalActivity: 0.26,
  },
  {
    id: 'photo',
    occurredAt: '2025-01-05T14:00:00Z',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.62 },
    portalActivity: 0.12,
  },
];

function growthBlueprint(events: readonly EvolutionEventInput[] = EVENTS) {
  const artifact = buildArtifactBlueprint({
    coupleId: 'growth-center-adapter-test',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
  const crystal = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: AS_OF, rulesVersion: '1.0.0' },
  });
  return crystalToGrowthBlueprint(crystal);
}

describe('Crystal Growth Center adapter', () => {
  it('expands each stable formation into one dominant and local supporting members', () => {
    const blueprint = growthBlueprint();
    const centers = blueprint.growthCenters ?? [];
    const instructionById = new Map(
      blueprint.instructions.map((instruction) => [instruction.id, instruction] as const),
    );

    expect(blueprint.sourceBlueprintVersion).toBe('crystal:1:growth-centers@1');
    expect(centers).toHaveLength(EVENTS.length);
    expect(blueprint.colonies.map((colony) => colony.id)).toEqual(
      centers.map((center) => center.id),
    );

    for (const center of centers) {
      expect(center.instructionIds.length).toBeGreaterThanOrEqual(4);
      expect(center.instructionIds.length).toBeLessThanOrEqual(6);
      expect(center.instructionIds[0]).toBe(center.sourceInstructionId);

      const members = center.instructionIds.map((id) => instructionById.get(id)!);
      const dominant = members.filter((member) => member.growthCenterRole === 'dominant');
      const local = members.filter((member) => member.growthCenterRole !== 'dominant');

      expect(dominant).toHaveLength(1);
      expect(dominant[0]?.id).toBe(center.sourceInstructionId);
      expect(local.length).toBeGreaterThanOrEqual(3);
      expect(local.every((member) => member.colonyId === center.id)).toBe(true);
      expect(local.every((member) => member.hostPreference === 'same-colony')).toBe(true);
      expect(local.every((member) => member.axialScale < dominant[0]!.axialScale)).toBe(true);
      expect(local.every((member) => member.radialScale < dominant[0]!.radialScale)).toBe(true);
    }
  });

  it('keeps all existing center and member instructions stable after a later event', () => {
    const earlier = growthBlueprint();
    const later = growthBlueprint([
      ...EVENTS,
      {
        id: 'later-wish',
        occurredAt: '2026-05-20T12:00:00Z',
        source: 'wishlist@1',
        evidence: 'verified',
        channels: { achievement: 0.9, significance: 0.58 },
        portalActivity: 0.24,
      },
    ]);

    for (const oldInstruction of earlier.instructions) {
      expect(later.instructions.find((instruction) => instruction.id === oldInstruction.id)).toEqual(
        oldInstruction,
      );
    }
    for (const oldCenter of earlier.growthCenters ?? []) {
      expect(later.growthCenters?.find((center) => center.id === oldCenter.id)).toEqual(oldCenter);
    }
  });

  it('reserves a fixed sequence stride so later centers cannot reorder old members', () => {
    const blueprint = growthBlueprint();
    const centers = blueprint.growthCenters ?? [];
    const instructionById = new Map(
      blueprint.instructions.map((instruction) => [instruction.id, instruction] as const),
    );

    centers.forEach((center, centerIndex) => {
      const sequences = center.instructionIds.map((id) => instructionById.get(id)!.sequence);
      expect(sequences[0]).toBe(centerIndex * 8);
      expect(Math.max(...sequences)).toBeLessThan(centerIndex * 8 + 8);
    });
  });
});
