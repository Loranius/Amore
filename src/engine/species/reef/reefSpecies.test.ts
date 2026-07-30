import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildReefSpeciesBlueprint } from './reefSpecies';
import { REEF_COLONY_MORPHOTYPES } from './types';

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
    id: 'achievement:home',
    occurredAt: '2024-05-18',
    source: 'plans@1',
    evidence: 'verified',
    channels: { achievement: 0.86, stability: 0.22 },
    portalActivity: 0.2,
  },
  {
    id: 'memory:first-album',
    occurredAt: '2024-07-02',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.88, culture: 0.16 },
    portalActivity: 0.28,
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
    id: 'culture:concert',
    occurredAt: '2024-10-12',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { culture: 0.9, significance: 0.6 },
    portalActivity: 0.25,
  },
  {
    id: 'shopping:2025-01-06',
    occurredAt: '2025-01-06',
    source: 'shopping@1',
    evidence: 'verified',
    channels: { stability: 0.3 },
    portalActivity: 0.02,
  },
];

function buildArtifact(events: readonly EvolutionEventInput[] = BASE_EVENTS) {
  return buildArtifactBlueprint({
    coupleId: 'amore:reef-test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
}

function buildReef(
  events: readonly EvolutionEventInput[] = BASE_EVENTS,
  asOf = '2026-07-01',
) {
  return buildReefSpeciesBlueprint({
    artifact: buildArtifact(events),
    config: { asOf, rulesVersion: 'reef-species-v1.0.0' },
  });
}

function withoutMaturity<T extends { maturity: number }>(value: T): Omit<T, 'maturity'> {
  const { maturity: _maturity, ...stable } = value;
  return stable;
}

describe('Reef Species Phase 1', () => {
  it('is deterministic regardless of source event order', () => {
    expect(buildReef([...BASE_EVENTS].reverse())).toEqual(buildReef());
  });

  it('publishes a renderer-independent reef grammar and stable colony intent', () => {
    const reef = buildReef();
    const eventMorphotypes = reef.growth
      .filter((instruction) => instruction.sourceEventId !== null)
      .map((instruction) => `${instruction.sourceEventId}:${instruction.morphotype}:${instruction.role}`);

    expect(reef.species).toBe('reef');
    expect(reef.speciesBlueprintVersion).toBe(1);
    expect(reef.grammar).toMatchObject({
      id: 'reef:growth-grammar',
      radialBandCount: 5,
      verticalBandCount: 4,
      annualRecruitmentCount: 2,
      maximumAcceptedColonies: 144,
    });
    expect(reef.grammar.morphotypeOrder).toEqual([
      'encrusting',
      'massive',
      'branching',
      'plating',
      'soft-coral',
      'sea-fan',
    ]);
    expect(eventMorphotypes).toEqual([
      'calendar:proposal:massive:landmark',
      'achievement:home:branching:framework',
      'memory:first-album:massive:memory',
      'place:lviv:plating:frontier',
      'culture:concert:sea-fan:landmark',
      'shopping:2025-01-06:encrusting:foundation',
    ]);
    expect(reef.diagnostics.annualInstructionCount).toBe(2);
    expect(reef.diagnostics.eventInstructionCount).toBe(BASE_EVENTS.length);
    expect(reef.diagnostics.colonyBudgetExceeded).toBe(false);
  });

  it('keeps existing colony intent byte-stable when later history is appended', () => {
    const base = buildReef(BASE_EVENTS.slice(0, 4));
    const extended = buildReef([
      ...BASE_EVENTS.slice(0, 4),
      {
        id: 'memory:summer',
        occurredAt: '2026-06-20',
        source: 'memories@1',
        evidence: 'verified',
        channels: { remembrance: 0.45 },
        portalActivity: 0.12,
      },
    ]);

    const existingIds = new Set(base.growth.map((instruction) => instruction.id));
    expect(extended.growth.filter((instruction) => existingIds.has(instruction.id))).toEqual(base.growth);
    expect(extended.structure).toEqual(base.structure);
    expect(extended.grammar).toEqual(base.grammar);
  });

  it('lets time add annual recruitment and maturity without moving old morphology', () => {
    const earlier = buildReef(BASE_EVENTS, '2025-07-01');
    const later = buildReef(BASE_EVENTS, '2026-07-01');

    expect(later.structure).toEqual(earlier.structure);
    expect(later.grammar).toEqual(earlier.grammar);
    expect(earlier.diagnostics.annualInstructionCount).toBe(1);
    expect(later.diagnostics.annualInstructionCount).toBe(2);

    for (const before of earlier.growth) {
      const after = later.growth.find((instruction) => instruction.id === before.id);
      expect(after).toBeDefined();
      expect(withoutMaturity(after!)).toEqual(withoutMaturity(before));
      expect(after!.maturity).toBeGreaterThanOrEqual(before.maturity);
    }
  });

  it('diagnoses future and zero-pressure facts without publishing colonies from them', () => {
    const reef = buildReef([
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

    expect(reef.diagnostics.futureEventIds).toEqual(['future:trip']);
    expect(reef.diagnostics.zeroPressureEventIds).toEqual(['activity-only']);
    expect(reef.growth.some((instruction) => instruction.sourceEventId === 'future:trip')).toBe(false);
    expect(reef.growth.some((instruction) => instruction.sourceEventId === 'activity-only')).toBe(false);
    expect(reef.state.eventCount).toBe(BASE_EVENTS.length + 1);
  });

  it('keeps every published grammar value bounded and uses only accepted morphotypes', () => {
    const reef = buildReef();
    const acceptedMorphotypes = new Set(REEF_COLONY_MORPHOTYPES);

    expect(reef.structure.shelfCount).toBeGreaterThanOrEqual(3);
    expect(reef.structure.shelfCount).toBeLessThanOrEqual(5);
    expect(reef.structure.currentDirectionRad).toBeGreaterThanOrEqual(0);
    expect(reef.structure.currentDirectionRad).toBeLessThan(Math.PI * 2);

    for (const instruction of reef.growth) {
      expect(acceptedMorphotypes.has(instruction.morphotype)).toBe(true);
      expect(instruction.weight).toBeGreaterThanOrEqual(0);
      expect(instruction.weight).toBeLessThanOrEqual(1);
      expect(instruction.maturity).toBeGreaterThanOrEqual(0);
      expect(instruction.maturity).toBeLessThanOrEqual(1);
      expect(instruction.radialBand).toBeGreaterThanOrEqual(0);
      expect(instruction.radialBand).toBeLessThan(reef.grammar.radialBandCount);
      expect(instruction.verticalBand).toBeGreaterThanOrEqual(0);
      expect(instruction.verticalBand).toBeLessThan(reef.grammar.verticalBandCount);
      expect(instruction.footprint).toBeGreaterThanOrEqual(0);
      expect(instruction.footprint).toBeLessThanOrEqual(1);
      expect(instruction.heightBias).toBeGreaterThanOrEqual(0);
      expect(instruction.heightBias).toBeLessThanOrEqual(1);
      expect(instruction.branchingBias).toBeGreaterThanOrEqual(0);
      expect(instruction.branchingBias).toBeLessThanOrEqual(1);
      expect(instruction.recruitCount).toBeGreaterThanOrEqual(1);
      expect(instruction.recruitCount).toBeLessThanOrEqual(3);
    }
  });

  it('does not mutate the accepted Evolution artifact', () => {
    const artifact = buildArtifact();
    const before = structuredClone(artifact);
    buildReefSpeciesBlueprint({
      artifact,
      config: { asOf: '2026-07-01', rulesVersion: 'reef-species-v1.0.0' },
    });
    expect(artifact).toEqual(before);
  });

  it('rejects implicit clocks and empty rules versions', () => {
    const artifact = buildArtifact();
    expect(() => buildReefSpeciesBlueprint({
      artifact,
      config: { asOf: 'not-a-date', rulesVersion: 'reef-species-v1.0.0' },
    })).toThrow('Invalid Reef Species asOf');
    expect(() => buildReefSpeciesBlueprint({
      artifact,
      config: { asOf: '2026-07-01', rulesVersion: '   ' },
    })).toThrow('non-empty rulesVersion');
  });
});
