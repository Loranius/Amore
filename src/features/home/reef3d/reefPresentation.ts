import type { BufferAttribute } from 'three';
import type {
  ReefColonyMotionBinding,
  ReefLayoutVec3,
} from '@/engine/species/reef';
import type {
  ReefBatchRuntimeRange,
  ReefRenderableBatch,
  ReefThreeSceneState,
} from './reefThreeAdapter';

export const REEF_PRESENTATION_VERSION = 'reef-visual-v1';

export const REEF_PRESENTATION_PROFILE = Object.freeze({
  foundationVerticalScale: 0.42,
  colonyHorizontalScale: 1.55,
  colonyVerticalScale: 2.6,
  colonyRootLift: 0.025,
});

const EPSILON = 1e-6;

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

function maximumAxialDistance(
  positions: Float32Array,
  runtime: ReefBatchRuntimeRange,
): number {
  const { range, motion } = runtime;
  let maximum = EPSILON;
  for (let index = range.vertexStart; index < range.vertexStart + range.vertexCount; index += 1) {
    const offset = index * 3;
    const relativeX = (positions[offset] ?? 0) - motion.pivot.x;
    const relativeY = (positions[offset + 1] ?? 0) - motion.pivot.y;
    const relativeZ = (positions[offset + 2] ?? 0) - motion.pivot.z;
    maximum = Math.max(
      maximum,
      Math.max(
        0,
        relativeX * motion.axis.x
          + relativeY * motion.axis.y
          + relativeZ * motion.axis.z,
      ),
    );
  }
  return maximum;
}

function transformBatch(batch: ReefRenderableBatch): void {
  const horizontal = REEF_PRESENTATION_PROFILE.colonyHorizontalScale;
  const vertical = REEF_PRESENTATION_PROFILE.colonyVerticalScale;
  const foundationVertical = REEF_PRESENTATION_PROFILE.foundationVerticalScale;
  const rootLift = REEF_PRESENTATION_PROFILE.colonyRootLift;

  for (const runtime of batch.runtimeRanges) {
    const sourceMotion = runtime.motion;
    const pivot = sourceMotion.pivot;

    for (
      let index = runtime.range.vertexStart;
      index < runtime.range.vertexStart + runtime.range.vertexCount;
      index += 1
    ) {
      const offset = index * 3;
      const sourceX = batch.basePositions[offset] ?? pivot.x;
      const sourceY = batch.basePositions[offset + 1] ?? pivot.y;
      const sourceZ = batch.basePositions[offset + 2] ?? pivot.z;
      batch.basePositions[offset] = pivot.x + (sourceX - pivot.x) * horizontal;
      batch.basePositions[offset + 1] = pivot.y * foundationVertical
        + (sourceY - pivot.y) * vertical
        + rootLift;
      batch.basePositions[offset + 2] = pivot.z + (sourceZ - pivot.z) * horizontal;

      const transformedNormal = transformNormal({
        x: batch.baseNormals[offset] ?? 0,
        y: batch.baseNormals[offset + 1] ?? 1,
        z: batch.baseNormals[offset + 2] ?? 0,
      }, horizontal, vertical, horizontal);
      batch.baseNormals[offset] = transformedNormal.x;
      batch.baseNormals[offset + 1] = transformedNormal.y;
      batch.baseNormals[offset + 2] = transformedNormal.z;
    }

    runtime.motion = presentMotion(sourceMotion);
    runtime.rotationAxis = normalize(
      cross(runtime.motion.axis, runtime.motion.responseDirection),
      { x: 1, y: 0, z: 0 },
    );
    runtime.maximumAxialDistance = maximumAxialDistance(batch.basePositions, runtime);
  }

  const positionAttribute = batch.geometry.getAttribute('position') as BufferAttribute;
  const normalAttribute = batch.geometry.getAttribute('normal') as BufferAttribute;
  mutableArray(positionAttribute).set(batch.basePositions);
  mutableArray(normalAttribute).set(batch.baseNormals);
  positionAttribute.needsUpdate = true;
  normalAttribute.needsUpdate = true;
  batch.geometry.computeBoundingBox();
  batch.geometry.computeBoundingSphere();
  batch.geometry.userData.reefPresentationVersion = REEF_PRESENTATION_VERSION;
  batch.geometry.userData.reefColonyHorizontalScale = horizontal;
  batch.geometry.userData.reefColonyVerticalScale = vertical;
}

/**
 * Applies a renderer-only composition pass without changing colony identity,
 * geometry counts, draw calls, materials or accepted engine state.
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
