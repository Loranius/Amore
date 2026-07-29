import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { bridgeCrystalSpeciesToLegacyPressures } from '@/features/home/artifact/compat/evolutionV2Bridge';
import { buildCrystalSpeciesBlueprint } from './crystalSpecies';

const BASE_EVENTS: EvolutionEventInput[] = [
  {
    id: 'calendar:proposal',
    episodeId: 'relationship:proposal',
    occurredAt: '2024-02-14T19:00:00+02:00',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 0.95, remembrance: 0.6, stability: 0.45 },
    portalActivity: 0.24,
  },
  {
    id: 'place:lviv',
    occurredAt: '2024-08-10T12:00:00+03:00',
    source: 'map@1',
    evidence: 'verified',
    channels: { exploration: 0.85, remembrance: 0.3, culture: 0.2 },
    portalActivity: 0.32,
  },
  {
    id: 'wish:camera',
    episodeId: 'wish:camera:fulfillment',
    occurredAt: '2025-01-05T14:00:00+02:00',
    source: 'wishlist@1',
    evidence: 'verified',
    channels: { achievement: 0.65, significance: 0.62, stability: 0.16 },
    portalActivity: 0.24,
  },
  {
    id: 'shopping:2025-01-06',
    occurredAt: '2025-01-06',
    source: 'shopping@1',
    evidence: 'verified',
    channels: { stability: 0.08 },
    portalActivity: 0.02,
  },
];

function buildArtifact(events: readonly EvolutionEventInput[] = BASE_EVENTS) {
  return buildArtifactBlueprint({
    coupleId: 'amore:test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
}

function buildCrystal(
  events: readonly EvolutionEventInput[] = BASE_EVENTS,
  asOf = '2025-07-01',
) {
  return buildCrystalSpeciesBlueprint({
    artifact: buildArtifact(events),
    config: { asOf, rulesVersion: 'crystal-1.0.0' },
  });
}

function withoutMaturity<T extends { maturity: number }>(value: T): Omit<T, 'maturity'> {
  const { maturity: _maturity, ...stable } = value;
  return stable;
}

describe('Crystal Species', () => {
  it('is deterministic regardless of source event order', () => {
    const forward = buildCrystal();
    const reversed = buildCrystal([...BASE_EVENTS].reverse());
    expect(reversed).toEqual(forward);
  });

  it('locks the mother, event hierarchy and stable colonies', () => {
    const crystal = buildCrystal();

    expect({
      species: `${crystal.species}@${crystal.speciesBlueprintVersion}`,
      mother: `${crystal.mother.id}:${crystal.mother.kind}:${crystal.mother.tier}`,
      formationKinds: crystal.formations.map(
        (formation) => `${formation.sourceEventId}:${formation.kind}:${formation.tier}`,
      ),
      emphasized: crystal.formations
        .filter((formation) => formation.emphasized)
        .map((formation) => formation.id),
      colonies: crystal.colonies.map((colony) => colony.id),
    }).toMatchInlineSnapshot(`
      {
        "colonies": [
          "crystal:colony:0:exploration",
          "crystal:colony:0:significance",
          "crystal:colony:1:achievement",
          "crystal:colony:1:stability",
        ],
        "emphasized": [
          "crystal:event:calendar:proposal",
        ],
        "formationKinds": [
          "calendar:proposal:event-spire:support",
          "place:lviv:satellite:companion",
          "wish:camera:satellite:companion",
          "shopping:2025-01-06:inclusion:micro",
        ],
        "mother": "crystal:mother:mother:king",
        "species": "crystal@1",
      }
    `);
  });

  it('keeps existing formation identities and directions when a later event is appended', () => {
    const base = buildCrystal(BASE_EVENTS.slice(0, 3));
    const extended = buildCrystal([
      ...BASE_EVENTS.slice(0, 3),
      {
        id: 'memory:summer',
        occurredAt: '2025-06-20',
        source: 'memories@1',
        evidence: 'verified',
        channels: { remembrance: 0.45 },
        portalActivity: 0.12,
      },
    ]);

    const existingIds = new Set(base.formations.map((formation) => formation.id));
    const extendedExisting = extended.formations.filter((formation) => existingIds.has(formation.id));
    expect(extendedExisting).toEqual(base.formations);
  });

  it('lets time mature formations without changing their seeded morphology', () => {
    const earlier = buildCrystal(BASE_EVENTS, '2025-07-01');
    const later = buildCrystal(BASE_EVENTS, '2026-07-01');

    expect(withoutMaturity(later.mother)).toEqual(withoutMaturity(earlier.mother));
    expect(later.mother.maturity).toBeGreaterThan(earlier.mother.maturity);

    for (let index = 0; index < earlier.formations.length; index += 1) {
      const before = earlier.formations[index]!;
      const after = later.formations[index]!;
      expect(withoutMaturity(after)).toEqual(withoutMaturity(before));
      expect(after.maturity).toBeGreaterThanOrEqual(before.maturity);
    }
  });

  it('diagnoses future and zero-pressure facts without growing formations from them', () => {
    const crystal = buildCrystal([
      ...BASE_EVENTS,
      {
        id: 'future:trip',
        occurredAt: '2027-01-01',
        source: 'plans@1',
        evidence: 'verified',
        channels: { exploration: 1 },
      },
      {
        id: 'activity-only',
        occurredAt: '2025-02-01',
        source: 'legacy@1',
        evidence: 'historical-estimate',
        channels: {},
        portalActivity: 0.2,
      },
    ]);

    expect(crystal.diagnostics.futureEventIds).toEqual(['future:trip']);
    expect(crystal.diagnostics.zeroPressureEventIds).toEqual(['activity-only']);
    expect(crystal.formations.some((formation) => formation.sourceEventId === 'future:trip')).toBe(false);
    expect(crystal.formations.some((formation) => formation.sourceEventId === 'activity-only')).toBe(false);
    expect(crystal.state.eventCount).toBe(BASE_EVENTS.length + 1);
  });

  it('projects into the current renderer pressure contract safely', () => {
    const legacy = bridgeCrystalSpeciesToLegacyPressures(buildCrystal());
    const shareTotal = Object.values(legacy.domainShare).reduce((sum, value) => sum + value, 0);

    expect(shareTotal).toBeCloseTo(1, 5);
    expect(legacy.density).toBeGreaterThanOrEqual(1);
    expect(legacy.density).toBeLessThanOrEqual(1.3);
    expect(legacy.dominant).not.toBeNull();
    expect(legacy.surfaceComplexity).toBeGreaterThan(0);
  });
});
