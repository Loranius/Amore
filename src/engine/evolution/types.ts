export const EVOLUTION_CHANNELS = [
  'achievement',
  'remembrance',
  'exploration',
  'culture',
  'stability',
  'significance',
] as const;

export type EvolutionChannel = (typeof EVOLUTION_CHANNELS)[number];
export type EvolutionEvidence = 'historical-estimate' | 'verified';
export type LeapDayPolicy = 'feb-28' | 'mar-1';

export type EvolutionPressureVector = Record<EvolutionChannel, number>;

/**
 * Who an event was for and who brought it about.
 *
 * Optional throughout: most facts belong to the couple rather than to one of
 * them, and rows recorded before the portal tracked attribution have none.
 * The crystal uses it to colour a year by the gifts exchanged during it
 * (ADR-0004); it never affects pressure, timing or structure.
 */
export interface EvolutionEventAttribution {
  /** The partner the event was for. */
  subjectId: number | null;
  /** The partner who brought it about. */
  actorId: number | null;
  /** True when the event belongs to both rather than to one of them. */
  shared: boolean;
}

export interface EvolutionEventInput {
  id: string;
  episodeId?: string;
  occurredAt: string;
  source: string;
  evidence: EvolutionEvidence;
  channels: Partial<EvolutionPressureVector>;
  portalActivity?: number;
  attribution?: EvolutionEventAttribution;
}

export interface EvolutionEngineConfig {
  engineVersion: string;
  relationshipStartedAt: string;
  timeZone: string;
  leapDayPolicy: LeapDayPolicy;
}

export interface NormalizedEvolutionEvent {
  id: string;
  episodeId: string | null;
  occurredAt: string;
  occurredAtEpochMs: number;
  source: string;
  evidence: EvolutionEvidence;
  epochIndex: number;
  channels: EvolutionPressureVector;
  portalActivity: number;
  /** Absent when the source recorded none. */
  attribution?: EvolutionEventAttribution;
}

export interface EvolutionEpochPressure {
  epochIndex: number;
  eventCount: number;
  verifiedEventCount: number;
  historicalEstimateCount: number;
  channels: EvolutionPressureVector;
  portalActivity: number;
}

export interface EvolutionPressureLedger {
  eventCount: number;
  verifiedEventCount: number;
  historicalEstimateCount: number;
  channels: EvolutionPressureVector;
  portalActivity: number;
  epochs: EvolutionEpochPressure[];
}

export interface EvolutionDiagnostics {
  invalidEventIds: string[];
  duplicateEventIds: string[];
  duplicateEpisodeIds: string[];
  estimatesReplacedByVerified: string[];
  clampedChannelValues: number;
  clampedPortalActivityValues: number;
}

/**
 * Species-neutral output of the Evolution Engine.
 *
 * Crystal, Tree and Coral Species consume this blueprint independently.
 * The core never imports React, Three.js, R3F, Supabase or renderer code.
 */
export interface ArtifactBlueprint {
  blueprintVersion: 1;
  engineVersion: string;
  coupleId: string;
  deterministicSeed: number;
  relationshipStartedAt: string;
  timeZone: string;
  leapDayPolicy: LeapDayPolicy;
  events: NormalizedEvolutionEvent[];
  pressureLedger: EvolutionPressureLedger;
  diagnostics: EvolutionDiagnostics;
}

export interface BuildArtifactBlueprintInput {
  coupleId: string;
  config: EvolutionEngineConfig;
  events: readonly EvolutionEventInput[];
}
