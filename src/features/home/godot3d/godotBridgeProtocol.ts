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

export type GodotBridgeInboundMessage =
  | { type: 'amore:godot:booting'; version: string }
  | { type: 'amore:godot:progress'; current: number; total: number; ratio: number }
  | { type: 'amore:godot:engine-started'; version: string }
  | { type: 'amore:godot:ready'; version: string; runtime: 'godot' }
  | {
      type: 'amore:godot:state';
      version: string;
      source: string;
      species: string;
      seed: number;
      instructions: number;
      history: number;
      signature: string;
    }
  | { type: 'amore:godot:error'; message: string };

export interface GodotBridgePayloadMessage {
  type: 'amore:godot:payload';
  payload: GodotEvolutionPayload;
}

const INBOUND_TYPES = new Set([
  'amore:godot:booting',
  'amore:godot:progress',
  'amore:godot:engine-started',
  'amore:godot:ready',
  'amore:godot:state',
  'amore:godot:error',
]);

export function isGodotBridgeInboundMessage(value: unknown): value is GodotBridgeInboundMessage {
  if (!value || typeof value !== 'object') return false;
  const type = Reflect.get(value, 'type');
  return typeof type === 'string' && INBOUND_TYPES.has(type);
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
