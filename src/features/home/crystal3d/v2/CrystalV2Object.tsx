import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CrystalV2Geometry } from '@/engine/species/crystalV2/geometry';
import type { CrystalV2Model } from '@/engine/species/crystalV2/model';
import { CRYSTAL_GROUND_BASELINE } from '@/engine/renderer/three';
import { createCrystalV2Material, createGeodeMaterial, linearColour } from './crystalV2Material';

interface CrystalV2ObjectProps {
  model: CrystalV2Model;
  geometry: CrystalV2Geometry;
  scale: number;
  theme: 'light' | 'dark';
  reduceMotion: boolean;
}

/**
 * Колонія, жеода й іскри віх — три виклики малювання на весь кристал.
 *
 * Стоїть на тій самій лінії землі, що й старий артефакт
 * (`CRYSTAL_GROUND_BASELINE`), тож острів, храм і вода порталу не знають,
 * котра зі сцен кристала зараз у них стоїть.
 */
export function CrystalV2Object({ model, geometry, scale, theme, reduceMotion }: CrystalV2ObjectProps) {
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
    buffer.setAttribute('tone', new THREE.BufferAttribute(geometry.rocks.tone, 1));
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

  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const t = clock.getElapsedTime();
    const value = 0.85 + 0.15 * Math.sin(t * 0.9);
    const pulse = crystalMaterial.uniforms.uPulse;
    if (pulse) pulse.value = value;
    sparkMaterial.uniforms.uOpacity!.value = 0.7 + 0.3 * Math.sin(t * 1.7);
  });

  return (
    <group position={[0, CRYSTAL_GROUND_BASELINE, 0]} scale={scale}>
      <mesh geometry={rocks} material={rockMaterial} />
      {/* Суцільний гранчастий кристал (ADR-0227); іскри віх — після нього. */}
      <mesh geometry={crystals} material={crystalMaterial} />
      {sparks && <points geometry={sparks} material={sparkMaterial} renderOrder={2} />}
    </group>
  );
}
