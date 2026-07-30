import { describe, expect, it } from 'vitest';
import { distance, dot, length } from '../../growth/math';
import { generateEllipsoidAttractors } from './attractors';
import { DEFAULT_ORGANIC_SKELETON_CONFIG } from './config';
import { buildOrganicCurveFrames } from './curveFrames';
import { buildOrganicSkeleton } from './spaceColonization';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import { buildOrganicSweepMesh } from './sweepMesh';
import type {
  OrganicCurveFrameSample,
  OrganicCurveFrameState,
} from './surfaceTypes';

const SEED = 41_992;
const ATTRACTORS = generateEllipsoidAttractors({
  seed: SEED,
  count: 18,
  center: { x: 0, y: 3.45, z: 0 },
  horizontalRadius: 1.72,
  verticalRadius: 1.18,
});

function buildSkeleton(count = ATTRACTORS.length) {
  return buildOrganicSkeleton({
    seed: SEED,
    attractors: ATTRACTORS.slice(0, count),
    config: DEFAULT_ORGANIC_SKELETON_CONFIG,
  });
}

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

function buildSyntheticForkFrames(): OrganicCurveFrameState {
  const trunkSamples = [
    sample('trunk:0', 'organic:trunk', { x: 0, y: 0, z: 0 }, 0.31, 0),
    sample('trunk:1', 'organic:trunk', { x: 0, y: 0.25, z: 0 }, 0.3, 0.25),
    sample('trunk:2', 'organic:trunk', { x: 0, y: 0.5, z: 0 }, 0.29, 0.5),
    sample('trunk:3', 'organic:trunk', { x: 0, y: 0.75, z: 0 }, 0.27, 0.75),
    sample('trunk:end', 'organic:trunk', { x: 0, y: 1, z: 0 }, 0.25, 1),
  ];
  const leftTangent = { x: -0.6, y: 0.8, z: 0 };
  const rightTangent = { x: 0.6, y: 0.8, z: 0 };
  const childNormal = { x: 0, y: 0, z: 1 };
  const leftBinormal = { x: 0.8, y: 0.6, z: 0 };
  const rightBinormal = { x: 0.8, y: -0.6, z: 0 };

  return {
    organicCurveFrameVersion: 1,
    sourceSkeletonVersion: 1,
    sourceRulesVersion: 'synthetic-fork-v1',
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
          sample(
            'left:0',
            'branch:left',
            { x: 0, y: 1, z: 0 },
            0.18,
            0,
            leftTangent,
            childNormal,
            leftBinormal,
          ),
          sample(
            'left:1',
            'branch:left',
            { x: -0.32, y: 1.36, z: 0 },
            0.15,
            0.5,
            leftTangent,
            childNormal,
            leftBinormal,
          ),
          sample(
            'left:end',
            'branch:left',
            { x: -0.62, y: 1.72, z: 0 },
            0.11,
            1,
            leftTangent,
            childNormal,
            leftBinormal,
          ),
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
          sample(
            'right:0',
            'branch:right',
            { x: 0, y: 1, z: 0 },
            0.18,
            0,
            rightTangent,
            childNormal,
            rightBinormal,
          ),
          sample(
            'right:1',
            'branch:right',
            { x: 0.32, y: 1.36, z: 0 },
            0.15,
            0.5,
            rightTangent,
            childNormal,
            rightBinormal,
          ),
          sample(
            'right:end',
            'branch:right',
            { x: 0.62, y: 1.72, z: 0 },
            0.11,
            1,
            rightTangent,
            childNormal,
            rightBinormal,
          ),
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

describe('Tree Lab organic surface', () => {
  it('builds deterministic curve frames without mutating the skeleton', () => {
    const skeleton = buildSkeleton();
    const snapshot = structuredClone(skeleton);
    const first = buildOrganicCurveFrames(skeleton);
    const second = buildOrganicCurveFrames(skeleton);
    const childCurves = first.curves.filter((curve) => curve.parentNodeId !== null);

    expect(second).toEqual(first);
    expect(skeleton).toEqual(snapshot);
    expect(first.curves.length).toBeGreaterThan(1);
    expect(first.diagnostics.junctionCount).toBe(childCurves.length);
    expect(first.diagnostics.skippedBranchIds).toEqual([]);
    expect(first.diagnostics.unresolvedJunctionBranchIds).toEqual([]);
  });

  it('keeps every transported frame orthonormal', () => {
    const frames = buildOrganicCurveFrames(buildSkeleton());

    for (const curve of frames.curves) {
      expect(curve.samples.length).toBeGreaterThanOrEqual(2);
      for (const frameSample of curve.samples) {
        expect(length(frameSample.tangent)).toBeCloseTo(1, 5);
        expect(length(frameSample.normal)).toBeCloseTo(1, 5);
        expect(length(frameSample.binormal)).toBeCloseTo(1, 5);
        expect(Math.abs(dot(frameSample.tangent, frameSample.normal))).toBeLessThan(2e-5);
        expect(Math.abs(dot(frameSample.tangent, frameSample.binormal))).toBeLessThan(2e-5);
        expect(Math.abs(dot(frameSample.normal, frameSample.binormal))).toBeLessThan(2e-5);
      }
    }
  });

  it('anchors every child branch with an embedded deterministic collar', () => {
    const frames = buildOrganicCurveFrames(buildSkeleton());
    const childCurves = frames.curves.filter((curve) => curve.parentNodeId !== null);

    for (const curve of childCurves) {
      expect(curve.junction).not.toBeNull();
      const junction = curve.junction!;
      expect(distance(junction.insetPosition, junction.parentPosition)).toBeLessThan(
        junction.parentRadius,
      );
      expect(distance(junction.surfacePosition, junction.parentPosition)).toBeCloseTo(
        junction.parentRadius * DEFAULT_ORGANIC_SURFACE_CONFIG.junctionSurfaceRatio,
        5,
      );
      expect(junction.joinSampleIndex).toBeGreaterThan(0);
      expect(junction.joinSampleIndex).toBeLessThan(curve.samples.length);
      expect(junction.collarRadius).toBeGreaterThanOrEqual(
        DEFAULT_ORGANIC_SURFACE_CONFIG.minimumRadius,
      );
    }
  });

  it('opens terminal forks and grows parent-side buttresses instead of leaving a glued cap', () => {
    const frames = buildSyntheticForkFrames();
    const mesh = buildOrganicSweepMesh(frames, 'medium');
    const trunk = mesh.branches.find((branch) => branch.branchId === 'organic:trunk');
    const left = mesh.branches.find((branch) => branch.branchId === 'branch:left');
    const right = mesh.branches.find((branch) => branch.branchId === 'branch:right');

    expect(trunk).toBeDefined();
    expect(left?.junctionRingCount).toBe(
      DEFAULT_ORGANIC_SURFACE_CONFIG.junctionSegmentsByLod.medium,
    );
    expect(right?.junctionRingCount).toBe(
      DEFAULT_ORGANIC_SURFACE_CONFIG.junctionSegmentsByLod.medium,
    );

    const expectedTubeIndices = (trunk!.ringCount - 1) * trunk!.radialSegments * 6;
    const expectedBaseCapIndices = trunk!.radialSegments * 3;
    expect(trunk!.indexCount).toBe(expectedTubeIndices + expectedBaseCapIndices);

    const terminalRingStart = trunk!.firstVertex
      + (trunk!.ringCount - 1) * trunk!.radialSegments;
    const terminalPosition = { x: 0, y: 1, z: 0 };
    const radialExtent = (directionX: number) => {
      let maximum = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < trunk!.radialSegments; index += 1) {
        const vertex = terminalRingStart + index;
        const x = mesh.positions[vertex * 3]! - terminalPosition.x;
        maximum = Math.max(maximum, x * directionX);
      }
      return maximum;
    };

    expect(radialExtent(-1)).toBeGreaterThan(0.25 * 1.15);
    expect(radialExtent(1)).toBeGreaterThan(0.25 * 1.15);
  });

  it('keeps historical branch curves byte-stable when later attractors are appended', () => {
    const earlier = buildOrganicCurveFrames(buildSkeleton(8));
    const later = buildOrganicCurveFrames(buildSkeleton());

    for (const historicalCurve of earlier.curves) {
      expect(later.curves.find((curve) => curve.branchId === historicalCurve.branchId)).toEqual(
        historicalCurve,
      );
    }
  });

  it('emits finite indexed meshes with matching vertex attributes', () => {
    const frames = buildOrganicCurveFrames(buildSkeleton());
    const mesh = buildOrganicSweepMesh(frames, 'high');
    const vertexCount = mesh.positions.length / 3;

    expect(mesh.positions.length).toBe(mesh.normals.length);
    expect(vertexCount).toBe(mesh.uvs.length / 2);
    expect(mesh.indices.length % 3).toBe(0);
    expect(mesh.positions.every(Number.isFinite)).toBe(true);
    expect(mesh.normals.every(Number.isFinite)).toBe(true);
    expect(mesh.uvs.every(Number.isFinite)).toBe(true);
    expect(mesh.indices.every((index) => index >= 0 && index < vertexCount)).toBe(true);
    expect(mesh.diagnostics.junctionCount).toBe(frames.diagnostics.junctionCount);
    expect(mesh.diagnostics.triangleCount).toBe(mesh.indices.length / 3);
  });

  it('derives all LOD tiers from the same frames and reduces geometry monotonically', () => {
    const frames = buildOrganicCurveFrames(buildSkeleton());
    const high = buildOrganicSweepMesh(frames, 'high');
    const medium = buildOrganicSweepMesh(frames, 'medium');
    const low = buildOrganicSweepMesh(frames, 'low');

    expect(high.branches.map((branch) => branch.branchId)).toEqual(
      medium.branches.map((branch) => branch.branchId),
    );
    expect(medium.branches.map((branch) => branch.branchId)).toEqual(
      low.branches.map((branch) => branch.branchId),
    );
    expect(high.sourceRulesVersion).toBe(frames.sourceRulesVersion);
    expect(medium.sourceRulesVersion).toBe(frames.sourceRulesVersion);
    expect(low.sourceRulesVersion).toBe(frames.sourceRulesVersion);
    expect(high.diagnostics.junctionRingCount).toBe(
      frames.diagnostics.junctionCount
        * DEFAULT_ORGANIC_SURFACE_CONFIG.junctionSegmentsByLod.high,
    );
    expect(medium.diagnostics.junctionRingCount).toBe(
      frames.diagnostics.junctionCount
        * DEFAULT_ORGANIC_SURFACE_CONFIG.junctionSegmentsByLod.medium,
    );
    expect(low.diagnostics.junctionRingCount).toBe(
      frames.diagnostics.junctionCount
        * DEFAULT_ORGANIC_SURFACE_CONFIG.junctionSegmentsByLod.low,
    );
    expect(high.diagnostics.vertexCount).toBeGreaterThan(medium.diagnostics.vertexCount);
    expect(medium.diagnostics.vertexCount).toBeGreaterThan(low.diagnostics.vertexCount);
    expect(high.diagnostics.triangleCount).toBeGreaterThan(medium.diagnostics.triangleCount);
    expect(medium.diagnostics.triangleCount).toBeGreaterThan(low.diagnostics.triangleCount);
  });
});
