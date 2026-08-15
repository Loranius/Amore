import { OrbitControls } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { ReefCoreManifest } from '@/engine/species/reef';

export function ReefCoreStage({
  core,
  children,
}: {
  core: ReefCoreManifest;
  children: ReactNode;
}) {
  const horizontalExtent = Math.max(core.platform.radiusX, core.platform.radiusZ);
  const targetY = Math.max(0.45, core.dimensions.height * 0.38);
  const minDistance = Math.max(4.2, horizontalExtent * 1.15);
  const maxDistance = Math.max(13, horizontalExtent * 3.2);

  return (
    <>
      <color attach="background" args={["#071c23"]} />
      <ambientLight intensity={0.52} />
      <hemisphereLight args={["#9bc8cf", "#15272a", 1.15]} />
      <directionalLight
        position={[5.5, 9, 5]}
        intensity={2.05}
        color="#d4eee7"
        castShadow
      />
      <directionalLight
        position={[-5, 3.5, -4]}
        intensity={0.7}
        color="#4d8693"
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -core.platform.thickness * 0.52, 0]}
        receiveShadow
      >
        <circleGeometry args={[Math.max(18, horizontalExtent * 3.2), 64]} />
        <meshStandardMaterial color="#132e30" roughness={1} metalness={0} />
      </mesh>

      {children}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping
        dampingFactor={0.07}
        rotateSpeed={0.58}
        zoomSpeed={0.72}
        minDistance={minDistance}
        maxDistance={maxDistance}
        minPolarAngle={0.32}
        maxPolarAngle={Math.PI * 0.56}
        target={[0, targetY, 0]}
      />
    </>
  );
}
