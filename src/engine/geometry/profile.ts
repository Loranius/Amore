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

/** Smallest and largest ring a lathe may have and still close cleanly. */
const MIN_SEGMENTS = 4;
const MAX_SEGMENTS = 24;

/**
 * Facet count of a body.
 *
 * Since ADR-0004 the species publishes this as data — the monarch earns her
 * facets with the couple's photos — so it is deliberately **not** reduced by
 * level of detail. A weaker phone must not show the same couple a differently
 * shaped crystal; LOD reduces profile rows and drops small bodies instead.
 *
 * Bodies from species that publish no facet count keep the old tier-and-LOD
 * behaviour.
 */
function segmentsFor(
  body: GrowthBody,
  mother: boolean,
  lod: CrystalLodLevel,
): number {
  const published = body.attributes['facetCount'];
  if (typeof published === 'number' && Number.isFinite(published)) {
    return Math.max(MIN_SEGMENTS, Math.min(MAX_SEGMENTS, Math.round(published)));
  }
  return mother ? 8 : crystalSegments(body.tier, lod);
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
const SHOULDER_MIN = 0.65;
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
const BASE_WAIST = 0.76;

/**
 * How far under the shoulder every slice below it must stay. Small enough that
 * the shaft still swells visibly, large enough that the widest slice is never
 * ambiguous.
 */
const SHOULDER_CLEARANCE = 0.985;

function shoulderFraction(seed: number): number {
  return SHOULDER_MIN + seededUnit(seed, 'geometry:shoulder') * (SHOULDER_MAX - SHOULDER_MIN);
}

/**
 * How many extra cut planes this crystal carries in its termination.
 *
 * A quartz point is rarely a clean pyramid: most have one or two secondary
 * faces between the shaft and the tip. Zero to two, seeded, so crowns differ
 * from crystal to crystal without any of them becoming a pincushion.
 */
function extraBevelCount(seed: number): number {
  return Math.floor(seededUnit(seed, 'geometry:crown-bevels') * 3);
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
    seed: number;
    bodyStart: number;
    length: number;
    radius: number;
    tipRadius: number;
    shoulderShare: number;
  },
): void {
  const { seed, bodyStart, length, radius, tipRadius, shoulderShare } = options;
  const at = (fraction: number): number => bodyStart + length * fraction;

  // Shaft: a gentle swell rather than a taper. The whole rise is under a third
  // of the radius, so the silhouette still reads as parallel-sided from a
  // distance — which is what makes it a prism instead of a spindle.
  appendBaseRow(rows, at(0), radius * BASE_WAIST);
  appendBaseRow(rows, at(shoulderShare * 0.08), radius * 0.83);
  appendBaseRow(rows, at(shoulderShare * 0.24), radius * 0.88);
  appendBaseRow(rows, at(shoulderShare * 0.48), radius * 0.93);
  appendBaseRow(rows, at(shoulderShare * 0.76), radius * 0.97);
  appendBaseRow(rows, at(shoulderShare), radius);

  // Termination. The crown is short — under a third of the height — so the
  // edge where it meets the shaft is a real corner rather than the start of a
  // long fade.
  const crown = Math.max(1e-6, 1 - shoulderShare);
  const bevels = extraBevelCount(seed);
  const crownRows = 2 + bevels;
  for (let step = 1; step <= crownRows; step += 1) {
    const along = step / (crownRows + 1);
    // Slightly convex: the termination narrows faster near the tip than near
    // the shoulder, the way a real point does.
    appendBaseRow(
      rows,
      at(shoulderShare + crown * along),
      radius * (1 - Math.pow(along, 0.82)) * 0.97 + tipRadius * along,
    );
  }
  appendBaseRow(rows, at(1), tipRadius);
}

function smoothStep(value: number): number {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
}

/**
 * How far each slice turns relative to the one below it.
 *
 * A lathe whose rings all share one orientation is a prism, and a prism read as
 * "a smooth ball sticking out of the ground" in review: every quad between two
 * rings is a long vertical strip, all strips meet the light at the same angle,
 * and nothing on the surface tells you where one face ends and the next begins.
 * Turning each slice breaks those strips into ribbons that catch the light
 * separately — the single biggest difference between a lathe and a crystal.
 *
 * The whole body used to twist by about 11° in total. This is 6–12° **per
 * slice**, so an eight-row monarch turns through roughly 70°.
 */
const SLICE_TURN_MIN_RAD = 6 * (Math.PI / 180);
const SLICE_TURN_MAX_RAD = 12 * (Math.PI / 180);

/**
 * Ceiling on the turn, as a fraction of one facet's angular width.
 *
 * Without it a 24-facet monarch (the couple with the most photos) would turn
 * each slice by most of a facet, shearing every quad into a sliver. The visual
 * effect of a turn is relative to facet width, not absolute, so a crystal with
 * many narrow facets needs a proportionally smaller step.
 */
const SLICE_TURN_MAX_STEP_FRACTION = 0.4;

/** How far a slice may wander off the axis, as a fraction of its own radius. */
const SLICE_DRIFT = 0.05;
/** The tip wanders further — a terminated crystal is never centred over its base. */
const SLICE_TIP_DRIFT = 0.14;

/** Per-slice radius swing, 5–10% of the profile radius. */
const SLICE_RADIUS_SWING_MIN = 0.05;
const SLICE_RADIUS_SWING_MAX = 0.1;

function sliceRadiusSwing(seed: number, rowIndex: number, axis: 'x' | 'z'): number {
  const unit = seededUnit(seed, `geometry:slice-radius-swing:${axis}:${rowIndex}`);
  return SLICE_RADIUS_SWING_MIN + unit * (SLICE_RADIUS_SWING_MAX - SLICE_RADIUS_SWING_MIN);
}

/**
 * Per-slice turn, accumulated from the base upward.
 *
 * Accumulated rather than interpolated: the point is that adjacent slices
 * differ, and any curve that eases in and out flattens exactly the slices where
 * the crystal is widest and most visible.
 */
function sliceTurns(
  seed: number,
  rowCount: number,
  segments: number,
  twistTotal: number,
): number[] {
  const step = (Math.PI * 2) / Math.max(1, segments);
  const ceiling = step * SLICE_TURN_MAX_STEP_FRACTION;
  // One handedness for the whole body. Seeding this independently let a crystal
  // twist one way at body scale and the other slice by slice, which cancels
  // into a shape that reads as a mistake rather than as growth.
  const direction = twistTotal < 0 ? -1 : 1;
  const turns: number[] = [];
  let accumulated = 0;
  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    if (rowIndex > 0) {
      const unit = seededUnit(seed, `geometry:slice-turn:${rowIndex}`);
      const magnitude = Math.min(
        ceiling,
        SLICE_TURN_MIN_RAD + unit * (SLICE_TURN_MAX_RAD - SLICE_TURN_MIN_RAD),
      );
      accumulated += direction * magnitude;
    }
    turns.push(round6(accumulated));
  }
  return turns;
}

function decorateRows(
  rows: readonly BaseProfileRow[],
  body: GrowthBody,
  scales: { scaleX: number; scaleZ: number },
  tuning: ProfileShapeTuning,
  twistTotal: number,
  axisLeanX: number,
  axisLeanZ: number,
  burialStartY: number,
  burialCompression: number,
  segments: number,
): CrystalProfileRow[] {
  const lastY = Math.max(1e-9, rows[rows.length - 1]?.y ?? 0);
  const turns = sliceTurns(body.seed, rows.length, segments, twistTotal);
  const phaseBias = signedUnit(body.seed, 'geometry:profile-phase-bias') * tuning.phase * 0.35;
  const bowX = signedUnit(body.seed, 'geometry:axis-bow-x') * Math.abs(axisLeanX + axisLeanZ) * 0.35;
  const bowZ = signedUnit(body.seed, 'geometry:axis-bow-z') * Math.abs(axisLeanX + axisLeanZ) * 0.35;
  const minimumScale = Math.max(0.0001, Math.min(scales.scaleX, scales.scaleZ));
  // The shoulder is the widest slice of the base profile, and it has to stay
  // the widest slice of the finished one. The per-slice swing is 5-10% while
  // the shaft rises only 4-5% between rows, so without this a shaft slice can
  // out-swell the shoulder — and a crystal whose widest point sits a third of
  // the way up has no shoulder at all, which is the whole silhouette gone.
  //
  // Capping rather than shrinking the swing: the swing is what keeps the shaft
  // from reading as a machined tube, and it is only ever wrong when it crosses
  // this one line.
  const shoulderIndex = rows.reduce(
    (best, row, index) => (row.radius > rows[best]!.radius ? index : best),
    0,
  );

  const raw = rows.map((row, rowIndex) => {
    const t = Math.max(0, Math.min(1, row.y / lastY));
    const bend = Math.sin(Math.PI * t);
    // Each slice also steps sideways on its own. The lean and the bow are
    // smooth curves — they move the whole silhouette without ever making two
    // neighbouring slices disagree, which is what actually produces an edge.
    // The last slice gets the largest step, so the tip finishes off the axis
    // rather than centred over the base like a spun cone.
    const tipward = rowIndex === rows.length - 1 ? SLICE_TIP_DRIFT : SLICE_DRIFT;
    const driftScale = row.radius * tipward;
    const driftX = signedUnit(body.seed, `geometry:slice-drift-x:${rowIndex}`) * driftScale;
    const driftZ = signedUnit(body.seed, `geometry:slice-drift-z:${rowIndex}`) * driftScale;
    const centerOffsetX = axisLeanX * smoothStep(t) + bowX * bend + driftX;
    const centerOffsetZ = axisLeanZ * smoothStep(t) + bowZ * bend + driftZ;
    const rotation = twistTotal * smoothStep(t) + (turns[rowIndex] ?? 0);
    const facetPhase = phaseBias
      + signedUnit(body.seed, `geometry:facet-phase:${rowIndex}`) * tuning.phase * bend;
    const burialT = burialStartY > 1e-9
      ? Math.max(0, Math.min(1, row.y / burialStartY))
      : 1;
    const compression = burialStartY > 0 && row.y < burialStartY
      ? burialCompression + (1 - burialCompression) * smoothStep(burialT)
      : 1;
    const pulse = Math.sin((t * Math.PI * 2) + phaseBias * 7) * tuning.asymmetry * 0.22;
    // 5–10% per slice, stated rather than incidental: enough that the taper
    // reads as a stack of distinct sections, small enough that the silhouette
    // stays a crystal and not a stack of coins.
    const rowNoiseX = signedUnit(body.seed, `geometry:radius-x:${rowIndex}`) * sliceRadiusSwing(body.seed, rowIndex, 'x');
    const rowNoiseZ = signedUnit(body.seed, `geometry:radius-z:${rowIndex}`) * sliceRadiusSwing(body.seed, rowIndex, 'z');
    const radiusX = Math.max(
      0.0001,
      row.radius * scales.scaleX * compression * (1 + pulse + rowNoiseX),
    );
    const radiusZ = Math.max(
      0.0001,
      row.radius * scales.scaleZ * compression * (1 - pulse + rowNoiseZ),
    );
    return {
      baseRadius: row.radius,
      y: row.y,
      radiusX,
      radiusZ,
      centerOffsetX,
      centerOffsetZ,
      rotation,
      facetPhase,
    };
  });

  // Enforce the shoulder. Clamping the finished radii rather than trimming the
  // swing that produced them, because the swing is not the only thing that can
  // cross the line: the elliptical pulse and the burial compression move a
  // slice too, and an earlier attempt that only tamed the swing still let the
  // pulse hand the widest radius to a slice a third of the way up.
  const shoulderX = raw[shoulderIndex]?.radiusX ?? 0;
  const shoulderZ = raw[shoulderIndex]?.radiusZ ?? 0;

  return raw.map((row, rowIndex) => {
    const capped = rowIndex < shoulderIndex;
    const radiusX = capped ? Math.min(row.radiusX, shoulderX * SHOULDER_CLEARANCE) : row.radiusX;
    const radiusZ = capped ? Math.min(row.radiusZ, shoulderZ * SHOULDER_CLEARANCE) : row.radiusZ;
    const offsetEnvelope = Math.hypot(row.centerOffsetX, row.centerOffsetZ) / minimumScale;
    const conservativeRadius = Math.max(
      row.baseRadius,
      radiusX / Math.max(0.0001, scales.scaleX),
      radiusZ / Math.max(0.0001, scales.scaleZ),
    ) + offsetEnvelope;

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
    seed: body.seed,
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
  // Facet count first: the per-slice turn is measured against one facet's
  // angular width, so the rows cannot be laid out until the ring is known.
  const segments = segmentsFor(body, mother, lod);
  const rows = decorateRows(
    baseRows,
    body,
    scales,
    tuning,
    twistTotal,
    axisLeanX,
    axisLeanZ,
    burialStartY,
    burialCompression,
    segments,
  );
  const signaturePayload = JSON.stringify({
    bodyId: body.id,
    seed: body.seed,
    archetype,
    formationKind,
    tier: body.tier,
    lod,
    segments,
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
    signature: stableHash32(signaturePayload).toString(16).padStart(8, '0'),
  };
}
