import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
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
    expect(branch.getAttribute('barkMask').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(root.getAttribute('color').count).toBe(build.rootGeometry.diagnostics.vertexCount);
    expect(root.getAttribute('barkCharacter').count).toBe(build.rootGeometry.diagnostics.vertexCount);
    expect(root.getAttribute('barkMask').count).toBe(build.rootGeometry.diagnostics.vertexCount);
    expect(branch.getAttribute('barkMask').getX(0)).toBe(1);
    expect(root.getAttribute('barkMask').getX(0)).toBe(1);
    expect(root.getAttribute('barkMask').getX(
      build.soilSurface.diagnostics.terrainVertexOffset,
    )).toBe(0);
    expect(branch.userData['treeBarkSurface']).toMatchObject({
      id: 'tree:bark:surface-character',
      tintAttributeId: 'tree:bark:vertex-tint',
      roughnessAttributeId: 'tree:bark:roughness-character',
      barkMaskAttributeId: 'tree:bark:surface-mask',
    });
    expect(root.userData['treeBarkSurface']).toMatchObject({
      id: 'tree:bark:surface-character',
      soilTerrainTintPreserved: true,
      maskedTerrainVertices: build.barkSurface.diagnostics.preservedTerrainVertexCount,
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
      grainVersion: 'tree-bark-grain-v1',
      textureSource: 'procedural-shader',
      terrainMasked: true,
    });
    expect(pair.bark.customProgramCacheKey()).toContain(build.barkSurface.signature);
    expect(pair.foliage.userData['treeBarkSurface']).toBeUndefined();
    expect(pair.foliage.userData['treeFoliageSurface']).toMatchObject({
      version: 'tree-foliage-surface-v1',
      extraDrawCalls: 0,
      extraMaterials: 0,
    });
    expect(pair.foliage.vertexColors).toBe(false);

    pair.bark.dispose();
    pair.foliage.dispose();
  });

  it('injects bark grain and leaf surface detail into the standard shader stages', () => {
    const build = buildTreeLabPreview('medium');
    const pair = createThreeTreeMaterialPair(build.materials, build.barkSurface);
    const barkShader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: [
        '#include <common>',
        '#include <color_fragment>',
        '#include <roughnessmap_fragment>',
        '#include <normal_fragment_maps>',
      ].join('\n'),
    } as unknown as THREE.WebGLProgramParametersWithUniforms;
    const foliageShader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <begin_vertex>',
      fragmentShader: '#include <common>\n#include <color_fragment>',
    } as unknown as THREE.WebGLProgramParametersWithUniforms;

    pair.bark.onBeforeCompile(barkShader, {} as THREE.WebGLRenderer);
    pair.foliage.onBeforeCompile(foliageShader, {} as THREE.WebGLRenderer);

    expect(barkShader.vertexShader).toContain('attribute float barkMask;');
    expect(barkShader.fragmentShader).toContain('treeBarkWave');
    expect(barkShader.fragmentShader).toContain('treePerturbBarkNormal');
    expect(barkShader.fragmentShader).toContain('roughnessFactor = clamp');
    expect(foliageShader.vertexShader).toContain('varying vec2 vTreeLeafUv;');
    expect(foliageShader.fragmentShader).toContain('treeLeafMidrib');
    expect(foliageShader.fragmentShader).toContain('treeLeafVeins');

    pair.bark.dispose();
    pair.foliage.dispose();
  });
});
