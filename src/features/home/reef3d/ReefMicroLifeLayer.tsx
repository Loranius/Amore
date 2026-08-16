import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { ReefPreviewBuild } from './buildReefPreview';
import { assessReefCoralSupportHit } from './reefCoralSurfaceRules';
import { collectReefSupportMeshes, raycastReefSupport } from './reefSupportPlacement';
import { buildReefMicroLifePlan, REEF_MICRO_LIFE_VERSION } from './reefMicroLife';

const UP = new THREE.Vector3(0, 1, 0);
const CREVICE_SAMPLE_OFFSETS = [
  [0.12, 0],
  [-0.12, 0],
  [0, 0.12],
  [0, -0.12],
] as const;

const ENCRUSTING_COLORS = ['#b56e78', '#c48373', '#9d718b', '#bb8a69', '#8f7b91'] as const;
const SPONGE_COLORS = ['#bd7652', '#d39a64', '#b86d62', '#cc8f68'] as const;
const CREVICE_COLORS = ['#8f789e', '#a77b92', '#8a809e', '#b17f86'] as const;

interface BoundMicroLife {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  scaleJitter: number;
  rotation: number;
  creviceScore: number;
  colorIndex: number;
}

interface AcceptedPoint {
  x: number;
  y: number;
  z: number;
}

function collectDensityMeshes(scene: THREE.Scene): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh) || !object.visible) return;
    if (!object.name.startsWith('reef-density-')) return;
    meshes.push(object);
  });
  return meshes;
}

function worldNormal(hit: THREE.Intersection): THREE.Vector3 | null {
  if (!hit.face) return null;
  return hit.face.normal.clone().transformDirection(hit.object.matrixWorld).normalize();
}

function clearsMainLayout(build: ReefPreviewBuild, point: THREE.Vector3): boolean {
  return build.layout.colonies.every((colony) => {
    const dx = point.x - colony.position.x;
    const dz = point.z - colony.position.z;
    const clearance = colony.footprintRadius * 0.68 + 0.12;
    return dx * dx + dz * dz >= clearance * clearance;
  });
}

function clearsRenderedCanopy(
  densityMeshes: readonly THREE.Mesh[],
  raycaster: THREE.Raycaster,
  origin: THREE.Vector3,
  point: THREE.Vector3,
): boolean {
  if (densityMeshes.length === 0) return true;
  origin.set(point.x, point.y + 0.018, point.z);
  raycaster.set(origin, UP);
  raycaster.near = 0;
  raycaster.far = 0.72;
  return raycaster.intersectObjects(densityMeshes as THREE.Mesh[], false).length === 0;
}

function isFarEnough(
  accepted: readonly AcceptedPoint[],
  point: THREE.Vector3,
  minimumSpacing: number,
): boolean {
  const minimumSpacingSq = minimumSpacing * minimumSpacing;
  return accepted.every((other) => {
    const dx = point.x - other.x;
    const dz = point.z - other.z;
    return dx * dx + dz * dz >= minimumSpacingSq;
  });
}

function localCreviceScore(
  supportMeshes: readonly THREE.Mesh[],
  center: THREE.Vector3,
): number {
  let maximumDelta = 0;
  let missing = 0;
  for (const [offsetX, offsetZ] of CREVICE_SAMPLE_OFFSETS) {
    const neighbor = raycastReefSupport(
      supportMeshes,
      center.x + offsetX,
      center.z + offsetZ,
      0.05,
    );
    if (!neighbor) {
      missing += 1;
      continue;
    }
    maximumDelta = Math.max(maximumDelta, Math.abs(neighbor.point.y - center.y));
  }
  return Math.min(1, maximumDelta * 1.9 + missing * 0.08);
}

function bindCandidate({
  build,
  supportMeshes,
  densityMeshes,
  raycaster,
  origin,
  accepted,
  x,
  z,
  scaleJitter,
  rotation,
  creviceBias,
  spacing,
  requireCrevice,
  requireUpright,
  colorIndex,
}: {
  build: ReefPreviewBuild;
  supportMeshes: readonly THREE.Mesh[];
  densityMeshes: readonly THREE.Mesh[];
  raycaster: THREE.Raycaster;
  origin: THREE.Vector3;
  accepted: readonly AcceptedPoint[];
  x: number;
  z: number;
  scaleJitter: number;
  rotation: number;
  creviceBias: number;
  spacing: number;
  requireCrevice: boolean;
  requireUpright: boolean;
  colorIndex: number;
}): BoundMicroLife | null {
  const hit = raycastReefSupport(supportMeshes, x, z, 0.12);
  if (!hit || !assessReefCoralSupportHit(hit).allowed) return null;
  const normal = worldNormal(hit);
  if (!normal) return null;
  if (requireUpright && normal.y < 0.42) return null;
  if (!requireUpright && normal.y < 0.2) return null;

  const point = hit.point.clone();
  if (!clearsMainLayout(build, point)) return null;
  if (!clearsRenderedCanopy(densityMeshes, raycaster, origin, point)) return null;
  if (!isFarEnough(accepted, point, spacing)) return null;

  const creviceScore = localCreviceScore(supportMeshes, point);
  if (requireCrevice && creviceScore < 0.075 && creviceBias < 0.72) return null;

  return {
    point,
    normal,
    scaleJitter,
    rotation,
    creviceScore,
    colorIndex,
  };
}

function pushAccepted(accepted: AcceptedPoint[], placement: BoundMicroLife): void {
  accepted.push({
    x: placement.point.x,
    y: placement.point.y,
    z: placement.point.z,
  });
}

export function ReefMicroLifeLayer({ build }: { build: ReefPreviewBuild }) {
  const scene = useThree((state) => state.scene);
  const invalidate = useThree((state) => state.invalidate);
  const encrustingRef = useRef<THREE.InstancedMesh>(null);
  const verticalLifeRef = useRef<THREE.InstancedMesh>(null);
  const plan = useMemo(() => buildReefMicroLifePlan({
    identitySeed: build.species.moduleEvolution.identitySeed,
    foundationRadius: build.structures.visibleFoundationRadius,
    photoCount: build.species.moduleEvolution.colonies.microPhotoCorals.logicalCount,
    mediaCount: build.species.moduleEvolution.colonies.mediaCorals.logicalCount,
  }), [build]);
  const scratch = useMemo(() => ({
    raycaster: new THREE.Raycaster(),
    origin: new THREE.Vector3(),
    object: new THREE.Object3D(),
    surfaceQuaternion: new THREE.Quaternion(),
    color: new THREE.Color(),
  }), []);

  useEffect(() => {
    const encrustingMesh = encrustingRef.current;
    const verticalMesh = verticalLifeRef.current;
    if (!encrustingMesh || !verticalMesh) return;

    scene.updateMatrixWorld(true);
    const supportMeshes = collectReefSupportMeshes(scene);
    const densityMeshes = collectDensityMeshes(scene);
    const accepted: AcceptedPoint[] = [];
    const encrusting: BoundMicroLife[] = [];
    const sponges: BoundMicroLife[] = [];
    const creviceAccents: BoundMicroLife[] = [];

    const tryFill = (
      target: BoundMicroLife[],
      desired: number,
      startOffset: number,
      spacing: number,
      requireCrevice: boolean,
      requireUpright: boolean,
      colorCount: number,
    ) => {
      if (desired <= 0 || plan.candidates.length === 0) return;
      for (let step = 0; step < plan.candidates.length && target.length < desired; step += 1) {
        const candidate = plan.candidates[(step + startOffset) % plan.candidates.length];
        if (!candidate) continue;
        const placement = bindCandidate({
          build,
          supportMeshes,
          densityMeshes,
          raycaster: scratch.raycaster,
          origin: scratch.origin,
          accepted,
          x: candidate.x,
          z: candidate.z,
          scaleJitter: candidate.scaleJitter,
          rotation: candidate.rotation,
          creviceBias: candidate.creviceBias,
          spacing,
          requireCrevice,
          requireUpright,
          colorIndex: Math.floor(candidate.scaleJitter * colorCount) % colorCount,
        });
        if (!placement) continue;
        target.push(placement);
        pushAccepted(accepted, placement);
      }
    };

    // Broad, paper-thin patches go first. They visually break large sterile
    // rock planes while leaving most substrate visible around every colony.
    tryFill(
      encrusting,
      plan.desired.encrustingPatches,
      0,
      0.28,
      false,
      false,
      ENCRUSTING_COLORS.length,
    );
    // Sponges prefer stable upward-facing ledges and stay well separated.
    tryFill(
      sponges,
      plan.desired.sponges,
      Math.floor(plan.candidates.length * 0.31),
      0.42,
      false,
      true,
      SPONGE_COLORS.length,
    );
    // Final accents deliberately seek local relief changes / edge-like gaps.
    tryFill(
      creviceAccents,
      plan.desired.creviceAccents,
      Math.floor(plan.candidates.length * 0.63),
      0.24,
      true,
      false,
      CREVICE_COLORS.length,
    );

    encrustingMesh.count = encrusting.length;
    encrustingMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    encrusting.forEach((placement, index) => {
      const width = 0.13 + placement.scaleJitter * 0.13;
      const depth = width * (0.72 + placement.creviceScore * 0.22);
      scratch.object.position.copy(placement.point).addScaledVector(placement.normal, 0.012);
      scratch.surfaceQuaternion.setFromUnitVectors(UP, placement.normal);
      scratch.object.quaternion.copy(scratch.surfaceQuaternion);
      scratch.object.rotateY(placement.rotation);
      scratch.object.scale.set(width, 0.022 + placement.scaleJitter * 0.018, depth);
      scratch.object.updateMatrix();
      encrustingMesh.setMatrixAt(index, scratch.object.matrix);
      encrustingMesh.setColorAt(
        index,
        scratch.color.set(ENCRUSTING_COLORS[placement.colorIndex % ENCRUSTING_COLORS.length] ?? '#b56e78'),
      );
    });
    encrustingMesh.instanceMatrix.needsUpdate = true;
    if (encrustingMesh.instanceColor) encrustingMesh.instanceColor.needsUpdate = true;

    const verticalLife = [
      ...sponges.map((placement) => ({ placement, kind: 'sponge' as const })),
      ...creviceAccents.map((placement) => ({ placement, kind: 'accent' as const })),
    ];
    verticalMesh.count = verticalLife.length;
    verticalMesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    verticalLife.forEach(({ placement, kind }, index) => {
      const sponge = kind === 'sponge';
      const radius = sponge
        ? 0.055 + placement.scaleJitter * 0.055
        : 0.025 + placement.scaleJitter * 0.026;
      const height = sponge
        ? 0.12 + placement.scaleJitter * 0.18
        : 0.07 + placement.scaleJitter * 0.1;
      scratch.object.position.copy(placement.point).addScaledVector(placement.normal, height * 0.45 + 0.006);
      scratch.surfaceQuaternion.setFromUnitVectors(UP, placement.normal);
      scratch.object.quaternion.copy(scratch.surfaceQuaternion);
      scratch.object.rotateY(placement.rotation);
      scratch.object.scale.set(radius, height, radius * (sponge ? 1 : 0.72));
      scratch.object.updateMatrix();
      verticalMesh.setMatrixAt(index, scratch.object.matrix);
      const palette = sponge ? SPONGE_COLORS : CREVICE_COLORS;
      verticalMesh.setColorAt(
        index,
        scratch.color.set(palette[placement.colorIndex % palette.length] ?? '#a77b92'),
      );
    });
    verticalMesh.instanceMatrix.needsUpdate = true;
    if (verticalMesh.instanceColor) verticalMesh.instanceColor.needsUpdate = true;

    encrustingMesh.userData.reefMicroLifeAccepted = encrusting.length;
    verticalMesh.userData.reefMicroLifeSponges = sponges.length;
    verticalMesh.userData.reefMicroLifeCreviceAccents = creviceAccents.length;
    invalidate();
  }, [build, invalidate, plan, scene, scratch]);

  const verticalCapacity = plan.desired.sponges + plan.desired.creviceAccents;

  return (
    <group
      name="reef-micro-life-gap-pass"
      userData={{
        reefMicroLifeVersion: REEF_MICRO_LIFE_VERSION,
        reefMicroLifeDesired: plan.desired,
      }}
    >
      <instancedMesh
        ref={encrustingRef}
        args={[undefined, undefined, Math.max(1, plan.desired.encrustingPatches)]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 8, 4]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.94}
          metalness={0}
          emissive="#241b22"
          emissiveIntensity={0.035}
        />
      </instancedMesh>

      <instancedMesh
        ref={verticalLifeRef}
        args={[undefined, undefined, Math.max(1, verticalCapacity)]}
        castShadow={false}
        receiveShadow={false}
        frustumCulled={false}
      >
        <cylinderGeometry args={[0.72, 1, 1, 7, 1, true]} />
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.96}
          metalness={0}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
    </group>
  );
}
