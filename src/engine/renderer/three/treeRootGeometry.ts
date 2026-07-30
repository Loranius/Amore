import * as THREE from 'three';
import type { TreeRootGeometryState } from '../../rootGeometry';
import type { TreeSoilSurfaceState } from '../../soilSurface';
import { createThreeOrganicSweepGeometry } from './organicSweep';

function applySoilVertexTints(
  geometry: THREE.BufferGeometry,
  rootGeometry: TreeRootGeometryState,
  soil: TreeSoilSurfaceState,
): void {
  if (soil.artifactSeed !== rootGeometry.artifactSeed
    || soil.lod !== rootGeometry.lod
    || soil.sourceRootGeometryVersion !== rootGeometry.treeRootGeometryVersion
    || soil.sourceRootGeometryRulesVersion !== rootGeometry.rulesVersion) {
    throw new Error('Three Tree Root Geometry received Soil Surface from another root geometry.');
  }
  if (soil.vertexColors.length !== rootGeometry.diagnostics.vertexCount * 3) {
    throw new Error('Three Tree Root Geometry Soil Surface tint count does not match geometry.');
  }
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(soil.vertexColors, 3),
  );
  geometry.userData['treeSoilSurface'] = {
    version: soil.treeSoilSurfaceVersion,
    rulesVersion: soil.rulesVersion,
    id: soil.descriptor.id,
    paletteId: soil.descriptor.paletteId,
    tintAttributeId: soil.descriptor.tintAttributeId,
    signature: soil.signature,
    terrainVertexOffset: soil.diagnostics.terrainVertexOffset,
    terrainVertices: soil.diagnostics.terrainVertexCount,
    uniqueTints: soil.diagnostics.uniqueTintCount,
    materialRole: soil.diagnostics.materialRole,
  };
}

/** Thin renderer adapter for accepted roots, collar, merged terrain and soil tint. */
export function createThreeTreeRootGeometry(
  state: TreeRootGeometryState,
  soil?: TreeSoilSurfaceState,
): THREE.BufferGeometry {
  const geometry = createThreeOrganicSweepGeometry(state.mesh);
  if (soil) applySoilVertexTints(geometry, state, soil);
  geometry.userData['treeRootGeometry'] = {
    version: state.treeRootGeometryVersion,
    rulesVersion: state.rulesVersion,
    artifactSeed: state.artifactSeed,
    lod: state.lod,
    roots: state.diagnostics.renderedRootCount,
    vertices: state.diagnostics.vertexCount,
    triangles: state.diagnostics.triangleCount,
    anchoredToGround: state.diagnostics.anchoredToGround,
    contactApplied: state.diagnostics.contactApplied,
    groundLevelY: state.diagnostics.groundLevelY,
    visiblePathFraction: state.diagnostics.visiblePathFraction,
    collarVertices: state.diagnostics.collarVertexCount,
    collarTriangles: state.diagnostics.collarTriangleCount,
    terrainApplied: state.diagnostics.terrainApplied,
    terrainVertices: state.diagnostics.terrainVertexCount,
    terrainTriangles: state.diagnostics.terrainTriangleCount,
    terrainMergedIntoStaticMesh: state.diagnostics.terrainMergedIntoStaticMesh,
    soilTintApplied: soil !== undefined,
  };
  return geometry;
}
