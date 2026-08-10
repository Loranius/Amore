import * as THREE from 'three';
import type { CrystalGeometryState } from '../../geometry';
import type { CrystalLifeState } from '../../life';
import { CRYSTAL_MONARCH_BODY_ID } from '../../species/crystal';

/**
 * The lights caught inside the monarch.
 *
 * One `THREE.Points`, one draw call, and only ever on the monarch — the same
 * rule the inner flow follows and for the same reason: what makes her the
 * monarch is that she is the one with something alive in her.
 *
 * **Drawn over the shell, not through it.** The shell is opaque by contract
 * (ADR-0007: the canvas is alpha-composited over a CSS sky, so a transmissive
 * body shows black where it overlaps the sky), which means nothing inside a
 * crystal can be seen by ordinary depth-tested drawing — the shell would simply
 * cover it. So the cloud is additive with depth testing off and a render order
 * behind the batches, exactly the way a highlight painted on glass works. The
 * positions still have to be genuinely inside her silhouette, because that is
 * the only thing left making them read as inclusions rather than as dust in
 * front of the crystal; Life keeps them there (`sparkEnvelope`).
 *
 * Everything about the cloud is seeded. What it replaces was drei's
 * `<Sparkles>`, which draws its sizes from `Math.random()` — two mounts of one
 * couple's artifact produced two different artifacts.
 */
export interface ThreeCrystalInnerSparks {
  points: THREE.Points;
  /** Advanced by the life frame; the twinkle reads it. */
  phaseUniform: { value: number };
  dispose(): void;
}

/** How far a spark may sit from the monarch's axis, in her own body radii. */
function monarchFrame(geometry: CrystalGeometryState): {
  centerX: number;
  centerZ: number;
  footY: number;
  height: number;
  radius: number;
} | null {
  const mesh = geometry.meshes.find((candidate) => candidate.bodyId === CRYSTAL_MONARCH_BODY_ID);
  if (mesh === undefined) return null;
  const bounds = mesh.bounds;
  const height = bounds.max.y - bounds.min.y;
  if (!(height > 1e-6)) return null;
  // The same normalisation Geometry publishes as `bodyCoord`: one divisor for
  // both x and z, so an elliptical cross-section is not stretched into a circle
  // and the cloud does not drift off-centre as the crystal turns.
  const radius = Math.max(
    Math.abs(bounds.max.x),
    Math.abs(bounds.min.x),
    Math.abs(bounds.max.z),
    Math.abs(bounds.min.z),
  );
  return {
    centerX: 0,
    centerZ: 0,
    footY: bounds.min.y,
    height,
    radius: Math.max(1e-6, radius),
  };
}

const VERTEX = /* glsl */ `
attribute float sparkPhase;
attribute float sparkSpeed;
attribute float sparkSize;
uniform float uSparkPhase;
uniform float uSparkScale;
varying float vSparkGlow;

void main() {
  vec4 mvPosition = modelViewMatrix * vec4( position, 1.0 );
  // Each light on its own clock and its own offset, so the cloud never blinks
  // in unison — which is the difference between inclusions catching a moving
  // light and a string of fairy lights.
  float twinkle = sin( uSparkPhase * sparkSpeed + sparkPhase ) * 0.5 + 0.5;
  vSparkGlow = 0.35 + 0.65 * twinkle;
  // Attenuated by distance, so the cloud shrinks with the crystal as the
  // portal's camera pulls back rather than staying a fixed screen size and
  // swallowing a small artifact.
  gl_PointSize = sparkSize * uSparkScale * ( 1.0 + vSparkGlow * 0.4 ) / max( 0.001, -mvPosition.z );
  gl_Position = projectionMatrix * mvPosition;
}
`;

const FRAGMENT = /* glsl */ `
uniform vec3 uSparkColor;
uniform float uSparkStrength;
varying float vSparkGlow;

void main() {
  // A round falloff rather than the square a point sprite is by default. Square
  // sparks read as pixels the renderer forgot to blend.
  vec2 offset = gl_PointCoord - vec2( 0.5 );
  float radius = length( offset ) * 2.0;
  float core = 1.0 - smoothstep( 0.0, 1.0, radius );
  gl_FragColor = vec4( uSparkColor * vSparkGlow * uSparkStrength, core * core * vSparkGlow );
}
`;

export function createThreeCrystalInnerSparks(
  geometry: CrystalGeometryState,
  life: CrystalLifeState,
): ThreeCrystalInnerSparks | null {
  if (life.innerSparks.length === 0) return null;
  const frame = monarchFrame(geometry);
  if (frame === null) return null;

  const count = life.innerSparks.length;
  const positions = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const speeds = new Float32Array(count);
  const sizes = new Float32Array(count);

  life.innerSparks.forEach((spark, index) => {
    // Life publishes the cloud in the monarch's normalised frame precisely so
    // it needs no geometry of its own; this is the one place that frame is
    // turned back into engine units, and it is a renderer's job.
    positions[index * 3] = frame.centerX + spark.x * frame.radius;
    positions[index * 3 + 1] = frame.footY + spark.y * frame.height;
    positions[index * 3 + 2] = frame.centerZ + spark.z * frame.radius;
    phases[index] = spark.phaseRad;
    speeds[index] = spark.speed;
    sizes[index] = spark.size;
  });

  const bufferGeometry = new THREE.BufferGeometry();
  bufferGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  bufferGeometry.setAttribute('sparkPhase', new THREE.BufferAttribute(phases, 1));
  bufferGeometry.setAttribute('sparkSpeed', new THREE.BufferAttribute(speeds, 1));
  bufferGeometry.setAttribute('sparkSize', new THREE.BufferAttribute(sizes, 1));

  const phaseUniform = { value: 0 };
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: {
      uSparkPhase: phaseUniform,
      // Pixels per engine unit at unit distance. Scaled off the monarch's own
      // height so a light is the same size relative to the crystal it is in,
      // whether that crystal is one year old or twenty-five.
      uSparkScale: { value: frame.height * 26 },
      // Rose, in §6's family. The lights are the same light the flow carries.
      uSparkColor: { value: new THREE.Color().setRGB(1, 0.72, 0.86) },
      uSparkStrength: { value: 1.4 },
    },
    transparent: true,
    // Additive, because a light inside a stone adds to what is already there.
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    // Off, and this is the whole reason the cloud is visible at all — see the
    // interface comment. An opaque shell hides anything depth-tested behind it.
    depthTest: false,
  });

  const points = new THREE.Points(bufferGeometry, material);
  points.name = 'Amore Evolution monarch inner sparks';
  points.frustumCulled = false;
  // After the crystal batches, so the additive pass lands on a finished shell.
  points.renderOrder = 10;

  return {
    points,
    phaseUniform,
    dispose: () => {
      bufferGeometry.dispose();
      material.dispose();
    },
  };
}
