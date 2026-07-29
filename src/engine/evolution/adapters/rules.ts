import type { EvolutionPressureVector } from '../types';

export const EVOLUTION_ADAPTER_RULES_VERSION = '2026-07-29.1';

export const CALENDAR_REGULAR_PRESSURE = {
  remembrance: 0.42,
  significance: 0.36,
  stability: 0.18,
} satisfies Partial<EvolutionPressureVector>;

export const CALENDAR_MILESTONE_PRESSURE = {
  remembrance: 0.72,
  significance: 1,
  stability: 0.36,
} satisfies Partial<EvolutionPressureVector>;

export const CALENDAR_RECURRENCE_PRESSURE = {
  remembrance: 0.2,
  significance: 0.12,
  stability: 0.2,
} satisfies Partial<EvolutionPressureVector>;

export const PLAN_PRESSURES: Readonly<Record<string, Partial<EvolutionPressureVector>>> = {
  date: { remembrance: 0.5, stability: 0.25, significance: 0.18 },
  trip: { exploration: 0.9, remembrance: 0.5, culture: 0.2 },
  ride: { exploration: 0.68, remembrance: 0.34, achievement: 0.18 },
  place: { exploration: 0.72, remembrance: 0.38, culture: 0.16 },
  event: { culture: 0.55, remembrance: 0.45, significance: 0.3 },
  activity: { achievement: 0.48, exploration: 0.34, remembrance: 0.24 },
  rest: { stability: 0.42, remembrance: 0.26 },
  holiday: { culture: 0.38, remembrance: 0.36, stability: 0.2 },
  learning: { achievement: 0.66, culture: 0.4, stability: 0.12 },
  home: { stability: 0.7, achievement: 0.28 },
  other: { achievement: 0.26, remembrance: 0.2, stability: 0.12 },
};

export const WISHLIST_BASE_PRESSURE = {
  achievement: 0.5,
  significance: 0.28,
  remembrance: 0.16,
} satisfies Partial<EvolutionPressureVector>;

export const MAP_VISIT_PRESSURE = {
  exploration: 0.65,
  remembrance: 0.34,
  culture: 0.12,
} satisfies Partial<EvolutionPressureVector>;

export const MEMORY_PRESSURE_BY_PRECISION: Readonly<Record<string, number>> = {
  day: 0.12,
  month: 0.09,
  year: 0.065,
  approx: 0.05,
};

export const SHOPPING_MAX_STABILITY = 0.1;
export const SHOPPING_MAX_ACTIVITY = 0.07;
