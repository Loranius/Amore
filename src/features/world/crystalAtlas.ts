import type { WorldRegion } from './worldRegions';

// ============================================================
// The crystal's answer to each region — the artifact half of the atlas.
// ------------------------------------------------------------
// The shared layer asks for a meaning ("the aspiration region"); this file is
// where the crystal says what that means for a body made of facets: the crown.
// A tree will answer the same question with its canopy, in its own file, and
// nothing above will change (brief §53).
//
// Every pose is expressed in the artifact's own terms — a bearing around it, a
// height along it, a distance as a multiple of the framing distance the camera
// already computes. Nothing here is in scene units, because the artifact's size
// is the couple's and changes as they grow.
// ============================================================

export interface WorldCameraPose {
  /**
   * Bearing around the artifact, in radians, measured from the default view.
   *
   * Zero is the face the couple sees on Home. The others are spread around the
   * body rather than crowded on one side: what the brief asks for is spatial
   * memory (§20), and memory needs the places to be far enough apart to tell
   * apart.
   */
  azimuth: number;
  /**
   * Where the camera looks, as a share of the artifact's height. 0 is the
   * root, 1 the tip.
   */
  targetHeight: number;
  /**
   * How far the eye sits above the target, as the *sine* of the angle it
   * stands at — a share of the eye-to-target distance, not of the artifact.
   * Positive looks down, negative looks up.
   *
   * The unit is the frame's own (`EYE_ELEVATION_SIN`), and deliberately so:
   * with `distance` at 1 and this at the frame's value, the centre pose
   * reproduces the framing camera exactly rather than approximately. A pose
   * measured against the artifact's height instead would move Home's camera
   * the day this file was introduced, which is the one thing phase 3 must not
   * do.
   */
  elevation: number;
  /**
   * Distance as a multiple of the framing distance. 1 is the full-artifact
   * frame Home uses; below 1 is closer.
   */
  distance: number;
  /**
   * How much of the world's own light this region carries, 0–1.
   *
   * Not a colour. §39 is explicit that a darker region is still the same
   * world — Media is a cooler, quieter corner of it, not a second theme.
   */
  luminosity: number;
}

/**
 * The centre: the whole monarch, framed as she has always been.
 *
 * Every other pose is stated as a departure from this one, so a region that
 * says nothing about a value inherits the plain view of the artifact rather
 * than an accidental zero.
 *
 * `targetHeight` and `elevation` are the framing camera's own numbers
 * (`PORTAL_TARGET_SHARE_OF_ARTIFACT`, `EYE_ELEVATION_SIN`), which is what makes
 * this pose an exact no-op on Home. `worldAtlas.test.ts` holds them equal.
 */
const CENTRE: WorldCameraPose = {
  azimuth: 0,
  targetHeight: 0.58,
  elevation: 0.14,
  distance: 1,
  luminosity: 1,
};

function pose(region: Partial<WorldCameraPose>): WorldCameraPose {
  return { ...CENTRE, ...region };
}

/**
 * Bearings, chosen so neighbours in meaning are neighbours in space.
 *
 * The brief asks (§21) that Calendar and Schedule sit next to each other —
 * "the transition between Calendar and Schedule should be spatially short" —
 * and they do, a sixth of a turn apart. The same reasoning spreads the rest:
 * what a couple does daily is on the near side, what they dream about is high
 * and slightly turned, and what looks outward faces away.
 */
const QUARTER = Math.PI / 2;
const SIXTH = Math.PI / 3;

const CRYSTAL_ATLAS: Readonly<Record<WorldRegion, WorldCameraPose>> = {
  centre: CENTRE,

  // The crown. Dreams sit at the top of the body and the camera rises to
  // them — §21's "moves upward and slightly closer".
  aspiration: pose({ azimuth: -SIXTH * 0.5, targetHeight: 0.86, elevation: -0.05, distance: 0.78 }),

  // An upper forward facet: what has been decided is still ahead, and faces
  // the couple.
  intention: pose({ azimuth: SIXTH * 0.5, targetHeight: 0.72, elevation: 0.04, distance: 0.84 }),

  // A lower side facet, near and plain. §21 asks for closer and lower, but
  // warns in the same breath to keep a large readable foreground — so this is
  // the least dramatic pose in the atlas, on purpose.
  provision: pose({ azimuth: QUARTER, targetHeight: 0.38, elevation: 0.08, distance: 0.92 }),

  // Inside the body. Closest of all, looking into the stone rather than at
  // it, because what is kept is embedded rather than displayed (§21, §33).
  memory: pose({ azimuth: -QUARTER, targetHeight: 0.55, elevation: 0.02, distance: 0.68 }),

  // The long side face: time runs along the body, so the camera takes the
  // view that shows the most of its length.
  chronicle: pose({ azimuth: Math.PI, targetHeight: 0.5, elevation: 0.06, distance: 0.95 }),

  // Next door to the chronicle, and deliberately so: days are the near part
  // of the same time (§21).
  routine: pose({ azimuth: Math.PI - SIXTH, targetHeight: 0.46, elevation: 0.07, distance: 0.9 }),

  // A darker polished side. Same world, lower light — §39.
  leisure: pose({ azimuth: Math.PI + SIXTH, targetHeight: 0.6, elevation: 0.05, distance: 0.86, luminosity: 0.72 }),

  // The base and what has settled in it. Looking slightly up, because a
  // foundation is seen from beside it rather than from above.
  foundation: pose({ azimuth: -QUARTER * 1.4, targetHeight: 0.18, elevation: -0.02, distance: 0.8 }),

  // The one warm region (§21). Warmth is the world's, not a second palette;
  // the pose only puts the camera where the warm light falls.
  hearth: pose({ azimuth: QUARTER * 1.4, targetHeight: 0.3, elevation: 0.05, distance: 0.82 }),

  // Turning away. The artifact starts leaving the centre of the frame and
  // the room opens (§21, §40).
  outward: pose({ azimuth: QUARTER * 1.7, targetHeight: 0.52, elevation: 0.12, distance: 1.25 }),

  // Outside. The map matters more than the crystal, so the crystal withdraws
  // rather than competing — §40 is explicit that usability wins here.
  external: pose({ azimuth: Math.PI * 0.75, targetHeight: 0.5, elevation: 0.2, distance: 1.8, luminosity: 0.45 }),

  // A way through rather than a face (§41). Close and low, as if about to
  // pass into it.
  threshold: pose({ azimuth: -Math.PI * 0.75, targetHeight: 0.42, elevation: -0.04, distance: 0.62, luminosity: 0.85 }),
};

export function crystalPoseForRegion(region: WorldRegion): WorldCameraPose {
  return CRYSTAL_ATLAS[region];
}

export { CENTRE as CRYSTAL_CENTRE_POSE };
