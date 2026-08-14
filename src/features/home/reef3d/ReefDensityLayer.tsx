import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  buildReefLivingCanopyGeometry,
  buildReefLivingCanopyPlan,
  REEF_LIVING_CANOPY_PASS,
  REEF_LIVING_CANOPY_VERSION,
  type ReefLivingCanopyPlan,
} from './reefLivingCanopy';
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

function morphotypeHotspotIndex(morphotype: ReefColonyMorphotype): number {
  switch (morphotype) {
    case 'branching': return 0;
    case 'massive': return 1;
    case 'plating': return 2;
    case 'encrusting': return 3;
    case 'soft-coral': return 0;
    case 'sea-fan': return 2;
  }
}

function morphotypeHotspotStrength(morphotype: ReefColonyMorphotype): number {
  switch (morphotype) {
    case 'encrusting': return 0.8;
    case 'branching': return 0.74;
    case 'soft-coral': return 0.72;
    case 'sea-fan': return 0.68;
    case 'plating': return 0.63;
    case 'massive': return 0.56;
  }
}

/**
 * Visual-only ecological clustering. Logical colony identity/order is untouched;
 * only the preferred renderer anchor is biased toward four stable habitat
 * patches. Clearance/raycast allocation still decides the final valid surface.
 */
function buildHotspotPlan(
  plan: ReefLivingCanopyPlan,
  build: ReefPreviewBuild,
): ReefLivingCanopyPlan {
  const radius = build.structures.visibleFoundationRadius;
  const seed = build.species.moduleEvolution.identitySeed;
  const basePhase = stableUnit(seed, 'reef:canopy-hotspots:phase') * TAU;
  const radialRatios = [0.38, 0.56, 0.66, 0.48] as const;

  const colonies = plan.colonies.map((colony) => {
    const sequenceBand = Math.floor(colony.request.sequence / 9) % 2;
    const hotspotIndex = (
      morphotypeHotspotIndex(colony.morphotype) + sequenceBand
    ) % 4;
    const angle = basePhase
      + hotspotIndex / 4 * TAU
      + (stableUnit(colony.seed, 'reef:hotspot:angle') - 0.5) * 0.48;
    const localRadius = radius * radialRatios[hotspotIndex] * (
      0.9 + stableUnit(colony.seed, 'reef:hotspot:radius') * 0.2
    );
    const targetX = Math.cos(angle) * localRadius;
    const targetZ = Math.sin(angle) * localRadius;
    const strength = morphotypeHotspotStrength(colony.morphotype);
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
  const plan = useMemo(() => buildHotspotPlan(basePlan, build), [basePlan, build]);
  const geometry = useMemo(() => new THREE.BufferGeometry(), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    name: 'reef-living-canopy-shared-material',
    color: '#ffffff',
    vertexColors: true,
    roughness: 0.72,
    metalness: 0,
    emissive: '#281f30',
    emissiveIntensity: 0.075,
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
    const next = buildReefLivingCanopyGeometry({
      plan,
      slots: allocation.slots,
    });
    next.userData.reefSurfaceSlotDiagnostics = allocation.diagnostics;
    next.userData.reefCanopyLayout = 'stable-hotspots-v1';

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
      name={`reef-density-${REEF_LIVING_CANOPY_PASS}`}
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      userData={{
        reefLivingCanopyVersion: REEF_LIVING_CANOPY_VERSION,
        reefLivingCanopyPass: REEF_LIVING_CANOPY_PASS,
        reefCanopyLayout: 'stable-hotspots-v1',
      }}
    />
  );
}

export function ReefDensityLayer({ build }: { build: ReefPreviewBuild }) {
  return (
    <group name="reef-density-hotspot-growth">
      <DensityCorals build={build} />
    </group>
  );
}
