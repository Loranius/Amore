import { describe, expect, it } from 'vitest';
import { parseGodotEvolutionFlag } from './godotFeatureFlag';
import {
  createGodotPayloadMessage,
  isGodotBridgeInboundMessage,
  resolveGodotWebUrl,
  type GodotEvolutionPayload,
} from './godotBridgeProtocol';

const payload: GodotEvolutionPayload = {
  dna: {
    seed: 582013,
    species: 'crystal',
    engine_version: 'godot-0.1.0',
  },
  events: [],
};

describe('Godot Evolution feature flag', () => {
  it.each(['1', 'true', 'TRUE', 'on', 'enabled'])('accepts %s', value => {
    expect(parseGodotEvolutionFlag(value)).toBe(true);
  });

  it.each([undefined, null, '', '0', 'false', 'off', 'random'])('rejects %s', value => {
    expect(parseGodotEvolutionFlag(value)).toBe(false);
  });
});

describe('Godot portal bridge protocol', () => {
  it('builds a same-shape payload message without mutating the payload', () => {
    const message = createGodotPayloadMessage(payload);
    expect(message).toEqual({ type: 'amore:godot:payload', payload });
    expect(message.payload).toBe(payload);
  });

  it('accepts only known inbound message types', () => {
    expect(isGodotBridgeInboundMessage({ type: 'amore:godot:ready', version: '4.7.1' })).toBe(true);
    expect(isGodotBridgeInboundMessage({ type: 'amore:godot:state', signature: 'abc' })).toBe(true);
    expect(isGodotBridgeInboundMessage({ type: 'amore:portal:payload' })).toBe(false);
    expect(isGodotBridgeInboundMessage(null)).toBe(false);
  });

  it('resolves root and GitHub Pages base paths', () => {
    expect(resolveGodotWebUrl('/')).toBe('/godot/evolution-engine/index.html');
    expect(resolveGodotWebUrl('/Amore/')).toBe('/Amore/godot/evolution-engine/index.html');
    expect(resolveGodotWebUrl('/Amore')).toBe('/Amore/godot/evolution-engine/index.html');
  });
});
