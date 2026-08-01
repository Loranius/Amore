export type GodotEvolutionChannels = Partial<Record<
  'stability' | 'remembrance' | 'achievement' | 'exploration' | 'culture' | 'significance',
  number
>>;

export interface GodotEvolutionEventPayload {
  id: string;
  occurred_at: string;
  source: string;
  evidence?: string;
  channels?: GodotEvolutionChannels;
  portal_activity?: number;
}

export interface GodotEvolutionPayload {
  dna: {
    seed: number;
    species: 'crystal' | 'tree' | 'reef';
    engine_version: string;
    traits?: Record<string, unknown>;
  };
  events: GodotEvolutionEventPayload[];
}

export type GodotActivationSource = 'tap' | 'keyboard';
export type GodotRuntimeQuality = 'high' | 'balanced' | 'economy';
export type GodotLifecycleState =
  | 'hidden'
  | 'visible'
  | 'pagehide'
  | 'pageshow'
  | 'freeze'
  | 'resume'
  | 'context-lost'
  | 'context-restored';

export type GodotBridgeInboundMessage =
  | { type: 'amore:godot:booting'; version: string }
  | { type: 'amore:godot:progress'; current: number; total: number; ratio: number }
  | { type: 'amore:godot:engine-started'; version: string }
  | { type: 'amore:godot:ready'; version: string; runtime: 'godot' }
  | {
      type: 'amore:godot:state';
      version: string;
      source: string;
      species: 'crystal' | 'tree' | 'reef';
      seed: number;
      instructions: number;
      rendered_instructions?: number;
      input_events: number;
      history: number;
      motion?: 'full' | 'reduced';
      life_version?: string;
      visual_version?: string;
      quality_version?: string;
      quality?: GodotRuntimeQuality;
      render_scale?: number;
      life_hz?: number;
      phase?: number;
      signature: string;
    }
  | {
      type: 'amore:godot:telemetry';
      version: string;
      quality: GodotRuntimeQuality;
      fps: number;
      frame_ms: number;
      draw_calls: number;
      primitives: number;
      static_memory_mb: number;
      render_scale: number;
      life_hz: number;
      suspended: boolean;
      restores: number;
    }
  | {
      type: 'amore:godot:lifecycle';
      state: GodotLifecycleState;
      sequence: number;
      suspended: boolean;
      restores: number;
    }
  | { type: 'amore:godot:activate'; source: GodotActivationSource }
  | { type: 'amore:godot:error'; message: string };

export type GodotStateMessage = Extract<
  GodotBridgeInboundMessage,
  { type: 'amore:godot:state' }
>;

export type GodotTelemetryMessage = Extract<
  GodotBridgeInboundMessage,
  { type: 'amore:godot:telemetry' }
>;

export type GodotLifecycleMessage = Extract<
  GodotBridgeInboundMessage,
  { type: 'amore:godot:lifecycle' }
>;

export interface GodotBridgePayloadMessage {
  type: 'amore:godot:payload';
  payload: GodotEvolutionPayload;
}

const RUNTIME_QUALITIES: GodotRuntimeQuality[] = ['high', 'balanced', 'economy'];
const LIFECYCLE_STATES: GodotLifecycleState[] = [
  'hidden',
  'visible',
  'pagehide',
  'pageshow',
  'freeze',
  'resume',
  'context-lost',
  'context-restored',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return isFiniteNumber(value) && Number.isInteger(value) && value >= 0;
}

function isVersionedMessage(value: Record<string, unknown>): boolean {
  return typeof value.version === 'string' && value.version.length > 0;
}

function isRuntimeQuality(value: unknown): value is GodotRuntimeQuality {
  return typeof value === 'string'
    && RUNTIME_QUALITIES.includes(value as GodotRuntimeQuality);
}

function isLifecycleState(value: unknown): value is GodotLifecycleState {
  return typeof value === 'string'
    && LIFECYCLE_STATES.includes(value as GodotLifecycleState);
}

function isOptionalRuntimeSettings(value: Record<string, unknown>): boolean {
  return (value.quality === undefined || isRuntimeQuality(value.quality))
    && (value.render_scale === undefined
      || (isFiniteNumber(value.render_scale) && value.render_scale >= 0.5 && value.render_scale <= 1))
    && (value.life_hz === undefined
      || (isFiniteNumber(value.life_hz) && value.life_hz >= 10 && value.life_hz <= 60));
}

export function isGodotBridgeInboundMessage(value: unknown): value is GodotBridgeInboundMessage {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'amore:godot:booting':
    case 'amore:godot:engine-started':
      return isVersionedMessage(value);
    case 'amore:godot:progress':
      return isNonNegativeInteger(value.current)
        && isNonNegativeInteger(value.total)
        && value.total > 0
        && isFiniteNumber(value.ratio)
        && value.ratio >= 0
        && value.ratio <= 1;
    case 'amore:godot:ready':
      return isVersionedMessage(value) && value.runtime === 'godot';
    case 'amore:godot:state':
      return isVersionedMessage(value)
        && typeof value.source === 'string'
        && value.source.length > 0
        && ['crystal', 'tree', 'reef'].includes(String(value.species))
        && isFiniteNumber(value.seed)
        && isNonNegativeInteger(value.instructions)
        && (value.rendered_instructions === undefined
          || isNonNegativeInteger(value.rendered_instructions))
        && isNonNegativeInteger(value.input_events)
        && isNonNegativeInteger(value.history)
        && value.history >= value.input_events
        && (value.motion === undefined || value.motion === 'full' || value.motion === 'reduced')
        && isOptionalRuntimeSettings(value)
        && typeof value.signature === 'string'
        && value.signature.length >= 8;
    case 'amore:godot:telemetry':
      return isVersionedMessage(value)
        && isRuntimeQuality(value.quality)
        && isNonNegativeNumber(value.fps)
        && isNonNegativeNumber(value.frame_ms)
        && isNonNegativeInteger(value.draw_calls)
        && isNonNegativeInteger(value.primitives)
        && isNonNegativeNumber(value.static_memory_mb)
        && isFiniteNumber(value.render_scale)
        && value.render_scale >= 0.5
        && value.render_scale <= 1
        && isFiniteNumber(value.life_hz)
        && value.life_hz >= 10
        && value.life_hz <= 60
        && typeof value.suspended === 'boolean'
        && isNonNegativeInteger(value.restores);
    case 'amore:godot:lifecycle':
      return isLifecycleState(value.state)
        && isNonNegativeInteger(value.sequence)
        && typeof value.suspended === 'boolean'
        && isNonNegativeInteger(value.restores);
    case 'amore:godot:activate':
      return value.source === 'tap' || value.source === 'keyboard';
    case 'amore:godot:error':
      return typeof value.message === 'string' && value.message.length > 0;
    default:
      return false;
  }
}

export function isGodotRuntimeStateAccepted(
  message: GodotStateMessage,
  payload: GodotEvolutionPayload,
): boolean {
  if (message.source !== 'portal') return false;
  if (message.species !== payload.dna.species) return false;
  if (message.seed !== payload.dna.seed) return false;
  if (message.input_events !== payload.events.length) return false;
  if (message.history < message.input_events) return false;
  if (message.instructions < 1) return false;
  if (
    message.rendered_instructions !== undefined
    && message.rendered_instructions > message.instructions
  ) {
    return false;
  }
  return true;
}

export function createGodotPayloadMessage(
  payload: GodotEvolutionPayload,
): GodotBridgePayloadMessage {
  return { type: 'amore:godot:payload', payload };
}

export function resolveGodotWebUrl(baseUrl: string): string {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${normalizedBase}godot/evolution-engine/index.html`;
}
