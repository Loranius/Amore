import { describe, expect, it } from 'vitest';
import { buildOrganicSweepMesh as buildPrimaryForkMesh } from './productionSweepMesh';
import { buildOrganicSweepMesh } from './multiJunctionSweepMesh';
import type {
  OrganicCurveFrameSample,
  OrganicCurveFrameState,
  OrganicJunctionAnchor,
} from './surfaceTypes';

function sample(
  id: string,
  branchId: string,
  generation: number,
  position: { x: number; y: number; z: number },
  radius: number,
  normalizedDistance: number,
  tangent = { x: 0, y: 1, z: 0 },
): OrganicCurveFrameSample {
  return {
    id,
    sourceNodeId: id,
    branchId,
    generation,
    normalizedDistance,
    position,
    tangent,
    normal: { x: 1, y: 0, z: 0 },
    binormal: { x: 0, y: 0, z: -1 },
    radius,
  };
}

function junction(
  childBranchId: string,
  parentNodeId: string,
  parentPosition: { x: number; y: number; z: number },
  parentRadius: number,
  childDirection: { x: number; y: number; z: number },
): OrganicJunctionAnchor {
  const radialDirection = { x: Math.sign(childDirection.x) || 1, y: 0, z: 0 };
  return {
    childBranchId,
    parentBranchId: 'organic:trunk',
    parentNodeId,
    parentPosition,
    parentRadius,
    parentTangent: { x: 0, y: 1, z: 0 },
    radialDirection,
    surfacePosition: {
      x: parentPosition.x + radialDirection.x * parentRadius * 0.98,
      y: parentPosition.y,
      z: parentPosition.z,
    },
    insetPosition: {
      x: parentPosition.x + radialDirection.x * parentRadius * 0.24,
      y: parentPosition.y,
      z: parentPosition.z,
    },
    childDirection,
    collarRadius: parentRadius * 0.54,
    joinSampleIndex: 1,
  };
}

function fixture(): OrganicCurveFrameState {
  const trunkSamples = [
    sample('trunk:0', 'organic:trunk', 0, { x: 0, y: 0, z: 0 }, 0.32, 0),
    sample('trunk:1', 'organic:trunk', 0, { x: 0.04, y: 0.45, z: 0 }, 0.3, 0.25),
    sample('trunk:side', 'organic:trunk', 0, { x: -0.03, y: 0.9, z: 0 }, 0.27, 0.5),
    sample('trunk:3', 'organic:trunk', 0, { x: 0.05, y: 1.35, z: 0 }, 0.24, 0.75),
    sample('trunk:end', 'organic:trunk', 0, { x: 0, y: 1.75, z: 0 }, 0.21, 1),
  ];
  const sideJunction = junction(
    'branch:side',
    'trunk:side',
    trunkSamples[2]!.position,
    trunkSamples[2]!.radius,
    { x: 0.78, y: 0.62, z: 0 },
  );
  const leftJunction = junction(
    'branch:left',
    'trunk:end',
    trunkSamples[4]!.position,
    trunkSamples[4]!.radius,
    { x: -0.62, y: 0.78, z: 0 },
  );
  const rightJunction = junction(
    'branch:right',
    'trunk:end',
    trunkSamples[4]!.position,
    trunkSamples[4]!.radius,
    { x: 0.62, y: 0.78, z: 0 },
  );

  return {
    organicCurveFrameVersion: 1,
    sourceSkeletonVersion: 1,
    sourceRulesVersion: 'multi-junction-fixture-v1',
    curves: [
      {
        branchId: 'organic:trunk',
        generation: 0,
        parentNodeId: null,
        terminalNodeId: 'trunk:end',
        junction: null,
        samples: trunkSamples,
      },
      {
        branchId: 'branch:side',
        generation: 1,
        parentNodeId: 'trunk:side',
        terminalNodeId: 'side:end',
        junction: sideJunction,
        samples: [
          sample('side:0', 'branch:side', 1, trunkSamples[2]!.position, 0.14, 0, sideJunction.childDirection),
          sample('side:1', 'branch:side', 1, { x: 0.35, y: 1.13, z: 0 }, 0.11, 0.5, sideJunction.childDirection),
          sample('side:end', 'branch:side', 1, { x: 0.65, y: 1.34, z: 0 }, 0.07, 1, sideJunction.childDirection),
        ],
      },
      ...[
        { id: 'left', junction: leftJunction, sign: -1 },
        { id: 'right', junction: rightJunction, sign: 1 },
      ].map(({ id, junction: anchor, sign }) => ({
        branchId: `branch:${id}`,
        generation: 1,
        parentNodeId: 'trunk:end',
        terminalNodeId: `${id}:end`,
        junction: anchor,
        samples: [
          sample(`${id}:0`, `branch:${id}`, 1, trunkSamples[4]!.position, 0.13, 0, anchor.childDirection),
          sample(`${id}:1`, `branch:${id}`, 1, { x: sign * 0.28, y: 2.06, z: 0 }, 0.1, 0.5, anchor.childDirection),
          sample(`${id}:end`, `branch:${id}`, 1, { x: sign * 0.52, y: 2.34, z: 0 }, 0.06, 1, anchor.childDirection),
        ],
      })),
    ],
    diagnostics: {
      branchCount: 4,
      sampleCount: 14,
      junctionCount: 3,
      skippedBranchIds: [],
      unresolvedJunctionBranchIds: [],
    },
  };
}

describe('Multi-junction organic sweep', () => {
  it('adds a deterministic shared shell to a visible side branch', () => {
    const frames = fixture();
    const primaryOnly = buildPrimaryForkMesh(frames, 'medium');
    const complete = buildOrganicSweepMesh(frames, 'medium');

    expect(complete).toEqual(buildOrganicSweepMesh(frames, 'medium'));
    expect(complete.diagnostics.vertexCount).toBeGreaterThan(primaryOnly.diagnostics.vertexCount);
    expect(complete.diagnostics.triangleCount).toBeGreaterThan(primaryOnly.diagnostics.triangleCount);
    expect(complete.indices.every((index) => (
      index >= 0 && index < complete.diagnostics.vertexCount
    ))).toBe(true);
  });
});
