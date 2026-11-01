export { createThreeOrganicSweepGeometry } from './organicSweep';
export {
  createThreeTreeLeafInstancedMesh,
} from './leafInstances';
export {
  createThreeTreeGroundDetailInstancedMesh,
} from './treeGroundDetail';
export { createThreeTreeRootGeometry } from './treeRootGeometry';
export {
  createThreeTreeMaterialPair,
} from './treeMaterials';
export {
  applyThreeTreeLifeFrame,
  createThreeTreeLifeBinding,
} from './treeLife';
export type { ThreeTreeLifeBinding } from './treeLife';
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
export { fitThreeTree, measureThreeTreeReach, TREE_FIT_HEIGHT } from './treeFit';
export type { ThreeTreeFit, ThreeTreeFitContent, ThreeTreeReach } from './treeFit';
export {
  TREE_LEAF_SWAY_VERSION,
  type TreeLeafSwayUniforms,
} from './treeLeafSway';
