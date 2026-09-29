import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { unit } from '@/engine/species/crystalV2/hash';
import type { ReefV2Geometry } from '@/engine/species/reefV2/geometry';
import { Diorama } from '@/features/home/diorama/Diorama';
import { PORTAL_GROUND_Y } from '../../crystal3d/scene/portalScene';
import { ReefIsland } from './ReefIsland';
import { buildReefIsland, inReefWater, reefIslandGround } from './reefIsland';
import {
  REEF_PALETTES,
  createCoralMaterial,
  createCritterMaterial,
  createFishMaterial,
  createGlowMaterial,
  createSeabedMaterial,
  createSeagrassMaterial,
} from './reefV2Materials';

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
  /** Радіус острівця діорами в одиницях сцени (ADR-0220). */
  island: number;
  /** Без діорами й оточення — острівець на тлі входу (ADR-0228). */
  bare?: boolean;
  /** Радіус кам'яної голови рифу в одиницях сцени. */
  rockRadius: number;
  /** Колір каменю замість рифового: базальт вулкана (ADR-0235). */
  rockColour?: string;
  /** Арка, лагуна й стоячі камені острова; вулкан їх вимикає (ADR-0235). */
  islandArch?: boolean;
  islandLagoon?: boolean;
  islandStones?: boolean;
  /**
   * Свій матеріал каменю й жар кожної його вершини (вулкан, ADR-0235).
   * Матеріалом володіє той, хто його передав: тут він не звільняється.
   */
  rockMaterial?: THREE.ShaderMaterial;
  rockHeat?: Float32Array;
  /** Висота морської трави: на плато вулкана вона нижча, щоб не затуляти конус. */
  seagrassScale?: number;
}

/**
 * Глибина: товща води, дно, камінь рифу, корали, мешканці й зграя.
 * Земля — на тій самій лінії, що й острів кристала (`PORTAL_GROUND_Y`),
 * тож камера й жести порталу ті самі.
 */
export function ReefV2World({ seed, geometry, scale, theme, reduceMotion, island, rockRadius, bare = false, rockColour, islandArch = true, islandLagoon = true, islandStones = true, rockMaterial, rockHeat, seagrassScale = 1 }: ReefV2WorldProps) {
  const palette = REEF_PALETTES[theme];

  const rock = useMemo(
    () => tonedGeometry(geometry.rock.positions, rockHeat ? { tone: geometry.rock.tone, heat: rockHeat } : { tone: geometry.rock.tone }),
    [geometry, rockHeat],
  );
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
  // Бульбашки піднімаються з лагуни острова (ADR-0223) і з двох щілин біля неї.
  const built = useMemo(
    () => buildReefIsland(seed, island, rockRadius, { arch: islandArch, lagoon: islandLagoon, stones: islandStones }),
    [seed, island, rockRadius, islandArch, islandLagoon, islandStones],
  );
  const lagoon = built.lagoon;
  const water = built.water;
  const bubbles = useMemo(() => {
    const out: number[] = [];
    for (let k = 0; k < 18; k += 1) {
      const a = unit(seed, `bubble${k}:a`) * Math.PI * 2;
      const r = lagoon.r * Math.sqrt(unit(seed, `bubble${k}:r`));
      out.push(lagoon.x + Math.cos(a) * r, 0.02, lagoon.z + Math.sin(a) * r);
    }
    return pointsGeometry(out, seed, 'bubble');
  }, [seed, lagoon]);

  const materials = useMemo(() => {
    const ground = PORTAL_GROUND_Y;
    return {
      rock: createSeabedMaterial(palette, rockColour ?? palette.rock, ground),
      star: createSeabedMaterial(palette, '#ff9a5a', ground),
      corals: createCoralMaterial(palette, ground),
      critters: createCritterMaterial(palette, ground),
      grass: createSeagrassMaterial(palette, ground),
      fish: createFishMaterial(palette, ground),
      pearls: createGlowMaterial('#fff4d6', 1.4, 0.18, 'still'),
      snow: createGlowMaterial(palette.snow, palette.snowStrength, 0.05, 'snow'),
      bubbles: createGlowMaterial('#e6fbff', 0.6, 0.07, 'bubbles'),
    };
  }, [palette, rockColour]);

  const grassRef = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const mesh = grassRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    // Морська трава моделі сягає далі за острівець: стискаємо радіально
    // між підніжжям рифу й краєм острівця (ADR-0220).
    const inner = rockRadius * 1.02;
    const outerModel = (rockRadius / scale) * 1.02 + 2.2;
    geometry.seagrass.forEach((p, i) => {
      const r = Math.hypot(p[0], p[2]) * scale;
      const squeezed = inner + ((r - inner) * (island * 0.9 - inner)) / Math.max(1e-6, outerModel * scale - inner);
      const k = squeezed / Math.max(1e-6, r);
      // Трава стоїть на куполі верхівки острова (ADR-0223).
      dummy.position.set(p[0] * scale * k, reefIslandGround(island, squeezed) - 0.005, p[2] * scale * k);
      dummy.rotation.set(0, unit(seed, `grass${i}:turn`) * Math.PI * 2, 0);
      // Трава не росте з води лагуни: там вона стирчала з бірюзи.
      const wet = inReefWater(water, p[0] * scale * k, p[2] * scale * k, 0.03);
      dummy.scale.setScalar(wet ? 0 : (0.14 + 0.2 * unit(seed, `grass${i}:h`)) * seagrassScale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [geometry, scale, seed, island, rockRadius, water, seagrassScale]);

  useEffect(() => () => {
    for (const g of [rock, corals, critters, starfish, pearls, fish, tuft, snow, bubbles]) g?.dispose();
  }, [rock, corals, critters, starfish, pearls, fish, tuft, snow, bubbles]);
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
      {!bare && <Diorama species="reef" theme={theme} seed={seed} radius={island} groundY={PORTAL_GROUND_Y} reduceMotion={reduceMotion} base={false} />}
      <ReefIsland bare={bare} arch={islandArch} lagoon={islandLagoon} stones={islandStones} seed={seed} theme={theme} radius={island} rock={rockRadius} groundY={PORTAL_GROUND_Y} reduceMotion={reduceMotion} />
      <group position={[0, PORTAL_GROUND_Y, 0]}>
        {geometry.seagrass.length > 0 && (
          <instancedMesh ref={grassRef} args={[tuft, materials.grass, geometry.seagrass.length]} frustumCulled={false} />
        )}
        <points geometry={snow} material={materials.snow} frustumCulled={false} />
        <points geometry={bubbles} material={materials.bubbles} frustumCulled={false} />
        <group scale={scale}>
          <mesh geometry={rock} material={rockMaterial ?? materials.rock} />
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
