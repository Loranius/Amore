import * as THREE from 'three';
import type { TreeBarkSurfaceState } from '../../barkSurface';
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

function applyStaticBarkSurface(
  geometry: THREE.BufferGeometry,
  rootGeometry: TreeRootGeometryState,
  soil: TreeSoilSurfaceState,
  bark: TreeBarkSurfaceState,
): void {
  if (bark.artifactSeed !== rootGeometry.artifactSeed
    || bark.lod !== rootGeometry.lod
    || bark.sourceRootGeometryVersion !== rootGeometry.treeRootGeometryVersion
    || bark.sourceRootGeometryRulesVersion !== rootGeometry.rulesVersion
    || bark.sourceSoilSurfaceVersion !== soil.treeSoilSurfaceVersion
    || bark.sourceSoilRulesVersion !== soil.rulesVersion) {
    throw new Error('Three Tree Root Geometry received Bark Surface from another static mesh.');
  }
  if (bark.staticVertexColors.length !== rootGeometry.diagnostics.vertexCount * 3
    || bark.staticRoughnessCharacters.length !== rootGeometry.diagnostics.vertexCount) {
    throw new Error('Three Tree Root Geometry Bark Surface attributes do not match geometry.');
  }
  geometry.setAttribute(
    'color',
    new THREE.Float32BufferAttribute(bark.staticVertexColors, 3),
  );
  geometry.setAttribute(
    'barkCharacter',
    new THREE.Float32BufferAttribute(bark.staticRoughnessCharacters, 1),
  );
  const barkMask = new Float32Array(rootGeometry.diagnostics.vertexCount);
  barkMask.fill(1, 0, bark.diagnostics.staticBarkVertexCount);
  geometry.setAttribute(
    'barkMask',
    new THREE.Float32BufferAttribute(barkMask, 1),
  );
  geometry.userData['treeBarkSurface'] = {
    version: bark.treeBarkSurfaceVersion,
    rulesVersion: bark.rulesVersion,
    id: bark.descriptor.id,
    tintAttributeId: bark.descriptor.tintAttributeId,
    roughnessAttributeId: bark.descriptor.roughnessAttributeId,
    signature: bark.signature,
    staticBarkVertices: bark.diagnostics.staticBarkVertexCount,
    preservedTerrainVertices: bark.diagnostics.preservedTerrainVertexCount,
    soilTerrainTintPreserved: bark.diagnostics.soilTerrainTintPreserved,
    barkMaskAttributeId: 'tree:bark:surface-mask',
    maskedBarkVertices: bark.diagnostics.staticBarkVertexCount,
    maskedTerrainVertices: bark.diagnostics.preservedTerrainVertexCount,
  };
}

/** Thin renderer adapter for accepted roots, collar, merged terrain and surface character. */
export function createThreeTreeRootGeometry(
  state: TreeRootGeometryState,
  soil?: TreeSoilSurfaceState,
  bark?: TreeBarkSurfaceState,
): THREE.BufferGeometry {
  const geometry = createThreeOrganicSweepGeometry(state.mesh);
  if (soil) applySoilVertexTints(geometry, state, soil);
  if (bark) {
    if (!soil) throw new Error('Three Tree Root Geometry requires Soil Surface before Bark Surface.');
    applyStaticBarkSurface(geometry, state, soil, bark);
  }
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
    barkSurfaceApplied: bark !== undefined,
  };
  return geometry;
}
