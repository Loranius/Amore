export type GodotEvolutionMode = 'disabled' | 'preview' | 'production';

export function parseGodotEvolutionMode(value: unknown): GodotEvolutionMode {
  if (typeof value !== 'string') return 'disabled';

  const normalized = value.trim().toLowerCase();
  if (['production', 'prod', 'cutover'].includes(normalized)) return 'production';
  if (['1', 'true', 'on', 'enabled', 'preview'].includes(normalized)) return 'preview';
  return 'disabled';
}

export function parseGodotEvolutionFlag(value: unknown): boolean {
  return parseGodotEvolutionMode(value) !== 'disabled';
}

export const GODOT_EVOLUTION_MODE = parseGodotEvolutionMode(
  import.meta.env.VITE_EVOLUTION_GODOT,
);

export const GODOT_EVOLUTION_ENABLED = GODOT_EVOLUTION_MODE !== 'disabled';
export const GODOT_EVOLUTION_PRODUCTION = GODOT_EVOLUTION_MODE === 'production';
