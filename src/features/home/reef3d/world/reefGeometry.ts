// ============================================================
// Меш рушія → геометрія Three.
// ------------------------------------------------------------
// Один перехід, і він тут єдиний. Рушій віддає плоскі масиви (позиції,
// нормалі, індекси, тон вершини) і нічого не знає про Three; сцена не
// рахує жодної вершини сама.
//
// ТУТ ЖЕ Й ЄДИНЕ МІСЦЕ, ДЕ ТОН СТАЄ КОЛЬОРОМ. Рушій каже число —
// наскільки ця точка тіла світліша за основний тон; у колір це перекладає
// рендерер, бо матеріал належить йому.
//
// РОЗШИВАННЯ ГРАНЕЙ ПРИБРАНО (ADR-0195, крок 3). Доти тон лежав на ГРАНІ,
// і щоб колір не розмазався між сусідами, кожна грань мусила володіти
// своїми вершинами. Це давало рівно те, на що поскаржився власник: латку
// сталого кольору з твердим краєм, тобто клаптик паперу. Тон переїхав на
// вершину, де він інтерполюється й ребра створити не може, а разом із
// розшиванням пішли й зайві вершини: у купола 2 592 замість 864 × 3.
// ============================================================
import { BufferAttribute, BufferGeometry } from 'three';
import type { ReefMeshData } from '@/engine/species/reef/headMesh';

export function reefGeometryOf(mesh: ReefMeshData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(mesh.normals), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.indices), 1));

  const tint = mesh.tint;
  if (tint && tint.length === mesh.positions.length / 3) {
    /*
     * Тон межується знизу нулем: від'ємний множник кольору у Three не дає
     * темнішого тіла, він дає сміття. Зверху межі немає навмисно — точка,
     * що виступає, СВІТЛІША за основний колір, і саме цим виступ і
     * читається.
     */
    const colors = new Float32Array(tint.length * 3);
    for (let vertex = 0; vertex < tint.length; vertex += 1) {
      const value = Math.max(0, tint[vertex] ?? 1);
      colors[vertex * 3] = value;
      colors[vertex * 3 + 1] = value;
      colors[vertex * 3 + 2] = value;
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
  }

  geometry.computeBoundingSphere();
  return geometry;
}
