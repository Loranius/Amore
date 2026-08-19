// ============================================================
// Regions of the world — the artifact-neutral half of the atlas.
// ------------------------------------------------------------
// The brief asks for one thing twice (§20, §53): navigation must land on a
// *meaningful, stable* place, and the shared layer must ask for it
// semantically. "Focus the Wishlist region" is the request; the crystal
// answers "the crown", and a tree will one day answer "the canopy" without
// anything above changing.
//
// So the mapping is in two halves and this is the first. It knows routes and
// meanings, and nothing at all about facets, camera poses or amethyst.
// ============================================================

/**
 * What a place in the world *means*, not where it is.
 *
 * Names describe the relationship, not the geometry, because the geometry is
 * the artifact's business. `aspiration` is the crown on a crystal and the
 * upper canopy on a tree; both are "what the couple is reaching for".
 */
export type WorldRegion =
  /** The whole artifact, seen plainly. Home. */
  | 'centre'
  /** What the couple is reaching for. */
  | 'aspiration'
  /** What they have decided to do. */
  | 'intention'
  /** The everyday, practical and shared. */
  | 'provision'
  /** What is kept, seen from inside. */
  | 'memory'
  /** Time, running along the body. */
  | 'chronicle'
  /** The near part of time — days rather than years. */
  | 'routine'
  /** Evenings, watched and read together. */
  | 'leisure'
  /** The foundation, and what has accumulated in it. */
  | 'foundation'
  /** Home comforts. The one warm region. */
  | 'hearth'
  /** Looking outward, away from the shared world. */
  | 'outward'
  /** Outside it entirely: the world is context, not subject. */
  | 'external'
  /** A way through — an opening rather than a face. */
  | 'threshold';

/**
 * Route → meaning.
 *
 * Deterministic and total: every authenticated route has a region, and the
 * same route always has the same one. That is the whole point of §20 — a
 * couple should slowly learn where things are, which is impossible if a
 * bearing is chosen afresh on each navigation.
 *
 * Nested routes inherit their parent's region deliberately. `/plans/:id` is
 * still Plans; sending the camera somewhere else to open a detail would make
 * the detail feel like a different place rather than a closer look at this one.
 */
const ROUTE_REGIONS: readonly (readonly [string, WorldRegion])[] = [
  ['/wishlist', 'aspiration'],
  ['/plans', 'intention'],
  ['/shopping', 'provision'],
  ['/memories', 'memory'],
  ['/schedule', 'routine'],
  ['/media', 'leisure'],
  ['/piggybank', 'foundation'],
  ['/culinary', 'hearth'],
  ['/whereto', 'outward'],
  ['/game', 'threshold'],
];

/** Strips the hash router's prefix and any trailing slash or query. */
export function normalizeWorldPath(pathname: string): string {
  const withoutHash = pathname.startsWith('#') ? pathname.slice(1) : pathname;
  const withoutQuery = withoutHash.split('?')[0]!.split('#')[0]!;
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

export function worldRegionForRoute(pathname: string): WorldRegion {
  const path = normalizeWorldPath(pathname);
  if (path === '/') return 'centre';
  for (const [prefix, region] of ROUTE_REGIONS) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return region;
  }
  // An unknown path is the centre rather than a guess. The router sends
  // unknown routes home anyway; landing the camera anywhere else would mean
  // the world briefly claimed to be somewhere the couple never went.
  return 'centre';
}

/** Every region the atlas can produce. Exported so the artifact half can be checked against it. */
export const WORLD_REGIONS: readonly WorldRegion[] = [
  'centre',
  ...ROUTE_REGIONS.map(([, region]) => region),
];
