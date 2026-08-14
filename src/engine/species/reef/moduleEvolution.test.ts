import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildReefModuleEvolution } from './moduleEvolution';

const MODULE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'calendar:1:origin',
    occurredAt: '2023-02-14',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.8 },
  },
  {
    id: 'plan:1:completed',
    occurredAt: '2023-06-10',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.8 },
  },
  {
    id: 'wish:1:fulfilled',
    occurredAt: '2023-07-01',
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { significance: 0.6 },
  },
  {
    id: 'memory:1:preserved',
    occurredAt: '2023-08-01',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.5 },
  },
  {
    id: 'media:1:finished',
    occurredAt: '2023-09-01',
    source: 'media@1',
    evidence: 'historical-estimate',
    channels: { culture: 0.4 },
  },
  {
    id: 'place:1:visited',
    occurredAt: '2023-10-01',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.7 },
  },
  {
    id: 'shopping:ignored',
    occurredAt: '2023-11-01',
    source: 'shopping@1',
    evidence: 'verified',
    channels: { stability: 1 },
  },
];

function artifact(events: readonly EvolutionEventInput[] = MODULE_EVENTS) {
  return buildArtifactBlueprint({
    coupleId: 'amore:reef-module-evolution',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2022-12-26',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
}

function build(events: readonly EvolutionEventInput[] = MODULE_EVENTS, ageDays = 1_326) {
  return buildReefModuleEvolution({
    artifact: artifact(events),
    asOfEpochMs: Date.parse('2026-08-13T21:00:00.000Z'),
    ageDays,
    completedYears: 3,
    sharedDaysOff: [
      { date: '2024-01-04', epochIndex: 2 },
      { date: '2024-01-18', epochIndex: 2 },
      { date: '2024-03-12', epochIndex: 2 },
    ],
  });
}

describe('Reef module evolution plan', () => {
  it('maps each accepted module to one explicit reef meaning', () => {
    const evolution = build();

    expect(evolution.version).toBe('reef-module-evolution-v1');
    expect(evolution.facts).toEqual({
      daysTogether: 1_326,
      completedYears: 3,
      completedPlans: 1,
      completedWishes: 1,
      photoCount: 1,
      finishedMediaCount: 1,
      visitedPlaceCount: 1,
      calendarLandmarkCount: 1,
      sharedDaysOffCount: 3,
      sharedDaysOffMonthCount: 2,
    });
    expect(evolution.entities.yearArches.map((item) => item.sourceKey)).toEqual(['1', '2', '3']);
    expect(evolution.entities.planFish.map((item) => item.sourceEventId))
      .toEqual(['plan:1:completed']);
    expect(evolution.entities.wishCorals.map((item) => item.sourceEventId))
      .toEqual(['wish:1:fulfilled']);
    expect(evolution.entities.photoCorals.map((item) => item.sourceEventId))
      .toEqual(['memory:1:preserved']);
    expect(evolution.entities.mediaCorals.map((item) => item.sourceEventId))
      .toEqual(['media:1:finished']);
    expect(evolution.entities.mapOutcrops.map((item) => item.sourceEventId))
      .toEqual(['place:1:visited']);
    expect(evolution.entities.calendarLandmarks.map((item) => item.sourceEventId))
      .toEqual(['calendar:1:origin']);
    expect(evolution.entities.scheduleTerraces.map((item) => item.sourceKey))
      .toEqual(['2024-01', '2024-03']);
    expect(JSON.stringify(evolution)).not.toContain('shopping:ignored');
  });

  it('grows chronological surface area linearly with days and derives radius from area', () => {
    const earlier = build(MODULE_EVENTS, 900);
    const later = build(MODULE_EVENTS, 1_300);
    const expectedAreaGain = later.foundation.dailySurfaceAreaGain * 400;

    expect(later.foundation.chronologicalSurfaceArea
      - earlier.foundation.chronologicalSurfaceArea).toBeCloseTo(expectedAreaGain, 5);
    expect(later.foundation.substrateRadius).toBeGreaterThan(earlier.foundation.substrateRadius);
    expect(later.foundation.outerGrowthRadius).toBeGreaterThan(later.foundation.substrateRadius);
  });

  it('keeps existing visual identities stable when later history is appended', () => {
    const before = build(MODULE_EVENTS);
    const after = build([
      ...MODULE_EVENTS,
      {
        id: 'wish:2:fulfilled',
        occurredAt: '2025-04-03',
        source: 'wishlist@1',
        evidence: 'verified',
        channels: { significance: 0.5 },
      },
    ]);

    expect(after.entities.wishCorals[0]).toEqual(before.entities.wishCorals[0]);
    expect(after.entities.yearArches).toEqual(before.entities.yearArches);
    expect(after.entities.wishCorals).toHaveLength(2);
  });

  it('preserves exact lifetime counts while bounding simultaneous mobile populations', () => {
    const planEvents: EvolutionEventInput[] = Array.from({ length: 31 }, (_value, index) => ({
      id: `plan:${index}:completed`,
      occurredAt: '2024-01-01',
      source: 'plans@1',
      evidence: 'verified',
      channels: { achievement: 0.4 },
    }));
    const photoEvents: EvolutionEventInput[] = Array.from({ length: 121 }, (_value, index) => ({
      id: `memory:${index}:preserved`,
      occurredAt: '2024-02-01',
      source: 'memories@1',
      evidence: 'verified',
      channels: { remembrance: 0.2 },
    }));
    const evolution = build([...planEvents, ...photoEvents]);

    expect(evolution.life.planFish).toEqual({
      logicalCount: 31,
      visibleCount: 24,
      overflowCount: 7,
    });
    expect(evolution.colonies.microPhotoCorals).toEqual({
      logicalCount: 121,
      visibleCount: 96,
      overflowCount: 25,
    });
    expect(evolution.entities.planFish).toHaveLength(31);
    expect(evolution.entities.photoCorals).toHaveLength(121);
  });
});
