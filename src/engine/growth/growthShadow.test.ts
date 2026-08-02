import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../evolution';
import { buildCrystalSpeciesBlueprint, crystalToGrowthBlueprint } from '../species/crystal';
import { DEFAULT_GROWTH_ENGINE_CONFIG } from './config';
import { buildGrowthState } from './engine';

const EVENTS: EvolutionEventInput[] = [
  {
    id: 'proposal',
    occurredAt: '2024-02-14T18:00:00Z',
    source: 'calendar@1',
    evidence: 'verified',
    channels: { significance: 1, stability: 0.7, remembrance: 0.55 },
    portalActivity: 0.5,
  },
  {
    id: 'first-trip',
    occurredAt: '2024-06-10T10:00:00Z',
    source: 'plans@1',
    evidence: 'verified',
    channels: { exploration: 0.9, remembrance: 0.35 },
    portalActivity: 0.3,
  },
  {
    id: 'photo-day',
    occurredAt: '2024-09-04T12:00:00Z',
    source: 'memories@1',
    evidence: 'verified',
    channels: { remembrance: 0.62, culture: 0.18 },
    portalActivity: 0.16,
  },
];

function buildState() {
  const artifact = buildArtifactBlueprint({
    coupleId: 'growth-shadow-test-couple',
    config: {
      engineVersion: '1.0.0',
      relationshipStartedAt: '2024-02-14',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: EVENTS,
  });
  const crystal = buildCrystalSpeciesBlueprint({
    artifact,
    config: { asOf: '2026-07-29T09:00:00Z', rulesVersion: '1.0.0' },
  });
  return buildGrowthState({
    blueprint: crystalToGrowthBlueprint(crystal),
    config: DEFAULT_GROWTH_ENGINE_CONFIG,
  });
}

describe('Crystal Growth Shadow', () => {
  it('normalizes shadow and local competition on any atlas attachment', () => {
    const state = buildState();
    const attachments = state.bodies
      .slice(1)
      .map((body) => body.attachment)
      .filter((attachment) => attachment !== null);

    // Crystals all stand in the substrate now (ADR-0003), so this species
    // produces no atlas attachments at all. The normalization contract still
    // has to hold for whatever does attach, so assert it over whatever is
    // there rather than requiring a population that no longer exists.
    for (const attachment of attachments) {
      expect(attachment.surfaceRegionId).toBeDefined();
      expect(attachment.growthShadow).toBeGreaterThanOrEqual(0);
      expect(attachment.growthShadow).toBeLessThanOrEqual(1);
      expect(attachment.competitionPressure).toBeGreaterThanOrEqual(0);
      expect(attachment.competitionPressure).toBeLessThanOrEqual(1);
    }
  });

  it('still records competition pressure between ground-rooted crystals', () => {
    // The shadow/competition model is what stops companions from landing on
    // top of each other. Ground-rooted bodies carry it on the body rather than
    // on an attachment, so it must not silently go to zero for everyone.
    const state = buildState();
    const companions = state.bodies.slice(1);

    expect(companions.length).toBeGreaterThan(0);
    for (const body of companions) {
      expect(body.competition).toBeGreaterThanOrEqual(0);
      expect(body.competition).toBeLessThanOrEqual(1);
      expect(body.crowding).toBeGreaterThanOrEqual(0);
    }
    expect(companions.some((body) => body.crowding > 0)).toBe(true);
  });

  it('remains deterministic with shadow-aware candidate scoring', () => {
    const first = buildState();
    const second = buildState();

    expect(second).toEqual(first);
  });
});
