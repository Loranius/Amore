import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefColonyMorphotype } from '@/engine/species/reef';
import type { ReefPreviewBuild } from './buildReefPreview';
import { buildReefLivingCanopyPlan } from './reefLivingCanopy';
import {
  applyReefColonyCompetition,
  REEF_COLONY_COMPETITION_PASS,
  REEF_COLONY_COMPETITION_VERSION,
} from './reefColonyCompetition';
import {
  buildReefColonyNucleationPlan,
  createReefColonyNucleationScorer,
  REEF_COLONY_NUCLEATION_PASS,
  REEF_COLONY_NUCLEATION_VERSION,
} from './reefColonyNucleation';
import {
  buildReefMorphologyFamiliesGeometry,
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

const REEF_CANOPY_LAYOUT = 'ecological-competition-and-growth-v1';

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
  const nucleationPlan = useMemo(() => buildReefColonyNucleationPlan({
    plan: basePlan,
    foundationRadius: build.structures.visibleFoundationRadius,
    seed: build.species.moduleEvolution.identitySeed,
  }), [
    basePlan,
    build.species.moduleEvolution.identitySeed,
    build.structures.visibleFoundationRadius,
  ]);
  const candidateScorer = useMemo(() => createReefColonyNucleationScorer({
    plan: nucleationPlan,
    foundationRadius: build.structures.visibleFoundationRadius,
    seed: build.species.moduleEvolution.identitySeed,
  }), [
    build.species.moduleEvolution.identitySeed,
    build.structures.visibleFoundationRadius,
    nucleationPlan,
  ]);
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
    const worldNormal = new THREE.Vector3();
    const allocation = allocateReefSurfaceSlots({
      requests: nucleationPlan.requests,
      candidates,
      candidateScorer,
      sample: (x, z) => {
        const hit = raycastReefCoralTerrainSupport(
          terrainSupportMeshes,
          archSupportMeshes,
          x,
          z,
        );
        if (!hit) return null;
        const normalY = hit.face
          ? worldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).y
          : 1;
        return {
          x: hit.point.x,
          y: hit.point.y,
          z: hit.point.z,
          normalY,
        };
      },
    });
    const competition = applyReefColonyCompetition({
      plan: nucleationPlan,
      slots: allocation.slots,
    });
    const next = buildReefMorphologyFamiliesGeometry({
      plan: competition.plan,
      slots: allocation.slots,
    });
    next.userData.reefSurfaceSlotDiagnostics = allocation.diagnostics;
    next.userData.reefCanopyLayout = REEF_CANOPY_LAYOUT;
    next.userData.reefColonyNucleationVersion = REEF_COLONY_NUCLEATION_VERSION;
    next.userData.reefColonyNucleationPass = REEF_COLONY_NUCLEATION_PASS;
    next.userData.reefColonyCompetitionVersion = REEF_COLONY_COMPETITION_VERSION;
    next.userData.reefColonyCompetitionPass = REEF_COLONY_COMPETITION_PASS;
    next.userData.reefColonyCompetitionDiagnostics = competition.diagnostics;

    geometry.dispose();
    geometry.copy(next);
    next.dispose();
    invalidate();
  }, [
    build.species.moduleEvolution.identitySeed,
    build.structures.visibleFoundationRadius,
    candidateScorer,
    geometry,
    invalidate,
    nucleationPlan,
    scene,
  ]);

  useEffect(() => () => {
    geometry.dispose();
    material.dispose();
  }, [geometry, material]);

  return (
    <mesh
      name={`reef-density-${REEF_MORPHOLOGY_FAMILIES_PASS}-${REEF_COLONY_COMPETITION_PASS}`}
      geometry={geometry}
      material={material}
      castShadow={false}
      receiveShadow={false}
      frustumCulled={false}
      userData={{
        reefMorphologyFamiliesVersion: REEF_MORPHOLOGY_FAMILIES_VERSION,
        reefMorphologyFamiliesPass: REEF_MORPHOLOGY_FAMILIES_PASS,
        reefColonyNucleationVersion: REEF_COLONY_NUCLEATION_VERSION,
        reefColonyNucleationPass: REEF_COLONY_NUCLEATION_PASS,
        reefColonyCompetitionVersion: REEF_COLONY_COMPETITION_VERSION,
        reefColonyCompetitionPass: REEF_COLONY_COMPETITION_PASS,
        reefCanopyLayout: REEF_CANOPY_LAYOUT,
      }}
    />
  );
}

export function ReefDensityLayer({ build }: { build: ReefPreviewBuild }) {
  return (
    <group name="reef-density-competition-and-growth">
      <DensityCorals build={build} />
    </group>
  );
}
