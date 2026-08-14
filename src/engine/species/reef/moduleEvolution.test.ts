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
    channels: { achievement: 0.5, significance: 0.6 },
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

function build(
  events: readonly EvolutionEventInput[] = MODULE_EVENTS,
  options: {
    ageDays?: number;
    completedYears?: number;
    sharedDaysOff?: { date: string; epochIndex: number }[];
    asOf?: string;
  } = {},
) {
  return buildReefModuleEvolution({
    artifact: artifact(events),
    asOfEpochMs: Date.parse(options.asOf ?? '2026-08-13T21:00:00.000Z'),
    ageDays: options.ageDays ?? 1_326,
    completedYears: options.completedYears ?? 3,
    sharedDaysOff: options.sharedDaysOff ?? [
      { date: '2024-01-04', epochIndex: 1 },
      { date: '2024-01-18', epochIndex: 1 },
      { date: '2024-03-12', epochIndex: 1 },
    ],
  });
}

function event(
  id: string,
  source: string,
  occurredAt: string,
  channels: EvolutionEventInput['channels'],
): EvolutionEventInput {
  return {
    id,
    source,
    occurredAt,
    evidence: 'verified',
    channels,
  };
}

describe('Reef ecological module evolution', () => {
  it('is deterministic and ignores modules outside the reef allow-list', () => {
    const first = build();
    const second = build();

    expect(second).toEqual(first);
    expect(JSON.stringify(first)).not.toContain('shopping:ignored');
  });

  it('keeps exact facts while translating them into ecological meanings', () => {
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
    expect(evolution.development.annualZones).toHaveLength(4);
    expect(evolution.development.fishPopulation.map((item) => item.sourceEventId))
      .toEqual(['plan:1:completed']);
    expect(evolution.development.hardCorals.map((item) => item.sourceEventId))
      .toEqual(['wish:1:fulfilled']);
    expect(evolution.development.colonizationPatches).toHaveLength(1);
    expect(evolution.development.colonizationPatches[0]?.photoCount).toBe(1);
    expect(evolution.development.softLifePools).toHaveLength(1);
    expect(evolution.development.softLifePools[0]?.itemCount).toBe(1);
    expect(evolution.entities.scheduleTerraces).toEqual([]);
    expect(evolution.foundation.scheduleTerraces.logicalCount).toBe(0);
  });

  it('lets time grow habitat scale while map exploration only expands horizontal reach', () => {
    const earlier = build([], { ageDays: 900 });
    const later = build([], { ageDays: 1_300 });
    const noMap = build(MODULE_EVENTS.filter((item) => !item.source.startsWith('map@')));
    const withMap = build(MODULE_EVENTS);
    const expectedAreaGain = later.foundation.dailySurfaceAreaGain * 400;

    expect(later.foundation.chronologicalSurfaceArea
      - earlier.foundation.chronologicalSurfaceArea).toBeCloseTo(expectedAreaGain, 5);
    expect(later.foundation.substrateRadius).toBeGreaterThan(earlier.foundation.substrateRadius);
    expect(withMap.foundation.substrateRadius).toBe(noMap.foundation.substrateRadius);
    expect(withMap.development.ecology.foundationSpread)
      .toBeGreaterThan(noMap.development.ecology.foundationSpread);
    expect(withMap.development.ecology.habitatCapacity)
      .toBeGreaterThan(noMap.development.ecology.habitatCapacity);
  });

  it('opens one growth zone per relationship year and grows the current year in 12 steps', () => {
    const evolution = build([], { ageDays: 1_146, completedYears: 3 });
    const current = evolution.development.annualZones.at(-1);

    expect(evolution.development.annualZones).toHaveLength(4);
    expect(evolution.development.annualZones.slice(0, 3).every((zone) => (
      zone.complete && zone.progress === 1 && zone.growthStage === 12
    ))).toBe(true);
    expect(current?.complete).toBe(false);
    expect(current?.growthStage).toBeGreaterThanOrEqual(1);
    expect(current?.growthStage).toBeLessThanOrEqual(12);
    expect((current?.progress ?? 0) * 12).toBeCloseTo(current?.growthStage ?? 0, 5);
  });

  it('uses module breadth for biodiversity so many photos alone do not beat varied life', () => {
    const manyPhotos = Array.from({ length: 60 }, (_value, index) => event(
      `memory:${index}`,
      'memories@1',
      '2023-06-01',
      { remembrance: 0.2 },
    ));
    const varied = [
      event('calendar:v', 'calendar@1', '2023-02-01', { significance: 0.5 }),
      event('plan:v', 'plans@1', '2023-03-01', { achievement: 0.5 }),
      event('wish:v', 'wishlist@1', '2023-04-01', { significance: 0.5 }),
      event('map:v', 'map@1', '2023-05-01', { exploration: 0.5 }),
      event('memory:v', 'memories@1', '2023-06-01', { remembrance: 0.5 }),
      event('media:v', 'media@1', '2023-07-01', { culture: 0.5 }),
    ];

    const photoZone = build(manyPhotos).development.annualZones[0];
    const variedZone = build(varied).development.annualZones[0];

    expect(variedZone?.moduleCount).toBe(6);
    expect(photoZone?.moduleCount).toBe(1);
    expect(variedZone?.biodiversity ?? 0).toBeGreaterThan(photoZone?.biodiversity ?? 0);
  });

  it('clusters high-volume photos and media instead of creating one visible body per row', () => {
    const photos = Array.from({ length: 121 }, (_value, index) => event(
      `memory:${index}`,
      'memories@1',
      '2024-02-01',
      { remembrance: 0.2 },
    ));
    const media = Array.from({ length: 55 }, (_value, index) => event(
      `media:${index}`,
      'media@1',
      '2024-03-01',
      { culture: 0.2 },
    ));
    const evolution = build([...photos, ...media]);

    expect(evolution.colonies.microPhotoCorals.logicalCount).toBe(121);
    expect(evolution.colonies.microPhotoCorals.visibleCount).toBe(1);
    expect(evolution.entities.photoCorals).toHaveLength(1);
    expect(evolution.development.colonizationPatches[0]?.photoCount).toBe(121);
    expect(evolution.colonies.mediaCorals.logicalCount).toBe(55);
    expect(evolution.colonies.mediaCorals.visibleCount).toBe(1);
    expect(evolution.entities.mediaCorals).toHaveLength(1);
    expect(evolution.development.softLifePools[0]?.unlockedArchetypes)
      .toContain('feather-colony');
  });

  it('keeps one persistent fish identity per completed plan but bounds simultaneous rendering', () => {
    const plans = Array.from({ length: 31 }, (_value, index) => event(
      `plan:${index}:completed`,
      'plans@1',
      '2024-01-01',
      { achievement: 0.4 },
    ));
    const evolution = build(plans);

    expect(evolution.development.fishPopulation).toHaveLength(31);
    expect(evolution.life.planFish.logicalCount).toBe(31);
    expect(evolution.life.planFish.visibleCount).toBeLessThanOrEqual(24);
    expect(evolution.life.planFish.overflowCount).toBeGreaterThan(0);
  });

  it('keeps wish importance independent from age while old fulfilled wishes mature', () => {
    const oldWish = event('wish:old', 'wishlist@1', '2023-01-10', {
      achievement: 0.5,
      significance: 0.6,
    });
    const newerWish = event('wish:new', 'wishlist@1', '2026-07-10', {
      achievement: 0.5,
      significance: 0.6,
    });
    const evolution = build([oldWish, newerWish]);
    const oldCoral = evolution.development.hardCorals.find((item) => item.sourceEventId === 'wish:old');
    const newCoral = evolution.development.hardCorals.find((item) => item.sourceEventId === 'wish:new');

    expect(oldCoral?.importance).toBe(newCoral?.importance);
    expect(oldCoral?.maturity ?? 0).toBeGreaterThan(newCoral?.maturity ?? 0);
    expect(oldCoral?.growth ?? 0).toBeGreaterThan(newCoral?.growth ?? 0);
  });

  it('uses shared days off as additive cohesion without spawning schedule structures', () => {
    const withoutSchedule = build([], { sharedDaysOff: [] });
    const sixtyDays = Array.from({ length: 60 }, (_value, index) => ({
      date: `2023-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String(index % 28 + 1).padStart(2, '0')}`,
      epochIndex: 0,
    }));
    const withSchedule = build([], { sharedDaysOff: sixtyDays });
    const before = withoutSchedule.development.annualZones[0];
    const after = withSchedule.development.annualZones[0];

    expect(after?.togetherness).toBe(1);
    expect(after?.cohesion ?? 0).toBeGreaterThan(before?.cohesion ?? 0);
    expect(after?.fill ?? 0).toBeGreaterThan(before?.fill ?? 0);
    expect(withSchedule.entities.scheduleTerraces).toEqual([]);
    expect(withSchedule.foundation.scheduleTerraces).toEqual({
      logicalCount: 0,
      visibleCount: 0,
      overflowCount: 0,
    });
  });

  it('backfills historical life into an old zone without changing its chronology', () => {
    const before = build([]);
    const after = build([
      event('memory:historical', 'memories@1', '2023-05-10', { remembrance: 0.5 }),
    ]);
    const oldBefore = before.development.annualZones[0];
    const oldAfter = after.development.annualZones[0];

    expect(oldBefore?.progress).toBe(1);
    expect(oldAfter?.progress).toBe(1);
    expect(oldAfter?.colonization ?? 0).toBeGreaterThan(oldBefore?.colonization ?? 0);
    expect(oldAfter?.usedCapacity ?? 0).toBeGreaterThan(oldBefore?.usedCapacity ?? 0);
  });

  it('marks anniversaries inside their annual zone and distinguishes milestones', () => {
    const regular = build([
      event('calendar:regular', 'calendar@1', '2023-02-14', { significance: 0.36 }),
    ]);
    const milestone = build([
      event('calendar:milestone', 'calendar@1', '2023-02-14', { significance: 1 }),
    ]);

    expect(regular.development.annualZones[0]?.anniversaryCount).toBe(1);
    expect(regular.development.annualZones[0]?.milestone).toBe(false);
    expect(milestone.development.annualZones[0]?.milestone).toBe(true);
  });

  it('keeps existing persistent identities stable when later history is appended', () => {
    const before = build(MODULE_EVENTS);
    const after = build([
      ...MODULE_EVENTS,
      event('wish:2:fulfilled', 'wishlist@1', '2025-04-03', { significance: 0.5 }),
    ]);

    expect(after.entities.wishCorals[0]).toEqual(before.entities.wishCorals[0]);
    expect(after.development.hardCorals[0]).toEqual(before.development.hardCorals[0]);
    expect(after.entities.wishCorals).toHaveLength(2);
  });
});
