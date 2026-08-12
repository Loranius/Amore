import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type Vec3 = readonly [number, number, number];

type Bush = {
  position: Vec3;
  rotation: number;
  scale: number;
  tone: number;
  spread: number;
};

type Cushion = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  tone: number;
};

type Plate = {
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
  tone: number;
};

const BUSH_COUNT = 28;
const CUSHION_COUNT = 18;
const PLATE_COUNT = 12;

const CLUSTERS = [
  { center: [0.05, -0.06, 0.25] as Vec3, radius: 1.48, height: 1.08 },
  { center: [0.15, -0.05, 0.05] as Vec3, radius: 1.2, height: 1.14 },
  { center: [-1.72, -0.11, 0.52] as Vec3, radius: 0.92, height: 0.9 },
  { center: [1.78, -0.1, -0.2] as Vec3, radius: 0.88, height: 0.86 },
] as const;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function heightBand(seed: number): number {
  // 30% low, 50% medium, 20% high. High accents remain rare enough that the
  // accepted hero branches keep owning the silhouette.
  if (seed < 0.3) return THREE.MathUtils.lerp(0.55, 0.72, seed / 0.3);
  if (seed < 0.8) return THREE.MathUtils.lerp(0.74, 1.02, (seed - 0.3) / 0.5);
  return THREE.MathUtils.lerp(1.04, 1.26, (seed - 0.8) / 0.2);
}

function buildBushes(): Bush[] {
  return Array.from({ length: BUSH_COUNT }, (_, index) => {
    const cluster = CLUSTERS[index % CLUSTERS.length]!;
    const angle = seededUnit(index, 1) * Math.PI * 2;
    const radius = Math.sqrt(seededUnit(index, 2)) * cluster.radius;
    const scale = heightBand(seededUnit(index, 3)) * cluster.height;

    return {
      position: [
        cluster.center[0] + Math.cos(angle) * radius,
        cluster.center[1] + seededUnit(index, 4) * 0.055,
        cluster.center[2] + Math.sin(angle) * radius,
      ],
      rotation: seededUnit(index, 5) * Math.PI * 2,
      scale,
      tone: seededUnit(index, 6),
      spread: THREE.MathUtils.lerp(0.16, 0.29, seededUnit(index, 7)),
    };
  });
}

function buildCushions(): Cushion[] {
  return Array.from({ length: CUSHION_COUNT }, (_, index) => {
    const central = index < 11;
    const angle = seededUnit(index, 11) * Math.PI * 2;
    const radius = Math.sqrt(seededUnit(index, 12)) * (central ? 1.72 : 2.45);
    const squash = THREE.MathUtils.lerp(0.17, 0.31, seededUnit(index, 13));
    const width = THREE.MathUtils.lerp(0.26, 0.52, seededUnit(index, 14));

    return {
      position: [
        Math.cos(angle) * radius + (central ? 0 : (seededUnit(index, 15) - 0.5) * 0.7),
        -0.11 + squash * 0.42,
        Math.sin(angle) * radius + 0.18,
      ],
      rotation: [
        (seededUnit(index, 16) - 0.5) * 0.22,
        seededUnit(index, 17) * Math.PI * 2,
        (seededUnit(index, 18) - 0.5) * 0.18,
      ],
      scale: [width, squash, width * THREE.MathUtils.lerp(0.82, 1.18, seededUnit(index, 19))],
      tone: seededUnit(index, 20),
    };
  });
}

function buildPlates(): Plate[] {
  return Array.from({ length: PLATE_COUNT }, (_, index) => {
    const side = index % 2 === 0 ? -1 : 1;
    const x = side * THREE.MathUtils.lerp(0.65, 2.25, seededUnit(index, 31));
    const z = THREE.MathUtils.lerp(-1.25, 1.55, seededUnit(index, 32));
    const radius = THREE.MathUtils.lerp(0.24, 0.46, seededUnit(index, 33));

    return {
      position: [x, THREE.MathUtils.lerp(-0.03, 0.18, seededUnit(index, 34)), z],
      rotation: [
        THREE.MathUtils.lerp(-0.26, 0.26, seededUnit(index, 35)),
        seededUnit(index, 36) * Math.PI * 2,
        THREE.MathUtils.lerp(-0.2, 0.2, seededUnit(index, 37)),
      ],
      scale: [radius, THREE.MathUtils.lerp(0.07, 0.12, seededUnit(index, 38)), radius * 0.82],
      tone: seededUnit(index, 39),
    };
  });
}

function BushCorals() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const bushes = useMemo(buildBushes, []);
  const armCount = bushes.length * 3;

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const dark = new THREE.Color('#645982');
    const light = new THREE.Color('#9a718d');
    const color = new THREE.Color();

    bushes.forEach((bush, bushIndex) => {
      for (let armIndex = 0; armIndex < 3; armIndex += 1) {
        const instanceIndex = bushIndex * 3 + armIndex;
        const armOffset = armIndex - 1;
        const height = bush.scale * (0.56 + armIndex * 0.09);
        const localAngle = bush.rotation + armOffset * bush.spread * 2.8;
        const outward = Math.abs(armOffset) * bush.spread;

        dummy.position.set(
          bush.position[0] + Math.cos(localAngle) * outward * 0.42,
          bush.position[1] + height * 0.31,
          bush.position[2] + Math.sin(localAngle) * outward * 0.42,
        );
        dummy.rotation.set(
          Math.sin(localAngle) * armOffset * 0.17,
          localAngle,
          -Math.cos(localAngle) * armOffset * 0.21,
        );
        dummy.scale.set(
          0.82 + bush.tone * 0.2,
          height,
          0.82 + bush.tone * 0.2,
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(instanceIndex, dummy.matrix);

        color.copy(dark).lerp(light, Math.min(1, bush.tone * 0.72 + armIndex * 0.12));
        mesh.setColorAt(instanceIndex, color);
      }
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bushes]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, armCount]}>
      <cylinderGeometry args={[0.032, 0.072, 0.62, 6]} />
      <meshStandardMaterial color="#ffffff" roughness={0.94} metalness={0} />
    </instancedMesh>
  );
}

function CushionCorals() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const cushions = useMemo(buildCushions, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const dark = new THREE.Color('#667866');
    const light = new THREE.Color('#a88a72');
    const color = new THREE.Color();

    cushions.forEach((cushion, index) => {
      dummy.position.set(cushion.position[0], cushion.position[1], cushion.position[2]);
      dummy.rotation.set(cushion.rotation[0], cushion.rotation[1], cushion.rotation[2]);
      dummy.scale.set(cushion.scale[0], cushion.scale[1], cushion.scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(dark).lerp(light, cushion.tone);
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [cushions]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, cushions.length]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.97} metalness={0} />
    </instancedMesh>
  );
}

function PlateCorals() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const plates = useMemo(buildPlates, []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const dark = new THREE.Color('#718b79');
    const light = new THREE.Color('#b2c19d');
    const color = new THREE.Color();

    plates.forEach((plate, index) => {
      dummy.position.set(plate.position[0], plate.position[1], plate.position[2]);
      dummy.rotation.set(plate.rotation[0], plate.rotation[1], plate.rotation[2]);
      dummy.scale.set(plate.scale[0], plate.scale[1], plate.scale[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.copy(dark).lerp(light, plate.tone);
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plates]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, plates.length]}>
      <cylinderGeometry args={[1, 1.08, 1, 7, 1]} />
      <meshStandardMaterial color="#ffffff" roughness={0.95} metalness={0} />
    </instancedMesh>
  );
}

/**
 * Reef density pass 1.
 *
 * This is deliberately a visual companion to the accepted ReefObject rather
 * than a second production reef implementation. Three cheap instanced masses
 * fill the negative space inside the hero footprint: short bush corals, low
 * cushion forms and a few plate corals. Density peaks in the centre and falls
 * toward the sides so the generated colony remains the dominant silhouette.
 */
export function ReefDensityLayer() {
  return (
    <group name="reef-density-pass-1">
      <CushionCorals />
      <PlateCorals />
      <BushCorals />
    </group>
  );
}
