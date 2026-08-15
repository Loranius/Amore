import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { ReefCoreManifest } from '@/engine/species/reef';

function createCoreRockGeometry(core: ReefCoreManifest): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 56, 36);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const {
    phaseA,
    phaseB,
    ruggedness,
    asymmetry,
    shoulderBias,
    leanX,
    leanZ,
  } = core.morphology;

  for (let index = 0; index < position.count; index += 1) {
    const sourceX = position.getX(index);
    const sourceY = position.getY(index);
    const sourceZ = position.getZ(index);
    const length = Math.hypot(sourceX, sourceY, sourceZ) || 1;
    const nx = sourceX / length;
    const ny = sourceY / length;
    const nz = sourceZ / length;
    const azimuth = Math.atan2(nz, nx);
    const y01 = (ny + 1) * 0.5;

    const macroNoise =
      Math.sin(azimuth * 3 + phaseA + ny * 1.45) * 0.5
      + Math.cos(azimuth * 5 - phaseB + ny * 2.2) * 0.3
      + Math.sin(azimuth * 2 + phaseB * 0.7 - ny * 3.1) * 0.2;
    const verticalNoise =
      Math.sin(y01 * Math.PI * 3.2 + phaseB) * 0.55
      + Math.cos(azimuth * 4 + phaseA) * 0.45;
    const radialNoise = 1 + ruggedness * macroNoise * (0.78 + 0.22 * Math.sin(Math.PI * y01));
    const shoulder = 1 + (shoulderBias - 1) * Math.sin(Math.PI * y01) * 0.42;
    const sideBias = 1 + asymmetry * Math.cos(azimuth - phaseA);
    const crownCompression = 1 - Math.max(0, y01 - 0.78) * 0.16;

    let x = nx * core.dimensions.radiusX * radialNoise * shoulder * sideBias;
    let z = nz * core.dimensions.radiusZ * radialNoise * shoulder / sideBias;
    let y = y01 * core.dimensions.height;
    y *= 1 + ruggedness * 0.055 * verticalNoise;

    x += leanX * core.dimensions.height * y01;
    z += leanZ * core.dimensions.height * y01;
    x *= crownCompression;
    z *= crownCompression;
    y -= core.platform.thickness * 0.12;
    position.setXYZ(index, x, y, z);
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

function createCorePlatformGeometry(core: ReefCoreManifest): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(1, 1, 1, 64, 5, false);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const phaseA = (core.platform.seed % 10_000) / 10_000 * Math.PI * 2;
  const phaseB = ((core.platform.seed >>> 8) % 10_000) / 10_000 * Math.PI * 2;

  for (let index = 0; index < position.count; index += 1) {
    const sourceX = position.getX(index);
    const sourceY = position.getY(index);
    const sourceZ = position.getZ(index);
    const angle = Math.atan2(sourceZ, sourceX);
    const y01 = sourceY + 0.5;
    const edgeNoise = 1 + core.platform.irregularity * (
      Math.sin(angle * 3 + phaseA) * 0.55
      + Math.cos(angle * 5 - phaseB) * 0.3
      + Math.sin(angle * 7 + phaseB) * 0.15
    );
    const verticalRoughness = core.platform.irregularity * 0.09 * (
      Math.cos(angle * 4 + phaseA) + Math.sin(angle * 6 - phaseB)
    );
    const lowerTaper = 0.88 + y01 * 0.12;

    position.setXYZ(
      index,
      sourceX * core.platform.radiusX * edgeNoise * lowerTaper,
      sourceY * core.platform.thickness + verticalRoughness,
      sourceZ * core.platform.radiusZ * edgeNoise * lowerTaper,
    );
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Pure Phase 1 presentation: one persistent rock mass and its growth platform. */
export function ReefCoreObject({ core }: { core: ReefCoreManifest }) {
  const rockGeometry = useMemo(() => createCoreRockGeometry(core), [core]);
  const platformGeometry = useMemo(() => createCorePlatformGeometry(core), [core]);

  useEffect(() => () => {
    rockGeometry.dispose();
    platformGeometry.dispose();
  }, [platformGeometry, rockGeometry]);

  return (
    <group>
      <mesh geometry={platformGeometry} rotation={[0, core.platform.rotationRadians, 0]} receiveShadow>
        <meshStandardMaterial color="#4d5048" roughness={0.98} metalness={0.01} />
      </mesh>
      <mesh geometry={rockGeometry} castShadow receiveShadow>
        <meshStandardMaterial color="#67675b" roughness={0.94} metalness={0.015} />
      </mesh>
    </group>
  );
}
