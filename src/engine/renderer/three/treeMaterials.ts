import * as THREE from 'three';
import type {
  TreeMaterialRecipe,
  TreeMaterialState,
  TreeRgb,
} from '../../treeMaterial';

function color(value: TreeRgb): THREE.Color {
  return new THREE.Color().setRGB(value.r, value.g, value.b);
}

export function createThreeTreeMaterial(
  recipe: TreeMaterialRecipe,
): THREE.MeshStandardMaterial {
  const vertexColors = recipe.role === 'bark';
  const material = new THREE.MeshStandardMaterial({
    color: color(recipe.color),
    emissive: color(recipe.emissiveColor),
    emissiveIntensity: recipe.emissiveIntensity,
    roughness: recipe.roughness,
    metalness: recipe.metalness,
    opacity: recipe.opacity,
    transparent: recipe.transparent,
    depthWrite: recipe.depthWrite,
    flatShading: recipe.flatShading,
    side: recipe.side === 'double' ? THREE.DoubleSide : THREE.FrontSide,
    vertexColors,
  });
  material.name = recipe.id;
  material.userData['treeMaterialRole'] = recipe.role;
  material.userData['treeMaterialSignature'] = recipe.signature;
  material.userData['treeVertexTintEnabled'] = vertexColors;
  return material;
}

/** Resolves exactly one bark and one foliage material from the published state. */
export function createThreeTreeMaterialPair(state: TreeMaterialState): {
  bark: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
} {
  const barkRecipe = state.materials.find(
    (material) => material.id === state.bindings.branchMaterialId && material.role === 'bark',
  );
  const foliageRecipe = state.materials.find(
    (material) => material.id === state.bindings.leafMaterialId && material.role === 'foliage',
  );
  if (!barkRecipe || !foliageRecipe) {
    throw new Error('Tree Material State must bind one bark and one foliage recipe.');
  }
  return {
    bark: createThreeTreeMaterial(barkRecipe),
    foliage: createThreeTreeMaterial(foliageRecipe),
  };
}
