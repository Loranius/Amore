import {
  DEFAULT_ORGANIC_SKELETON_CONFIG,
  buildOrganicCurveFrames,
  buildOrganicSkeleton,
  buildOrganicSweepMesh,
  generateEllipsoidAttractors,
  type OrganicCurveFrameState,
  type OrganicMeshLod,
  type OrganicSkeletonState,
  type OrganicSweepMesh,
} from '@/engine/labs/organic';

export interface TreeLabPreviewBuild {
  seed: number;
  lod: OrganicMeshLod;
  skeleton: OrganicSkeletonState;
  frames: OrganicCurveFrameState;
  mesh: OrganicSweepMesh;
  buildMs: number;
}

const TREE_LAB_SEED = 41_992;

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

export function buildTreeLabPreview(lod: OrganicMeshLod): TreeLabPreviewBuild {
  const startedAt = now();
  const attractors = generateEllipsoidAttractors({
    seed: TREE_LAB_SEED,
    count: 18,
    center: { x: 0, y: 3.45, z: 0 },
    horizontalRadius: 1.72,
    verticalRadius: 1.18,
  });
  const skeleton = buildOrganicSkeleton({
    seed: TREE_LAB_SEED,
    attractors,
    config: DEFAULT_ORGANIC_SKELETON_CONFIG,
  });
  const frames = buildOrganicCurveFrames(skeleton);
  const mesh = buildOrganicSweepMesh(frames, lod);

  return {
    seed: TREE_LAB_SEED,
    lod,
    skeleton,
    frames,
    mesh,
    buildMs: now() - startedAt,
  };
}
