import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { ReefCoralColoniesManifest, ReefCoralColony } from '@/engine/species/reef';

const UP = new THREE.Vector3(0, 1, 0);

const TONES: Record<ReefCoralColony['morphotype'], readonly string[]> = {
  BRANCHING: ['#a85f62', '#b56f68', '#9e626c', '#ad7774'],
  MASSIVE: ['#9d765d', '#a88264', '#936d61', '#9f826c'],
  PLATE: ['#9c6672', '#a87478', '#916b75', '#ac7773'],
  ENCRUSTING: ['#77866f', '#808d70', '#737d69', '#89806b'],
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

function createBranchGeometry() {
  const geometry = new THREE.CylinderGeometry(0.075, 0.14, 1, 7, 4, false);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const y01 = y + 0.5;
    const bend = y01 * y01;
    position.setXYZ(
      index,
      x + bend * 0.09 + Math.sin(y01 * Math.PI * 2.2) * 0.018,
      y,
      z + bend * 0.035,
    );
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createPlateGeometry() {
  const geometry = new THREE.CylinderGeometry(1, 0.9, 1, 16, 1, false);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    const angle = Math.atan2(z, x);
    const radial = Math.hypot(x, z);
    const rimWave = radial > 0.72 ? Math.sin(angle * 5) * 0.08 + Math.cos(angle * 3) * 0.045 : 0;
    position.setY(index, y + rimWave);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
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
    branch: createBranchGeometry(),
    massive: new THREE.IcosahedronGeometry(1, 2),
    plate: createPlateGeometry(),
    encrusting: new THREE.IcosahedronGeometry(1, 1),
  }), []);
  const material = useMemo(() => ({
    branch: new THREE.MeshStandardMaterial({ color: '#a85f62', roughness: 0.94, metalness: 0, flatShading: true }),
    massive: new THREE.MeshStandardMaterial({ color: '#9d765d', roughness: 0.96, metalness: 0, flatShading: true }),
    plate: new THREE.MeshStandardMaterial({ color: '#9c6672', roughness: 0.95, metalness: 0 }),
    encrusting: new THREE.MeshStandardMaterial({ color: '#77866f', roughness: 0.98, metalness: 0, flatShading: true }),
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
        new THREE.Vector3(colony.radius * 0.92, colony.height * 0.82, colony.radius * 0.86),
        Math.max(0.012, colony.height * 0.03),
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
        new THREE.Vector3(colony.radius * 0.92, Math.max(0.045, colony.height * 0.34), colony.radius * 0.84),
        Math.max(0.015, colony.height * 0.18),
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
        new THREE.Vector3(colony.radius * 1.04, Math.max(0.035, colony.height * 0.48), colony.radius * 0.92),
        Math.max(0.01, colony.height * 0.05),
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
      const basePosition = colonyPosition(colony, 0.012);
      for (let branchIndex = 0; branchIndex < colony.branchCount; branchIndex += 1) {
        const fraction = branchIndex / Math.max(1, colony.branchCount);
        const angle = fraction * Math.PI * 2 + colony.tangentRotation * 0.26;
        const heightVariation = 0.72 + (branchIndex % 4) * 0.065;
        const branchHeight = colony.height * heightVariation;
        const radial = branchIndex === 0 ? 0 : colony.radius * (0.18 + (branchIndex % 3) * 0.035);
        const localOffset = new THREE.Vector3(
          Math.cos(angle) * radial,
          branchHeight * 0.47,
          Math.sin(angle) * radial,
        ).applyQuaternion(baseQuaternion);
        const position = basePosition.clone().add(localOffset);
        const lean = branchIndex === 0 ? 0.05 : 0.16 + (branchIndex % 3) * 0.055;
        const localRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(
          lean,
          angle,
          (branchIndex % 2 === 0 ? -1 : 1) * lean * 0.35,
          'YXZ',
        ));
        const quaternion = baseQuaternion.clone().multiply(localRotation);
        const scale = new THREE.Vector3(
          colony.radius * 1.08,
          branchHeight,
          colony.radius * 1.08,
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
    <group
      name="reef-phase-5-colonies"
      userData={{ renderer: 'phase-5-instanced-organic' }}
    >
      {branchInstanceCount > 0 ? (
        <instancedMesh ref={branchRef} args={[geometry.branch, material.branch, branchInstanceCount]} castShadow receiveShadow />
      ) : null}
      {massive.length > 0 ? (
        <instancedMesh ref={massiveRef} args={[geometry.massive, material.massive, massive.length]} castShadow receiveShadow />
      ) : null}
      {plates.length > 0 ? (
        <instancedMesh ref={plateRef} args={[geometry.plate, material.plate, plates.length]} castShadow receiveShadow />
      ) : null}
      {encrusting.length > 0 ? (
        <instancedMesh ref={encrustingRef} args={[geometry.encrusting, material.encrusting, encrusting.length]} receiveShadow />
      ) : null}
    </group>
  );
}
