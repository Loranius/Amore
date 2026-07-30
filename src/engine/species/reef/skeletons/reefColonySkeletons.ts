import { DEFAULT_REEF_COLONY_SKELETON_CONFIG } from './config';
import { clamp01, round6, seededUnit, stableSeed } from '../math';
import type { ReefColonyPlacement, ReefLayoutVec3 } from '../layout';
import type { ReefFoundationAttachment } from '../foundation';
import type { ReefColonyMorphotype } from '../types';
import type {
  BuildReefColonySkeletonsInput,
  ReefColonySkeleton,
  ReefColonySkeletonConfig,
  ReefColonySkeletonState,
  ReefSkeletonBasis,
  ReefSkeletonNode,
  ReefSkeletonNodeKind,
  ReefSkeletonSegment,
  ReefSkeletonSegmentKind,
  ReefSkeletonSurface,
  ReefSkeletonSurfaceKind,
} from './types';

const TAU = Math.PI * 2;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function roundVector(value: ReefLayoutVec3): ReefLayoutVec3 {
  return { x: round6(value.x), y: round6(value.y), z: round6(value.z) };
}

function dot(left: ReefLayoutVec3, right: ReefLayoutVec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function cross(left: ReefLayoutVec3, right: ReefLayoutVec3): ReefLayoutVec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function normalize(value: ReefLayoutVec3, fallback: ReefLayoutVec3): ReefLayoutVec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= 1e-9) return roundVector(fallback);
  return roundVector({ x: value.x / length, y: value.y / length, z: value.z / length });
}

function validateConfig(config: ReefColonySkeletonConfig): void {
  if (!config.rulesVersion.trim()) {
    throw new Error('Reef Colony Skeletons requires a non-empty rulesVersion.');
  }
  for (const [name, value, minimum] of [
    ['angularQuantization', config.angularQuantization, 8],
    ['maximumNodes', config.maximumNodes, 1],
    ['maximumSegments', config.maximumSegments, 1],
    ['maximumSurfaces', config.maximumSurfaces, 1],
  ] as const) {
    if (!Number.isInteger(value) || value < minimum) {
      throw new Error(`Reef Colony Skeletons ${name} must be an integer >= ${minimum}.`);
    }
  }
}

function validateProvenance(input: BuildReefColonySkeletonsInput): void {
  const { species, layout, foundation } = input;
  if (species.species !== 'reef') {
    throw new Error('Reef Colony Skeletons requires a Reef Species blueprint.');
  }
  if (
    layout.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || layout.sourceSpeciesRulesVersion !== species.rulesVersion
    || layout.artifactSeed !== species.artifactSeed
    || layout.asOf !== species.asOf
  ) {
    throw new Error('Reef Colony Skeletons received an incompatible Colony Layout provenance.');
  }
  if (
    foundation.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || foundation.sourceSpeciesRulesVersion !== species.rulesVersion
    || foundation.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || foundation.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || foundation.artifactSeed !== species.artifactSeed
    || foundation.asOf !== species.asOf
  ) {
    throw new Error('Reef Colony Skeletons received an incompatible Foundation Mesh provenance.');
  }
}

function basisFor(attachment: ReefFoundationAttachment): ReefSkeletonBasis {
  const up = normalize(attachment.normal, { x: 0, y: 1, z: 0 });
  const facing = {
    x: Math.cos(attachment.facingRad),
    y: 0,
    z: Math.sin(attachment.facingRad),
  };
  const projected = {
    x: facing.x - up.x * dot(facing, up),
    y: facing.y - up.y * dot(facing, up),
    z: facing.z - up.z * dot(facing, up),
  };
  const fallbackForward = Math.abs(up.y) < 0.92
    ? normalize(cross({ x: 0, y: 1, z: 0 }, up), { x: 0, y: 0, z: 1 })
    : { x: 0, y: 0, z: 1 };
  const forward = normalize(projected, fallbackForward);
  const right = normalize(cross(up, forward), { x: 1, y: 0, z: 0 });
  const correctedForward = normalize(cross(right, up), forward);
  return {
    origin: roundVector(attachment.position),
    up,
    right,
    forward: correctedForward,
    facingRad: round6(attachment.facingRad),
  };
}

function quantizedAngle(seed: number, salt: string, steps: number): number {
  const index = Math.floor(seededUnit(seed, salt) * steps) % steps;
  return round6(index * TAU / steps);
}

function localPolar(radius: number, angle: number, height: number, forwardScale = 1): ReefLayoutVec3 {
  return roundVector({
    x: Math.cos(angle) * radius,
    y: height,
    z: Math.sin(angle) * radius * forwardScale,
  });
}

interface SkeletonBuilder {
  skeletonId: string;
  seed: number;
  nodes: ReefSkeletonNode[];
  segments: ReefSkeletonSegment[];
  surfaces: ReefSkeletonSurface[];
  addNode: (
    label: string,
    kind: ReefSkeletonNodeKind,
    parentNodeId: string | null,
    localPosition: ReefLayoutVec3,
    radius: number,
    influence?: number,
  ) => string;
  addSegment: (
    label: string,
    kind: ReefSkeletonSegmentKind,
    fromNodeId: string,
    toNodeId: string,
    radiusStart: number,
    radiusEnd: number,
  ) => string;
  addSurface: (
    label: string,
    kind: ReefSkeletonSurfaceKind,
    nodeIds: string[],
    thickness: number,
    span: number,
  ) => string;
}

function makeBuilder(skeletonId: string, seed: number): SkeletonBuilder {
  const nodes: ReefSkeletonNode[] = [];
  const segments: ReefSkeletonSegment[] = [];
  const surfaces: ReefSkeletonSurface[] = [];
  return {
    skeletonId,
    seed,
    nodes,
    segments,
    surfaces,
    addNode(label, kind, parentNodeId, localPosition, radius, influence = 1) {
      const id = `${skeletonId}:node:${label}`;
      nodes.push({
        id,
        sequence: nodes.length,
        kind,
        parentNodeId,
        localPosition: roundVector(localPosition),
        radius: round6(Math.max(0.001, radius)),
        influence: round6(clamp01(influence)),
      });
      return id;
    },
    addSegment(label, kind, fromNodeId, toNodeId, radiusStart, radiusEnd) {
      const id = `${skeletonId}:segment:${label}`;
      segments.push({
        id,
        sequence: segments.length,
        kind,
        fromNodeId,
        toNodeId,
        radiusStart: round6(Math.max(0.001, radiusStart)),
        radiusEnd: round6(Math.max(0.001, radiusEnd)),
      });
      return id;
    },
    addSurface(label, kind, nodeIds, thickness, span) {
      const id = `${skeletonId}:surface:${label}`;
      surfaces.push({
        id,
        sequence: surfaces.length,
        kind,
        nodeIds: [...nodeIds],
        thickness: round6(Math.max(0.001, thickness)),
        span: round6(Math.max(0.001, span)),
      });
      return id;
    },
  };
}

function buildBranching(
  builder: SkeletonBuilder,
  colony: ReefColonyPlacement,
  config: ReefColonySkeletonConfig,
): void {
  const rootRadius = colony.footprintRadius * (0.16 + colony.weight * 0.06);
  const root = builder.addNode('root', 'root', null, { x: 0, y: 0, z: 0 }, rootRadius);
  const axisCount = 3 + Math.floor(colony.maturity * 2);
  const axisNodes: string[] = [root];
  for (let index = 1; index <= axisCount; index += 1) {
    const progress = index / axisCount;
    const angle = quantizedAngle(builder.seed, `axis:${index}`, config.angularQuantization);
    const sway = colony.footprintRadius * 0.07 * progress;
    const node = builder.addNode(
      `axis:${index}`,
      index === axisCount ? 'tip' : 'axis',
      axisNodes[index - 1] ?? root,
      localPolar(sway, angle, colony.targetHeight * progress * 0.72),
      rootRadius * (1 - progress * 0.7),
      1 - progress * 0.15,
    );
    builder.addSegment(
      `trunk:${index}`,
      'trunk',
      axisNodes[index - 1] ?? root,
      node,
      rootRadius * (1 - (progress - 1 / axisCount) * 0.7),
      rootRadius * (1 - progress * 0.7),
    );
    axisNodes.push(node);
  }

  const branchCount = clamp(
    3 + Math.floor(colony.branchingBias * 3 + colony.maturity * 2),
    3,
    7,
  );
  const baseAngle = quantizedAngle(builder.seed, 'branch-base', config.angularQuantization);
  for (let index = 0; index < branchCount; index += 1) {
    const attachIndex = 1 + (index % Math.max(1, axisNodes.length - 2));
    const parent = axisNodes[attachIndex] ?? root;
    const parentProgress = attachIndex / axisCount;
    const angle = baseAngle + index * TAU / branchCount;
    const reach = colony.footprintRadius * (
      0.48 + seededUnit(builder.seed, `branch-reach:${index}`) * 0.28
    );
    const middle = builder.addNode(
      `branch:${index}:middle`,
      'junction',
      parent,
      localPolar(reach * 0.55, angle, colony.targetHeight * (0.35 + parentProgress * 0.34)),
      rootRadius * 0.34,
      0.9,
    );
    const tip = builder.addNode(
      `branch:${index}:tip`,
      'tip',
      middle,
      localPolar(reach, angle, colony.targetHeight * (0.52 + parentProgress * 0.36)),
      rootRadius * 0.12,
      0.78,
    );
    builder.addSegment(`branch:${index}:a`, 'branch', parent, middle, rootRadius * 0.4, rootRadius * 0.24);
    builder.addSegment(`branch:${index}:b`, 'branch', middle, tip, rootRadius * 0.24, rootRadius * 0.08);

    if (colony.maturity >= 0.55 && index % 2 === 0) {
      const twigAngle = angle + (index % 4 === 0 ? 0.42 : -0.42);
      const twig = builder.addNode(
        `branch:${index}:twig`,
        'tip',
        middle,
        localPolar(reach * 0.86, twigAngle, colony.targetHeight * (0.64 + parentProgress * 0.28)),
        rootRadius * 0.08,
        0.68,
      );
      builder.addSegment(`branch:${index}:twig`, 'branch', middle, twig, rootRadius * 0.18, rootRadius * 0.06);
    }
  }
}

function buildMassive(
  builder: SkeletonBuilder,
  colony: ReefColonyPlacement,
  config: ReefColonySkeletonConfig,
): void {
  const rootRadius = colony.footprintRadius * 0.34;
  const root = builder.addNode('root', 'root', null, { x: 0, y: 0, z: 0 }, rootRadius);
  const apex = builder.addNode(
    'apex',
    'tip',
    root,
    { x: 0, y: colony.targetHeight * 0.82, z: 0 },
    rootRadius * 0.46,
  );
  builder.addSegment('axis', 'trunk', root, apex, rootRadius, rootRadius * 0.42);
  const ringCount = 6 + Math.floor(colony.maturity * 4);
  const baseAngle = quantizedAngle(builder.seed, 'massive-ring', config.angularQuantization);
  const ring: string[] = [];
  for (let index = 0; index < ringCount; index += 1) {
    const angle = baseAngle + index * TAU / ringCount;
    const radius = colony.footprintRadius * (
      0.68 + seededUnit(builder.seed, `massive-radius:${index}`) * 0.18
    );
    const node = builder.addNode(
      `ring:${index}`,
      'control',
      root,
      localPolar(radius, angle, colony.targetHeight * (0.35 + seededUnit(builder.seed, `massive-y:${index}`) * 0.16), 0.92),
      rootRadius * 0.28,
      0.86,
    );
    ring.push(node);
    builder.addSegment(`rib:root:${index}`, 'rib', root, node, rootRadius * 0.56, rootRadius * 0.24);
    builder.addSegment(`rib:apex:${index}`, 'rib', node, apex, rootRadius * 0.24, rootRadius * 0.18);
  }
  builder.addSurface(
    'envelope',
    'massive-envelope',
    [root, ...ring, apex],
    colony.footprintRadius * 0.14,
    colony.footprintRadius * 2,
  );
}

function buildPlating(
  builder: SkeletonBuilder,
  colony: ReefColonyPlacement,
  config: ReefColonySkeletonConfig,
): void {
  const rootRadius = colony.footprintRadius * 0.18;
  const root = builder.addNode('root', 'root', null, { x: 0, y: 0, z: 0 }, rootRadius);
  const centre = builder.addNode(
    'plate-centre',
    'axis',
    root,
    { x: 0, y: colony.targetHeight * 0.42, z: 0 },
    rootRadius * 0.78,
  );
  builder.addSegment('stalk', 'stalk', root, centre, rootRadius, rootRadius * 0.62);
  const rimCount = 8 + Math.floor(colony.maturity * 4);
  const baseAngle = quantizedAngle(builder.seed, 'plate-rim', config.angularQuantization);
  const rim: string[] = [];
  for (let index = 0; index < rimCount; index += 1) {
    const angle = baseAngle + index * TAU / rimCount;
    const radius = colony.footprintRadius * (
      0.76 + seededUnit(builder.seed, `plate-radius:${index}`) * 0.2
    );
    const node = builder.addNode(
      `rim:${index}`,
      'rim',
      centre,
      localPolar(radius, angle, colony.targetHeight * (0.4 + seededUnit(builder.seed, `plate-y:${index}`) * 0.08), 0.96),
      rootRadius * 0.2,
      0.82,
    );
    rim.push(node);
    builder.addSegment(`spoke:${index}`, 'rib', centre, node, rootRadius * 0.34, rootRadius * 0.1);
  }
  for (let index = 0; index < rim.length; index += 1) {
    builder.addSegment(
      `rim:${index}`,
      'boundary',
      rim[index] ?? centre,
      rim[(index + 1) % rim.length] ?? centre,
      rootRadius * 0.1,
      rootRadius * 0.1,
    );
  }
  builder.addSurface(
    'plate',
    'plate-disc',
    [centre, ...rim],
    colony.targetHeight * 0.07,
    colony.footprintRadius * 2,
  );
}

function buildEncrusting(
  builder: SkeletonBuilder,
  colony: ReefColonyPlacement,
  config: ReefColonySkeletonConfig,
): void {
  const rootRadius = colony.footprintRadius * 0.12;
  const root = builder.addNode('root', 'root', null, { x: 0, y: 0, z: 0 }, rootRadius);
  const rimCount = 8 + Math.floor(colony.maturity * 4);
  const baseAngle = quantizedAngle(builder.seed, 'encrusting-rim', config.angularQuantization);
  const rim: string[] = [];
  for (let index = 0; index < rimCount; index += 1) {
    const angle = baseAngle + index * TAU / rimCount;
    const radius = colony.footprintRadius * (
      0.72 + seededUnit(builder.seed, `encrusting-radius:${index}`) * 0.26
    );
    const node = builder.addNode(
      `rim:${index}`,
      'rim',
      root,
      localPolar(radius, angle, colony.targetHeight * (0.03 + seededUnit(builder.seed, `encrusting-y:${index}`) * 0.04)),
      rootRadius * 0.42,
      0.74,
    );
    rim.push(node);
    builder.addSegment(`rib:${index}`, 'rib', root, node, rootRadius * 0.46, rootRadius * 0.18);
  }
  for (let index = 0; index < rim.length; index += 1) {
    builder.addSegment(
      `rim:${index}`,
      'boundary',
      rim[index] ?? root,
      rim[(index + 1) % rim.length] ?? root,
      rootRadius * 0.18,
      rootRadius * 0.18,
    );
  }
  builder.addSurface(
    'patch',
    'encrusting-patch',
    [root, ...rim],
    colony.targetHeight * 0.09,
    colony.footprintRadius * 2,
  );
}

function buildSoftCoral(
  builder: SkeletonBuilder,
  colony: ReefColonyPlacement,
  config: ReefColonySkeletonConfig,
): void {
  const rootRadius = colony.footprintRadius * 0.16;
  const root = builder.addNode('root', 'root', null, { x: 0, y: 0, z: 0 }, rootRadius);
  const lower = builder.addNode(
    'axis:lower',
    'axis',
    root,
    { x: 0, y: colony.targetHeight * 0.25, z: 0 },
    rootRadius * 0.82,
  );
  const upper = builder.addNode(
    'axis:upper',
    'junction',
    lower,
    { x: 0, y: colony.targetHeight * 0.58, z: colony.targetHeight * 0.04 },
    rootRadius * 0.58,
  );
  builder.addSegment('stalk:lower', 'stalk', root, lower, rootRadius, rootRadius * 0.72);
  builder.addSegment('stalk:upper', 'stalk', lower, upper, rootRadius * 0.72, rootRadius * 0.48);

  const lobeCount = clamp(
    4 + Math.floor(colony.branchingBias * 3 + colony.maturity * 2),
    4,
    8,
  );
  const baseAngle = quantizedAngle(builder.seed, 'soft-lobes', config.angularQuantization);
  for (let index = 0; index < lobeCount; index += 1) {
    const angle = baseAngle + index * TAU / lobeCount;
    const reach = colony.footprintRadius * (
      0.42 + seededUnit(builder.seed, `soft-reach:${index}`) * 0.28
    );
    const middle = builder.addNode(
      `lobe:${index}:middle`,
      'lobe',
      upper,
      localPolar(reach * 0.55, angle, colony.targetHeight * 0.72, 0.88),
      rootRadius * 0.3,
      0.88,
    );
    const tip = builder.addNode(
      `lobe:${index}:tip`,
      'tip',
      middle,
      localPolar(reach, angle + 0.08 * (index % 2 === 0 ? 1 : -1), colony.targetHeight * (0.88 + seededUnit(builder.seed, `soft-tip-y:${index}`) * 0.18), 0.88),
      rootRadius * 0.14,
      0.72,
    );
    builder.addSegment(`lobe:${index}:a`, 'lobe', upper, middle, rootRadius * 0.4, rootRadius * 0.24);
    builder.addSegment(`lobe:${index}:b`, 'lobe', middle, tip, rootRadius * 0.24, rootRadius * 0.1);
    builder.addSurface(
      `lobe:${index}`,
      'soft-lobe-envelope',
      [upper, middle, tip],
      rootRadius * 0.42,
      reach,
    );
  }
}

function buildSeaFan(
  builder: SkeletonBuilder,
  colony: ReefColonyPlacement,
): void {
  const rootRadius = colony.footprintRadius * 0.14;
  const root = builder.addNode('root', 'root', null, { x: 0, y: 0, z: 0 }, rootRadius);
  const spineCount = 4 + Math.floor(colony.maturity * 2);
  const spine: string[] = [root];
  const left: string[] = [];
  const right: string[] = [];

  for (let index = 1; index <= spineCount; index += 1) {
    const progress = index / spineCount;
    const sway = (seededUnit(builder.seed, `fan-spine:${index}`) - 0.5)
      * colony.footprintRadius
      * 0.08;
    const node = builder.addNode(
      `spine:${index}`,
      index === spineCount ? 'tip' : 'axis',
      spine[index - 1] ?? root,
      { x: sway, y: colony.targetHeight * progress, z: 0 },
      rootRadius * (1 - progress * 0.68),
      1 - progress * 0.12,
    );
    builder.addSegment(
      `spine:${index}`,
      'trunk',
      spine[index - 1] ?? root,
      node,
      rootRadius * (1 - (progress - 1 / spineCount) * 0.68),
      rootRadius * (1 - progress * 0.68),
    );
    spine.push(node);

    if (index >= 2) {
      const extent = colony.footprintRadius * (
        0.32 + progress * 0.58
      ) * (0.9 + seededUnit(builder.seed, `fan-extent:${index}`) * 0.1);
      const height = colony.targetHeight * (progress - 0.05);
      const leftNode = builder.addNode(
        `left:${index}`,
        'tip',
        node,
        { x: -extent, y: height, z: 0 },
        rootRadius * 0.1,
        0.76,
      );
      const rightNode = builder.addNode(
        `right:${index}`,
        'tip',
        node,
        { x: extent, y: height, z: 0 },
        rootRadius * 0.1,
        0.76,
      );
      left.push(leftNode);
      right.push(rightNode);
      builder.addSegment(`left:${index}`, 'branch', node, leftNode, rootRadius * 0.24, rootRadius * 0.07);
      builder.addSegment(`right:${index}`, 'branch', node, rightNode, rootRadius * 0.24, rootRadius * 0.07);
      builder.addSegment(`rib:${index}`, 'rib', leftNode, rightNode, rootRadius * 0.055, rootRadius * 0.055);
    }
  }

  const perimeter = [root, ...right, ...(left.slice().reverse())];
  if (perimeter.length >= 3) {
    builder.addSurface(
      'membrane',
      'fan-membrane',
      perimeter,
      colony.footprintRadius * 0.025,
      colony.footprintRadius * 2,
    );
  }
}

function buildSkeleton(
  colony: ReefColonyPlacement,
  attachment: ReefFoundationAttachment,
  config: ReefColonySkeletonConfig,
): ReefColonySkeleton {
  const skeletonId = `reef:colony-skeleton:${colony.id}`;
  const seed = stableSeed(colony.seed, skeletonId);
  const builder = makeBuilder(skeletonId, seed);

  if (colony.morphotype === 'branching') buildBranching(builder, colony, config);
  else if (colony.morphotype === 'massive') buildMassive(builder, colony, config);
  else if (colony.morphotype === 'plating') buildPlating(builder, colony, config);
  else if (colony.morphotype === 'encrusting') buildEncrusting(builder, colony, config);
  else if (colony.morphotype === 'soft-coral') buildSoftCoral(builder, colony, config);
  else buildSeaFan(builder, colony);

  return {
    id: skeletonId,
    colonyId: colony.id,
    attachmentId: attachment.id,
    sequence: colony.sequence,
    seed,
    morphotype: colony.morphotype,
    role: colony.role,
    tier: colony.tier,
    emphasized: colony.emphasized,
    maturity: round6(clamp01(colony.maturity)),
    footprintRadius: round6(colony.footprintRadius),
    targetHeight: round6(colony.targetHeight),
    basis: basisFor(attachment),
    nodes: builder.nodes,
    segments: builder.segments,
    surfaces: builder.surfaces,
  };
}

function emptyMorphotypeCounts(): Record<ReefColonyMorphotype, number> {
  return {
    branching: 0,
    massive: 0,
    plating: 0,
    encrusting: 0,
    'soft-coral': 0,
    'sea-fan': 0,
  };
}

/**
 * Pure Phase 4 adapter. It converts accepted colony attachments into stable,
 * renderer-independent morphotype skeletons without creating mesh geometry,
 * materials, scene objects, animation callbacks or database work.
 */
export function buildReefColonySkeletons(
  input: BuildReefColonySkeletonsInput,
): ReefColonySkeletonState {
  const config = input.config ?? DEFAULT_REEF_COLONY_SKELETON_CONFIG;
  validateConfig(config);
  validateProvenance(input);

  const coloniesById = new Map(input.layout.colonies.map((colony) => [colony.id, colony] as const));
  const attachmentsByColonyId = new Map(
    input.foundation.attachments.map((attachment) => [attachment.colonyId, attachment] as const),
  );
  const colonyIdsWithoutAttachment = input.layout.colonies
    .filter((colony) => !attachmentsByColonyId.has(colony.id))
    .map((colony) => colony.id);
  const attachmentIdsWithoutColony = input.foundation.attachments
    .filter((attachment) => !coloniesById.has(attachment.colonyId))
    .map((attachment) => attachment.id);

  const skeletons = input.layout.colonies.flatMap((colony) => {
    const attachment = attachmentsByColonyId.get(colony.id);
    return attachment ? [buildSkeleton(colony, attachment, config)] : [];
  });
  const skeletonColonyIds = new Set(skeletons.map((skeleton) => skeleton.colonyId));
  const colonyIdsWithoutSkeleton = input.layout.colonies
    .filter((colony) => !skeletonColonyIds.has(colony.id))
    .map((colony) => colony.id);

  const morphotypeCounts = emptyMorphotypeCounts();
  const invalidSegmentIds: string[] = [];
  const invalidSurfaceIds: string[] = [];
  let nodeCount = 0;
  let segmentCount = 0;
  let surfaceCount = 0;

  for (const skeleton of skeletons) {
    morphotypeCounts[skeleton.morphotype] += 1;
    nodeCount += skeleton.nodes.length;
    segmentCount += skeleton.segments.length;
    surfaceCount += skeleton.surfaces.length;
    const nodeIds = new Set(skeleton.nodes.map((node) => node.id));
    for (const segment of skeleton.segments) {
      if (!nodeIds.has(segment.fromNodeId) || !nodeIds.has(segment.toNodeId)) {
        invalidSegmentIds.push(segment.id);
      }
    }
    for (const surface of skeleton.surfaces) {
      if (surface.nodeIds.length < 3 || surface.nodeIds.some((nodeId) => !nodeIds.has(nodeId))) {
        invalidSurfaceIds.push(surface.id);
      }
    }
  }

  return {
    reefColonySkeletonVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    descriptor: {
      id: 'reef:colony-skeletons',
      skeletonId: 'reef:colony-skeleton',
      nodeId: 'reef:skeleton-node',
      segmentId: 'reef:skeleton-segment',
      surfaceId: 'reef:skeleton-surface',
    },
    sourceSpeciesBlueprintVersion: input.species.speciesBlueprintVersion,
    sourceSpeciesRulesVersion: input.species.rulesVersion,
    sourceColonyLayoutVersion: input.layout.reefColonyLayoutVersion,
    sourceColonyLayoutRulesVersion: input.layout.rulesVersion,
    sourceFoundationMeshVersion: input.foundation.reefFoundationMeshVersion,
    sourceFoundationRulesVersion: input.foundation.rulesVersion,
    artifactSeed: input.species.artifactSeed,
    asOf: input.species.asOf,
    skeletons,
    diagnostics: {
      sourceColonyCount: input.layout.colonies.length,
      skeletonCount: skeletons.length,
      nodeCount,
      segmentCount,
      surfaceCount,
      morphotypeCounts,
      colonyIdsWithoutAttachment,
      attachmentIdsWithoutColony,
      colonyIdsWithoutSkeleton,
      invalidSegmentIds,
      invalidSurfaceIds,
      maximumNodes: config.maximumNodes,
      maximumSegments: config.maximumSegments,
      maximumSurfaces: config.maximumSurfaces,
      logicalBudgetExceeded:
        nodeCount > config.maximumNodes
        || segmentCount > config.maximumSegments
        || surfaceCount > config.maximumSurfaces,
      rendererVertices: 0,
      rendererTriangles: 0,
      rendererInstances: 0,
      estimatedDrawCalls: 0,
      materialSlots: 0,
      perFrameUpdates: 0,
    },
  };
}
