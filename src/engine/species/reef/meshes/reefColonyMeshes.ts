import { DEFAULT_REEF_COLONY_MESH_CONFIG } from './config';
import { round6 } from '../math';
import { REEF_COLONY_MORPHOTYPES, type ReefColonyMorphotype } from '../types';
import type { ReefLayoutVec3 } from '../layout';
import type {
  ReefColonySkeleton,
  ReefSkeletonNode,
  ReefSkeletonSegment,
  ReefSkeletonSurface,
} from '../skeletons';
import type {
  BuildReefColonyMeshesInput,
  ReefColonyMeshBatch,
  ReefColonyMeshBounds,
  ReefColonyMeshConfig,
  ReefColonyMeshRange,
  ReefColonyMeshState,
  ReefColonyMeshTriangle,
  ReefColonyMeshVertex,
  ReefMeshVec2,
} from './types';

const TAU = Math.PI * 2;

function vector(x = 0, y = 0, z = 0): ReefLayoutVec3 {
  return { x, y, z };
}

function add(left: ReefLayoutVec3, right: ReefLayoutVec3): ReefLayoutVec3 {
  return vector(left.x + right.x, left.y + right.y, left.z + right.z);
}

function subtract(left: ReefLayoutVec3, right: ReefLayoutVec3): ReefLayoutVec3 {
  return vector(left.x - right.x, left.y - right.y, left.z - right.z);
}

function scale(value: ReefLayoutVec3, amount: number): ReefLayoutVec3 {
  return vector(value.x * amount, value.y * amount, value.z * amount);
}

function cross(left: ReefLayoutVec3, right: ReefLayoutVec3): ReefLayoutVec3 {
  return vector(
    left.y * right.z - left.z * right.y,
    left.z * right.x - left.x * right.z,
    left.x * right.y - left.y * right.x,
  );
}

function length(value: ReefLayoutVec3): number {
  return Math.hypot(value.x, value.y, value.z);
}

function normalize(value: ReefLayoutVec3, fallback = vector(0, 1, 0)): ReefLayoutVec3 {
  const magnitude = length(value);
  if (!Number.isFinite(magnitude) || magnitude <= 1e-10) return roundVector(fallback);
  return roundVector(scale(value, 1 / magnitude));
}

function roundVector(value: ReefLayoutVec3): ReefLayoutVec3 {
  return vector(round6(value.x), round6(value.y), round6(value.z));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function worldPoint(skeleton: ReefColonySkeleton, local: ReefLayoutVec3): ReefLayoutVec3 {
  return roundVector(add(
    skeleton.basis.origin,
    add(
      scale(skeleton.basis.right, local.x),
      add(scale(skeleton.basis.up, local.y), scale(skeleton.basis.forward, local.z)),
    ),
  ));
}

function validateConfig(config: ReefColonyMeshConfig): void {
  if (!config.rulesVersion.trim()) {
    throw new Error('Reef Colony Meshes requires a non-empty rulesVersion.');
  }
  for (const [name, value, minimum] of [
    ['tubeRadialSegments', config.tubeRadialSegments, 3],
    ['maximumVertices', config.maximumVertices, 1],
    ['maximumTriangles', config.maximumTriangles, 1],
  ] as const) {
    if (!Number.isInteger(value) || value < minimum) {
      throw new Error(`Reef Colony Meshes ${name} must be an integer >= ${minimum}.`);
    }
  }
  if (!Number.isFinite(config.minimumSegmentLength) || config.minimumSegmentLength <= 0) {
    throw new Error('Reef Colony Meshes minimumSegmentLength must be finite and positive.');
  }
}

function validateProvenance(input: BuildReefColonyMeshesInput): void {
  const { species, layout, foundation, skeletons } = input;
  if (species.species !== 'reef') {
    throw new Error('Reef Colony Meshes requires a Reef Species blueprint.');
  }
  if (
    layout.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || layout.sourceSpeciesRulesVersion !== species.rulesVersion
    || layout.artifactSeed !== species.artifactSeed
    || layout.asOf !== species.asOf
  ) {
    throw new Error('Reef Colony Meshes received an incompatible Colony Layout provenance.');
  }
  if (
    foundation.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || foundation.sourceSpeciesRulesVersion !== species.rulesVersion
    || foundation.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || foundation.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || foundation.artifactSeed !== species.artifactSeed
    || foundation.asOf !== species.asOf
  ) {
    throw new Error('Reef Colony Meshes received an incompatible Foundation Mesh provenance.');
  }
  if (
    skeletons.sourceSpeciesBlueprintVersion !== species.speciesBlueprintVersion
    || skeletons.sourceSpeciesRulesVersion !== species.rulesVersion
    || skeletons.sourceColonyLayoutVersion !== layout.reefColonyLayoutVersion
    || skeletons.sourceColonyLayoutRulesVersion !== layout.rulesVersion
    || skeletons.sourceFoundationMeshVersion !== foundation.reefFoundationMeshVersion
    || skeletons.sourceFoundationRulesVersion !== foundation.rulesVersion
    || skeletons.artifactSeed !== species.artifactSeed
    || skeletons.asOf !== species.asOf
  ) {
    throw new Error('Reef Colony Meshes received an incompatible Colony Skeleton provenance.');
  }
}

interface MutableBatch {
  id: string;
  morphotype: ReefColonyMorphotype;
  vertices: ReefColonyMeshVertex[];
  triangles: ReefColonyMeshTriangle[];
  index: number[];
  ranges: ReefColonyMeshRange[];
}

interface ColonyWriter {
  batch: MutableBatch;
  skeleton: ReefColonySkeleton;
  rangeId: string;
  vertexStart: number;
  triangleStart: number;
  indexStart: number;
  addVertex: (label: string, position: ReefLayoutVec3, uv?: ReefMeshVec2) => number;
  addTriangle: (label: string, a: number, b: number, c: number) => void;
}

function createWriter(batch: MutableBatch, skeleton: ReefColonySkeleton): ColonyWriter {
  const rangeId = `reef:colony-mesh-range:${skeleton.colonyId}`;
  const writer: ColonyWriter = {
    batch,
    skeleton,
    rangeId,
    vertexStart: batch.vertices.length,
    triangleStart: batch.triangles.length,
    indexStart: batch.index.length,
    addVertex(label, position, uv = { u: 0.5, v: 0.5 }) {
      const index = batch.vertices.length;
      batch.vertices.push({
        id: `${rangeId}:vertex:${label}`,
        sequence: index,
        colonyId: skeleton.colonyId,
        morphotype: skeleton.morphotype,
        position: roundVector(position),
        normal: vector(0, 0, 0),
        uv: { u: round6(clamp01(uv.u)), v: round6(clamp01(uv.v)) },
      });
      return index;
    },
    addTriangle(label, a, b, c) {
      const sequence = batch.triangles.length;
      batch.triangles.push({
        id: `${rangeId}:triangle:${label}`,
        sequence,
        colonyId: skeleton.colonyId,
        morphotype: skeleton.morphotype,
        a,
        b,
        c,
      });
      batch.index.push(a, b, c);
    },
  };
  return writer;
}

function nodeMap(skeleton: ReefColonySkeleton): Map<string, ReefSkeletonNode> {
  return new Map(skeleton.nodes.map((node) => [node.id, node] as const));
}

function addTube(
  writer: ColonyWriter,
  label: string,
  start: ReefLayoutVec3,
  end: ReefLayoutVec3,
  radiusStart: number,
  radiusEnd: number,
  config: ReefColonyMeshConfig,
): void {
  const directionVector = subtract(end, start);
  const segmentLength = length(directionVector);
  if (segmentLength < config.minimumSegmentLength) return;

  const direction = normalize(directionVector);
  const helper = Math.abs(direction.y) < 0.88 ? vector(0, 1, 0) : vector(1, 0, 0);
  const axisA = normalize(cross(direction, helper), vector(1, 0, 0));
  const axisB = normalize(cross(direction, axisA), vector(0, 0, 1));
  const radialSegments = config.tubeRadialSegments;
  const startRing: number[] = [];
  const endRing: number[] = [];

  for (let side = 0; side < radialSegments; side += 1) {
    const angle = side * TAU / radialSegments;
    const radial = add(scale(axisA, Math.cos(angle)), scale(axisB, Math.sin(angle)));
    startRing.push(writer.addVertex(
      `${label}:start:${side}`,
      add(start, scale(radial, radiusStart)),
      { u: side / radialSegments, v: 0 },
    ));
    endRing.push(writer.addVertex(
      `${label}:end:${side}`,
      add(end, scale(radial, radiusEnd)),
      { u: side / radialSegments, v: 1 },
    ));
  }

  const startCenter = writer.addVertex(`${label}:cap:start`, start, { u: 0.5, v: 0.5 });
  const endCenter = writer.addVertex(`${label}:cap:end`, end, { u: 0.5, v: 0.5 });

  for (let side = 0; side < radialSegments; side += 1) {
    const next = (side + 1) % radialSegments;
    const a = startRing[side] as number;
    const b = startRing[next] as number;
    const c = endRing[side] as number;
    const d = endRing[next] as number;
    writer.addTriangle(`${label}:side:${side}:a`, a, d, c);
    writer.addTriangle(`${label}:side:${side}:b`, a, b, d);
    writer.addTriangle(`${label}:cap:start:${side}`, startCenter, b, a);
    writer.addTriangle(`${label}:cap:end:${side}`, endCenter, c, d);
  }
}

function addMassiveEnvelope(
  writer: ColonyWriter,
  surface: ReefSkeletonSurface,
  nodes: Map<string, ReefSkeletonNode>,
): void {
  const controls = surface.nodeIds
    .map((id) => nodes.get(id))
    .filter((node): node is ReefSkeletonNode => node !== undefined);
  if (controls.length < 4) return;
  const root = controls[0] as ReefSkeletonNode;
  const apex = controls[controls.length - 1] as ReefSkeletonNode;
  const ring = controls.slice(1, -1);
  if (ring.length < 3) return;

  const rootIndex = writer.addVertex(`${surface.id}:root`, worldPoint(writer.skeleton, root.localPosition));
  const apexIndex = writer.addVertex(`${surface.id}:apex`, worldPoint(writer.skeleton, apex.localPosition));
  const ringIndices = ring.map((node, index) => writer.addVertex(
    `${surface.id}:ring:${index}`,
    worldPoint(writer.skeleton, node.localPosition),
    { u: index / ring.length, v: 0.5 },
  ));

  for (let index = 0; index < ringIndices.length; index += 1) {
    const next = (index + 1) % ringIndices.length;
    writer.addTriangle(`${surface.id}:lower:${index}`, rootIndex, ringIndices[next] as number, ringIndices[index] as number);
    writer.addTriangle(`${surface.id}:upper:${index}`, apexIndex, ringIndices[index] as number, ringIndices[next] as number);
  }
}

function addClosedDisc(
  writer: ColonyWriter,
  surface: ReefSkeletonSurface,
  nodes: Map<string, ReefSkeletonNode>,
): void {
  const controls = surface.nodeIds
    .map((id) => nodes.get(id))
    .filter((node): node is ReefSkeletonNode => node !== undefined);
  if (controls.length < 4) return;
  const center = controls[0] as ReefSkeletonNode;
  const rim = controls.slice(1);
  const halfThickness = surface.thickness * 0.5;
  const offset = scale(writer.skeleton.basis.up, halfThickness);
  const centerWorld = worldPoint(writer.skeleton, center.localPosition);
  const topCenter = writer.addVertex(`${surface.id}:top:center`, add(centerWorld, offset));
  const bottomCenter = writer.addVertex(`${surface.id}:bottom:center`, subtract(centerWorld, offset));
  const topRing: number[] = [];
  const bottomRing: number[] = [];

  rim.forEach((node, index) => {
    const point = worldPoint(writer.skeleton, node.localPosition);
    const uv = { u: 0.5 + Math.cos(index * TAU / rim.length) * 0.5, v: 0.5 + Math.sin(index * TAU / rim.length) * 0.5 };
    topRing.push(writer.addVertex(`${surface.id}:top:${index}`, add(point, offset), uv));
    bottomRing.push(writer.addVertex(`${surface.id}:bottom:${index}`, subtract(point, offset), uv));
  });

  for (let index = 0; index < rim.length; index += 1) {
    const next = (index + 1) % rim.length;
    const topA = topRing[index] as number;
    const topB = topRing[next] as number;
    const bottomA = bottomRing[index] as number;
    const bottomB = bottomRing[next] as number;
    writer.addTriangle(`${surface.id}:top:${index}`, topCenter, topA, topB);
    writer.addTriangle(`${surface.id}:bottom:${index}`, bottomCenter, bottomB, bottomA);
    writer.addTriangle(`${surface.id}:side:${index}:a`, topA, bottomA, bottomB);
    writer.addTriangle(`${surface.id}:side:${index}:b`, topA, bottomB, topB);
  }
}

function addTriangularPrism(
  writer: ColonyWriter,
  surface: ReefSkeletonSurface,
  nodes: Map<string, ReefSkeletonNode>,
): void {
  const controls = surface.nodeIds
    .map((id) => nodes.get(id))
    .filter((node): node is ReefSkeletonNode => node !== undefined);
  if (controls.length !== 3) return;
  const points = controls.map((node) => worldPoint(writer.skeleton, node.localPosition));
  const normal = normalize(
    cross(subtract(points[1] as ReefLayoutVec3, points[0] as ReefLayoutVec3), subtract(points[2] as ReefLayoutVec3, points[0] as ReefLayoutVec3)),
    writer.skeleton.basis.forward,
  );
  const offset = scale(normal, surface.thickness * 0.5);
  const front = points.map((point, index) => writer.addVertex(
    `${surface.id}:front:${index}`,
    add(point, offset),
    { u: index === 0 ? 0 : index === 1 ? 0.5 : 1, v: index === 1 ? 1 : 0 },
  ));
  const back = points.map((point, index) => writer.addVertex(
    `${surface.id}:back:${index}`,
    subtract(point, offset),
    { u: index === 0 ? 0 : index === 1 ? 0.5 : 1, v: index === 1 ? 1 : 0 },
  ));

  writer.addTriangle(`${surface.id}:front`, front[0] as number, front[1] as number, front[2] as number);
  writer.addTriangle(`${surface.id}:back`, back[0] as number, back[2] as number, back[1] as number);
  for (let edge = 0; edge < 3; edge += 1) {
    const next = (edge + 1) % 3;
    writer.addTriangle(`${surface.id}:side:${edge}:a`, front[edge] as number, back[edge] as number, back[next] as number);
    writer.addTriangle(`${surface.id}:side:${edge}:b`, front[edge] as number, back[next] as number, front[next] as number);
  }
}

function addMembrane(
  writer: ColonyWriter,
  surface: ReefSkeletonSurface,
  nodes: Map<string, ReefSkeletonNode>,
): void {
  const controls = surface.nodeIds
    .map((id) => nodes.get(id))
    .filter((node): node is ReefSkeletonNode => node !== undefined);
  if (controls.length < 3) return;
  const points = controls.map((node) => worldPoint(writer.skeleton, node.localPosition));
  const center = scale(points.reduce((sum, point) => add(sum, point), vector()), 1 / points.length);
  const offset = scale(writer.skeleton.basis.forward, surface.thickness * 0.5);
  const frontCenter = writer.addVertex(`${surface.id}:front:center`, add(center, offset));
  const backCenter = writer.addVertex(`${surface.id}:back:center`, subtract(center, offset));
  const front: number[] = [];
  const back: number[] = [];

  points.forEach((point, index) => {
    const uv = { u: index / Math.max(1, points.length - 1), v: clamp01((point.y - writer.skeleton.basis.origin.y) / Math.max(0.001, writer.skeleton.targetHeight)) };
    front.push(writer.addVertex(`${surface.id}:front:${index}`, add(point, offset), uv));
    back.push(writer.addVertex(`${surface.id}:back:${index}`, subtract(point, offset), uv));
  });

  for (let index = 0; index < points.length; index += 1) {
    const next = (index + 1) % points.length;
    writer.addTriangle(`${surface.id}:front:${index}`, frontCenter, front[index] as number, front[next] as number);
    writer.addTriangle(`${surface.id}:back:${index}`, backCenter, back[next] as number, back[index] as number);
    writer.addTriangle(`${surface.id}:side:${index}:a`, front[index] as number, back[index] as number, back[next] as number);
    writer.addTriangle(`${surface.id}:side:${index}:b`, front[index] as number, back[next] as number, front[next] as number);
  }
}

function shouldMeshSegment(morphotype: ReefColonyMorphotype, segment: ReefSkeletonSegment): boolean {
  if (morphotype === 'branching') return true;
  if (morphotype === 'massive' || morphotype === 'encrusting') return false;
  if (morphotype === 'plating') return segment.kind === 'stalk';
  return true;
}

function meshSkeleton(
  writer: ColonyWriter,
  config: ReefColonyMeshConfig,
): void {
  const skeleton = writer.skeleton;
  const nodes = nodeMap(skeleton);

  for (const segment of skeleton.segments) {
    if (!shouldMeshSegment(skeleton.morphotype, segment)) continue;
    const startNode = nodes.get(segment.fromNodeId);
    const endNode = nodes.get(segment.toNodeId);
    if (!startNode || !endNode) continue;
    addTube(
      writer,
      segment.id,
      worldPoint(skeleton, startNode.localPosition),
      worldPoint(skeleton, endNode.localPosition),
      segment.radiusStart,
      segment.radiusEnd,
      config,
    );
  }

  for (const surface of skeleton.surfaces) {
    if (surface.kind === 'massive-envelope') addMassiveEnvelope(writer, surface, nodes);
    else if (surface.kind === 'plate-disc' || surface.kind === 'encrusting-patch') {
      addClosedDisc(writer, surface, nodes);
    } else if (surface.kind === 'soft-lobe-envelope') {
      addTriangularPrism(writer, surface, nodes);
    } else if (surface.kind === 'fan-membrane') {
      addMembrane(writer, surface, nodes);
    }
  }
}

function calculateBounds(vertices: readonly ReefColonyMeshVertex[]): ReefColonyMeshBounds {
  if (vertices.length === 0) {
    return { minimum: vector(), maximum: vector(), center: vector(), radius: 0 };
  }
  const minimum = vector(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const maximum = vector(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);
  for (const vertex of vertices) {
    minimum.x = Math.min(minimum.x, vertex.position.x);
    minimum.y = Math.min(minimum.y, vertex.position.y);
    minimum.z = Math.min(minimum.z, vertex.position.z);
    maximum.x = Math.max(maximum.x, vertex.position.x);
    maximum.y = Math.max(maximum.y, vertex.position.y);
    maximum.z = Math.max(maximum.z, vertex.position.z);
  }
  const center = scale(add(minimum, maximum), 0.5);
  let radius = 0;
  for (const vertex of vertices) radius = Math.max(radius, length(subtract(vertex.position, center)));
  return {
    minimum: roundVector(minimum),
    maximum: roundVector(maximum),
    center: roundVector(center),
    radius: round6(radius),
  };
}

function finalizeRange(writer: ColonyWriter): void {
  const vertexCount = writer.batch.vertices.length - writer.vertexStart;
  const triangleCount = writer.batch.triangles.length - writer.triangleStart;
  const indexCount = writer.batch.index.length - writer.indexStart;
  writer.batch.ranges.push({
    id: writer.rangeId,
    colonyId: writer.skeleton.colonyId,
    skeletonId: writer.skeleton.id,
    morphotype: writer.skeleton.morphotype,
    sequence: writer.skeleton.sequence,
    vertexStart: writer.vertexStart,
    vertexCount,
    triangleStart: writer.triangleStart,
    triangleCount,
    indexStart: writer.indexStart,
    indexCount,
    bounds: calculateBounds(writer.batch.vertices.slice(writer.vertexStart)),
  });
}

function finalizeNormals(batch: MutableBatch): void {
  const accumulators = batch.vertices.map(() => vector());
  for (const triangle of batch.triangles) {
    const first = batch.vertices[triangle.a];
    const second = batch.vertices[triangle.b];
    const third = batch.vertices[triangle.c];
    if (!first || !second || !third) continue;
    const face = cross(
      subtract(second.position, first.position),
      subtract(third.position, first.position),
    );
    accumulators[triangle.a] = add(accumulators[triangle.a] as ReefLayoutVec3, face);
    accumulators[triangle.b] = add(accumulators[triangle.b] as ReefLayoutVec3, face);
    accumulators[triangle.c] = add(accumulators[triangle.c] as ReefLayoutVec3, face);
  }
  batch.vertices.forEach((vertex, index) => {
    vertex.normal = normalize(accumulators[index] as ReefLayoutVec3, vector(0, 1, 0));
  });
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

function triangleArea(
  triangle: ReefColonyMeshTriangle,
  vertices: readonly ReefColonyMeshVertex[],
): number {
  const first = vertices[triangle.a];
  const second = vertices[triangle.b];
  const third = vertices[triangle.c];
  if (!first || !second || !third) return 0;
  return length(cross(
    subtract(second.position, first.position),
    subtract(third.position, first.position),
  )) * 0.5;
}

/**
 * Pure Phase 5 adapter. It converts stable Phase 4 skeletons into bounded,
 * renderer-independent world-space vertex/index buffers without materials,
 * Three.js objects, animation callbacks or database work.
 */
export function buildReefColonyMeshes(
  input: BuildReefColonyMeshesInput,
): ReefColonyMeshState {
  const config = input.config ?? DEFAULT_REEF_COLONY_MESH_CONFIG;
  validateConfig(config);
  validateProvenance(input);

  const coloniesById = new Map(input.layout.colonies.map((colony) => [colony.id, colony] as const));
  const skeletonsByColonyId = new Map(
    input.skeletons.skeletons.map((skeleton) => [skeleton.colonyId, skeleton] as const),
  );
  const colonyIdsWithoutSkeleton = input.layout.colonies
    .filter((colony) => !skeletonsByColonyId.has(colony.id))
    .map((colony) => colony.id);
  const skeletonIdsWithoutColony = input.skeletons.skeletons
    .filter((skeleton) => !coloniesById.has(skeleton.colonyId))
    .map((skeleton) => skeleton.id);

  const mutableBatches: MutableBatch[] = REEF_COLONY_MORPHOTYPES.map((morphotype) => ({
    id: `reef:colony-mesh-batch:${morphotype}`,
    morphotype,
    vertices: [],
    triangles: [],
    index: [],
    ranges: [],
  }));
  const batchByMorphotype = new Map(
    mutableBatches.map((batch) => [batch.morphotype, batch] as const),
  );

  for (const skeleton of input.skeletons.skeletons) {
    if (!coloniesById.has(skeleton.colonyId)) continue;
    const batch = batchByMorphotype.get(skeleton.morphotype);
    if (!batch) continue;
    const writer = createWriter(batch, skeleton);
    meshSkeleton(writer, config);
    finalizeRange(writer);
  }

  for (const batch of mutableBatches) finalizeNormals(batch);
  const batches: ReefColonyMeshBatch[] = mutableBatches
    .filter((batch) => batch.vertices.length > 0)
    .map((batch) => ({ ...batch }));

  const morphotypeVertexCounts = emptyMorphotypeCounts();
  const morphotypeTriangleCounts = emptyMorphotypeCounts();
  const invalidTriangleIds: string[] = [];
  const degenerateTriangleIds: string[] = [];
  const nonFiniteVertexIds: string[] = [];
  const nonUnitNormalVertexIds: string[] = [];
  let vertexCount = 0;
  let triangleCount = 0;
  let indexCount = 0;

  for (const batch of batches) {
    vertexCount += batch.vertices.length;
    triangleCount += batch.triangles.length;
    indexCount += batch.index.length;
    morphotypeVertexCounts[batch.morphotype] = batch.vertices.length;
    morphotypeTriangleCounts[batch.morphotype] = batch.triangles.length;

    for (const vertex of batch.vertices) {
      const values = [
        vertex.position.x, vertex.position.y, vertex.position.z,
        vertex.normal.x, vertex.normal.y, vertex.normal.z,
        vertex.uv.u, vertex.uv.v,
      ];
      if (values.some((value) => !Number.isFinite(value))) nonFiniteVertexIds.push(vertex.id);
      if (Math.abs(length(vertex.normal) - 1) > 1e-4) nonUnitNormalVertexIds.push(vertex.id);
    }
    for (const triangle of batch.triangles) {
      if (
        triangle.a < 0 || triangle.a >= batch.vertices.length
        || triangle.b < 0 || triangle.b >= batch.vertices.length
        || triangle.c < 0 || triangle.c >= batch.vertices.length
      ) {
        invalidTriangleIds.push(triangle.id);
      } else if (triangleArea(triangle, batch.vertices) <= 1e-10) {
        degenerateTriangleIds.push(triangle.id);
      }
    }
  }

  const meshedColonyIds = new Set(
    batches.flatMap((batch) => batch.ranges.filter((range) => range.vertexCount > 0).map((range) => range.colonyId)),
  );
  const colonyIdsWithoutMesh = input.layout.colonies
    .filter((colony) => !meshedColonyIds.has(colony.id))
    .map((colony) => colony.id);

  return {
    reefColonyMeshVersion: 1,
    rulesVersion: config.rulesVersion.trim(),
    descriptor: {
      id: 'reef:colony-meshes',
      batchId: 'reef:colony-mesh-batch',
      rangeId: 'reef:colony-mesh-range',
      vertexId: 'reef:colony-mesh-vertex',
      triangleId: 'reef:colony-mesh-triangle',
    },
    sourceSpeciesBlueprintVersion: input.species.speciesBlueprintVersion,
    sourceSpeciesRulesVersion: input.species.rulesVersion,
    sourceColonyLayoutVersion: input.layout.reefColonyLayoutVersion,
    sourceColonyLayoutRulesVersion: input.layout.rulesVersion,
    sourceFoundationMeshVersion: input.foundation.reefFoundationMeshVersion,
    sourceFoundationRulesVersion: input.foundation.rulesVersion,
    sourceColonySkeletonVersion: input.skeletons.reefColonySkeletonVersion,
    sourceColonySkeletonRulesVersion: input.skeletons.rulesVersion,
    artifactSeed: input.species.artifactSeed,
    asOf: input.species.asOf,
    batches,
    diagnostics: {
      sourceSkeletonCount: input.skeletons.skeletons.length,
      meshedColonyCount: meshedColonyIds.size,
      batchCount: batches.length,
      vertexCount,
      triangleCount,
      indexCount,
      morphotypeVertexCounts,
      morphotypeTriangleCounts,
      colonyIdsWithoutSkeleton,
      skeletonIdsWithoutColony,
      colonyIdsWithoutMesh,
      invalidTriangleIds,
      degenerateTriangleIds,
      nonFiniteVertexIds,
      nonUnitNormalVertexIds,
      maximumVertices: config.maximumVertices,
      maximumTriangles: config.maximumTriangles,
      geometryBudgetExceeded:
        vertexCount > config.maximumVertices || triangleCount > config.maximumTriangles,
      estimatedDrawCalls: batches.length,
      materialSlots: 0,
      perFrameUpdates: 0,
    },
  };
}
