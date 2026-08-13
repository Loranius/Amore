type Vec3 = readonly [number, number, number];

type FacetedMass = {
  position: Vec3;
  scale: Vec3;
  rotation: Vec3;
  color: string;
};

type FloorMask = {
  position: Vec3;
  scale: Vec3;
  rotation: number;
};

/**
 * The legacy warm sand circles read as bright flat stickers in the final water
 * grade. Cover their exact 20-sided footprint with the seabed material instead
 * of stacking another visible accent on top. This removes the pale patches
 * without touching the surrounding rock composition.
 */
const FLOOR_MASKS: readonly FloorMask[] = [
  { position: [-1.7, -0.337, 2.1], scale: [1.8, 1.05, 1], rotation: 0.2 },
  { position: [1.55, -0.336, 2.6], scale: [1.45, 0.88, 1], rotation: -0.3 },
  { position: [-1.25, -0.335, -2.5], scale: [1.7, 0.82, 1], rotation: -0.18 },
  { position: [1.8, -0.334, -2.1], scale: [1.35, 0.72, 1], rotation: 0.34 },
] as const;

/** Small low-profile chips keep the recovered seabed from becoming sterile. */
const SEDIMENT_BREAKERS: readonly FacetedMass[] = [
  { position: [-2.5, -0.326, 2.34], scale: [0.28, 0.018, 0.18], rotation: [0.02, -0.38, 0.01], color: '#627169' },
  { position: [-0.92, -0.325, 1.82], scale: [0.23, 0.016, 0.17], rotation: [-0.01, 0.44, 0], color: '#708078' },
  { position: [0.94, -0.325, 2.75], scale: [0.21, 0.016, 0.15], rotation: [0.01, 0.26, -0.01], color: '#617269' },
  { position: [2.2, -0.324, 2.32], scale: [0.24, 0.016, 0.16], rotation: [0, -0.42, 0.01], color: '#718078' },
  { position: [-2.02, -0.324, -2.38], scale: [0.27, 0.017, 0.16], rotation: [0.01, 0.31, 0], color: '#607169' },
  { position: [-0.5, -0.324, -2.7], scale: [0.22, 0.016, 0.15], rotation: [-0.01, -0.34, 0.01], color: '#708078' },
  { position: [1.18, -0.323, -1.9], scale: [0.2, 0.015, 0.14], rotation: [0, 0.28, -0.01], color: '#607169' },
  { position: [2.35, -0.323, -2.24], scale: [0.23, 0.016, 0.15], rotation: [0.01, -0.3, 0], color: '#708078' },
] as const;

/**
 * Hidden-looking voids around the hero footprint are closed with dark, rounded
 * rock masses. Their low placement keeps shelf noses readable while removing
 * the impression that separate polygon slabs are hovering beside one another.
 */
const SEAM_FILLERS: readonly FacetedMass[] = [
  { position: [-1.18, -0.13, 0.46], scale: [0.66, 0.31, 0.5], rotation: [0.04, 0.28, -0.03], color: '#405d59' },
  { position: [1.18, -0.13, 0.4], scale: [0.64, 0.3, 0.48], rotation: [-0.03, -0.24, 0.03], color: '#42605b' },
  { position: [-0.72, -0.1, -0.52], scale: [0.58, 0.27, 0.46], rotation: [0.03, -0.2, -0.02], color: '#3e5a57' },
  { position: [0.72, -0.1, -0.5], scale: [0.58, 0.27, 0.46], rotation: [-0.02, 0.23, 0.03], color: '#425f5a' },
  { position: [-0.42, 0.18, 0.03], scale: [0.44, 0.24, 0.38], rotation: [0.04, 0.18, -0.02], color: '#49645e' },
  { position: [0.42, 0.2, -0.02], scale: [0.43, 0.23, 0.37], rotation: [-0.03, -0.19, 0.02], color: '#4d6861' },
] as const;

function FloorMaskMesh({ position, scale, rotation }: FloorMask) {
  return (
    <mesh
      position={[position[0], position[1], position[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      rotation={[-Math.PI / 2, 0, rotation]}
      castShadow={false}
      receiveShadow={false}
      renderOrder={1}
    >
      <circleGeometry args={[1, 20]} />
      <meshStandardMaterial color="#69776d" roughness={1} metalness={0} />
    </mesh>
  );
}

function CleanupMass({ position, scale, rotation, color }: FacetedMass) {
  return (
    <mesh
      position={[position[0], position[1], position[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      rotation={[rotation[0], rotation[1], rotation[2]]}
      castShadow={false}
      receiveShadow={false}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color={color} roughness={0.99} metalness={0} />
    </mesh>
  );
}

/** Visual integration pass layered around, not instead of, the existing reef. */
export function ReefCleanupLayer() {
  return (
    <group name="reef-cleanup-integration">
      {FLOOR_MASKS.map((mask, index) => (
        <FloorMaskMesh key={`reef-floor-mask-${index}`} {...mask} />
      ))}
      {SEDIMENT_BREAKERS.map((mass, index) => (
        <CleanupMass key={`reef-sediment-breaker-${index}`} {...mass} />
      ))}
      {SEAM_FILLERS.map((mass, index) => (
        <CleanupMass key={`reef-seam-filler-${index}`} {...mass} />
      ))}
    </group>
  );
}
