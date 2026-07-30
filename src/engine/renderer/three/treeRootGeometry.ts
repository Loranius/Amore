import * as THREE from 'three';
import type { TreeRootGeometryState } from '../../rootGeometry';
import { createThreeOrganicSweepGeometry } from './organicSweep';

/** Thin renderer adapter for the accepted static root sweep. */
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
  };
  return geometry;
}
