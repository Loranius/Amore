// ============================================================
// М'які нормалі для low-poly: обтічне світло, гранчастий силует.
// ------------------------------------------------------------
// Власник, 2026-10-04: «зробити всі три об'єкти більш обтікаючими, плавними,
// але не відходити від концепції low poly; без гострих кутів на текстурах
// (окрім кристала)».
//
// Гострі кути «на текстурі» — це пласке світло: кожна грань мала одну нормаль
// (з похідних позиції), і сусідні грані різнились стрибком тону. Тут нормаль
// вершини — сума нормалей УСІХ граней, що в ній сходяться й відхиляються від
// її власної грані не більше ніж на `creaseDeg`. Так плавні схили світяться
// плавно, а справжній злам (край скелі, ребро каменя) лишається зламом —
// той самий принцип «кута згладжування», що в Blender.
//
// Геометрія — «суп» трикутників: вершини не спільні, тож спільність шукаємо
// за позицією (квантованою, щоб похибка округлення не розірвала шов).
// Чиста функція, детермінована: порядок обходу — порядок трикутників.
// ============================================================

const QUANT = 1e4;

interface Faces {
  triangles: number;
  normal: Float64Array;
  area: Float64Array;
  /** Для кожного кута кожного трикутника — грані того ж згладжування в цій точці. */
  group: (t: number, c: number) => number[];
}

function faces(positions: Float32Array, creaseDeg: number): Faces {
  const triangles = Math.floor(positions.length / 9);
  const normal = new Float64Array(triangles * 3);
  const area = new Float64Array(triangles);
  for (let t = 0; t < triangles; t += 1) {
    const o = t * 9;
    const ax = positions[o]!, ay = positions[o + 1]!, az = positions[o + 2]!;
    const ux = positions[o + 3]! - ax, uy = positions[o + 4]! - ay, uz = positions[o + 5]! - az;
    const vx = positions[o + 6]! - ax, vy = positions[o + 7]! - ay, vz = positions[o + 8]! - az;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz);
    area[t] = length;
    if (length > 0) {
      normal[t * 3] = nx / length;
      normal[t * 3 + 1] = ny / length;
      normal[t * 3 + 2] = nz / length;
    }
  }

  // Хто сходиться в кожній точці простору.
  const key = (i: number) =>
    `${Math.round(positions[i]! * QUANT)},${Math.round(positions[i + 1]! * QUANT)},${Math.round(positions[i + 2]! * QUANT)}`;
  const corners = new Map<string, number[]>();
  for (let t = 0; t < triangles; t += 1) {
    if (area[t] === 0) continue;
    for (let c = 0; c < 3; c += 1) {
      const k = key(t * 9 + c * 3);
      const list = corners.get(k);
      if (list) list.push(t);
      else corners.set(k, [t]);
    }
  }
  const cos = Math.cos((creaseDeg * Math.PI) / 180);
  const group = (t: number, c: number) => {
    const fx = normal[t * 3]!, fy = normal[t * 3 + 1]!, fz = normal[t * 3 + 2]!;
    return (corners.get(key(t * 9 + c * 3)) ?? []).filter(
      (o) => normal[o * 3]! * fx + normal[o * 3 + 1]! * fy + normal[o * 3 + 2]! * fz >= cos,
    );
  };
  return { triangles, normal, area, group };
}

export function softNormals(positions: Float32Array, creaseDeg = 60): Float32Array {
  const { triangles, normal, area, group } = faces(positions, creaseDeg);
  const out = new Float32Array(triangles * 9);
  for (let t = 0; t < triangles; t += 1) {
    for (let c = 0; c < 3; c += 1) {
      let sx = 0, sy = 0, sz = 0;
      for (const other of group(t, c)) {
        // Вага — площа: дрібна щілинна грань не перекошує світло великої.
        const w = area[other]!;
        sx += normal[other * 3]! * w;
        sy += normal[other * 3 + 1]! * w;
        sz += normal[other * 3 + 2]! * w;
      }
      const length = Math.hypot(sx, sy, sz);
      const o = t * 9 + c * 3;
      if (length > 0) {
        out[o] = sx / length;
        out[o + 1] = sy / length;
        out[o + 2] = sz / length;
      } else {
        out[o] = normal[t * 3]!;
        out[o + 1] = normal[t * 3 + 1]!;
        out[o + 2] = normal[t * 3 + 2]!;
      }
    }
  }
  return out;
}

/**
 * Тон грані, згладжений так само, як нормаль: у вершині — середнє тонів граней
 * одного згладжування. Плями тону грань-у-грань читались гострими кутами «на
 * текстурі» навіть при плавному світлі; тепер тон перетікає, а на справжньому
 * зламі кожен бік лишає свій. `values` — по одному на вершину (як атрибут).
 */
export function softScalar(positions: Float32Array, values: Float32Array, creaseDeg = 60): Float32Array {
  const { triangles, area, group } = faces(positions, creaseDeg);
  const perFace = new Float64Array(triangles);
  for (let t = 0; t < triangles; t += 1) perFace[t] = (values[t * 3]! + values[t * 3 + 1]! + values[t * 3 + 2]!) / 3;
  const out = new Float32Array(triangles * 3);
  for (let t = 0; t < triangles; t += 1) {
    for (let c = 0; c < 3; c += 1) {
      let sum = 0;
      let weight = 0;
      for (const other of group(t, c)) {
        sum += perFace[other]! * area[other]!;
        weight += area[other]!;
      }
      out[t * 3 + c] = weight > 0 ? sum / weight : values[t * 3 + c]!;
    }
  }
  return out;
}

/**
 * GLSL: м'яка нормаль, повернута до того ж боку, що й геометрична грань.
 * Частина мешів має змішане обертання трикутників (його досі гасив
 * поворот нормалі до камери), тож напрям береться з грані, а плавність — з
 * атрибута.
 */
export const SOFT_NORMAL_GLSL = /* glsl */ `
  vec3 softNormal(vec3 soft, vec3 world) {
    vec3 facet = normalize(cross(dFdx(world), dFdy(world)));
    if (dot(facet, cameraPosition - world) < 0.0) facet = -facet;
    // Меш без атрибута нормалі дає нуль — тоді лишається пласка грань.
    if (dot(soft, soft) < 1e-8) return facet;
    vec3 n = normalize(soft);
    if (dot(n, facet) < 0.0) n = -n;
    return n;
  }
`;
