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
  ReefGrowthArchPlacement,
  ReefGrowthOutcropPlacement,
  ReefGrowthTerracePlacement,
} from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  buildReefLimestoneArchGeometry,
  reefArchFootPoints,
  REEF_LIMESTONE_ARCH_PASS,
} from './reefLimestoneArch';
import {
  buildReefTerracedFoundationGeometry,
  createReefTerracedFoundationProfile,
  REEF_SEABED_Y,
  REEF_TERRACED_FOUNDATION_PASS,
  sampleReefTerracedFoundation,
  type ReefTerracedFoundationProfile,
} from './reefTerracedFoundation';
import { useReefRockMaterials } from './useReefRockMaterials';

type Vec3 = readonly [number, number, number];

type RockMassProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  material: Material;
  groundY?: number;
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

const PALETTE = {
  floor: '#74847b',
  contact: '#173f43',
} as const;

const NEAR_ROCKS: readonly Omit<RockMassProps, 'material' | 'groundY'>[] = [
  { position: [-5.4, 0, 2.3], scale: [2.45, 0.72, 1.85], rotation: [0.08, 0.28, -0.06] },
  { position: [-4.15, 0, -0.1], scale: [1.75, 0.56, 1.48], rotation: [-0.05, -0.2, 0.08] },
  { position: [-5.7, 0, -2.7], scale: [2.7, 0.88, 1.95], rotation: [0.06, 0.48, 0.02] },
  { position: [5.25, 0, 2.15], scale: [2.35, 0.7, 1.72], rotation: [-0.06, -0.34, 0.08] },
  { position: [4.1, 0, -0.25], scale: [1.65, 0.52, 1.36], rotation: [0.04, 0.22, -0.05] },
  { position: [5.85, 0, -2.85], scale: [2.8, 0.9, 2], rotation: [-0.04, -0.5, 0.03] },
] as const;

const TERRACE_STONES: readonly Omit<RockMassProps, 'material' | 'groundY'>[] = [
  { position: [-3.65, 0, 3.2], scale: [1.25, 0.3, 0.95], rotation: [0, 0.12, 0.05] },
  { position: [-2.95, 0, 4.05], scale: [1.05, 0.25, 0.82], rotation: [0.03, -0.32, -0.03] },
  { position: [3.55, 0, 3.35], scale: [1.32, 0.3, 0.96], rotation: [0.02, -0.18, -0.04] },
  { position: [2.8, 0, 4.2], scale: [0.98, 0.24, 0.78], rotation: [-0.02, 0.38, 0.04] },
  { position: [-3.4, 0, -4.2], scale: [1.4, 0.34, 1], rotation: [0, 0.36, 0] },
  { position: [3.45, 0, -4.35], scale: [1.46, 0.36, 1.05], rotation: [0, -0.3, 0] },
] as const;

function RockMass({
  position,
  scale,
  rotation = [0, 0, 0],
  material,
  groundY,
}: RockMassProps) {
  const y = groundY === undefined
    ? position[1]
    : groundY + scale[1] * 0.82;

  return (
    <mesh
      position={[position[0], y, position[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
      receiveShadow={false}
      castShadow={false}
      material={material}
      userData={{ reefGroundedRock: groundY !== undefined }}
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

/** One completed relationship year becomes one faceted limestone support mesh. */
function GrowthArch({
  arch,
  material,
  profile,
}: {
  arch: ReefGrowthArchPlacement;
  material: Material;
  profile: ReefTerracedFoundationProfile;
}) {
  const geometry = useMemo(
    () => buildReefLimestoneArchGeometry({ arch, profile }),
    [arch, profile],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      name={arch.id}
      position={[arch.center.x, 0, arch.center.z]}
      rotation={[0, arch.rotationY, 0]}
      geometry={geometry}
      material={material}
      receiveShadow={false}
      castShadow={false}
      userData={{
        reefSupportSurface: true,
        reefLimestoneArchPass: REEF_LIMESTONE_ARCH_PASS,
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

function DistantSpire({
  position,
  scale,
  rotation = 0,
  material,
}: {
  position: Vec3;
  scale: number;
  rotation?: number;
  material: Material;
}) {
  return (
    <group
      position={[position[0], position[1], position[2]]}
      rotation={[0, rotation, 0]}
      scale={scale}
    >
      <RockMass position={[0, 0, 0]} scale={[1.55, 0.72, 1.35]} material={material} />
      <RockMass
        position={[-0.18, 1.02, 0.04]}
        scale={[0.88, 1.12, 0.82]}
        rotation={[0.05, 0.24, -0.08]}
        material={material}
      />
      <RockMass
        position={[0.14, 2.05, -0.03]}
        scale={[0.58, 0.86, 0.56]}
        rotation={[-0.04, -0.2, 0.07]}
        material={material}
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

  for (const arch of build.structures.arches) {
    for (const foot of reefArchFootPoints(arch)) {
      const surface = sampleReefTerracedFoundation(profile, foot.x, foot.z);
      patches.push({
        x: foot.x,
        y: surface.height + 0.008,
        z: foot.z,
        radiusX: arch.thickness * 1.75,
        radiusZ: arch.thickness * 1.35,
        rotation: arch.rotationY,
      });
    }
  }

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

  for (const rock of [...NEAR_ROCKS, ...TERRACE_STONES]) {
    patches.push({
      x: rock.position[0],
      y: REEF_SEABED_Y + 0.006,
      z: rock.position[2],
      radiusX: rock.scale[0] * 0.56,
      radiusZ: rock.scale[2] * 0.5,
      rotation: rock.rotation?.[1] ?? 0,
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
        color={PALETTE.contact}
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
      }}
    >
      <mesh position={[0, REEF_SEABED_Y, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <circleGeometry args={[18, 48]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={1} metalness={0} />
      </mesh>

      <group name="reef-hero-support">
        <ReefTerracedFoundation
          profile={profile}
          topMaterial={rockMaterials.foundationTop}
          sideMaterial={rockMaterials.foundationSide}
        />
        {structures.arches.map((arch) => (
          <GrowthArch
            key={arch.id}
            arch={arch}
            material={rockMaterials.arch}
            profile={profile}
          />
        ))}
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

      {NEAR_ROCKS.map((rock, index) => (
        <RockMass
          key={`reef-near-rock-${index}`}
          {...rock}
          groundY={REEF_SEABED_Y}
          material={rockMaterials.rock}
        />
      ))}
      {TERRACE_STONES.map((rock, index) => (
        <RockMass
          key={`reef-terrace-${index}`}
          {...rock}
          groundY={REEF_SEABED_Y}
          material={rockMaterials.rock}
        />
      ))}

      <DistantSpire position={[-6.8, -0.35, -8.7]} scale={1.25} rotation={0.28} material={rockMaterials.distant} />
      <DistantSpire position={[6.9, -0.6, -9.8]} scale={1.42} rotation={-0.38} material={rockMaterials.distant} />
      <DistantSpire position={[-2.4, -0.9, -12.8]} scale={0.9} rotation={-0.12} material={rockMaterials.distant} />
      <DistantSpire position={[2.9, -1, -13.6]} scale={0.82} rotation={0.2} material={rockMaterials.distant} />

      <RockMass
        position={[-8.9, 0, -7.1]}
        scale={[3.9, 1.05, 2.6]}
        rotation={[0.02, 0.38, -0.04]}
        groundY={REEF_SEABED_Y}
        material={rockMaterials.distant}
      />
      <RockMass
        position={[9.1, 0, -7.8]}
        scale={[4.1, 1.12, 2.8]}
        rotation={[-0.03, -0.42, 0.03]}
        groundY={REEF_SEABED_Y}
        material={rockMaterials.distant}
      />
    </group>
  );
}
