import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';
import {
  DoubleSide,
  Object3D,
  type InstancedMesh,
  type Material,
} from 'three';
import type {
  ReefGrowthOutcropPlacement,
  ReefGrowthTerracePlacement,
} from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  buildReefTerracedFoundationGeometry,
  createReefTerracedFoundationProfile,
  REEF_SEABED_Y,
  REEF_TERRACED_FOUNDATION_PASS,
  sampleReefTerracedFoundation,
  type ReefTerracedFoundationProfile,
} from './reefTerracedFoundation';
import { useReefRockMaterials } from './useReefRockMaterials';
import {
  REEF_CAMERA_ORBIT_PROFILE,
  REEF_SCENE_PALETTE,
} from './reefSceneProfile';

type Vec3 = readonly [number, number, number];

type RockMassProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  material: Material;
};

type PlateLedgeProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  material: Material;
  variant: 0 | 1 | 2 | 3 | 4;
};

type ContactPatch = {
  x: number;
  y: number;
  z: number;
  radiusX: number;
  radiusZ: number;
  rotation: number;
};

function RockMass({
  position,
  scale,
  rotation = [0, 0, 0],
  material,
}: RockMassProps) {
  return (
    <mesh
      position={[position[0], position[1], position[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
      receiveShadow={false}
      castShadow={false}
      material={material}
    >
      <dodecahedronGeometry args={[1, 0]} />
    </mesh>
  );
}

/** Four overlapping limestone lobes make one irregular but usable shelf. */
function PlateLedge({
  position,
  scale,
  rotation = [0, 0, 0],
  material,
  variant,
}: PlateLedgeProps) {
  const direction = variant % 2 === 0 ? -1 : 1;
  const yawBias = (variant - 2) * 0.07;
  const depthBias = (variant % 3 - 1) * scale[2] * 0.11;

  return (
    <group
      position={[position[0], position[1], position[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
    >
      <mesh
        position={[0, -scale[1] * 0.08, 0]}
        scale={[scale[0] * 0.7, scale[1] * 1.3, scale[2] * 0.68]}
        rotation={[0.025 * direction, yawBias, -0.03 * direction]}
        material={material}
      >
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh
        position={[
          direction * scale[0] * 0.47,
          -scale[1] * 0.18,
          scale[2] * 0.09 + depthBias,
        ]}
        scale={[scale[0] * 0.5, scale[1] * 1.05, scale[2] * 0.52]}
        rotation={[
          0.055 * direction,
          direction * (0.4 + variant * 0.035),
          0.07 * direction,
        ]}
        material={material}
      >
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh
        position={[
          -direction * scale[0] * 0.31,
          scale[1] * 0.03,
          -scale[2] * 0.24 - depthBias * 0.6,
        ]}
        scale={[scale[0] * 0.44, scale[1] * 0.9, scale[2] * 0.46]}
        rotation={[
          -0.04 * direction,
          -direction * (0.34 - variant * 0.02),
          -0.045 * direction,
        ]}
        material={material}
      >
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
      <mesh
        position={[
          direction * scale[0] * 0.07,
          -scale[1] * 0.28,
          -scale[2] * 0.39,
        ]}
        scale={[scale[0] * 0.5, scale[1] * 1.42, scale[2] * 0.38]}
        rotation={[
          0.08,
          -yawBias * 1.5 + direction * 0.08,
          -0.05 * direction,
        ]}
        material={material}
      >
        <dodecahedronGeometry args={[1, 0]} />
      </mesh>
    </group>
  );
}

function ReefTerracedFoundation({
  profile,
  topMaterial,
  sideMaterial,
}: {
  profile: ReefTerracedFoundationProfile;
  topMaterial: Material;
  sideMaterial: Material;
}) {
  const geometry = useMemo(
    () => buildReefTerracedFoundationGeometry(profile),
    [profile],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      name="reef-terraced-foundation"
      geometry={geometry}
      material={[topMaterial, sideMaterial]}
      receiveShadow={false}
      castShadow={false}
      userData={{
        reefSupportSurface: true,
        reefFoundationPass: REEF_TERRACED_FOUNDATION_PASS,
      }}
    />
  );
}

/** Every visited place opens a separate neighbouring rock, planted in the sampled surface. */
function GrowthOutcrop({
  outcrop,
  material,
  profile,
}: {
  outcrop: ReefGrowthOutcropPlacement;
  material: Material;
  profile: ReefTerracedFoundationProfile;
}) {
  const radius = outcrop.footprintRadius;
  const groundY = sampleReefTerracedFoundation(
    profile,
    outcrop.center.x,
    outcrop.center.z,
  ).height;

  return (
    <group
      name={outcrop.id}
      position={[outcrop.center.x, groundY, outcrop.center.z]}
      rotation={[0, outcrop.rotationY, 0]}
    >
      <RockMass
        position={[0, outcrop.height * 0.38, 0]}
        scale={[radius * 0.92, outcrop.height * 0.72, radius * 0.76]}
        rotation={[0.08, 0.24, -0.06]}
        material={material}
      />
      <RockMass
        position={[radius * 0.28, outcrop.height * 0.3, -radius * 0.18]}
        scale={[radius * 0.58, outcrop.height * 0.54, radius * 0.52]}
        rotation={[-0.04, -0.3, 0.04]}
        material={material}
      />
      <PlateLedge
        position={[0, outcrop.height * 0.78, 0]}
        scale={[
          radius * 0.62 * outcrop.ledgeScale,
          Math.max(0.07, outcrop.height * 0.14),
          radius * 0.48,
        ]}
        rotation={[0.03, -0.18, 0.02]}
        material={material}
        variant={(outcrop.seed % 5) as 0 | 1 | 2 | 3 | 4}
      />
    </group>
  );
}

/** One active Schedule month becomes a low terrace attached to the real terrain height. */
function GrowthTerrace({
  terrace,
  material,
  profile,
}: {
  terrace: ReefGrowthTerracePlacement;
  material: Material;
  profile: ReefTerracedFoundationProfile;
}) {
  const groundY = sampleReefTerracedFoundation(
    profile,
    terrace.center.x,
    terrace.center.z,
  ).height;

  return (
    <group
      name={terrace.id}
      position={[terrace.center.x, groundY, terrace.center.z]}
      rotation={[0, terrace.rotationY, 0]}
    >
      <PlateLedge
        position={[0, terrace.thickness * 0.72, 0]}
        scale={[
          terrace.footprintRadius * 0.62,
          terrace.thickness,
          terrace.footprintRadius * 0.48,
        ]}
        material={material}
        variant={(terrace.seed % 5) as 0 | 1 | 2 | 3 | 4}
      />
    </group>
  );
}

function buildContactPatches(
  build: ReefPreviewBuild,
  profile: ReefTerracedFoundationProfile,
): ContactPatch[] {
  const patches: ContactPatch[] = [{
    x: 0,
    y: profile.floorY + 0.006,
    z: 0.02,
    radiusX: profile.radius * 0.82,
    radiusZ: profile.radius * 0.68,
    rotation: -0.08,
  }];

  for (const outcrop of build.structures.outcrops) {
    const surface = sampleReefTerracedFoundation(
      profile,
      outcrop.center.x,
      outcrop.center.z,
    );
    patches.push({
      x: outcrop.center.x,
      y: surface.height + 0.007,
      z: outcrop.center.z,
      radiusX: outcrop.footprintRadius * 0.72,
      radiusZ: outcrop.footprintRadius * 0.56,
      rotation: outcrop.rotationY,
    });
  }

  for (const terrace of build.structures.terraces) {
    const surface = sampleReefTerracedFoundation(
      profile,
      terrace.center.x,
      terrace.center.z,
    );
    patches.push({
      x: terrace.center.x,
      y: surface.height + 0.007,
      z: terrace.center.z,
      radiusX: terrace.footprintRadius * 0.48,
      radiusZ: terrace.footprintRadius * 0.36,
      rotation: terrace.rotationY,
    });
  }

  return patches;
}

function ReefContactLayer({ patches }: { patches: readonly ContactPatch[] }) {
  const ref = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const transform = new Object3D();
    patches.forEach((patch, index) => {
      transform.position.set(patch.x, patch.y, patch.z);
      transform.rotation.set(-Math.PI / 2, 0, patch.rotation);
      transform.scale.set(patch.radiusX, patch.radiusZ, 1);
      transform.updateMatrix();
      mesh.setMatrixAt(index, transform.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [patches]);

  if (patches.length === 0) return null;

  return (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, patches.length]}
      receiveShadow={false}
      castShadow={false}
      renderOrder={2}
      frustumCulled={false}
      userData={{ reefContactPatchCount: patches.length }}
    >
      <circleGeometry args={[1, 20]} />
      <meshBasicMaterial
        color={REEF_SCENE_PALETTE.contact}
        transparent
        opacity={0.115}
        depthWrite={false}
        toneMapped={false}
        side={DoubleSide}
        polygonOffset
        polygonOffsetFactor={-1}
      />
    </instancedMesh>
  );
}

/**
 * Static underwater terrain. The hero is now one light, continuous terrace
 * shell; every generated geological structure samples the same surface before
 * rendering, while one instanced decal layer supplies inexpensive contact AO.
 */
export function ReefEnvironment({ build }: { build: ReefPreviewBuild }) {
  const rockMaterials = useReefRockMaterials();
  const { structures } = build;
  const profile = useMemo(() => createReefTerracedFoundationProfile({
    radius: structures.visibleFoundationRadius,
    verticalScale: structures.foundationScaleY,
    seed: build.species.moduleEvolution.identitySeed,
  }), [
    build.species.moduleEvolution.identitySeed,
    structures.foundationScaleY,
    structures.visibleFoundationRadius,
  ]);
  const contactPatches = useMemo(
    () => buildContactPatches(build, profile),
    [build, profile],
  );

  return (
    <group
      name="reef-environment-light-terraces"
      userData={{
        reefFoundationRadius: profile.radius,
        reefFoundationTierCount: profile.levels.length,
        reefForegroundClearRadius: REEF_CAMERA_ORBIT_PROFILE.foregroundClearRadius,
      }}
    >
      <mesh position={[0, REEF_SEABED_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <circleGeometry args={[18, 48]} />
        <meshStandardMaterial color={REEF_SCENE_PALETTE.seabed} roughness={1} metalness={0} />
      </mesh>

      <group name="reef-hero-support">
        <ReefTerracedFoundation
          profile={profile}
          topMaterial={rockMaterials.foundationTop}
          sideMaterial={rockMaterials.foundationSide}
        />
        {structures.outcrops.map((outcrop) => (
          <GrowthOutcrop
            key={outcrop.id}
            outcrop={outcrop}
            material={rockMaterials.hero}
            profile={profile}
          />
        ))}
        {structures.terraces.map((terrace) => (
          <GrowthTerrace
            key={terrace.id}
            terrace={terrace}
            material={rockMaterials.hero}
            profile={profile}
          />
        ))}
      </group>

      <ReefContactLayer patches={contactPatches} />
    </group>
  );
}
