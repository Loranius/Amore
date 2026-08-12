import { useEffect, useMemo, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';

function CausticPatch({
  position,
  scale,
  rotation = 0,
}: {
  position: readonly [number, number, number];
  scale: readonly [number, number, number];
  rotation?: number;
}) {
  return (
    <mesh
      position={[position[0], position[1], position[2]]}
      rotation={[-Math.PI / 2, 0, rotation]}
      scale={[scale[0], scale[1], scale[2]]}
    >
      <ringGeometry args={[0.7, 1, 36]} />
      <meshBasicMaterial
        color="#b7f5ee"
        transparent
        opacity={0.055}
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Dedicated underwater world for the reef.
 *
 * The reef production object remains untouched. This component owns only the
 * world around it: water colour, depth fog, seabed, light shafts and camera.
 * Nothing from the crystal temple or the old laboratory card is mounted here.
 */
export function ReefStage({
  reducedMotion,
  children,
}: {
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const size = useThree((state) => state.size);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const cameraDistance = useMemo(() => (aspect < 0.72 ? 11.2 : 8.15), [aspect]);

  return (
    <>
      <color attach="background" args={['#0b5267']} />
      <fog attach="fog" args={['#176d7b', 6.8, 24]} />

      {/* Cool water fill + one warm shaft from the surface. */}
      <ambientLight intensity={0.25} />
      <hemisphereLight args={['#9fe8ee', '#123942', 0.88]} />
      <directionalLight position={[-4.5, 10, 4]} intensity={2.35} color="#d9fbf0" />
      <directionalLight position={[5, 3, -5]} intensity={0.52} color="#4fb4c7" />

      {/* Water surface: deliberately simple geometry so the scene stays cheap
          on mobile. It gives the eye a readable "above" without a water shader. */}
      <mesh position={[0, 7.2, -2]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 48]} />
        <meshBasicMaterial
          color="#8fe3e2"
          transparent
          opacity={0.11}
          depthWrite={false}
        />
      </mesh>

      {/* Wide seabed, then a softer mound under the accepted reef foundation. */}
      <mesh position={[0, -0.34, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#8a8771" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0, -0.24, 0]} scale={[3.5, 0.42, 3.1]}>
        <sphereGeometry args={[1, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#747867" roughness={1} metalness={0} />
      </mesh>

      {/* Distant silhouettes create depth without stealing attention from the
          generated colony. */}
      <mesh position={[-5.5, -0.8, -7.5]} scale={[2.8, 0.75, 2.2]} rotation={[0, 0.3, 0]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#355f61" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[6.2, -1.05, -9]} scale={[3.4, 0.85, 2.5]} rotation={[0, -0.45, 0]}>
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#2d5960" roughness={1} metalness={0} />
      </mesh>

      {/* Soft caustic hints on the seabed; no texture downloads or post FX. */}
      <CausticPatch position={[-1.7, -0.31, 1.8]} scale={[1.6, 1.1, 1]} rotation={0.35} />
      <CausticPatch position={[1.6, -0.31, 0.9]} scale={[1.1, 0.8, 1]} rotation={-0.25} />
      <CausticPatch position={[0.4, -0.31, -2]} scale={[2, 1.2, 1]} rotation={0.1} />

      {children}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping={!reducedMotion}
        dampingFactor={0.06}
        minDistance={6.1}
        maxDistance={12.4}
        minPolarAngle={0.58}
        maxPolarAngle={1.42}
        target={[0, 0.85, 0]}
      />

      {/* Keep the initial frame responsive without coupling reef geometry to
          the crystal camera solver. */}
      <ReefCameraPlacement distance={cameraDistance} />
    </>
  );
}

function ReefCameraPlacement({ distance }: { distance: number }) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.set(0, 2.65, distance);
    camera.lookAt(0, 0.85, 0);
  }, [camera, distance]);

  return null;
}
