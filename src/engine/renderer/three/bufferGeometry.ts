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
