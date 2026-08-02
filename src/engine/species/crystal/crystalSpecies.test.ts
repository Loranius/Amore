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

  it('stops a finished year filling while the current one keeps filling', () => {
    const early = buildCrystal(BASE_EVENTS, '2025-07-01');
    const later = buildCrystal(BASE_EVENTS, '2025-11-01');
    const find = (crystal: typeof early, id: string) =>
      crystal.formations.find((formation) => formation.id === id)!;

    // A closed year's fill — its share of the maximum — no longer moves with
    // time. Its absolute size may still track the monarch, which is what
    // keeps early years legible once a couple fills them in.
    expect(find(later, 'crystal:year:1').weight).toBe(find(early, 'crystal:year:1').weight);
    expect(find(later, 'crystal:year:1').maturity).toBe(1);

    expect(find(later, 'crystal:year:2').weight)
      .toBeGreaterThan(find(early, 'crystal:year:2').weight);
  });

  it('lets a couple fill in a year they had already lived', () => {
    // The owner joined the portal in their third year and wants the first two
    // to answer to content added now. Content dated inside a year belongs to
    // that year whenever it arrives.
    const bare = buildCrystal(BASE_EVENTS, '2026-07-01');
    const backfilled = buildCrystal([
      ...BASE_EVENTS,
      ...Array.from({ length: 8 }, (_unused, index) => ({
        id: `backfilled:${index}`,
        occurredAt: `2024-0${(index % 8) + 1}-12`,
        source: 'memories@1',
        evidence: 'verified' as const,
        channels: { remembrance: 0.5 },
        portalActivity: 0.1,
      })),
    ], '2026-07-01');

    const firstYear = (crystal: typeof bare) =>
      crystal.formations.find((formation) => formation.id === 'crystal:year:1')!;

    expect(firstYear(backfilled).weight).toBeGreaterThan(firstYear(bare).weight);
    expect(firstYear(backfilled).axialScale).toBeGreaterThan(firstYear(bare).axialScale);
    // And it must not add a body: the count still follows the calendar.
    expect(backfilled.formations).toHaveLength(bare.formations.length);
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

    // A closed year stops filling. Its size still follows the monarch, so
    // compare the fill rather than the crystal.
    const closed = earlier.formations.filter((formation) => formation.maturity === 1);
    expect(closed.length).toBeGreaterThan(0);
    for (const before of closed) {
      const after = later.formations.find((formation) => formation.id === before.id)!;
      expect(after.weight).toBe(before.weight);
      expect(after.facetCount).toBe(before.facetCount);
      expect(after.azimuthRad).toBe(before.azimuthRad);
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

describe('Crystal Species annual colour (ADR-0004)', () => {
  const PARTNERS = { first: 1, second: 2 };

  function withGifts(gifts: readonly { subject: number; actor: number; shared?: boolean }[]) {
    return buildCrystalSpeciesBlueprint({
      artifact: buildArtifact([
        ...BASE_EVENTS,
        ...gifts.map((gift, index) => ({
          id: `gift:${index}`,
          occurredAt: '2025-03-1' + String(index % 10),
          source: 'wishlist@1',
          evidence: 'verified' as const,
          channels: { achievement: 0.5, significance: 0.4 },
          portalActivity: 0.2,
          attribution: {
            subjectId: gift.subject,
            actorId: gift.actor,
            shared: gift.shared === true,
          },
        })),
      ]),
      config: { asOf: '2026-07-01', rulesVersion: 'crystal-1.0.0', colorPartners: PARTNERS },
    });
  }

  const secondYear = (crystal: ReturnType<typeof withGifts>) =>
    crystal.formations.find((formation) => formation.id === 'crystal:year:2')!;

  it('leaves a year with no gifts white', () => {
    expect(secondYear(withGifts([])).tintRgb).toEqual([1, 1, 1]);
    expect(secondYear(withGifts([])).iridescence).toBe(0);
  });

  it('tints toward whichever partner was given to', () => {
    const toFirst = secondYear(withGifts(
      Array.from({ length: 6 }, () => ({ subject: 1, actor: 2 })),
    )).tintRgb;
    const toSecond = secondYear(withGifts(
      Array.from({ length: 6 }, () => ({ subject: 2, actor: 1 })),
    )).tintRgb;

    expect(toFirst[0]).toBeGreaterThan(toFirst[2]);
    expect(toSecond[2]).toBeGreaterThan(toSecond[0]);
  });

  it('ignores a wish somebody granted themselves', () => {
    // The colour is about what they gave *each other*.
    const selfGranted = secondYear(withGifts(
      Array.from({ length: 6 }, () => ({ subject: 1, actor: 1 })),
    ));
    expect(selfGranted.tintRgb).toEqual([1, 1, 1]);
  });

  it('rewards a balanced year with iridescence rather than grey', () => {
    const balanced = secondYear(withGifts([
      ...Array.from({ length: 3 }, () => ({ subject: 1, actor: 2 })),
      ...Array.from({ length: 3 }, () => ({ subject: 2, actor: 1 })),
      ...Array.from({ length: 3 }, () => ({ subject: 1, actor: 2, shared: true })),
    ]));
    const lopsided = secondYear(withGifts(
      Array.from({ length: 9 }, () => ({ subject: 1, actor: 2 })),
    ));

    expect(balanced.iridescence).toBeGreaterThan(lopsided.iridescence);
    expect(Math.min(...balanced.tintRgb)).toBeGreaterThan(Math.min(...lopsided.tintRgb));
  });

  it('stays white when the app could not say who is who', () => {
    const uncoloured = buildCrystalSpeciesBlueprint({
      artifact: buildArtifact(BASE_EVENTS),
      config: { asOf: '2026-07-01', rulesVersion: 'crystal-1.0.0' },
    });
    for (const formation of uncoloured.formations) {
      expect(formation.tintRgb).toEqual([1, 1, 1]);
    }
  });
});

describe('Crystal Species monarch dimensions are independent', () => {
  function monarchFor(extra: readonly EvolutionEventInput[]) {
    return buildCrystalSpeciesBlueprint({
      artifact: buildArtifact([...BASE_EVENTS, ...extra]),
      config: { asOf: '2026-07-01', rulesVersion: 'crystal-1.0.0' },
    }).mother;
  }

  const photos = (count: number): EvolutionEventInput[] =>
    Array.from({ length: count }, (_unused, index) => ({
      id: `photo:${index}`,
      occurredAt: `2025-0${(index % 9) + 1}-1${index % 10}`,
      source: 'memories@1',
      evidence: 'verified' as const,
      channels: { remembrance: 0.5 },
      portalActivity: 0.1,
    }));

  const trips = (count: number): EvolutionEventInput[] =>
    Array.from({ length: count }, (_unused, index) => ({
      id: `trip:${index}`,
      occurredAt: `2025-0${(index % 9) + 1}-2${index % 8}`,
      source: 'map@1',
      evidence: 'verified' as const,
      channels: { exploration: 0.7 },
      portalActivity: 0.2,
    }));

  it('does not let photos thicken the monarch — they earn facets instead', () => {
    // The double count this removes: girth used to be a total event count, of
    // which 56 of 104 were photos on real data, and photos already drive
    // facets. One module was deciding two of three dimensions.
    const bare = monarchFor([]);
    const withPhotos = monarchFor(photos(40));

    expect(withPhotos.radialScale).toBe(bare.radialScale);
    expect(withPhotos.facetCount).toBeGreaterThan(bare.facetCount);
  });

  it('lets deliberate acts thicken her without touching her facets', () => {
    const bare = monarchFor([]);
    const withTrips = monarchFor(trips(20));

    expect(withTrips.radialScale).toBeGreaterThan(bare.radialScale);
    expect(withTrips.facetCount).toBe(bare.facetCount);
  });

  it('keeps height answering only to time', () => {
    // Neither kind of activity may make her taller.
    const bare = monarchFor([]);
    expect(monarchFor(photos(40)).axialScale).toBe(bare.axialScale);
    expect(monarchFor(trips(20)).axialScale).toBe(bare.axialScale);
  });
});
