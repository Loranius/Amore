import type {
  ArtifactBlueprint,
  EvolutionEngineConfig,
  EvolutionEventInput,
  LeapDayPolicy,
} from '../types';

export type EvolutionAdapterSource =
  | 'calendar'
  | 'plans'
  | 'wishlist'
  | 'map'
  | 'memories'
  | 'shopping';

export type AdapterDiagnosticCode =
  | 'invalid_as_of'
  | 'invalid_date'
  | 'missing_completion_date'
  | 'unsupported_category';

export interface AdapterDiagnostic {
  source: EvolutionAdapterSource | 'snapshot';
  code: AdapterDiagnosticCode;
  recordId: string;
  message: string;
}

export interface EvolutionAdapterContext {
  /** Explicit clock boundary. Adapters never read Date.now(). */
  asOf: string;
  timeZone: string;
  leapDayPolicy: LeapDayPolicy;
  rulesVersion: string;
}

export interface EvolutionAdapterResult {
  events: EvolutionEventInput[];
  diagnostics: AdapterDiagnostic[];
}

export interface CalendarEventSource {
  id: number;
  date: string;
  type: 'birthday' | 'anniversary' | 'holiday' | 'other' | null;
  yearly: boolean | null;
  isMilestone: boolean;
}

export interface PlanSource {
  id: number;
  category: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface WishlistSource {
  id: number;
  fulfilled: boolean;
  fulfilledAt: string | null;
  giftDate: string | null;
  isShared: boolean;
  priority: 'high' | 'medium' | 'low' | null;
}

export interface MapPlaceSource {
  id: number;
  category: string;
  visitedAt: string | null;
  createdAt: string;
  rating: number | null;
  city: string | null;
  country: string | null;
}

export interface MemorySourceRecord {
  id: number;
  memoryDate: string;
  datePrecision: 'day' | 'month' | 'year' | 'approx';
  takenAt: string | null;
  createdAt: string;
}

export interface MemoryLinkSource {
  memoryId: number;
  sourceType: 'wish' | 'place' | 'goal' | 'event';
  sourceId: number;
}

export interface ShoppingItemSource {
  id: number;
  bought: boolean;
  boughtAt: string | null;
  createdAt: string;
}

/**
 * Transport-neutral snapshot. A later Supabase loader will map table rows into
 * this shape; the adapters themselves remain pure and independently testable.
 */
export interface EvolutionSourceSnapshot {
  calendarEvents: readonly CalendarEventSource[];
  plans: readonly PlanSource[];
  wishlistItems: readonly WishlistSource[];
  mapPlaces: readonly MapPlaceSource[];
  memories: readonly MemorySourceRecord[];
  memoryLinks: readonly MemoryLinkSource[];
  shoppingItems: readonly ShoppingItemSource[];
}

export interface BuildArtifactFromSnapshotInput {
  coupleId: string;
  engineConfig: EvolutionEngineConfig;
  asOf: string;
  snapshot: EvolutionSourceSnapshot;
}

export interface ArtifactFromSnapshotResult {
  blueprint: ArtifactBlueprint;
  adapterRulesVersion: string;
  adapterDiagnostics: AdapterDiagnostic[];
}
