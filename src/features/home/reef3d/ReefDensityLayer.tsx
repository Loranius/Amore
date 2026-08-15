import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  buildReefLivingCanopyPlan,
  REEF_LIVING_CANOPY_PASS,
  REEF_LIVING_CANOPY_VERSION,
} from './reefLivingCanopy';
import {
  buildReefColonyHabitatPlan,
  REEF_COLONY_HABITAT_VERSION,
} from './reefColonyHabitats';
import {
  buildReefSurfaceBoundLivingCanopyGeometry,
  hasReefCoralTerrainFootprintSupport,
  naturalizeReefLivingCanopyPlan,
  REEF_CORAL_NATURAL_PLACEMENT_VERSION,
  REEF_CORAL_SURFACE_BINDING_VERSION,
} from './reefCoralNaturalPlacement';
import {
  collectReefArchSupportMeshes,
  collectReefSupportMeshes,
  collectReefSupportSlotCandidates,
  collectReefTerrainSupportMeshes,
  raycastReefCoralTerrainSupport,
  raycastReefSupport,
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
  const habitatPlan = useMemo(
    () => buildReefColonyHabitatPlan(basePlan, build),
    [basePlan, build],
  );
  const plan = useMemo(
    () => naturalizeReefLivingCanopyPlan(habitatPlan.plan),
    [habitatPlan.plan],
  );
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
    const sampleTerrain = (x: number, z: number) => {
      const hit = raycastReefSupport(terrainSupportMeshes, x, z, 0.74);
      return hit ? { y: hit.point.y } : null;
    };
    const authoredCandidates = collectReefSupportSlotCandidates(terrainSupportMeshes)
      .filter((candidate) => (
        !candidate.position
        || hasReefCoralTerrainFootprintSupport({
          x: candidate.position.x,
          z: candidate.position.z,
          centerY: candidate.position.y,
          sample: sampleTerrain,
        })
      ));
    const candidates = [
      ...buildReefSurfaceSlotCandidates({
        foundationRadius: build.structures.visibleFoundationRadius,
        seed: build.species.moduleEvolution.identitySeed,
      }),
      ...authoredCandidates,
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
        if (!hit) return null;
        if (!hasReefCoralTerrainFootprintSupport({
          x: hit.point.x,
          z: hit.point.z,
          centerY: hit.point.y,
          sample: sampleTerrain,
        })) return null;
        return { x: hit.point.x, y: hit.point.y, z: hit.point.z };
      },
    });

    const surfaceNormalByRequestId = new Map<string, { x: number; y: number; z: number }>();
    for (const slot of allocation.slots) {
      const hit = raycastReefSupport(
        terrainSupportMeshes,
        slot.position.x,
        slot.position.z,
        0.74,
      );
      if (!hit?.face) continue;
      const normal = hit.face.normal.clone()
        .transformDirection(hit.object.matrixWorld)
        .normalize();
      if (normal.y < 0) normal.negate();
      surfaceNormalByRequestId.set(slot.requestId, {
        x: normal.x,
        y: normal.y,
        z: normal.z,
      });
    }

    const next = buildReefSurfaceBoundLivingCanopyGeometry({
      plan,
      slots: allocation.slots,
      surfaceNormalByRequestId,
    });
    next.userData.reefSurfaceSlotDiagnostics = allocation.diagnostics;
    next.userData.reefCanopyLayout = REEF_COLONY_HABITAT_VERSION;
    next.userData.reefCoralNaturalPlacementVersion = REEF_CORAL_NATURAL_PLACEMENT_VERSION;
    next.userData.reefCoralSurfaceBindingVersion = REEF_CORAL_SURFACE_BINDING_VERSION;
    next.userData.reefColonyHabitatCount = habitatPlan.habitats.length;
    next.userData.reefColonyHabitatDominantMorphotypes = habitatPlan.habitats.map((habitat) => ({
      id: habitat.id,
      morphotype: habitat.dominantMorphotype,
      tier: habitat.tier,
      memberCount: habitat.memberColonyIds.length,
    }));

    geometry.dispose();
    geometry.copy(next);
    next.dispose();
    invalidate();
  }, [
    build.species.moduleEvolution.identitySeed,
    build.structures.visibleFoundationRadius,
    geometry,
    habitatPlan,
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
        reefCanopyLayout: REEF_COLONY_HABITAT_VERSION,
        reefCoralNaturalPlacementVersion: REEF_CORAL_NATURAL_PLACEMENT_VERSION,
        reefCoralSurfaceBindingVersion: REEF_CORAL_SURFACE_BINDING_VERSION,
      }}
    />
  );
}

export function ReefDensityLayer({ build }: { build: ReefPreviewBuild }) {
  return (
    <group name="reef-density-colony-habitat-growth">
      <DensityCorals build={build} />
    </group>
  );
}
