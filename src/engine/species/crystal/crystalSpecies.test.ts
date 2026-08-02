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

describe('Crystal Species', () => {
  it('is deterministic regardless of source event order', () => {
    const forward = buildCrystal();
    const reversed = buildCrystal([...BASE_EVENTS].reverse());
    expect(reversed).toEqual(forward);
  });

  it('grows one crystal per relationship year, not per portal row', () => {
    // ADR-0004. The four events below used to produce four bodies; the shape
    // of the druse now follows the calendar instead, so the same history
    // yields the two years the couple has lived plus the one finished plan.
    const crystal = buildCrystal();

    expect({
      species: `${crystal.species}@${crystal.speciesBlueprintVersion}`,
      mother: `${crystal.mother.id}:${crystal.mother.kind}:${crystal.mother.tier}`,
      formations: crystal.formations.map(
        (formation) => `${formation.id}:${formation.kind}:${formation.tier}`,
      ),
    }).toMatchInlineSnapshot(`
      {
        "formations": [
          "crystal:year:1:annual:support",
          "crystal:year:2:annual:family",
        ],
        "mother": "crystal:mother:mother:king",
        "species": "crystal@1",
      }
    `);
  });

  it('adds a body only when a year turns, however much the couple logs', () => {
    // The failure this replaces: every new row grew another crystal, so a
    // photo album alone could push the druse past thirty bodies.
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

    expect(extended.formations).toHaveLength(base.formations.length);
    expect(extended.formations.map((formation) => formation.id))
      .toEqual(base.formations.map((formation) => formation.id));
  });

  it('freezes a finished year and keeps growing the current one', () => {
    const early = buildCrystal(BASE_EVENTS, '2025-07-01');
    const later = buildCrystal(BASE_EVENTS, '2025-11-01');

    const frozenId = 'crystal:year:1';
    const frozenEarly = early.formations.find((formation) => formation.id === frozenId)!;
    const frozenLater = later.formations.find((formation) => formation.id === frozenId)!;
    expect(frozenLater.axialScale).toBe(frozenEarly.axialScale);
    expect(frozenLater.maturity).toBe(1);

    const growingId = 'crystal:year:2';
    const growingEarly = early.formations.find((formation) => formation.id === growingId)!;
    const growingLater = later.formations.find((formation) => formation.id === growingId)!;
    expect(growingLater.axialScale).toBeGreaterThan(growingEarly.axialScale);
    expect(growingLater.maturity).toBeGreaterThan(growingEarly.maturity);
  });

  it('lets time mature formations without changing their seeded morphology', () => {
    const earlier = buildCrystal(BASE_EVENTS, '2025-07-01');
    const later = buildCrystal(BASE_EVENTS, '2026-07-01');

    // ADR-0004 changed what "unchanged" means for the monarch. Her height now
    // answers "how long have we been together", so a year passing *must* move
    // it — that is the feature. What still may not drift is her seeded
    // morphology: the same couple keeps the same crystal identity forever.
    expect(later.mother.seed).toBe(earlier.mother.seed);
    expect(later.mother.archetype).toBe(earlier.mother.archetype);
    expect(later.mother.azimuthRad).toBe(earlier.mother.azimuthRad);
    expect(later.mother.facetCount).toBe(earlier.mother.facetCount);
    expect(later.mother.axialScale).toBeGreaterThan(earlier.mother.axialScale);
    expect(later.mother.maturity).toBeGreaterThan(earlier.mother.maturity);

    // A year that has closed is a record: nothing about it may move again.
    const frozen = (crystal: ReturnType<typeof buildCrystal>) =>
      crystal.formations.filter((formation) => formation.maturity === 1 && formation.emphasized);
    for (const before of frozen(earlier)) {
      const after = later.formations.find((formation) => formation.id === before.id);
      expect(after).toEqual(before);
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
    // Since ADR-0004 no event grows its own body, so a pressureless event can
    // no longer be reported as one that failed to grow. What still must hold
    // is that a future fact touches nothing today.
    expect(crystal.formations.some((formation) => formation.sourceEventId === 'future:trip')).toBe(false);
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
