import { describe, expect, it } from 'vitest';
import { buildOrganicSweepMesh as buildBaseOrganicSweepMesh } from './sweepMesh';
import { buildOrganicSweepMesh } from './seamlessSweepMesh';
import type {
  OrganicCurveFrameSample,
  OrganicCurveFrameState,
} from './surfaceTypes';

function sample(
  id: string,
  branchId: string,
  position: { x: number; y: number; z: number },
  radius: number,
  normalizedDistance: number,
  tangent = { x: 0, y: 1, z: 0 },
  normal = { x: 1, y: 0, z: 0 },
  binormal = { x: 0, y: 0, z: -1 },
): OrganicCurveFrameSample {
  return {
    id,
    sourceNodeId: id,
    branchId,
    generation: branchId === 'organic:trunk' ? 0 : 1,
    normalizedDistance,
    position,
    tangent,
    normal,
    binormal,
    radius,
  };
}

function forkFrames(): OrganicCurveFrameState {
  const leftTangent = { x: -0.6, y: 0.8, z: 0 };
  const rightTangent = { x: 0.6, y: 0.8, z: 0 };
  const childNormal = { x: 0, y: 0, z: 1 };
  const leftBinormal = { x: 0.8, y: 0.6, z: 0 };
  const rightBinormal = { x: 0.8, y: -0.6, z: 0 };

  return {
    organicCurveFrameVersion: 1,
    sourceSkeletonVersion: 1,
    sourceRulesVersion: 'seamless-fork-fixture-v1',
    curves: [
      {
        branchId: 'organic:trunk',
        generation: 0,
        parentNodeId: null,
        terminalNodeId: 'trunk:end',
        junction: null,
        samples: [
          sample('trunk:0', 'organic:trunk', { x: 0, y: 0, z: 0 }, 0.31, 0),
          sample('trunk:1', 'organic:trunk', { x: 0, y: 0.25, z: 0 }, 0.3, 0.25),
          sample('trunk:2', 'organic:trunk', { x: 0, y: 0.5, z: 0 }, 0.29, 0.5),
          sample('trunk:3', 'organic:trunk', { x: 0, y: 0.75, z: 0 }, 0.27, 0.75),
          sample('trunk:end', 'organic:trunk', { x: 0, y: 1, z: 0 }, 0.25, 1),
        ],
      },
      {
        branchId: 'branch:left',
        generation: 1,
        parentNodeId: 'trunk:end',
        terminalNodeId: 'left:end',
        junction: {
          childBranchId: 'branch:left',
          parentBranchId: 'organic:trunk',
          parentNodeId: 'trunk:end',
          parentPosition: { x: 0, y: 1, z: 0 },
          parentRadius: 0.25,
          parentTangent: { x: 0, y: 1, z: 0 },
          radialDirection: { x: -1, y: 0, z: 0 },
          surfacePosition: { x: -0.24, y: 1, z: 0 },
          insetPosition: { x: -0.07, y: 1, z: 0 },
          childDirection: leftTangent,
          collarRadius: 0.2,
          joinSampleIndex: 1,
        },
        samples: [
          sample('left:0', 'branch:left', { x: 0, y: 1, z: 0 }, 0.18, 0, leftTangent, childNormal, leftBinormal),
          sample('left:1', 'branch:left', { x: -0.32, y: 1.36, z: 0 }, 0.15, 0.5, leftTangent, childNormal, leftBinormal),
          sample('left:end', 'branch:left', { x: -0.62, y: 1.72, z: 0 }, 0.11, 1, leftTangent, childNormal, leftBinormal),
        ],
      },
      {
        branchId: 'branch:right',
        generation: 1,
        parentNodeId: 'trunk:end',
        terminalNodeId: 'right:end',
        junction: {
          childBranchId: 'branch:right',
          parentBranchId: 'organic:trunk',
          parentNodeId: 'trunk:end',
          parentPosition: { x: 0, y: 1, z: 0 },
          parentRadius: 0.25,
          parentTangent: { x: 0, y: 1, z: 0 },
          radialDirection: { x: 1, y: 0, z: 0 },
          surfacePosition: { x: 0.24, y: 1, z: 0 },
          insetPosition: { x: 0.07, y: 1, z: 0 },
          childDirection: rightTangent,
          collarRadius: 0.2,
          joinSampleIndex: 1,
        },
        samples: [
          sample('right:0', 'branch:right', { x: 0, y: 1, z: 0 }, 0.18, 0, rightTangent, childNormal, rightBinormal),
          sample('right:1', 'branch:right', { x: 0.32, y: 1.36, z: 0 }, 0.15, 0.5, rightTangent, childNormal, rightBinormal),
          sample('right:end', 'branch:right', { x: 0.62, y: 1.72, z: 0 }, 0.11, 1, rightTangent, childNormal, rightBinormal),
        ],
      },
    ],
    diagnostics: {
      branchCount: 3,
      sampleCount: 11,
      junctionCount: 2,
      skippedBranchIds: [],
      unresolvedJunctionBranchIds: [],
    },
  };
}

describe('Seamless organic fork shell', () => {
  it('inserts one shared shell into the parent range and preserves child indices', () => {
    const frames = forkFrames();
    const base = buildBaseOrganicSweepMesh(frames, 'medium');
    const seamless = buildOrganicSweepMesh(frames, 'medium');
    const baseTrunk = base.branches.find((branch) => branch.branchId === 'organic:trunk')!;
    const trunk = seamless.branches.find((branch) => branch.branchId === 'organic:trunk')!;
    const baseLeft = base.branches.find((branch) => branch.branchId === 'branch:left')!;
    const left = seamless.branches.find((branch) => branch.branchId === 'branch:left')!;

    expect(seamless.diagnostics.branchCount).toBe(base.diagnostics.branchCount);
    expect(seamless.diagnostics.junctionCount).toBe(base.diagnostics.junctionCount);
    expect(trunk.vertexCount).toBeGreaterThan(baseTrunk.vertexCount);
    expect(trunk.indexCount).toBeGreaterThan(baseTrunk.indexCount);
    expect(left.firstVertex).toBeGreaterThan(baseLeft.firstVertex);
    expect(left.firstIndex).toBeGreaterThan(baseLeft.firstIndex);
    expect(seamless.indices.every(
      (index) => index >= 0 && index < seamless.diagnostics.vertexCount,
    )).toBe(true);

    const patchStart = baseTrunk.firstVertex + baseTrunk.vertexCount;
    const patchCount = trunk.vertexCount - baseTrunk.vertexCount;
    const patchX = Array.from({ length: patchCount }, (_unused, index) => (
      seamless.positions[(patchStart + index) * 3]!
    ));
    const patchY = Array.from({ length: patchCount }, (_unused, index) => (
      seamless.positions[(patchStart + index) * 3 + 1]!
    ));
    expect(Math.min(...patchX)).toBeLessThan(-0.2);
    expect(Math.max(...patchX)).toBeGreaterThan(0.2);
    expect(Math.max(...patchY)).toBeGreaterThan(1.2);
  });

  it('is deterministic and keeps LOD complexity monotonic', () => {
    const frames = forkFrames();
    expect(buildOrganicSweepMesh(frames, 'medium')).toEqual(
      buildOrganicSweepMesh(frames, 'medium'),
    );

    const high = buildOrganicSweepMesh(frames, 'high');
    const medium = buildOrganicSweepMesh(frames, 'medium');
    const low = buildOrganicSweepMesh(frames, 'low');
    expect(high.diagnostics.vertexCount).toBeGreaterThan(medium.diagnostics.vertexCount);
    expect(medium.diagnostics.vertexCount).toBeGreaterThan(low.diagnostics.vertexCount);
    expect(high.diagnostics.triangleCount).toBeGreaterThan(medium.diagnostics.triangleCount);
    expect(medium.diagnostics.triangleCount).toBeGreaterThan(low.diagnostics.triangleCount);
  });
});
