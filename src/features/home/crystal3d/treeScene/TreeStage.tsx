import { useMemo, useRef, type ReactNode } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { WorldCameraPose } from '@/features/world/crystalAtlas';
import type { WorldMotionMode } from '@/features/world/sceneDirector';
import { PortalCameraRig } from '../scene/PortalEnvironment';
import { portalCameraFrame } from '../scene/portalScene';

interface TreeStageProps {
  theme: 'light' | 'dark';
  reduceMotion: boolean;
  soilRadius: number;
  crownRadius: number;
  treeHeight: number;
  groundY: number;
  pose?: WorldCameraPose | undefined;
  motionMode?: { current: Exclude<WorldMotionMode, 'navigation'> } | undefined;
  allowOrbit?: boolean | undefined;
  children: ReactNode;
}

const TREE_PALETTES = {
  light: {
    sky: '#b9ddf3',
    fog: '#d7e8df',
    grass: '#6d8655',
    distantGrass: '#7c9564',
    earth: '#75634e',
    sun: '#fff2bd',
    sunLight: '#ffe8bd',
    skyLight: '#d8ecff',
    groundLight: '#6f7d54',
    rim: '#c8ddff',
  },
  dark: {
    // Dark UI still gets a real daytime world. The darker vegetation and
    // cooler haze keep the foreground chrome legible without turning the
    // tree back into the portal's night temple.
    sky: '#8dbbd8',
    fog: '#b8d0c8',
    grass: '#4d6840',
    distantGrass: '#617a50',
    earth: '#645541',
    sun: '#ffe9a8',
    sunLight: '#ffdfad',
    skyLight: '#bfdcf0',
    groundLight: '#516247',
    rim: '#b7d2f3',
  },
} as const;

/**
 * Outdoor world owned by the tree.
 *
 * The tree still uses the shared camera director so navigation remains one
 * continuous world, but it deliberately does not mount PortalEnvironment:
 * no temple floor, relic dais, colonnade, arches, lamps or star field can leak
 * into the tree view.
 */
export function TreeStage({
  theme,
  reduceMotion,
  soilRadius,
  crownRadius,
  treeHeight,
  groundY,
  pose,
  motionMode,
  allowOrbit = true,
  children,
}: TreeStageProps) {
  const size = useThree((state) => state.size);
  const controls = useRef<OrbitControlsImpl>(null);
  const aspect = size.height > 0 ? size.width / size.height : 1;
  const frame = useMemo(
    () => portalCameraFrame(aspect, crownRadius, treeHeight),
    [aspect, crownRadius, treeHeight],
  );
  const palette = TREE_PALETTES[theme];

  // A broad shallow hemisphere reads as a hill from every orbit angle while
  // keeping its summit exactly on the same ground plane as the tree roots.
  const hillRadius = useMemo(
    () => Math.max(8, soilRadius * 4.2, crownRadius * 3.8),
    [soilRadius, crownRadius],
  );
  const hillFlattening = 0.22;
  const hillCenterY = groundY - hillRadius * hillFlattening;

  return (
    <>
      <color attach="background" args={[palette.sky]} />
      <fog attach="fog" args={[palette.fog, frame.distance * 0.9, frame.distance + 34]} />

      {/* Daylight is intentionally asymmetric: one warm sun defines the bark
          and crown volumes, while hemisphere/rim light only prevents the far
          side from collapsing into black. */}
      <ambientLight intensity={0.34} />
      <hemisphereLight args={[palette.skyLight, palette.groundLight, 0.9]} />
      <directionalLight
        position={[-7, 10, 5]}
        intensity={2.15}
        color={palette.sunLight}
      />
      <directionalLight
        position={[5, 4, -6]}
        intensity={0.34}
        color={palette.rim}
      />

      {/* Main hill. Only the upper hemisphere is rendered; scaled Y makes it
          a natural, low mound instead of a ball under the tree. */}
      <mesh
        position={[0, hillCenterY, 0]}
        scale={[1, hillFlattening, 1]}
        receiveShadow
      >
        <sphereGeometry args={[hillRadius, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={palette.grass} roughness={1} metalness={0} />
      </mesh>

      {/* A lower distant mound keeps the horizon from becoming a perfectly
          straight fog line, but stays cheap and visually subordinate. */}
      <mesh
        position={[hillRadius * 0.72, groundY - hillRadius * 0.43, -hillRadius * 1.32]}
        scale={[1.55, 0.28, 1]}
      >
        <sphereGeometry args={[hillRadius * 0.9, 32, 14, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={palette.distantGrass} roughness={1} metalness={0} />
      </mesh>

      {/* The sun is geometry rather than another light source: the single
          directional light above remains the actual illumination model. */}
      <mesh position={[-9.5, groundY + 8.5, -17]}>
        <sphereGeometry args={[0.62, 24, 16]} />
        <meshBasicMaterial color={palette.sun} toneMapped={false} />
      </mesh>

      <PortalCameraRig frame={frame} controls={controls} pose={pose} mode={motionMode} />

      {children}

      <OrbitControls
        ref={controls}
        enablePan={false}
        enableZoom={false}
        enableRotate={allowOrbit}
        enableDamping={!reduceMotion}
        dampingFactor={0.08}
        minPolarAngle={Math.PI * 0.2}
        maxPolarAngle={Math.PI * 0.48}
      />
    </>
  );
}
