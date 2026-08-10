import * as THREE from 'three';
import type { CrystalMeshData } from '../../geometry';
import type { CrystalBodyMaterial } from '../../material';
import { facetTintFor } from '../../material/facets';

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
function facetColors(
  mesh: CrystalMeshData,
  material: CrystalBodyMaterial,
  artifactSeed: number,
): Float32Array {
  const vertexCount = mesh.positions.length / 3;
  const colors = new Float32Array(vertexCount * 3);
  // Keyed on the *face*, not on the triangle. A face is several coplanar
  // triangles that must read as one plane; tinting them separately draws seams
  // across every face — the same mosaic the geometry pass was undoing.
  //
  // The geometry publishes which face each triangle belongs to, and it has to:
  // the arithmetic that used to stand here — `floor(triangle / 2)` modulo the
  // ring length — encoded the lathe's two-triangles-per-facet layout, and
  // ADR-0006 replaced the lathe with a polytope whose faces are fanned into a
  // different number of triangles each. It went on returning an index, so
  // nothing failed; the tints simply stopped landing on faces, neighbouring
  // facets averaged to within a few percent of one another, and the crystal
  // read as a smooth shape. Falls back for persisted meshes with no identifiers.
  const faceIds = mesh.faceIds;
  const facesPerRing = Math.max(1, mesh.profile.ring?.length ?? mesh.profile.segments);
  for (let offset = 0; offset < mesh.indices.length; offset += 3) {
    const triangle = offset / 3;
    const tint = facetTintFor(
      material.facets,
      artifactSeed,
      mesh.bodyId,
      faceIds === undefined
        ? Math.floor(triangle / 2) % facesPerRing
        : faceIds[triangle] ?? 0,
    );
    for (let slot = 0; slot < 3; slot += 1) {
      const vertex = (mesh.indices[offset + slot] ?? 0) * 3;
      colors[vertex] = tint.r;
      colors[vertex + 1] = tint.g;
      colors[vertex + 2] = tint.b;
    }
  }
  return colors;
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
      'color',
      new THREE.BufferAttribute(facetColors(mesh, material, artifactSeed), 3),
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
