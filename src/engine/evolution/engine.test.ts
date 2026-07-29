import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint } from './engine';
import type { EvolutionEngineConfig, EvolutionEventInput } from './types';

const config: EvolutionEngineConfig = {
  engineVersion: '1.0.0',
  relationshipStartedAt: '2024-02-29',
  timeZone: 'Europe/Kyiv',
  leapDayPolicy: 'feb-28',
};

const events: EvolutionEventInput[] = [
  {
    id: 'trip-1',
    episodeId: 'trip-lviv',
    occurredAt: '2025-08-12T09:00:00+03:00',
    source: 'plans',
    evidence: 'verified',
    channels: { exploration: 0.8, remembrance: 0.35 },
    portalActivity: 0.4,
  },
  {
    id: 'gift-1',
    occurredAt: '2024-12-20T18:00:00+02:00',
    source: 'wishlist',
    evidence: 'verified',
    channels: { achievement: 0.45, significance: 0.7 },
    portalActivity: 0.2,
  },
];

describe('buildArtifactBlueprint', () => {
  it('is deterministic regardless of input event order', () => {
    const forward = buildArtifactBlueprint({ coupleId: 'couple-42', config, events });
    const reversed = buildArtifactBlueprint({
      coupleId: 'couple-42',
      config,
      events: [...events].reverse(),
    });

    expect(reversed).toEqual(forward);
    expect(forward.deterministicSeed).toBeGreaterThan(0);
  });

  it('replaces a historical estimate with a verified event from the same episode', () => {
    const blueprint = buildArtifactBlueprint({
      coupleId: 'couple-42',
      config,
      events: [
        {
          id: 'estimated-trip',
          episodeId: 'summer-trip',
          occurredAt: '2025-07-01',
          source: 'historical-import',
          evidence: 'historical-estimate',
          channels: { exploration: 0.25 },
        },
        {
          id: 'verified-trip',
          episodeId: 'summer-trip',
          occurredAt: '2025-07-03T12:00:00+03:00',
          source: 'plans',
          evidence: 'verified',
          channels: { exploration: 0.9 },
        },
      ],
    });

    expect(blueprint.events).toHaveLength(1);
    expect(blueprint.events[0]?.id).toBe('verified-trip');
    expect(blueprint.pressureLedger.channels.exploration).toBe(0.9);
    expect(blueprint.diagnostics.estimatesReplacedByVerified).toEqual(['summer-trip']);
  });

  it('uses relationship anniversaries and the configured leap-day policy', () => {
    const blueprint = buildArtifactBlueprint({
      coupleId: 'leap-couple',
      config,
      events: [
        {
          id: 'before-anniversary',
          occurredAt: '2025-02-27T12:00:00+02:00',
          source: 'calendar',
          evidence: 'verified',
          channels: { significance: 0.2 },
        },
        {
          id: 'anniversary',
          occurredAt: '2025-02-28T12:00:00+02:00',
          source: 'calendar',
          evidence: 'verified',
          channels: { significance: 1 },
        },
      ],
    });

    expect(blueprint.events.map((event) => event.epochIndex)).toEqual([0, 1]);
  });

  it('evaluates timestamp dates in the configured time zone', () => {
    const blueprint = buildArtifactBlueprint({
      coupleId: 'timezone-couple',
      config: {
        ...config,
        relationshipStartedAt: '2024-07-01',
      },
      events: [{
        id: 'midnight-local',
        occurredAt: '2025-06-30T21:30:00Z',
        source: 'calendar',
        evidence: 'verified',
        channels: { significance: 0.5 },
      }],
    });

    expect(blueprint.events[0]?.epochIndex).toBe(1);
  });

  it('clamps malformed pressure values without making the blueprint unstable', () => {
    const blueprint = buildArtifactBlueprint({
      coupleId: 'clamp-couple',
      config,
      events: [{
        id: 'extreme',
        occurredAt: '2025-01-01',
        source: 'test',
        evidence: 'verified',
        channels: { achievement: 4, remembrance: -2 },
        portalActivity: 3,
      }],
    });

    expect(blueprint.events[0]?.channels.achievement).toBe(1);
    expect(blueprint.events[0]?.channels.remembrance).toBe(0);
    expect(blueprint.events[0]?.portalActivity).toBe(1);
    expect(blueprint.diagnostics.clampedChannelValues).toBe(2);
    expect(blueprint.diagnostics.clampedPortalActivityValues).toBe(1);
  });
});
