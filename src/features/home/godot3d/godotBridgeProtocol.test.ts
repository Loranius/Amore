import { describe, expect, it } from 'vitest';
import {
  parseGodotEvolutionFlag,
  parseGodotEvolutionMode,
} from './godotFeatureFlag';
import {
  createGodotPayloadMessage,
  isGodotBridgeInboundMessage,
  isGodotRuntimeStateAccepted,
  resolveGodotWebUrl,
  type GodotEvolutionPayload,
  type GodotStateMessage,
} from './godotBridgeProtocol';

const payload: GodotEvolutionPayload = {
  dna: {
    seed: 582013,
    species: 'crystal',
    engine_version: 'godot-0.1.0',
  },
  events: [
    {
      id: 'memory:first-place',
      occurred_at: '2024-02-12',
      source: 'map@1',
    },
  ],
};

const acceptedState: GodotStateMessage = {
  type: 'amore:godot:state',
  version: '4.7.1',
  source: 'portal',
  species: 'crystal',
  seed: 582013,
  instructions: 4,
  rendered_instructions: 3,
  input_events: 1,
  history: 7,
  motion: 'full',
  quality_version: 'runtime-quality-governor-v1',
  quality: 'balanced',
  render_scale: 0.86,
  life_hz: 30,
  phase: 13,
  signature: '0123456789abcdef',
};

describe('Godot Evolution feature flag', () => {
  it.each(['1', 'true', 'TRUE', 'on', 'enabled', 'preview'])('accepts %s as preview', value => {
    expect(parseGodotEvolutionFlag(value)).toBe(true);
    expect(parseGodotEvolutionMode(value)).toBe('preview');
  });

  it.each(['production', 'prod', 'cutover'])('accepts %s as production', value => {
    expect(parseGodotEvolutionFlag(value)).toBe(true);
    expect(parseGodotEvolutionMode(value)).toBe('production');
  });

  it.each([undefined, null, '', '0', 'false', 'off', 'random'])('rejects %s', value => {
    expect(parseGodotEvolutionFlag(value)).toBe(false);
    expect(parseGodotEvolutionMode(value)).toBe('disabled');
  });
});

describe('Godot portal bridge protocol', () => {
  it('builds a same-shape payload message without mutating the payload', () => {
    const message = createGodotPayloadMessage(payload);
    expect(message).toEqual({ type: 'amore:godot:payload', payload });
    expect(message.payload).toBe(payload);
  });

  it('accepts complete state, telemetry, lifecycle, interaction and activation messages', () => {
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:ready',
      version: '4.7.1',
      runtime: 'godot',
    })).toBe(true);
    expect(isGodotBridgeInboundMessage(acceptedState)).toBe(true);
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:telemetry',
      version: '4.7.1',
      quality: 'balanced',
      fps: 58.4,
      frame_ms: 17.12,
      draw_calls: 11,
      primitives: 920,
      static_memory_mb: 84.2,
      render_scale: 0.86,
      life_hz: 30,
      suspended: false,
      restores: 1,
    })).toBe(true);
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:lifecycle',
      state: 'pageshow',
      sequence: 4,
      suspended: false,
      restores: 1,
    })).toBe(true);
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:interaction',
      kind: 'orbit',
      sequence: 1,
    })).toBe(true);
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:activate',
      source: 'tap',
    })).toBe(true);
  });

  it('rejects malformed runtime settings, telemetry and interaction evidence', () => {
    expect(isGodotBridgeInboundMessage({ type: 'amore:godot:state', signature: 'abc' })).toBe(false);
    expect(isGodotBridgeInboundMessage({
      ...acceptedState,
      input_events: 3,
      history: 2,
    })).toBe(false);
    expect(isGodotBridgeInboundMessage({
      ...acceptedState,
      render_scale: 1.4,
    })).toBe(false);
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:telemetry',
      version: '4.7.1',
      quality: 'ultra',
      fps: -1,
      frame_ms: 0,
      draw_calls: 0,
      primitives: 0,
      static_memory_mb: 0,
      render_scale: 2,
      life_hz: 120,
      suspended: false,
      restores: 0,
    })).toBe(false);
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:lifecycle',
      state: 'unknown',
      sequence: 1,
      suspended: false,
      restores: 0,
    })).toBe(false);
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:interaction',
      kind: 'swipe',
      sequence: 0,
    })).toBe(false);
    expect(isGodotBridgeInboundMessage({
      type: 'amore:godot:progress',
      current: 1,
      total: 0,
      ratio: 2,
    })).toBe(false);
    expect(isGodotBridgeInboundMessage({ type: 'amore:portal:payload' })).toBe(false);
    expect(isGodotBridgeInboundMessage(null)).toBe(false);
  });

  it('accepts only portal state matching the canonical payload identity and source event count', () => {
    expect(isGodotRuntimeStateAccepted(acceptedState, payload)).toBe(true);
    expect(isGodotRuntimeStateAccepted({ ...acceptedState, source: 'demo' }, payload)).toBe(false);
    expect(isGodotRuntimeStateAccepted({ ...acceptedState, seed: 1 }, payload)).toBe(false);
    expect(isGodotRuntimeStateAccepted({ ...acceptedState, input_events: 0 }, payload)).toBe(false);
    expect(isGodotRuntimeStateAccepted({
      ...acceptedState,
      input_events: 8,
      history: 7,
    }, payload)).toBe(false);
    expect(isGodotRuntimeStateAccepted({
      ...acceptedState,
      rendered_instructions: 5,
    }, payload)).toBe(false);
  });

  it('resolves root and GitHub Pages base paths', () => {
    expect(resolveGodotWebUrl('/')).toBe('/godot/evolution-engine/index.html');
    expect(resolveGodotWebUrl('/Amore/')).toBe('/Amore/godot/evolution-engine/index.html');
    expect(resolveGodotWebUrl('/Amore')).toBe('/Amore/godot/evolution-engine/index.html');
  });
});
