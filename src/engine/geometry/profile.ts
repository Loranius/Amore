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
  appendBaseRow(rows, 0, radius * 0.16);
  appendBaseRow(rows, length * 0.05, radius * 0.74);
  appendBaseRow(rows, length * 0.12, radius);
  appendBaseRow(rows, length * 0.4, radius * 0.93);
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
): CrystalProfileRow[] {
  const lastY = Math.max(1e-9, rows[rows.length - 1]?.y ?? 0);
  const phaseBias = signedUnit(body.seed, 'geometry:profile-phase-bias') * tuning.phase * 0.35;
  const bowX = signedUnit(body.seed, 'geometry:axis-bow-x') * Math.abs(axisLeanX + axisLeanZ) * 0.35;
  const bowZ = signedUnit(body.seed, 'geometry:axis-bow-z') * Math.abs(axisLeanX + axisLeanZ) * 0.35;
  const minimumScale = Math.max(0.0001, Math.min(scales.scaleX, scales.scaleZ));

  return rows.map((row, rowIndex) => {
    const t = Math.max(0, Math.min(1, row.y / lastY));
    const bend = Math.sin(Math.PI * t);
    const centerOffsetX = axisLeanX * smoothStep(t) + bowX * bend;
    const centerOffsetZ = axisLeanZ * smoothStep(t) + bowZ * bend;
    const rotation = twistTotal * smoothStep(t);
    const facetPhase = phaseBias
      + signedUnit(body.seed, `geometry:facet-phase:${rowIndex}`) * tuning.phase * bend;
    const burialT = burialStartY > 1e-9
      ? Math.max(0, Math.min(1, row.y / burialStartY))
      : 1;
    const compression = burialStartY > 0 && row.y < burialStartY
      ? burialCompression + (1 - burialCompression) * smoothStep(burialT)
      : 1;
    const pulse = Math.sin((t * Math.PI * 2) + phaseBias * 7) * tuning.asymmetry * 0.22;
    const rowNoiseX = signedUnit(body.seed, `geometry:radius-x:${rowIndex}`) * tuning.asymmetry * 0.38;
    const rowNoiseZ = signedUnit(body.seed, `geometry:radius-z:${rowIndex}`) * tuning.asymmetry * 0.38;
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
  );
  const segments = segmentsFor(body, mother, lod);
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
