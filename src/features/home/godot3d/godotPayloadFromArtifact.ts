import type { ArtifactBlueprint } from '@/engine/evolution';
import type { GodotEvolutionPayload } from './godotBridgeProtocol';

export const GODOT_CRYSTAL_ENGINE_VERSION = 'godot-0.1.0';

export function godotPayloadFromArtifact(
  artifact: ArtifactBlueprint,
): GodotEvolutionPayload {
  return {
    dna: {
      seed: artifact.deterministicSeed,
      species: 'crystal',
      engine_version: GODOT_CRYSTAL_ENGINE_VERSION,
      traits: {
        blueprint_version: artifact.blueprintVersion,
        source_engine_version: artifact.engineVersion,
        couple_id: artifact.coupleId,
        relationship_started_at: artifact.relationshipStartedAt,
        time_zone: artifact.timeZone,
        leap_day_policy: artifact.leapDayPolicy,
      },
    },
    events: artifact.events.map(event => ({
      id: event.id,
      occurred_at: event.occurredAt,
      source: event.source,
      evidence: event.evidence,
      channels: { ...event.channels },
      portal_activity: event.portalActivity,
    })),
  };
}
