import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  buildReefLivingCanopyPlan,
  type ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import {
  buildReefMorphologyFamiliesGeometry,
  reefMorphologyProminence,
  REEF_MORPHOLOGY_FAMILIES_PASS,
  REEF_MORPHOLOGY_FAMILIES_VERSION,
} from './reefMorphologyFamilies';
import {
  collectReefArchSupportMeshes,
  collectReefSupportMeshes,
  collectReefSupportSlotCandidates,
  collectReefTerrainSupportMeshes,
  raycastReefCoralTerrainSupport,
} from './reefSupportPlacement';
import {
  allocateReefSurfaceSlots,
  buildReefSurfaceSlotCandidates,
} from './reefSurfaceSlots';

export interface ReefDensityCandidateCounts {
  sourceColonies: number;
  drawCalls: 0 | 1;
  morphotypeCounts: Record<ReefColonyMorphotype, number>;
}

const TAU = Math.PI * 2;
const REEF_CANOPY_LAYOUT = 'morphology-habitats-with-open-channels-v2';

function stableUnit(seed: number, label: string): number {
  let hash = (seed ^ 0x9e3779b9) >>> 0;
  for (let index = 0; index < label.length; index += 1) {
    hash ^= label.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  return (hash >>> 0) / 0xffffffff;
}

/**
 * Three habitat patches deliberately replace the old four-way scatter. The
 * angular gaps between them stay open as readable channels through the reef.
 */
function morphotypeHabitatIndex(morphotype: ReefColonyMorphotype): 0 | 1 | 2 {
  switch (morphotype) {
    case 'branching': return 0;
    case 'soft-coral': return 0;
    case 'plating': return 1;
    case 'sea-fan': return 1;
    case 'massive': return 2;
    case 'encrusting': return 2;
  }
}

function morphotypeRadialRatio(morphotype: ReefColonyMorphotype): number {
  switch (morphotype) {
    case 'branching': return 0.43;
    case 'soft-coral': return 0.5;
    case 'plating': return 0.68;
    case 'sea-fan': return 0.72;
    case 'massive': return 0.57;
    case 'encrusting': return 0.52;
  }
}

function morphotypeHabitatStrength(morphotype: ReefColonyMorphotype): number {
  switch (morphotype) {
    case 'branching': return 0.88;
    case 'plating': return 0.87;
    case 'encrusting': return 0.84;
    case 'massive': return 0.82;
    case 'sea-fan': return 0.8;
    case 'soft-coral': return 0.78;
  }
}

/**
 * Stage 3 visual ecology. Logical colony IDs/order remain untouched; only the
 * renderer anchor is biased into stable morphology-specific habitat patches.
 * The result has dominant coral gardens separated by negative-space channels
 * instead of evenly peppering every available centimetre of rock.
 */
function buildHabitatPlan(
  plan: ReefLivingCanopyPlan,
  build: ReefPreviewBuild,
): ReefLivingCanopyPlan {
  const radius = build.structures.visibleFoundationRadius;
  const seed = build.species.moduleEvolution.identitySeed;
  const basePhase = stableUnit(seed, 'reef:morphology-habitats:phase') * TAU;
  const habitatAngles = [0.08, 2.12, 4.22] as const;

  const colonies = plan.colonies.map((colony) => {
    const habitatIndex = morphotypeHabitatIndex(colony.morphotype);
    const prominence = reefMorphologyProminence(colony);
    const dominant = prominence >= 0.94;
    const angleJitter = (stableUnit(colony.seed, 'reef:habitat:angle') - 0.5)
      * (dominant ? 0.28 : 0.58);
    const angle = basePhase + habitatAngles[habitatIndex] + angleJitter;
    const radialRatio = morphotypeRadialRatio(colony.morphotype);
    const radialJitter = dominant
      ? 0.95 + stableUnit(colony.seed, 'reef:habitat:radius') * 0.08
      : 0.88 + stableUnit(colony.seed, 'reef:habitat:radius') * 0.24;
    const localRadius = radius * radialRatio * radialJitter;
    const targetX = Math.cos(angle) * localRadius;
    const targetZ = Math.sin(angle) * localRadius;
    const strength = Math.min(
      0.94,
      morphotypeHabitatStrength(colony.morphotype) + (dominant ? 0.05 : 0),
    );
    const preferred = colony.request.preferred;
    const request = {
      ...colony.request,
      preferred: {
        x: THREE.MathUtils.lerp(preferred.x, targetX, strength),
        y: preferred.y,
        z: THREE.MathUtils.lerp(preferred.z, targetZ, strength),
      },
    };

    return { ...colony, request };
  });

  return {
    ...plan,
    colonies,
    requests: colonies.map((colony) => colony.request),
  };
}

export function reefDensityCandidateCounts(build: ReefPreviewBuild): ReefDensityCandidateCounts {
  const plan = buildReefLivingCanopyPlan(build);
  return {
    sourceColonies: plan.colonies.length,
    drawCalls: plan.colonies.length > 0 ? 1 : 0,
    morphotypeCounts: plan.morphotypeCounts,
  };
}

function DensityCorals({ build }: { build: ReefPreviewBuild }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const basePlan = useMemo(() => buildReefLivingCanopyPlan(build), [build]);
  const plan = useMemo(() => buildHabitatPlan(basePlan, build), [basePlan, build]);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'reef-morphology-families-shared-material',
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.78,
    metalness: 0,
    emissive: '#261d2d',
    emissiveIntensity: 0.06,
    flatShading: true,
    side: THREE.DoubleSide,
  }), []);

  useEffect(() => {
    const supportMeshes = collectReefSupportMeshes(scene);
    const terrainSupportMeshes = collectReefTerrainSupportMeshes(supportMeshes);
    const archSupportMeshes = collectReefArchSupportMeshes(supportMeshes);
    const candidates = [
      ...buildReefSurfaceSlotCandidates({
        foundationRadius: build.structures.visibleFoundationRadius,
        seed: build.species.moduleEvolution.identitySeed,
      }),
      ...collectReefSupportSlotCandidates(terrainSupportMeshes),
    ];
    const allocation = allocateReefSurfaceSlots({
      requests: plan.requests,
      candidates,
      sample: (x, z) => {
        const hit = raycastReefCoralTerrainSupport(
          terrainSupportMeshes,
          archSupportMeshes,
          x,
          z,
        );
        return hit
          ? { x: hit.point.x, y: hit.point.y, z: hit.point.z }
          : null;
      },
    });
    const next = buildReefMorphologyFamiliesGeometry({
      plan,
      slots: allocation.slots,
    });
    next.userData.reefSurfaceSlotDiagnostics = allocation.diagnostics;
    next.userData.reefCanopyLayout = REEF_CANOPY_LAYOUT;

    geometry.dispose();
    geometry.copy(next);
    next.dispose();
    invalidate();
  }, [
    build.species.moduleEvolution.identitySeed,
    build.structures.visibleFoundationRadius,
    geometry,
    invalidate,
    plan,
    scene,
  ]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return (
    <mesh
      name={`reef-density-${REEF_MORPHOLOGY_FAMILIES_PASS}`}
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      userData={{
        reefMorphologyFamiliesVersion: REEF_MORPHOLOGY_FAMILIES_VERSION,
        reefMorphologyFamiliesPass: REEF_MORPHOLOGY_FAMILIES_PASS,
        reefCanopyLayout: REEF_CANOPY_LAYOUT,
      }}
    />
  );
}

export function ReefDensityLayer({ build }: { build: ReefPreviewBuild }) {
  return (
    <group name="reef-density-morphology-habitats">
      <DensityCorals build={build} />
    </group>
  );
}
