import { softNormals, softScalar } from '@/features/home/diorama/softNormals';
import { ISLAND_CREASE_DEG } from './CrystalIsland';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import type { CrystalV2Model } from '@/engine/species/crystalV2/model';
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import { unit } from '@/engine/species/crystalV2/hash';
import { createCrystalV2Material, createGeodeMaterial, linearColour } from './crystalV2Material';
import { celebrationAt, celebrationEnd, celebrationTimeline } from './celebration';

const NO_KINDS: readonly string[] = [];

interface CrystalV2ObjectProps {
  model: CrystalV2Model;
  geometry: CrystalV2Geometry;
  scale: number;
  theme: 'light' | 'dark';
  reduceMotion: boolean;
  /**
   * Види подій, нових з минулого візиту (ADR-0261, `GrowthSummary.kinds`):
   * кристал відповідає на них коротким відгуком один раз за монтування.
   */
  celebrate?: readonly string[];
  /**
   * Лише лабораторія: зупинити відгук на цій миті (секунди від появи), щоб
   * кадр можна було зняти. Без нього відгук іде за годинником сцени.
   */
  celebrateAt?: number;
}

/**
 * Колонія, жеода, іскри віх, сяйво й порошинки — п'ять викликів малювання на весь кристал.
 *
 * Стоїть на тій самій лінії землі, що й старий артефакт
 * (`CRYSTAL_GROUND_BASELINE`), тож острів, храм і вода порталу не знають,
 * котра зі сцен кристала зараз у них стоїть.
 */
export function CrystalV2Object({ model, geometry, scale, theme, reduceMotion, celebrate = NO_KINDS, celebrateAt }: CrystalV2ObjectProps) {
  const rgb = model.colour.rgb;
  const glow = model.monarch.glow;

  const crystals = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(geometry.crystals.positions, 3));
    buffer.setAttribute('faceTone', new THREE.BufferAttribute(geometry.crystals.faceTone, 1));
    buffer.setAttribute('edge', new THREE.BufferAttribute(geometry.crystals.edge, 3));
    buffer.setAttribute('rise', new THREE.BufferAttribute(geometry.crystals.rise, 1));
    buffer.computeBoundingSphere();
    return buffer;
  }, [geometry]);

  const rocks = useMemo(() => {
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(geometry.rocks.positions, 3));
    buffer.setAttribute('tone', new THREE.BufferAttribute(softScalar(geometry.rocks.positions, geometry.rocks.tone, ISLAND_CREASE_DEG), 1));
    // Уламки біля підніжжя — обтічні; гострим лишається лише кристал (власник, 2026-10-04).
    buffer.setAttribute('normal', new THREE.BufferAttribute(softNormals(geometry.rocks.positions, ISLAND_CREASE_DEG), 3));
    buffer.computeBoundingSphere();
    return buffer;
  }, [geometry]);

  const sparks = useMemo(() => {
    if (geometry.sparks.length === 0) return null;
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(geometry.sparks, 3));
    return buffer;
  }, [geometry]);

  const crystalMaterial = useMemo(() => createCrystalV2Material(rgb, glow), [rgb, glow]);
  useEffect(() => { crystalMaterial.uniforms.uInvScale!.value = 1 / Math.max(1e-6, scale); }, [crystalMaterial, scale]);
  const rockMaterial = useMemo(
    () => createGeodeMaterial(rgb, glow, theme, CRYSTAL_GROUND_BASELINE),
    [rgb, glow, theme],
  );
  // Іскри віх лежать на осі кристала року, а кристал тепер суцільний
  // (ADR-0227): кожну виносимо до камери на радіус найтовщого тіла року,
  // тож вона блищить на грані, а не ховається в ній. Острів знизу
  // значно товщий, тож крізь нього іскри не просвічують.
  const sparkLift = useMemo(() => Math.max(0, ...model.children.map((c) => c.radius)) * 1.15, [model]);
  const sparkMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColour: { value: linearColour(rgb).lerp(new THREE.Color(1, 1, 1), 0.7) },
      uLift: { value: sparkLift },
      uSize: { value: 0.07 },
      // Половина висоти буфера в пікселях — як `sizeAttenuation` у three.
      uHalfHeight: { value: 400 },
      uOpacity: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform float uLift;
      uniform float uSize;
      uniform float uHalfHeight;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        // Одиниці моделі → одиниці виду: група масштабована.
        float scale = length(modelViewMatrix[0].xyz);
        mv.xyz += normalize(-mv.xyz) * uLift * scale;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * scale * uHalfHeight / -mv.z;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uOpacity;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.2, r) * uOpacity;
        gl_FragColor = vec4(uColour * a, a);
      }
    `,
  }), [rgb, sparkLift]);

  /*
   * М'яке сяйво (ADR-0259, власник: «м'яке сяйво»): ореол кольору колонії за
   * монархом. Один квадрат, завжди обличчям до камери, з радіальним спадом;
   * додається до кадру й не пише глибину, а тест глибини ховає його за
   * гранями, що ближче, — тож він світить ДОВКОЛА силуету, а не поверх
   * каменю. Сила — від сяйва моделі (медіа, ADR-0217) і теми: на світлому
   * небі він тихіший.
   */
  const haloStrength = (theme === 'dark' ? 0.5 : 0.3) * (0.6 + 0.4 * glow);
  const haloSize = useMemo(() => [geometry.reach * 1.25, geometry.height * 0.75] as const, [geometry]);
  const haloMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColour: { value: linearColour(rgb) },
      uSize: { value: new THREE.Vector2(haloSize[0], haloSize[1]) },
      uStrength: { value: haloStrength },
      uPulse: { value: 1 },
    },
    vertexShader: /* glsl */ `
      uniform vec2 uSize;
      varying vec2 vUv;
      void main() {
        vec4 mv = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float scale = length(modelViewMatrix[0].xyz);
        mv.xy += position.xy * uSize * scale;
        vUv = position.xy;
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      uniform float uPulse;
      varying vec2 vUv;
      void main() {
        float r = length(vUv);
        float a = pow(1.0 - smoothstep(0.0, 1.0, r), 2.2) * uStrength * uPulse;
        gl_FragColor = vec4(uColour * a, a);
      }
    `,
  }), [rgb, haloStrength, haloSize]);
  const haloQuad = useMemo(() => new THREE.PlaneGeometry(2, 2), []);

  /*
   * Легкі частинки навколо кристала (ADR-0260, концепт власника). Сорок
   * порошинок кольору каменю повільно піднімаються довкола колонії й гаснуть
   * угорі. Місця — з хешу дати пари, рух — у шейдері від часу; зменшений рух
   * (§47) лишає їх нерухомими.
   */
  const motes = useMemo(() => {
    const COUNT = 40;
    const data = new Float32Array(COUNT * 3);
    const phase = new Float32Array(COUNT);
    for (let k = 0; k < COUNT; k += 1) {
      const a = unit(model.startDate, `mote${k}:a`) * Math.PI * 2;
      const d = geometry.reach * (0.35 + 0.75 * unit(model.startDate, `mote${k}:d`));
      data.set([Math.cos(a) * d, 0, Math.sin(a) * d], k * 3);
      phase[k] = unit(model.startDate, `mote${k}:y`);
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute('position', new THREE.BufferAttribute(data, 3));
    buffer.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
    return buffer;
  }, [model.startDate, geometry.reach]);
  const moteMaterial = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColour: { value: linearColour(rgb).lerp(new THREE.Color(1, 0.95, 0.98), 0.45) },
      uTime: { value: 0 },
      uRise: { value: geometry.height * 1.15 },
      uSize: { value: 0.06 },
      uHalfHeight: { value: 400 },
      uStrength: { value: theme === 'dark' ? 1.0 : 0.8 },
      uLift: { value: 0 },
      uBurst: { value: 0 },
    },
    vertexShader: /* glsl */ `
      attribute float phase;
      uniform float uTime;
      uniform float uLift;
      uniform float uBurst;
      uniform float uRise;
      uniform float uSize;
      uniform float uHalfHeight;
      varying float vFade;
      void main() {
        // Сплеск (ADR-0261): порошинки на мить пришвидшуються й світять яскравіше.
        float t = fract(phase + uTime * 0.025 + uLift);
        vec3 p = position + vec3(sin(uTime * 0.3 + phase * 6.28) * 0.05, t * uRise, cos(uTime * 0.25 + phase * 6.28) * 0.05);
        vFade = smoothstep(0.0, 0.15, t) * (1.0 - smoothstep(0.6, 1.0, t));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float scale = length(modelViewMatrix[0].xyz);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * scale * uHalfHeight / -mv.z * (0.6 + 0.8 * fract(phase * 7.0)) * (1.0 + 1.6 * uBurst);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      uniform float uStrength;
      uniform float uBurst;
      varying float vFade;
      void main() {
        float r = length(gl_PointCoord - 0.5) * 2.0;
        float a = smoothstep(1.0, 0.0, r) * vFade * uStrength * (1.0 + 3.0 * uBurst);
        gl_FragColor = vec4(uColour * a, a);
      }
    `,
  }), [rgb, theme, geometry.height]);

  useEffect(() => () => {
    motes.dispose();
    moteMaterial.dispose();
  }, [motes, moteMaterial]);

  useEffect(() => () => {
    haloQuad.dispose();
    haloMaterial.dispose();
  }, [haloQuad, haloMaterial]);

  useEffect(() => () => {
    crystals.dispose();
    rocks.dispose();
    sparks?.dispose();
  }, [crystals, rocks, sparks]);
  useEffect(() => () => {
    crystalMaterial.dispose();
    rockMaterial.dispose();
    sparkMaterial.dispose();
  }, [crystalMaterial, rockMaterial, sparkMaterial]);

  // Дихання сяйва — повільне й мале: живе, а не блимає. Зменшений рух (§47)
  // лишає його сталим.
  const halfHeight = useThree((state) => (state.size.height * state.viewport.dpr) / 2);
  useEffect(() => { sparkMaterial.uniforms.uHalfHeight!.value = halfHeight; }, [sparkMaterial, halfHeight]);
  useEffect(() => { moteMaterial.uniforms.uHalfHeight!.value = halfHeight; }, [moteMaterial, halfHeight]);

  /*
   * Відгук на нове (ADR-0261): розклад — від видів подій, час — від першого
   * кадру після монтування. Зменшений рух (§47) лишає кристал тихим: це
   * рух, і він не несе інформації, якої немає в підписі «N нових митей».
   */
  const timeline = useMemo(() => celebrationTimeline(celebrate), [celebrate]);
  const celebrationStart = useRef<number | null>(null);
  const moteLift = useRef(0);
  useFrame(({ clock }, delta) => {
    const playing = timeline.length > 0 && (!reduceMotion || celebrateAt !== undefined);
    if (playing) {
      if (celebrationStart.current === null) celebrationStart.current = clock.getElapsedTime();
      const t = celebrateAt ?? clock.getElapsedTime() - celebrationStart.current;
      const now = t <= celebrationEnd(timeline) ? celebrationAt(timeline, t) : null;
      const u = crystalMaterial.uniforms;
      u.uWave!.value = now?.wave ?? 0;
      u.uWaveAt!.value = now?.waveAt ?? 0;
      u.uCrown!.value = now?.crown ?? 0;
      u.uFlush!.value = now?.flush ?? 0;
      haloMaterial.uniforms.uStrength!.value = haloStrength * (1 + 1.2 * (now?.flush ?? 0));
      moteMaterial.uniforms.uBurst!.value = now?.burst ?? 0;
      if (celebrateAt === undefined) moteLift.current += delta * 0.35 * (now?.burst ?? 0);
      moteMaterial.uniforms.uLift!.value = celebrateAt === undefined ? moteLift.current : 0;
    }
    if (reduceMotion) return;
    const t = clock.getElapsedTime();
    const value = 0.85 + 0.15 * Math.sin(t * 0.9);
    const pulse = crystalMaterial.uniforms.uPulse;
    if (pulse) pulse.value = value;
    haloMaterial.uniforms.uPulse!.value = 0.9 + 0.1 * Math.sin(t * 0.9);
    moteMaterial.uniforms.uTime!.value = t;
    crystalMaterial.uniforms.uTime!.value = t;
    sparkMaterial.uniforms.uOpacity!.value = 0.7 + 0.3 * Math.sin(t * 1.7);
  });

  return (
    <group position={[0, CRYSTAL_GROUND_BASELINE, 0]} scale={scale}>
      <mesh geometry={rocks} material={rockMaterial} castShadow />
      {/* Суцільний гранчастий кристал (ADR-0227); іскри віх — після нього. */}
      <mesh geometry={crystals} material={crystalMaterial} castShadow />
      {sparks && <points geometry={sparks} material={sparkMaterial} renderOrder={2} />}
      <mesh geometry={haloQuad} material={haloMaterial} position={[0, geometry.height * 0.55, 0]} renderOrder={1} frustumCulled={false} />
      <points geometry={motes} material={moteMaterial} renderOrder={3} frustumCulled={false} />
    </group>
  );
}
