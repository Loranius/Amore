import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import {
  buildReefLivingCanopyPlan,
  REEF_LIVING_CANOPY_PASS,
  REEF_LIVING_CANOPY_VERSION,
  type ReefLivingCanopyPlan,
} from './reefLivingCanopy';
import {
  buildReefColonyHabitatPlan,
  REEF_COLONY_HABITAT_VERSION,
} from './reefColonyHabitats';
import {
  buildReefColonyMaturityPlan,
  REEF_COLONY_MATURITY_VERSION,
} from './reefColonyMaturity';
import {
  buildReefSurfaceBoundLivingCanopyGeometry,
  hasReefCoralTerrainFootprintSupport,
  naturalizeReefLivingCanopyPlan,
  REEF_CORAL_NATURAL_PLACEMENT_VERSION,
  REEF_CORAL_SURFACE_BINDING_VERSION,
} from './reefCoralNaturalPlacement';
import {
  assessReefCoralSupportHit,
  chooseReefCoralPreferredSurface,
  classifyReefCoralSurface,
  reefCoralMorphotypeCanColonizeSurface,
  reefCoralSurfaceColonizationPolicy,
  REEF_CORAL_SURFACE_COLONIZATION_VERSION,
  type ReefCoralSurfaceType,
} from './reefCoralSurfaceRules';
import {
  collectReefArchSupportMeshes,
  collectReefSupportMeshes,
  collectReefSupportSlotCandidates,
  raycastReefCoralTerrainSupport,
  raycastReefSupport,
} from './reefSupportPlacement';
import {
  allocateReefSurfaceSlots,
  buildReefSurfaceSlotCandidates,
  type ReefSurfaceSlotCandidate,
  type ReefSurfaceSlotRequest,
} from './reefSurfaceSlots';

export interface ReefDensityCandidateCounts {
  sourceColonies: number;
  drawCalls: 0 | 1;
  morphotypeCounts: Record<ReefColonyMorphotype, number>;
}

const SURFACE_TYPES: readonly ReefCoralSurfaceType[] = [
  'terrace',
  'volcano',
  'arch',
  'rock',
  'unknown',
];

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

function emptySurfaceMeshMap(): Record<ReefCoralSurfaceType, THREE.Mesh[]> {
  return {
    terrace: [],
    volcano: [],
    arch: [],
    rock: [],
    unknown: [],
  };
}

function emptySurfaceCounts(): Record<ReefCoralSurfaceType, number> {
  return {
    terrace: 0,
    volcano: 0,
    arch: 0,
    rock: 0,
    unknown: 0,
  };
}

function volcanoRegistryCandidates(
  volcanoMeshes: readonly THREE.Mesh[],
  identitySeed: number,
): ReefSurfaceSlotCandidate[] {
  const candidates: ReefSurfaceSlotCandidate[] = [];
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();

  volcanoMeshes.forEach((mesh, meshIndex) => {
    const positions = mesh.geometry.getAttribute('position');
    if (!positions) return;
    let maxRadius = 0;
    for (let index = 0; index < positions.count; index += 1) {
      maxRadius = Math.max(maxRadius, Math.hypot(positions.getX(index), positions.getZ(index)));
    }
    if (maxRadius <= 1e-5) return;

    const phase = stableUnit(identitySeed, `reef:volcano-habitat:${meshIndex}:phase`) * Math.PI * 2;
    [0.42, 0.56, 0.7].forEach((radialRatio, ringIndex) => {
      const pointCount = 12;
      for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
        const angle = phase + pointIndex / pointCount * Math.PI * 2;
        local.set(
          Math.cos(angle) * maxRadius * radialRatio,
          0,
          Math.sin(angle) * maxRadius * radialRatio,
        );
        world.copy(local);
        mesh.localToWorld(world);
        candidates.push({
          id: `reef:volcano-habitat:${meshIndex}:ring:${ringIndex}:point:${pointIndex}`,
          x: world.x,
          z: world.z,
        });
      }
    });
  });

  return candidates;
}

function retargetPlanToPreferredSurfaces({
  plan,
  availableSurfaceTypes,
  candidatesBySurface,
}: {
  plan: ReefLivingCanopyPlan;
  availableSurfaceTypes: readonly ReefCoralSurfaceType[];
  candidatesBySurface: Readonly<Record<ReefCoralSurfaceType, readonly ReefSurfaceSlotCandidate[]>>;
}): {
  plan: ReefLivingCanopyPlan;
  preferredSurfaceByRequestId: Map<string, ReefCoralSurfaceType>;
} {
  const preferredSurfaceByRequestId = new Map<string, ReefCoralSurfaceType>();
  const colonies = plan.colonies.map((colony) => {
    const preferredSurface = chooseReefCoralPreferredSurface({
      seed: colony.seed,
      morphotype: colony.morphotype,
      availableSurfaceTypes,
    }) ?? 'terrace';
    preferredSurfaceByRequestId.set(colony.request.id, preferredSurface);

    const authored = candidatesBySurface[preferredSurface];
    if (authored.length === 0 || preferredSurface === 'terrace') return colony;
    const targetIndex = Math.min(
      authored.length - 1,
      Math.floor(stableUnit(colony.seed, `reef:surface-target:${preferredSurface}`) * authored.length),
    );
    const target = authored[targetIndex];
    if (!target) return colony;

    const preferred = target.position
      ? { ...target.position }
      : {
          x: target.x,
          y: colony.request.preferred.y,
          z: target.z,
        };
    return {
      ...colony,
      request: {
        ...colony.request,
        preferred,
      },
    };
  });

  return {
    plan: {
      ...plan,
      colonies,
      requests: colonies.map((colony) => colony.request),
    },
    preferredSurfaceByRequestId,
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
  const habitatPlan = useMemo(
    () => buildReefColonyHabitatPlan(basePlan, build),
    [basePlan, build],
  );
  const maturityPlan = useMemo(
    () => buildReefColonyMaturityPlan(habitatPlan, build),
    [habitatPlan, build],
  );
  const plan = useMemo(
    () => naturalizeReefLivingCanopyPlan(maturityPlan.plan),
    [maturityPlan.plan],
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
    const surfaceMeshes = emptySurfaceMeshMap();
    supportMeshes.forEach((mesh) => {
      surfaceMeshes[classifyReefCoralSurface(mesh)].push(mesh);
    });
    const availableSurfaceTypes = SURFACE_TYPES.filter(
      (surfaceType) => surfaceMeshes[surfaceType].length > 0,
    );
    const archMeshes = collectReefArchSupportMeshes(supportMeshes);

    const candidatesBySurface: Record<ReefCoralSurfaceType, ReefSurfaceSlotCandidate[]> = {
      terrace: [],
      volcano: [],
      arch: [],
      rock: [],
      unknown: [],
    };
    for (const surfaceType of SURFACE_TYPES) {
      candidatesBySurface[surfaceType] = collectReefSupportSlotCandidates(
        surfaceMeshes[surfaceType],
      );
    }
    candidatesBySurface.volcano.push(...volcanoRegistryCandidates(
      surfaceMeshes.volcano,
      build.species.moduleEvolution.identitySeed,
    ));

    const retargeted = retargetPlanToPreferredSurfaces({
      plan,
      availableSurfaceTypes,
      candidatesBySurface,
    });
    const ecologicalPlan = retargeted.plan;
    const colonyByRequestId = new Map(
      ecologicalPlan.colonies.map((colony) => [colony.request.id, colony] as const),
    );

    const candidates = [
      ...buildReefSurfaceSlotCandidates({
        foundationRadius: build.structures.visibleFoundationRadius,
        seed: build.species.moduleEvolution.identitySeed,
      }),
      ...SURFACE_TYPES.flatMap((surfaceType) => candidatesBySurface[surfaceType]),
    ];

    const hitForRequest = (
      request: ReefSurfaceSlotRequest,
      x: number,
      z: number,
    ): THREE.Intersection | null => {
      const colony = colonyByRequestId.get(request.id);
      if (!colony) return null;
      const preferredSurface = retargeted.preferredSurfaceByRequestId.get(request.id);
      const orderedSurfaceTypes = [
        ...(preferredSurface ? [preferredSurface] : []),
        ...availableSurfaceTypes.filter((surfaceType) => surfaceType !== preferredSurface),
      ];

      for (const surfaceType of orderedSurfaceTypes) {
        if (!reefCoralMorphotypeCanColonizeSurface(colony.morphotype, surfaceType)) continue;
        const meshes = surfaceMeshes[surfaceType];
        if (meshes.length === 0) continue;
        const policy = reefCoralSurfaceColonizationPolicy(surfaceType);
        const hit = surfaceType === 'arch'
          ? raycastReefSupport(meshes, x, z, policy.minNormalY)
          : raycastReefCoralTerrainSupport(
              meshes,
              archMeshes,
              x,
              z,
              policy.minNormalY,
            );
        if (!hit || !assessReefCoralSupportHit(hit).allowed) continue;

        const footprintSupported = hasReefCoralTerrainFootprintSupport({
          x: hit.point.x,
          z: hit.point.z,
          centerY: hit.point.y,
          sample: (sampleX, sampleZ) => {
            const neighbor = surfaceType === 'arch'
              ? raycastReefSupport(meshes, sampleX, sampleZ, policy.minNormalY)
              : raycastReefCoralTerrainSupport(
                  meshes,
                  archMeshes,
                  sampleX,
                  sampleZ,
                  policy.minNormalY,
                );
            if (!neighbor) return null;
            if (Math.abs(neighbor.point.y - hit.point.y) > policy.maxHeightDelta) return null;
            return { y: neighbor.point.y };
          },
        });
        if (!footprintSupported) continue;
        return hit;
      }

      return null;
    };

    const allocation = allocateReefSurfaceSlots({
      requests: ecologicalPlan.requests,
      candidates,
      sample: (x, z) => {
        const hit = raycastReefSupport(supportMeshes, x, z, 0.24);
        return hit ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null;
      },
      sampleForRequest: (request, x, z) => {
        const hit = hitForRequest(request, x, z);
        return hit ? { x: hit.point.x, y: hit.point.y, z: hit.point.z } : null;
      },
    });

    const surfaceNormalByRequestId = new Map<string, { x: number; y: number; z: number }>();
    const actualSurfaceByRequestId = new Map<string, ReefCoralSurfaceType>();
    for (const slot of allocation.slots) {
      const request = ecologicalPlan.requests.find((candidate) => candidate.id === slot.requestId);
      if (!request) continue;
      const hit = hitForRequest(request, slot.position.x, slot.position.z);
      if (!hit?.face || !(hit.object instanceof THREE.Mesh)) continue;
      const normal = hit.face.normal.clone()
        .transformDirection(hit.object.matrixWorld)
        .normalize();
      if (normal.y < 0) normal.negate();
      surfaceNormalByRequestId.set(slot.requestId, {
        x: normal.x,
        y: normal.y,
        z: normal.z,
      });
      actualSurfaceByRequestId.set(slot.requestId, classifyReefCoralSurface(hit.object));
    }

    const next = buildReefSurfaceBoundLivingCanopyGeometry({
      plan: ecologicalPlan,
      slots: allocation.slots,
      surfaceNormalByRequestId,
    });
    const surfaceCounts = emptySurfaceCounts();
    actualSurfaceByRequestId.forEach((surfaceType) => {
      surfaceCounts[surfaceType] += 1;
    });
    next.userData.reefSurfaceSlotDiagnostics = allocation.diagnostics;
    next.userData.reefCanopyLayout = REEF_COLONY_HABITAT_VERSION;
    next.userData.reefCoralNaturalPlacementVersion = REEF_CORAL_NATURAL_PLACEMENT_VERSION;
    next.userData.reefCoralSurfaceBindingVersion = REEF_CORAL_SURFACE_BINDING_VERSION;
    next.userData.reefCoralSurfaceColonizationVersion = REEF_CORAL_SURFACE_COLONIZATION_VERSION;
    next.userData.reefColonyMaturityVersion = REEF_COLONY_MATURITY_VERSION;
    next.userData.reefColonyMaturityStageCounts = maturityPlan.stageCounts;
    next.userData.reefColonyMaturityStates = maturityPlan.states;
    next.userData.reefCoralSurfaceDistribution = surfaceCounts;
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
    maturityPlan,
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
        reefCoralSurfaceColonizationVersion: REEF_CORAL_SURFACE_COLONIZATION_VERSION,
        reefColonyMaturityVersion: REEF_COLONY_MATURITY_VERSION,
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
