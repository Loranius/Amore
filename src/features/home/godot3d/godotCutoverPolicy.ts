export type GodotCutoverFailure =
  | 'frame-load'
  | 'runtime-error'
  | 'startup-timeout'
  | 'state-mismatch'
  | 'performance-health'
  | 'release-preflight';

export type EvolutionRenderer = 'godot' | 'three' | 'three-fallback';

interface ResolveEvolutionRendererInput {
  enabled: boolean;
  payloadReady: boolean;
  failure: GodotCutoverFailure | null;
}

export function resolveEvolutionRenderer({
  enabled,
  payloadReady,
  failure,
}: ResolveEvolutionRendererInput): EvolutionRenderer {
  if (!enabled || !payloadReady) return 'three';
  if (failure) return 'three-fallback';
  return 'godot';
}
