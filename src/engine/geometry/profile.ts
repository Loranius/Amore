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
  if (mother) return { asymmetry: 0.18, twist: 0.2, lean: 0.26, phase: 0.08 };
  if (archetype === 'blade') return { asymmetry: 0.18, twist: 0.14, lean: 0.18, phase: 0.09 };
  if (archetype === 'tabular') return { asymmetry: 0.14, twist: 0.1, lean: 0.12, phase: 0.07 };
  if (archetype === 'needle') return { asymmetry: 0.06, twist: 0.16, lean: 0.14, phase: 0.055 };
  if (archetype === 'massive') return { asymmetry: 0.12, twist: 0.075, lean: 0.08, phase: 0.05 };
  if (archetype === 'fan') return { asymmetry: 0.17, twist: 0.18, lean: 0.2, phase: 0.095 };
  if (archetype === 'etched') return { asymmetry: 0.16, twist: 0.17, lean: 0.15, phase: 0.11 };
  return { asymmetry: 0.09, twist: 0.11, lean: 0.1, phase: 0.055 };
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

function buildMotherRows(length: number, radius: number): BaseProfileRow[] {
  const rows: BaseProfileRow[] = [];
  // A double-terminated prism that reads as a spire rather than a column.
  // The previous profile held ~98% of full radius all the way to 66% of its
  // height and then dropped to a point over the last third, which silhouettes
  // as a fat cylinder with a cap stuck on top — the "too flat, too massive"
  // note from visual QA (2026-08-02). Natural quartz terminations taper
  // continuously, so the widest point now sits low and every row above it
  // steps inward, giving one uninterrupted line from shoulder to tip.
  //
  // Ten slices rather than eight. The two extra sit in the long gaps of the
  // shaft (0.12→0.40 and 0.40→0.62), which is where the old profile ran
  // hundreds of pixels without a single horizontal edge — the stretch that
  // read as a smooth ball. Each slice turns and drifts on its own, so a slice
  // is not detail for its own sake: it is another place the surface can break.
  appendBaseRow(rows, 0, radius * 0.16);
  appendBaseRow(rows, length * 0.05, radius * 0.74);
  appendBaseRow(rows, length * 0.12, radius);
  appendBaseRow(rows, length * 0.26, radius * 0.975);
  appendBaseRow(rows, length * 0.4, radius * 0.93);
  appendBaseRow(rows, length * 0.51, radius * 0.865);
  appendBaseRow(rows, length * 0.62, radius * 0.78);
  appendBaseRow(rows, length * 0.8, radius * 0.54);
  appendBaseRow(rows, length * 0.92, radius * 0.27);
  appendBaseRow(rows, length, radius * 0.018);
  return rows;
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

  return rows.map((row, rowIndex) => {
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
    const offsetEnvelope = Math.hypot(centerOffsetX, centerOffsetZ) / minimumScale;
    const conservativeRadius = Math.max(
      row.radius,
      radiusX / Math.max(0.0001, scales.scaleX),
      radiusZ / Math.max(0.0001, scales.scaleZ),
    ) + offsetEnvelope;

    return {
      y: row.y,
      radius: round6(conservativeRadius),
      radiusX: round6(radiusX),
      radiusZ: round6(radiusZ),
      centerOffsetX: round6(centerOffsetX),
      centerOffsetZ: round6(centerOffsetZ),
      rotation: round6(rotation),
      facetPhase: round6(facetPhase),
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
  const baseRows: BaseProfileRow[] = mother
    ? buildMotherRows(body.renderedLength, radius)
    : [];

  if (!mother) {
    const prismEnd = bodyStart + body.renderedLength * (
      archetype === 'tabular' || archetype === 'massive'
        ? 0.66
        : 0.58 + seededUnit(body.seed, 'geometry:prism-end') * 0.08
    );
    const pointStart = Math.max(
      prismEnd + body.renderedLength * 0.1,
      bodyStart + body.renderedLength * (0.72 + seededUnit(body.seed, 'geometry:point-start') * 0.05),
    );
    const blunt = archetype === 'tabular' || archetype === 'massive';
    const broken = archetype === 'etched';
    const tipRadius = broken
      ? radius * 0.3
      : blunt
        ? radius * 0.16
        : radius * 0.018;

    if (attached) {
      const buriedBase = Math.min(radius * 0.18, Math.max(radius * 0.055, extraSink * 0.28));
      appendBaseRow(baseRows, 0, buriedBase);
      appendBaseRow(baseRows, extraSink * 0.5, radius * 0.42);
      appendBaseRow(baseRows, extraSink, radius * 0.82);
    } else {
      appendBaseRow(baseRows, 0, radius * 0.7);
    }

    appendBaseRow(baseRows, bodyStart + body.renderedLength * 0.05, radius * 0.9);
    appendBaseRow(baseRows, bodyStart + body.renderedLength * 0.14, radius);
    // Same reason as the monarch: the shaft used to run from 0.14 to ~0.6 with
    // no horizontal edge in it at all.
    appendBaseRow(baseRows, bodyStart + body.renderedLength * 0.3, radius * 0.985);
    appendBaseRow(baseRows, bodyStart + body.renderedLength * 0.44, radius * 0.97);
    appendBaseRow(
      baseRows,
      prismEnd,
      radius * (0.95 + seededUnit(body.seed, 'geometry:prism-radius') * 0.04),
    );
    appendBaseRow(baseRows, pointStart, radius * (broken ? 0.58 : 0.86));
    appendBaseRow(baseRows, bodyStart + body.renderedLength * (broken ? 0.86 : 1), tipRadius);
  }

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
