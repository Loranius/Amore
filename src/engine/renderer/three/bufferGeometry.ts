import * as THREE from 'three';
import type { CrystalMeshData } from '../../geometry';
import type { CrystalBodyMaterial } from '../../material';
import { facetTintForRank } from '../../material/facets';

/**
 * Per-face colour attribute.
 *
 * Geometry publishes one normal per triangle, so the three vertices of a
 * triangle are already its own — writing one tone across them gives a flat
 * face with no bleed into its neighbours. Which tone is Volume VI's decision
 * (`facetTintFor`); this only fills the buffer.
 *
 * The tones are multipliers around 1, and Three multiplies vertex colour into
 * the material colour, so a body still renders as its own earned colour. That
 * is also why this does not cost a draw call: the variation lives in the
 * geometry, not in the material, so bodies sharing an optical signature stay in
 * one batch.
 */
/**
 * Тон кожної вершини — ОДНЕ число, а не колір.
 *
 * Раніше тут писався `color`, який Three множить на базовий колір. Це й
 * було головною вадою: яскравість кристала складається переважно з
 * адитивних термів (ядро, небо, скло, обідок, вуаль), і множник базового
 * кольору їх не торкається. Виміряно — удвічі ширші тони, кроки 50-71%,
 * не зрушили розділення граней узагалі (ADR-0086).
 *
 * Тепер тон їде окремим атрибутом і множить ПІДСУМКОВИЙ колір у самому
 * кінці шейдера.
 */
function facetTones(
  mesh: CrystalMeshData,
  material: CrystalBodyMaterial,
  artifactSeed: number,
): Float32Array {
  const vertexCount = mesh.positions.length / 3;
  const tones = new Float32Array(vertexCount);
  tones.fill(1);

  /*
   * КЛЮЧ — РАНГ ЗА АЗИМУТОМ, і це третій ключ поспіль; два попередні
   * виміряні як зламані (ADR-0086):
   *
   *  1. зважений жереб по `faceId` — 33% сусідніх пар діставали ОДИН тон,
   *     тож вимкнення тонування цілком ПІДНІМАЛО розділення 15% -> 17%;
   *  2. черга `faceId % 4` — номери граней не йдуть по колу: грань 0
   *     дивиться на 0°, грань 1 — на -135°, сусідніх по колу 14 пар із 22;
   *  3. кошик за азимутом шириною 360/ring.length — пояс має 23 грані
   *     разом із фасками, тож сусідні ГОЛОВНІ грані падали через кілька
   *     кошиків: проба дикими тонами дала три сусідні грані одним
   *     кольором (0.1685 / 0.1675 / 0.1628).
   *
   * Ранг вільний від усіх трьох: грані сортуються за напрямком, і тон
   * береться порядковим номером у цьому колі.
   */
  const facing = new Map<number, { azimuth: number; belt: number }>();
  const faceOfTriangle: number[] = [];
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const first = (mesh.indices[offset] ?? 0) * 3;
    const nx = mesh.normals[first] ?? 0;
    const ny = mesh.normals[first + 1] ?? 0;
    const nz = mesh.normals[first + 2] ?? 0;
    const azimuth = Math.atan2(nz, nx);
    // Без `faceIds` ключем стає сам напрямок, огрублений до градуса:
    // копланарні трикутники однієї грані мають однакову нормаль.
    const face = mesh.faceIds?.[offset / 3] ?? Math.round((azimuth * 180) / Math.PI);
    faceOfTriangle.push(face);
    // Пояс — нахил грані, огрублений до чверті. Бічні грані призми, вінець
    // і дно потрапляють у різні пояси.
    if (!facing.has(face)) facing.set(face, { azimuth, belt: Math.round(ny * 2) });
  }

  /*
   * РАНГ РАХУЄТЬСЯ ВСЕРЕДИНІ ПОЯСУ, а не серед усіх граней тіла.
   *
   * Перша редакція ранжувала всі 23 грані одним списком за азимутом — і
   * монарх став рівним: 0.3783 / 0.3813 / 0.3981, різниця 2-4%. Причина в
   * тому, що бічні грані перемежовані коронними та донними, у яких схожий
   * азимут; дві сусідні БІЧНІ грані розходились у ранзі на три-чотири, а
   * `% 4` повертало їх у той самий тон.
   *
   * Пояс це розводить: сусідні за напрямком грані одного нахилу дістають
   * сусідні ранги, і вінець більше не заважає стінці.
   */
  const rankOf = new Map<number, number>();
  const belts = new Map<number, { face: number; azimuth: number }[]>();
  for (const [face, where] of facing) {
    const list = belts.get(where.belt) ?? [];
    list.push({ face, azimuth: where.azimuth });
    belts.set(where.belt, list);
  }
  for (const [, list] of belts) {
    list
      .sort((left, right) => left.azimuth - right.azimuth)
      .forEach((entry, rank) => rankOf.set(entry.face, rank));
  }

  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const tint = facetTintForRank(
      material.facets,
      artifactSeed,
      mesh.bodyId,
      rankOf.get(faceOfTriangle[offset / 3] ?? 0) ?? 0,
    );
    for (let slot = 0; slot < 3; slot += 1) {
      tones[mesh.indices[offset + slot] ?? 0] = tint.r;
    }
  }
  return tones;
}

/**
 * Barycentric coordinates, with the fan's internal cuts switched off.
 *
 * Each corner of a triangle gets a 1 in its own slot and 0 in the others, so
 * the interpolated value at any fragment is its barycentric position and slot
 * `k` measures the distance to the edge opposite corner `k`. Taking the smallest
 * of the three gives distance to the nearest edge, which is what draws an
 * outline — the standard single-pass wireframe, put to a different use.
 *
 * The published `borderEdges` mask is what makes it an outline of the *facet*
 * rather than of every triangle. A face is fanned, so most of its triangles have
 * two edges running through the middle of a flat plane; forcing those slots to 1
 * everywhere means they never approach zero and never light. Without the mask
 * this draws a spider's web across each facet instead of a rim around it.
 *
 * Requires split geometry, where a triangle owns its three vertices — which is
 * exactly what `splitCrystalMeshFaces` guarantees. Returns null otherwise rather
 * than writing an attribute that would be wrong: vertices shared between
 * triangles cannot each carry their own barycentric slot.
 */
function facetEdgeWeights(mesh: CrystalMeshData): Float32Array | null {
  const borderEdges = mesh.borderEdges;
  if (borderEdges === undefined) return null;
  const vertexCount = mesh.positions.length / 3;
  const triangleCount = mesh.indices.length / 3;
  if (vertexCount !== triangleCount * 3) return null;

  const weights = new Float32Array(vertexCount * 3);
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const mask = borderEdges[triangle] ?? 0;
    for (let slot = 0; slot < 3; slot += 1) {
      const vertex = (mesh.indices[triangle * 3 + slot] ?? 0) * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        weights[vertex + axis] = (mask & (1 << axis)) === 0
          ? 1
          : (axis === slot ? 1 : 0);
      }
    }
  }
  return weights;
}

/** Thin renderer adapter. Geometry decisions stay in the pure Geometry Engine. */
export function createThreeCrystalGeometry(
  mesh: CrystalMeshData,
  material?: CrystalBodyMaterial,
  artifactSeed = 0,
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(mesh.normals, 3));
  // Published per face, in engine units. Without it the surface maps would have
  // nothing to sample against and Three would fall back to (0,0) on every
  // vertex — one texel stretched across the whole crystal.
  if (mesh.uvs !== undefined && mesh.uvs.length === (mesh.positions.length / 3) * 2) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(mesh.uvs, 2));
  }
  if (material) {
    geometry.setAttribute(
      'evolutionFacetTone',
      new THREE.BufferAttribute(facetTones(mesh, material, artifactSeed), 1),
    );
  }
  const edges = facetEdgeWeights(mesh);
  if (edges !== null) geometry.setAttribute('evolutionEdge', new THREE.BufferAttribute(edges, 3));
  // Foot-to-tip fraction. Per vertex rather than a uniform because one material
  // draws several bodies of different heights (see `CrystalMeshData.axialT`).
  if (mesh.axialT !== undefined && mesh.axialT.length === mesh.positions.length / 3) {
    geometry.setAttribute('evolutionAxial', new THREE.Float32BufferAttribute(mesh.axialT, 1));
  }
  // The body's own normalised frame, which is where the inner flow is drawn.
  if (mesh.bodyCoord !== undefined && mesh.bodyCoord.length === mesh.positions.length) {
    geometry.setAttribute(
      'evolutionBodyCoord',
      new THREE.Float32BufferAttribute(mesh.bodyCoord, 3),
    );
  }
  geometry.setIndex(mesh.indices);
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData['evolutionBodyId'] = mesh.bodyId;
  geometry.userData['evolutionProfileSignature'] = mesh.profile.signature;
  geometry.userData['evolutionLod'] = mesh.lod;
  geometry.userData['evolutionTrim'] = {
    sourceTriangles: mesh.sourceTriangleCount,
    visibleTriangles: mesh.visibleTriangleCount,
    removedTriangles: mesh.removedTriangleCount,
    baseCapRemoved: mesh.baseCapRemoved,
    occluders: [...mesh.occluderBodyIds],
  };
  return geometry;
}
