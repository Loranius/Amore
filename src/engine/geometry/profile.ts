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

function motherSegments(lod: CrystalLodLevel): number {
  if (lod === 'high') return 8;
  if (lod === 'medium') return 7;
  return 6;
}

function profileScales(archetype: string): { scaleX: number; scaleZ: number } {
  if (archetype === 'blade') return { scaleX: 0.52, scaleZ: 1.18 };
  if (archetype === 'tabular') return { scaleX: 0.66, scaleZ: 1.14 };
  if (archetype === 'needle') return { scaleX: 0.78, scaleZ: 0.78 };
  if (archetype === 'massive') return { scaleX: 1.06, scaleZ: 1.06 };
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

function buildMotherRows(length: number, radius: number): CrystalProfileRow[] {
  const rows: CrystalProfileRow[] = [];
  // A narrow buried-looking foot, a long straight prism and a proper
  // termination. This avoids the old inflated oval silhouette.
  appendRow(rows, 0, radius * 0.76);
  appendRow(rows, length * 0.055, radius * 0.94);
  appendRow(rows, length * 0.13, radius);
  appendRow(rows, length * 0.66, radius * 0.98);
  appendRow(rows, length * 0.73, radius * 0.92);
  appendRow(rows, length * 0.84, radius * 0.62);
  appendRow(rows, length, radius * 0.018);
  return rows;
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
  const rows: CrystalProfileRow[] = mother
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
      appendRow(rows, 0, buriedBase);
      appendRow(rows, extraSink * 0.5, radius * 0.42);
      appendRow(rows, extraSink, radius * 0.82);
    } else {
      appendRow(rows, 0, radius * 0.7);
    }

    appendRow(rows, bodyStart + body.renderedLength * 0.05, radius * 0.9);
    appendRow(rows, bodyStart + body.renderedLength * 0.14, radius);
    appendRow(
      rows,
      prismEnd,
      radius * (0.95 + seededUnit(body.seed, 'geometry:prism-radius') * 0.04),
    );
    appendRow(rows, pointStart, radius * (broken ? 0.58 : 0.86));
    appendRow(rows, bodyStart + body.renderedLength * (broken ? 0.86 : 1), tipRadius);
  }

  const scales = mother ? { scaleX: 0.92, scaleZ: 1 } : profileScales(archetype);
  const segments = mother ? motherSegments(lod) : crystalSegments(body.tier, lod);
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
