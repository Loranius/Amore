import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { WorldCameraPose } from '@/features/world/crystalAtlas';
import type { WorldMotionMode } from '@/features/world/sceneDirector';
import { PortalCameraRig } from '../scene/PortalEnvironment';
import { portalCameraFrame } from '../scene/portalScene';

interface TreeStageProps {
  theme: 'light' | 'dark';
  reduceMotion: boolean;
  soilRadius: number;
  crownRadius: number;
  treeHeight: number;
  groundY: number;
  pose?: WorldCameraPose | undefined;
  motionMode?: { current: Exclude<WorldMotionMode, 'navigation'> } | undefined;
  allowOrbit?: boolean | undefined;
  children: ReactNode;
}

const TREE_PALETTES = {
  light: {
    sky: '#b9ddf3',
    skyZenith: '#6eb7e2',
    skyHorizon: '#d7ebed',
    fog: '#d7e8df',
    grass: '#6d8655',
    distantGrass: '#7c9564',
    earth: '#75634e',
    grassBlade: '#78965b',
    grassBladeAlt: '#536f42',
    stoneA: '#7d8177',
    stoneB: '#5f675e',
    hazeHill: '#8da58b',
    hazeHillFar: '#a9beb2',
    shadow: '#263527',
    sun: '#fff2bd',
    sunHalo: '#fff4c7',
    sunLight: '#ffe8bd',
    skyLight: '#d8ecff',
    groundLight: '#6f7d54',
    rim: '#c8ddff',
  },
  dark: {
    // Dark UI still gets a real daytime world. The darker vegetation and
    // cooler haze keep the foreground chrome legible without turning the
    // tree back into the portal's night temple.
    sky: '#8dbbd8',
    skyZenith: '#5d9fc7',
    skyHorizon: '#c4d9d5',
    fog: '#b8d0c8',
    grass: '#4d6840',
    distantGrass: '#617a50',
    earth: '#645541',
    grassBlade: '#607b49',
    grassBladeAlt: '#3f5b35',
    stoneA: '#666d64',
    stoneB: '#4e5750',
    hazeHill: '#718b78',
    hazeHillFar: '#91a99a',
    shadow: '#1f2b22',
    sun: '#ffe9a8',
    sunHalo: '#ffedb8',
    sunLight: '#ffdfad',
    skyLight: '#bfdcf0',
    groundLight: '#516247',
    rim: '#b7d2f3',
  },
} as const;

type TreePalette = (typeof TREE_PALETTES)[keyof typeof TREE_PALETTES];

type GroundInstance = {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  tone: number;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smoothStep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

const hash2 = (x: number, z: number, salt: number) => {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
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
  const nx0 = THREE.MathUtils.lerp(n00, n10, sx);
  const nx1 = THREE.MathUtils.lerp(n01, n11, sx);
  return THREE.MathUtils.lerp(nx0, nx1, sz);
};

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

function buildTerrainGeometry(radius: number, soilRadius: number, palette: TreePalette) {
  const rings = 28;
  const segments = 88;
  const positions: number[] = [0, 0, 0];
  const colors: number[] = [];
  const indices: number[] = [];
  const grass = new THREE.Color(palette.grass);
  const distantGrass = new THREE.Color(palette.distantGrass);
  const earth = new THREE.Color(palette.earth);

  const pushColor = (x: number, z: number) => {
    const radial = Math.hypot(x, z);
    const nearRoots = 1 - smoothStep(soilRadius * 0.78, soilRadius * 1.72, radial);
    const patchNoise = valueNoise(x * 0.44, z * 0.44, 19);
    const dryNoise = valueNoise(x * 0.19, z * 0.19, 29);
    const earthPatch = clamp01(nearRoots * 0.72 + Math.max(0, patchNoise - 0.67) * 1.28);
    const distantBlend = clamp01((dryNoise - 0.46) * 0.46 + (radial / radius) * 0.08);
    const color = grass.clone().lerp(distantGrass, distantBlend).lerp(earth, earthPatch);
    colors.push(color.r, color.g, color.b);
  };

  pushColor(0, 0);

  for (let ring = 1; ring <= rings; ring += 1) {
    const ringT = ring / rings;
    for (let segment = 0; segment < segments; segment += 1) {
      const angle = (segment / segments) * Math.PI * 2;
      const edgeJitter = ringT * (hash2(ring, segment, 41) - 0.5) * radius * 0.022;
      const rr = radius * ringT + edgeJitter;
      const x = Math.cos(angle) * rr;
      const z = Math.sin(angle) * rr;
      positions.push(x, terrainHeight(x, z, radius), z);
      pushColor(x, z);
    }
  }

  for (let segment = 0; segment < segments; segment += 1) {
    const next = (segment + 1) % segments;
    indices.push(0, 1 + next, 1 + segment);
  }

  for (let ring = 1; ring < rings; ring += 1) {
    const currentStart = 1 + (ring - 1) * segments;
    const nextStart = 1 + ring * segments;
    for (let segment = 0; segment < segments; segment += 1) {
      const next = (segment + 1) % segments;
      const a = currentStart + segment;
      const b = currentStart + next;
      const c = nextStart + segment;
      const d = nextStart + next;
      indices.push(a, d, c, a, b, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function buildSkyGeometry(radius: number, palette: TreePalette) {
  const geometry = new THREE.SphereGeometry(radius, 48, 24);
  const position = geometry.getAttribute('position');
  const colors = new Float32Array(position.count * 3);
  const zenith = new THREE.Color(palette.skyZenith);
  const horizon = new THREE.Color(palette.skyHorizon);
  const lower = new THREE.Color(palette.fog);
  const color = new THREE.Color();

  for (let index = 0; index < position.count; index += 1) {
    const normalizedY = clamp01(position.getY(index) / radius * 0.5 + 0.5);
    if (normalizedY < 0.5) {
      color.copy(lower).lerp(horizon, smoothStep(0.16, 0.5, normalizedY));
    } else {
      color.copy(horizon).lerp(zenith, smoothStep(0.5, 0.96, normalizedY));
    }
    const offset = index * 3;
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function buildGrassInstances(hillRadius: number, soilRadius: number, groundY: number) {
  const instances: GroundInstance[] = [];
  const count = 320;
  const minRadius = Math.max(soilRadius * 1.35, 1.05);
  const maxRadius = hillRadius * 0.78;
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const radialSeed = hash2(i, 2, 101);
    const angle = i * golden + (hash2(i, 3, 103) - 0.5) * 0.82;
    const radius = Math.sqrt(
      minRadius * minRadius + (maxRadius * maxRadius - minRadius * minRadius) * radialSeed,
    );
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const localY = terrainHeight(x, z, hillRadius);
    const bladeHeight = THREE.MathUtils.lerp(0.22, 0.54, hash2(i, 4, 107));
    const bladeWidth = THREE.MathUtils.lerp(0.72, 1.25, hash2(i, 5, 109));
    instances.push({
      x,
      y: groundY + localY + bladeHeight * 0.5,
      z,
      rotationX: (hash2(i, 6, 113) - 0.5) * 0.12,
      rotationY: angle + hash2(i, 7, 127) * Math.PI,
      rotationZ: (hash2(i, 8, 131) - 0.5) * 0.18,
      scaleX: bladeWidth,
      scaleY: bladeHeight / 0.42,
      scaleZ: 1,
      tone: hash2(i, 9, 137),
    });
  }

  return instances;
}

function buildRockInstances(hillRadius: number, soilRadius: number, groundY: number) {
  const instances: GroundInstance[] = [];
  const count = 18;
  const minRadius = Math.max(soilRadius * 1.5, 1.5);
  const maxRadius = hillRadius * 0.73;

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + hash2(i, 1, 211) * 0.8;
    const radius = THREE.MathUtils.lerp(minRadius, maxRadius, 0.18 + hash2(i, 2, 223) * 0.82);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const localY = terrainHeight(x, z, hillRadius);
    const scaleX = THREE.MathUtils.lerp(0.2, 0.55, hash2(i, 3, 227));
    const scaleY = THREE.MathUtils.lerp(0.14, 0.35, hash2(i, 4, 229));
    const scaleZ = THREE.MathUtils.lerp(0.22, 0.52, hash2(i, 5, 233));
    instances.push({
      x,
      y: groundY + localY + scaleY * 0.18,
      z,
      rotationX: (hash2(i, 6, 239) - 0.5) * 0.52,
      rotationY: hash2(i, 7, 241) * Math.PI * 2,
      rotationZ: (hash2(i, 8, 251) - 0.5) * 0.42,
      scaleX,
      scaleY,
      scaleZ,
      tone: hash2(i, 9, 257),
    });
  }

  return instances;
}

/**
 * Outdoor world owned by the tree.
 *
 * The tree still uses the shared camera director so navigation remains one
 * continuous world, but it deliberately does not mount PortalEnvironment:
 * no temple floor, relic dais, colonnade, arches, lamps or star field can leak
 * into the tree view.
 */
export function TreeStage({
  theme,
  reduceMotion,
  soilRadius,
  crownRadius,
  treeHeight,
  groundY,
  pose,
  motionMode,
  allowOrbit = true,
  children,
}: TreeStageProps) {
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const rocksRef = useRef<THREE.InstancedMesh>(null);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const frame = useMemo(
    () => portalCameraFrame(aspect, crownRadius, treeHeight),
    [aspect, crownRadius, treeHeight],
  );
  const palette = TREE_PALETTES[theme];
  const hillRadius = useMemo(
    () => Math.max(8, soilRadius * 4.2, crownRadius * 3.8),
    [soilRadius, crownRadius],
  );
  const terrainGeometry = useMemo(
    () => buildTerrainGeometry(hillRadius, soilRadius, palette),
    [hillRadius, soilRadius, palette],
  );
  const skyGeometry = useMemo(
    () => buildSkyGeometry(Math.max(52, frame.distance + 30), palette),
    [frame.distance, palette],
  );
  const grassInstances = useMemo(
    () => buildGrassInstances(hillRadius, soilRadius, groundY),
    [hillRadius, soilRadius, groundY],
  );
  const rockInstances = useMemo(
    () => buildRockInstances(hillRadius, soilRadius, groundY),
    [hillRadius, soilRadius, groundY],
  );

  useEffect(() => () => terrainGeometry.dispose(), [terrainGeometry]);
  useEffect(() => () => skyGeometry.dispose(), [skyGeometry]);

  useEffect(() => {
    const mesh = grassRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const dark = new THREE.Color(palette.grassBladeAlt);
    const light = new THREE.Color(palette.grassBlade);
    const color = new THREE.Color();

    grassInstances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.rotation.set(instance.rotationX, instance.rotationY, instance.rotationZ);
      dummy.scale.set(instance.scaleX, instance.scaleY, instance.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(dark).lerp(light, instance.tone);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [grassInstances, palette.grassBlade, palette.grassBladeAlt]);

  useEffect(() => {
    const mesh = rocksRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const dark = new THREE.Color(palette.stoneB);
    const light = new THREE.Color(palette.stoneA);
    const color = new THREE.Color();

    rockInstances.forEach((instance, index) => {
      dummy.position.set(instance.x, instance.y, instance.z);
      dummy.rotation.set(instance.rotationX, instance.rotationY, instance.rotationZ);
      dummy.scale.set(instance.scaleX, instance.scaleY, instance.scaleZ);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(dark).lerp(light, instance.tone);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [rockInstances, palette.stoneA, palette.stoneB]);

  const rootShadowScaleX = Math.max(1.15, soilRadius * 1.45);
  const rootShadowScaleZ = Math.max(0.68, soilRadius * 0.82);
  const crownShadowScaleX = Math.max(1.9, crownRadius * 0.95);
  const crownShadowScaleZ = Math.max(0.95, crownRadius * 0.48);

  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, frame.distance * 0.78, frame.distance + 31]} />

      {/* Pass 2 sky: vertex-coloured dome gives a bright horizon and deeper
          zenith without HDRI, textures or post-processing. */}
      <mesh geometry={skyGeometry} frustumCulled={false}>
        <meshBasicMaterial
          vertexColors
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/* Natural daylight: less flat ambient fill, stronger sky bounce and one
          warm directional source. No realtime shadow map is required. */}
      <ambientLight intensity={0.2} />
      <hemisphereLight args={[palette.skyLight, palette.groundLight, 1.02]} />
      <directionalLight position={[-7, 10, 5]} intensity={2.3} color={palette.sunLight} />
      <directionalLight position={[5, 4, -6]} intensity={0.28} color={palette.rim} />

      {/* Pass 1 terrain: deterministic uneven mesh with grass/earth vertex
          colouring and no downloaded texture. */}
      <mesh geometry={terrainGeometry} position={[0, groundY, 0]} receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.97} metalness={0} />
      </mesh>

      {/* Cheap soft shadow proxies visually anchor the roots and crown to the
          summit without paying for hundreds of leaf shadow casters. */}
      <mesh
        position={[0.08, groundY + 0.018, -0.04]}
        rotation={[-Math.PI / 2, 0, 0]}
        scale={[rootShadowScaleX, rootShadowScaleZ, 1]}
      >
        <circleGeometry args={[1, 40]} />
        <meshBasicMaterial
          color={palette.shadow}
          transparent
          opacity={0.14}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh
        position={[0.72, groundY + 0.014, -0.5]}
        rotation={[-Math.PI / 2, 0, -0.18]}
        scale={[crownShadowScaleX, crownShadowScaleZ, 1]}
      >
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial
          color={palette.shadow}
          transparent
          opacity={0.055}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>

      {/* Hundreds of blades remain one draw call. A small exclusion zone around
          the trunk keeps the tree/root contact visually readable. */}
      <instancedMesh ref={grassRef} args={[undefined, undefined, grassInstances.length]}>
        <planeGeometry args={[0.075, 0.42, 1, 1]} />
        <meshStandardMaterial color="#ffffff" roughness={1} side={THREE.DoubleSide} />
      </instancedMesh>

      {/* Low-poly stones are deliberately buried into the terrain and share one
          geometry/material draw call, so they read as part of the hill rather
          than props placed on top of it. */}
      <instancedMesh ref={rocksRef} args={[undefined, undefined, rockInstances.length]}>
        <icosahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#ffffff" roughness={0.94} metalness={0} />
      </instancedMesh>

      {/* Atmospheric perspective: near vegetation keeps saturation while the
          next ridges converge toward the fog colour as depth increases. */}
      <mesh
        position={[hillRadius * 0.72, groundY - hillRadius * 0.43, -hillRadius * 1.32]}
        scale={[1.55, 0.28, 1]}
      >
        <sphereGeometry args={[hillRadius * 0.9, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={palette.distantGrass} roughness={1} metalness={0} />
      </mesh>
      <mesh
        position={[-hillRadius * 1.18, groundY - hillRadius * 0.62, -hillRadius * 2.12]}
        scale={[2.05, 0.31, 1.15]}
      >
        <sphereGeometry args={[hillRadius * 0.82, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={palette.hazeHill} roughness={1} metalness={0} />
      </mesh>
      <mesh
        position={[hillRadius * 1.08, groundY - hillRadius * 0.8, -hillRadius * 3.05]}
        scale={[2.75, 0.28, 1.35]}
      >
        <sphereGeometry args={[hillRadius * 0.86, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={palette.hazeHillFar} roughness={1} metalness={0} />
      </mesh>

      {/* Sun core + two translucent shells create a cheap atmospheric halo. */}
      <mesh position={[-9.5, groundY + 8.5, -17]}>
        <sphereGeometry args={[1.7, 20, 14]} />
        <meshBasicMaterial
          color={palette.sunHalo}
          transparent
          opacity={0.045}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-9.5, groundY + 8.5, -17]}>
        <sphereGeometry args={[1.02, 20, 14]} />
        <meshBasicMaterial
          color={palette.sunHalo}
          transparent
          opacity={0.1}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-9.5, groundY + 8.5, -17]}>
        <sphereGeometry args={[0.58, 24, 16]} />
        <meshBasicMaterial color={palette.sun} toneMapped={false} />
      </mesh>

      <PortalCameraRig frame={frame} controls={controls} pose={pose} mode={motionMode} />

      {children}

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom={false}
        enableRotate={allowOrbit}
        enableDamping={!reduceMotion}
        dampingFactor={0.08}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}
