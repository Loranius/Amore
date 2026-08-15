import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import {
  ACESFilmicToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
} from 'three';
import { ReefEnvironment } from './ReefEnvironment';
import type { ReefPreviewBuild } from './buildReefPreview';
import { ReefWaterAtmosphere } from './ReefWaterAtmosphere';
import { ReefSeaGrass } from './ReefSeaGrass';
import { ReefSessileLife } from './ReefSessileLife';
import { ReefFishSchool, type ReefFishSchoolMetrics } from './ReefFishSchool';
import { ReefDensityLayer } from './ReefDensityLayer';
import { BackgroundWhale } from './BackgroundWhale';
import { ReefNaturalArchLayer } from './ReefNaturalArchLayer';
import { ReefVolcano } from './ReefVolcano';
import { ReefVolcanoReplacementLayer } from './ReefVolcanoReplacementLayer';
import { ReefWorldComposition } from './ReefWorldComposition';
import { ReefDistantEcosystem } from './ReefDistantEcosystem';
import {
  reefCameraFrameForAspect,
  REEF_ATMOSPHERE_PROFILE,
  REEF_LIGHTING_PROFILE,
  REEF_SCENE_PALETTE,
  type ReefCameraFrame,
} from './reefSceneProfile';

/**
 * Dedicated underwater world for the reef.
 *
 * The reef production object remains untouched. This component owns only the
 * world around it: water colour, depth fog, seabed, atmosphere, life and camera.
 * Nothing from the crystal temple or the old laboratory card is mounted here.
 */
export function ReefStage({
  build,
  onFishReady,
  reducedMotion,
  children,
}: {
  build: ReefPreviewBuild;
  onFishReady?: (metrics: ReefFishSchoolMetrics) => void;
  reducedMotion: boolean;
  children: ReactNode;
}) {
  const size = useThree((state) => state.size);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const cameraFrame = useMemo(() => reefCameraFrameForAspect(aspect), [aspect]);

  return (
    <>
      <ReefRendererCalibration />
      <color attach="background" args={[REEF_SCENE_PALETTE.background]} />
      <fog
        attach="fog"
        args={[
          REEF_SCENE_PALETTE.fog,
          REEF_ATMOSPHERE_PROFILE.fogNear,
          REEF_ATMOSPHERE_PROFILE.fogFar,
        ]}
      />

      <ambientLight intensity={REEF_LIGHTING_PROFILE.ambientIntensity} />
      <hemisphereLight
        args={[
          REEF_LIGHTING_PROFILE.hemisphere.skyColor,
          REEF_LIGHTING_PROFILE.hemisphere.groundColor,
          REEF_LIGHTING_PROFILE.hemisphere.intensity,
        ]}
      />
      <directionalLight {...REEF_LIGHTING_PROFILE.key} />
      <directionalLight {...REEF_LIGHTING_PROFILE.fill} />
      <directionalLight {...REEF_LIGHTING_PROFILE.rim} />

      <mesh position={[0, 7.2, -2]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 36]} />
        <meshBasicMaterial
          color={REEF_SCENE_PALETTE.waterSurface}
          transparent
          opacity={REEF_ATMOSPHERE_PROFILE.surfaceOpacity}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <ReefEnvironment build={build} />
      <ReefVolcanoReplacementLayer />
      <ReefVolcano build={build} reducedMotion={reducedMotion} />
      <ReefNaturalArchLayer build={build} />
      <ReefWorldComposition />
      <ReefDistantEcosystem reducedMotion={reducedMotion} />
      <ReefDensityLayer build={build} />
      <ReefWaterAtmosphere reducedMotion={reducedMotion} />
      <BackgroundWhale reducedMotion={reducedMotion} />
      <ReefSeaGrass reducedMotion={reducedMotion} />
      <ReefSessileLife reducedMotion={reducedMotion} />
      <ReefFishSchool
        build={build}
        count={build.species.moduleEvolution.life.planFish.visibleCount}
        identitySeed={build.species.moduleEvolution.identitySeed}
        onReady={onFishReady}
        reducedMotion={reducedMotion}
      />

      {children}

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableDamping={!reducedMotion}
        dampingFactor={0.06}
        rotateSpeed={0.58}
        zoomSpeed={0.7}
        maxDistance={cameraFrame.maxDistance}
        minDistance={cameraFrame.minDistance}
        minPolarAngle={cameraFrame.minPolarAngle}
        maxPolarAngle={cameraFrame.maxPolarAngle}
        minAzimuthAngle={cameraFrame.minAzimuthAngle}
        maxAzimuthAngle={cameraFrame.maxAzimuthAngle}
        target={[...cameraFrame.target]}
      />

      <ReefCameraPlacement frame={cameraFrame} />
    </>
  );
}

function ReefRendererCalibration() {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const previousToneMapping = gl.toneMapping;
    const previousExposure = gl.toneMappingExposure;
    const previousOutputColorSpace = gl.outputColorSpace;
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = REEF_ATMOSPHERE_PROFILE.toneMappingExposure;
    gl.outputColorSpace = SRGBColorSpace;
    invalidate();

    return () => {
      gl.toneMapping = previousToneMapping;
      gl.toneMappingExposure = previousExposure;
      gl.outputColorSpace = previousOutputColorSpace;
    };
  }, [gl, invalidate]);

  return null;
}

function ReefCameraPlacement({ frame }: { frame: ReefCameraFrame }) {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);

  useLayoutEffect(() => {
    camera.position.set(...frame.position);
    camera.up.set(0, 1, 0);
    camera.lookAt(...frame.target);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = frame.fov;
      camera.near = frame.near;
      camera.far = frame.far;
      camera.updateProjectionMatrix();
    }
    invalidate();
  }, [camera, frame, invalidate]);

  return null;
}
