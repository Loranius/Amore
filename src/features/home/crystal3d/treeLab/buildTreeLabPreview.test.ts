import { describe, expect, it } from 'vitest';
import {
  TREE_PRODUCTION_HIGH_DETAIL_BUDGET,
  TREE_PRODUCTION_MOBILE_BUDGET,
} from '@/engine/productionAcceptance';
import { createThreeOrganicSweepGeometry } from '@/engine/renderer/three';
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

describe('Tree production preview pipeline', () => {
  it('keeps the full Evolution -> Species -> Growth -> Crown -> Surface -> Life -> Acceptance result deterministic', () => {
    const first = buildTreeLabPreview('medium');
    const second = buildTreeLabPreview('medium');

    expect(withoutBuildTime(second)).toEqual(withoutBuildTime(first));
    expect(second.seed).toBe(first.seed);
    expect(second.productionAcceptance.signature).toBe(first.productionAcceptance.signature);
  });

  it('preserves the fixed fixture as a wrapper around the generic artifact path', () => {
    const fixture = buildTreeLabPreview('medium');
    const generic = buildTreeLabPreviewFromArtifact({
      artifact: buildTreeSpeciesPreviewArtifact(),
      asOf: TREE_SPECIES_PREVIEW_AS_OF,
      lod: 'medium',
      rulesVersion: 'tree-species-preview-v1.0.0',
      asOfPolicy: 'fixed-fixture',
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

  it('publishes a passing production contract for low, medium and high LOD', () => {
    const low = buildTreeLabPreview('low');
    const medium = buildTreeLabPreview('medium');
    const high = buildTreeLabPreview('high');
    const builds = [low, medium, high] as const;

    for (const build of builds) {
      const contract = build.productionAcceptance;
      const budget = build.lod === 'high'
        ? TREE_PRODUCTION_HIGH_DETAIL_BUDGET
        : TREE_PRODUCTION_MOBILE_BUDGET;
      expect({ lod: build.lod, violations: contract.violations }).toEqual({
        lod: build.lod,
        violations: [],
      });
      expect(contract.staticStatus).toBe('pass');
      expect(contract.diagnostics.phaseOrderPreserved).toBe(true);
      expect(contract.diagnostics.phaseFingerprintsPresent).toBe(true);
      expect(contract.diagnostics.leafIdentityChainPreserved).toBe(true);
      expect(contract.diagnostics.lifeLeafPrefixPreserved).toBe(true);
      expect(contract.diagnostics.negativeSpaceAccepted).toBe(true);
      expect(contract.diagnostics.groundAnchored).toBe(true);
      expect(contract.diagnostics.terrainMergedIntoStaticGeometry).toBe(true);
      expect(contract.diagnostics.soilTerrainTintPreserved).toBe(true);
      expect(contract.diagnostics.barkGeometryPreserved).toBe(true);
      expect(contract.diagnostics.groundDetailsAnchored).toBe(true);
      expect(contract.diagnostics.groundDetailPrefixPreserved).toBe(true);
      expect(contract.diagnostics.vertices).toBeLessThanOrEqual(budget.maxVertices);
      expect(contract.diagnostics.triangles).toBeLessThanOrEqual(budget.maxTriangles);
      expect(contract.diagnostics.estimatedDrawCalls).toBeLessThanOrEqual(budget.maxDrawCalls);
      expect(contract.diagnostics.materials).toBeLessThanOrEqual(budget.maxMaterials);
    }

    const lowIds = low.leaves.instances.map((leaf) => leaf.id);
    const mediumIds = medium.leaves.instances.map((leaf) => leaf.id);
    const highIds = high.leaves.instances.map((leaf) => leaf.id);
    const mediumIdSet = new Set(mediumIds);
    const highIdSet = new Set(highIds);
    expect(lowIds.every((id) => mediumIdSet.has(id))).toBe(true);
    expect(mediumIds.every((id) => highIdSet.has(id))).toBe(true);
    expect(mediumIds.filter((id) => new Set(lowIds).has(id))).toEqual(lowIds);
    expect(highIds.filter((id) => mediumIdSet.has(id))).toEqual(mediumIds);
  });

  it('keeps canopy polish, surface character, static geometry, instances and life inside published mobile limits', () => {
    const build = buildTreeLabPreview('medium');
    const contract = build.productionAcceptance;

    expect(build.canopyDepth.profiles).toHaveLength(build.leaves.instances.length);
    expect(build.canopyDepth.diagnostics.innerLeafCount).toBeGreaterThan(0);
    expect(build.canopyDepth.diagnostics.middleLeafCount).toBeGreaterThan(0);
    expect(build.canopyDepth.diagnostics.outerLeafCount).toBeGreaterThan(0);
    expect(build.canopyDepth.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(build.canopyDepth.diagnostics.estimatedAdditionalMaterials).toBe(0);
    expect(build.canopyDepth.diagnostics.estimatedAdditionalMatrixUpdatesPerFrame).toBe(0);
    expect(build.canopyLight.profiles).toHaveLength(build.leaves.instances.length);
    expect(
      build.canopyLight.diagnostics.shadeLeafCount
        + build.canopyLight.diagnostics.transitionLeafCount
        + build.canopyLight.diagnostics.sunlitLeafCount,
    ).toBe(build.leaves.instances.length);
    expect(build.canopyLight.diagnostics.uniqueCombinedTintCount).toBeGreaterThan(1);
    expect(build.phenology.profiles).toHaveLength(build.leaves.instances.length);
    expect(build.leafOrientation.profiles).toHaveLength(build.leaves.instances.length);
    expect(build.leafOrientation.diagnostics.nonZeroProfileCount).toBeGreaterThan(0);
    expect(build.crownSilhouette.profiles).toHaveLength(build.leaves.instances.length);
    expect(build.crownSilhouette.diagnostics.adjustedOuterLeafCount).toBeGreaterThan(0);
    expect(build.crownSilhouette.diagnostics.negativeSpaceAccepted).toBe(true);
    expect(build.barkSurface.diagnostics.materialCount).toBe(2);
    expect(build.groundDetails.instances).toHaveLength(72);
    expect(build.groundDetails.diagnostics.totalMaterialCount).toBe(3);
    expect(build.life.diagnostics.estimatedMatrixUpdatesPerFrame).toBe(
      build.life.leaves.length,
    );
    expect(build.life.leaves.length).toBeLessThanOrEqual(build.leaves.instances.length);
    expect(contract.diagnostics.estimatedMatrixUpdatesPerFrame).toBe(build.life.leaves.length);
    expect(build.mesh.diagnostics.junctionCount).toBe(build.frames.diagnostics.junctionCount);
  });

  it('adapts the pure branch mesh and Bark Surface to one indexed Three.js geometry', () => {
    const build = buildTreeLabPreview('low');
    const geometry = createThreeOrganicSweepGeometry(build.mesh, build.barkSurface);

    expect(geometry.getAttribute('position').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('normal').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('uv').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('color').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getAttribute('barkCharacter').count).toBe(build.mesh.diagnostics.vertexCount);
    expect(geometry.getIndex()?.count).toBe(build.mesh.indices.length);
    expect(geometry.userData['treeLab']).toMatchObject({
      lod: 'low',
      branches: build.mesh.diagnostics.branchCount,
      junctions: build.frames.diagnostics.junctionCount,
      barkSurfaceApplied: true,
    });

    geometry.dispose();
  });
});
