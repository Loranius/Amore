type Vec3 = readonly [number, number, number];

type RockMassProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  color?: string;
};

type PlateLedgeProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  color: string;
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
 * Backing masses stay mostly inside the core while the visible shelves project
 * farther outward. That keeps each terrace structurally attached without
 * swallowing the ledge silhouette back into the mound.
 */
const BASE_LEDGE_ROOTS: readonly RockMassProps[] = [
  {
    position: [-0.5, 0.05, 0.24],
    scale: [0.76, 0.48, 0.64],
    rotation: [0.06, 0.26, -0.05],
    color: '#4f6861',
  },
  {
    position: [0.43, 0.15, 0.1],
    scale: [0.8, 0.46, 0.65],
    rotation: [-0.04, -0.22, 0.04],
    color: '#536c64',
  },
  {
    position: [-0.11, 0.5, -0.23],
    scale: [0.7, 0.42, 0.58],
    rotation: [0.08, 0.16, -0.04],
    color: '#587067',
  },
  {
    position: [0.24, 0.69, -0.03],
    scale: [0.58, 0.36, 0.5],
    rotation: [-0.03, -0.18, 0.05],
    color: '#5c7369',
  },
  {
    position: [-0.19, 0.84, 0.05],
    scale: [0.48, 0.3, 0.42],
    rotation: [0.05, 0.24, -0.03],
    color: '#61786d',
  },
] as const;

/**
 * Sculpt pass 3: shelves project 20–35% farther from the core and gain a modest
 * footprint increase. The lower terraces remain the broadest while the crown
 * stays compact, so the cascade reads clearly from side and three-quarter views.
 */
const BASE_PLATE_LEDGES: readonly PlateLedgeProps[] = [
  {
    position: [-0.92, 0.18, 0.52],
    scale: [1.38, 0.18, 0.9],
    rotation: [0.04, 0.22, 0.04],
    color: '#8eb2aa',
    variant: 0,
  },
  {
    position: [0.72, 0.3, 0.24],
    scale: [1.44, 0.2, 0.92],
    rotation: [-0.05, -0.2, 0.03],
    color: '#96bbb1',
    variant: 1,
  },
  {
    position: [-0.18, 0.65, -0.43],
    scale: [1.2, 0.18, 0.8],
    rotation: [0.06, 0.14, -0.05],
    color: '#85aaa5',
    variant: 2,
  },
  {
    position: [0.42, 0.86, 0.04],
    scale: [1.0, 0.16, 0.7],
    rotation: [-0.03, -0.16, 0.04],
    color: '#a0c2b7',
    variant: 3,
  },
  {
    position: [-0.36, 1.02, 0.12],
    scale: [0.8, 0.14, 0.58],
    rotation: [0.05, 0.26, -0.03],
    color: '#91b7af',
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
}: RockMassProps) {
  return (
    <mesh
      position={[position[0], position[1], position[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
      receiveShadow={false}
      castShadow={false}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.98} metalness={0} />
    </mesh>
  );
}

/**
 * A ledge is built from three overlapping low-poly plates rather than one clean
 * cylinder. The overlap breaks the circular silhouette, creates small bays and
 * noses around the edge, and gives the shelf enough thickness to read as rock
 * grown out of the reef core instead of a paper-thin disc.
 */
function PlateLedge({
  position,
  scale,
  rotation = [0, 0, 0],
  color,
  variant,
}: PlateLedgeProps) {
  const direction = variant % 2 === 0 ? -1 : 1;
  const depthBias = (variant % 3 - 1) * 0.12;
  const yawBias = (variant - 2) * 0.055;

  return (
    <group
      position={[position[0], position[1], position[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
    >
      <mesh
        scale={[scale[0], scale[1], scale[2]]}
        rotation={[0, yawBias, 0]}
        receiveShadow={false}
        castShadow={false}
      >
        <cylinderGeometry args={[1, 0.8, 1, 9, 1]} />
        <meshStandardMaterial color={color} roughness={0.97} metalness={0} />
      </mesh>

      <mesh
        position={[
          direction * scale[0] * 0.43,
          -scale[1] * 0.12,
          scale[2] * (0.12 + depthBias),
        ]}
        scale={[scale[0] * 0.58, scale[1] * 0.88, scale[2] * 0.64]}
        rotation={[0, direction * (0.28 + variant * 0.025), 0]}
        receiveShadow={false}
        castShadow={false}
      >
        <cylinderGeometry args={[1, 0.76, 1, 7, 1]} />
        <meshStandardMaterial color={color} roughness={0.98} metalness={0} />
      </mesh>

      <mesh
        position={[
          -direction * scale[0] * 0.31,
          scale[1] * 0.05,
          -scale[2] * (0.24 - depthBias * 0.5),
        ]}
        scale={[scale[0] * 0.46, scale[1] * 0.76, scale[2] * 0.52]}
        rotation={[0, -direction * (0.34 - variant * 0.018), 0]}
        receiveShadow={false}
        castShadow={false}
      >
        <cylinderGeometry args={[1, 0.72, 1, 7, 1]} />
        <meshStandardMaterial color={color} roughness={0.98} metalness={0} />
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

function DistantSpire({
  position,
  scale,
  rotation = 0,
}: {
  position: Vec3;
  scale: number;
  rotation?: number;
}) {
  return (
    <group
      position={[position[0], position[1], position[2]]}
      rotation={[0, rotation, 0]}
      scale={scale}
    >
      <RockMass position={[0, 0, 0]} scale={[1.55, 0.72, 1.35]} color="#2f5758" />
      <RockMass position={[-0.18, 1.02, 0.04]} scale={[0.88, 1.12, 0.82]} rotation={[0.05, 0.24, -0.08]} color="#2a5255" />
      <RockMass position={[0.14, 2.05, -0.03]} scale={[0.58, 0.86, 0.56]} rotation={[-0.04, -0.2, 0.07]} color="#274d52" />
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
 * The old broad gray hemisphere is intentionally gone. The hero now rises from
 * one overlapping asymmetric coral-rock spine with exposed cascading ledges,
 * closer to the layered reference silhouette while the seabed stays visible.
 */
export function ReefEnvironment() {
  return (
    <group name="reef-environment-cascade-ledges">
      <mesh position={[0, -0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <circleGeometry args={[18, 48]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={1} metalness={0} />
      </mesh>

      <ReefContactShadow />

      {BASE_CORE_MASSES.map((rock, index) => (
        <RockMass key={`reef-base-core-${index}`} {...rock} />
      ))}
      {CORE_BRIDGE_MASSES.map((rock, index) => (
        <RockMass key={`reef-core-bridge-${index}`} {...rock} />
      ))}
      {CORE_LOWER_FILL.map((rock, index) => (
        <RockMass key={`reef-core-fill-${index}`} {...rock} />
      ))}
      {BASE_LEDGE_ROOTS.map((rock, index) => (
        <RockMass key={`reef-ledge-root-${index}`} {...rock} />
      ))}
      {BASE_PLATE_LEDGES.map((ledge, index) => (
        <PlateLedge key={`reef-base-ledge-${index}`} {...ledge} />
      ))}
      {BASE_DEBRIS.map((rock, index) => (
        <RockMass key={`reef-base-debris-${index}`} {...rock} />
      ))}

      {SAND_PATCHES.map((patch, index) => (
        <SandPatch key={`reef-sand-${index}`} {...patch} />
      ))}

      {NEAR_ROCKS.map((rock, index) => (
        <RockMass key={`reef-near-rock-${index}`} {...rock} />
      ))}
      {TERRACE_STONES.map((rock, index) => (
        <RockMass key={`reef-terrace-${index}`} {...rock} />
      ))}

      <DistantSpire position={[-6.8, -0.35, -8.7]} scale={1.25} rotation={0.28} />
      <DistantSpire position={[6.9, -0.6, -9.8]} scale={1.42} rotation={-0.38} />
      <DistantSpire position={[-2.4, -0.9, -12.8]} scale={0.9} rotation={-0.12} />
      <DistantSpire position={[2.9, -1.0, -13.6]} scale={0.82} rotation={0.2} />

      <RockMass
        position={[-8.9, -0.95, -7.1]}
        scale={[3.9, 1.05, 2.6]}
        rotation={[0.02, 0.38, -0.04]}
        color="#315959"
      />
      <RockMass
        position={[9.1, -1.05, -7.8]}
        scale={[4.1, 1.12, 2.8]}
        rotation={[-0.03, -0.42, 0.03]}
        color="#2e5658"
      />
    </group>
  );
}
