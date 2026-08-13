type Vec3 = readonly [number, number, number];

type FacetedMass = {
  position: Vec3;
  scale: Vec3;
  rotation: Vec3;
  color: string;
};

/**
 * Low relief sediment caps sit just above the legacy flat sand circles. They do
 * not erase the warm sand completely: a narrow irregular rim remains visible,
 * while the centre gains thickness, facets and a closer value to the seabed.
 */
const SEDIMENT_CAPS: readonly FacetedMass[] = [
  { position: [-1.7, -0.334, 2.1], scale: [1.5, 0.022, 0.84], rotation: [0.01, 0.2, -0.01], color: '#7c8076' },
  { position: [1.55, -0.333, 2.6], scale: [1.18, 0.021, 0.7], rotation: [-0.01, -0.3, 0.01], color: '#808176' },
  { position: [-1.25, -0.332, -2.5], scale: [1.4, 0.021, 0.66], rotation: [0.01, -0.18, 0], color: '#777d74' },
  { position: [1.8, -0.331, -2.1], scale: [1.08, 0.02, 0.58], rotation: [-0.01, 0.34, 0.01], color: '#747b72' },
] as const;

/** Small floor-coloured chips break the remaining smooth sand outlines. */
const SEDIMENT_BREAKERS: readonly FacetedMass[] = [
  { position: [-2.5, -0.326, 2.34], scale: [0.42, 0.028, 0.28], rotation: [0.02, -0.38, 0.01], color: '#68776d' },
  { position: [-0.92, -0.325, 1.82], scale: [0.34, 0.024, 0.25], rotation: [-0.01, 0.44, 0], color: '#6d7a70' },
  { position: [0.94, -0.325, 2.75], scale: [0.32, 0.025, 0.23], rotation: [0.01, 0.26, -0.01], color: '#6b796f' },
  { position: [2.2, -0.324, 2.32], scale: [0.35, 0.024, 0.24], rotation: [0, -0.42, 0.01], color: '#6a786f' },
  { position: [-2.02, -0.324, -2.38], scale: [0.4, 0.026, 0.24], rotation: [0.01, 0.31, 0], color: '#65756d' },
  { position: [-0.5, -0.324, -2.7], scale: [0.33, 0.024, 0.22], rotation: [-0.01, -0.34, 0.01], color: '#6b786f' },
  { position: [1.18, -0.323, -1.9], scale: [0.3, 0.023, 0.21], rotation: [0, 0.28, -0.01], color: '#66766d' },
  { position: [2.35, -0.323, -2.24], scale: [0.34, 0.025, 0.23], rotation: [0.01, -0.3, 0], color: '#6b786f' },
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
      {SEDIMENT_CAPS.map((mass, index) => (
        <CleanupMass key={`reef-sediment-cap-${index}`} {...mass} />
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
