type Vec3 = readonly [number, number, number];

type RockMassProps = {
  position: Vec3;
  scale: Vec3;
  rotation?: Vec3;
  color?: string;
};

const PALETTE = {
  floor: '#69776d',
  shelf: '#647168',
  sand: '#9d9883',
  rock: '#42615e',
  contact: '#173f43',
} as const;

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
        position={[0.05, -0.204, 0.05]}
        rotation={[-Math.PI / 2, 0, -0.08]}
        scale={[2.15, 1.38, 1]}
      >
        <circleGeometry args={[1, 36]} />
        <meshBasicMaterial
          color={PALETTE.contact}
          transparent
          opacity={0.11}
          depthWrite={false}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-1}
        />
      </mesh>
      <mesh
        position={[0.12, -0.203, -0.06]}
        rotation={[-Math.PI / 2, 0, 0.12]}
        scale={[3.15, 1.9, 1]}
      >
        <circleGeometry args={[1, 28]} />
        <meshBasicMaterial
          color={PALETTE.contact}
          transparent
          opacity={0.035}
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
 * Stage 4 keeps this world subordinate to the generated colony: cool terrain
 * colours converge toward the water fog, while two cheap contact-shadow proxies
 * anchor the accepted foundation to the shelf without enabling realtime shadows.
 */
export function ReefEnvironment() {
  return (
    <group name="reef-environment-stage-4">
      {/* A broad floor gives every camera angle a continuous seabed. */}
      <mesh position={[0, -0.36, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
        <circleGeometry args={[18, 48]} />
        <meshStandardMaterial color={PALETTE.floor} roughness={1} metalness={0} />
      </mesh>

      {/* A very shallow shelf visually joins the reef foundation to the floor
          without reading as a pedestal or a second coral base. */}
      <mesh position={[0, -0.39, 0]} scale={[4.25, 0.18, 3.65]} receiveShadow={false}>
        <sphereGeometry args={[1, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={PALETTE.shelf} roughness={1} metalness={0} />
      </mesh>

      <ReefContactShadow />

      {/* Pale sediment breaks the floor into natural patches while preserving a
          clean central footprint for the procedural colony. */}
      {SAND_PATCHES.map((patch, index) => (
        <SandPatch key={`reef-sand-${index}`} {...patch} />
      ))}

      {/* Low, asymmetric shelves frame the hero object instead of surrounding
          it with a perfect ring. */}
      {NEAR_ROCKS.map((rock, index) => (
        <RockMass key={`reef-near-rock-${index}`} {...rock} />
      ))}
      {TERRACE_STONES.map((rock, index) => (
        <RockMass key={`reef-terrace-${index}`} {...rock} />
      ))}

      {/* Three depth layers. Fog does the expensive visual work; geometry stays
          deliberately coarse and cheap enough for the mobile portal. */}
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
