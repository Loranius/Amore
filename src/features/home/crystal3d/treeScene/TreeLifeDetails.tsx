import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

type HeightAt = (x: number, z: number) => number;

type LifeInstance = {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  tone: number;
};

type TreeLifeDetailsProps = {
  theme: 'light' | 'dark';
  hillRadius: number;
  soilRadius: number;
  groundY: number;
  reducedMotion: boolean;
  heightAt: HeightAt;
};

const LIFE_PALETTES = {
  light: {
    stemA: '#5f7f43',
    stemB: '#789a52',
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

const hash = (index: number, salt: number) => {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453123;
  return value - Math.floor(value);
};

function buildFlowers(hillRadius: number, soilRadius: number, heightAt: HeightAt) {
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
      y: heightAt(x, z),
      z,
      rotation: hash(i, 7) * Math.PI * 2,
      scale: THREE.MathUtils.lerp(0.72, 1.22, hash(i, 11)),
      tone: hash(i, 13),
    });
  }

  return items;
}

function buildRootLitter(soilRadius: number, heightAt: HeightAt) {
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
      y: heightAt(x, z) + 0.018,
      z,
      rotation: hash(i, 23) * Math.PI * 2,
      scale: THREE.MathUtils.lerp(0.75, 1.35, hash(i, 29)),
      tone: hash(i, 31),
    });
  }

  return items;
}

function buildTwigs(soilRadius: number, heightAt: HeightAt) {
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
      y: heightAt(x, z) + 0.025,
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
  heightAt,
}: Pick<TreeLifeDetailsProps, 'theme' | 'hillRadius' | 'soilRadius' | 'heightAt'>) {
  const stemsRef = useRef<THREE.InstancedMesh>(null);
  const headsRef = useRef<THREE.InstancedMesh>(null);
  const palette = LIFE_PALETTES[theme];
  const flowers = useMemo(
    () => buildFlowers(hillRadius, soilRadius, heightAt),
    [hillRadius, soilRadius, heightAt],
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

function RootLitter({
  theme,
  soilRadius,
  heightAt,
}: Pick<TreeLifeDetailsProps, 'theme' | 'soilRadius' | 'heightAt'>) {
  const leavesRef = useRef<THREE.InstancedMesh>(null);
  const twigsRef = useRef<THREE.InstancedMesh>(null);
  const palette = LIFE_PALETTES[theme];
  const leaves = useMemo(() => buildRootLitter(soilRadius, heightAt), [soilRadius, heightAt]);
  const twigs = useMemo(() => buildTwigs(soilRadius, heightAt), [soilRadius, heightAt]);

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
  heightAt,
}: TreeLifeDetailsProps) {
  const palette = LIFE_PALETTES[theme];

  return (
    <>
      <MeadowFlowers
        theme={theme}
        hillRadius={hillRadius}
        soilRadius={soilRadius}
        heightAt={heightAt}
      />
      <RootLitter theme={theme} soilRadius={soilRadius} heightAt={heightAt} />
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
