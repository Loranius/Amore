import { round6, seededUnit } from '../growth/math';
import type { GrowthBody } from '../growth';
import type { CrystalFacePlane, CrystalLodLevel } from './types';

/**
 * The planes a crystal is cut from.
 *
 * This module exists because of one observation from visual review
 * (2026-08-03): the crystal read as jewellery rather than as a mineral. Every
 * face was the same width, the same length, at the same angle, with the same
 * vertical rhythm from base to tip — because the mesh was a lathe. One ring
 * template was generated and then repeated at every height, so the only thing
 * that could differ between two faces was a ±5% radius.
 *
 * Natural quartz is not chaotic either. The lattice holds a hexagonal habit, so
 * the *faces stay flat* — but growth conditions make each one different: wider
 * or narrower, steeper or shallower, meeting its neighbours at its own height.
 * The rule the owner set is exactly right and worth keeping verbatim:
 *
 *   Do not make the surfaces curved or noisy. Make the flat surfaces unequal.
 *
 * A lathe cannot do that: any per-slice variation bends the quad between two
 * slices out of plane, which is what produced the "triangle mosaic" an earlier
 * pass was rejected for. So the crystal is no longer a lathe. It is the
 * intersection of half-spaces — each face is a plane by construction, so it is
 * exactly flat no matter how unequal the set is, and no amount of variation can
 * ever bring the mosaic back.
 *
 * Everything here is seeded from `body.seed`, so a couple's crystal has the same
 * geological identity on every reload, and each year crystal has its own.
 */

/** A half-space: the solid is every point with `normal · p <= offset`. */
export type { CrystalFacePlane };

/**
 * How far a prism plane's azimuth may wander from an even split, as a fraction
 * of the even step.
 *
 * This is what makes faces unequal in *width*. At the lathe's ±0.16 the six
 * faces still read as six equal faces; at this the difference is plain, and the
 * habit is still recognisably hexagonal because no face may cross its
 * neighbour's slot.
 */
const AZIMUTH_JITTER = 0.34;

/**
 * How far a prism plane sits from the axis, as a fraction of the body radius.
 *
 * A *smaller* offset cuts deeper and makes that face wider at the expense of
 * its neighbours, which is how one or two dominant faces appear. The range is
 * deliberately wide — this is the main lever on "one or two broad faces, a few
 * markedly narrower".
 */
const PRISM_OFFSET_MIN = 0.86;
const PRISM_OFFSET_MAX = 1.06;

/** The dominant face is pushed further in than the seeded range alone allows. */
const DOMINANT_INSET = 0.9;

/**
 * How much wider a prism face stands at its top than at the base, as a fraction
 * of the body radius.
 *
 * Always widening upward, never narrowing — and that direction is the whole
 * point. The reference crystals are narrow where they leave the ground and
 * swell gently to a shoulder; a symmetric range put the widest slice at the
 * *base* on roughly half of all seeds, which is a bullet, and "a ball sticking
 * out of the ground" is the exact complaint this shape exists to answer.
 *
 * The range is per face, so no two verticals share a rhythm — the flare is
 * unequal, its direction is not.
 *
 * Expressed as a taper rather than as an angle on purpose: the tilt needed to
 * move a face by a tenth of the radius over a body ten radii tall is under a
 * degree, and thinking in degrees here invites a number that closes the crystal
 * into a cone before it reaches its shoulder.
 */
const PRISM_FLARE_MIN = 0.05;
const PRISM_FLARE_MAX = 0.2;

/**
 * How much a crown face's shoulder may sit above or below the body's own, as a
 * fraction of the termination's length.
 *
 * Varied as a *height*, not as an angle. A crystal ten radii tall has crown
 * faces around 70° from horizontal, and the tangent is savage there: nine
 * degrees of jitter turned a termination meant to be a quarter of the body into
 * three fifths of it, so seeded variation was quietly reshaping the crystal
 * rather than detailing it. Jittering the shoulder height and deriving the
 * angle from it means a quarter stays a quarter, and the faces still meet the
 * shaft at their own heights — which is the thing being asked for.
 */
const CROWN_SHOULDER_SPREAD = 0.25;
/** Guard rails on the face's inclination: below this a dome, above it a spike. */
const CROWN_FACE_MIN_DEG = 46;
const CROWN_FACE_MAX_DEG = 84;

/** How far the tip sits off the axis, as a fraction of the radius. */
const APEX_DRIFT = 0.3;

/**
 * How far a termination plane may cut past the apex, as a fraction of the
 * radius.
 *
 * Non-zero is the whole point: when every crown plane passes exactly through
 * one point, the tip is a clean pencil point and the faces around it are
 * near-identical triangles — the thing review called out. Letting a couple of
 * them cut short leaves a small chiselled facet where the point would have
 * been, which is what a real termination looks like.
 */
const APEX_CUT = 0.16;

/** Bevels: a narrow secondary face taken off one vertical edge. */
const BEVEL_INSET_MIN = 0.9;
const BEVEL_INSET_MAX = 0.96;

/** Sanity box, so a degenerate seed can never produce an unbounded solid. */
const SAFETY_SPAN = 4;

function signed(seed: number, label: string): number {
  return seededUnit(seed, label) * 2 - 1;
}

function plane(
  nx: number,
  ny: number,
  nz: number,
  offset: number,
  kind: CrystalFacePlane['kind'],
): CrystalFacePlane {
  const length = Math.hypot(nx, ny, nz) || 1;
  return {
    normal: { x: round6(nx / length), y: round6(ny / length), z: round6(nz / length) },
    offset: round6(offset / length),
    kind,
  };
}

export interface CrystalPlaneInput {
  /** Local height the body starts at; the base plane sits here. */
  baseY: number;
  /** Local height of the tip. */
  topY: number;
  radius: number;
  /** Main prism faces — the hexagonal habit, six or seven. */
  mainFacets: number;
  /** Earned bevels (ADR-0004: photos), already capped. */
  bevels: number;
  /** Termination is cut back rather than pointed. */
  blunt: boolean;
  /** Termination is missing: the crystal broke. */
  broken: boolean;
  /** Where the shaft ends and the termination begins, as a share of height. */
  shoulderShare: number;
  lod: CrystalLodLevel;
}

/**
 * The full cut set for one crystal, in its own frame: +Y along the body's
 * direction, origin at the geometry anchor.
 *
 * Order is fixed — base, prisms, bevels, crown, safety — because the mesh
 * publishes faces in plane order and the base cap has to come first for
 * `trimCrystalMesh` to find it.
 */
export function buildCrystalFacePlanes(
  body: GrowthBody,
  input: CrystalPlaneInput,
): CrystalFacePlane[] {
  const { baseY, topY, radius, mainFacets, bevels } = input;
  const height = Math.max(1e-6, topY - baseY);
  const planes: CrystalFacePlane[] = [];

  // The base. Flat and square to the axis: it is buried under the quartz vein
  // (ADR-0003), and a shaped base would be geometry nobody can ever see.
  planes.push(plane(0, -1, 0, -baseY, 'base'));

  // ── Prism faces ───────────────────────────────────────────
  // Azimuths first, so a face's width is decided by where its neighbours are
  // rather than by its own number.
  const step = (Math.PI * 2) / mainFacets;
  const orientation = seededUnit(body.seed, 'planes:orientation') * Math.PI * 2;
  const dominant = Math.floor(seededUnit(body.seed, 'planes:dominant') * mainFacets);
  const secondDominant = (dominant + 2 + Math.floor(seededUnit(body.seed, 'planes:second') * 2))
    % mainFacets;

  const azimuths: number[] = [];
  for (let index = 0; index < mainFacets; index += 1) {
    azimuths.push(
      orientation
      + index * step
      + signed(body.seed, `planes:azimuth:${index}`) * step * AZIMUTH_JITTER,
    );
  }

  const prisms: { azimuth: number; ny: number; offset: number; d: number }[] = [];
  for (let index = 0; index < mainFacets; index += 1) {
    const azimuth = azimuths[index]!;
    const spread = PRISM_OFFSET_MAX - PRISM_OFFSET_MIN;
    let offset = radius * (
      PRISM_OFFSET_MIN + seededUnit(body.seed, `planes:offset:${index}`) * spread
    );
    // Two faces the eye can land on. Without them the set is unequal but
    // uniformly so, which reads as noise rather than as habit.
    if (index === dominant) offset *= DOMINANT_INSET;
    if (index === secondDominant) offset *= DOMINANT_INSET + 0.04;

    // Each face carries its own flare, so no two verticals share a rhythm. The
    // plane is pinned at mid-height, so the flare opens the face at the top by
    // as much as it closes it at the base and the body keeps its girth.
    //
    // A positive `ny` tips the plane so the face stands further out at the base
    // than at the top, so the flare enters negated: this crystal is narrower
    // where it leaves the quartz.
    const flare = radius * (
      PRISM_FLARE_MIN
      + seededUnit(body.seed, `planes:flare:${index}`) * (PRISM_FLARE_MAX - PRISM_FLARE_MIN)
    );
    const ny = -flare / height;
    const midY = baseY + height * 0.5;
    const d = offset + ny * midY;
    prisms.push({ azimuth, ny, offset, d });
    planes.push(plane(Math.sin(azimuth), ny, Math.cos(azimuth), d, 'prism'));
  }

  // ── Bevels ────────────────────────────────────────────────
  // A cut across one vertical edge, between two prism faces. This is what a
  // couple's photos buy (ADR-0004): a new narrow face and a new edge, with the
  // silhouette barely moved — never another belt of strips around the body.
  const bevelBudget = input.lod === 'low' ? 0 : bevels;
  const edges = new Set<number>();
  for (let index = 0; index < bevelBudget; index += 1) {
    const candidate = Math.floor(
      ((index * 0.6180339887 + seededUnit(body.seed, 'planes:bevel-phase')) % 1) * mainFacets,
    );
    let edge = candidate;
    for (let probe = 0; probe < mainFacets; probe += 1) {
      const trial = (candidate + probe) % mainFacets;
      if (!edges.has(trial)) { edge = trial; break; }
    }
    if (edges.has(edge)) break;
    edges.add(edge);

    const left = prisms[edge]!;
    const right = prisms[(edge + 1) % mainFacets]!;
    let gap = right.azimuth - left.azimuth;
    while (gap <= 0) gap += Math.PI * 2;
    const azimuth = left.azimuth + gap * 0.5;
    const inset = BEVEL_INSET_MIN
      + seededUnit(body.seed, `planes:bevel-inset:${index}`) * (BEVEL_INSET_MAX - BEVEL_INSET_MIN);

    // Where the two faces actually meet, solved rather than approximated.
    //
    // The approximation this replaces was `radius / cos(half-gap)`, which
    // ignores that each face sits at its own distance and that the azimuths are
    // unevenly spaced. It put the bevel *outside* the edge it was meant to cut,
    // so instead of removing a corner the plane became the widest surface on
    // the crystal — and because it was vertical while the prism faces flare, it
    // made the body narrower going up. The monarch came out a bullet.
    const midY = baseY + height * 0.5;
    const sinL = Math.sin(left.azimuth);
    const cosL = Math.cos(left.azimuth);
    const sinR = Math.sin(right.azimuth);
    const cosR = Math.cos(right.azimuth);
    const determinant = sinL * cosR - cosL * sinR;
    if (Math.abs(determinant) < 1e-6) continue;
    const rl = left.d - left.ny * midY;
    const rr = right.d - right.ny * midY;
    const cornerX = (rl * cosR - cosL * rr) / determinant;
    const cornerZ = (sinL * rr - rl * sinR) / determinant;
    const cornerReach = Math.hypot(cornerX, cornerZ);
    if (!(cornerReach > 0)) continue;

    planes.push(plane(
      Math.sin(azimuth),
      // Follows the flare of the faces it sits between, so a bevel never
      // reverses the direction the body opens in.
      (left.ny + right.ny) * 0.5,
      Math.cos(azimuth),
      cornerReach * inset + (left.ny + right.ny) * 0.5 * midY,
      'bevel',
    ));
  }

  // ── Termination ───────────────────────────────────────────
  // Not a fan of identical triangles to a point on the axis. The apex drifts,
  // every crown plane takes its own pitch and its own azimuth, and a couple of
  // them cut short of the apex so the point is chiselled rather than turned.
  const apexAngle = seededUnit(body.seed, 'planes:apex-angle') * Math.PI * 2;
  const apexDrift = radius * APEX_DRIFT * seededUnit(body.seed, 'planes:apex-drift');
  const apex = {
    x: Math.cos(apexAngle) * apexDrift,
    y: input.broken
      ? baseY + height * (0.86 + seededUnit(body.seed, 'planes:broken') * 0.05)
      : input.blunt
        ? baseY + height * 0.93
        : topY,
    z: Math.sin(apexAngle) * apexDrift,
  };

  // The inclination the body's own shoulder asks for: a termination that is
  // `1 - shoulderShare` of the height tall over a face standing `radius` out.
  const terminationRise = Math.max(1e-6, height * (1 - input.shoulderShare));


  const crownCount = input.lod === 'low' ? Math.min(4, mainFacets) : mainFacets;
  for (let index = 0; index < crownCount; index += 1) {
    // Sits over its own prism face, but not squarely: the offset azimuth is
    // what stops the crown from reading as a cap bolted onto the shaft.
    const azimuth = azimuths[index % mainFacets]!
      + signed(body.seed, `planes:crown-azimuth:${index}`) * step * 0.3;
    const rise = terminationRise * (
      1 + signed(body.seed, `planes:crown-pitch:${index}`) * CROWN_SHOULDER_SPREAD
    );
    const faceDeg = Math.min(CROWN_FACE_MAX_DEG, Math.max(
      CROWN_FACE_MIN_DEG,
      Math.atan2(rise, Math.max(1e-6, radius)) * (180 / Math.PI),
    ));
    // The plane's *normal* stands at the complement of the face it describes.
    // Taking the face's own inclination for the normal is an inversion that
    // renders: it turned a termination meant to be a quarter of the body into
    // one four percent of it, and the crystal became a column with a nub.
    const pitch = (90 - faceDeg) * (Math.PI / 180);
    const nx = Math.sin(azimuth) * Math.cos(pitch);
    const nz = Math.cos(azimuth) * Math.cos(pitch);
    const ny = Math.sin(pitch);
    const through = nx * apex.x + ny * apex.y + nz * apex.z;
    // Negative cut = this plane bites into the tip and leaves a facet there.
    const cut = Math.min(0, signed(body.seed, `planes:crown-cut:${index}`)) * APEX_CUT * radius;
    planes.push(plane(nx, ny, nz, through + cut, 'crown'));
  }

  if (input.blunt || input.broken) {
    // A blunt or broken termination is a plane where the point should have
    // been, tilted a little so it never reads as a saw cut.
    const tiltAngle = seededUnit(body.seed, 'planes:break-angle') * Math.PI * 2;
    const tilt = 0.12 + seededUnit(body.seed, 'planes:break-tilt') * 0.16;
    const nx = Math.cos(tiltAngle) * tilt;
    const nz = Math.sin(tiltAngle) * tilt;
    planes.push(plane(nx, 1, nz, nx * apex.x + apex.y + nz * apex.z, 'crown'));
  }

  // ── Safety box ────────────────────────────────────────────
  // Guarantees the intersection is bounded whatever the seed produced. Placed
  // well outside the body, so on any real seed these planes touch nothing and
  // contribute no face — `planes.test.ts` holds them to that.
  const span = radius * SAFETY_SPAN;
  planes.push(plane(1, 0, 0, span, 'safety'));
  planes.push(plane(-1, 0, 0, span, 'safety'));
  planes.push(plane(0, 0, 1, span, 'safety'));
  planes.push(plane(0, 0, -1, span, 'safety'));
  planes.push(plane(0, 1, 0, topY + height * 0.5, 'safety'));

  return planes;
}

/**
 * Maps a plane through the body's anisotropy and lean.
 *
 * Both are affine maps of the solid, and an affine map takes planes to planes —
 * which is the reason they are allowed to exist at all. The lathe's *twist* was
 * not affine: it rotated each slice by a different angle, which bends a face
 * into a helicoid. It is gone, and this is where it would have had to live.
 *
 * Planes transform by the inverse transpose, not by the map itself.
 */
export function transformCrystalPlane(
  source: CrystalFacePlane,
  scaleX: number,
  scaleZ: number,
  leanX: number,
  leanZ: number,
): CrystalFacePlane {
  // Scale first: n -> (nx/sx, ny, nz/sz).
  const sx = Math.max(1e-6, scaleX);
  const sz = Math.max(1e-6, scaleZ);
  const nx = source.normal.x / sx;
  const nz = source.normal.z / sz;
  // Then the shear x += leanX*y, z += leanZ*y: n -> (nx, ny - leanX*nx - leanZ*nz, nz).
  const ny = source.normal.y - leanX * nx - leanZ * nz;
  const length = Math.hypot(nx, ny, nz) || 1;
  return {
    normal: { x: round6(nx / length), y: round6(ny / length), z: round6(nz / length) },
    offset: round6(source.offset / length),
    kind: source.kind,
  };
}
