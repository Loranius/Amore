import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createGrassBladeTexture } from './TreeEnvironmentTextures';

type Props = {
  theme: 'light' | 'dark';
  hillRadius: number;
  soilRadius: number;
  groundY: number;
  reducedMotion: boolean;
};

type GroundItem = {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  tone: number;
  phase: number;
};

const PALETTE = {
  light: {
    stemA: '#67864a', stemB: '#85a55d',
    flowerA: '#f7f2df', flowerB: '#e7cc73', flowerC: '#aa9cc4',
    leafA: '#8a6944', leafB: '#b08b5e', twig: '#6a5037',
    cloud: '#f8faf5', butterflyA: '#e9c66f', butterflyB: '#f0dfbb',
  },
  dark: {
    stemA: '#587544', stemB: '#779451',
    flowerA: '#eeeadc', flowerB: '#d8bb62', flowerC: '#9587ae',
    leafA: '#765a3d', leafB: '#98744c', twig: '#58442f',
    cloud: '#edf2ea', butterflyA: '#d9b55e', butterflyB: '#e3d0a9',
  },
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const hash2 = (x: number, z: number, salt: number) => {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
};
const hash = (index: number, salt: number) => hash2(index, salt * 0.17, salt);
const smoothStep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const valueNoise = (x: number, z: number, salt: number) => {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const n00 = hash2(x0, z0, salt);
  const n10 = hash2(x0 + 1, z0, salt);
  const n01 = hash2(x0, z0 + 1, salt);
  const n11 = hash2(x0 + 1, z0 + 1, salt);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(n00, n10, sx),
    THREE.MathUtils.lerp(n01, n11, sx),
    sz,
  );
};
const terrainHeight = (x: number, z: number, radius: number) => {
  const radial = Math.min(1, Math.hypot(x, z) / radius);
  const distance = Math.hypot(x, z);
  const summitMask = smoothStep(0.55, 2.2, distance);
  const dome = -radius * 0.2 * Math.pow(radial, 1.58);
  const broad = (valueNoise(x * 0.25, z * 0.25, 3) - 0.5) * 0.72;
  const medium = (valueNoise(x * 0.62, z * 0.62, 11) - 0.5) * 0.22;
  const ridge = Math.sin(x * 0.53 + z * 0.19) * 0.055;
  return dome + (broad + medium + ridge) * summitMask * (0.48 + radial * 0.52);
};
const groundYAt = (x: number, z: number, radius: number, groundY: number) =>
  groundY + terrainHeight(x, z, radius);

function makeGrassTuftGeometry() {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const cards = [
    [0, 0.10, 0.48], [1.05, 0.085, 0.41], [-1.08, 0.082, 0.39],
    [2.08, 0.068, 0.33], [-2.1, 0.065, 0.31],
  ] as const;
  cards.forEach(([yaw, width, height]) => {
    const start = positions.length / 3;
    const rx = Math.cos(yaw) * width * 0.5;
    const rz = -Math.sin(yaw) * width * 0.5;
    positions.push(-rx, 0, -rz, rx, 0, rz, rx, height, rz, -rx, height, -rz);
    uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  /*
   * НОРМАЛЬ УГОРУ — І БЕЗ ЦЬОГО ТРАВА БУЛА ЧОРНОЮ.
   *
   * Кущик — п'ять вертикальних карток навхрест. `computeVertexNormals` дає
   * кожній нормаль ПЕРПЕНДИКУЛЯРНО до площини, тобто вбік; на
   * `meshStandardMaterial` це означає, що картка, відвернута від сонця,
   * освітлення не дістає взагалі.
   *
   * ВИМІРЯНО НА ЖИВОМУ ЕКРАНІ: ці кущики малювались як rgb(1,1,3) — тобто
   * чорні шпичаки на освітленому лузі, схожі на дорожні фішки. Знайти їх
   * удалось лише вимкненням: коли з іншої системи прибрали всі 235 кущиків,
   * шпичаки лишились на місці, отже вони були не звідти.
   *
   * Жива трава так не поводиться: пучок розсіює світло й читається м'яким
   * об'ємом, освітленим згори. Тому нормаль тут спільна й спрямована вгору —
   * той самий прийом, що й у `TreeTexturedStage`, і саме він садить кущик у
   * те саме світло, що й землю під ним.
   */
  const upward = new Float32Array((positions.length / 3) * 3);
  for (let index = 1; index < upward.length; index += 3) upward[index] = 1;
  geometry.setAttribute('normal', new THREE.BufferAttribute(upward, 3));
  return geometry;
}

function makeDryLeafGeometry() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0.005, 0.09,
    0.055, 0, 0.025,
    0.04, 0.004, -0.06,
    0, 0, -0.095,
    -0.045, 0.004, -0.052,
    -0.058, 0, 0.028,
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3, 0, 3, 4, 0, 4, 5]);
  geometry.computeVertexNormals();
  return geometry;
}

function buildGroundItems(count: number, minRadius: number, maxRadius: number, hillRadius: number, groundY: number, salt: number) {
  const items: GroundItem[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const angle = i * golden + (hash(i, salt) - 0.5) * 0.92;
    const radius = Math.sqrt(minRadius * minRadius + (maxRadius * maxRadius - minRadius * minRadius) * hash(i, salt + 2));
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    items.push({
      x,
      y: groundYAt(x, z, hillRadius, groundY),
      z,
      rotation: angle + hash(i, salt + 3) * Math.PI,
      scale: THREE.MathUtils.lerp(0.72, 1.2, hash(i, salt + 5)),
      tone: hash(i, salt + 7),
      phase: hash(i, salt + 11) * Math.PI * 2,
    });
  }
  return items;
}

function BreezeGrass({ theme, hillRadius, soilRadius, groundY, reducedMotion }: Props) {
  const ref = useRef<THREE.InstancedMesh>(null);
  const tick = useRef(0);
  const geometry = useMemo(() => makeGrassTuftGeometry(), []);
  const texture = useMemo(() => createGrassBladeTexture(theme), [theme]);
  const items = useMemo(
    () => buildGroundItems(72, Math.max(soilRadius * 1.5, 1.3), hillRadius * 0.7, hillRadius, groundY, 101),
    [hillRadius, soilRadius, groundY],
  );

  useEffect(() => () => { geometry.dispose(); texture.dispose(); }, [geometry, texture]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy = new THREE.Object3D();
    items.forEach((item, index) => {
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.set(item.scale, THREE.MathUtils.lerp(0.72, 1.18, item.tone), item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [items]);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    tick.current += delta;
    if (tick.current < 0.055) return;
    tick.current = 0;
    const mesh = ref.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const time = state.clock.elapsedTime;
    items.forEach((item, index) => {
      const sway = Math.sin(time * 1.05 + item.phase) * 0.045;
      dummy.position.set(item.x, item.y, item.z);
      dummy.rotation.set(sway * 0.12, item.rotation, sway);
      dummy.scale.set(item.scale, THREE.MathUtils.lerp(0.72, 1.18, item.tone), item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]}>
      {/*
        * `FrontSide`, А НЕ `DoubleSide` — БЕЗ ЦЬОГО ПІВКАРТКИ ЧОРНІ.
        *
        * Нормаль кущика спрямована вгору (див. `makeGrassTuftGeometry`), але
        * three для двобічного матеріалу ПЕРЕВЕРТАЄ її на задніх гранях:
        * `normal *= faceDirection` у `normal_fragment_begin.glsl`. Отже задня
        * половина кожної картки діставала нормаль (0,-1,0), тобто світло лише
        * знизу, і малювалась як rgb(3,2,5) при лузі поруч rgb(64,73,41).
        *
        * На екрані це були чорні шпичаки, схожі на дорожні фішки. Вони
        * пережили і виправлення кольору землі, і саму нормаль угору — саме
        * тому, що причина була не в нормалі, а в тому, що її перевертають.
        *
        * Односторонні картки тут нічого не коштують: кущик складений із
        * п'яти, схрещених під різними кутами, тож із будь-якого боку видно
        * щонайменше дві. Це дешевше за подвоєння трикутників заради
        * зворотної намотки.
        */}
      <meshStandardMaterial
        map={texture}
        color="#ffffff"
        roughness={0.96}
        side={THREE.FrontSide}
        transparent
        alphaTest={0.2}
      />
    </instancedMesh>
  );
}

function DryLitter({ theme, hillRadius, soilRadius, groundY }: Props) {
  const leafRef = useRef<THREE.InstancedMesh>(null);
  const twigRef = useRef<THREE.InstancedMesh>(null);
  const palette = PALETTE[theme];
  const leafGeometry = useMemo(() => makeDryLeafGeometry(), []);
  const leaves = useMemo(
    () => buildGroundItems(20, Math.max(soilRadius * 0.72, 0.55), Math.max(soilRadius * 1.75, 1.55), hillRadius, groundY, 151),
    [hillRadius, soilRadius, groundY],
  );
  const twigs = useMemo(
    () => buildGroundItems(8, Math.max(soilRadius * 0.8, 0.7), Math.max(soilRadius * 1.85, 1.7), hillRadius, groundY, 181),
    [hillRadius, soilRadius, groundY],
  );

  useEffect(() => () => leafGeometry.dispose(), [leafGeometry]);
  useEffect(() => {
    const mesh = leafRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const a = new THREE.Color(palette.leafA);
    const b = new THREE.Color(palette.leafB);
    const color = new THREE.Color();
    leaves.forEach((item, index) => {
      dummy.position.set(item.x, item.y + 0.016, item.z);
      dummy.rotation.set((item.tone - 0.5) * 0.08, item.rotation, (item.tone - 0.5) * 0.12);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(a).lerp(b, item.tone);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [leaves, palette]);
  useEffect(() => {
    const mesh = twigRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    twigs.forEach((item, index) => {
      dummy.position.set(item.x, item.y + 0.022, item.z);
      dummy.rotation.set(Math.PI / 2, item.rotation, (item.tone - 0.5) * 0.18);
      dummy.scale.setScalar(item.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [twigs]);

  return (
    <>
      <instancedMesh ref={leafRef} args={[leafGeometry, undefined, leaves.length]}>
        <meshStandardMaterial color="#ffffff" roughness={1} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={twigRef} args={[undefined, undefined, twigs.length]}>
        <cylinderGeometry args={[0.008, 0.012, 0.22, 5]} />
        <meshStandardMaterial color={palette.twig} roughness={1} />
      </instancedMesh>
    </>
  );
}

function Flowers({ theme, hillRadius, soilRadius, groundY }: Props) {
  const stemRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const palette = PALETTE[theme];
  const flowers = useMemo(
    () => buildGroundItems(32, Math.max(soilRadius * 1.65, 1.45), hillRadius * 0.64, hillRadius, groundY, 211),
    [hillRadius, soilRadius, groundY],
  );
  useEffect(() => {
    const stems = stemRef.current;
    const heads = headRef.current;
    if (!stems || !heads) return;
    const dummy = new THREE.Object3D();
    const colors: readonly [THREE.Color, THREE.Color, THREE.Color] = [
      new THREE.Color(palette.flowerA),
      new THREE.Color(palette.flowerB),
      new THREE.Color(palette.flowerC),
    ];
    flowers.forEach((item, index) => {
      const height = 0.18 + item.tone * 0.12;
      dummy.position.set(item.x, item.y + height * 0.5, item.z);
      dummy.rotation.set(0, item.rotation, 0);
      dummy.scale.set(item.scale, height / 0.24, item.scale);
      dummy.updateMatrix();
      stems.setMatrixAt(index, dummy.matrix);
      dummy.position.set(item.x, item.y + height + 0.025, item.z);
      dummy.scale.setScalar(0.78 + item.scale * 0.25);
      dummy.updateMatrix();
      heads.setMatrixAt(index, dummy.matrix);
      const colorIndex = Math.min(2, Math.floor(item.tone * 3));
      heads.setColorAt(index, colors[colorIndex] ?? colors[0]);
    });
    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  }, [flowers, palette]);
  return (
    <>
      <instancedMesh ref={stemRef} args={[undefined, undefined, flowers.length]}>
        <cylinderGeometry args={[0.007, 0.011, 0.24, 5]} />
        <meshStandardMaterial color={palette.stemA} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={headRef} args={[undefined, undefined, flowers.length]}>
        <icosahedronGeometry args={[0.047, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.92} />
      </instancedMesh>
    </>
  );
}

function Clouds({ theme, groundY, reducedMotion }: Pick<Props, 'theme' | 'groundY' | 'reducedMotion'>) {
  const group = useRef<THREE.Group>(null);
  const palette = PALETTE[theme];
  const cloudGroups: Array<[number, number, number, number]> = [
    [-10, groundY + 10.5, -25, 1.1],
    [1.5, groundY + 12.2, -30, 0.9],
    [11, groundY + 9.8, -26, 1.05],
  ];
  useFrame((state) => {
    if (reducedMotion || !group.current) return;
    group.current.position.x = Math.sin(state.clock.elapsedTime * 0.028) * 0.9;
  });
  return (
    <group ref={group}>
      {cloudGroups.map(([x, y, z, s], index) => (
        <group key={index} position={[x, y, z]} scale={s}>
          {[-1.1, -0.45, 0.25, 0.95].map((offset, puff) => (
            <mesh key={puff} position={[offset, Math.sin(puff * 1.3) * 0.18, (puff % 2) * 0.18]}>
              <sphereGeometry args={[0.75 + puff * 0.08, 9, 6]} />
              <meshBasicMaterial color={palette.cloud} transparent opacity={0.22} depthWrite={false} fog={false} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

function Butterfly({ base, phase, color, reducedMotion }: { base: [number, number, number]; phase: number; color: string; reducedMotion: boolean }) {
  const group = useRef<THREE.Group>(null);
  const left = useRef<THREE.Mesh>(null);
  const right = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime + phase;
    if (group.current) {
      group.current.position.set(base[0] + Math.sin(t * 0.5) * 0.45, base[1] + Math.sin(t * 0.8) * 0.16, base[2] + Math.cos(t * 0.45) * 0.32);
      group.current.rotation.y = Math.sin(t * 0.38) * 0.55;
    }
    const flap = Math.sin(t * 8) * 0.7;
    if (left.current) left.current.rotation.y = 0.4 + flap;
    if (right.current) right.current.rotation.y = -0.4 - flap;
  });
  return (
    <group ref={group} position={base} scale={0.7}>
      <mesh ref={left} position={[-0.05, 0, 0]} rotation={[0.08, 0.4, 0.15]}>
        <circleGeometry args={[0.075, 6, 0, Math.PI]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.82} />
      </mesh>
      <mesh ref={right} position={[0.05, 0, 0]} rotation={[0.08, -0.4, -0.15]}>
        <circleGeometry args={[0.075, 6, Math.PI, Math.PI]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.82} />
      </mesh>
      <mesh scale={[0.35, 1.1, 0.35]}>
        <sphereGeometry args={[0.028, 6, 5]} />
        <meshBasicMaterial color="#40382f" />
      </mesh>
    </group>
  );
}

export function TreeLifeDetailsPolished(props: Props) {
  const palette = PALETTE[props.theme];
  return (
    <>
      <BreezeGrass {...props} />
      <Flowers {...props} />
      <DryLitter {...props} />
      <Clouds theme={props.theme} groundY={props.groundY} reducedMotion={props.reducedMotion} />
      <Butterfly base={[1.55, props.groundY + 2.15, 0.55]} phase={0.4} color={palette.butterflyA} reducedMotion={props.reducedMotion} />
      <Butterfly base={[-2.1, props.groundY + 2.72, -1.1]} phase={2.7} color={palette.butterflyB} reducedMotion={props.reducedMotion} />
    </>
  );
}