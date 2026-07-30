import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { cross, dot, normalize, subtract } from '../../growth/math';
import type { GrowthVec3 } from '../../growth/types';

function vectorAt(values: readonly number[], index: number): GrowthVec3 {
  const offset = index * 3;
  return {
    x: values[offset]!,
    y: values[offset + 1]!,
    z: values[offset + 2]!,
  };
}

describe('Organic sweep face winding', () => {
  it('winds trunk tube triangles toward the published outward vertex normals', () => {
    const mesh = buildTreeLabPreview('medium').mesh;
    const trunk = mesh.branches.find((branch) => branch.branchId === 'organic:trunk');

    expect(trunk).toBeDefined();
    const [a, b, c] = mesh.indices.slice(trunk!.firstIndex, trunk!.firstIndex + 3);
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    expect(c).toBeDefined();

    const positionA = vectorAt(mesh.positions, a!);
    const positionB = vectorAt(mesh.positions, b!);
    const positionC = vectorAt(mesh.positions, c!);
    const faceNormal = normalize(cross(
      subtract(positionB, positionA),
      subtract(positionC, positionA),
    ));

    const normalA = vectorAt(mesh.normals, a!);
    const normalB = vectorAt(mesh.normals, b!);
    const normalC = vectorAt(mesh.normals, c!);
    const averageVertexNormal = normalize({
      x: normalA.x + normalB.x + normalC.x,
      y: normalA.y + normalB.y + normalC.y,
      z: normalA.z + normalB.z + normalC.z,
    });

    expect(dot(faceNormal, averageVertexNormal)).toBeGreaterThan(0);
  });
});
