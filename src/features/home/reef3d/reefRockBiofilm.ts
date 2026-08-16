import * as THREE from 'three';

export const REEF_ROCK_BIOFILM_VERSION = 'reef-rock-biofilm-v1';

export interface ReefRockBiofilmProfile {
  version: typeof REEF_ROCK_BIOFILM_VERSION;
  patternSeed: number;
  coverage: number;
  algaeTintStrength: number;
  creviceDarkening: number;
  roughnessVariation: number;
}

export interface BuildReefRockBiofilmProfileInput {
  identitySeed: number;
  completedYears: number;
  colonization: number;
  biodiversity: number;
  substrateMaturity: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/**
 * Converts ecological maturity into a subtle material-only rock aging pass.
 * It deliberately saturates early: more history makes the reef feel older,
 * but never turns the limestone into a uniformly green or glossy surface.
 */
export function buildReefRockBiofilmProfile({
  identitySeed,
  completedYears,
  colonization,
  biodiversity,
  substrateMaturity,
}: BuildReefRockBiofilmProfileInput): ReefRockBiofilmProfile {
  const ageMaturity = clamp01(completedYears / 12);
  const ecology = clamp01(
    colonization * 0.46
      + biodiversity * 0.22
      + substrateMaturity * 0.22
      + ageMaturity * 0.1,
  );

  return {
    version: REEF_ROCK_BIOFILM_VERSION,
    patternSeed: round4(((identitySeed >>> 0) % 100_003) / 100_003),
    coverage: round4(0.08 + ecology * 0.5),
    algaeTintStrength: round4(0.025 + ecology * 0.085),
    creviceDarkening: round4(0.035 + ecology * 0.085),
    roughnessVariation: round4(0.025 + biodiversity * 0.055 + substrateMaturity * 0.025),
  };
}

function profileCacheKey(profile: ReefRockBiofilmProfile): string {
  return [
    profile.version,
    profile.patternSeed.toFixed(4),
    profile.coverage.toFixed(4),
    profile.algaeTintStrength.toFixed(4),
    profile.creviceDarkening.toFixed(4),
    profile.roughnessVariation.toFixed(4),
  ].join(':');
}

/**
 * Adds deterministic world-space biofilm, dark recesses and roughness breakup
 * to an existing MeshStandardMaterial without creating another mesh/draw call.
 */
export function applyReefRockBiofilmMaterial(
  material: THREE.MeshStandardMaterial,
  profile: ReefRockBiofilmProfile,
): void {
  const cacheKey = profileCacheKey(profile);

  material.userData.reefRockBiofilmVersion = profile.version;
  material.userData.reefRockBiofilmProfile = { ...profile };
  // Do not chain the previous cache function: the constructor sandbox can
  // rebuild the reef many times in one session and would otherwise grow the
  // cache key on every slider movement.
  material.customProgramCacheKey = () => cacheKey;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.reefBioPatternSeed = { value: profile.patternSeed };
    shader.uniforms.reefBioCoverage = { value: profile.coverage };
    shader.uniforms.reefBioTintStrength = { value: profile.algaeTintStrength };
    shader.uniforms.reefBioCreviceDarkening = { value: profile.creviceDarkening };
    shader.uniforms.reefBioRoughnessVariation = { value: profile.roughnessVariation };

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nvarying vec3 vReefBioWorldPosition;`,
      )
      .replace(
        '#include <project_vertex>',
        `vec4 reefBioWorldPosition = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  reefBioWorldPosition = instanceMatrix * reefBioWorldPosition;
#endif
vReefBioWorldPosition = (modelMatrix * reefBioWorldPosition).xyz;
#include <project_vertex>`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vReefBioWorldPosition;
uniform float reefBioPatternSeed;
uniform float reefBioCoverage;
uniform float reefBioTintStrength;
uniform float reefBioCreviceDarkening;
uniform float reefBioRoughnessVariation;

float reefBioField(vec3 p) {
  float seedA = reefBioPatternSeed * 17.31;
  float seedB = reefBioPatternSeed * 31.73;
  float broadA = sin(p.x * 1.21 + p.z * 0.83 + seedA);
  float broadB = sin(p.z * 1.67 - p.y * 1.13 + seedB);
  float medium = sin((p.x - p.z) * 2.63 + p.y * 1.41 + seedA * 0.57);
  float fine = sin((p.x + p.y + p.z) * 5.17 - seedB * 0.31);
  return clamp(0.5 + broadA * 0.19 + broadB * 0.15 + medium * 0.1 + fine * 0.055, 0.0, 1.0);
}

float reefBioCreviceField(vec3 p) {
  float seed = reefBioPatternSeed * 23.91;
  float a = sin(p.x * 2.19 - p.z * 2.71 + seed);
  float b = sin(p.y * 3.07 + p.z * 1.47 - seed * 0.43);
  return clamp(0.5 + a * 0.28 + b * 0.22, 0.0, 1.0);
}`,
      )
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
float reefBioNoise = reefBioField(vReefBioWorldPosition);
float reefBioThreshold = mix(0.82, 0.49, reefBioCoverage);
float reefBioMask = smoothstep(reefBioThreshold, min(0.98, reefBioThreshold + 0.19), reefBioNoise);
float reefBioLowSurface = 1.0 - smoothstep(-0.35, 2.55, vReefBioWorldPosition.y);
float reefBioCreviceNoise = reefBioCreviceField(vReefBioWorldPosition);
float reefBioCreviceMask = smoothstep(0.63, 0.9, reefBioCreviceNoise)
  * (0.34 + reefBioLowSurface * 0.66)
  * (0.45 + reefBioCoverage * 0.55);
vec3 reefBioTint = vec3(0.71, 0.82, 0.74);
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  diffuseColor.rgb * reefBioTint,
  reefBioMask * reefBioTintStrength
);
diffuseColor.rgb *= 1.0 - reefBioCreviceMask * reefBioCreviceDarkening;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
float reefBioRoughnessNoise = reefBioField(vReefBioWorldPosition * 1.73 + vec3(1.7, -0.8, 2.1));
float reefBioRoughnessOffset = (reefBioRoughnessNoise - 0.5) * reefBioRoughnessVariation;
roughnessFactor = clamp(
  roughnessFactor
    + reefBioMask * reefBioRoughnessVariation * 0.42
    + reefBioRoughnessOffset
    - reefBioCreviceMask * 0.045,
  0.72,
  1.0
);`,
      );
  };
  material.needsUpdate = true;
}
