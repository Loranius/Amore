// ============================================================
// vec3 — мінімальна векторна математика для ієрархічного росту
// (artifactNodes.ts). Прості кортежі чисел, БЕЗ three — рушій лишається
// renderer-agnostic; напрямок у quaternion перетворює вже рендерер
// (crystal3d/crystalCluster.ts), своїми three-специфічними засобами.
// ============================================================
export type Vec3 = readonly [number, number, number];

export function addVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function subtractVec(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

export function scaleVec(a: Vec3, s: number): Vec3 {
  return [a[0] * s, a[1] * s, a[2] * s];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function length(a: Vec3): number {
  return Math.sqrt(dot(a, a));
}

export function normalize(a: Vec3): Vec3 {
  const len = length(a) || 1;
  return [a[0] / len, a[1] / len, a[2] / len];
}

/** Перетворює азимут (навколо вертикалі) + полярний кут від вертикалі на
 *  одиничний світовий вектор — потрібно лише для НАСІННЄВОГО (кореневого)
 *  напрямку артефакту; усі подальші напрямки успадковуються від батька
 *  через randomConePerturbation, а не рахуються наново зі сферичних кутів. */
export function sphericalToVec3(azimuth: number, polarFromUp: number): Vec3 {
  const s = Math.sin(polarFromUp);
  return [s * Math.cos(azimuth), Math.cos(polarFromUp), s * Math.sin(azimuth)];
}

/** Довільний одиничний вектор, перпендикулярний до `dir` — рівномірно
 *  випадковий азимут довкола осі dir. Використовується для бічного зсуву
 *  точки прикріплення дочірньої гілки (щоб вона виростала «збоку»
 *  батьківської поверхні, а не з її осьової лінії). */
export function randomPerpendicular(rng: () => number, dir: Vec3): Vec3 {
  const d = normalize(dir);
  const reference: Vec3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(reference, d));
  const v = cross(d, u);
  const az = rng() * Math.PI * 2;
  const cosAz = Math.cos(az);
  const sinAz = Math.sin(az);
  return normalize([
    u[0] * cosAz + v[0] * sinAz,
    u[1] * cosAz + v[1] * sinAz,
    u[2] * cosAz + v[2] * sinAz,
  ]);
}

/**
 * Успадковує напрямок `dir` із МАЛОЮ випадковою мутацією — рівномірний
 * розкид усередині конуса [0, maxAngleRad] навколо dir (не незалежний
 * випадковий кут «в порожнечі»). Це і є «Growth direction» з ТЗ:
 * `child = parent direction + small mutation`, Rodrigues-стиль обертання
 * без матриць/quaternion (рушій лишається three-незалежним).
 */
export function randomConePerturbation(rng: () => number, dir: Vec3, maxAngleRad: number): Vec3 {
  const d = normalize(dir);
  const reference: Vec3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize(cross(reference, d));
  const v = cross(d, u); // вже одиничний: d⊥u, обидва одиничні

  const angle = rng() * maxAngleRad;
  const azimuth = rng() * Math.PI * 2;
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);
  const localU = sinA * Math.cos(azimuth);
  const localV = sinA * Math.sin(azimuth);
  return normalize([
    u[0] * localU + v[0] * localV + d[0] * cosA,
    u[1] * localU + v[1] * localV + d[1] * cosA,
    u[2] * localU + v[2] * localV + d[2] * cosA,
  ]);
}
