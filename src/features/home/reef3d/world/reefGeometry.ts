// ============================================================
// Меш рушія → геометрія Three.
// ------------------------------------------------------------
// Один перехід, і він тут єдиний. Рушій віддає плоскі масиви (позиції,
// нормалі, індекси) і нічого не знає про Three; сцена не рахує жодної
// вершини сама. Усе, що між ними, — ці двадцять рядків.
// ============================================================
import { BufferAttribute, BufferGeometry } from 'three';
import type { ReefMeshData } from '@/engine/species/reef/headMesh';

export function reefGeometryOf(mesh: ReefMeshData): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(mesh.positions), 3));
  geometry.setAttribute('normal', new BufferAttribute(new Float32Array(mesh.normals), 3));
  geometry.setIndex(new BufferAttribute(new Uint32Array(mesh.indices), 1));
  geometry.computeBoundingSphere();
  return geometry;
}
