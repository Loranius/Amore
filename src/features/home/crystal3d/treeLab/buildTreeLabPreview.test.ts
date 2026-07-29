import { describe, expect, it } from 'vitest';
import { createThreeOrganicSweepGeometry } from '@/engine/renderer/three';
import { TREE_LAB_MOBILE_BUDGET } from './acceptance';
import {
  buildTreeLabPreview,
  buildTreeLabPreviewFromArtifact,
} from './buildTreeLabPreview';
import {
  buildTreeSpeciesPreviewArtifact,
  TREE_SPECIES_PREVIEW_AS_OF,
} from './treeSpeciesFixture';

function withoutBuildTime<T extends { buildMs: number }>(value: T): Omit<T, 'buildMs'> {
  const { buildMs: _buildMs, ...stable } = value;
  return stable;
}

describe('Tree Lab preview pipeline', () => {
  it('keeps the full Evolution -> Species -> Growth -> Composition -> Foliage -> Geometry -> Material -> Life result deterministic', () => {
    const first = buildTreeLabPreview('medium');
    const second = buildTreeLabPreview('medium');

    expect(withoutBuildTime(second)).toEqual(withoutBuildTime(first));
    expect(second.seed).toBe(first.seed);
  });

  it('preserves the fixed fixture as a wrapper around the generic artifact path', () => {
    const fixture = buildTreeLabPreview('medium');
    const generic = buildTreeLabPreviewFromArtifact({
      artifact: buildTreeSpeciesPreviewArtifact(),
      asOf: TREE_SPECIES_PREVIEW_AS_OF,
      lod: 'medium',
      rulesVersion: 'tree-species-preview-v1.0.0',
    });

    expect(withoutBuildTime(generic)).toEqual(withoutBuildTime(fixture));
  });

  it('uses Tree Species output instead of a free-standing random attractor field', () => {
    const build = buildTreeLabPreview('medium');

    expect(build.species.species).toBe('tree');
    expect(build.species.coupleId).toBe('amore:tree-species-preview');
    expect(build.species.state.stage).toBe('young');
    expect(build.species.diagnostics.annualInstructionCount).toBe(2);
    expect(build.species.diagnostics.eventInstructionCount).toBe(8);
    expect(build.field.diagnostics.attractorCount).toBe(15);
    expect(build.field.diagnostics.truncatedInstructionIds).toEqual([]);
    expect(build.skeleton.seed).toBe(build.field.seed);
    expect(build.skeleton.rulesVersion).toBe(build.field.skeletonConfig.rulesVersion);
  });

  it('keeps branch, instanced leaves and life updates inside published mobile limits', () => {
    const build = buildTreeLabPreview('medium');
    const totalVertices = build.mesh.diagnostics.vertexCount
      + build.leaves.diagnostics.sharedVertexCount;
    const totalTriangles = build.mesh.diagnostics.triangleCount
      + build.leaves.diagnostics.renderedTriangleCount;

    expect(totalVertices).toBeLessThanOrEqual(TREE_LAB_MOBILE_BUDGET.maxVertices);
    expect(totalTriangles).toBeLessThanOrEqual(TREE_LAB_MOBILE_BUDGET.maxTriangles);
    expect(build.leaves.diagnostics.estimatedDrawCalls + 1).toBeLessThanOrEqual(
      TREE_LAB_MOBILE_BUDGET.maxDrawCalls,
    );
    expect(build.life.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(build.life.diagnostics.estimatedMatrixUpdatesPerFrame).toBe(
      build.life.leaves.length,
    );
    expect(build.life.leaves.length).toBeLessThanOrEqual(build.leaves.instances.length);
    expect(build.mesh.diagnostics.junctionCount).toBe(build.frames.diagnostics.junctionCount);
  });

  it('adapts the pure branch mesh to one indexed Three.js geometry', () => {
    const build = buildTreeLabPreview('low');
    const geometry = createThreeOrganicSweepGeometry(build.mesh);

    expect(geometry.getAttribute('position').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('normal').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('uv').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getIndex()?.count).toBe(build.mesh.indices.length);
    expect(geometry.userData['treeLab']).toMatchObject({
      lod: 'low',
      branches: build.mesh.diagnostics.branchCount,
      junctions: build.mesh.diagnostics.junctionCount,
    });

    geometry.dispose();
  });
});
