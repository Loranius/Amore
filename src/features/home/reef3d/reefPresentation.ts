import type { BufferAttribute } from 'three';
import type {
  ReefColonyMorphotype,
  ReefColonyMotionBinding,
  ReefLayoutVec3,
} from '@/engine/species/reef';
import type {
  ReefBatchRuntimeRange,
  ReefRenderableBatch,
  ReefThreeSceneState,
} from './reefThreeAdapter';

export const REEF_PRESENTATION_VERSION = 'reef-visual-v3';
export const REEF_COLONY_SHAPE_PASS = 'phase-12-living-canopy';

export const REEF_PRESENTATION_PROFILE = Object.freeze({
  foundationVerticalScale: 0.42,
  colonyHorizontalScale: 1.7,
  colonyVerticalScale: 2.8,
  colonyRootLift: 0.025,
});

export interface ReefColonyShapeProfile {
  readonly axialScale: number;
  readonly radialRootScale: number;
  readonly radialTipScale: number;
  readonly midBulge: number;
  readonly edgeExpansion: number;
  readonly lobeCount: number;
  readonly lobeAmplitude: number;
  readonly twist: number;
  readonly bend: number;
  readonly rimLift: number;
  readonly depthScale: number;
}

/**
 * Phase 10 keeps the accepted topology and stable ranges intact, but gives
 * every existing morphotype its own readable production silhouette.
 */
export const REEF_COLONY_SHAPE_PROFILES: Readonly<
  Record<ReefColonyMorphotype, ReefColonyShapeProfile>
> = Object.freeze({
  branching: {
    axialScale: 1.18,
    radialRootScale: 0.9,
    radialTipScale: 1.25,
    midBulge: 0.14,
    edgeExpansion: 0.08,
    lobeCount: 3,
    lobeAmplitude: 0.055,
    twist: 0.9,
    bend: 0.14,
    rimLift: 0,
    depthScale: 1,
  },
  massive: {
    axialScale: 0.92,
    radialRootScale: 1.08,
    radialTipScale: 0.62,
    midBulge: 0.68,
    edgeExpansion: 0.22,
    lobeCount: 6,
    lobeAmplitude: 0.06,
    twist: 0.35,
    bend: 0.025,
    rimLift: 0.02,
    depthScale: 1,
  },
  plating: {
    axialScale: 0.6,
    radialRootScale: 0.76,
    radialTipScale: 1.28,
    midBulge: 0.18,
    edgeExpansion: 0.6,
    lobeCount: 7,
    lobeAmplitude: 0.09,
    twist: 0.45,
    bend: 0.03,
    rimLift: 0.18,
    depthScale: 1,
  },
  encrusting: {
    axialScale: 0.34,
    radialRootScale: 1.18,
    radialTipScale: 1.12,
    midBulge: 0.09,
    edgeExpansion: 0.28,
    lobeCount: 8,
    lobeAmplitude: 0.07,
    twist: 0.3,
    bend: 0.01,
    rimLift: 0.025,
    depthScale: 1,
  },
  'soft-coral': {
    axialScale: 1.28,
    radialRootScale: 0.82,
    radialTipScale: 1.4,
    midBulge: 0.3,
    edgeExpansion: 0.12,
    lobeCount: 5,
    lobeAmplitude: 0.11,
    twist: 1.15,
    bend: 0.18,
    rimLift: 0.04,
    depthScale: 0.94,
  },
  'sea-fan': {
    axialScale: 1.32,
    radialRootScale: 0.72,
    radialTipScale: 1.48,
    midBulge: 0.12,
    edgeExpansion: 0.22,
    lobeCount: 4,
    lobeAmplitude: 0.045,
    twist: 0.18,
    bend: 0.12,
    rimLift: 0.02,
    depthScale: 0.5,
  },
});

const EPSILON = 1e-6;
const TAU = Math.PI * 2;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / Math.max(EPSILON, edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mutableArray(attribute: BufferAttribute): Float32Array {
  return attribute.array as Float32Array;
}

function normalize(
  value: ReefLayoutVec3,
  fallback: ReefLayoutVec3 = { x: 0, y: 1, z: 0 },
): ReefLayoutVec3 {
  const length = Math.hypot(value.x, value.y, value.z);
  if (!Number.isFinite(length) || length <= EPSILON) return { ...fallback };
  return {
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  };
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

function transformNormal(
  value: ReefLayoutVec3,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
): ReefLayoutVec3 {
  return normalize({
    x: value.x / scaleX,
    y: value.y / scaleY,
    z: value.z / scaleZ,
  });
}

function transformDirection(
  value: ReefLayoutVec3,
  scaleX: number,
  scaleY: number,
  scaleZ: number,
): ReefLayoutVec3 {
  return normalize({
    x: value.x * scaleX,
    y: value.y * scaleY,
    z: value.z * scaleZ,
  });
}

function presentedPivot(motion: ReefColonyMotionBinding): ReefLayoutVec3 {
  return {
    x: motion.pivot.x,
    y: motion.pivot.y * REEF_PRESENTATION_PROFILE.foundationVerticalScale
      + REEF_PRESENTATION_PROFILE.colonyRootLift,
    z: motion.pivot.z,
  };
}

function presentMotion(motion: ReefColonyMotionBinding): ReefColonyMotionBinding {
  const horizontal = REEF_PRESENTATION_PROFILE.colonyHorizontalScale;
  const vertical = REEF_PRESENTATION_PROFILE.colonyVerticalScale;
  return {
    ...motion,
    pivot: presentedPivot(motion),
    axis: transformDirection(motion.axis, horizontal, vertical, horizontal),
    responseDirection: transformDirection(
      motion.responseDirection,
      horizontal,
      vertical,
      horizontal,
    ),
  };
}

function stableHash(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function rangePhase(id: string): number {
  return (stableHash(id) / 0xffffffff) * TAU;
}

function rangeSign(id: string): number {
  return (stableHash(`${id}:bend`) & 1) === 0 ? -1 : 1;
}

function transformFoundation(scene: ReefThreeSceneState): void {
  const geometry = scene.foundation.geometry;
  const positionAttribute = geometry.getAttribute('position') as BufferAttribute;
  const normalAttribute = geometry.getAttribute('normal') as BufferAttribute;
  const positions = mutableArray(positionAttribute);
  const normals = mutableArray(normalAttribute);
  const verticalScale = REEF_PRESENTATION_PROFILE.foundationVerticalScale;

  for (let offset = 0; offset < positions.length; offset += 3) {
    positions[offset + 1] = (positions[offset + 1] ?? 0) * verticalScale;
    const transformedNormal = transformNormal({
      x: normals[offset] ?? 0,
      y: normals[offset + 1] ?? 1,
      z: normals[offset + 2] ?? 0,
    }, 1, verticalScale, 1);
    normals[offset] = transformedNormal.x;
    normals[offset + 1] = transformedNormal.y;
    normals[offset + 2] = transformedNormal.z;
  }

  positionAttribute.needsUpdate = true;
  normalAttribute.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.reefPresentationVersion = REEF_PRESENTATION_VERSION;
  geometry.userData.reefFoundationVerticalScale = verticalScale;
}

interface RangeMetrics {
  readonly maximumAxialDistance: number;
  readonly maximumRadialDistance: number;
}

function measureRange(
  positions: Float32Array,
  runtime: ReefBatchRuntimeRange,
): RangeMetrics {
  const { range, motion } = runtime;
  let maximumAxialDistance = EPSILON;
  let maximumRadialDistance = EPSILON;

  for (let index = range.vertexStart; index < range.vertexStart + range.vertexCount; index += 1) {
    const offset = index * 3;
    const relative = {
      x: (positions[offset] ?? 0) - motion.pivot.x,
      y: (positions[offset + 1] ?? 0) - motion.pivot.y,
      z: (positions[offset + 2] ?? 0) - motion.pivot.z,
    };
    const axial = dot(relative, motion.axis);
    const radial = {
      x: relative.x - motion.axis.x * axial,
      y: relative.y - motion.axis.y * axial,
      z: relative.z - motion.axis.z * axial,
    };
    maximumAxialDistance = Math.max(maximumAxialDistance, Math.max(0, axial));
    maximumRadialDistance = Math.max(
      maximumRadialDistance,
      Math.hypot(radial.x, radial.y, radial.z),
    );
  }

  return { maximumAxialDistance, maximumRadialDistance };
}

function shapeBasis(motion: ReefColonyMotionBinding): {
  side: ReefLayoutVec3;
  depth: ReefLayoutVec3;
} {
  let side = cross(motion.axis, motion.responseDirection);
  if (Math.hypot(side.x, side.y, side.z) <= EPSILON) {
    side = cross(motion.axis, { x: 0, y: 0, z: 1 });
  }
  if (Math.hypot(side.x, side.y, side.z) <= EPSILON) {
    side = cross(motion.axis, { x: 1, y: 0, z: 0 });
  }
  side = normalize(side, { x: 1, y: 0, z: 0 });
  return {
    side,
    depth: normalize(cross(side, motion.axis), { x: 0, y: 0, z: 1 }),
  };
}

function shapeRange(batch: ReefRenderableBatch, runtime: ReefBatchRuntimeRange): void {
  const profile = REEF_COLONY_SHAPE_PROFILES[runtime.range.morphotype];
  const metrics = measureRange(batch.basePositions, runtime);
  const { side, depth } = shapeBasis(runtime.motion);
  const phase = rangePhase(runtime.range.id);
  const bendSign = rangeSign(runtime.range.id);

  for (
    let index = runtime.range.vertexStart;
    index < runtime.range.vertexStart + runtime.range.vertexCount;
    index += 1
  ) {
    const offset = index * 3;
    const relative = {
      x: (batch.basePositions[offset] ?? 0) - runtime.motion.pivot.x,
      y: (batch.basePositions[offset + 1] ?? 0) - runtime.motion.pivot.y,
      z: (batch.basePositions[offset + 2] ?? 0) - runtime.motion.pivot.z,
    };
    const axial = dot(relative, runtime.motion.axis);
    const radial = {
      x: relative.x - runtime.motion.axis.x * axial,
      y: relative.y - runtime.motion.axis.y * axial,
      z: relative.z - runtime.motion.axis.z * axial,
    };
    const sideDistance = dot(radial, side);
    const depthDistance = dot(radial, depth);
    const radialDistance = Math.hypot(sideDistance, depthDistance);
    const axialT = clamp01(axial / metrics.maximumAxialDistance);
    const radialT = clamp01(radialDistance / metrics.maximumRadialDistance);
    const edge = smoothstep(0.56, 0.98, radialT);
    const angle = Math.atan2(depthDistance, sideDistance);
    const lobe = Math.sin(
      angle * profile.lobeCount + phase + axialT * profile.twist,
    );
    const middle = Math.sin(Math.PI * axialT);
    const baseRadialScale = profile.radialRootScale
      + (profile.radialTipScale - profile.radialRootScale) * axialT;
    const radialScale = Math.max(
      0.12,
      baseRadialScale
        + profile.midBulge * middle
        + profile.edgeExpansion * edge * (0.35 + axialT * 0.65)
        + profile.lobeAmplitude * lobe * (0.3 + middle * 0.7),
    );
    const bend = metrics.maximumRadialDistance
      * profile.bend
      * axialT
      * axialT
      * bendSign;
    const rimLift = metrics.maximumAxialDistance
      * profile.rimLift
      * edge
      * edge
      * (0.3 + axialT * 0.7);
    const shapedAxial = axial * profile.axialScale + rimLift;
    const shapedSide = sideDistance * radialScale + bend;
    const shapedDepth = depthDistance * radialScale * profile.depthScale;

    batch.basePositions[offset] = runtime.motion.pivot.x
      + runtime.motion.axis.x * shapedAxial
      + side.x * shapedSide
      + depth.x * shapedDepth;
    batch.basePositions[offset + 1] = runtime.motion.pivot.y
      + runtime.motion.axis.y * shapedAxial
      + side.y * shapedSide
      + depth.y * shapedDepth;
    batch.basePositions[offset + 2] = runtime.motion.pivot.z
      + runtime.motion.axis.z * shapedAxial
      + side.z * shapedSide
      + depth.z * shapedDepth;
  }
}

function maximumAxialDistance(
  positions: Float32Array,
  runtime: ReefBatchRuntimeRange,
): number {
  return measureRange(positions, runtime).maximumAxialDistance;
}

function transformBatch(batch: ReefRenderableBatch): void {
  const horizontal = REEF_PRESENTATION_PROFILE.colonyHorizontalScale;
  const vertical = REEF_PRESENTATION_PROFILE.colonyVerticalScale;
  const foundationVertical = REEF_PRESENTATION_PROFILE.foundationVerticalScale;
  const rootLift = REEF_PRESENTATION_PROFILE.colonyRootLift;

  for (const runtime of batch.runtimeRanges) {
    const sourceMotion = runtime.motion;
    const sourcePivot = sourceMotion.pivot;

    for (
      let index = runtime.range.vertexStart;
      index < runtime.range.vertexStart + runtime.range.vertexCount;
      index += 1
    ) {
      const offset = index * 3;
      const sourceX = batch.basePositions[offset] ?? sourcePivot.x;
      const sourceY = batch.basePositions[offset + 1] ?? sourcePivot.y;
      const sourceZ = batch.basePositions[offset + 2] ?? sourcePivot.z;
      batch.basePositions[offset] = sourcePivot.x + (sourceX - sourcePivot.x) * horizontal;
      batch.basePositions[offset + 1] = sourcePivot.y * foundationVertical
        + (sourceY - sourcePivot.y) * vertical
        + rootLift;
      batch.basePositions[offset + 2] = sourcePivot.z + (sourceZ - sourcePivot.z) * horizontal;
    }

    runtime.motion = presentMotion(sourceMotion);
    shapeRange(batch, runtime);
    runtime.rotationAxis = normalize(
      cross(runtime.motion.axis, runtime.motion.responseDirection),
      { x: 1, y: 0, z: 0 },
    );
    runtime.maximumAxialDistance = maximumAxialDistance(batch.basePositions, runtime);
  }

  const positionAttribute = batch.geometry.getAttribute('position') as BufferAttribute;
  mutableArray(positionAttribute).set(batch.basePositions);
  positionAttribute.needsUpdate = true;

  // The shape pass is non-linear, therefore normals are regenerated from the
  // unchanged index topology and then captured as the exact Phase 7 base.
  batch.geometry.computeVertexNormals();
  const normalAttribute = batch.geometry.getAttribute('normal') as BufferAttribute;
  batch.baseNormals.set(mutableArray(normalAttribute));
  normalAttribute.needsUpdate = true;

  batch.geometry.computeBoundingBox();
  batch.geometry.computeBoundingSphere();
  batch.geometry.userData.reefPresentationVersion = REEF_PRESENTATION_VERSION;
  batch.geometry.userData.reefShapePass = REEF_COLONY_SHAPE_PASS;
  batch.geometry.userData.reefColonyHorizontalScale = horizontal;
  batch.geometry.userData.reefColonyVerticalScale = vertical;
}

/**
 * Applies Phase 10 as a renderer-only composition pass. Colony IDs, ranges,
 * indices, triangle/vertex counts, materials, draw calls and accepted engine
 * state remain unchanged.
 */
export function applyReefPresentation(scene: ReefThreeSceneState): ReefThreeSceneState {
  if (scene.foundation.geometry.userData.reefPresentationVersion === REEF_PRESENTATION_VERSION) {
    return scene;
  }

  transformFoundation(scene);
  scene.foundation.material.color.setRGB(1, 1, 1);

  for (const batch of scene.batches) {
    transformBatch(batch);
    batch.material.color.setRGB(1, 1, 1);
  }

  return scene;
}
