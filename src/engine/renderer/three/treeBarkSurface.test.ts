import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { createThreeOrganicSweepGeometry } from './organicSweep';
import { createThreeTreeMaterialPair } from './treeMaterials';
import { createThreeTreeRootGeometry } from './treeRootGeometry';

describe('Three Tree Bark Surface adapters', () => {
  it('publishes tint and roughness-character attributes on branch and static geometry', () => {
    const build = buildTreeLabPreview('medium');
    const branch = createThreeOrganicSweepGeometry(build.mesh, build.barkSurface);
    const root = createThreeTreeRootGeometry(
      build.rootGeometry,
      build.soilSurface,
      build.barkSurface,
    );

    expect(branch.getAttribute('color').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(branch.getAttribute('barkCharacter').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(root.getAttribute('color').count).toBe(build.rootGeometry.diagnostics.vertexCount);
    expect(root.getAttribute('barkCharacter').count).toBe(build.rootGeometry.diagnostics.vertexCount);
    expect(branch.userData['treeBarkSurface']).toMatchObject({
      id: 'tree:bark:surface-character',
      tintAttributeId: 'tree:bark:vertex-tint',
      roughnessAttributeId: 'tree:bark:roughness-character',
    });
    expect(root.userData['treeBarkSurface']).toMatchObject({
      id: 'tree:bark:surface-character',
      soilTerrainTintPreserved: true,
    });
    expect(branch.userData['treeLab']).toMatchObject({ barkSurfaceApplied: true });
    expect(root.userData['treeRootGeometry']).toMatchObject({ barkSurfaceApplied: true });

    branch.dispose();
    root.dispose();
  });

  it('keeps two accepted tree materials and patches only the bark shader path', () => {
    const build = buildTreeLabPreview('medium');
    const pair = createThreeTreeMaterialPair(build.materials, build.barkSurface);

    expect(pair.bark.vertexColors).toBe(true);
    expect(pair.bark.userData['treeBarkSurface']).toMatchObject({
      id: 'tree:bark:surface-character',
      roughnessAttributeId: 'tree:bark:roughness-character',
    });
    expect(pair.bark.customProgramCacheKey()).toContain(build.barkSurface.signature);
    expect(pair.foliage.userData['treeBarkSurface']).toBeUndefined();
    expect(pair.foliage.vertexColors).toBe(false);

    pair.bark.dispose();
    pair.foliage.dispose();
  });
});
