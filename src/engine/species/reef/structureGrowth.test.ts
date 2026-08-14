import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildReefModuleEvolution } from './moduleEvolution';
import { buildReefGrowthStructureLayout } from './structureGrowth';

function evolution(
  extraEvents: readonly EvolutionEventInput[] = [],
  sharedDaysOff: { date: string; epochIndex: number }[] = Array.from(
    { length: 9 },
    (_value, index) => ({
      date: `2024-${String(index + 1).padStart(2, '0')}-10`,
      epochIndex: 1,
    }),
  ),
) {
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
    sharedDaysOff,
  });
}

describe('Reef growth structure layout', () => {
  it('turns annual growth zones into varied structures instead of one arch per year', () => {
    const source = evolution();
    const layout = buildReefGrowthStructureLayout(source);
    const annualStructures = [...layout.arches, ...layout.terraces];

    expect(layout.version).toBe('reef-growth-structure-layout-v1');
    expect(annualStructures).toHaveLength(
      source.development.annualZones.filter((zone) => zone.progress > 0).length,
    );
    expect(annualStructures.map((item) => item.yearIndex ?? 0).sort((a, b) => a - b))
      .toEqual(source.development.annualZones.filter((zone) => zone.progress > 0).map((zone) => zone.yearIndex));
    expect(layout.arches.length).toBeLessThan(source.development.annualZones.length);
    expect(layout.terraces.some((item) => item.archetype === 'core')).toBe(true);
    expect(layout.diagnostics.rejectedArchIds).toEqual([]);
    expect(layout.diagnostics.rejectedTerraceIds).toEqual([]);
  });

  it('clusters visited places into bounded satellite habitat instead of one slab per place', () => {
    const source = evolution();
    const layout = buildReefGrowthStructureLayout(source);

    expect(source.facts.visitedPlaceCount).toBe(8);
    expect(source.entities.mapOutcrops).toHaveLength(2);
    expect(layout.outcrops).toHaveLength(2);
    expect(layout.diagnostics.rejectedOutcropIds).toEqual([]);
    expect(layout.diagnostics.minimumExternalClearance).toBeGreaterThanOrEqual(0);
  });

  it('does not render Schedule terraces; shared days off only alter annual cohesion', () => {
    const withoutSchedule = evolution([], []);
    const withSchedule = evolution();
    const withoutLayout = buildReefGrowthStructureLayout(withoutSchedule);
    const withLayout = buildReefGrowthStructureLayout(withSchedule);

    expect(withSchedule.entities.scheduleTerraces.length)
      .toBe(withSchedule.facts.sharedDaysOffMonthCount);
    expect(withSchedule.foundation.scheduleTerraces.visibleCount).toBe(0);
    expect(withLayout.arches.length + withLayout.terraces.length)
      .toBe(withoutLayout.arches.length + withoutLayout.terraces.length);
    expect(withSchedule.development.annualZones[1]?.cohesion ?? 0)
      .toBeGreaterThan(withoutSchedule.development.annualZones[1]?.cohesion ?? 0);
  });

  it('is deterministic and keeps existing clustered exploration identities when later facts append', () => {
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
    expect(after.outcrops.length).toBeGreaterThanOrEqual(before.outcrops.length);
  });
});
