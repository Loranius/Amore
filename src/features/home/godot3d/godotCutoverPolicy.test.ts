import { describe, expect, it } from 'vitest';
import { resolveEvolutionRenderer } from './godotCutoverPolicy';

describe('Godot production cutover policy', () => {
  it('keeps Three.js when Godot is disabled or the canonical payload is not ready', () => {
    expect(resolveEvolutionRenderer({ enabled: false, payloadReady: true, failure: null })).toBe('three');
    expect(resolveEvolutionRenderer({ enabled: true, payloadReady: false, failure: null })).toBe('three');
  });

  it('selects Godot only when enabled with a ready payload and no fatal failure', () => {
    expect(resolveEvolutionRenderer({ enabled: true, payloadReady: true, failure: null })).toBe('godot');
  });

  it.each([
    'frame-load',
    'runtime-error',
    'startup-timeout',
    'state-mismatch',
  ] as const)('falls back to Three.js after %s', failure => {
    expect(resolveEvolutionRenderer({ enabled: true, payloadReady: true, failure })).toBe('three-fallback');
  });
});
