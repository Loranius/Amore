import * as THREE from 'three';
import type { TreeBarkSurfaceState } from '../../barkSurface';
import type {
  TreeMaterialRecipe,
  TreeMaterialState,
  TreeRgb,
} from '../../treeMaterial';

export const TREE_MATERIAL_COLOR_SPACE_VERSION = 'tree-linear-srgb-v1';
export const TREE_BARK_GRAIN_VERSION = 'tree-bark-grain-v1';
export const TREE_FOLIAGE_SURFACE_VERSION = 'tree-foliage-surface-v2';

/**
 * Tree palettes are authored as familiar sRGB values while Three.js material
 * colors live in the linear working space. Feeding the authored channels to
 * `setRGB` directly made the tan bark and foliage much brighter than their
 * recipes and flattened the lighting into a clay-like surface.
 */
function authoredColor(value: TreeRgb): THREE.Color {
  return new THREE.Color()
    .setRGB(value.r, value.g, value.b)
    .convertSRGBToLinear();
}

const TREE_BARK_VERTEX_PARS = /* glsl */ `
attribute float barkCharacter;
attribute float barkMask;
varying float vTreeBarkCharacter;
varying float vTreeBarkMask;
varying vec2 vTreeBarkUv;
`;

const TREE_BARK_VERTEX_BODY = /* glsl */ `
vTreeBarkCharacter = barkCharacter;
vTreeBarkMask = barkMask;
vTreeBarkUv = uv;
`;

const TREE_BARK_FRAGMENT_PARS = /* glsl */ `
varying float vTreeBarkCharacter;
varying float vTreeBarkMask;
varying vec2 vTreeBarkUv;

float treeBarkWave( vec2 uv, float character ) {
  float axialWarp = sin( uv.x * 13.4 + character * 4.7 ) * 0.48
    + sin( uv.x * 31.0 - character * 2.9 ) * 0.16;
  float longGrain = 0.5 + 0.5 * sin( uv.y * 43.9823 + axialWarp );
  float fineGrain = 0.5 + 0.5 * sin( uv.y * 87.9646 - uv.x * 18.0 + character * 7.1 );
  float growthBands = 0.5 + 0.5 * sin( uv.x * 37.0 + uv.y * 5.4 );
  return clamp( longGrain * 0.58 + fineGrain * 0.24 + growthBands * 0.18, 0.0, 1.0 );
}

vec3 treePerturbBarkNormal(
  vec3 surfacePosition,
  vec3 surfaceNormal,
  float height,
  float strength,
  float facing
) {
  vec3 sigmaX = normalize( dFdx( surfacePosition ) );
  vec3 sigmaY = normalize( dFdy( surfacePosition ) );
  vec3 r1 = cross( sigmaY, surfaceNormal );
  vec3 r2 = cross( surfaceNormal, sigmaX );
  float determinant = dot( sigmaX, r1 ) * facing;
  float surfaceArea = max( abs( determinant ), 0.00001 );
  vec2 heightDelta = vec2( dFdx( height ), dFdy( height ) ) * strength;
  vec3 gradient = sign( determinant )
    * ( heightDelta.x * r1 + heightDelta.y * r2 );
  return normalize( surfaceArea * surfaceNormal - gradient );
}
`;

const TREE_BARK_FRAGMENT_COLOR = /* glsl */ `
float treeBarkSurfaceMask = clamp( vTreeBarkMask, 0.0, 1.0 );
float treeBarkGrain = treeBarkWave( vTreeBarkUv, vTreeBarkCharacter );
float treeBarkCrack = 1.0 - smoothstep( 0.06, 0.24, treeBarkGrain );
float treeBarkRing = 0.5 + 0.5 * sin(
  vTreeBarkUv.x * 49.0 + vTreeBarkUv.y * 7.0 + vTreeBarkCharacter * 3.0
);
float treeBarkTone = 0.79
  + treeBarkGrain * 0.22
  + treeBarkRing * 0.045
  - treeBarkCrack * 0.16;
vec3 treeBarkWarmth = vec3(
  treeBarkTone * 1.035,
  treeBarkTone,
  treeBarkTone * 0.955
);
diffuseColor.rgb *= mix( vec3( 1.0 ), treeBarkWarmth, treeBarkSurfaceMask );
`;

const TREE_BARK_FRAGMENT_NORMAL = /* glsl */ `
float treeBarkHeight = mix( treeBarkGrain, treeBarkRing, 0.22 ) - treeBarkCrack * 0.28;
normal = treePerturbBarkNormal(
  -vViewPosition,
  normal,
  treeBarkHeight,
  0.34 * treeBarkSurfaceMask,
  faceDirection
);
`;

const TREE_BARK_FRAGMENT_ROUGHNESS = /* glsl */ `
roughnessFactor = clamp(
  roughnessFactor
    * mix(
      1.0,
      mix( 0.90, 1.075, vTreeBarkCharacter ),
      treeBarkSurfaceMask
    )
    + treeBarkSurfaceMask * ( treeBarkCrack * 0.065 - treeBarkGrain * 0.025 ),
  0.48,
  1.0
);
`;

const TREE_FOLIAGE_VERTEX_PARS = /* glsl */ `
varying vec2 vTreeLeafUv;
`;

const TREE_FOLIAGE_VERTEX_BODY = /* glsl */ `
vTreeLeafUv = uv;
`;

const TREE_FOLIAGE_FRAGMENT_PARS = /* glsl */ `
varying vec2 vTreeLeafUv;
`;

const TREE_FOLIAGE_FRAGMENT_COLOR = /* glsl */ `
float treeLeafMidrib = 1.0 - smoothstep( 0.015, 0.105, abs( vTreeLeafUv.x - 0.5 ) );
float treeLeafVeins = 0.5 + 0.5 * sin(
  vTreeLeafUv.y * 54.0 + abs( vTreeLeafUv.x - 0.5 ) * 35.0
);
float treeLeafBaseShade = mix( 0.96, 1.01, smoothstep( 0.0, 0.88, vTreeLeafUv.y ) );
float treeLeafSurface = treeLeafBaseShade
  * ( 0.992 + treeLeafVeins * 0.016 )
  * ( 0.98 + treeLeafMidrib * 0.02 );
diffuseColor.rgb *= vec3(
  treeLeafSurface * 0.998,
  treeLeafSurface * 1.004,
  treeLeafSurface * 0.996
);
`;

function applyBarkSurfaceShader(
  material: THREE.MeshStandardMaterial,
  bark: TreeBarkSurfaceState,
): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${TREE_BARK_VERTEX_PARS}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${TREE_BARK_VERTEX_BODY}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${TREE_BARK_FRAGMENT_PARS}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n${TREE_BARK_FRAGMENT_COLOR}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>\n${TREE_BARK_FRAGMENT_NORMAL}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>\n${TREE_BARK_FRAGMENT_ROUGHNESS}`,
      );
  };
  material.customProgramCacheKey = () => [
    TREE_BARK_GRAIN_VERSION,
    TREE_MATERIAL_COLOR_SPACE_VERSION,
    bark.signature,
  ].join('|');
  material.userData['treeBarkSurface'] = {
    version: bark.treeBarkSurfaceVersion,
    rulesVersion: bark.rulesVersion,
    id: bark.descriptor.id,
    roughnessAttributeId: bark.descriptor.roughnessAttributeId,
    signature: bark.signature,
    minimumRoughnessCharacter: bark.diagnostics.minimumRoughnessCharacter,
    maximumRoughnessCharacter: bark.diagnostics.maximumRoughnessCharacter,
    grainVersion: TREE_BARK_GRAIN_VERSION,
    barkMaskAttributeId: 'tree:bark:surface-mask',
    textureSource: 'procedural-shader',
    terrainMasked: true,
  };
}

function applyFoliageSurfaceShader(material: THREE.MeshStandardMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\n${TREE_FOLIAGE_VERTEX_PARS}`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n${TREE_FOLIAGE_VERTEX_BODY}`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>\n${TREE_FOLIAGE_FRAGMENT_PARS}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>\n${TREE_FOLIAGE_FRAGMENT_COLOR}`,
      );
  };
  material.customProgramCacheKey = () => [
    TREE_FOLIAGE_SURFACE_VERSION,
    TREE_MATERIAL_COLOR_SPACE_VERSION,
  ].join('|');
  material.userData['treeFoliageSurface'] = {
    version: TREE_FOLIAGE_SURFACE_VERSION,
    textureSource: 'procedural-shader',
    extraDrawCalls: 0,
    extraMaterials: 0,
  };
}

export function createThreeTreeMaterial(
  recipe: TreeMaterialRecipe,
  bark?: TreeBarkSurfaceState,
): THREE.MeshStandardMaterial {
  const vertexColors = recipe.role === 'bark';
  const material = new THREE.MeshStandardMaterial({
    color: authoredColor(recipe.color),
    emissive: authoredColor(recipe.emissiveColor),
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
  material.userData['treeMaterialColorSpace'] = TREE_MATERIAL_COLOR_SPACE_VERSION;
  if (recipe.role === 'bark' && bark) applyBarkSurfaceShader(material, bark);
  if (recipe.role === 'foliage') applyFoliageSurfaceShader(material);
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
