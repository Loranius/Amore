export function parseGodotEvolutionFlag(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return ['1', 'true', 'on', 'enabled'].includes(value.trim().toLowerCase());
}

export const GODOT_EVOLUTION_ENABLED = parseGodotEvolutionFlag(
  import.meta.env.VITE_EVOLUTION_GODOT,
);
