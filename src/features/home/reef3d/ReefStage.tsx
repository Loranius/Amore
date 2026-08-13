import { useEffect, useMemo, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { ReefEnvironment } from './ReefEnvironment';
import { ReefCleanupLayer } from './ReefCleanupLayer';
import { ReefWaterAtmosphere } from './ReefWaterAtmosphere';
import { ReefSeaGrass } from './ReefSeaGrass';
import { ReefSessileLife } from './ReefSessileLife';
import { ReefFishSchool } from './ReefFishSchool';
import { ReefDensityLayer } from './ReefDensityLayer';
import { BackgroundWhale } from './BackgroundWhale';

/**
 * Dedicated underwater world for the reef.
 *
 * The reef production object remains untouched. This component owns only the
 * world around it: water colour, depth fog, seabed, atmosphere, life and camera.
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
      <color attach="background" args={['#0a4d61']} />
      <fog attach="fog" args={['#176b77', 5.4, 22.5]} />

      <ambientLight intensity={0.2} />
      <hemisphereLight args={['#9ce4e8', '#143d42', 0.82]} />
      <directionalLight position={[-4.5, 10, 4]} intensity={2.18} color="#d8f8ef" />
      <directionalLight position={[5, 3, -5]} intensity={0.44} color="#4ba8ba" />
      <directionalLight position={[-5.5, 2.8, 6.5]} intensity={0.18} color="#b9c9ae" />

      <mesh position={[0, 7.2, -2]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 36]} />
        <meshBasicMaterial
          color="#8bdedc"
          transparent
          opacity={0.09}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <ReefEnvironment />
      <ReefCleanupLayer />
      <ReefWaterAtmosphere reducedMotion={reducedMotion} />
      <BackgroundWhale reducedMotion={reducedMotion} />
      <ReefSeaGrass reducedMotion={reducedMotion} />
      <ReefSessileLife reducedMotion={reducedMotion} />
      <ReefFishSchool reducedMotion={reducedMotion} />

      {/* Density now lives in the same world coordinate space as the support
          meshes. The old 0.76 X/Z wrapper was one source of visual detachment. */}
      <ReefDensityLayer />

      {children}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping={!reducedMotion}
        dampingFactor={0.06}
        rotateSpeed={0.58}
        zoomSpeed={0.7}
        minDistance={6.3}
        maxDistance={12.4}
        minPolarAngle={0.58}
        maxPolarAngle={1.42}
        target={[0, 0.85, 0]}
      />

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
