import * as THREE from 'three';
import type { TreeRootGeometryState } from '../../rootGeometry';
import { createThreeOrganicSweepGeometry } from './organicSweep';

/** Thin renderer adapter for accepted roots, collar and merged terrain. */
export function createThreeTreeRootGeometry(
  state: TreeRootGeometryState,
): THREE.BufferGeometry {
  const geometry = createThreeOrganicSweepGeometry(state.mesh);
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
  };
  return geometry;
}
