export { DEFAULT_CRYSTAL_GEOMETRY_CONFIG } from './config';
export { buildCrystalGeometry } from './engine';
export { buildCrystalJunction } from './junction';
export { buildCrystalMesh, rebuildCrystalMeshNormals } from './mesh';
export { buildCrystalProfile, crystalSegments } from './profile';
export {
  CRYSTAL_SUBSTRATE_BODY_ID,
  crystalVeinBearings,
  crystalVeinRadiusAt,
} from './substrate';
export { pointInsideCrystalSolid, trimCrystalMesh } from './trim';
export type {
  BuildCrystalGeometryInput,
  CrystalAttachmentJunction,
  CrystalBodyProfile,
  CrystalGeometryBudget,
  CrystalGeometryConfig,
  CrystalGeometryDiagnostics,
  CrystalGeometryState,
  CrystalLodLevel,
  CrystalMeshBounds,
  CrystalMeshData,
  CrystalProfileRow,
  CrystalSolid,
} from './types';
