import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_LIFE_CONFIG } from './config';
import { buildTreeLifeState, sampleTreeLifeFrame } from './treeLife';

function expectZeroFrame(frame: ReturnType<typeof sampleTreeLifeFrame>) {
  expect(frame.branchRotationX).toBe(0);
  expect(frame.branchRotationY).toBe(0);
  expect(frame.branchRotationZ).toBe(0);
  for (const leaf of frame.leaves) {
    expect(leaf.pitchRad).toBe(0);
    expect(leaf.rollRad).toBe(0);
  }
}

describe('Tree Life Lab', () => {
  it('is deterministic and adds no draw calls', () => {
    const first = buildTreeLabPreview('medium').life;
    const second = buildTreeLabPreview('medium').life;

    expect(second).toEqual(first);
    expect(first.leaves.length).toBeGreaterThan(0);
    expect(first.leaves.length).toBeLessThanOrEqual(DEFAULT_TREE_LIFE_CONFIG.maxLeafProfiles);
    expect(first.diagnostics.emittedLeafProfileCount).toBe(first.leaves.length);
    expect(first.diagnostics.estimatedAdditionalDrawCalls).toBe(0);
    expect(first.diagnostics.estimatedMatrixUpdatesPerFrame).toBe(first.leaves.length);
  });

  it('samples repeatable finite sway and obeys reduced motion', () => {
    const life = buildTreeLabPreview('medium').life;
    const first = sampleTreeLifeFrame({ life, elapsedSeconds: 8.25 });
    const second = sampleTreeLifeFrame({ life, elapsedSeconds: 8.25 });

    expect(second).toEqual(first);
    expect(Number.isFinite(first.branchRotationX)).toBe(true);
    expect(Number.isFinite(first.branchRotationY)).toBe(true);
    expect(Number.isFinite(first.branchRotationZ)).toBe(true);
    expect(first.leaves).toHaveLength(life.leaves.length);
    expectZeroFrame(sampleTreeLifeFrame({
      life,
      elapsedSeconds: 8.25,
      reducedMotion: true,
    }));
  });

  it('keeps shared leaf motion identities stable across LOD', () => {
    const high = buildTreeLabPreview('high').life;
    const low = buildTreeLabPreview('low').life;
    const highByLeafId = new Map(
      high.leaves.map((leaf) => [leaf.leafInstanceId, leaf] as const),
    );

    expect(low.motionScale).toBeLessThan(high.motionScale);
    for (const leaf of low.leaves) {
      const highLeaf = highByLeafId.get(leaf.leafInstanceId);
      expect(highLeaf).toBeDefined();
      expect(highLeaf && {
        id: highLeaf.id,
        leafInstanceId: highLeaf.leafInstanceId,
        phaseRad: highLeaf.phaseRad,
        speed: highLeaf.speed,
        pitchAmplitudeRad: highLeaf.pitchAmplitudeRad,
        rollAmplitudeRad: highLeaf.rollAmplitudeRad,
      }).toEqual({
        id: leaf.id,
        leafInstanceId: leaf.leafInstanceId,
        phaseRad: leaf.phaseRad,
        speed: leaf.speed,
        pitchAmplitudeRad: leaf.pitchAmplitudeRad,
        rollAmplitudeRad: leaf.rollAmplitudeRad,
      });
    }
    expect(low.branch).toEqual(high.branch);
  });

  it('never mutates accepted geometry or material state', () => {
    const build = buildTreeLabPreview('medium');
    const speciesBefore = JSON.stringify(build.species);
    const compositionBefore = JSON.stringify(build.composition);
    const leavesBefore = JSON.stringify(build.leaves);
    const materialsBefore = JSON.stringify(build.materials);

    buildTreeLifeState({
      species: build.species,
      composition: build.composition,
      leaves: build.leaves,
      materials: build.materials,
      config: DEFAULT_TREE_LIFE_CONFIG,
    });

    expect(JSON.stringify(build.species)).toBe(speciesBefore);
    expect(JSON.stringify(build.composition)).toBe(compositionBefore);
    expect(JSON.stringify(build.leaves)).toBe(leavesBefore);
    expect(JSON.stringify(build.materials)).toBe(materialsBefore);
  });

  it('truncates only later motion profiles when constrained', () => {
    const build = buildTreeLabPreview('medium');
    const constrained = buildTreeLifeState({
      species: build.species,
      composition: build.composition,
      leaves: build.leaves,
      materials: build.materials,
      config: {
        ...DEFAULT_TREE_LIFE_CONFIG,
        maxLeafProfiles: 4,
      },
    });

    expect(constrained.leaves).toEqual(build.life.leaves.slice(0, 4));
    expect(constrained.diagnostics.profileBudgetReached).toBe(
      build.leaves.instances.length > 4,
    );
    expect(constrained.diagnostics.truncatedLeafInstanceIds).toEqual(
      build.leaves.instances.slice(4).map((leaf) => leaf.id),
    );
  });
});
