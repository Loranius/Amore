import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_BARK_SURFACE_CONFIG } from './config';
import { buildTreeBarkSurface } from './treeBarkSurface';

function rebuild(lod: 'high' | 'medium' | 'low' = 'medium') {
  const build = buildTreeLabPreview(lod);
  return {
    build,
    bark: buildTreeBarkSurface({
      species: build.species,
      frames: build.frames,
      mesh: build.mesh,
      rootGeometry: build.rootGeometry,
      soil: build.soilSurface,
      materials: build.materials,
      config: DEFAULT_TREE_BARK_SURFACE_CONFIG,
    }),
  };
}

describe('Tree Bark Surface', () => {
  it('publishes deterministic branch and static surface-character attributes', () => {
    const first = rebuild().bark;
    const second = rebuild().bark;

    expect(second).toEqual(first);
    expect(first.descriptor).toEqual({
      id: 'tree:bark:surface-character',
      tintAttributeId: 'tree:bark:vertex-tint',
      roughnessAttributeId: 'tree:bark:roughness-character',
      branchGeometryId: 'tree:bark:branch-sweep',
      staticGeometryId: 'tree:bark:root-collar-sweep',
      materialRole: 'bark',
    });
    expect(first.signature.length).toBeGreaterThan(0);
  });

  it('covers every accepted vertex without changing mesh budgets', () => {
    const { build, bark } = rebuild();

    expect(bark.branchVertexColors).toHaveLength(build.mesh.diagnostics.vertexCount * 3);
    expect(bark.branchRoughnessCharacters).toHaveLength(build.mesh.diagnostics.vertexCount);
    expect(bark.staticVertexColors).toHaveLength(build.rootGeometry.diagnostics.vertexCount * 3);
    expect(bark.staticRoughnessCharacters).toHaveLength(build.rootGeometry.diagnostics.vertexCount);
    expect(bark.diagnostics.branchRangeCount).toBe(build.mesh.branches.length);
    expect(bark.diagnostics.trunkVertexCount).toBeGreaterThan(0);
    expect(bark.diagnostics.generatedBranchVertexCount).toBeGreaterThan(0);
    expect(bark.diagnostics.geometryPreserved).toBe(true);
    expect(bark.diagnostics.branchRangesPreserved).toBe(true);
    expect(bark.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(bark.diagnostics.estimatedAdditionalMaterials).toBe(0);
    expect(bark.diagnostics.materialCount).toBe(2);
  });

  it('preserves the accepted terrain tint byte-for-byte', () => {
    const { build, bark } = rebuild();
    const terrainOffset = build.soilSurface.diagnostics.terrainVertexOffset * 3;

    expect(bark.staticVertexColors.slice(terrainOffset)).toEqual(
      build.soilSurface.vertexColors.slice(terrainOffset),
    );
    expect(bark.diagnostics.preservedTerrainVertexCount).toBe(
      build.soilSurface.diagnostics.terrainVertexCount,
    );
    expect(bark.diagnostics.soilTerrainTintPreserved).toBe(true);
  });

  it('keeps tint and roughness values quantized inside published bounds', () => {
    const { bark } = rebuild();
    const channelLevels = new Set(
      [...bark.branchVertexColors, ...bark.staticVertexColors].map((value) => value.toFixed(6)),
    );

    expect(bark.diagnostics.uniqueTintCount).toBeGreaterThan(1);
    expect(bark.diagnostics.uniqueTintCount).toBeLessThanOrEqual(bark.diagnostics.tintBudget);
    expect(bark.diagnostics.tintBudgetExceeded).toBe(false);
    expect(bark.diagnostics.minimumRoughnessCharacter).toBeGreaterThanOrEqual(0);
    expect(bark.diagnostics.maximumRoughnessCharacter).toBeLessThanOrEqual(1);
    expect(bark.diagnostics.maximumRoughnessCharacter).toBeGreaterThan(
      bark.diagnostics.minimumRoughnessCharacter,
    );
    expect(channelLevels.size).toBeLessThanOrEqual(
      DEFAULT_TREE_BARK_SURFACE_CONFIG.quantizationSteps,
    );
  });

  it('does not mutate accepted upstream states', () => {
    const build = buildTreeLabPreview('medium');
    const meshBefore = structuredClone(build.mesh);
    const rootBefore = structuredClone(build.rootGeometry);
    const soilBefore = structuredClone(build.soilSurface);
    const materialBefore = structuredClone(build.materials);

    buildTreeBarkSurface({
      species: build.species,
      frames: build.frames,
      mesh: build.mesh,
      rootGeometry: build.rootGeometry,
      soil: build.soilSurface,
      materials: build.materials,
      config: DEFAULT_TREE_BARK_SURFACE_CONFIG,
    });

    expect(build.mesh).toEqual(meshBefore);
    expect(build.rootGeometry).toEqual(rootBefore);
    expect(build.soilSurface).toEqual(soilBefore);
    expect(build.materials).toEqual(materialBefore);
  });

  it('rejects mismatched provenance and tint-budget overflow', () => {
    const build = buildTreeLabPreview('medium');

    expect(() => buildTreeBarkSurface({
      species: build.species,
      frames: build.frames,
      mesh: build.mesh,
      rootGeometry: build.rootGeometry,
      soil: {
        ...build.soilSurface,
        sourceRootGeometryRulesVersion: 'another-root-geometry',
      },
      materials: build.materials,
      config: DEFAULT_TREE_BARK_SURFACE_CONFIG,
    })).toThrow(/provenance/i);

    expect(() => buildTreeBarkSurface({
      species: build.species,
      frames: build.frames,
      mesh: build.mesh,
      rootGeometry: build.rootGeometry,
      soil: build.soilSurface,
      materials: build.materials,
      config: {
        ...DEFAULT_TREE_BARK_SURFACE_CONFIG,
        maximumUniqueTints: 1,
      },
    })).toThrow(/tint budget/i);
  });
});
