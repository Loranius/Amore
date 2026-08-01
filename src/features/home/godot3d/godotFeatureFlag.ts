import {
  getOrCreateGodotCohortKey,
  parseGodotRolloutPercent,
  resolveGodotRolloutEligibility,
} from './godotRolloutPolicy';

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

function browserCohortKey(): string {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : null;
    return getOrCreateGodotCohortKey(storage, () => {
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
      }
      return `cohort-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    });
  } catch {
    return 'storage-unavailable';
  }
}

export const GODOT_EVOLUTION_MODE = parseGodotEvolutionMode(
  import.meta.env.VITE_EVOLUTION_GODOT,
);
export const GODOT_EVOLUTION_ROLLOUT_PERCENT = parseGodotRolloutPercent(
  import.meta.env.VITE_EVOLUTION_GODOT_ROLLOUT,
);
export const GODOT_EVOLUTION_COHORT_KEY = browserCohortKey();
export const GODOT_EVOLUTION_ROLLOUT_ELIGIBLE = resolveGodotRolloutEligibility({
  mode: GODOT_EVOLUTION_MODE,
  rolloutPercent: GODOT_EVOLUTION_ROLLOUT_PERCENT,
  cohortKey: GODOT_EVOLUTION_COHORT_KEY,
});

export const GODOT_EVOLUTION_ENABLED = GODOT_EVOLUTION_MODE !== 'disabled'
  && GODOT_EVOLUTION_ROLLOUT_ELIGIBLE;
export const GODOT_EVOLUTION_PRODUCTION = GODOT_EVOLUTION_MODE === 'production';
