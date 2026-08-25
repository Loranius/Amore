// ============================================================
// Меші рифа з плану — і справжня їхня ціна.
// ------------------------------------------------------------
// Окремо від сцени з ОДНІЄЇ причини: ціну треба публікувати, а
// публікувати можна тільки те, що виміряно. Порахувати трикутники
// формулою «тіл × 80» означало б повторити сталу з `bodyMesh` у
// другому місці — і першої ж зміни профілю тіла вистачило б, щоб
// сцена звітувала одне, а малювала інше.
//
// Тому меші будуються тут, а числа беруться з них самих.
// ============================================================
import { useMemo } from 'react';
import type { BufferGeometry } from 'three';
import { buildReefHeadMesh } from '@/engine/species/reef/headMesh';
import { buildReefColonyMesh } from '@/engine/species/reef/bodyMesh';
import type { ReefPlan } from '@/engine/species/reef/reefAssembly';
import { reefGeometryOf } from './reefGeometry';

export interface ReefColonyRender {
  id: string;
  geometry: BufferGeometry;
  /** Наповненість свого року, 0..1 — нею ведеться насиченість кольору. */
  fill: number;
}

export interface ReefMeshes {
  head: BufferGeometry;
  colonies: ReefColonyRender[];
  /** Скільки мешів піде в сцену: голова плюс по одному на рік. */
  meshCount: number;
  /** Скільки в них тіл: голова плюс усі коралові тіла. */
  bodyCount: number;
  triangles: number;
  vertices: number;
}

export function useReefMeshes(plan: ReefPlan): ReefMeshes {
  return useMemo(() => {
    const headMesh = buildReefHeadMesh(plan.head, plan.headSeed);
    let triangles = headMesh.indices.length / 3;
    let vertices = headMesh.positions.length / 3;
    let bodyCount = 1;

    const colonies = plan.colonies.map((colony) => {
      const mesh = buildReefColonyMesh(plan.head, colony.anchor, colony.bodies, colony.seed);
      triangles += mesh.indices.length / 3;
      vertices += mesh.positions.length / 3;
      bodyCount += colony.bodies.length;
      return { id: colony.id, geometry: reefGeometryOf(mesh), fill: colony.fill };
    });

    return {
      head: reefGeometryOf(headMesh),
      colonies,
      meshCount: 1 + colonies.length,
      bodyCount,
      triangles,
      vertices,
    };
  }, [plan]);
}
