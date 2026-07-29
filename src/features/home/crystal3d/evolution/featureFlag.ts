export const EVOLUTION_RENDERER_QUERY_KEY = 'engine';
export const EVOLUTION_RENDERER_QUERY_VALUE = 'evolution';

/** Explicit preview flag. The legacy renderer remains the production default. */
export function isEvolutionRendererPreviewEnabled(search: string): boolean {
  const params = new URLSearchParams(search);
  return params.get(EVOLUTION_RENDERER_QUERY_KEY) === EVOLUTION_RENDERER_QUERY_VALUE;
}
