import { stableHash32 } from '../evolution';
import {
  add,
  round6,
  roundVec,
  scale,
  seededUnit,
} from '../growth/math';
import type { GrowthAttributeValue, GrowthBody, GrowthTier } from '../growth';
import type {
  CrystalBodyProfile,
  CrystalLodLevel,
  CrystalProfileRow,
  CrystalRingFacet,
} from './types';

interface BaseProfileRow {
  y: number;
  radius: number;
}

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

function appendBaseRow(rows: BaseProfileRow[], y: number, radius: number): void {
  const safeY = round6(Math.max(0, y));
  const safeRadius = round6(Math.max(0.0001, radius));
  const previous = rows[rows.length - 1];
  if (previous && safeY <= previous.y + 1e-6) {
    previous.radius = Math.max(previous.radius, safeRadius);
    return;
  }
  rows.push({ y: safeY, radius: safeRadius });
}

/**
 * Where the shaft ends and the termination begins, as a fraction of the body's
 * own height. Seeded per body so no two crystals in a colony carry the same
 * crown.
 */
const SHOULDER_MIN = 0.7;
const SHOULDER_MAX = 0.78;

/**
 * Radius at the base, as a fraction of the widest point.
 *
 * The reference crystals are narrower where they leave the ground and widen
 * gently on the way up. The previous profile did the opposite: widest at 12% of
 * its height and tapering from there, which is a bullet, not a prism — and read
 * as "a ball sticking out of the ground" no matter how well it was faceted.
 * The widest point is now the shoulder, and this is where the crystal starts.
 */
const BASE_WAIST = 0.88;

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
function appendPrismRows(
  rows: BaseProfileRow[],
  options: {
    bodyStart: number;
    length: number;
    radius: number;
    tipRadius: number;
    shoulderShare: number;
  },
): void {
  const { bodyStart, length, radius, tipRadius, shoulderShare } = options;
  const at = (fraction: number): number => bodyStart + length * fraction;

  // Base and shoulder, and nothing between them.
  //
  // The shaft used to carry four intermediate slices. They were added to give
  // the surface somewhere to break, back when a smooth lathe was the problem —
  // but each one is another horizontal band across every side face, and once
  // the faces are genuinely flat the bands are all the eye sees. The body of a
  // quartz prism is one uninterrupted run.
  //
  // The swell across it is small on purpose: the radius is nearly constant, so
  // the sides read as parallel and the shoulder is the only place the
  // silhouette turns a corner.
  appendBaseRow(rows, at(0), radius * BASE_WAIST);
  appendBaseRow(rows, at(shoulderShare), radius);

  // Termination: shoulder ring straight to the point, and nothing in between.
  //
  // The crown carried up to two intermediate rows placed on `pow(along, 0.8)`.
  // An exponent under one falls faster than a straight line right after the
  // shoulder, so the radius was pinched inward there and eased out again toward
  // the tip — the crown curved inward instead of running straight, which visual
  // review caught (2026-08-03).
  //
  // Rather than straightening the curve, the rows are gone. A row that sits
  // exactly on the line from shoulder to tip is invisible by construction, so
  // it would cost vertices and show nothing; one that sits off the line is a
  // curve again. Each crown face is now a single large triangle from the
  // shoulder ring to the point, which is what the references show and what a
  // quartz termination is.
  //
  // The "additional deliberate cuts" the brief asks for are the ring's
  // chamfers, which run the full height of the crystal — a vertical cut, not a
  // horizontal band.
  appendBaseRow(rows, at(1), tipRadius);
}

function smoothStep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

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

function decorateRows(
  rows: readonly BaseProfileRow[],
  scales: { scaleX: number; scaleZ: number },
  twistTotal: number,
  axisLeanX: number,
  axisLeanZ: number,
  burialStartY: number,
  burialCompression: number,
): CrystalProfileRow[] {
  const lastY = Math.max(1e-9, rows[rows.length - 1]?.y ?? 0);
  const minimumScale = Math.max(0.0001, Math.min(scales.scaleX, scales.scaleZ));

  // Everything a slice is allowed to do is here, and the list is short on
  // purpose: scale its radius, and translate its centre. Both keep the quad
  // between two slices a trapezoid — bottom and top edges stay parallel, so the
  // four corners are coplanar and both triangles share one normal.
  //
  // What used to be here and is gone: a per-slice turn, a per-slice sideways
  // drift, a per-slice radius swing, a per-slice facet phase and an elliptical
  // pulse that varied the X:Z ratio with height. Every one of them rotates or
  // re-shapes the ring between two rows, which tilts the top edge out of
  // parallel with the bottom one. The quad stops being flat, its two triangles
  // take different normals, and the crystal renders as a mosaic of small
  // triangles rather than as a handful of large faces (visual review,
  // 2026-08-03). They were added to break up a smooth lathe; the answer to a
  // smooth lathe is fewer, larger, genuinely flat faces.
  const raw = rows.map((row) => {
    const t = Math.max(0, Math.min(1, row.y / lastY));
    // The axis leans as one piece. Linear in t rather than eased: a curve bends
    // the body, and a bent prism has no flat side.
    const centerOffsetX = axisLeanX * t;
    const centerOffsetZ = axisLeanZ * t;
    const burialT = burialStartY > 1e-9
      ? Math.max(0, Math.min(1, row.y / burialStartY))
      : 1;
    const compression = burialStartY > 0 && row.y < burialStartY
      ? burialCompression + (1 - burialCompression) * smoothStep(burialT)
      : 1;
    return {
      baseRadius: row.radius,
      y: row.y,
      radiusX: Math.max(0.0001, row.radius * scales.scaleX * compression),
      radiusZ: Math.max(0.0001, row.radius * scales.scaleZ * compression),
      centerOffsetX,
      centerOffsetZ,
      // One orientation for the whole body. A crystal twists as a unit or not
      // at all.
      rotation: twistTotal,
      facetPhase: 0,
    };
  });

  return raw.map((row) => {
    const offsetEnvelope = Math.hypot(row.centerOffsetX, row.centerOffsetZ) / minimumScale;
    const conservativeRadius = Math.max(
      row.baseRadius,
      row.radiusX / Math.max(0.0001, scales.scaleX),
      row.radiusZ / Math.max(0.0001, scales.scaleZ),
    ) + offsetEnvelope;
    const radiusX = row.radiusX;
    const radiusZ = row.radiusZ;

    return {
      y: row.y,
      radius: round6(conservativeRadius),
      radiusX: round6(radiusX),
      radiusZ: round6(radiusZ),
      centerOffsetX: round6(row.centerOffsetX),
      centerOffsetZ: round6(row.centerOffsetZ),
      rotation: round6(row.rotation),
      facetPhase: round6(row.facetPhase),
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
  const extraSink = attached
    ? Math.max(body.attachment?.burialDepth ?? 0, body.renderedRadius * 0.58)
    : 0;
  const geometryLength = body.renderedLength + extraSink;
  const geometryAnchor = attached
    ? add(body.anchor, scale(body.direction, -extraSink))
    : body.anchor;
  const radius = Math.max(0.0001, body.renderedRadius);
  const bodyStart = extraSink;
  const baseRows: BaseProfileRow[] = [];

  // Blunt and broken terminations still exist — they are what makes a colony
  // read as grown rather than manufactured — but they are now variations on
  // one prism, not separate shapes.
  const blunt = !mother && (archetype === 'tabular' || archetype === 'massive');
  const broken = !mother && archetype === 'etched';
  const tipRadius = broken
    ? radius * 0.3
    : blunt
      ? radius * 0.16
      : radius * 0.018;

  if (attached) {
    // The buried run below the host surface stays narrow: it is the part that
    // has to disappear into the rock without showing a rim.
    const buriedBase = Math.min(radius * 0.18, Math.max(radius * 0.055, extraSink * 0.28));
    appendBaseRow(baseRows, 0, buriedBase);
    appendBaseRow(baseRows, extraSink * 0.5, radius * 0.42);
    appendBaseRow(baseRows, extraSink, radius * 0.68);
  }

  appendPrismRows(baseRows, {
    bodyStart,
    length: body.renderedLength,
    radius,
    tipRadius,
    // A broken crystal has lost its point, so what is left of it is nearly all
    // shaft.
    shoulderShare: broken ? 0.88 : shoulderFraction(body.seed),
  });

  // The monarch keeps a slight elliptical cross-section so it never reads as a
  // machined cylinder, but 0.78/1.12 was a 1.44:1 slab that looked flat from
  // the front and thin from the side. 1.18:1 keeps the organic asymmetry while
  // presenting a consistent silhouette as the camera orbits.
  const scales = mother ? { scaleX: 0.9, scaleZ: 1.06 } : profileScales(archetype);
  const tuning = shapeTuning(archetype, mother);
  const twistSign = signedUnit(body.seed, 'geometry:twist-sign') < 0 ? -1 : 1;
  const twistTotal = round6(
    twistSign * tuning.twist * (0.55 + seededUnit(body.seed, 'geometry:twist-strength') * 0.45),
  );
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
  const ring = buildRing(body.seed, plan.mainFacets, plan.chamfers, twistTotal);
  const segments = ring.length;
  const rows = decorateRows(
    baseRows,
    scales,
    twistTotal,
    axisLeanX,
    axisLeanZ,
    burialStartY,
    burialCompression,
  );
  const signaturePayload = JSON.stringify({
    bodyId: body.id,
    seed: body.seed,
    archetype,
    formationKind,
    tier: body.tier,
    lod,
    segments,
    ring,
    extraSink: round6(extraSink),
    geometryLength: round6(geometryLength),
    rows,
    scales,
    twistTotal,
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
    twistTotal,
    axisLeanX,
    axisLeanZ,
    burialStartY,
    burialCompression,
    rows,
    ring,
    signature: stableHash32(signaturePayload).toString(16).padStart(8, '0'),
  };
}
