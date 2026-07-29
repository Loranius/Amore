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

function stringAttribute(value: GrowthAttributeValue | undefined, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function baseSegments(tier: GrowthTier): number {
  if (tier === 'king') return 12;
  if (tier === 'support') return 10;
  if (tier === 'family') return 8;
  if (tier === 'companion') return 6;
  return 5;
}

export function crystalSegments(tier: GrowthTier, lod: CrystalLodLevel): number {
  const high = baseSegments(tier);
  if (lod === 'high') return high;
  if (lod === 'medium') return Math.max(5, high - 2);
  return Math.max(4, Math.ceil(high * 0.55));
}

function profileScales(archetype: string): { scaleX: number; scaleZ: number } {
  if (archetype === 'blade') return { scaleX: 0.52, scaleZ: 1.18 };
  if (archetype === 'tabular') return { scaleX: 0.66, scaleZ: 1.14 };
  if (archetype === 'needle') return { scaleX: 0.78, scaleZ: 0.78 };
  if (archetype === 'massive') return { scaleX: 1.12, scaleZ: 1.12 };
  if (archetype === 'fan') return { scaleX: 0.82, scaleZ: 1.08 };
  return { scaleX: 1, scaleZ: 1 };
}

function appendRow(rows: CrystalProfileRow[], y: number, radius: number): void {
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
 * Canonical crystal profile. The logical GrowthBody remains untouched; attached
 * meshes receive a local backward extension so the seam sits inside the host.
 */
export function buildCrystalProfile(
  body: GrowthBody,
  lod: CrystalLodLevel,
): CrystalBodyProfile {
  const archetype = stringAttribute(body.attributes.archetype, 'prismatic');
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
  const prismEnd = bodyStart + body.renderedLength * (
    archetype === 'tabular' || archetype === 'massive'
      ? 0.68
      : 0.54 + seededUnit(body.seed, 'geometry:prism-end') * 0.09
  );
  const pointStart = Math.max(
    prismEnd + body.renderedLength * 0.12,
    bodyStart + body.renderedLength * (0.72 + seededUnit(body.seed, 'geometry:point-start') * 0.06),
  );
  const blunt = archetype === 'prismatic' || archetype === 'tabular' || archetype === 'massive';
  const broken = archetype === 'etched';
  const tipRadius = broken
    ? radius * 0.34
    : blunt
      ? radius * 0.2
      : radius * 0.025;
  const rows: CrystalProfileRow[] = [];

  if (attached) {
    const buriedBase = Math.min(radius * 0.18, Math.max(radius * 0.055, extraSink * 0.28));
    appendRow(rows, 0, buriedBase);
    appendRow(rows, extraSink * 0.5, radius * 0.42);
    appendRow(rows, extraSink, radius * 0.82);
  } else {
    appendRow(rows, 0, radius * 0.62);
  }

  appendRow(rows, bodyStart + body.renderedLength * 0.05, radius * 0.9);
  appendRow(rows, bodyStart + body.renderedLength * 0.14, radius);
  appendRow(
    rows,
    prismEnd,
    radius * (0.95 + seededUnit(body.seed, 'geometry:prism-radius') * 0.045),
  );
  appendRow(rows, pointStart, radius * (broken ? 0.62 : 0.88));
  appendRow(rows, bodyStart + body.renderedLength * (broken ? 0.86 : 1), tipRadius);

  const scales = profileScales(archetype);
  const segments = crystalSegments(body.tier, lod);
  const signaturePayload = JSON.stringify({
    bodyId: body.id,
    seed: body.seed,
    archetype,
    tier: body.tier,
    lod,
    segments,
    extraSink: round6(extraSink),
    geometryLength: round6(geometryLength),
    rows,
    scales,
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
    rows,
    signature: stableHash32(signaturePayload).toString(16).padStart(8, '0'),
  };
}
