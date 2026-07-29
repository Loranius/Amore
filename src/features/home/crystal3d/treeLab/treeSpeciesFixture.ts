import {
  buildArtifactBlueprint,
  type ArtifactBlueprint,
  type EvolutionEventInput,
} from '@/engine/evolution';

export const TREE_SPECIES_PREVIEW_AS_OF = '2026-07-29T12:00:00+03:00';

const TREE_SPECIES_PREVIEW_EVENTS: readonly EvolutionEventInput[] = [
  {
    id: 'preview:proposal',
    episodeId: 'preview:proposal:episode',
    occurredAt: '2024-02-14T19:00:00+02:00',
    source: 'calendar-preview@1',
    evidence: 'verified',
    channels: { significance: 0.96, remembrance: 0.62, stability: 0.44 },
    portalActivity: 0.26,
  },
  {
    id: 'preview:first-album',
    occurredAt: '2024-05-18T15:00:00+03:00',
    source: 'memories-preview@1',
    evidence: 'verified',
    channels: { remembrance: 0.72, culture: 0.2 },
    portalActivity: 0.18,
  },
  {
    id: 'preview:lviv',
    occurredAt: '2024-08-10T12:00:00+03:00',
    source: 'map-preview@1',
    evidence: 'verified',
    channels: { exploration: 0.88, remembrance: 0.28, culture: 0.22 },
    portalActivity: 0.32,
  },
  {
    id: 'preview:cinema',
    occurredAt: '2024-11-23T18:30:00+02:00',
    source: 'culture-preview@1',
    evidence: 'verified',
    channels: { culture: 0.64, remembrance: 0.24 },
    portalActivity: 0.14,
  },
  {
    id: 'preview:camera-wish',
    episodeId: 'preview:camera-wish:fulfilled',
    occurredAt: '2025-01-05T14:00:00+02:00',
    source: 'wishlist-preview@1',
    evidence: 'verified',
    channels: { achievement: 0.7, significance: 0.6, stability: 0.18 },
    portalActivity: 0.24,
  },
  {
    id: 'preview:summer-memory',
    occurredAt: '2025-06-20T17:00:00+03:00',
    source: 'memories-preview@1',
    evidence: 'verified',
    channels: { remembrance: 0.58, culture: 0.16 },
    portalActivity: 0.16,
  },
  {
    id: 'preview:shared-goal',
    occurredAt: '2026-02-08T10:00:00+02:00',
    source: 'plans-preview@1',
    evidence: 'verified',
    channels: { achievement: 0.74, stability: 0.42, significance: 0.28 },
    portalActivity: 0.28,
  },
  {
    id: 'preview:home-routine',
    occurredAt: '2026-05-16T09:00:00+03:00',
    source: 'schedule-preview@1',
    evidence: 'verified',
    channels: { stability: 0.62, remembrance: 0.14 },
    portalActivity: 0.2,
  },
];

/** Fixed laboratory history. It contains no production or Supabase data. */
export function buildTreeSpeciesPreviewArtifact(): ArtifactBlueprint {
  return buildArtifactBlueprint({
    coupleId: 'amore:tree-species-preview',
    config: {
      engineVersion: 'tree-preview-1.0.0',
      relationshipStartedAt: '2024-01-01',
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events: TREE_SPECIES_PREVIEW_EVENTS,
  });
}
