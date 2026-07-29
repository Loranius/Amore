import {
  add,
  clamp,
  distance,
  normalize,
  orthonormalBasis,
  round6,
  roundVec,
  scale,
  seededUnit,
  subtract,
} from '../../growth/math';
import type { GrowthVec3 } from '../../growth/types';
import type {
  BuildOrganicSkeletonInput,
  OrganicAttractor,
  OrganicSkeletonConfig,
  OrganicSkeletonNode,
  OrganicSkeletonState,
} from './types';

interface HostSelection {
  node: OrganicSkeletonNode;
  usedFallback: boolean;
}

function sortedAttractors(attractors: readonly OrganicAttractor[]): OrganicAttractor[] {
  return [...attractors].sort(
    (left, right) => left.sequence - right.sequence || left.id.localeCompare(right.id),
  );
}

function clampToCrown(position: GrowthVec3, config: OrganicSkeletonConfig): GrowthVec3 {
  const maxY = config.trunkHeight + config.crownHeight;
  const horizontal = Math.hypot(position.x, position.z);
  const horizontalScale = horizontal > config.crownRadius && horizontal > 1e-9
    ? config.crownRadius / horizontal
    : 1;

  return roundVec({
    x: position.x * horizontalScale,
    y: clamp(position.y, 0, maxY),
    z: position.z * horizontalScale,
  });
}

function buildTrunk(seed: number, config: OrganicSkeletonConfig): OrganicSkeletonNode[] {
  const segmentCount = Math.max(1, Math.ceil(config.trunkHeight / Math.max(config.trunkStep, 1e-3)));
  const nodes: OrganicSkeletonNode[] = [];

  for (let index = 0; index <= segmentCount; index += 1) {
    const t = index / segmentCount;
    const swayEnvelope = Math.sin(t * Math.PI) * config.lateralJitter * 0.45;
    const position = roundVec({
      x: (seededUnit(seed, `organic-trunk:${index}:x`) * 2 - 1) * swayEnvelope,
      y: config.trunkHeight * t,
      z: (seededUnit(seed, `organic-trunk:${index}:z`) * 2 - 1) * swayEnvelope,
    });
    const previous = nodes[index - 1];
    const direction = previous
      ? normalize(subtract(position, previous.position))
      : { x: 0, y: 1, z: 0 };

    nodes.push({
      id: `organic:trunk:${index}`,
      branchId: 'organic:trunk',
      parentId: previous?.id ?? null,
      attractorId: null,
      sequence: index,
      generation: 0,
      position,
      direction: roundVec(direction),
      radius: round6(config.baseRadius * (1 - t * 0.58)),
      terminal: index === segmentCount,
    });
  }

  return nodes;
}

function selectHost(
  nodes: readonly OrganicSkeletonNode[],
  attractor: OrganicAttractor,
  config: OrganicSkeletonConfig,
): HostSelection | null {
  const eligible = nodes.filter(
    (node) =>
      node.generation < config.maxGeneration
      && node.position.y <= attractor.position.y + config.branchStep,
  );
  if (eligible.length === 0) return null;

  const influenced = eligible.filter(
    (node) => distance(node.position, attractor.position) <= config.influenceRadius,
  );
  const candidates = influenced.length > 0 ? influenced : eligible;

  const ranked = candidates
    .map((node) => {
      const separation = distance(node.position, attractor.position);
      const abovePenalty = Math.max(0, node.position.y - attractor.position.y) * 2.4;
      const generationPenalty = node.generation * 0.08;
      const interiorPenalty = node.terminal ? 0 : 0.025;
      return {
        node,
        score: separation + abovePenalty + generationPenalty + interiorPenalty,
      };
    })
    .sort(
      (left, right) =>
        left.score - right.score
        || left.node.sequence - right.node.sequence
        || left.node.id.localeCompare(right.node.id),
    );

  return {
    node: ranked[0]!.node,
    usedFallback: influenced.length === 0,
  };
}

function branchDirection(
  seed: number,
  attractor: OrganicAttractor,
  segmentIndex: number,
  parentDirection: GrowthVec3,
  currentPosition: GrowthVec3,
  config: OrganicSkeletonConfig,
): GrowthVec3 {
  const targetDirection = normalize(subtract(attractor.position, currentPosition));
  const { tangent, bitangent } = orthonormalBasis(targetDirection);
  const tangentJitter = seededUnit(seed, `${attractor.id}:${segmentIndex}:tangent`) * 2 - 1;
  const bitangentJitter = seededUnit(seed, `${attractor.id}:${segmentIndex}:bitangent`) * 2 - 1;

  const guided = add(
    scale(targetDirection, 1 - config.directionMemory),
    scale(parentDirection, config.directionMemory),
  );
  const biased = add(guided, { x: 0, y: config.upwardBias, z: 0 });
  const jittered = add(
    add(biased, scale(tangent, tangentJitter * config.lateralJitter)),
    scale(bitangent, bitangentJitter * config.lateralJitter),
  );

  return roundVec(normalize(jittered));
}

/**
 * Builds an original append-only 3D growth skeleton inspired by the general
 * space-colonization family of algorithms.
 *
 * Attractors are processed in stable sequence order. Each attractor adds a new
 * branch path but never mutates previously emitted nodes, so appending a later
 * relationship event keeps the historical skeleton byte-stable.
 */
export function buildOrganicSkeleton({
  seed,
  attractors,
  config,
}: BuildOrganicSkeletonInput): OrganicSkeletonState {
  const nodes = buildTrunk(seed, config);
  const consumedAttractorIds: string[] = [];
  const unresolvedAttractorIds: string[] = [];
  const truncatedAttractorIds: string[] = [];
  const fallbackHostAttractorIds: string[] = [];

  for (const attractor of sortedAttractors(attractors)) {
    if (nodes.length >= config.maxNodes) {
      truncatedAttractorIds.push(attractor.id);
      continue;
    }

    const hostSelection = selectHost(nodes, attractor, config);
    if (!hostSelection) {
      unresolvedAttractorIds.push(attractor.id);
      continue;
    }
    if (hostSelection.usedFallback) fallbackHostAttractorIds.push(attractor.id);

    const generation = hostSelection.node.generation + 1;
    const branchId = `organic:branch:${attractor.id}`;
    const branchNodes: OrganicSkeletonNode[] = [];
    let parent = hostSelection.node;
    let currentPosition = parent.position;
    let currentDirection = parent.direction;

    for (let segmentIndex = 0; segmentIndex < config.maxBranchSegments; segmentIndex += 1) {
      const remaining = distance(currentPosition, attractor.position);
      if (remaining <= config.killRadius || nodes.length + branchNodes.length >= config.maxNodes) break;

      const direction = branchDirection(
        seed,
        attractor,
        segmentIndex,
        currentDirection,
        currentPosition,
        config,
      );
      const stepLength = Math.min(
        config.branchStep,
        Math.max(config.branchStep * 0.35, remaining - config.killRadius),
      );
      const position = clampToCrown(add(currentPosition, scale(direction, stepLength)), config);
      const progress = (segmentIndex + 1) / config.maxBranchSegments;
      const radius = Math.max(
        0.006,
        hostSelection.node.radius
          * config.radiusDecay
          * (1 - progress * 0.58)
          * (0.82 + attractor.weight * 0.18),
      );
      const node: OrganicSkeletonNode = {
        id: `${branchId}:${segmentIndex}`,
        branchId,
        parentId: parent.id,
        attractorId: attractor.id,
        sequence: nodes.length + branchNodes.length,
        generation,
        position,
        direction,
        radius: round6(radius),
        terminal: false,
      };

      branchNodes.push(node);
      parent = node;
      currentPosition = position;
      currentDirection = direction;
    }

    if (branchNodes.length === 0) {
      unresolvedAttractorIds.push(attractor.id);
      continue;
    }

    branchNodes[branchNodes.length - 1] = {
      ...branchNodes[branchNodes.length - 1]!,
      terminal: true,
    };
    nodes.push(...branchNodes);

    if (distance(currentPosition, attractor.position) <= config.killRadius) {
      consumedAttractorIds.push(attractor.id);
    } else if (nodes.length >= config.maxNodes) {
      truncatedAttractorIds.push(attractor.id);
    } else {
      unresolvedAttractorIds.push(attractor.id);
    }
  }

  return {
    organicSkeletonVersion: 1,
    rulesVersion: config.rulesVersion,
    seed,
    nodes,
    diagnostics: {
      consumedAttractorIds,
      unresolvedAttractorIds,
      truncatedAttractorIds,
      fallbackHostAttractorIds,
      maxGeneration: Math.max(0, ...nodes.map((node) => node.generation)),
    },
  };
}
