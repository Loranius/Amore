import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type LifeInstance = {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  tone: number;
};

type BreezeGrassInstance = {
  x: number;
  y: number;
  z: number;
  rotation: number;
  height: number;
  width: number;
  tone: number;
  phase: number;
};

type TreeLifeDetailsProps = {
  theme: 'light' | 'dark';
  hillRadius: number;
  soilRadius: number;
  groundY: number;
  reducedMotion: boolean;
};

const LIFE_PALETTES = {
  light: {
    stemA: '#5f7f43',
    stemB: '#789a52',
    breezeA: '#617e47',
    breezeB: '#8aa45e',
    flowerWhite: '#f7f2df',
    flowerGold: '#e6c969',
    flowerViolet: '#a898bf',
    dryLeafA: '#8a6944',
    dryLeafB: '#aa8559',
    twig: '#6a5037',
    cloud: '#f5f7ef',
    butterflyA: '#e9c66f',
    butterflyB: '#f2e4c4',
  },
  dark: {
    stemA: '#49683a',
    stemB: '#65834a',
    breezeA: '#4f6e3c',
    breezeB: '#718b50',
    flowerWhite: '#e9e6d8',
    flowerGold: '#d5b95d',
    flowerViolet: '#9183aa',
    dryLeafA: '#765a3d',
    dryLeafB: '#92704a',
    twig: '#58442f',
    cloud: '#e4ebe4',
    butterflyA: '#d9b55e',
    butterflyB: '#e5d4ad',
  },
} as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothStep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const hash2 = (x: number, z: number, salt: number) => {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
};

const hash = (index: number, salt: number) => hash2(index, salt * 0.17, salt);

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
  const nx0 = THREE.MathUtils.lerp(n00, n10, sx);
  const nx1 = THREE.MathUtils.lerp(n01, n11, sx);
  return THREE.MathUtils.lerp(nx0, nx1, sz);
};

// Mirrors TreeStage terrain exactly so all small props sit on the actual hill
// rather than on a second approximate ground plane.
const terrainHeight = (x: number, z: number, radius: number) => {
  const radial = Math.min(1, Math.hypot(x, z) / radius);
  const distance = Math.hypot(x, z);
  const summitMask = smoothStep(0.55, 2.2, distance);
  const dome = -radius * 0.2 * Math.pow(radial, 1.58);
  const broad = (valueNoise(x * 0.25, z * 0.25, 3) - 0.5) * 0.72;
  const medium = (valueNoise(x * 0.62, z * 0.62, 11) - 0.5) * 0.22;
  const ridge = Math.sin(x * 0.53 + z * 0.19) * 0.055;
  const edgeWeight = 0.48 + radial * 0.52;
  return dome + (broad + medium + ridge) * summitMask * edgeWeight;
};

const groundHeight = (x: number, z: number, hillRadius: number, groundY: number) =>
  groundY + terrainHeight(x, z, hillRadius);

function buildFlowers(hillRadius: number, soilRadius: number, groundY: number) {
  const count = 44;
  const minRadius = Math.max(soilRadius * 1.55, 1.25);
  const maxRadius = hillRadius * 0.68;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const items: LifeInstance[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = i * golden + (hash(i, 3) - 0.5) * 0.72;
    const radial = Math.sqrt(
      minRadius * minRadius
      + (maxRadius * maxRadius - minRadius * minRadius) * hash(i, 5),
    );
    const x = Math.cos(angle) * radial;
    const z = Math.sin(angle) * radial;
    items.push({
      x,
      y: groundHeight(x, z, hillRadius, groundY),
      z,
      rotation: hash(i, 7) * Math.PI * 2,
      scale: THREE.MathUtils.lerp(0.72, 1.22, hash(i, 11)),
      tone: hash(i, 13),
    });
  }

  return items;
}

function buildBreezeGrass(hillRadius: number, soilRadius: number, groundY: number) {
  const count = 96;
  const minRadius = Math.max(soilRadius * 1.25, 1.05);
  const maxRadius = hillRadius * 0.72;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const items: BreezeGrassInstance[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = i * golden + (hash(i, 83) - 0.5) * 0.9;
    const radial = Math.sqrt(
      minRadius * minRadius
      + (maxRadius * maxRadius - minRadius * minRadius) * hash(i, 89),
    );
    const x = Math.cos(angle) * radial;
    const z = Math.sin(angle) * radial;
    const height = THREE.MathUtils.lerp(0.34, 0.68, hash(i, 97));
    items.push({
      x,
      y: groundHeight(x, z, hillRadius, groundY) + height * 0.5,
      z,
      rotation: angle + hash(i, 101) * Math.PI,
      height,
      width: THREE.MathUtils.lerp(0.72, 1.16, hash(i, 103)),
      tone: hash(i, 107),
      phase: hash(i, 109) * Math.PI * 2,
    });
  }

  return items;
}

function buildRootLitter(hillRadius: number, soilRadius: number, groundY: number) {
  const count = 28;
  const items: LifeInstance[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = hash(i, 17) * Math.PI * 2;
    const radial = THREE.MathUtils.lerp(
      Math.max(0.32, soilRadius * 0.42),
      Math.max(0.9, soilRadius * 1.5),
      Math.sqrt(hash(i, 19)),
    );
    const x = Math.cos(angle) * radial;
    const z = Math.sin(angle) * radial;
    items.push({
      x,
      y: groundHeight(x, z, hillRadius, groundY) + 0.018,
      z,
      rotation: hash(i, 23) * Math.PI * 2,
      scale: THREE.MathUtils.lerp(0.75, 1.35, hash(i, 29)),
      tone: hash(i, 31),
    });
  }

  return items;
}

function buildTwigs(hillRadius: number, soilRadius: number, groundY: number) {
  const count = 12;
  const items: LifeInstance[] = [];

  for (let i = 0; i < count; i += 1) {
    const angle = hash(i, 37) * Math.PI * 2;
    const radial = THREE.MathUtils.lerp(
      Math.max(0.42, soilRadius * 0.62),
      Math.max(1.05, soilRadius * 1.7),
      hash(i, 41),
    );
    const x = Math.cos(angle) * radial;
    const z = Math.sin(angle) * radial;
    items.push({
      x,
      y: groundHeight(x, z, hillRadius, groundY) + 0.025,
      z,
      rotation: angle + hash(i, 43) * 1.2,
      scale: THREE.MathUtils.lerp(0.72, 1.45, hash(i, 47)),
      tone: hash(i, 53),
    });
  }

  return items;
}

function MeadowFlowers({
  theme,
  hillRadius,
  soilRadius,
  groundY,
}: Pick<TreeLifeDetailsProps, 'theme' | 'hillRadius' | 'soilRadius' | 'groundY'>) {
  const stemsRef = useRef<THREE.InstancedMesh>(null);
  const headsRef = useRef<THREE.InstancedMesh>(null);
  const palette = LIFE_PALETTES[theme];
  const flowers = useMemo(
    () => buildFlowers(hillRadius, soilRadius, groundY),
    [hillRadius, soilRadius, groundY],
  );

  useEffect(() => {
    const stems = stemsRef.current;
    const heads = headsRef.current;
    if (!stems || !heads) return;

    const dummy = new THREE.Object3D();
    const stemA = new THREE.Color(palette.stemA);
    const stemB = new THREE.Color(palette.stemB);
    const white = new THREE.Color(palette.flowerWhite);
    const gold = new THREE.Color(palette.flowerGold);
    const violet = new THREE.Color(palette.flowerViolet);
    const color = new THREE.Color();

    flowers.forEach((flower, index) => {
      const stemHeight = 0.22 * flower.scale;
      dummy.position.set(flower.x, flower.y + stemHeight * 0.5, flower.z);
      dummy.rotation.set(0, flower.rotation, 0);
      dummy.scale.set(flower.scale, flower.scale, flower.scale);
      dummy.updateMatrix();
      stems.setMatrixAt(index, dummy.matrix);
      color.copy(stemA).lerp(stemB, flower.tone);
      stems.setColorAt(index, color);

      dummy.position.set(flower.x, flower.y + stemHeight + 0.035, flower.z);
      dummy.rotation.set(0.12 * (flower.tone - 0.5), flower.rotation, 0.08 * (0.5 - flower.tone));
      dummy.scale.setScalar(flower.scale);
      dummy.updateMatrix();
      heads.setMatrixAt(index, dummy.matrix);
      if (flower.tone < 0.48) color.copy(white);
      else if (flower.tone < 0.78) color.copy(gold);
      else color.copy(violet);
      heads.setColorAt(index, color);
    });

    stems.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    if (stems.instanceColor) stems.instanceColor.needsUpdate = true;
    if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  }, [flowers, palette]);

  return (
    <>
      <instancedMesh ref={stemsRef} args={[undefined, undefined, flowers.length]}>
        <cylinderGeometry args={[0.008, 0.012, 0.22, 5]} />
        <meshStandardMaterial color="#ffffff" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={headsRef} args={[undefined, undefined, flowers.length]}>
        <icosahedronGeometry args={[0.052, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
    </>
  );
}

function BreezeGrass({
  theme,
  hillRadius,
  soilRadius,
  groundY,
  reducedMotion,
}: TreeLifeDetailsProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummyRef = useRef(new THREE.Object3D());
  const tickRef = useRef(0);
  const palette = LIFE_PALETTES[theme];
  const grass = useMemo(
    () => buildBreezeGrass(hillRadius, soilRadius, groundY),
    [hillRadius, soilRadius, groundY],
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = dummyRef.current;
    const a = new THREE.Color(palette.breezeA);
    const b = new THREE.Color(palette.breezeB);
    const color = new THREE.Color();

    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    grass.forEach((blade, index) => {
      dummy.position.set(blade.x, blade.y, blade.z);
      dummy.rotation.set(0, blade.rotation, 0);
      dummy.scale.set(blade.width, blade.height / 0.48, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(a).lerp(b, blade.tone);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [grass, palette.breezeA, palette.breezeB]);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    tickRef.current += delta;
    if (tickRef.current < 0.05) return;
    tickRef.current = 0;

    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = dummyRef.current;
    const time = state.clock.elapsedTime;

    grass.forEach((blade, index) => {
      const sway = Math.sin(time * 1.15 + blade.phase + blade.x * 0.14) * 0.065;
      dummy.position.set(blade.x, blade.y, blade.z);
      dummy.rotation.set(sway * 0.18, blade.rotation, sway);
      dummy.scale.set(blade.width, blade.height / 0.48, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, grass.length]}>
      <planeGeometry args={[0.065, 0.48]} />
      <meshStandardMaterial color="#ffffff" roughness={1} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}

function RootLitter({
  theme,
  hillRadius,
  soilRadius,
  groundY,
}: Pick<TreeLifeDetailsProps, 'theme' | 'hillRadius' | 'soilRadius' | 'groundY'>) {
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const twigsRef = useRef<THREE.InstancedMesh>(null);
  const palette = LIFE_PALETTES[theme];
  const leaves = useMemo(
    () => buildRootLitter(hillRadius, soilRadius, groundY),
    [hillRadius, soilRadius, groundY],
  );
  const twigs = useMemo(
    () => buildTwigs(hillRadius, soilRadius, groundY),
    [hillRadius, soilRadius, groundY],
  );

  useEffect(() => {
    const mesh = leavesRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const a = new THREE.Color(palette.dryLeafA);
    const b = new THREE.Color(palette.dryLeafB);
    const color = new THREE.Color();

    leaves.forEach((leaf, index) => {
      dummy.position.set(leaf.x, leaf.y, leaf.z);
      dummy.rotation.set(-Math.PI / 2 + (leaf.tone - 0.5) * 0.14, leaf.rotation, (leaf.tone - 0.5) * 0.2);
      dummy.scale.set(leaf.scale, leaf.scale, leaf.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(a).lerp(b, leaf.tone);
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [leaves, palette.dryLeafA, palette.dryLeafB]);

  useEffect(() => {
    const mesh = twigsRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();

    twigs.forEach((twig, index) => {
      dummy.position.set(twig.x, twig.y, twig.z);
      dummy.rotation.set(Math.PI / 2, twig.rotation, 0.12 * (twig.tone - 0.5));
      dummy.scale.set(twig.scale, twig.scale, twig.scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });

    mesh.instanceMatrix.needsUpdate = true;
  }, [twigs]);

  return (
    <>
      <instancedMesh ref={leavesRef} args={[undefined, undefined, leaves.length]}>
        <planeGeometry args={[0.14, 0.065]} />
        <meshStandardMaterial color="#ffffff" roughness={1} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh ref={twigsRef} args={[undefined, undefined, twigs.length]}>
        <cylinderGeometry args={[0.009, 0.014, 0.28, 5]} />
        <meshStandardMaterial color={palette.twig} roughness={1} />
      </instancedMesh>
    </>
  );
}

function CloudLayer({ theme, groundY, reducedMotion }: Pick<TreeLifeDetailsProps, 'theme' | 'groundY' | 'reducedMotion'>) {
  const groupRef = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.InstancedMesh>(null);
  const palette = LIFE_PALETTES[theme];
  const puffs = useMemo(() => {
    const bases = [
      [-13, groundY + 10.4, -22],
      [-3.8, groundY + 12.1, -27],
      [9.5, groundY + 9.7, -24],
    ] as const;
    const values: Array<{ x: number; y: number; z: number; sx: number; sy: number; sz: number }> = [];
    bases.forEach(([bx, by, bz], cloudIndex) => {
      for (let puff = 0; puff < 5; puff += 1) {
        values.push({
          x: bx + (puff - 2) * 0.9 + (hash(puff + cloudIndex * 7, 59) - 0.5) * 0.48,
          y: by + Math.sin(puff * 1.4) * 0.28,
          z: bz + (hash(puff + cloudIndex * 11, 61) - 0.5) * 0.7,
          sx: THREE.MathUtils.lerp(0.78, 1.45, hash(puff + cloudIndex * 13, 67)),
          sy: THREE.MathUtils.lerp(0.38, 0.68, hash(puff + cloudIndex * 17, 71)),
          sz: THREE.MathUtils.lerp(0.62, 1.2, hash(puff + cloudIndex * 19, 73)),
        });
      }
    });
    return values;
  }, [groundY]);

  useEffect(() => {
    const mesh = cloudsRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    puffs.forEach((puff, index) => {
      dummy.position.set(puff.x, puff.y, puff.z);
      dummy.rotation.set(0, hash(index, 79) * Math.PI, 0);
      dummy.scale.set(puff.sx, puff.sy, puff.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [puffs]);

  useFrame((state) => {
    if (reducedMotion || !groupRef.current) return;
    groupRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.035) * 1.4;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={cloudsRef} args={[undefined, undefined, puffs.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 7]} />
        <meshBasicMaterial
          color={palette.cloud}
          transparent
          opacity={0.42}
          depthWrite={false}
          fog={false}
        />
      </instancedMesh>
    </group>
  );
}

function Butterfly({
  base,
  phase,
  color,
  reducedMotion,
}: {
  base: readonly [number, number, number];
  phase: number;
  color: string;
  reducedMotion: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const leftRef = useRef<THREE.Mesh>(null);
  const rightRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (reducedMotion) return;
    const t = state.clock.elapsedTime + phase;
    const group = groupRef.current;
    if (group) {
      group.position.set(
        base[0] + Math.sin(t * 0.52) * 0.48,
        base[1] + Math.sin(t * 0.83) * 0.18,
        base[2] + Math.cos(t * 0.47) * 0.36,
      );
      group.rotation.y = Math.sin(t * 0.4) * 0.65;
    }
    const flap = Math.sin(t * 8.4) * 0.78;
    if (leftRef.current) leftRef.current.rotation.y = 0.42 + flap;
    if (rightRef.current) rightRef.current.rotation.y = -0.42 - flap;
  });

  return (
    <group ref={groupRef} position={[base[0], base[1], base[2]]} scale={0.78}>
      <mesh ref={leftRef} position={[-0.055, 0, 0]} rotation={[0.08, 0.42, 0.18]}>
        <planeGeometry args={[0.13, 0.09]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh ref={rightRef} position={[0.055, 0, 0]} rotation={[0.08, -0.42, -0.18]}>
        <planeGeometry args={[0.13, 0.09]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.85} />
      </mesh>
      <mesh scale={[0.42, 1.3, 0.42]}>
        <sphereGeometry args={[0.03, 6, 5]} />
        <meshBasicMaterial color="#42392f" />
      </mesh>
    </group>
  );
}

export function TreeLifeDetails({
  theme,
  hillRadius,
  soilRadius,
  groundY,
  reducedMotion,
}: TreeLifeDetailsProps) {
  const palette = LIFE_PALETTES[theme];

  return (
    <>
      <BreezeGrass
        theme={theme}
        hillRadius={hillRadius}
        soilRadius={soilRadius}
        groundY={groundY}
        reducedMotion={reducedMotion}
      />
      <MeadowFlowers
        theme={theme}
        hillRadius={hillRadius}
        soilRadius={soilRadius}
        groundY={groundY}
      />
      <RootLitter
        theme={theme}
        hillRadius={hillRadius}
        soilRadius={soilRadius}
        groundY={groundY}
      />
      <CloudLayer theme={theme} groundY={groundY} reducedMotion={reducedMotion} />
      <Butterfly
        base={[1.55, groundY + 2.15, 0.55]}
        phase={0.4}
        color={palette.butterflyA}
        reducedMotion={reducedMotion}
      />
      <Butterfly
        base={[-2.1, groundY + 2.72, -1.1]}
        phase={2.7}
        color={palette.butterflyB}
        reducedMotion={reducedMotion}
      />
    </>
  );
}
