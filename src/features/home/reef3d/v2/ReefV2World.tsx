import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { unit } from '@/engine/species/crystalV2/hash';
import type { ReefV2Geometry } from '@/engine/species/reefV2/geometry';
import { PORTAL_GROUND_Y } from '../../crystal3d/scene/portalScene';
import {
  REEF_PALETTES,
  createCoralMaterial,
  createCritterMaterial,
  createFishMaterial,
  createGlowMaterial,
  createSeabedMaterial,
  createSeagrassMaterial,
  createWaterDomeMaterial,
} from './reefV2Materials';

const FOG_NEAR = 4;
const FOG_FAR = 26;
const SEABED_RINGS = [0.6, 1.4, 2.4, 3.6, 5, 7, 10, 15, 24, 40];

/** Дно: кільця клаптів із пологими дюнами; центр — на лінії землі. */
function buildSeabed(seed: string) {
  const out: number[] = [];
  const tone: number[] = [];
  const SEG = 40;
  const point = (i: number, j: number): number[] => {
    const r = i === 0 ? 0 : SEABED_RINGS[i - 1]!;
    const a = ((j + (i % 2) * 0.5) / SEG) * Math.PI * 2;
    const dune = i < 2 ? 0 : Math.sin(a * 3 + r * 0.7) * 0.05 + (unit(seed, `sand${i}:${j}`) - 0.5) * 0.04;
    return [Math.cos(a) * r, dune - 0.02, Math.sin(a) * r];
  };
  for (let i = 0; i < SEABED_RINGS.length; i += 1) {
    for (let j = 0; j < SEG; j += 1) {
      const k = (j + 1) % SEG;
      const a = point(i, j);
      const b = point(i, k);
      const c = point(i + 1, j);
      const d = point(i + 1, k);
      const t1 = 0.9 + 0.2 * unit(seed, `sand${i}:${j}:t1`);
      const t2 = 0.9 + 0.2 * unit(seed, `sand${i}:${j}:t2`);
      out.push(...a, ...d, ...c);
      tone.push(t1, t1, t1);
      if (i > 0) {
        out.push(...a, ...b, ...d);
        tone.push(t2, t2, t2);
      }
    }
  }
  return { positions: new Float32Array(out), tone: new Float32Array(tone) };
}

/** Риба: ромб тіла й трикутник хвоста; голова вздовж +x. */
function buildFishGeometry(fish: ReefV2Geometry['fish'], seed: string) {
  const body = new Float32Array([
    1, 0, 0, -0.3, 0.45, 0, -0.3, -0.45, 0,
    -0.3, 0.45, 0, -0.3, -0.45, 0, -0.35, 0, 0.12,
    -0.3, 0, 0, -0.95, 0.35, 0, -0.95, -0.35, 0,
  ]);
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(body, 3));
  const attr = (name: string, values: number[]) => g.setAttribute(name, new THREE.InstancedBufferAttribute(new Float32Array(values), 1));
  attr('aOrbit', fish.map((f) => f.orbit));
  attr('aHeight', fish.map((f) => f.height));
  attr('aPhase', fish.map((f) => f.phase));
  attr('aSpeed', fish.map((f) => f.speed));
  attr('aKind', fish.map((_, k) => Math.floor(unit(seed, `fish${k}:kind`) * 3)));
  g.instanceCount = fish.length;
  return g;
}

function pointsGeometry(positions: number[], seed: string, tag: string) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  g.setAttribute('seed', new THREE.BufferAttribute(new Float32Array(positions.length / 3).map((_, i) => unit(seed, `${tag}${i}`)), 1));
  return g;
}

function tonedGeometry(positions: Float32Array, attributes: Record<string, Float32Array>) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  for (const [name, values] of Object.entries(attributes)) g.setAttribute(name, new THREE.BufferAttribute(values, 1));
  g.computeBoundingSphere();
  return g;
}

interface ReefV2WorldProps {
  seed: string;
  geometry: ReefV2Geometry;
  scale: number;
  theme: 'light' | 'dark';
  reduceMotion: boolean;
}

/**
 * Глибина: товща води, дно, камінь рифу, корали, мешканці й зграя.
 * Земля — на тій самій лінії, що й острів кристала (`PORTAL_GROUND_Y`),
 * тож камера й жести порталу ті самі.
 */
export function ReefV2World({ seed, geometry, scale, theme, reduceMotion }: ReefV2WorldProps) {
  const palette = REEF_PALETTES[theme];

  const seabed = useMemo(() => {
    const mesh = buildSeabed(seed);
    return tonedGeometry(mesh.positions, { tone: mesh.tone });
  }, [seed]);
  const rock = useMemo(() => tonedGeometry(geometry.rock.positions, { tone: geometry.rock.tone }), [geometry]);
  const corals = useMemo(() => tonedGeometry(geometry.corals.positions, {
    tone: geometry.corals.tone, form: geometry.corals.form, hue: geometry.corals.hue, rise: geometry.corals.rise,
  }), [geometry]);
  const critters = useMemo(
    () => (geometry.critters.positions.length ? tonedGeometry(geometry.critters.positions, { channel: geometry.critters.channel }) : null),
    [geometry],
  );
  const starfish = useMemo(
    () => (geometry.starfish.positions.length ? tonedGeometry(geometry.starfish.positions, { tone: geometry.starfish.tone }) : null),
    [geometry],
  );
  const pearls = useMemo(
    () => (geometry.pearls.length ? pointsGeometry(Array.from(geometry.pearls), seed, 'pearl') : null),
    [geometry, seed],
  );
  const fish = useMemo(() => (geometry.fish.length ? buildFishGeometry(geometry.fish, seed) : null), [geometry, seed]);
  const tuft = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.04, 0, 0, 0.04, 0, 0, 0.02, 1, 0.03,
      0, 0, -0.04, 0, 0, 0.04, -0.03, 0.85, 0.01,
    ]), 3));
    return g;
  }, []);
  // Морський сніг у товщі довкола рифу і бульбашки з кількох джерел на дні.
  const snow = useMemo(() => {
    const out: number[] = [];
    for (let k = 0; k < 160; k += 1) {
      const a = unit(seed, `snow${k}:a`) * Math.PI * 2;
      const r = 0.6 + 6 * unit(seed, `snow${k}:r`);
      out.push(Math.cos(a) * r, unit(seed, `snow${k}:y`) * 4, Math.sin(a) * r);
    }
    return pointsGeometry(out, seed, 'snow');
  }, [seed]);
  const bubbles = useMemo(() => {
    const out: number[] = [];
    for (let k = 0; k < 18; k += 1) {
      const vent = Math.floor(unit(seed, `bubble${k}:v`) * 3);
      const a = unit(seed, `vent${vent}:a`) * Math.PI * 2;
      const r = 1.6 + unit(seed, `vent${vent}:r`) * 1.5;
      out.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    return pointsGeometry(out, seed, 'bubble');
  }, [seed]);

  const materials = useMemo(() => {
    const ground = PORTAL_GROUND_Y;
    return {
      dome: createWaterDomeMaterial(palette),
      sand: createSeabedMaterial(palette, palette.sand, FOG_NEAR, FOG_FAR, ground),
      rock: createSeabedMaterial(palette, palette.rock, FOG_NEAR, FOG_FAR, ground),
      star: createSeabedMaterial(palette, '#ff9a5a', FOG_NEAR, FOG_FAR, ground),
      corals: createCoralMaterial(palette, FOG_NEAR, FOG_FAR, ground),
      critters: createCritterMaterial(palette, FOG_NEAR, FOG_FAR, ground),
      grass: createSeagrassMaterial(palette, FOG_NEAR, FOG_FAR, ground),
      fish: createFishMaterial(palette, FOG_NEAR, FOG_FAR, ground),
      pearls: createGlowMaterial('#fff4d6', 1.4, 0.18, 'still'),
      snow: createGlowMaterial(palette.snow, palette.snowStrength, 0.05, 'snow'),
      bubbles: createGlowMaterial('#e6fbff', 0.6, 0.07, 'bubbles'),
    };
  }, [palette]);

  const grassRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = grassRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    geometry.seagrass.forEach((p, i) => {
      dummy.position.set(p[0] * scale, 0, p[2] * scale);
      dummy.rotation.set(0, unit(seed, `grass${i}:turn`) * Math.PI * 2, 0);
      dummy.scale.setScalar(0.14 + 0.2 * unit(seed, `grass${i}:h`));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [geometry, scale, seed]);

  useEffect(() => () => {
    for (const g of [seabed, rock, corals, critters, starfish, pearls, fish, tuft, snow, bubbles]) g?.dispose();
  }, [seabed, rock, corals, critters, starfish, pearls, fish, tuft, snow, bubbles]);
  useEffect(() => () => {
    for (const m of Object.values(materials)) m.dispose();
  }, [materials]);

  useFrame(({ clock, size }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    for (const m of Object.values(materials)) {
      if (m.uniforms.uTime) m.uniforms.uTime.value = t;
      if (m.uniforms.uScale && m !== materials.fish) m.uniforms.uScale.value = size.height;
      if (m.uniforms.uSway) m.uniforms.uSway.value = reduceMotion ? 0 : 1;
    }
    materials.fish.uniforms.uScale!.value = 1 / Math.max(0.4, scale);
  });

  return (
    <>
      <mesh material={materials.dome} renderOrder={-10} frustumCulled={false}>
        <sphereGeometry args={[80, 32, 20]} />
      </mesh>
      <group position={[0, PORTAL_GROUND_Y, 0]}>
        <mesh geometry={seabed} material={materials.sand} />
        {geometry.seagrass.length > 0 && (
          <instancedMesh ref={grassRef} args={[tuft, materials.grass, geometry.seagrass.length]} frustumCulled={false} />
        )}
        <points geometry={snow} material={materials.snow} frustumCulled={false} />
        <points geometry={bubbles} material={materials.bubbles} frustumCulled={false} />
        <group scale={scale}>
          <mesh geometry={rock} material={materials.rock} />
          <mesh geometry={corals} material={materials.corals} />
          {critters && <mesh geometry={critters} material={materials.critters} />}
          {starfish && <mesh geometry={starfish} material={materials.star} />}
          {pearls && <points geometry={pearls} material={materials.pearls} />}
          {fish && <mesh geometry={fish} material={materials.fish} frustumCulled={false} />}
        </group>
      </group>
    </>
  );
}
