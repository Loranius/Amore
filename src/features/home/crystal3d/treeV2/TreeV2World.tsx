import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { unit } from '@/engine/species/crystalV2/hash';
import type { TreeV2Geometry } from '@/engine/species/treeV2/geometry';
import { PORTAL_GROUND_Y } from '../scene/portalScene';
import { buildGrassTuft, buildMeadow, grassInstances, meadowHeight } from './meadow';
import {
  FLOWER_COLOURS,
  MEADOW_PALETTES,
  createBlossomMaterial,
  createGlowPointsMaterial,
  createGrassMaterial,
  createGroundMaterial,
  createLeafMaterial,
  createSkyMaterial,
  createWoodMaterial,
} from './treeV2Materials';

const FOG_NEAR = 9;
const FOG_FAR = 48;

function toneGeometry(positions: Float32Array, tone: Float32Array, extra?: Record<string, Float32Array>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  g.setAttribute('tone', new THREE.BufferAttribute(tone, 1));
  for (const [name, values] of Object.entries(extra ?? {})) g.setAttribute(name, new THREE.BufferAttribute(values, 1));
  g.computeBoundingSphere();
  return g;
}

function pointsGeometry(positions: Float32Array, seed: string, tag: string) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const seeds = new Float32Array(positions.length / 3).map((_, i) => unit(seed, `${tag}${i}`));
  g.setAttribute('seed', new THREE.BufferAttribute(seeds, 1));
  g.computeBoundingSphere();
  return g;
}

/** Польові квіти вихідних: крихітні октаедри над травою, колір за індексом. */
function flowerGeometry(positions: Float32Array, tint: Float32Array, scale: number) {
  const out: number[] = [];
  const channel: number[] = [];
  const s = 0.045;
  const octa = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
  for (let k = 0; k < tint.length; k += 1) {
    const x = positions[k * 3]!;
    const z = positions[k * 3 + 2]!;
    // Купол лугу опускається від дерева: квітка стоїть на ЗЕМЛІ під собою,
    // а не на висоті центру (перший кадр показав їх у повітрі).
    const ground = meadowHeight(Math.hypot(x, z) * scale) / scale;
    for (const face of faces) {
      for (const i of face) {
        const v = octa[i]!;
        out.push(x + v[0]! * s, ground + 0.07 + v[1]! * s * 0.35, z + v[2]! * s);
        channel.push(tint[k]!);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(out), 3));
  g.setAttribute('channel', new THREE.BufferAttribute(new Float32Array(channel), 1));
  return g;
}

interface TreeV2WorldProps {
  seed: string;
  geometry: TreeV2Geometry;
  /** Одиниці моделі → одиниці сцени (див. `treeV2Frame`). */
  scale: number;
  theme: 'light' | 'dark';
  reduceMotion: boolean;
}

/**
 * Луг, небо, пагорби, трава — і дерево на них.
 *
 * Земля стоїть на тій самій лінії, що й острів кристала
 * (`PORTAL_GROUND_Y`), тож камера порталу кадрує дерево тими самими
 * правилами, що й кристал, і жест повороту той самий.
 */
export function TreeV2World({ seed, geometry, scale, theme, reduceMotion }: TreeV2WorldProps) {
  const palette = MEADOW_PALETTES[theme];

  // ── Світ (не залежить від дерева) ────────────────────────
  const meadow = useMemo(() => {
    const mesh = buildMeadow(seed);
    return toneGeometry(mesh.positions, mesh.tone);
  }, [seed]);
  const clear = Math.max(0.25, geometry.height * scale * 0.06);
  const grass = useMemo(() => grassInstances(seed, clear), [seed, clear]);
  const tuft = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buildGrassTuft(), 3));
    return g;
  }, []);
  const grassRef = useRef<THREE.InstancedMesh>(null);

  // ── Дерево ──────────────────────────────────────────────
  const wood = useMemo(() => toneGeometry(geometry.wood.positions, geometry.wood.tone), [geometry]);
  const leaves = useMemo(
    () => toneGeometry(geometry.leaves.positions, geometry.leaves.tone, { autumn: geometry.leaves.autumn }),
    [geometry],
  );
  const blossoms = useMemo(() => {
    if (geometry.blossoms.positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(geometry.blossoms.positions, 3));
    g.setAttribute('channel', new THREE.BufferAttribute(geometry.blossoms.channel, 1));
    return g;
  }, [geometry]);
  const flowers = useMemo(
    () => (geometry.flowers.tint.length > 0 ? flowerGeometry(geometry.flowers.positions, geometry.flowers.tint, scale) : null),
    [geometry, scale],
  );
  const fruits = useMemo(
    () => (geometry.fruits.length > 0 ? pointsGeometry(geometry.fruits, seed, 'fruit') : null),
    [geometry, seed],
  );
  const fireflies = useMemo(
    () => (geometry.fireflies.length > 0 ? pointsGeometry(geometry.fireflies, seed, 'fly') : null),
    [geometry, seed],
  );

  // ── Матеріали ───────────────────────────────────────────
  const materials = useMemo(() => ({
    sky: createSkyMaterial(palette),
    meadow: createGroundMaterial(palette, FOG_NEAR, FOG_FAR, palette.ground),
    grass: createGrassMaterial(palette, FOG_NEAR, FOG_FAR),
    wood: createWoodMaterial(palette, FOG_NEAR, FOG_FAR),
    leaves: createLeafMaterial(palette, FOG_NEAR, FOG_FAR, PORTAL_GROUND_Y),
    blossoms: createBlossomMaterial(),
    flowers: createBlossomMaterial(FLOWER_COLOURS),
    fruits: createGlowPointsMaterial('#ffc94a', 1.3, 0.3, false),
    fireflies: createGlowPointsMaterial(palette.firefly, palette.fireflyStrength, 0.12, true),
  }), [palette]);

  useEffect(() => {
    const mesh = grassRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    grass.forEach((g, i) => {
      dummy.position.set(g.x, g.y, g.z);
      dummy.rotation.set(0, g.turn, 0);
      dummy.scale.setScalar(g.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Сфера відсікання — ПІСЛЯ матриць (урок старого лугу: інакше вона
    // завбільшки з одну травинку і весь луг зникає з кадру).
    mesh.computeBoundingSphere();
  }, [grass]);

  useEffect(() => () => {
    for (const g of [meadow, tuft, wood, leaves, blossoms, flowers, fruits, fireflies]) g?.dispose();
  }, [meadow, tuft, wood, leaves, blossoms, flowers, fruits, fireflies]);
  useEffect(() => () => {
    for (const m of Object.values(materials)) m.dispose();
  }, [materials]);

  useFrame(({ clock, size }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    const wind = reduceMotion ? 0 : 1;
    for (const m of [materials.leaves, materials.grass]) {
      m.uniforms.uTime!.value = t;
      m.uniforms.uWind!.value = wind;
    }
    for (const m of [materials.fireflies, materials.fruits]) {
      m.uniforms.uTime!.value = t;
      m.uniforms.uScale!.value = size.height;
    }
  });

  return (
    <>
      <mesh material={materials.sky} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[80, 24, 16]} />
      </mesh>
      <group position={[0, PORTAL_GROUND_Y, 0]}>
        <mesh geometry={meadow} material={materials.meadow} />
        <instancedMesh ref={grassRef} args={[tuft, materials.grass, grass.length]} frustumCulled={false} />
        <group scale={scale}>
          <mesh geometry={wood} material={materials.wood} />
          <mesh geometry={leaves} material={materials.leaves} />
          {blossoms && <mesh geometry={blossoms} material={materials.blossoms} />}
          {flowers && <mesh geometry={flowers} material={materials.flowers} />}
          {fruits && <points geometry={fruits} material={materials.fruits} />}
          {fireflies && <points geometry={fireflies} material={materials.fireflies} />}
        </group>
      </group>
    </>
  );
}
