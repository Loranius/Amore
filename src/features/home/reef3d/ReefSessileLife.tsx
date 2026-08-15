import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { REEF_SEABED_Y } from './reefTerracedFoundation';

type Vec3 = readonly [number, number, number];

const SPONGES = [
  { position: [-5.05, 0, 2.05] as Vec3, scale: [0.24, 0.42, 0.24] as Vec3, color: '#bd7652' },
  { position: [-4.55, 0, -0.45] as Vec3, scale: [0.18, 0.34, 0.18] as Vec3, color: '#d39a64' },
  { position: [4.75, 0, 1.9] as Vec3, scale: [0.22, 0.38, 0.22] as Vec3, color: '#c57b5e' },
  { position: [5.25, 0, -2.1] as Vec3, scale: [0.2, 0.31, 0.2] as Vec3, color: '#d0a05f' },
  { position: [-3.45, 0, -4.0] as Vec3, scale: [0.17, 0.27, 0.17] as Vec3, color: '#b86d62' },
  { position: [3.55, 0, -4.1] as Vec3, scale: [0.18, 0.3, 0.18] as Vec3, color: '#cc8f68' },
] as const;

const SOFT_CORALS = [
  { position: [-4.1, 0, 2.75] as Vec3, rotation: -0.35, scale: 0.74, color: '#987aa6' },
  { position: [4.2, 0, 2.7] as Vec3, rotation: 0.28, scale: 0.68, color: '#b5798e' },
  { position: [-4.85, 0, -3.0] as Vec3, rotation: 0.15, scale: 0.62, color: '#8f789e' },
  { position: [4.85, 0, -3.05] as Vec3, rotation: -0.2, scale: 0.66, color: '#ad7e96' },
] as const;

const SOFT_ARM_OFFSETS = [-0.18, 0, 0.19] as const;
const SOFT_ARM_COUNT = SOFT_CORALS.length * SOFT_ARM_OFFSETS.length;
const DOWN = new THREE.Vector3(0, -1, 0);

function collectGroundMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const environment = scene.getObjectByName('reef-environment-light-terraces');
  if (!environment) return [];
  const meshes: THREE.Mesh[] = [];
  environment.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    if (object.userData.reefContactPatchCount !== undefined) return;
    if (object.userData.reefSupportSurfaceKind === 'arch') return;
    meshes.push(object);
  });
  return meshes;
}

function groundYAt(
  meshes: THREE.Mesh[],
  raycaster: THREE.Raycaster,
  origin: THREE.Vector3,
  x: number,
  z: number,
): number {
  if (meshes.length === 0) return REEF_SEABED_Y;
  origin.set(x, 5, z);
  raycaster.set(origin, DOWN);
  raycaster.near = 0;
  raycaster.far = 8;
  return raycaster.intersectObjects(meshes, false)[0]?.point.y ?? REEF_SEABED_Y;
}

export function ReefSessileLife({ reducedMotion }: { reducedMotion: boolean }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const spongeRef = useRef<THREE.InstancedMesh>(null);
  const softRef = useRef<THREE.InstancedMesh>(null);
  const softGroundYRef = useRef<number[]>([]);
  const tickRef = useRef(0);
  const scratch = useMemo(() => ({
    raycaster: new THREE.Raycaster(),
    origin: new THREE.Vector3(),
    sponge: new THREE.Object3D(),
    coral: new THREE.Object3D(),
    arm: new THREE.Object3D(),
    matrix: new THREE.Matrix4(),
    color: new THREE.Color(),
  }), []);

  const updateSoftCorals = (time: number, animated: boolean) => {
    const mesh = softRef.current;
    if (!mesh) return;
    let instanceIndex = 0;

    SOFT_CORALS.forEach((coral, coralIndex) => {
      const phase = coral.position[0] * 0.71 + coral.position[2] * 0.39;
      const sway = animated ? Math.sin(time * 0.48 + phase) * 0.045 : 0;
      scratch.coral.position.set(
        coral.position[0],
        softGroundYRef.current[coralIndex] ?? REEF_SEABED_Y,
        coral.position[2],
      );
      scratch.coral.rotation.set(0, coral.rotation, sway);
      scratch.coral.scale.setScalar(coral.scale);
      scratch.coral.updateMatrix();
      scratch.color.set(coral.color);

      SOFT_ARM_OFFSETS.forEach((offset, armIndex) => {
        scratch.arm.position.set(offset, 0.18 + armIndex * 0.05, 0);
        scratch.arm.rotation.set(0, 0, offset * 0.65);
        scratch.arm.scale.set(1, 0.48 + armIndex * 0.08, 1);
        scratch.arm.updateMatrix();
        scratch.matrix.multiplyMatrices(scratch.coral.matrix, scratch.arm.matrix);
        mesh.setMatrixAt(instanceIndex, scratch.matrix);
        mesh.setColorAt(instanceIndex, scratch.color);
        instanceIndex += 1;
      });
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };

  useLayoutEffect(() => {
    scene.updateMatrixWorld(true);
    const groundMeshes = collectGroundMeshes(scene);
    const spongeMesh = spongeRef.current;
    const softMesh = softRef.current;
    if (!spongeMesh || !softMesh) return;

    spongeMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    SPONGES.forEach((sponge, index) => {
      const y = groundYAt(
        groundMeshes,
        scratch.raycaster,
        scratch.origin,
        sponge.position[0],
        sponge.position[2],
      ) + 0.012;
      scratch.sponge.position.set(sponge.position[0], y + sponge.scale[1] * 0.5, sponge.position[2]);
      scratch.sponge.rotation.set(0, 0, 0);
      scratch.sponge.scale.set(sponge.scale[0], sponge.scale[1], sponge.scale[2]);
      scratch.sponge.updateMatrix();
      spongeMesh.setMatrixAt(index, scratch.sponge.matrix);
      spongeMesh.setColorAt(index, scratch.color.set(sponge.color));
    });
    spongeMesh.instanceMatrix.needsUpdate = true;
    if (spongeMesh.instanceColor) spongeMesh.instanceColor.needsUpdate = true;

    softGroundYRef.current = SOFT_CORALS.map((coral) => groundYAt(
      groundMeshes,
      scratch.raycaster,
      scratch.origin,
      coral.position[0],
      coral.position[2],
    ) + 0.012);
    softMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    updateSoftCorals(0, false);
    invalidate();
  }, [invalidate, scene, scratch]);

  useFrame((state, delta) => {
    if (reducedMotion) return;
    tickRef.current += delta;
    if (tickRef.current < 0.055) return;
    tickRef.current = 0;
    updateSoftCorals(state.clock.elapsedTime, true);
  });

  return (
    <>
      <instancedMesh
        ref={spongeRef}
        args={[undefined, undefined, SPONGES.length]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.52, 0.72, 1, 8, 1, true]} />
        <meshStandardMaterial color="#ffffff" roughness={0.96} metalness={0} side={THREE.DoubleSide} />
      </instancedMesh>
      <instancedMesh
        ref={softRef}
        args={[undefined, undefined, SOFT_ARM_COUNT]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.035, 0.07, 1, 6]} />
        <meshStandardMaterial color="#ffffff" roughness={0.94} metalness={0} />
      </instancedMesh>
    </>
  );
}
