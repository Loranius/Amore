import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildReefModuleEvolution } from './moduleEvolution';
import { buildReefGrowthStructureLayout } from './structureGrowth';

function evolution(extraEvents: readonly EvolutionEventInput[] = []) {
  const mapEvents: EvolutionEventInput[] = Array.from({ length: 8 }, (_value, index) => ({
    id: `place:${index}:visited`,
    occurredAt: `2024-${String(index + 1).padStart(2, '0')}-02`,
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.5 },
  }));
  const artifact = buildArtifactBlueprint({
    coupleId: 'reef:structure-growth',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2022-12-26',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: [...mapEvents, ...extraEvents],
  });
  return buildReefModuleEvolution({
    artifact,
    asOfEpochMs: Date.parse('2026-08-14T00:00:00.000Z'),
    ageDays: 1_327,
    completedYears: 3,
    sharedDaysOff: Array.from({ length: 9 }, (_value, index) => ({
      date: `2024-${String(index + 1).padStart(2, '0')}-10`,
      epochIndex: 2,
    })),
  });
}

describe('Reef growth structure layout', () => {
  it('creates one visible arch per completed year and collision-safe module structures', () => {
    const layout = buildReefGrowthStructureLayout(evolution());

    expect(layout.version).toBe('reef-growth-structure-layout-v1');
    expect(layout.arches).toHaveLength(3);
    expect(layout.outcrops).toHaveLength(8);
    expect(layout.terraces).toHaveLength(9);
    expect(layout.arches.map((arch) => arch.yearIndex)).toEqual([1, 2, 3]);
    expect(layout.diagnostics).toMatchObject({
      rejectedArchIds: [],
      rejectedOutcropIds: [],
      rejectedTerraceIds: [],
      collisionFree: true,
    });
    expect(layout.diagnostics.minimumExternalClearance).toBeGreaterThanOrEqual(0);
  });

  it('is deterministic and keeps prior structure identities when later facts append', () => {
    const before = buildReefGrowthStructureLayout(evolution());
    const after = buildReefGrowthStructureLayout(evolution([{
      id: 'place:later:visited',
      occurredAt: '2026-07-01',
      source: 'map@1',
      evidence: 'verified',
      channels: { exploration: 0.5 },
    }]));

    expect(buildReefGrowthStructureLayout(evolution())).toEqual(before);
    expect(after.outcrops.slice(0, before.outcrops.length)).toEqual(before.outcrops);
    expect(after.outcrops).toHaveLength(before.outcrops.length + 1);
  });
});
