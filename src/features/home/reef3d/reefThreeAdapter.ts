import {
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  Float32BufferAttribute,
  MeshPhysicalMaterial,
  type BufferAttribute,
} from 'three';
import type {
  ReefColonyMaterialAssignment,
  ReefColonyMeshBatch,
  ReefColonyMeshRange,
  ReefColonyMotionBinding,
  ReefFoundationMaterialAssignment,
  ReefLayoutVec3,
  ReefMaterialColor,
} from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';

const TAU = Math.PI * 2;
const EPSILON = 1e-6;

export interface ReefRenderableMesh {
  id: string;
  geometry: BufferGeometry;
  material: MeshPhysicalMaterial;
}

export interface ReefBatchRuntimeRange {
  range: ReefColonyMeshRange;
  motion: ReefColonyMotionBinding;
  maximumAxialDistance: number;
  rotationAxis: ReefLayoutVec3;
}

export interface ReefRenderableBatch extends ReefRenderableMesh {
  source: ReefColonyMeshBatch;
  basePositions: Float32Array;
  baseNormals: Float32Array;
  baseColors: Float32Array;
  runtimeRanges: ReefBatchRuntimeRange[];
}

export interface ReefThreeSceneState {
  foundation: ReefRenderableMesh;
  batches: ReefRenderableBatch[];
  diagnostics: {
    drawCalls: number;
    materials: number;
    vertices: number;
    triangles: number;
    motionBindings: number;
  };
}

function colorArray(color: ReefMaterialColor): [number, number, number] {
  return [color.r, color.g, color.b];
}

function multiplyColor(
  left: ReefMaterialColor,
  right: ReefMaterialColor,
): [number, number, number] {
  return [left.r * right.r, left.g * right.g, left.b * right.b];
}

function mixColor(
  base: ReefMaterialColor,
  tint: ReefMaterialColor,
  amount: number,
): [number, number, number] {
  const t = Math.min(1, Math.max(0, amount));
  return [
    base.r + (tint.r - base.r) * t,
    base.g + (tint.g - base.g) * t,
    base.b + (tint.b - base.b) * t,
  ];
}

function cross(left: ReefLayoutVec3, right: ReefLayoutVec3): ReefLayoutVec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

function normalize(value: ReefLayoutVec3): ReefLayoutVec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (length <= EPSILON) return { x: 0, y: 0, z: 1 };
  return { x: value.x / length, y: value.y / length, z: value.z / length };
}

function dot(left: ReefLayoutVec3, right: ReefLayoutVec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

function createPhysicalMaterial(
  assignment: ReefColonyMaterialAssignment | ReefFoundationMaterialAssignment,
): MeshPhysicalMaterial {
  const { palette, response } = assignment;
  return new MeshPhysicalMaterial({
    color: new Color(...colorArray(palette.baseColor)),
    roughness: response.roughness,
    metalness: response.metalness,
    clearcoat: response.clearcoat,
    clearcoatRoughness: response.clearcoatRoughness,
    sheen: response.sheen,
    sheenRoughness: response.sheenRoughness,
    sheenColor: new Color(...colorArray(palette.subsurfaceColor)),
    transmission: response.transmission,
    thickness: response.thickness,
    ior: response.ior,
    opacity: response.opacity,
    transparent: false,
    vertexColors: true,
  });
}

function createFoundationRenderable(build: ReefPreviewBuild): ReefRenderableMesh {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(build.foundation.vertices.length * 3);
  const normals = new Float32Array(build.foundation.vertices.length * 3);
  const uvs = new Float32Array(build.foundation.vertices.length * 2);
  const colors = new Float32Array(build.foundation.vertices.length * 3);
  const modifierBySurface = new Map(
    build.materials.foundation.surfaceModifiers.map((modifier) => [modifier.surface, modifier]),
  );

  build.foundation.vertices.forEach((vertex, index) => {
    const positionOffset = index * 3;
    const uvOffset = index * 2;
    positions.set([vertex.position.x, vertex.position.y, vertex.position.z], positionOffset);
    normals.set([vertex.normal.x, vertex.normal.y, vertex.normal.z], positionOffset);
    uvs.set([vertex.uv.u, vertex.uv.v], uvOffset);
    const modifier = modifierBySurface.get(vertex.surface);
    const color = modifier
      ? multiplyColor(build.materials.foundation.palette.baseColor, modifier.colorMultiplier)
      : colorArray(build.materials.foundation.palette.baseColor);
    colors.set(color, positionOffset);
  });

  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  geometry.setIndex(build.foundation.index);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefSourceId = build.foundation.descriptor.id;
  geometry.userData.reefSurface = 'foundation';

  return {
    id: build.foundation.descriptor.id,
    geometry,
    material: createPhysicalMaterial(build.materials.foundation),
  };
}

function maximumAxialDistance(
  positions: Float32Array,
  range: ReefColonyMeshRange,
  motion: ReefColonyMotionBinding,
): number {
  let maximum = EPSILON;
  for (let index = range.vertexStart; index < range.vertexStart + range.vertexCount; index += 1) {
    const offset = index * 3;
    const relative = {
      x: positions[offset] - motion.pivot.x,
      y: positions[offset + 1] - motion.pivot.y,
      z: positions[offset + 2] - motion.pivot.z,
    };
    maximum = Math.max(maximum, Math.max(0, dot(relative, motion.axis)));
  }
  return maximum;
}

function createBatchRenderable(
  batch: ReefColonyMeshBatch,
  assignment: ReefColonyMaterialAssignment,
  motionByRangeId: ReadonlyMap<string, ReefColonyMotionBinding>,
): ReefRenderableBatch {
  const geometry = new BufferGeometry();
  const positions = new Float32Array(batch.vertices.length * 3);
  const normals = new Float32Array(batch.vertices.length * 3);
  const uvs = new Float32Array(batch.vertices.length * 2);
  const colors = new Float32Array(batch.vertices.length * 3);
  const bindingByRangeId = new Map(
    assignment.bindings.map((binding) => [binding.sourceRangeId, binding]),
  );

  batch.vertices.forEach((vertex, index) => {
    const positionOffset = index * 3;
    const uvOffset = index * 2;
    positions.set([vertex.position.x, vertex.position.y, vertex.position.z], positionOffset);
    normals.set([vertex.normal.x, vertex.normal.y, vertex.normal.z], positionOffset);
    uvs.set([vertex.uv.u, vertex.uv.v], uvOffset);
  });

  for (const range of batch.ranges) {
    const binding = bindingByRangeId.get(range.id);
    const color = binding
      ? mixColor(assignment.palette.baseColor, binding.tintColor, binding.tintStrength)
      : colorArray(assignment.palette.baseColor);
    for (let index = range.vertexStart; index < range.vertexStart + range.vertexCount; index += 1) {
      colors.set(color, index * 3);
    }
  }

  const positionAttribute = new Float32BufferAttribute(positions.slice(), 3);
  const normalAttribute = new Float32BufferAttribute(normals.slice(), 3);
  const colorAttribute = new Float32BufferAttribute(colors.slice(), 3);
  positionAttribute.setUsage(DynamicDrawUsage);
  normalAttribute.setUsage(DynamicDrawUsage);
  colorAttribute.setUsage(DynamicDrawUsage);
  geometry.setAttribute('position', positionAttribute);
  geometry.setAttribute('normal', normalAttribute);
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('color', colorAttribute);
  geometry.setIndex(batch.index);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefSourceId = batch.id;
  geometry.userData.reefMorphotype = batch.morphotype;
  geometry.userData.reefRangeCount = batch.ranges.length;

  const runtimeRanges = batch.ranges.map((range) => {
    const motion = motionByRangeId.get(range.id);
    if (!motion) {
      throw new Error(`Missing Reef Life binding for mesh range ${range.id}.`);
    }
    return {
      range,
      motion,
      maximumAxialDistance: maximumAxialDistance(positions, range, motion),
      rotationAxis: normalize(cross(motion.axis, motion.responseDirection)),
    };
  });

  return {
    id: batch.id,
    source: batch,
    geometry,
    material: createPhysicalMaterial(assignment),
    basePositions: positions,
    baseNormals: normals,
    baseColors: colors,
    runtimeRanges,
  };
}

/** Creates exactly one foundation mesh and at most one mesh per morphotype. */
export function createReefThreeScene(build: ReefPreviewBuild): ReefThreeSceneState {
  const assignmentByBatchId = new Map(
    build.materials.colonies.map((assignment) => [assignment.sourceBatchId, assignment]),
  );
  const motionByRangeId = new Map(
    build.life.bindings.map((binding) => [binding.sourceRangeId, binding]),
  );
  const batches = build.meshes.batches
    .filter((batch) => batch.index.length > 0)
    .map((batch) => {
      const assignment = assignmentByBatchId.get(batch.id);
      if (!assignment) throw new Error(`Missing reef material assignment for ${batch.id}.`);
      return createBatchRenderable(batch, assignment, motionByRangeId);
    });

  return {
    foundation: createFoundationRenderable(build),
    batches,
    diagnostics: {
      drawCalls: 1 + batches.length,
      materials: 1 + batches.length,
      vertices: build.diagnostics.vertexCount,
      triangles: build.diagnostics.triangleCount,
      motionBindings: batches.reduce((total, batch) => total + batch.runtimeRanges.length, 0),
    },
  };
}

function rotateAroundAxis(
  x: number,
  y: number,
  z: number,
  axis: ReefLayoutVec3,
  angle: number,
): [number, number, number] {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const projection = x * axis.x + y * axis.y + z * axis.z;
  return [
    x * cosine + (axis.y * z - axis.z * y) * sine + axis.x * projection * (1 - cosine),
    y * cosine + (axis.z * x - axis.x * z) * sine + axis.y * projection * (1 - cosine),
    z * cosine + (axis.x * y - axis.y * x) * sine + axis.z * projection * (1 - cosine),
  ];
}

function mutableArray(attribute: BufferAttribute): Float32Array {
  return attribute.array as Float32Array;
}

/**
 * Applies Phase 7 motion to existing batch buffers. It never creates geometry,
 * materials or draw calls. Reduced motion restores the exact accepted buffers.
 */
export function sampleReefBatchFrame(
  batch: ReefRenderableBatch,
  elapsedSeconds: number,
  reducedMotion: boolean,
  currentCycleSeconds: number,
  currentPhaseRadians: number,
): void {
  const positionAttribute = batch.geometry.getAttribute('position') as BufferAttribute;
  const normalAttribute = batch.geometry.getAttribute('normal') as BufferAttribute;
  const colorAttribute = batch.geometry.getAttribute('color') as BufferAttribute;
  const positions = mutableArray(positionAttribute);
  const normals = mutableArray(normalAttribute);
  const colors = mutableArray(colorAttribute);
  positions.set(batch.basePositions);
  normals.set(batch.baseNormals);
  colors.set(batch.baseColors);

  if (!reducedMotion) {
    const currentWave = Math.sin(
      elapsedSeconds * TAU / Math.max(EPSILON, currentCycleSeconds) + currentPhaseRadians,
    );
    for (const runtime of batch.runtimeRanges) {
      const { range, motion, maximumAxialDistance: maximumDistance, rotationAxis } = runtime;
      const sway = Math.sin(elapsedSeconds * TAU * motion.swayFrequencyHz + motion.phaseRadians)
        * motion.swayAmplitudeRadians
        * motion.currentInfluence
        * (0.88 + currentWave * 0.12);
      const pulse = 1 + Math.sin(
        elapsedSeconds * TAU * motion.polyp.pulseFrequencyHz + motion.polyp.phaseRadians,
      ) * motion.polyp.pulseAmplitude * motion.polyp.coverage;

      for (let index = range.vertexStart; index < range.vertexStart + range.vertexCount; index += 1) {
        const offset = index * 3;
        const relativeX = batch.basePositions[offset] - motion.pivot.x;
        const relativeY = batch.basePositions[offset + 1] - motion.pivot.y;
        const relativeZ = batch.basePositions[offset + 2] - motion.pivot.z;
        const axialDistance = Math.max(
          0,
          relativeX * motion.axis.x + relativeY * motion.axis.y + relativeZ * motion.axis.z,
        );
        const bendWeight = Math.pow(
          Math.min(1, axialDistance / maximumDistance),
          motion.bendExponent,
        );
        const angle = sway * bendWeight;
        const rotatedPosition = rotateAroundAxis(
          relativeX,
          relativeY,
          relativeZ,
          rotationAxis,
          angle,
        );
        const rotatedNormal = rotateAroundAxis(
          batch.baseNormals[offset],
          batch.baseNormals[offset + 1],
          batch.baseNormals[offset + 2],
          rotationAxis,
          angle,
        );
        positions[offset] = motion.pivot.x + rotatedPosition[0];
        positions[offset + 1] = motion.pivot.y + rotatedPosition[1];
        positions[offset + 2] = motion.pivot.z + rotatedPosition[2];
        normals[offset] = rotatedNormal[0];
        normals[offset + 1] = rotatedNormal[1];
        normals[offset + 2] = rotatedNormal[2];
        colors[offset] = Math.min(1, batch.baseColors[offset] * pulse);
        colors[offset + 1] = Math.min(1, batch.baseColors[offset + 1] * pulse);
        colors[offset + 2] = Math.min(1, batch.baseColors[offset + 2] * pulse);
      }
    }
  }

  positionAttribute.needsUpdate = true;
  normalAttribute.needsUpdate = true;
  colorAttribute.needsUpdate = true;
}

export function disposeReefThreeScene(scene: ReefThreeSceneState): void {
  scene.foundation.geometry.dispose();
  scene.foundation.material.dispose();
  for (const batch of scene.batches) {
    batch.geometry.dispose();
    batch.material.dispose();
  }
}
