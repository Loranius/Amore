type Vec3 = readonly [number, number, number];

type FacetedMass = {
  position: Vec3;
  scale: Vec3;
  rotation: Vec3;
  color: string;
};

type SedimentBlend = {
  position: Vec3;
  scale: Vec3;
  rotation: number;
  color: string;
};

/**
 * The original sand patches are deliberately warm, but in the underwater grade
 * they read as pale stickers. These translucent overlays follow the exact same
 * footprints and pull their value back toward the seabed without placing any
 * new solid slab on top of them.
 */
const SEDIMENT_BLENDS: readonly SedimentBlend[] = [
  { position: [-1.7, -0.338, 2.1], scale: [1.8, 1.05, 1], rotation: 0.2, color: '#65746c' },
  { position: [1.55, -0.337, 2.6], scale: [1.45, 0.88, 1], rotation: -0.3, color: '#69766d' },
  { position: [-1.25, -0.336, -2.5], scale: [1.7, 0.82, 1], rotation: -0.18, color: '#63736b' },
  { position: [1.8, -0.335, -2.1], scale: [1.35, 0.72, 1], rotation: 0.34, color: '#65746c' },
] as const;

/** Small floor-coloured chips interrupt the otherwise smooth circular edges. */
const SEDIMENT_BREAKERS: readonly FacetedMass[] = [
  { position: [-2.5, -0.326, 2.34], scale: [0.32, 0.02, 0.21], rotation: [0.02, -0.38, 0.01], color: '#68776d' },
  { position: [-0.92, -0.325, 1.82], scale: [0.27, 0.018, 0.2], rotation: [-0.01, 0.44, 0], color: '#6d7a70' },
  { position: [0.94, -0.325, 2.75], scale: [0.25, 0.018, 0.18], rotation: [0.01, 0.26, -0.01], color: '#6b796f' },
  { position: [2.2, -0.324, 2.32], scale: [0.28, 0.018, 0.19], rotation: [0, -0.42, 0.01], color: '#6a786f' },
  { position: [-2.02, -0.324, -2.38], scale: [0.31, 0.019, 0.19], rotation: [0.01, 0.31, 0], color: '#65756d' },
  { position: [-0.5, -0.324, -2.7], scale: [0.26, 0.018, 0.17], rotation: [-0.01, -0.34, 0.01], color: '#6b786f' },
  { position: [1.18, -0.323, -1.9], scale: [0.24, 0.017, 0.17], rotation: [0, 0.28, -0.01], color: '#66766d' },
  { position: [2.35, -0.323, -2.24], scale: [0.27, 0.018, 0.18], rotation: [0.01, -0.3, 0], color: '#6b786f' },
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

function SedimentBlendMesh({ position, scale, rotation, color }: SedimentBlend) {
  return (
    <mesh
      position={[position[0], position[1], position[2]]}
      scale={[scale[0], scale[1], scale[2]]}
      rotation={[-Math.PI / 2, 0, rotation]}
      castShadow={false}
      receiveShadow={false}
      renderOrder={1}
    >
      <circleGeometry args={[1, 16]} />
      <meshStandardMaterial
        color={color}
        roughness={1}
        metalness={0}
        transparent
        opacity={0.58}
        depthWrite={false}
      />
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
      {SEDIMENT_BLENDS.map((blend, index) => (
        <SedimentBlendMesh key={`reef-sediment-blend-${index}`} {...blend} />
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
