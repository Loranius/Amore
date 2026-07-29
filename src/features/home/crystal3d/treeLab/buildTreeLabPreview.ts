import type { ArtifactBlueprint } from '@/engine/evolution';
import {
  buildOrganicCurveFrames,
  buildOrganicSkeleton,
  buildOrganicSweepMesh,
  type OrganicCurveFrameState,
  type OrganicMeshLod,
  type OrganicSkeletonState,
  type OrganicSweepMesh,
} from '@/engine/labs/organic';
import {
  buildTreeSpeciesBlueprint,
  treeToOrganicField,
  type TreeOrganicField,
  type TreeSpeciesBlueprint,
} from '@/engine/species/tree';
import {
  buildTreeSpeciesPreviewArtifact,
  TREE_SPECIES_PREVIEW_AS_OF,
} from './treeSpeciesFixture';

export interface TreeLabPreviewBuild {
  seed: number;
  lod: OrganicMeshLod;
  artifact: ArtifactBlueprint;
  species: TreeSpeciesBlueprint;
  field: TreeOrganicField;
  skeleton: OrganicSkeletonState;
  frames: OrganicCurveFrameState;
  mesh: OrganicSweepMesh;
  buildMs: number;
}

function now(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now();
}

/**
 * End-to-end laboratory path:
 * Evolution fixture -> Tree Species -> Organic Growth -> Geometry.
 */
export function buildTreeLabPreview(lod: OrganicMeshLod): TreeLabPreviewBuild {
  const startedAt = now();
  const artifact = buildTreeSpeciesPreviewArtifact();
  const species = buildTreeSpeciesBlueprint({
    artifact,
    config: {
      asOf: TREE_SPECIES_PREVIEW_AS_OF,
      rulesVersion: 'tree-species-preview-v1.0.0',
    },
  });
  const field = treeToOrganicField(species);
  const skeleton = buildOrganicSkeleton({
    seed: field.seed,
    attractors: field.attractors,
    config: field.skeletonConfig,
  });
  const frames = buildOrganicCurveFrames(skeleton);
  const mesh = buildOrganicSweepMesh(frames, lod);

  return {
    seed: field.seed,
    lod,
    artifact,
    species,
    field,
    skeleton,
    frames,
    mesh,
    buildMs: now() - startedAt,
  };
}
