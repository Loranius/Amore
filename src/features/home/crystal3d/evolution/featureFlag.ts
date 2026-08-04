// Тут жив isEvolutionRendererPreviewEnabled — прапорець `engine=evolution`,
// який перемикав головну зі старого рендерера на Evolution. Evolution уже не
// прев'ю, а єдиний конвеєр, і сам ключ `engine` нікуди не подівся: його читає
// resolveHomeArtifact (homeArtifact.ts), обираючи артефакт. Прапорець лишався
// перемикачем без другого положення.

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
