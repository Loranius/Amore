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
  it('keeps every large center dominant on the monarch and local members on their center', () => {
    const growth = blueprint([BASE_EVENT]);
    const centers = growth.growthCenters ?? [];
    const byId = new Map(growth.instructions.map((item) => [item.id, item] as const));

    expect(growth.sourceBlueprintVersion).toBe('crystal:1:growth-centers@2');
    expect(centers).toHaveLength(1);

    for (const center of centers) {
      const members = center.instructionIds.map((id) => byId.get(id)!);
      const dominant = members.find((member) => member.growthCenterRole === 'dominant')!;
      const local = members.filter((member) => member.growthCenterRole !== 'dominant');

      expect(dominant.id).toBe(center.sourceInstructionId);
      expect(dominant.hostPreference).toBe('root');
      expect(dominant.maxGeneration).toBe(1);
      expect(local.length).toBeGreaterThanOrEqual(2);
      expect(local.every((member) => member.hostPreference === 'same-colony')).toBe(true);
      expect(local.every((member) => member.axialScale < dominant.axialScale)).toBe(true);
    }
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
});
