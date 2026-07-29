import { describe, expect, it } from 'vitest';
import { distance, dot, length } from '../../growth/math';
import { generateEllipsoidAttractors } from './attractors';
import { DEFAULT_ORGANIC_SKELETON_CONFIG } from './config';
import { buildOrganicCurveFrames } from './curveFrames';
import { buildOrganicSkeleton } from './spaceColonization';
import { DEFAULT_ORGANIC_SURFACE_CONFIG } from './surfaceConfig';
import { buildOrganicSweepMesh } from './sweepMesh';

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
      for (const sample of curve.samples) {
        expect(length(sample.tangent)).toBeCloseTo(1, 5);
        expect(length(sample.normal)).toBeCloseTo(1, 5);
        expect(length(sample.binormal)).toBeCloseTo(1, 5);
        expect(Math.abs(dot(sample.tangent, sample.normal))).toBeLessThan(2e-5);
        expect(Math.abs(dot(sample.tangent, sample.binormal))).toBeLessThan(2e-5);
        expect(Math.abs(dot(sample.normal, sample.binormal))).toBeLessThan(2e-5);
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
