import type { GodotEvolutionMode } from './godotFeatureFlag';

export const GODOT_ROLLOUT_STORAGE_KEY = 'amore:godot-rollout-cohort-v1';

export function parseGodotRolloutPercent(value: unknown): number {
  if (value === undefined || value === null || value === '') return 100;
  const parsed = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(100, Math.max(0, Math.round(parsed)));
}

export function stableGodotCohortBucket(cohortKey: string): number {
  let hash = 2166136261;
  for (let index = 0; index < cohortKey.length; index += 1) {
    hash ^= cohortKey.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function resolveGodotRolloutEligibility(input: {
  mode: GodotEvolutionMode;
  rolloutPercent: number;
  cohortKey: string;
}): boolean {
  if (input.mode === 'disabled') return false;
  if (input.mode === 'preview') return true;
  return stableGodotCohortBucket(input.cohortKey) < input.rolloutPercent;
}

export function getOrCreateGodotCohortKey(
  storage: Pick<Storage, 'getItem' | 'setItem'> | null,
  createKey: () => string,
): string {
  if (!storage) return 'server-default';
  const existing = storage.getItem(GODOT_ROLLOUT_STORAGE_KEY);
  if (existing) return existing;
  const next = createKey();
  storage.setItem(GODOT_ROLLOUT_STORAGE_KEY, next);
  return next;
}
