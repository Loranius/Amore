export const EVOLUTION_RENDERER_QUERY_KEY = 'engine';
export const EVOLUTION_RENDERER_QUERY_VALUE = 'evolution';

/** Explicit preview flag. The legacy renderer remains the production default. */
export function isEvolutionRendererPreviewEnabled(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get(EVOLUTION_RENDERER_QUERY_KEY) === EVOLUTION_RENDERER_QUERY_VALUE;
}

export const EVOLUTION_DIAGNOSTICS_QUERY_KEY = 'evolutionDiagnostics';

/**
 * Build metrics and adapter diagnostics overlay. Off unless asked for: on the
 * home screen the artifact is the whole point, and a chip reading body counts
 * and draw calls over it is a tool for us, not content for the couple.
 */
export function isEvolutionDiagnosticsEnabled(
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): boolean {
  const value = new URLSearchParams(search).get(EVOLUTION_DIAGNOSTICS_QUERY_KEY);
  return value === '1' || value === 'true' || value === 'on';
}
