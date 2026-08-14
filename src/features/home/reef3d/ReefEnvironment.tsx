import { useMemo } from 'react';
import { CatmullRomCurve3, Vector3, type Material } from 'three';
import type {
  ReefGrowthArchPlacement,
  ReefGrowthOutcropPlacement,
  ReefGrowthTerracePlacement,
} from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import { useReefRockMaterials } from './useReefRockMaterials';

type Vec3 = readonly [number, number, number];

type RockMassProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  color?: string;
  material?: Material;
};

type PlateLedgeProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  color: string;
  material?: Material;
  variant: 0 | 1 | 2 | 3 | 4;
};

const PALETTE = {
  floor: '#69776d',
  sand: '#9d9883',
  rock: '#42615e',
  contact: '#173f43',
} as const;

/**
 * The visible core now follows a deliberate vertical taper: a broad planted
 * lower tier, a tighter bridge tier and a compact uneven crown. The overlap
 * still keeps one continuous mound, but the silhouette narrows as it rises.
 */
const BASE_CORE_MASSES: readonly RockMassProps[] = [
  {
    position: [-0.82, -0.04, 0.18],
    scale: [1.46, 0.94, 1.18],
    rotation: [0.08, 0.26, -0.06],
    color: '#526a63',
  },
  {
    position: [0, 0.05, -0.04],
    scale: [1.48, 0.94, 1.12],
    rotation: [-0.03, -0.16, 0.03],
    color: '#5b7168',
  },
  {
    position: [0.82, -0.02, 0.24],
    scale: [1.38, 0.9, 1.08],
    rotation: [0.05, 0.16, 0.04],
    color: '#4d6862',
  },
  {
    position: [-0.22, 0.7, 0.04],
    scale: [0.82, 0.72, 0.72],
    rotation: [0.1, 0.28, -0.03],
    color: '#63786e',
  },
  {
    position: [0.34, 0.88, -0.17],
    scale: [0.66, 0.61, 0.62],
    rotation: [-0.03, -0.22, 0.05],
    color: '#597269',
  },
] as const;

/** Bridge stones form the middle tier and stay narrower than the planted base. */
const CORE_BRIDGE_MASSES: readonly RockMassProps[] = [
  {
    position: [-0.34, 0.2, 0.1],
    scale: [0.82, 0.52, 0.72],
    rotation: [0.04, 0.18, -0.02],
    color: '#556d66',
  },
  {
    position: [0.36, 0.24, 0.04],
    scale: [0.84, 0.54, 0.74],
    rotation: [-0.02, -0.16, 0.03],
    color: '#567067',
  },
  {
    position: [0.02, 0.48, -0.1],
    scale: [0.72, 0.46, 0.62],
    rotation: [0.02, 0.1, -0.01],
    color: '#61776d',
  },
] as const;

/** Lower fill closes daylight gaps and gives the mound one planted footprint. */
const CORE_LOWER_FILL: readonly RockMassProps[] = [
  {
    position: [-0.92, -0.18, 0.34],
    scale: [0.92, 0.46, 0.72],
    rotation: [0.02, 0.14, 0.02],
    color: '#4d6761',
  },
  {
    position: [0, -0.16, 0.18],
    scale: [1.1, 0.5, 0.88],
    rotation: [0.01, -0.08, 0.01],
    color: '#506a64',
  },
  {
    position: [0.96, -0.18, 0.28],
    scale: [0.88, 0.44, 0.7],
    rotation: [-0.02, -0.12, 0.02],
    color: '#4b6660',
  },
] as const;

/**
 * Sculpt pass 4 roots mirror three readable shelf levels. Paired roots on the
 * lower and middle tiers overlap the core, while the crown keeps one compact
 * anchor so the shelves stay attached without becoming five separate bands.
 */
const BASE_LEDGE_ROOTS: readonly RockMassProps[] = [
  {
    position: [-0.54, 0.08, 0.26],
    scale: [0.8, 0.5, 0.66],
    rotation: [0.06, 0.26, -0.05],
    color: '#4f6861',
  },
  {
    position: [0.45, 0.1, 0.12],
    scale: [0.82, 0.48, 0.66],
    rotation: [-0.04, -0.22, 0.04],
    color: '#536c64',
  },
  {
    position: [-0.14, 0.54, -0.25],
    scale: [0.68, 0.4, 0.56],
    rotation: [0.08, 0.16, -0.04],
    color: '#587067',
  },
  {
    position: [0.28, 0.57, -0.01],
    scale: [0.56, 0.34, 0.48],
    rotation: [-0.03, -0.18, 0.05],
    color: '#5c7369',
  },
  {
    position: [-0.12, 0.92, 0.03],
    scale: [0.44, 0.28, 0.4],
    rotation: [0.05, 0.24, -0.03],
    color: '#61786d',
  },
] as const;

/**
 * Organic shelf sculpt. The five physical shelves still resolve into three
 * readable height tiers, but their footprints are pulled inward and thickened.
 * The lower pair stays broad, the middle pair offsets asymmetrically, and the
 * crown is deliberately compact so no tier reads as a clean stacked disc.
 */
const BASE_PLATE_LEDGES: readonly PlateLedgeProps[] = [
  {
    position: [-0.82, 0.19, 0.47],
    scale: [1.34, 0.25, 0.84],
    rotation: [0.06, 0.18, 0.06],
    color: '#58736d',
    variant: 0,
  },
  {
    position: [0.62, 0.23, 0.22],
    scale: [1.2, 0.21, 0.76],
    rotation: [-0.06, -0.24, 0.02],
    color: '#607a73',
    variant: 1,
  },
  {
    position: [-0.23, 0.65, -0.36],
    scale: [0.98, 0.22, 0.67],
    rotation: [0.07, 0.18, -0.07],
    color: '#526f6a',
    variant: 2,
  },
  {
    position: [0.38, 0.71, 0.01],
    scale: [0.82, 0.19, 0.58],
    rotation: [-0.04, -0.2, 0.05],
    color: '#5f7971',
    variant: 3,
  },
  {
    position: [-0.12, 1.05, 0.06],
    scale: [0.62, 0.18, 0.44],
    rotation: [0.07, 0.29, -0.04],
    color: '#5a756d',
    variant: 4,
  },
] as const;

const BASE_DEBRIS: readonly RockMassProps[] = [
  {
    position: [-1.72, -0.27, 0.72],
    scale: [0.44, 0.18, 0.34],
    rotation: [0.04, 0.24, 0.02],
    color: '#68786f',
  },
  {
    position: [1.62, -0.25, 0.56],
    scale: [0.4, 0.16, 0.31],
    rotation: [-0.02, -0.28, 0.03],
    color: '#708078',
  },
  {
    position: [-1.35, -0.26, -0.84],
    scale: [0.36, 0.14, 0.29],
    rotation: [0.03, 0.2, -0.02],
    color: '#63746c',
  },
  {
    position: [1.28, -0.26, -0.92],
    scale: [0.46, 0.17, 0.33],
    rotation: [0.01, -0.22, 0.04],
    color: '#6d7e75',
  },
] as const;

const NEAR_ROCKS: readonly RockMassProps[] = [
  { position: [-5.4, -0.22, 2.3], scale: [2.45, 0.72, 1.85], rotation: [0.08, 0.28, -0.06] },
  { position: [-4.15, -0.16, -0.1], scale: [1.75, 0.56, 1.48], rotation: [-0.05, -0.2, 0.08] },
  { position: [-5.7, -0.4, -2.7], scale: [2.7, 0.88, 1.95], rotation: [0.06, 0.48, 0.02] },
  { position: [5.25, -0.2, 2.15], scale: [2.35, 0.7, 1.72], rotation: [-0.06, -0.34, 0.08] },
  { position: [4.1, -0.18, -0.25], scale: [1.65, 0.52, 1.36], rotation: [0.04, 0.22, -0.05] },
  { position: [5.85, -0.38, -2.85], scale: [2.8, 0.9, 2], rotation: [-0.04, -0.5, 0.03] },
];

const TERRACE_STONES: readonly RockMassProps[] = [
  { position: [-3.65, -0.25, 3.2], scale: [1.25, 0.3, 0.95], rotation: [0, 0.12, 0.05], color: '#526c64' },
  { position: [-2.95, -0.27, 4.05], scale: [1.05, 0.25, 0.82], rotation: [0.03, -0.32, -0.03], color: '#587168' },
  { position: [3.55, -0.26, 3.35], scale: [1.32, 0.3, 0.96], rotation: [0.02, -0.18, -0.04], color: '#526c64' },
  { position: [2.8, -0.28, 4.2], scale: [0.98, 0.24, 0.78], rotation: [-0.02, 0.38, 0.04], color: '#597269' },
  { position: [-3.4, -0.31, -4.2], scale: [1.4, 0.34, 1], rotation: [0, 0.36, 0], color: '#466360' },
  { position: [3.45, -0.31, -4.35], scale: [1.46, 0.36, 1.05], rotation: [0, -0.3, 0], color: '#43615e' },
];

const SAND_PATCHES = [
  { position: [-1.7, -0.345, 2.1] as Vec3, scale: [1.8, 1.05, 1] as Vec3, rotation: 0.2 },
  { position: [1.55, -0.344, 2.6] as Vec3, scale: [1.45, 0.88, 1] as Vec3, rotation: -0.3 },
  { position: [-1.25, -0.343, -2.5] as Vec3, scale: [1.7, 0.82, 1] as Vec3, rotation: -0.18 },
  { position: [1.8, -0.342, -2.1] as Vec3, scale: [1.35, 0.72, 1] as Vec3, rotation: 0.34 },
] as const;

function RockMass({
  position,
  scale,
  rotation = [0, 0, 0],
  color = PALETTE.rock,
  material,
}: RockMassProps) {
  return (
    <mesh
      position={[position[0], position[1], position[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
      receiveShadow={false}
      castShadow={false}
      {...(material ? { material } : {})}
    >
      <dodecahedronGeometry args={[1, 0]} />
      {!material && <meshStandardMaterial color={color} roughness={0.98} metalness={0} />}
    </mesh>
  );
}

/**
 * Four flattened rock lobes replace the old concentric cylinder plates. Their
 * offsets, thicknesses and rotations deliberately disagree so the silhouette
 * has noses, bays and stepped undersides from every orbit angle. The rear lobe
 * sits lowest and deepest, visually burying the shelf into the core.
 */
function PlateLedge({
  position,
  scale,
  rotation = [0, 0, 0],
  color,
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
        receiveShadow={false}
        castShadow={false}
        {...(material ? { material } : {})}
      >
        <dodecahedronGeometry args={[1, 0]} />
        {!material && <meshStandardMaterial color={color} roughness={0.98} metalness={0} />}
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
        receiveShadow={false}
        castShadow={false}
        {...(material ? { material } : {})}
      >
        <dodecahedronGeometry args={[1, 0]} />
        {!material && <meshStandardMaterial color={color} roughness={0.99} metalness={0} />}
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
        receiveShadow={false}
        castShadow={false}
        {...(material ? { material } : {})}
      >
        <dodecahedronGeometry args={[1, 0]} />
        {!material && <meshStandardMaterial color={color} roughness={0.99} metalness={0} />}
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
        receiveShadow={false}
        castShadow={false}
        {...(material ? { material } : {})}
      >
        <dodecahedronGeometry args={[1, 0]} />
        {!material && <meshStandardMaterial color={color} roughness={1} metalness={0} />}
      </mesh>
    </group>
  );
}

function SandPatch({
  position,
  scale,
  rotation,
}: {
  position: Vec3;
  scale: Vec3;
  rotation: number;
}) {
  return (
    <mesh
      position={[position[0], position[1], position[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      rotation={[-Math.PI / 2, 0, rotation]}
      receiveShadow={false}
      castShadow={false}
    >
      <circleGeometry args={[1, 20]} />
      <meshStandardMaterial color={PALETTE.sand} roughness={1} metalness={0} />
    </mesh>
  );
}

/** One completed relationship year becomes a stable, curved reef arch. */
function GrowthArch({
  arch,
  material,
}: {
  arch: ReefGrowthArchPlacement;
  material: Material;
}) {
  const curve = useMemo(() => new CatmullRomCurve3([
    new Vector3(-arch.span * 0.5, 0, 0),
    new Vector3(-arch.span * 0.34, arch.height * 0.56, arch.curveDepth * 0.42),
    new Vector3(0, arch.height, arch.curveDepth),
    new Vector3(arch.span * 0.34, arch.height * 0.56, arch.curveDepth * 0.42),
    new Vector3(arch.span * 0.5, 0, 0),
  ], false, 'centripetal'), [arch.curveDepth, arch.height, arch.span]);

  return (
    <group
      name={arch.id}
      position={[arch.center.x, arch.center.y, arch.center.z]}
      rotation={[0, arch.rotationY, 0]}
    >
      <mesh material={material} receiveShadow={false} castShadow={false}>
        <tubeGeometry args={[curve, 36, arch.thickness, 8, false]} />
      </mesh>
      <RockMass
        position={[-arch.span * 0.48, -0.06, 0]}
        scale={[arch.thickness * 1.8, arch.thickness * 1.35, arch.thickness * 1.55]}
        rotation={[0.06, 0.28, -0.04]}
        material={material}
      />
      <RockMass
        position={[arch.span * 0.48, -0.06, 0]}
        scale={[arch.thickness * 1.75, arch.thickness * 1.32, arch.thickness * 1.5]}
        rotation={[-0.04, -0.26, 0.05]}
        material={material}
      />
      <PlateLedge
        position={[0, arch.height * 0.94, arch.curveDepth * 0.76]}
        scale={[arch.span * 0.32, arch.thickness * 0.52, arch.span * 0.2]}
        rotation={[0.02, arch.rotationY * 0.08, -0.02]}
        color="#607970"
        material={material}
        variant={(arch.yearIndex % 5) as 0 | 1 | 2 | 3 | 4}
      />
    </group>
  );
}

/** Every visited place opens a separate neighbouring rock for future life. */
function GrowthOutcrop({
  outcrop,
  material,
}: {
  outcrop: ReefGrowthOutcropPlacement;
  material: Material;
}) {
  const radius = outcrop.footprintRadius;
  return (
    <group
      name={outcrop.id}
      position={[outcrop.center.x, outcrop.center.y, outcrop.center.z]}
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
        color="#58736d"
        material={material}
        variant={(outcrop.seed % 5) as 0 | 1 | 2 | 3 | 4}
      />
    </group>
  );
}

/** One active Schedule month becomes one low chronological terrace. */
function GrowthTerrace({
  terrace,
  material,
}: {
  terrace: ReefGrowthTerracePlacement;
  material: Material;
}) {
  return (
    <group
      name={terrace.id}
      position={[terrace.center.x, terrace.center.y, terrace.center.z]}
      rotation={[0, terrace.rotationY, 0]}
    >
      <PlateLedge
        position={[0, terrace.thickness * 0.8, 0]}
        scale={[
          terrace.footprintRadius * 0.62,
          terrace.thickness,
          terrace.footprintRadius * 0.48,
        ]}
        color="#637a70"
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
      <RockMass
        position={[0, 0, 0]}
        scale={[1.55, 0.72, 1.35]}
        material={material}
      />
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

function ReefContactShadow() {
  return (
    <>
      <mesh
        position={[0.02, -0.335, 0.02]}
        rotation={[-Math.PI / 2, 0, -0.08]}
        scale={[1.45, 1.02, 1]}
      >
        <circleGeometry args={[1, 28]} />
        <meshBasicMaterial
          color={PALETTE.contact}
          transparent
          opacity={0.1}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh
        position={[0.06, -0.334, -0.03]}
        rotation={[-Math.PI / 2, 0, 0.1]}
        scale={[2.2, 1.35, 1]}
      >
        <circleGeometry args={[1, 22]} />
        <meshBasicMaterial
          color={PALETTE.contact}
          transparent
          opacity={0.03}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
    </>
  );
}

/**
 * Static terrain surrounding the production reef.
 *
 * The hero now uses a three-tier cascade: broad lower ledge, offset middle ledge
 * and compact crown, while the seabed stays continuous around the rock spine.
 */
export function ReefEnvironment({ build }: { build: ReefPreviewBuild }) {
  const rockMaterials = useReefRockMaterials();
  const { structures } = build;

  return (
    <group name="reef-environment-three-tier-cascade">
      <mesh position={[0, -0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <circleGeometry args={[18, 48]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={1} metalness={0} />
      </mesh>

      <ReefContactShadow />

      <group name="reef-hero-support">
        <group scale={[
          structures.foundationScaleXZ,
          structures.foundationScaleY,
          structures.foundationScaleXZ,
        ]}>
          {BASE_CORE_MASSES.map((rock, index) => (
            <RockMass key={`reef-base-core-${index}`} {...rock} material={rockMaterials.hero} />
          ))}
          {CORE_BRIDGE_MASSES.map((rock, index) => (
            <RockMass key={`reef-core-bridge-${index}`} {...rock} material={rockMaterials.hero} />
          ))}
          {CORE_LOWER_FILL.map((rock, index) => (
            <RockMass key={`reef-core-fill-${index}`} {...rock} material={rockMaterials.hero} />
          ))}
          {BASE_LEDGE_ROOTS.map((rock, index) => (
            <RockMass key={`reef-ledge-root-${index}`} {...rock} material={rockMaterials.hero} />
          ))}
          {BASE_PLATE_LEDGES.map((ledge, index) => (
            <PlateLedge key={`reef-base-ledge-${index}`} {...ledge} material={rockMaterials.hero} />
          ))}
          {BASE_DEBRIS.map((rock, index) => (
            <RockMass key={`reef-base-debris-${index}`} {...rock} material={rockMaterials.rock} />
          ))}
        </group>

        {structures.arches.map((arch) => (
          <GrowthArch key={arch.id} arch={arch} material={rockMaterials.hero} />
        ))}
        {structures.outcrops.map((outcrop) => (
          <GrowthOutcrop key={outcrop.id} outcrop={outcrop} material={rockMaterials.hero} />
        ))}
        {structures.terraces.map((terrace) => (
          <GrowthTerrace key={terrace.id} terrace={terrace} material={rockMaterials.hero} />
        ))}
      </group>

      {SAND_PATCHES.map((patch, index) => (
        <SandPatch key={`reef-sand-${index}`} {...patch} />
      ))}

      {NEAR_ROCKS.map((rock, index) => (
        <RockMass key={`reef-near-rock-${index}`} {...rock} material={rockMaterials.rock} />
      ))}
      {TERRACE_STONES.map((rock, index) => (
        <RockMass key={`reef-terrace-${index}`} {...rock} material={rockMaterials.rock} />
      ))}

      <DistantSpire
        position={[-6.8, -0.35, -8.7]}
        scale={1.25}
        rotation={0.28}
        material={rockMaterials.distant}
      />
      <DistantSpire
        position={[6.9, -0.6, -9.8]}
        scale={1.42}
        rotation={-0.38}
        material={rockMaterials.distant}
      />
      <DistantSpire
        position={[-2.4, -0.9, -12.8]}
        scale={0.9}
        rotation={-0.12}
        material={rockMaterials.distant}
      />
      <DistantSpire
        position={[2.9, -1.0, -13.6]}
        scale={0.82}
        rotation={0.2}
        material={rockMaterials.distant}
      />

      <RockMass
        position={[-8.9, -0.95, -7.1]}
        scale={[3.9, 1.05, 2.6]}
        rotation={[0.02, 0.38, -0.04]}
        material={rockMaterials.distant}
      />
      <RockMass
        position={[9.1, -1.05, -7.8]}
        scale={[4.1, 1.12, 2.8]}
        rotation={[-0.03, -0.42, 0.03]}
        material={rockMaterials.distant}
      />
    </group>
  );
}
