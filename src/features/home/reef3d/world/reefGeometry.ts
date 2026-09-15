// ============================================================
// Меш рушія → геометрія Three.
// ------------------------------------------------------------
// Один перехід, і він тут єдиний. Рушій віддає плоскі масиви (позиції,
// нормалі, індекси) і нічого не знає про Three; сцена не рахує жодної
// вершини сама.
//
// ТУТ ЖЕ Й ЄДИНЕ МІСЦЕ, ДЕ ТОН ГРАНІ СТАЄ КОЛЬОРОМ (ADR-0190). Рушій
// каже число — наскільки грань виступає з тіла; у колір це перекладає
// рендерер, бо матеріал належить йому.
// ============================================================
import { BufferAttribute, BufferGeometry } from 'three';
import type { ReefMeshData } from '@/engine/species/reef/headMesh';

/**
 * Геометрія з рівномірним тілом — як було, зі спільними вершинами.
 *
 * Меш без `faceShade` малюється рівно кольором свого матеріалу.
 */
function sharedVertexGeometry(mesh: ReefMeshData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(mesh.normals), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.indices), 1));
  geometry.computeBoundingSphere();
  return geometry;
}

/**
 * Геометрія, де КОЖНА ГРАНЬ ВОЛОДІЄ СВОЇМИ ВЕРШИНАМИ.
 *
 * Розшивання обов'язкове, і причина не в охайності. Тон лежить на
 * ГРАНІ, а колір у Three — на вершині; при спільних вершинах він
 * розмазався б між сусідами плавним градієнтом. Кристал це вже платив
 * словами: візерунок, який перетинає ребро, каже оку, що дві площини —
 * одна поверхня. Тобто розмазаний тон не лише не полагодив би картон,
 * він робив би його гіршим.
 *
 * Ціна: вершин утричі більше за трикутники (у купола 1152 замість 194).
 * Викликів малювання — стільки ж, трикутників — стільки ж.
 */
function splitFaceGeometry(mesh: ReefMeshData, shade: readonly number[]): BufferGeometry {
  const faces = mesh.indices.length / 3;
  const positions = new Float32Array(faces * 9);
  const normals = new Float32Array(faces * 9);
  const colors = new Float32Array(faces * 9);

  for (let face = 0; face < faces; face += 1) {
    /*
     * Тон межується знизу нулем: від'ємний множник кольору у Three не
     * дає темнішого тіла, він дає сміття. Зверху межі немає навмисно —
     * грань, що виступає, СВІТЛІША за основний колір, і саме цим
     * виступ і читається.
     */
    const tone = Math.max(0, shade[face] ?? 1);
    for (let corner = 0; corner < 3; corner += 1) {
      const source = mesh.indices[face * 3 + corner]! * 3;
      const target = face * 9 + corner * 3;
      positions[target] = mesh.positions[source]!;
      positions[target + 1] = mesh.positions[source + 1]!;
      positions[target + 2] = mesh.positions[source + 2]!;
      normals[target] = mesh.normals[source]!;
      normals[target + 1] = mesh.normals[source + 1]!;
      normals[target + 2] = mesh.normals[source + 2]!;
      colors[target] = tone;
      colors[target + 1] = tone;
      colors[target + 2] = tone;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

export function reefGeometryOf(mesh: ReefMeshData): BufferGeometry {
  const shade = mesh.faceShade;
  return shade && shade.length === mesh.indices.length / 3
    ? splitFaceGeometry(mesh, shade)
    : sharedVertexGeometry(mesh);
}
