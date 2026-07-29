import { round6 } from '../growth/math';
import type {
  TreeLeafCardTemplate,
  TreeLeafGeometryLod,
} from './types';

interface LeafProfileRow {
  y: number;
  halfWidth: number;
  bend: number;
}

function rowsForLod(lod: TreeLeafGeometryLod): readonly LeafProfileRow[] {
  if (lod === 'high') {
    return [
      { y: 0, halfWidth: 0.06, bend: 0 },
      { y: 0.16, halfWidth: 0.34, bend: 0.025 },
      { y: 0.36, halfWidth: 0.5, bend: 0.07 },
      { y: 0.58, halfWidth: 0.47, bend: 0.105 },
      { y: 0.8, halfWidth: 0.28, bend: 0.07 },
      { y: 1, halfWidth: 0.025, bend: 0 },
    ];
  }
  if (lod === 'medium') {
    return [
      { y: 0, halfWidth: 0.06, bend: 0 },
      { y: 0.28, halfWidth: 0.46, bend: 0.05 },
      { y: 0.68, halfWidth: 0.4, bend: 0.075 },
      { y: 1, halfWidth: 0.025, bend: 0 },
    ];
  }
  return [
    { y: 0, halfWidth: 0.06, bend: 0 },
    { y: 0.48, halfWidth: 0.48, bend: 0.035 },
    { y: 1, halfWidth: 0.025, bend: 0 },
  ];
}

/**
 * Builds one normalized leaf blade. Local +Y is leaf direction, +Z is the
 * front normal and +X is the width axis. All rendered leaves instance this
 * same topology for the selected LOD.
 */
export function buildTreeLeafCardTemplate(
  lod: TreeLeafGeometryLod,
): TreeLeafCardTemplate {
  const rows = rowsForLod(lod);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (const row of rows) {
    positions.push(
      round6(-row.halfWidth),
      round6(row.y),
      round6(row.bend),
      round6(row.halfWidth),
      round6(row.y),
      round6(row.bend),
    );
    uvs.push(0, round6(row.y), 1, round6(row.y));
  }

  for (let rowIndex = 0; rowIndex < rows.length - 1; rowIndex += 1) {
    const lowerLeft = rowIndex * 2;
    const lowerRight = lowerLeft + 1;
    const upperLeft = lowerLeft + 2;
    const upperRight = lowerLeft + 3;
    indices.push(
      lowerLeft,
      lowerRight,
      upperLeft,
      lowerRight,
      upperRight,
      upperLeft,
    );
  }

  return {
    lod,
    positions,
    uvs,
    indices,
    vertexCount: positions.length / 3,
    triangleCount: indices.length / 3,
  };
}
