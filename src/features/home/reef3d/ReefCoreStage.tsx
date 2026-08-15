import { OrbitControls } from '@react-three/drei';
import type { ReactNode } from 'react';
import type { ReefCoreManifest } from '@/engine/species/reef';

export function ReefCoreStage({
  core,
  sceneExtent,
  children,
}: {
  core: ReefCoreManifest;
  sceneExtent?: number;
  children: ReactNode;
}) {
  const coreExtent = Math.max(core.platform.radiusX, core.platform.radiusZ);
  const horizontalExtent = Math.max(coreExtent, sceneExtent ?? 0);
  const targetY = Math.max(0.45, core.dimensions.height * 0.38);
  const minDistance = Math.max(4.2, coreExtent * 1.05);
  const maxDistance = Math.max(13, horizontalExtent * 3.1);

  return (
    <>
      <color attach="background" args={["#071c23"]} />
      <ambientLight intensity={0.72} />
      <hemisphereLight args={["#a6d1d4", "#1a3030", 1.34]} />
      <directionalLight
        position={[5.5, 9, 5]}
        intensity={1.62}
        color="#d7eee7"
        castShadow
        shadow-bias={-0.00035}
        shadow-normalBias={0.035}
      />
      <directionalLight
        position={[-5, 3.5, -4]}
        intensity={0.92}
        color="#5b95a0"
      />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -core.platform.thickness * 0.52, 0]}
        receiveShadow
      >
        <circleGeometry args={[Math.max(18, horizontalExtent * 2.4), 64]} />
        <meshStandardMaterial color="#173437" roughness={1} metalness={0} />
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
