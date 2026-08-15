import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ReefCoralColoniesManifest, ReefCoralColony } from '@/engine/species/reef';

const UP = new THREE.Vector3(0, 1, 0);

const TONES: Record<ReefCoralColony['morphotype'], readonly string[]> = {
  BRANCHING: ['#c87872', '#d08a78', '#b96f82', '#c98d92'],
  MASSIVE: ['#b88962', '#c1976d', '#a77968', '#b99a7a'],
  PLATE: ['#b86f82', '#c7838c', '#aa7887', '#cf8b82'],
  ENCRUSTING: ['#7f927c', '#8c9b78', '#7f8870', '#9a8e73'],
};

function colonyQuaternion(colony: ReefCoralColony): THREE.Quaternion {
  const normal = new THREE.Vector3(colony.normal.x, colony.normal.y, colony.normal.z).normalize();
  const surface = new THREE.Quaternion().setFromUnitVectors(UP, normal);
  const tangent = new THREE.Quaternion().setFromAxisAngle(UP, colony.tangentRotation);
  return surface.multiply(tangent);
}

function colonyPosition(colony: ReefCoralColony, lift: number): THREE.Vector3 {
  return new THREE.Vector3(
    colony.position.x + colony.normal.x * lift,
    colony.position.y + colony.normal.y * lift,
    colony.position.z + colony.normal.z * lift,
  );
}

function setInstance(
  mesh: THREE.InstancedMesh,
  index: number,
  colony: ReefCoralColony,
  scale: THREE.Vector3,
  lift: number,
) {
  const matrix = new THREE.Matrix4();
  matrix.compose(colonyPosition(colony, lift), colonyQuaternion(colony), scale);
  mesh.setMatrixAt(index, matrix);
  const tones = TONES[colony.morphotype];
  mesh.setColorAt(index, new THREE.Color(tones[colony.toneIndex % tones.length]));
}

export function ReefCoralColoniesObject({ manifest }: { manifest: ReefCoralColoniesManifest }) {
  const branching = useMemo(
    () => manifest.colonies.filter((colony) => colony.morphotype === 'BRANCHING'),
    [manifest.colonies],
  );
  const massive = useMemo(
    () => manifest.colonies.filter((colony) => colony.morphotype === 'MASSIVE'),
    [manifest.colonies],
  );
  const plates = useMemo(
    () => manifest.colonies.filter((colony) => colony.morphotype === 'PLATE'),
    [manifest.colonies],
  );
  const encrusting = useMemo(
    () => manifest.colonies.filter((colony) => colony.morphotype === 'ENCRUSTING'),
    [manifest.colonies],
  );
  const branchInstanceCount = useMemo(
    () => branching.reduce((sum, colony) => sum + colony.branchCount, 0),
    [branching],
  );

  const branchRef = useRef<THREE.InstancedMesh>(null);
  const massiveRef = useRef<THREE.InstancedMesh>(null);
  const plateRef = useRef<THREE.InstancedMesh>(null);
  const encrustingRef = useRef<THREE.InstancedMesh>(null);

  const geometry = useMemo(() => ({
    branch: new THREE.CylinderGeometry(0.18, 0.28, 1, 6, 2, false),
    massive: new THREE.IcosahedronGeometry(1, 1),
    plate: new THREE.CylinderGeometry(1, 0.72, 1, 12, 1, false),
    encrusting: new THREE.SphereGeometry(1, 12, 8),
  }), []);
  const material = useMemo(() => ({
    branch: new THREE.MeshStandardMaterial({ color: '#c87872', roughness: 0.88, metalness: 0 }),
    massive: new THREE.MeshStandardMaterial({ color: '#b88962', roughness: 0.92, metalness: 0 }),
    plate: new THREE.MeshStandardMaterial({ color: '#b86f82', roughness: 0.9, metalness: 0 }),
    encrusting: new THREE.MeshStandardMaterial({ color: '#7f927c', roughness: 0.94, metalness: 0 }),
  }), []);

  useEffect(() => () => {
    Object.values(geometry).forEach((item) => item.dispose());
    Object.values(material).forEach((item) => item.dispose());
  }, [geometry, material]);

  useLayoutEffect(() => {
    const mesh = massiveRef.current;
    if (!mesh) return;
    massive.forEach((colony, index) => {
      setInstance(
        mesh,
        index,
        colony,
        new THREE.Vector3(colony.radius, colony.height, colony.radius * 0.92),
        Math.max(0.025, colony.height * 0.08),
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [massive]);

  useLayoutEffect(() => {
    const mesh = plateRef.current;
    if (!mesh) return;
    plates.forEach((colony, index) => {
      setInstance(
        mesh,
        index,
        colony,
        new THREE.Vector3(colony.radius, colony.height, colony.radius * 0.88),
        Math.max(0.025, colony.height * 0.48),
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [plates]);

  useLayoutEffect(() => {
    const mesh = encrustingRef.current;
    if (!mesh) return;
    encrusting.forEach((colony, index) => {
      setInstance(
        mesh,
        index,
        colony,
        new THREE.Vector3(colony.radius, colony.height, colony.radius * 0.84),
        Math.max(0.018, colony.height * 0.22),
      );
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [encrusting]);

  useLayoutEffect(() => {
    const mesh = branchRef.current;
    if (!mesh) return;
    let instance = 0;
    branching.forEach((colony) => {
      const baseQuaternion = colonyQuaternion(colony);
      const basePosition = colonyPosition(colony, 0.025);
      for (let branchIndex = 0; branchIndex < colony.branchCount; branchIndex += 1) {
        const fraction = branchIndex / Math.max(1, colony.branchCount);
        const angle = fraction * Math.PI * 2 + colony.tangentRotation * 0.22;
        const branchHeight = colony.height * (0.82 + (branchIndex % 3) * 0.07);
        const radial = branchIndex === 0 ? 0 : colony.radius * 0.22;
        const localOffset = new THREE.Vector3(
          Math.cos(angle) * radial,
          branchHeight * 0.5,
          Math.sin(angle) * radial,
        ).applyQuaternion(baseQuaternion);
        const position = basePosition.clone().add(localOffset);
        const localRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          branchIndex === 0 ? 0 : 0.14 + (branchIndex % 2) * 0.08,
          angle,
          0,
          'YXZ',
        ));
        const quaternion = baseQuaternion.clone().multiply(localRotation);
        const scale = new THREE.Vector3(
          colony.radius * 1.55,
          branchHeight,
          colony.radius * 1.55,
        );
        const matrix = new THREE.Matrix4().compose(position, quaternion, scale);
        mesh.setMatrixAt(instance, matrix);
        const tones = TONES.BRANCHING;
        mesh.setColorAt(instance, new THREE.Color(tones[colony.toneIndex % tones.length]));
        instance += 1;
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [branching]);

  return (
    <group data-reef-coral-renderer="phase-5-instanced">
      {branchInstanceCount > 0 ? (
        <instancedMesh
          ref={branchRef}
          args={[geometry.branch, material.branch, branchInstanceCount]}
          castShadow
          receiveShadow
        />
      ) : null}
      {massive.length > 0 ? (
        <instancedMesh
          ref={massiveRef}
          args={[geometry.massive, material.massive, massive.length]}
          castShadow
          receiveShadow
        />
      ) : null}
      {plates.length > 0 ? (
        <instancedMesh
          ref={plateRef}
          args={[geometry.plate, material.plate, plates.length]}
          castShadow
          receiveShadow
        />
      ) : null}
      {encrusting.length > 0 ? (
        <instancedMesh
          ref={encrustingRef}
          args={[geometry.encrusting, material.encrusting, encrusting.length]}
          receiveShadow
        />
      ) : null}
    </group>
  );
}
