import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildCrystalSpeciesBlueprint } from './crystalSpecies';
import type { CrystalSpeciesConfig } from './types';

// ADR-0017. The work schedule is not an event source: a shared day off is a
// fact about the couple's calendar, not something they recorded in a module,
// so it reaches Volume II as config and feeds exactly one thing — how full a
// year's crystal is. These tests hold the bucketing, which is the part that
// can silently be wrong: dates are compared as strings against relationship
// year boundaries, and a day in the wrong year is invisible on screen.

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'calendar:first',
    occurredAt: '2023-04-10T12:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.6, remembrance: 0.4 },
    portalActivity: 0.2,
  },
  {
    id: 'plan:trip',
    occurredAt: '2024-05-02T12:00:00Z',
    source: 'plans@1',
    evidence: 'verified',
    channels: { exploration: 0.8, remembrance: 0.3 },
    portalActivity: 0.3,
  },
];

function daysIn(year: number, month: number, count: number): string[] {
  return Array.from({ length: count }, (_, index) => (
    `${year}-${String(month).padStart(2, '0')}-${String(index + 1).padStart(2, '0')}`
  ));
}

function yearAxial(config: Partial<CrystalSpeciesConfig>, id: string): number {
  const artifact = buildArtifactBlueprint({
    coupleId: 'amore:schedule-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2023-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  const species = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2025-06-01T00:00:00Z', rulesVersion: '1.0.0', ...config },
  });
  const body = species.formations.find((formation) => formation.id === id);
  if (!body) throw new Error(`No formation ${id}`);
  return body.axialScale;
}

describe('shared days off feed a year crystal (ADR-0017)', () => {
  it('grows the year that had the days off, and only that year', () => {
    const none = {
      'crystal:year:1': yearAxial({}, 'crystal:year:1'),
      'crystal:year:2': yearAxial({}, 'crystal:year:2'),
    };

    // Twenty-eight shared days off inside relationship year 2 only
    // (2024-01-01 … 2024-12-31).
    const withDaysOff = {
      sharedDaysOff: [...daysIn(2024, 3, 14), ...daysIn(2024, 9, 14)],
    };

    expect(yearAxial(withDaysOff, 'crystal:year:2'))
      .toBeGreaterThan(none['crystal:year:2']);
    // Year 1 has none of those days, so it must not move — in either
    // direction. This is the assertion that caught the first version of the
    // formula, which blended togetherness in and so *shrank* a year the moment
    // the schedule started covering it with nothing to show.
    expect(yearAxial(withDaysOff, 'crystal:year:1'))
      .toBe(none['crystal:year:1']);
  });

  it('leaves every year alone when the schedule covers nothing', () => {
    // The default path, and the one every couple who has never opened the
    // schedule is on. Silence must be silence, not zero.
    for (const id of ['crystal:year:1', 'crystal:year:2', 'crystal:year:3']) {
      expect(yearAxial({ sharedDaysOff: [] }, id)).toBe(yearAxial({}, id));
    }
  });

  it('ignores days outside the relationship years entirely', () => {
    // Dates before the couple began, and dates in the future, are both real
    // things a schedule table holds. Neither may reach a crystal.
    const stray = { sharedDaysOff: [...daysIn(2021, 5, 20), ...daysIn(2030, 5, 20)] };
    for (const id of ['crystal:year:1', 'crystal:year:2']) {
      expect(yearAxial(stray, id)).toBe(yearAxial({}, id));
    }
  });
});
