import * as THREE from 'three';
import type { TreeBarkSurfaceState } from '../../barkSurface';
import type {
  TreeMaterialRecipe,
  TreeMaterialState,
  TreeRgb,
} from '../../treeMaterial';

function color(value: TreeRgb): THREE.Color {
  return new THREE.Color().setRGB(value.r, value.g, value.b);
}

function applyBarkSurfaceShader(
  material: THREE.MeshStandardMaterial,
  bark: TreeBarkSurfaceState,
): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nattribute float barkCharacter;\nvarying float vTreeBarkCharacter;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvTreeBarkCharacter = barkCharacter;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying float vTreeBarkCharacter;',
      )
      .replace(
        'float roughnessFactor = roughness;',
        'float roughnessFactor = clamp(roughness * mix(0.90, 1.08, vTreeBarkCharacter), 0.0, 1.0);',
      );
  };
  material.customProgramCacheKey = () => `tree-bark-surface|${bark.signature}`;
  material.userData['treeBarkSurface'] = {
    version: bark.treeBarkSurfaceVersion,
    rulesVersion: bark.rulesVersion,
    id: bark.descriptor.id,
    roughnessAttributeId: bark.descriptor.roughnessAttributeId,
    signature: bark.signature,
    minimumRoughnessCharacter: bark.diagnostics.minimumRoughnessCharacter,
    maximumRoughnessCharacter: bark.diagnostics.maximumRoughnessCharacter,
  };
}

export function createThreeTreeMaterial(
  recipe: TreeMaterialRecipe,
  bark?: TreeBarkSurfaceState,
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
  if (recipe.role === 'bark' && bark) applyBarkSurfaceShader(material, bark);
  return material;
}

/** Resolves exactly one bark and one foliage material from the published state. */
export function createThreeTreeMaterialPair(
  state: TreeMaterialState,
  bark?: TreeBarkSurfaceState,
): {
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
  if (bark && (bark.artifactSeed !== state.artifactSeed
    || bark.sourceMaterialStateVersion !== state.treeMaterialStateVersion
    || bark.sourceMaterialRulesVersion !== state.rulesVersion)) {
    throw new Error('Three Tree Material received Bark Surface from another material state.');
  }
  return {
    bark: createThreeTreeMaterial(barkRecipe, bark),
    foliage: createThreeTreeMaterial(foliageRecipe),
  };
}
