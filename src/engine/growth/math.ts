import { stableHash32 } from '../evolution';
import type { GrowthVec3 } from './types';

export const GROWTH_UP: GrowthVec3 = { x: 0, y: 1, z: 0 };

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function round6(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

export function roundVec(vector: GrowthVec3): GrowthVec3 {
  return {
    x: round6(vector.x),
    y: round6(vector.y),
    z: round6(vector.z),
  };
}

export function add(left: GrowthVec3, right: GrowthVec3): GrowthVec3 {
  return { x: left.x + right.x, y: left.y + right.y, z: left.z + right.z };
}

export function subtract(left: GrowthVec3, right: GrowthVec3): GrowthVec3 {
  return { x: left.x - right.x, y: left.y - right.y, z: left.z - right.z };
}

export function scale(vector: GrowthVec3, factor: number): GrowthVec3 {
  return { x: vector.x * factor, y: vector.y * factor, z: vector.z * factor };
}

export function dot(left: GrowthVec3, right: GrowthVec3): number {
  return left.x * right.x + left.y * right.y + left.z * right.z;
}

export function cross(left: GrowthVec3, right: GrowthVec3): GrowthVec3 {
  return {
    x: left.y * right.z - left.z * right.y,
    y: left.z * right.x - left.x * right.z,
    z: left.x * right.y - left.y * right.x,
  };
}

export function lengthSquared(vector: GrowthVec3): number {
  return dot(vector, vector);
}

export function length(vector: GrowthVec3): number {
  return Math.sqrt(lengthSquared(vector));
}

export function normalize(vector: GrowthVec3, fallback: GrowthVec3 = GROWTH_UP): GrowthVec3 {
  const magnitude = length(vector);
  if (!Number.isFinite(magnitude) || magnitude <= 1e-9) return { ...fallback };
  return scale(vector, 1 / magnitude);
}

export function distance(left: GrowthVec3, right: GrowthVec3): number {
  return length(subtract(left, right));
}

export function lerp(left: GrowthVec3, right: GrowthVec3, t: number): GrowthVec3 {
  return add(scale(left, 1 - t), scale(right, t));
}

export function directionFromAzimuthElevation(
  azimuthRad: number,
  normalizedElevation: number,
): GrowthVec3 {
  const elevationRad = clamp01(normalizedElevation) * Math.PI * 0.5;
  const horizontal = Math.cos(elevationRad);
  return normalize({
    x: Math.cos(azimuthRad) * horizontal,
    y: Math.sin(elevationRad),
    z: Math.sin(azimuthRad) * horizontal,
  });
}

export function ensureUpward(vector: GrowthVec3, minUpwardComponent: number): GrowthVec3 {
  const normalized = normalize(vector);
  if (normalized.y >= minUpwardComponent) return normalized;
  return normalize({ ...normalized, y: minUpwardComponent });
}

export function orthonormalBasis(direction: GrowthVec3): { tangent: GrowthVec3; bitangent: GrowthVec3 } {
  const axis = normalize(direction);
  const reference = Math.abs(axis.y) < 0.92 ? GROWTH_UP : { x: 1, y: 0, z: 0 };
  const tangent = normalize(cross(reference, axis), { x: 1, y: 0, z: 0 });
  const bitangent = normalize(cross(axis, tangent), { x: 0, y: 0, z: 1 });
  return { tangent, bitangent };
}

export function seededUnit(seed: number, salt: string): number {
  return stableHash32(`${seed}\u001f${salt}`) / 0xffffffff;
}

export function angularDistance(left: number, right: number): number {
  const tau = Math.PI * 2;
  const raw = Math.abs(((left - right) % tau + tau) % tau);
  return Math.min(raw, tau - raw);
}

/** Closest distance between finite segments P1-Q1 and P2-Q2. */
export function segmentDistance(
  p1: GrowthVec3,
  q1: GrowthVec3,
  p2: GrowthVec3,
  q2: GrowthVec3,
): number {
  const d1 = subtract(q1, p1);
  const d2 = subtract(q2, p2);
  const r = subtract(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const epsilon = 1e-9;

  if (a <= epsilon && e <= epsilon) return distance(p1, p2);

  let s = 0;
  let t = 0;

  if (a <= epsilon) {
    t = clamp(dot(d2, r) / e, 0, 1);
  } else {
    const c = dot(d1, r);
    if (e <= epsilon) {
      s = clamp(-c / a, 0, 1);
    } else {
      const b = dot(d1, d2);
      const denominator = a * e - b * b;
      if (Math.abs(denominator) > epsilon) {
        s = clamp((b * dot(d2, r) - c * e) / denominator, 0, 1);
      }
      t = (b * s + dot(d2, r)) / e;

      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }

  return distance(add(p1, scale(d1, s)), add(p2, scale(d2, t)));
}
