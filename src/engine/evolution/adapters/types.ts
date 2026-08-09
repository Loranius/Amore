import type {
  ArtifactBlueprint,
  EvolutionEngineConfig,
  EvolutionEventInput,
  LeapDayPolicy,
} from '../types';

/**
 * Every portal module that can produce evolution events.
 *
 * An array rather than a bare union so the count is available at runtime:
 * the crystal measures a year by how many of these it touched, and that
 * needs a denominator. Same pattern as `EVOLUTION_CHANNELS`.
 */
export const EVOLUTION_ADAPTER_SOURCES = [
  'calendar',
  'plans',
  'wishlist',
  'map',
  'memories',
  'media',
] as const;

export type EvolutionAdapterSource = (typeof EVOLUTION_ADAPTER_SOURCES)[number];

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
  /**
   * Whose wish it was, and who granted it (ADR-0004). Optional because rows
   * fulfilled before gift attribution existed have neither, and because the
   * pair-wide archive RPC only started returning them in v2.
   */
  ownerId?: number | null;
  fulfilledById?: number | null;
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

export interface MediaSource {
  id: number;
  status: string;
  /**
   * When the row was created. It stands in for a completion date, which
   * `media_items` does not keep — see `adaptMedia`.
   */
  createdAt: string | null;
}

export interface MemoryLinkSource {
  memoryId: number;
  sourceType: 'wish' | 'place' | 'goal' | 'event';
  sourceId: number;
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
  media: readonly MediaSource[];
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
