import * as THREE from 'three';
import type { CrystalBodyMaterial, CrystalRgb, CrystalShaderRecipe } from '../../material';

function toColor(color: CrystalRgb): THREE.Color {
  return new THREE.Color().setRGB(color.r, color.g, color.b);
}

function rgbKey(color: CrystalRgb): string {
  return `${color.r.toFixed(6)},${color.g.toFixed(6)},${color.b.toFixed(6)}`;
}

function shaderKey(recipe: CrystalShaderRecipe): string {
  return [
    recipe.shaderVersion,
    recipe.rimStrength.toFixed(6),
    recipe.skyStrength.toFixed(6),
    rgbKey(recipe.skyColor),
    rgbKey(recipe.groundColor),
    rgbKey(recipe.rimColor),
    recipe.inclusionDensity.toFixed(6),
    recipe.inclusionScale.toFixed(6),
    recipe.inclusionContrast.toFixed(6),
  ].join('|');
}

const FRAGMENT_PARS = /* glsl */ `
uniform float uEvolutionRimStrength;
uniform float uEvolutionSkyStrength;
uniform vec3 uEvolutionSkyColor;
uniform vec3 uEvolutionGroundColor;
uniform vec3 uEvolutionRimColor;
uniform float uEvolutionInclusionDensity;
uniform float uEvolutionInclusionScale;
uniform float uEvolutionInclusionContrast;
`;

const FRAGMENT_BODY = /* glsl */ `
  vec3 evolutionViewDir = normalize( vViewPosition );
  float evolutionFacing = clamp( dot( normal, evolutionViewDir ), 0.0, 1.0 );
  float evolutionFresnel = pow( 1.0 - evolutionFacing, 5.0 );
  vec3 evolutionReflected = reflect( -evolutionViewDir, normal );
  float evolutionUpness = clamp( evolutionReflected.y * 0.5 + 0.5, 0.0, 1.0 );
  vec3 evolutionSky = mix( uEvolutionGroundColor, uEvolutionSkyColor, evolutionUpness );
  outgoingLight += evolutionSky * uEvolutionSkyStrength * ( 0.25 + 0.75 * evolutionFresnel );
  outgoingLight += uEvolutionRimColor * uEvolutionRimStrength * evolutionFresnel;

  float evolutionBand = sin(
    dot( vViewPosition, vec3(0.83, 1.17, 0.61) ) * uEvolutionInclusionScale
    + dot( normal, vec3(2.1, 1.3, 1.7) )
  );
  float evolutionInclusion = uEvolutionInclusionDensity > 0.0001
    ? smoothstep(1.0 - uEvolutionInclusionDensity, 1.0, evolutionBand * 0.5 + 0.5)
    : 0.0;
  outgoingLight *= 1.0 - evolutionInclusion * uEvolutionInclusionContrast;
`;

function applyEvolutionShader(material: THREE.MeshPhysicalMaterial, recipe: CrystalBodyMaterial['shader']): void {
  if (
    recipe.rimStrength <= 0
    && recipe.skyStrength <= 0
    && recipe.inclusionDensity <= 0
  ) return;

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uEvolutionRimStrength'] = { value: recipe.rimStrength };
    shader.uniforms['uEvolutionSkyStrength'] = { value: recipe.skyStrength };
    shader.uniforms['uEvolutionSkyColor'] = { value: toColor(recipe.skyColor) };
    shader.uniforms['uEvolutionGroundColor'] = { value: toColor(recipe.groundColor) };
    shader.uniforms['uEvolutionRimColor'] = { value: toColor(recipe.rimColor) };
    shader.uniforms['uEvolutionInclusionDensity'] = { value: recipe.inclusionDensity };
    shader.uniforms['uEvolutionInclusionScale'] = { value: recipe.inclusionScale };
    shader.uniforms['uEvolutionInclusionContrast'] = { value: recipe.inclusionContrast };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `${FRAGMENT_PARS}\nvoid main() {`)
      .replace('#include <opaque_fragment>', `${FRAGMENT_BODY}\n#include <opaque_fragment>`);
  };
  material.customProgramCacheKey = () => `evolution-crystal:${shaderKey(recipe)}`;
  material.needsUpdate = true;
}

/** Thin renderer adapter. Optical decisions stay in Crystal Material State. */
export function createThreeCrystalMaterial(source: CrystalBodyMaterial): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color: toColor(source.baseColor),
    emissive: toColor(source.emissiveColor),
    emissiveIntensity: source.emissiveIntensity,
    roughness: source.roughness,
    metalness: source.metalness,
    clearcoat: source.clearcoat,
    clearcoatRoughness: source.clearcoatRoughness,
    ior: source.ior,
    reflectivity: source.reflectivity,
    transmission: 0,
    opacity: 1,
    transparent: false,
    depthWrite: true,
    envMapIntensity: source.envMapIntensity,
  });
  material.iridescence = source.iridescence;
  material.iridescenceIOR = source.iridescenceIOR;
  material.iridescenceThicknessRange = [
    source.iridescenceThicknessMin,
    source.iridescenceThicknessMax,
  ];
  material.userData['evolutionBodyId'] = source.bodyId;
  material.userData['evolutionSignature'] = source.signature;
  material.userData['evolutionBaseEmissiveIntensity'] = source.emissiveIntensity;
  applyEvolutionShader(material, source.shader);
  return material;
}
