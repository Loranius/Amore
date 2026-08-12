import { useEffect, useMemo, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { ReefEnvironment } from './ReefEnvironment';
import { ReefWaterAtmosphere } from './ReefWaterAtmosphere';

/**
 * Dedicated underwater world for the reef.
 *
 * The reef production object remains untouched. This component owns only the
 * world around it: water colour, depth fog, seabed, atmosphere and camera.
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
      <fog attach="fog" args={['#176d7b', 5.9, 23]} />

      {/* Cool water fill plus two directional surface contributions. */}
      <ambientLight intensity={0.23} />
      <hemisphereLight args={['#9fe8ee', '#123942', 0.86]} />
      <directionalLight position={[-4.5, 10, 4]} intensity={2.25} color="#d9fbf0" />
      <directionalLight position={[5, 3, -5]} intensity={0.48} color="#4fb4c7" />

      {/* Cheap readable water ceiling; Stage 2 light shafts visually connect
          this surface to the terrain without requiring a water simulation. */}
      <mesh position={[0, 7.2, -2]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 48]} />
        <meshBasicMaterial
          color="#8fe3e2"
          transparent
          opacity={0.105}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <ReefEnvironment />
      <ReefWaterAtmosphere reducedMotion={reducedMotion} />

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
