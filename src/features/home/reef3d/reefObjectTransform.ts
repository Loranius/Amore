import {
  Euler,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three';
import type { ReefLayoutVec3 } from '@/engine/species/reef';

export const REEF_OBJECT_ROTATION = [-0.08, -0.18, 0] as const;
export const REEF_OBJECT_POSITION = [0, 0.02, 0] as const;
export const REEF_OBJECT_SCALE = [1, 1.04, 1] as const;

const REEF_OBJECT_MATRIX = new Matrix4().compose(
  new Vector3(...REEF_OBJECT_POSITION),
  new Quaternion().setFromEuler(new Euler(...REEF_OBJECT_ROTATION)),
  new Vector3(...REEF_OBJECT_SCALE),
);

/** Mirrors the fixed ReefObject group transform without requiring a mounted scene. */
export function reefObjectWorldPoint(point: ReefLayoutVec3): ReefLayoutVec3 {
  const world = new Vector3(point.x, point.y, point.z).applyMatrix4(REEF_OBJECT_MATRIX);
  return { x: world.x, y: world.y, z: world.z };
}
