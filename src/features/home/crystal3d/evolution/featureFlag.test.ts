import { describe, expect, it } from 'vitest';
import { isEvolutionDiagnosticsEnabled } from './featureFlag';

describe('Evolution diagnostics flag', () => {
  it('stays off unless asked for', () => {
    // The overlay reads body counts, draw calls and build time over the
    // artifact. On the home screen the artifact is the whole point, so the
    // default has to be off rather than merely small.
    expect(isEvolutionDiagnosticsEnabled('')).toBe(false);
    expect(isEvolutionDiagnosticsEnabled('?evolutionDiagnostics=0')).toBe(false);
    expect(isEvolutionDiagnosticsEnabled('?evolutionDiagnostics=off')).toBe(false);
    expect(isEvolutionDiagnosticsEnabled('?other=1')).toBe(false);
  });

  it('accepts the three spellings a developer would reach for', () => {
    expect(isEvolutionDiagnosticsEnabled('?evolutionDiagnostics=1')).toBe(true);
    expect(isEvolutionDiagnosticsEnabled('?evolutionDiagnostics=true')).toBe(true);
    expect(isEvolutionDiagnosticsEnabled('?evolutionDiagnostics=on')).toBe(true);
  });
});
