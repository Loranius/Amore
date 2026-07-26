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
 * Найкоротша відстань між двома відрізками [p1,q1] і [p2,q2].
 * Основа об'ємної резервації (`CAI-REQ-001`): тіло кристала апроксимується
 * капсулою (відрізок осі + радіус), тож перетин двох тіл — це
 * segmentDistance < r1 + r2. Класичний розв'язок Ericson, повністю
 * детермінований (жодних ітерацій/епсилон-залежних гілок понад вироджені).
 */
export function segmentDistance(p1: Vec3, q1: Vec3, p2: Vec3, q2: Vec3): number {
  const EPS = 1e-9;
  const d1 = sub(q1, p1);
  const d2 = sub(q2, p2);
  const r = sub(p1, p2);
  const a = dot(d1, d1);
  const e = dot(d2, d2);
  const f = dot(d2, r);
  const clamp01v = (n: number): number => Math.max(0, Math.min(1, n));

  let s: number;
  let t: number;
  if (a <= EPS && e <= EPS) return lengthOf(r);
  if (a <= EPS) {
    s = 0;
    t = clamp01v(f / e);
  } else {
    const c = dot(d1, r);
    if (e <= EPS) {
      t = 0;
      s = clamp01v(-c / a);
    } else {
      const b = dot(d1, d2);
      const denom = a * e - b * b;
      s = denom > EPS ? clamp01v((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp01v(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01v((b - c) / a);
      }
    }
  }
  return lengthOf(sub(add(p1, scale(d1, s)), add(p2, scale(d2, t))));
}

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
