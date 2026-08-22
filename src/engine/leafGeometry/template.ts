import { round6 } from '../growth/math';
import type {
  TreeLeafCardTemplate,
  TreeLeafGeometryLod,
} from './types';

interface LeafProfileRow {
  y: number;
  halfWidth: number;
  bend: number;
  /** Small sideways drift keeps the blade from reading as a perfect diamond. */
  skew: number;
  /** Opposite edge depth gives the otherwise flat card a botanical curl. */
  curl: number;
}

function rowsForLod(lod: TreeLeafGeometryLod): readonly LeafProfileRow[] {
  if (lod === 'high') {
    return [
      { y: 0, halfWidth: 0.055, bend: 0, skew: 0, curl: 0 },
      { y: 0.15, halfWidth: 0.33, bend: 0.022, skew: -0.012, curl: 0.009 },
      { y: 0.35, halfWidth: 0.5, bend: 0.068, skew: 0.016, curl: 0.018 },
      { y: 0.59, halfWidth: 0.46, bend: 0.108, skew: -0.013, curl: 0.022 },
      { y: 0.81, halfWidth: 0.285, bend: 0.072, skew: 0.011, curl: 0.012 },
      { y: 1, halfWidth: 0.02, bend: 0, skew: 0, curl: 0 },
    ];
  }
  if (lod === 'medium') {
    return [
      { y: 0, halfWidth: 0.055, bend: 0, skew: 0, curl: 0 },
      { y: 0.2, halfWidth: 0.36, bend: 0.03, skew: -0.014, curl: 0.011 },
      { y: 0.45, halfWidth: 0.5, bend: 0.08, skew: 0.018, curl: 0.02 },
      { y: 0.72, halfWidth: 0.38, bend: 0.09, skew: -0.012, curl: 0.015 },
      { y: 1, halfWidth: 0.02, bend: 0, skew: 0, curl: 0 },
    ];
  }
  return [
    { y: 0, halfWidth: 0.055, bend: 0, skew: 0, curl: 0 },
    { y: 0.48, halfWidth: 0.48, bend: 0.04, skew: 0.012, curl: 0.012 },
    { y: 1, halfWidth: 0.02, bend: 0, skew: 0, curl: 0 },
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
      round6(row.skew - row.halfWidth),
      round6(row.y),
      round6(row.bend - row.curl),
      round6(row.skew + row.halfWidth),
      round6(row.y),
      round6(row.bend + row.curl),
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
