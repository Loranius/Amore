import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

type Vec3 = readonly [number, number, number];

type SupportBed = {
  center: readonly [number, number];
  radius: readonly [number, number];
  topY: number;
  edgeDrop: number;
};

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

// Cleanup pass: keep enough density for a living reef while removing the most
// obvious peripheral outliers that read as floating or detached props.
const BUSH_COUNT = 24;
const CUSHION_COUNT = 14;
const PLATE_COUNT = 8;

/**
 * Support map synchronized with sculpt pass 3. The first five beds now follow
 * the outward-projected cascade ledges; the final two remain on the planted
 * lower shoulders. Growth therefore travels with the terraces instead of being
 * left behind on the previous embedded shelf centres.
 */
const SUPPORT_BEDS: readonly SupportBed[] = [
  { center: [-0.92, 0.52], radius: [0.94, 0.6], topY: 0.3, edgeDrop: 0.035 },
  { center: [0.72, 0.24], radius: [0.98, 0.62], topY: 0.41, edgeDrop: 0.04 },
  { center: [-0.18, -0.43], radius: [0.82, 0.52], topY: 0.76, edgeDrop: 0.035 },
  { center: [0.42, 0.04], radius: [0.66, 0.46], topY: 0.95, edgeDrop: 0.03 },
  { center: [-0.36, 0.12], radius: [0.52, 0.37], topY: 1.1, edgeDrop: 0.025 },
  { center: [-1.12, 0.14], radius: [0.56, 0.48], topY: 0.1, edgeDrop: 0.055 },
  { center: [1.12, 0.18], radius: [0.56, 0.48], topY: 0.1, edgeDrop: 0.055 },
] as const;

const BUSH_BED_INDICES = [0, 1, 2, 3, 4, 5, 6] as const;
const CUSHION_BED_INDICES = [0, 1, 2, 5, 6] as const;
// Plate corals stay on actual shelf surfaces only. Keeping them off the lower
// shoulders removes the detached pale shards visible around the base.
const PLATE_BED_INDICES = [0, 1, 2] as const;

function seededUnit(index: number, salt: number): number {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function heightBand(seed: number): number {
  if (seed < 0.3) return THREE.MathUtils.lerp(0.55, 0.72, seed / 0.3);
  if (seed < 0.8) return THREE.MathUtils.lerp(0.74, 1.02, (seed - 0.3) / 0.5);
  return THREE.MathUtils.lerp(1.04, 1.26, (seed - 0.8) / 0.2);
}

function pointInBed(
  index: number,
  salt: number,
  bed: SupportBed,
  inset: number,
): readonly [number, number] {
  const angle = seededUnit(index, salt) * Math.PI * 2;
  const radius = Math.sqrt(seededUnit(index, salt + 1)) * inset;
  return [
    bed.center[0] + Math.cos(angle) * bed.radius[0] * radius,
    bed.center[1] + Math.sin(angle) * bed.radius[1] * radius,
  ];
}

function supportHeightAt(x: number, z: number): number {
  let supportY = -0.25;

  for (const bed of SUPPORT_BEDS) {
    const dx = (x - bed.center[0]) / bed.radius[0];
    const dz = (z - bed.center[1]) / bed.radius[1];
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance > 1) continue;

    const surfaceY = bed.topY - distance * bed.edgeDrop;
    supportY = Math.max(supportY, surfaceY);
  }

  return supportY;
}

function buildBushes(): Bush[] {
  return Array.from({ length: BUSH_COUNT }, (_, index) => {
    const bedIndex = BUSH_BED_INDICES[index % BUSH_BED_INDICES.length]!;
    const bed = SUPPORT_BEDS[bedIndex]!;
    // Branch roots can approach the shelf edge, but not enough for their arms to
    // visibly overhang unsupported space.
    const [x, z] = pointInBed(index, 1, bed, 0.68);
    const highTerraceScale = bed.topY >= 0.7 ? 0.72 : 0.94;
    const shoulderScale = bedIndex >= 5 ? 0.82 : 1;
    const scale = heightBand(seededUnit(index, 3)) * highTerraceScale * shoulderScale;

    return {
      position: [x, supportHeightAt(x, z) + seededUnit(index, 4) * 0.01, z],
      rotation: seededUnit(index, 5) * Math.PI * 2,
      scale,
      tone: seededUnit(index, 6),
      spread: THREE.MathUtils.lerp(0.15, 0.26, seededUnit(index, 7)),
    };
  });
}

function buildCushions(): Cushion[] {
  return Array.from({ length: CUSHION_COUNT }, (_, index) => {
    const bedIndex = CUSHION_BED_INDICES[index % CUSHION_BED_INDICES.length]!;
    const bed = SUPPORT_BEDS[bedIndex]!;
    const [x, z] = pointInBed(index, 11, bed, 0.62);
    const squash = THREE.MathUtils.lerp(0.14, 0.23, seededUnit(index, 13));
    const width = THREE.MathUtils.lerp(0.23, 0.4, seededUnit(index, 14));

    return {
      position: [x, supportHeightAt(x, z) + squash * 0.82, z],
      rotation: [
        (seededUnit(index, 16) - 0.5) * 0.14,
        seededUnit(index, 17) * Math.PI * 2,
        (seededUnit(index, 18) - 0.5) * 0.12,
      ],
      scale: [width, squash, width * THREE.MathUtils.lerp(0.84, 1.14, seededUnit(index, 19))],
      tone: seededUnit(index, 20),
    };
  });
}

function buildPlates(): Plate[] {
  return Array.from({ length: PLATE_COUNT }, (_, index) => {
    const bedIndex = PLATE_BED_INDICES[index % PLATE_BED_INDICES.length]!;
    const bed = SUPPORT_BEDS[bedIndex]!;
    // Plates have the widest footprint, so keep their centres deepest inside a
    // ledge. This is the strongest guard against detached-looking pale shards.
    const [x, z] = pointInBed(index, 31, bed, 0.54);
    const radius = THREE.MathUtils.lerp(0.19, 0.32, seededUnit(index, 33));
    const thickness = THREE.MathUtils.lerp(0.06, 0.09, seededUnit(index, 38));

    return {
      position: [x, supportHeightAt(x, z) + thickness * 0.5, z],
      rotation: [
        THREE.MathUtils.lerp(-0.13, 0.13, seededUnit(index, 35)),
        seededUnit(index, 36) * Math.PI * 2,
        THREE.MathUtils.lerp(-0.11, 0.11, seededUnit(index, 37)),
      ],
      scale: [radius, thickness, radius * 0.82],
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
 * Reef density sculpt pass 3.
 *
 * Supplemental growth remains pruned and surface-anchored, but the support map
 * now follows the exposed cascade shelves so every prop moves with its terrace.
 */
export function ReefDensityLayer() {
  return (
    <group name="reef-density-cascade-ledges">
      <CushionCorals />
      <PlateCorals />
      <BushCorals />
    </group>
  );
}
