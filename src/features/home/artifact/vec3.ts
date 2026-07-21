// ============================================================
// vec3 — мінімальна векторна математика для artifact/ (чисті дані, без
// THREE). Межа renderer-agnostic рушія лишається буквальною: геологічна
// симуляція (growthSurface/mineralDeposition) оперує власними Vec3, а
// переклад у THREE.Vector3/Quaternion робить лише crystal3d/.
// ============================================================

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const v3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });

export const add = (a: Vec3, b: Vec3): Vec3 => v3(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: Vec3, b: Vec3): Vec3 => v3(a.x - b.x, a.y - b.y, a.z - b.z);
export const scale = (a: Vec3, s: number): Vec3 => v3(a.x * s, a.y * s, a.z * s);
export const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;

export const cross = (a: Vec3, b: Vec3): Vec3 =>
  v3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);

export const lengthOf = (a: Vec3): number => Math.sqrt(dot(a, a));
export const distSq = (a: Vec3, b: Vec3): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
};

/** Нормалізація з детермінованим фолбеком (вгору) для виродженого вектора. */
export function normalize(a: Vec3): Vec3 {
  const len = lengthOf(a);
  if (len < 1e-9) return v3(0, 1, 0);
  return scale(a, 1 / len);
}

export const lerpVec = (a: Vec3, b: Vec3, t: number): Vec3 =>
  v3(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t);

/**
 * Два ортогональні одиничні вектори, перпендикулярні dir — локальна рамка
 * бічної поверхні кристала (кут angle обертається саме в цій рамці).
 * Вибір опорної осі детермінований (залежить лише від dir), тож та сама
 * поверхня завжди параметризована однаково.
 */
export function perpendicularBasis(dir: Vec3): [Vec3, Vec3] {
  const ref = Math.abs(dir.y) < 0.9 ? v3(0, 1, 0) : v3(1, 0, 0);
  const u = normalize(cross(ref, dir));
  const w = cross(dir, u); // dir і u вже одиничні й ортогональні → w одиничний
  return [u, w];
}
