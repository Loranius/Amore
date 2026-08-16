import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { EvolutionSourceSnapshot } from '@/engine/evolution/adapters';

export type EvolutionSandboxArtifact = 'crystal' | 'tree' | 'reef';

export interface EvolutionSandboxValues {
  relationshipDays: number;
  calendarEvents: number;
  completedPlans: number;
  fulfilledWishes: number;
  visitedPlaces: number;
  memories: number;
  finishedMedia: number;
  sharedDaysOff: number;
}

export interface EvolutionSandboxSources {
  relationshipStartedAt: string;
  snapshot: EvolutionSourceSnapshot;
  sharedDaysOff: string[];
}

interface EvolutionSandboxContextValue {
  enabled: boolean;
  values: EvolutionSandboxValues;
  baselines: Partial<Record<EvolutionSandboxArtifact, EvolutionSandboxValues>>;
  registerBaseline: (artifact: EvolutionSandboxArtifact, baseline: EvolutionSandboxValues) => void;
  prepare: (artifact: EvolutionSandboxArtifact) => void;
  setValue: (key: keyof EvolutionSandboxValues, value: number) => void;
  setRelationshipYears: (years: number) => void;
  reset: (artifact?: EvolutionSandboxArtifact) => void;
}

const DAYS_PER_YEAR = 365.2425;
const MAX_SYNTHETIC_ROWS = 1_500;
const MAX_RELATIONSHIP_DAYS = Math.round(50 * DAYS_PER_YEAR);

const EMPTY_VALUES: EvolutionSandboxValues = {
  relationshipDays: 0,
  calendarEvents: 0,
  completedPlans: 0,
  fulfilledWishes: 0,
  visitedPlaces: 0,
  memories: 0,
  finishedMedia: 0,
  sharedDaysOff: 0,
};

const EvolutionSandboxContext = createContext<EvolutionSandboxContextValue | null>(null);

function clampInteger(value: number, maximum = MAX_SYNTHETIC_ROWS): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(maximum, Math.round(value)));
}

function clampValues(values: EvolutionSandboxValues): EvolutionSandboxValues {
  const relationshipDays = clampInteger(values.relationshipDays, MAX_RELATIONSHIP_DAYS);
  return {
    relationshipDays,
    calendarEvents: clampInteger(values.calendarEvents),
    completedPlans: clampInteger(values.completedPlans),
    fulfilledWishes: clampInteger(values.fulfilledWishes),
    visitedPlaces: clampInteger(values.visitedPlaces),
    memories: clampInteger(values.memories),
    finishedMedia: clampInteger(values.finishedMedia),
    sharedDaysOff: clampInteger(values.sharedDaysOff, Math.max(0, relationshipDays + 1)),
  };
}

function valuesEqual(left: EvolutionSandboxValues | undefined, right: EvolutionSandboxValues): boolean {
  if (!left) return false;
  return (Object.keys(right) as (keyof EvolutionSandboxValues)[])
    .every((key) => left[key] === right[key]);
}

export function EvolutionSandboxProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [values, setValues] = useState<EvolutionSandboxValues>(EMPTY_VALUES);
  const [baselines, setBaselines] = useState<Partial<Record<
    EvolutionSandboxArtifact,
    EvolutionSandboxValues
  >>>({});

  const registerBaseline = useCallback((artifact: EvolutionSandboxArtifact, baseline: EvolutionSandboxValues) => {
    const next = clampValues(baseline);
    setBaselines((current) => valuesEqual(current[artifact], next)
      ? current
      : { ...current, [artifact]: next });
  }, []);

  const prepare = useCallback((artifact: EvolutionSandboxArtifact) => {
    if (enabled) return;
    const baseline = baselines[artifact];
    if (baseline) setValues(baseline);
  }, [baselines, enabled]);

  const setValue = useCallback((key: keyof EvolutionSandboxValues, value: number) => {
    setEnabled(true);
    setValues((current) => clampValues({ ...current, [key]: value }));
  }, []);

  const setRelationshipYears = useCallback((years: number) => {
    setEnabled(true);
    setValues((current) => clampValues({
      ...current,
      relationshipDays: Math.round(clampInteger(years, 50) * DAYS_PER_YEAR),
    }));
  }, []);

  const reset = useCallback((artifact?: EvolutionSandboxArtifact) => {
    setEnabled(false);
    if (artifact && baselines[artifact]) setValues(baselines[artifact]!);
  }, [baselines]);

  const context = useMemo<EvolutionSandboxContextValue>(() => ({
    enabled,
    values,
    baselines,
    registerBaseline,
    prepare,
    setValue,
    setRelationshipYears,
    reset,
  }), [
    baselines,
    enabled,
    prepare,
    registerBaseline,
    reset,
    setRelationshipYears,
    setValue,
    values,
  ]);

  return (
    <EvolutionSandboxContext.Provider value={context}>
      {children}
    </EvolutionSandboxContext.Provider>
  );
}

export function useEvolutionSandbox(): EvolutionSandboxContextValue {
  const value = useContext(EvolutionSandboxContext);
  if (!value) throw new Error('useEvolutionSandbox must be used inside EvolutionSandboxProvider.');
  return value;
}

function dateOnly(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '1970-01-01';
}

function dateEpoch(value: string): number {
  const normalized = dateOnly(value);
  const [year, month, day] = normalized.split('-').map(Number);
  return Date.UTC(year ?? 1970, Math.max(0, (month ?? 1) - 1), day ?? 1);
}

function formatDate(epoch: number): string {
  return new Date(epoch).toISOString().slice(0, 10);
}

export function relationshipDaysBetween(startedAt: string, asOf: string): number {
  const delta = dateEpoch(asOf) - dateEpoch(startedAt);
  if (!Number.isFinite(delta)) return 0;
  return clampInteger(delta / 86_400_000, MAX_RELATIONSHIP_DAYS);
}

function relationshipStartDate(asOf: string, days: number): string {
  return formatDate(dateEpoch(asOf) - clampInteger(days, MAX_RELATIONSHIP_DAYS) * 86_400_000);
}

function spreadDates(count: number, startedAt: string, asOf: string): string[] {
  const safeCount = clampInteger(count);
  if (safeCount === 0) return [];
  const start = dateEpoch(startedAt);
  const end = Math.max(start, dateEpoch(asOf));
  const span = end - start;
  return Array.from({ length: safeCount }, (_value, index) => {
    const t = safeCount === 1 ? 1 : (index + 1) / safeCount;
    return formatDate(start + Math.round(span * t));
  });
}

function syntheticSharedDaysOff(count: number, startedAt: string, asOf: string): string[] {
  const relationshipDays = Math.max(0, Math.round((dateEpoch(asOf) - dateEpoch(startedAt)) / 86_400_000));
  const safeCount = Math.min(clampInteger(count), relationshipDays + 1);
  if (safeCount === 0) return [];
  const start = dateEpoch(startedAt);
  const availableDays = relationshipDays + 1;
  const dates = new Set<string>();
  for (let index = 0; index < safeCount; index += 1) {
    const offset = safeCount === 1
      ? relationshipDays
      : Math.round(index * Math.max(0, availableDays - 1) / Math.max(1, safeCount - 1));
    dates.add(formatDate(start + offset * 86_400_000));
  }
  return [...dates].sort();
}

/**
 * Builds a synthetic pair history from aggregate counters. Nothing is persisted:
 * the output is passed only into the same Evolution adapters that production
 * couple rows normally use, so the constructor tests the real procedural path.
 */
export function applyEvolutionSandboxSources({
  enabled,
  values,
  asOf,
  relationshipStartedAt,
  snapshot,
  sharedDaysOff = [],
}: {
  enabled: boolean;
  values: EvolutionSandboxValues;
  asOf: string;
  relationshipStartedAt: string;
  snapshot: EvolutionSourceSnapshot;
  sharedDaysOff?: readonly string[];
}): EvolutionSandboxSources {
  if (!enabled) {
    return {
      relationshipStartedAt,
      snapshot,
      sharedDaysOff: [...sharedDaysOff],
    };
  }

  const safe = clampValues(values);
  const startedAt = relationshipStartDate(asOf, safe.relationshipDays);
  const calendarDates = spreadDates(safe.calendarEvents, startedAt, asOf);
  const planDates = spreadDates(safe.completedPlans, startedAt, asOf);
  const wishDates = spreadDates(safe.fulfilledWishes, startedAt, asOf);
  const placeDates = spreadDates(safe.visitedPlaces, startedAt, asOf);
  const memoryDates = spreadDates(safe.memories, startedAt, asOf);
  const mediaDates = spreadDates(safe.finishedMedia, startedAt, asOf);

  return {
    relationshipStartedAt: startedAt,
    snapshot: {
      calendarEvents: calendarDates.map((date, index) => ({
        id: 900_000 + index,
        date,
        type: 'other' as const,
        yearly: false,
        isMilestone: true,
      })),
      plans: planDates.map((date, index) => ({
        id: 910_000 + index,
        category: 'other',
        status: 'done',
        startDate: date,
        endDate: date,
        completedAt: date,
        createdAt: date,
      })),
      wishlistItems: wishDates.map((date, index) => ({
        id: 920_000 + index,
        fulfilled: true,
        fulfilledAt: date,
        giftDate: date,
        isShared: true,
        priority: 'medium' as const,
        ownerId: null,
        fulfilledById: null,
      })),
      mapPlaces: placeDates.map((date, index) => ({
        id: 930_000 + index,
        category: 'other',
        visitedAt: date,
        createdAt: date,
        rating: null,
        city: null,
        country: null,
      })),
      memories: memoryDates.map((date, index) => ({
        id: 940_000 + index,
        memoryDate: date,
        datePrecision: 'day' as const,
        takenAt: date,
        createdAt: date,
      })),
      memoryLinks: [],
      media: mediaDates.map((date, index) => ({
        id: 950_000 + index,
        status: 'done',
        createdAt: date,
      })),
    },
    sharedDaysOff: syntheticSharedDaysOff(safe.sharedDaysOff, startedAt, asOf),
  };
}

export const EVOLUTION_SANDBOX_MAX_RELATIONSHIP_DAYS = MAX_RELATIONSHIP_DAYS;
export const EVOLUTION_SANDBOX_DAYS_PER_YEAR = DAYS_PER_YEAR;
