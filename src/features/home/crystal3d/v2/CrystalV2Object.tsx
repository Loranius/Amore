import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
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
  const sparkMaterial = useMemo(() => new THREE.PointsMaterial({
    color: linearColour(rgb).lerp(new THREE.Color(1, 1, 1), 0.7),
    size: 0.07,
    sizeAttenuation: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }), [rgb]);

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
  useFrame(({ clock }) => {
    if (reduceMotion) return;
    const t = clock.getElapsedTime();
    const pulse = crystalMaterial.uniforms.uPulse;
    if (pulse) pulse.value = 0.85 + 0.15 * Math.sin(t * 0.9);
    sparkMaterial.opacity = 0.7 + 0.3 * Math.sin(t * 1.7);
  });

  return (
    <group position={[0, CRYSTAL_GROUND_BASELINE, 0]} scale={scale}>
      <mesh geometry={rocks} material={rockMaterial} />
      <mesh geometry={crystals} material={crystalMaterial} />
      {sparks && <points geometry={sparks} material={sparkMaterial} />}
    </group>
  );
}
