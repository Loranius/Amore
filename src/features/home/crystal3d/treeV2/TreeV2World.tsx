import { softNormals, softScalar } from '@/features/home/diorama/softNormals';
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { unit } from '@/engine/species/crystalV2/hash';
import type { TreeForm, TreeV2Geometry } from '@/engine/species/treeV2/geometry';
import { PORTAL_GROUND_Y } from '../scene/portalScene';
import { Diorama } from '@/features/home/diorama/Diorama';
import { buildGrassTuft, clearGrassFromRoots, grassInstances, tuckGrassUnderCanopy } from './meadow';
import { TreeIsland } from './TreeIsland';
import { treeIslandBase, treeIslandGround } from './treeIsland';
import {
  FLOWER_COLOURS,
  TREE_FORM_LEAVES,
  TREE_PALETTES,
  createBlossomMaterial,
  createWishMaterial,
  createGlowPointsMaterial,
  createGrassMaterial,
  createLeafMaterial,
  createWoodMaterial,
} from './treeV2Materials';

/** Кулачки листя згладжуються цілком; гострі складки «спідничок» ялини лишаються. */
const LEAF_CREASE_DEG = 65;

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
function flowerGeometry(positions: Float32Array, tint: Float32Array, scale: number, island: number, outer: number) {
  const out: number[] = [];
  const channel: number[] = [];
  const s = 0.045;
  const octa = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const faces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
  for (let k = 0; k < tint.length; k += 1) {
    // Квіти моделі розкидані ширше за острів: вони стискаються радіально
    // до його краю (ADR-0220), порядок і густота лишаються ті самі.
    const squeeze = Math.min(1, (island * 0.88) / Math.max(1e-6, outer * scale));
    const x = positions[k * 3]! * squeeze;
    const z = positions[k * 3 + 2]! * squeeze;
    // Квітка стоїть на куполі трави (ADR-0222), а не на рівній землі.
    // Група дерева піднята на пласку середину купола — віднімаємо підйом.
    const ground = (0.03 + treeIslandGround(island, Math.hypot(x, z) * scale) - treeIslandBase(island)) / scale;
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
  /** Радіус острівця діорами в одиницях сцени (ADR-0220). */
  island: number;
  /** Без діорами й оточення — острівець на тлі входу (ADR-0228). */
  bare?: boolean;
  /** Форма дерева: колір крони (ADR-0237). Геометрію форми вже несе `geometry`. */
  form?: TreeForm;
  /** Дотик по самому дереву (не по острову) — хроніка росту (ADR-0238). */
  treeEvents?: {
    onPointerDown: (event: ThreeEvent<PointerEvent>) => void;
    onClick: (event: ThreeEvent<MouseEvent>) => void;
  } | undefined;
}

/**
 * Дерево на своєму острові (ADR-0222) у небі з хмарами й острівцями
 * (ADR-0224): тло діорами, острів, трава й квіти на куполі, дерево.
 *
 * Земля стоїть на тій самій лінії, що й острів кристала
 * (`PORTAL_GROUND_Y`), тож камера порталу кадрує дерево тими самими
 * правилами, що й кристал, і жест повороту той самий.
 */
export function TreeV2World({ seed, geometry, scale, theme, reduceMotion, island, bare = false, form = 'oak', treeEvents }: TreeV2WorldProps) {
  const palette = useMemo(
    () => (form === 'oak' ? TREE_PALETTES[theme] : { ...TREE_PALETTES[theme], ...TREE_FORM_LEAVES[form][theme] }),
    [form, theme],
  );

  // ── Світ (не залежить від дерева) ────────────────────────
  // Під самим стовбуром трави немає: густі пучки там читались «бахромою»
  // (власник, 2026-10-06); корені трава оминає (`clearGrassFromRoots`).
  const clear = Math.max(0.25, geometry.height * scale * 0.06, geometry.baseReach * scale);
  const grass = useMemo(
    () => clearGrassFromRoots(tuckGrassUnderCanopy(grassInstances(seed, clear, island * 0.85), geometry.leaves.positions, scale), geometry.buttresses, scale),
    [seed, clear, island, geometry, scale],
  );
  const tuft = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(buildGrassTuft(), 3));
    return g;
  }, []);
  const grassRef = useRef<THREE.InstancedMesh>(null);

  // ── Дерево ──────────────────────────────────────────────
  const wood = useMemo(() => {
    const g = toneGeometry(geometry.wood.positions, geometry.wood.tone);
    g.setAttribute('normal', new THREE.BufferAttribute(geometry.wood.normal, 3));
    return g;
  }, [geometry]);
  const leaves = useMemo(
    () => {
      const g = toneGeometry(geometry.leaves.positions, softScalar(geometry.leaves.positions, geometry.leaves.tone, LEAF_CREASE_DEG), { autumn: geometry.leaves.autumn });
      // Плавне світло на кулачках листя й «спідничках» ялини (власник, 2026-10-04).
      g.setAttribute('normal', new THREE.BufferAttribute(softNormals(geometry.leaves.positions, LEAF_CREASE_DEG), 3));
      return g;
    },
    [geometry],
  );
  const blossoms = useMemo(() => {
    if (geometry.wishes.positions.length === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(geometry.wishes.positions, 3));
    g.setAttribute('colour', new THREE.BufferAttribute(geometry.wishes.colour, 3));
    g.setAttribute('sway', new THREE.BufferAttribute(geometry.wishes.sway, 1));
    g.setAttribute('anchor', new THREE.BufferAttribute(geometry.wishes.anchor, 3));
    // Яблука й шишки — круглі на світлі; пелюстки пласкі й так.
    g.setAttribute('normal', new THREE.BufferAttribute(softNormals(geometry.wishes.positions, LEAF_CREASE_DEG), 3));
    return g;
  }, [geometry]);
  const flowers = useMemo(
    () => (geometry.flowers.tint.length > 0 ? flowerGeometry(geometry.flowers.positions, geometry.flowers.tint, scale, island, geometry.meadowRadius) : null),
    [geometry, scale, island],
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
    grass: createGrassMaterial(palette),
    wood: createWoodMaterial(palette),
    leaves: createLeafMaterial(palette, PORTAL_GROUND_Y),
    blossoms: createWishMaterial(PORTAL_GROUND_Y),
    flowers: createBlossomMaterial(FLOWER_COLOURS),
    // Плоди віх — ягоди, що світяться рожевим (власник, 2026-10-05).
    fruits: createGlowPointsMaterial('#ff8fc0', 1.3, 0.3, false),
    fireflies: createGlowPointsMaterial(palette.firefly, palette.fireflyStrength, 0.12, true),
  }), [palette]);

  useEffect(() => {
    const mesh = grassRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    grass.forEach((g, i) => {
      // Трава на куполі острова (ADR-0222): висота — з його форми.
      dummy.position.set(g.x, g.y + treeIslandGround(island, Math.hypot(g.x, g.z)) - 0.01, g.z);
      dummy.rotation.set(0, g.turn, 0);
      dummy.scale.setScalar(g.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    // Сфера відсікання — ПІСЛЯ матриць (урок старого лугу: інакше вона
    // завбільшки з одну травинку і весь луг зникає з кадру).
    mesh.computeBoundingSphere();
  }, [grass, island]);

  useEffect(() => () => {
    for (const g of [tuft, wood, leaves, blossoms, flowers, fruits, fireflies]) g?.dispose();
  }, [tuft, wood, leaves, blossoms, flowers, fruits, fireflies]);
  useEffect(() => () => {
    for (const m of Object.values(materials)) m.dispose();
  }, [materials]);

  useFrame(({ clock, size }) => {
    const t = reduceMotion ? 0 : clock.getElapsedTime();
    const wind = reduceMotion ? 0 : 1;
    for (const m of [materials.leaves, materials.grass, materials.blossoms]) {
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
      {!bare && <Diorama species="tree" theme={theme} seed={seed} radius={island} groundY={PORTAL_GROUND_Y} reduceMotion={reduceMotion} base={false} shadowLift={treeIslandBase(island)} />}
      <TreeIsland bare={bare} seed={seed} theme={theme} radius={island} groundY={PORTAL_GROUND_Y} reduceMotion={reduceMotion} />
      <group position={[0, PORTAL_GROUND_Y, 0]}>
        <instancedMesh ref={grassRef} args={[tuft, materials.grass, grass.length]} frustumCulled={false} />
        {/* Дерево стоїть на пласкій середині купола, а не під нею (ADR-0222). */}
        <group position={[0, treeIslandBase(island), 0]} scale={scale} {...treeEvents}>
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
