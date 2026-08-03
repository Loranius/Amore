import { stableHash32 } from '../evolution';
import {
  add,
  round6,
  roundVec,
  scale,
  seededUnit,
} from '../growth/math';
import type { GrowthAttributeValue, GrowthBody, GrowthTier } from '../growth';
import { buildCrystalFacePlanes, transformCrystalPlane } from './planes';
import { intersectHalfSpaces, polytopeTolerance } from './polytope';
import type {
  CrystalBodyProfile,
  CrystalLodLevel,
  CrystalProfileRow,
  CrystalRingFacet,
} from './types';

interface ProfileShapeTuning {
  asymmetry: number;
  twist: number;
  lean: number;
  phase: number;
}

function stringAttribute(value: GrowthAttributeValue | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function baseSegments(tier: GrowthTier): number {
  if (tier === 'king') return 10;
  if (tier === 'support') return 9;
  if (tier === 'family') return 8;
  if (tier === 'companion') return 6;
  return 5;
}

export function crystalSegments(tier: GrowthTier, lod: CrystalLodLevel): number {
  const high = baseSegments(tier);
  if (lod === 'high') return high;
  if (lod === 'medium') return Math.max(5, high - 2);
  return Math.max(4, Math.ceil(high * 0.6));
}

/**
 * How a body's cross-section is spent.
 *
 * ADR-0004 turned uploaded photos into facets, and the previous build spent
 * them all on more sides — a monarch with many photos had up to 24 of them.
 * Visual review rejected the result as a "pink obelisk": every face was narrow,
 * and narrow faces read as noise rather than as a cut stone.
 *
 * The main faces are now fixed at six or seven, and everything earned beyond
 * them becomes a chamfer — a cut on one specific edge, adding a narrow face and
 * a new edge without wrapping another belt of strips around the body.
 */
function facetPlan(
  body: GrowthBody,
  mother: boolean,
): { mainFacets: number; chamfers: number } {
  const min = mother ? MAIN_FACET_MIN : CHILD_FACET_MIN;
  const max = mother ? MAIN_FACET_MAX : CHILD_FACET_MAX;
  const mainFacets = min + (seededUnit(body.seed, 'geometry:main-facets') < 0.5 ? 0 : max - min);

  const published = body.attributes['facetCount'];
  const earned = typeof published === 'number' && Number.isFinite(published)
    ? Math.max(0, Math.round(published) - min)
    : 0;
  return { mainFacets, chamfers: Math.min(MAX_CHAMFERS, earned) };
}

function profileScales(archetype: string): { scaleX: number; scaleZ: number } {
  if (archetype === 'blade') return { scaleX: 0.52, scaleZ: 1.18 };
  if (archetype === 'tabular') return { scaleX: 0.66, scaleZ: 1.14 };
  if (archetype === 'needle') return { scaleX: 0.78, scaleZ: 0.78 };
  if (archetype === 'massive') return { scaleX: 1.06, scaleZ: 1.06 };
  if (archetype === 'fan') return { scaleX: 0.82, scaleZ: 1.08 };
  return { scaleX: 1, scaleZ: 1 };
}

function shapeTuning(archetype: string, mother: boolean): ProfileShapeTuning {
  // The mother crystal is the dominant mobile silhouette. Phase 3A must remain
  // clearly readable even at low LOD instead of being limited to sub-pixel noise.
  // The monarch is the axis of the colony: central, tallest, and near-vertical.
  // Its lean used to be the *largest* of any body (0.26 against 0.1 for a
  // default child), which is backwards — the one crystal that has to read as
  // the centre was the one leaning hardest, and the children it should have
  // been leaning against stood straight.
  if (mother) return { asymmetry: 0.18, twist: 0.2, lean: 0.09, phase: 0.08 };
  if (archetype === 'blade') return { asymmetry: 0.18, twist: 0.14, lean: 0.24, phase: 0.09 };
  if (archetype === 'tabular') return { asymmetry: 0.14, twist: 0.1, lean: 0.16, phase: 0.07 };
  if (archetype === 'needle') return { asymmetry: 0.06, twist: 0.16, lean: 0.2, phase: 0.055 };
  if (archetype === 'massive') return { asymmetry: 0.12, twist: 0.075, lean: 0.12, phase: 0.05 };
  if (archetype === 'fan') return { asymmetry: 0.17, twist: 0.18, lean: 0.26, phase: 0.095 };
  if (archetype === 'etched') return { asymmetry: 0.16, twist: 0.17, lean: 0.2, phase: 0.11 };
  return { asymmetry: 0.09, twist: 0.11, lean: 0.2, phase: 0.055 };
}

function signedUnit(seed: number, label: string): number {
  return seededUnit(seed, label) * 2 - 1;
}

/**
 * Where the shaft ends and the termination begins, as a fraction of the body's
 * own height. Seeded per body so no two crystals in a colony carry the same
 * crown.
 */
const SHOULDER_MIN = 0.7;
const SHOULDER_MAX = 0.78;

/**
 * How deep the monarch stands in the quartz vein, as a fraction of her visible
 * length.
 *
 * Ten percent. Enough that the seam closes over her base and the meeting line
 * is quartz rather than a clean circle of stone; not so much that the crystal
 * loses height, which is the one thing it is supposed to communicate.
 */
const MONARCH_GROUND_SINK = 0.1;

function shoulderFraction(seed: number): number {
  return SHOULDER_MIN + seededUnit(seed, 'geometry:shoulder') * (SHOULDER_MAX - SHOULDER_MIN);
}

/**
 * The shared crystal profile: a narrow base, a shaft that widens gently to a
 * shoulder, then a short sharp termination.
 *
 * One builder for the monarch and for every child. They differ in height,
 * girth, facet count, shoulder height and tip bluntness — not in what kind of
 * shape they are. A colony whose members are built by different code is a
 * colony whose members read as different objects.
 */
/**
 * Facets of the shaft, before any earned chamfers.
 *
 * Six or seven, and no more. Visual review rejected the previous crystal as a
 * "pink obelisk with a mosaic of small triangles": earning up to 24 sides made
 * every face narrow, and narrow faces read as noise rather than as a cut stone.
 * A quartz prism has six large ones.
 */
const MAIN_FACET_MIN = 6;
const MAIN_FACET_MAX = 7;
/** Children read as the monarch's own mineral, one or two faces simpler. */
const CHILD_FACET_MIN = 5;
const CHILD_FACET_MAX = 6;

/**
 * How wide a chamfer is, as a fraction of the gap between two main facets.
 * Narrow enough to read as a cut corner rather than as another side.
 */
const CHAMFER_WIDTH = 0.22;
/** How far a chamfer sits inside the main radius — a cut removes material. */
const CHAMFER_INSET = 0.965;
/** Ceiling on earned chamfers, so a couple with thousands of photos still has a prism. */
const MAX_CHAMFERS = 6;

/** Main facets differ in width by up to this much, so the prism is cut rather than machined. */
const FACET_WIDTH_JITTER = 0.16;
/** ...and in radius by this much, which is a per-facet constant and so keeps faces flat. */
const FACET_RADIUS_JITTER = 0.05;

/**
 * The cross-section, built once and shared by every slice.
 *
 * Photos are the reason this is a list rather than a segment count. ADR-0004
 * turned uploaded photos into facets, and the previous build spent them on more
 * sides — which wrapped another belt of narrow strips around the whole body. A
 * chamfer instead takes one specific edge and cuts it: a new, narrow face and a
 * new edge, with the silhouette barely moved and the six large faces intact.
 */
function buildRing(
  seed: number,
  mainFacets: number,
  chamfers: number,
  orientation: number,
): CrystalRingFacet[] {
  const step = (Math.PI * 2) / mainFacets;
  const main: CrystalRingFacet[] = [];
  for (let index = 0; index < mainFacets; index += 1) {
    // Width jitter is applied to the *angle* of each edge and stays constant
    // down the body, so faces vary in width without ever going non-planar.
    const offset = signedUnit(seed, `geometry:facet-width:${index}`) * step * FACET_WIDTH_JITTER;
    main.push({
      angle: round6(orientation + index * step + offset),
      radiusScale: round6(1 + signedUnit(seed, `geometry:facet-radius:${index}`) * FACET_RADIUS_JITTER),
      chamfer: false,
    });
  }

  const wanted = Math.max(0, Math.min(MAX_CHAMFERS, chamfers));
  if (wanted === 0) return main;

  // Each chamfer replaces one edge between two main facets. Distinct edges,
  // spread by the golden ratio so consecutive earned facets never land next to
  // each other and clump into one wide bevel.
  const edges = new Set<number>();
  for (let index = 0; index < wanted; index += 1) {
    const candidate = Math.floor(((index * 0.6180339887 + seededUnit(seed, 'geometry:chamfer-phase')) % 1) * mainFacets);
    for (let probe = 0; probe < mainFacets; probe += 1) {
      const edge = (candidate + probe) % mainFacets;
      if (!edges.has(edge)) { edges.add(edge); break; }
    }
  }

  const ring: CrystalRingFacet[] = [];
  for (let index = 0; index < mainFacets; index += 1) {
    ring.push(main[index]!);
    if (!edges.has(index)) continue;
    const next = main[(index + 1) % mainFacets]!;
    let gap = next.angle - main[index]!.angle;
    if (gap <= 0) gap += Math.PI * 2;
    ring.push({
      angle: round6(main[index]!.angle + gap * (0.5 - CHAMFER_WIDTH * 0.5)),
      radiusScale: round6(main[index]!.radiusScale * CHAMFER_INSET),
      chamfer: true,
    });
    ring.push({
      angle: round6(main[index]!.angle + gap * (0.5 + CHAMFER_WIDTH * 0.5)),
      radiusScale: round6(next.radiusScale * CHAMFER_INSET),
      chamfer: true,
    });
  }
  return ring;
}

/**
 * The envelope `rows` describe, measured off the finished solid.
 *
 * Since ADR-0006 the rows are a *report*, not a recipe: the shape is the plane
 * set, and this measures it so readers that only want "how wide is the body at
 * that height" keep working unchanged — the renderer's fit, the composition's
 * solids, the trim's bounds sweep.
 *
 * Two decisions make it correct rather than approximately correct.
 *
 * The sample heights are the solid's own vertex heights. A convex polytope's
 * cross-section radius is piecewise linear in height with its breakpoints
 * exactly there, so a piecewise-linear envelope through those samples is not an
 * approximation of the body — it is the body. Sampling at evenly spaced heights
 * instead smeared the shoulder across the whole shaft: on a monarch the base
 * came out as wide as the widest slice and the tip at 90% of it, which is a
 * cylinder, not a crystal.
 *
 * The radius is the circumscribed circle, not the per-axis extent. `trim.ts`
 * reads a row as an *ellipse* with semi-axes `radiusX`/`radiusZ`, and an
 * ellipse through the furthest point on each axis does not contain the polygon
 * between them — a square's corners sit outside the ellipse through its edge
 * midpoints. An envelope that cut inside the crystal would let the trim delete
 * triangles that are genuinely visible.
 */
function envelopeRows(
  polytope: NonNullable<ReturnType<typeof intersectHalfSpaces>>,
  topY: number,
): CrystalProfileRow[] {
  const edges = new Set<string>();
  for (const face of polytope.faces) {
    for (let index = 0; index < face.loop.length; index += 1) {
      const from = face.loop[index]!;
      const to = face.loop[(index + 1) % face.loop.length]!;
      edges.add(from < to ? `${from}:${to}` : `${to}:${from}`);
    }
  }
  const edgePairs = [...edges].sort().map((key) => key.split(':').map(Number) as [number, number]);

  /** Furthest any point of the solid sits from the axis at this height. */
  const reachAt = (y: number): number => {
    let reach = 0;
    for (const vertex of polytope.vertices) {
      if (Math.abs(vertex.y - y) > 1e-9) continue;
      reach = Math.max(reach, Math.hypot(vertex.x, vertex.z));
    }
    for (const [from, to] of edgePairs) {
      const a = polytope.vertices[from]!;
      const b = polytope.vertices[to]!;
      const span = b.y - a.y;
      if (Math.abs(span) < 1e-12) continue;
      const t = (y - a.y) / span;
      if (t < 0 || t > 1) continue;
      reach = Math.max(reach, Math.hypot(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t));
    }
    return Math.max(1e-4, reach);
  };

  const heights = [...new Set(polytope.vertices.map((vertex) => round6(vertex.y)))]
    .sort((left, right) => left - right);
  // The tip is a sample even when no vertex sits exactly on it, so the envelope
  // always spans the body a reader was told it has.
  if ((heights[heights.length - 1] ?? 0) < topY - 1e-6) heights.push(round6(topY));

  return heights.map((y) => {
    const reach = round6(reachAt(y));
    return {
      y,
      radius: reach,
      radiusX: reach,
      radiusZ: reach,
      centerOffsetX: 0,
      centerOffsetZ: 0,
      rotation: 0,
      facetPhase: 0,
    };
  });
}

/**
 * Canonical crystal profile. The logical GrowthBody remains untouched; attached
 * meshes receive a local backward extension so the seam sits inside the host.
 */
export function buildCrystalProfile(
  body: GrowthBody,
  lod: CrystalLodLevel,
): CrystalBodyProfile {
  const formationKind = stringAttribute(body.attributes.formationKind, 'unknown');
  const mother = formationKind === 'mother' || body.kind === 'crystal:mother';
  const sourceArchetype = stringAttribute(body.attributes.archetype, 'prismatic');
  // The mother may carry a seeded geological label, but its composition role
  // requires a recognisable central prism in every renderer quality tier.
  const archetype = mother ? 'prismatic' : sourceArchetype;
  const attached = body.hostBodyId !== null && body.attachment !== null;
  // The monarch stands *in* the quartz vein, not on it.
  //
  // She used to start exactly at y=0, which is what made her read as set down
  // on a pad: the seam met her base in a clean circle all the way round, and a
  // crystal that grew through stone does not do that. Sinking her a tenth of
  // her visible height puts the meeting line under the quartz, so the vein
  // closes over her base the way it closes over every child's.
  //
  // A fraction of length rather than a constant: it has to stay the same
  // gesture on a one-year crystal and on a ten-year one.
  const grounded = mother && !attached;
  const extraSink = attached
    ? Math.max(body.attachment?.burialDepth ?? 0, body.renderedRadius * 0.58)
    : grounded
      ? body.renderedLength * MONARCH_GROUND_SINK
      : 0;
  const geometryLength = body.renderedLength + extraSink;
  const geometryAnchor = extraSink > 0
    ? add(body.anchor, scale(body.direction, -extraSink))
    : body.anchor;
  const radius = Math.max(0.0001, body.renderedRadius);

  // Blunt and broken terminations still exist — they are what makes a colony
  // read as grown rather than manufactured — but they are now variations on
  // one prism, not separate shapes. Both are expressed as where the crown
  // planes converge (see `buildCrystalFacePlanes`), not as a tip radius: a
  // lathe needed a radius to close its fan, and there is no fan any more.
  const blunt = !mother && (archetype === 'tabular' || archetype === 'massive');
  const broken = !mother && archetype === 'etched';

  // The monarch keeps a slight elliptical cross-section so it never reads as a
  // machined cylinder, but 0.78/1.12 was a 1.44:1 slab that looked flat from
  // the front and thin from the side. 1.18:1 keeps the organic asymmetry while
  // presenting a consistent silhouette as the camera orbits.
  const scales = mother ? { scaleX: 0.9, scaleZ: 1.06 } : profileScales(archetype);
  const tuning = shapeTuning(archetype, mother);
  const leanAngle = seededUnit(body.seed, 'geometry:lean-angle') * Math.PI * 2;
  const leanMagnitude = radius * tuning.lean * (
    0.5 + seededUnit(body.seed, 'geometry:lean-strength') * 0.5
  );
  const axisLeanX = round6(Math.cos(leanAngle) * leanMagnitude);
  const axisLeanZ = round6(Math.sin(leanAngle) * leanMagnitude);
  const burialStartY = attached ? round6(extraSink) : 0;
  const burialCompression = attached
    ? round6(0.62 + seededUnit(body.seed, 'geometry:burial-compression') * 0.14)
    : 1;
  const plan = facetPlan(body, mother);
  const ring = buildRing(body.seed, plan.mainFacets, plan.chamfers, 0);
  const segments = ring.length;

  // The cut set, in a frame where the body is round and upright, then bent into
  // its own by the two affine maps it is allowed: anisotropy and lean.
  //
  // Twist is not among them, and that is the one deliberate loss here. A twist
  // rotates every height by a different angle, which is not affine — it turns a
  // flat face into a helicoid, and a helicoid has to be tessellated into
  // triangles that no longer share a normal. That is precisely the mosaic. A
  // crystal's asymmetry now comes from the faces being unequal instead.
  const planes = buildCrystalFacePlanes(body, {
    baseY: 0,
    topY: geometryLength,
    radius,
    mainFacets: plan.mainFacets,
    bevels: plan.chamfers,
    blunt,
    broken,
    shoulderShare: broken ? 0.88 : shoulderFraction(body.seed),
    lod,
  }).map((face) => transformCrystalPlane(
    face,
    scales.scaleX,
    scales.scaleZ,
    axisLeanX / Math.max(1e-6, geometryLength),
    axisLeanZ / Math.max(1e-6, geometryLength),
  ));

  const polytope = intersectHalfSpaces(planes, polytopeTolerance(radius));
  if (polytope === null) {
    throw new Error(`Crystal Geometry could not close a solid for "${body.id}".`);
  }
  const rows = envelopeRows(polytope, geometryLength);
  const signaturePayload = JSON.stringify({
    bodyId: body.id,
    seed: body.seed,
    archetype,
    formationKind,
    tier: body.tier,
    lod,
    segments,
    ring,
    planes,
    extraSink: round6(extraSink),
    geometryLength: round6(geometryLength),
    rows,
    scales,
    axisLeanX,
    axisLeanZ,
    burialStartY,
    burialCompression,
  });

  return {
    profileVersion: 1,
    bodyId: body.id,
    archetype,
    lod,
    segments,
    extraSink: round6(extraSink),
    geometryLength: round6(geometryLength),
    geometryAnchor: roundVec(geometryAnchor),
    scaleX: scales.scaleX,
    scaleZ: scales.scaleZ,
    // Published as zero rather than dropped: the field is part of Geometry
    // State v1 and a reader may still be looking at it. Nothing twists now.
    twistTotal: 0,
    axisLeanX,
    axisLeanZ,
    burialStartY,
    burialCompression,
    rows,
    ring,
    planes,
    signature: stableHash32(signaturePayload).toString(16).padStart(8, '0'),
  };
}
