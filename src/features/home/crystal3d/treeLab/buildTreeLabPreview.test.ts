import { describe, expect, it } from 'vitest';
import { createThreeOrganicSweepGeometry } from '@/engine/renderer/three';
import { TREE_LAB_MOBILE_BUDGET } from './acceptance';
import { buildTreeLabPreview } from './buildTreeLabPreview';

describe('Tree Lab preview pipeline', () => {
  it('keeps deterministic geometry across repeated builds', () => {
    const first = buildTreeLabPreview('medium');
    const second = buildTreeLabPreview('medium');

    expect(second.seed).toBe(first.seed);
    expect(second.skeleton).toEqual(first.skeleton);
    expect(second.frames).toEqual(first.frames);
    expect(second.mesh).toEqual(first.mesh);
  });

  it('keeps the medium mobile topology inside the published limits', () => {
    const build = buildTreeLabPreview('medium');

    expect(build.mesh.diagnostics.vertexCount).toBeLessThanOrEqual(
      TREE_LAB_MOBILE_BUDGET.maxVertices,
    );
    expect(build.mesh.diagnostics.triangleCount).toBeLessThanOrEqual(
      TREE_LAB_MOBILE_BUDGET.maxTriangles,
    );
    expect(build.mesh.diagnostics.junctionCount).toBe(build.frames.diagnostics.junctionCount);
  });

  it('adapts the pure mesh to one indexed Three.js geometry', () => {
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
