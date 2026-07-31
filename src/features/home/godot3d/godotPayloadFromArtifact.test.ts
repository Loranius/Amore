import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint } from '@/engine/evolution';
import {
  GODOT_CRYSTAL_ENGINE_VERSION,
  godotPayloadFromArtifact,
} from './godotPayloadFromArtifact';

describe('godotPayloadFromArtifact', () => {
  it('maps deterministic DNA and normalized events without renderer state', () => {
    const artifact = buildArtifactBlueprint({
      coupleId: 'amore:godot-adapter',
      config: {
        engineVersion: '1.0.0',
        relationshipStartedAt: '2024-01-01',
        timeZone: 'Europe/Kyiv',
        leapDayPolicy: 'feb-28',
      },
      events: [
        {
          id: 'memory:verified',
          occurredAt: '2024-03-12',
          source: 'memories@1',
          evidence: 'verified',
          channels: { remembrance: 0.91, significance: 0.72 },
          portalActivity: 0.33,
        },
      ],
    });

    const payload = godotPayloadFromArtifact(artifact);

    expect(payload.dna).toMatchObject({
      seed: artifact.deterministicSeed,
      species: 'crystal',
      engine_version: GODOT_CRYSTAL_ENGINE_VERSION,
      traits: {
        blueprint_version: 1,
        source_engine_version: '1.0.0',
        couple_id: 'amore:godot-adapter',
        relationship_started_at: '2024-01-01',
        time_zone: 'Europe/Kyiv',
        leap_day_policy: 'feb-28',
      },
    });
    expect(payload.events).toEqual([
      {
        id: 'memory:verified',
        occurred_at: artifact.events[0]?.occurredAt,
        source: 'memories@1',
        evidence: 'verified',
        channels: artifact.events[0]?.channels,
        portal_activity: artifact.events[0]?.portalActivity,
      },
    ]);
    expect(payload).not.toHaveProperty('geometry');
    expect(payload).not.toHaveProperty('material');
  });
});
