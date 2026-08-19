import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PORTAL_GROUND_Y } from './portalScene';

interface FloatingTempleSceneProps {
  seed: number;
  theme: 'light' | 'dark';
  quality: 'high' | 'balanced' | 'low' | 'fallback';
  daisScale: number;
}

const TAU = Math.PI * 2;
const COLUMN_COUNT = 6;
const STEP_COUNT = 14;
const FINGER_COUNT = 5;
const ARM_SEGMENT_COUNT = 3;

interface FingerSpec {
  x: number;
  z: number;
  yaw: number;
  length: number;
  radius: number;
}

const FINGERS: readonly FingerSpec[] = [
  { x: -1.32, z: 1.34, yaw: -0.2, length: 1.46, radius: 0.23 },
  { x: -0.62, z: 1.56, yaw: -0.08, length: 1.62, radius: 0.24 },
  { x: 0.1, z: 1.62, yaw: 0.03, length: 1.72, radius: 0.25 },
  { x: 0.82, z: 1.48, yaw: 0.14, length: 1.55, radius: 0.23 },
  { x: 1.44, z: 1.18, yaw: 0.34, length: 1.26, radius: 0.21 },
];

const ARM_SEGMENTS: readonly (readonly [
  readonly [number, number, number],
  readonly [number, number, number],
])[] = [
  [[0.15, -0.5, -0.72], [0.45, -0.72, -1.9]],
  [[0.45, -0.72, -1.9], [0.72, -0.96, -3.05]],
  [[0.72, -0.96, -3.05], [0.55, -1.22, -4.08]],
];

function disturbRock(
  geometry: THREE.BufferGeometry,
  amount: number,
  phase: number,
): THREE.BufferGeometry {
  const positions = geometry.getAttribute('position');
  for (let index = 0; index < positions.count; index += 1) {
    const x = positions.getX(index);
    const y = positions.getY(index);
    const z = positions.getZ(index);
    const wave = Math.sin(x * 4.7 + y * 8.3 + z * 5.9 + phase) * 0.5
      + Math.sin(x * 11.1 - y * 3.7 + z * 7.4 - phase * 0.63) * 0.5;
    const scale = 1 + wave * amount;
    positions.setXYZ(index, x * scale, y * scale, z * scale);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function cylinderMatrix(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  radius: number,
): THREE.Matrix4 {
  const start = new THREE.Vector3(from[0], from[1], from[2]);
  const end = new THREE.Vector3(to[0], to[1], to[2]);
  const direction = end.clone().sub(start);
  const length = Math.max(1e-4, direction.length());
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );
  return new THREE.Matrix4().compose(
    midpoint,
    quaternion,
    new THREE.Vector3(radius, length, radius),
  );
}

export function FloatingTempleScene({
  seed,
  theme,
  quality,
  daisScale,
}: FloatingTempleSceneProps) {
  const columnsRef = useRef<THREE.InstancedMesh>(null);
  const basesRef = useRef<THREE.InstancedMesh>(null);
  const capitalsRef = useRef<THREE.InstancedMesh>(null);
  const stepsRef = useRef<THREE.InstancedMesh>(null);
  const fingersRef = useRef<THREE.InstancedMesh>(null);
  const armRef = useRef<THREE.InstancedMesh>(null);
  const guardiansRef = useRef<THREE.InstancedMesh>(null);
  const guardianHeadsRef = useRef<THREE.InstancedMesh>(null);

  const templeRadius = Math.min(3.15, Math.max(2.12, daisScale * 1.5));
  const columnHeight = 2.24;
  const columnBaseY = PORTAL_GROUND_Y - 0.16;
  const ringY = columnBaseY + columnHeight + 0.04;
  const guardianCount = quality === 'fallback' ? 0 : COLUMN_COUNT;

  const palette = useMemo(() => {
    if (theme === 'light') {
      return {
        stone: '#d7d5cf',
        stoneDark: '#9f9f9a',
        rock: '#72766f',
        moss: '#74866f',
        edge: '#c7c2b8',
      };
    }
    return {
      stone: '#686273',
      stoneDark: '#423d4d',
      rock: '#292734',
      moss: '#31453d',
      edge: '#81768d',
    };
  }, [theme]);

  const materials = useMemo(() => ({
    stone: new THREE.MeshStandardMaterial({
      color: palette.stone,
      roughness: 0.93,
      metalness: 0,
    }),
    stoneDark: new THREE.MeshStandardMaterial({
      color: palette.stoneDark,
      roughness: 0.98,
      metalness: 0,
    }),
    rock: new THREE.MeshStandardMaterial({
      color: palette.rock,
      roughness: 1,
      metalness: 0,
      flatShading: true,
    }),
    moss: new THREE.MeshStandardMaterial({
      color: palette.moss,
      roughness: 1,
      metalness: 0,
    }),
    edge: new THREE.MeshStandardMaterial({
      color: palette.edge,
      roughness: 0.9,
      metalness: 0,
    }),
  }), [palette]);

  const geometry = useMemo(() => {
    const rockDetail = quality === 'high' ? 2 : 1;
    const phase = (Math.abs(seed) % 10_000) * 0.011;
    return {
      column: new THREE.CylinderGeometry(1, 1.08, 1, 12, 1),
      base: new THREE.CylinderGeometry(1.36, 1.52, 0.18, 12, 1),
      capital: new THREE.CylinderGeometry(1.45, 1.1, 0.2, 12, 1),
      step: new THREE.BoxGeometry(0.92, 0.12, 0.42),
      finger: new THREE.CylinderGeometry(1, 1.08, 1, 10, 1),
      arm: new THREE.CylinderGeometry(1, 1.15, 1, 10, 1),
      guardian: new THREE.CylinderGeometry(0.16, 0.24, 0.56, 7, 1),
      guardianHead: new THREE.IcosahedronGeometry(0.14, 1),
      island: disturbRock(new THREE.IcosahedronGeometry(1, rockDetail), 0.13, phase),
      palm: new THREE.SphereGeometry(1, 18, 10),
      topSlab: new THREE.CylinderGeometry(1, 1.04, 0.22, 48, 1),
      mossCap: new THREE.CylinderGeometry(1, 1.03, 0.09, 32, 1),
      topRing: new THREE.TorusGeometry(1, 0.15, 8, 48),
      ringLip: new THREE.TorusGeometry(1, 0.055, 6, 48),
    };
  }, [quality, seed]);

  useEffect(() => () => {
    for (const item of Object.values(geometry)) item.dispose();
    for (const item of Object.values(materials)) item.dispose();
  }, [geometry, materials]);

  useLayoutEffect(() => {
    const columns = columnsRef.current;
    const bases = basesRef.current;
    const capitals = capitalsRef.current;
    if (columns === null || bases === null || capitals === null) return;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let index = 0; index < COLUMN_COUNT; index += 1) {
      const angle = (index / COLUMN_COUNT) * TAU + Math.PI / COLUMN_COUNT;
      const x = Math.sin(angle) * templeRadius;
      const z = Math.cos(angle) * templeRadius;

      position.set(x, columnBaseY + columnHeight * 0.5, z);
      scale.set(0.24, columnHeight, 0.24);
      quaternion.setFromEuler(new THREE.Euler(0, angle, 0));
      columns.setMatrixAt(index, matrix.compose(position, quaternion, scale));

      position.set(x, columnBaseY + 0.02, z);
      scale.set(0.26, 1, 0.26);
      bases.setMatrixAt(index, matrix.compose(position, quaternion, scale));

      position.set(x, columnBaseY + columnHeight - 0.02, z);
      scale.set(0.27, 1, 0.27);
      capitals.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    }

    columns.instanceMatrix.needsUpdate = true;
    bases.instanceMatrix.needsUpdate = true;
    capitals.instanceMatrix.needsUpdate = true;
    columns.computeBoundingSphere();
    bases.computeBoundingSphere();
    capitals.computeBoundingSphere();
  }, [columnBaseY, columnHeight, templeRadius]);

  useLayoutEffect(() => {
    const mesh = fingersRef.current;
    if (mesh === null) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let index = 0; index < FINGERS.length; index += 1) {
      const finger = FINGERS[index]!;
      position.set(finger.x, PORTAL_GROUND_Y - 0.42, finger.z);
      quaternion.setFromEuler(new THREE.Euler(Math.PI / 2, finger.yaw, 0));
      scale.set(finger.radius, finger.length, finger.radius);
      mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    }
    mesh.count = FINGER_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  useLayoutEffect(() => {
    const mesh = armRef.current;
    if (mesh === null) return;
    for (let index = 0; index < ARM_SEGMENTS.length; index += 1) {
      const segment = ARM_SEGMENTS[index]!;
      const matrix = cylinderMatrix(
        [segment[0][0], PORTAL_GROUND_Y + segment[0][1], segment[0][2]],
        [segment[1][0], PORTAL_GROUND_Y + segment[1][1], segment[1][2]],
        0.62 - index * 0.06,
      );
      mesh.setMatrixAt(index, matrix);
    }
    mesh.count = ARM_SEGMENT_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  useLayoutEffect(() => {
    const mesh = stepsRef.current;
    if (mesh === null) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    for (let index = 0; index < STEP_COUNT; index += 1) {
      const t = index / (STEP_COUNT - 1);
      const x = 0.55 + Math.sin(t * Math.PI) * 0.16;
      const y = PORTAL_GROUND_Y - 0.5 - t * 0.72;
      const z = -0.9 - t * 3.12;
      position.set(x, y, z);
      quaternion.setFromEuler(new THREE.Euler(-0.22, 0, 0));
      scale.set(1, 1, 1);
      mesh.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    }
    mesh.count = STEP_COUNT;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, []);

  useLayoutEffect(() => {
    const bodies = guardiansRef.current;
    const heads = guardianHeadsRef.current;
    if (bodies === null || heads === null) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3(1, 1, 1);

    for (let index = 0; index < guardianCount; index += 1) {
      const angle = (index / COLUMN_COUNT) * TAU + Math.PI / COLUMN_COUNT;
      const radius = templeRadius * 0.97;
      const x = Math.sin(angle) * radius;
      const z = Math.cos(angle) * radius;
      quaternion.setFromEuler(new THREE.Euler(0, angle + Math.PI, 0));

      position.set(x, ringY + 0.37, z);
      bodies.setMatrixAt(index, matrix.compose(position, quaternion, scale));

      position.set(x, ringY + 0.77, z);
      heads.setMatrixAt(index, matrix.compose(position, quaternion, scale));
    }
    bodies.count = guardianCount;
    heads.count = guardianCount;
    bodies.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    bodies.computeBoundingSphere();
    heads.computeBoundingSphere();
  }, [guardianCount, ringY, templeRadius]);

  return (
    <group>
      {/* Верхній майданчик лежить прямо під існуючим релікварієм Amore. */}
      <mesh
        geometry={geometry.topSlab}
        material={materials.stone}
        position={[0, PORTAL_GROUND_Y - 0.27, 0]}
        scale={[templeRadius * 1.08, 1, templeRadius * 1.08]}
      />

      {/* Долоня: пласка маса під майданчиком + п'ять окремих пальців. */}
      <mesh
        geometry={geometry.palm}
        material={materials.stoneDark}
        position={[0, PORTAL_GROUND_Y - 0.5, 0.14]}
        scale={[2.35, 0.34, 1.58]}
      />
      <instancedMesh ref={fingersRef} args={[geometry.finger, materials.stoneDark, FINGER_COUNT]} frustumCulled={false} />
      <instancedMesh ref={armRef} args={[geometry.arm, materials.stoneDark, ARM_SEGMENT_COUNT]} frustumCulled={false} />

      {/* Сходи йдуть по передній площині зап'ястя до острова. */}
      <instancedMesh ref={stepsRef} args={[geometry.step, materials.edge, STEP_COUNT]} frustumCulled={false} />

      {/* Плаваючий кам'яний острів. Верх трохи зеленіший за нижню скелю. */}
      <mesh
        geometry={geometry.island}
        material={materials.rock}
        position={[0.55, PORTAL_GROUND_Y - 1.65, -4.48]}
        scale={[3.25, 1.12, 2.7]}
      />
      <mesh
        geometry={geometry.mossCap}
        material={materials.moss}
        position={[0.55, PORTAL_GROUND_Y - 0.92, -4.48]}
        scale={[2.95, 1, 2.42]}
      />

      {/* Круглий храм навколо кристала. Колони й капітелі інстансовані. */}
      <instancedMesh ref={columnsRef} args={[geometry.column, materials.stone, COLUMN_COUNT]} frustumCulled={false} />
      <instancedMesh ref={basesRef} args={[geometry.base, materials.edge, COLUMN_COUNT]} frustumCulled={false} />
      <instancedMesh ref={capitalsRef} args={[geometry.capital, materials.edge, COLUMN_COUNT]} frustumCulled={false} />

      <mesh
        geometry={geometry.topRing}
        material={materials.stone}
        position={[0, ringY, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[templeRadius, templeRadius, templeRadius]}
      />
      <mesh
        geometry={geometry.ringLip}
        material={materials.edge}
        position={[0, ringY - 0.13, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[templeRadius * 1.01, templeRadius * 1.01, templeRadius * 1.01]}
      />

      {/* У першій ітерації це навмисно стилізовані кам'яні хранителі,
          а не детальні людські моделі: силует уже дає композицію референсу,
          а GLB-скульптури можна підмінити пізніше без зміни розкладки. */}
      <instancedMesh ref={guardiansRef} args={[geometry.guardian, materials.stoneDark, COLUMN_COUNT]} frustumCulled={false} />
      <instancedMesh ref={guardianHeadsRef} args={[geometry.guardianHead, materials.stoneDark, COLUMN_COUNT]} frustumCulled={false} />
    </group>
  );
}
