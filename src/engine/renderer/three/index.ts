export { createThreeCrystalGeometry } from './bufferGeometry';
export { createThreeOrganicSweepGeometry } from './organicSweep';
export {
  createThreeTreeLeafCardGeometry,
  createThreeTreeLeafInstancedMesh,
} from './leafInstances';
export {
  createThreeTreeGroundDetailGeometry,
  createThreeTreeGroundDetailInstancedMesh,
  createThreeTreeGroundDetailMaterial,
} from './treeGroundDetail';
export { createThreeTreeRootGeometry } from './treeRootGeometry';
export {
  createThreeTreeMaterial,
  createThreeTreeMaterialPair,
} from './treeMaterials';
export {
  applyThreeTreeLifeFrame,
  createThreeTreeLifeBinding,
} from './treeLife';
export type { ThreeTreeLifeBinding } from './treeLife';
export { createThreeCrystalMaterial } from './material';
export { createThreeCrystalInnerSparks } from './innerSparks';
export type { ThreeCrystalInnerSparks } from './innerSparks';
export {
  applyCrystalLifeFrame,
  createThreeCrystalRenderBundle,
  setThreeCrystalBodyVisible,
  crystalSceneHeight,
  crystalSceneRadius,
  crystalSubstrateSceneRadius,
  ARTIFACT_FIT_HEIGHT,
  ARTIFACT_FIT_WIDTH,
  CRYSTAL_GROUND_BASELINE,
} from './bundle';
export type { ThreeCrystalRenderBundle } from './bundle';
export { fitThreeTree, measureThreeTreeReach } from './treeFit';
export type { ThreeTreeFit, ThreeTreeFitContent, ThreeTreeReach } from './treeFit';
export {
  TREE_LEAF_SWAY_ATTRIBUTE,
  TREE_LEAF_SWAY_VERSION,
  applyThreeTreeLeafSway,
  setThreeTreeLeafSwayFrame,
  type TreeLeafSwayUniforms,
} from './treeLeafSway';
