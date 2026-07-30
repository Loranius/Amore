import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import {
  DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
  buildTreeRootGeometry,
} from '../../rootGeometry';
import { createThreeTreeRootGeometry } from './treeRootGeometry';

describe('Three Tree Root Geometry adapter', () => {
  it('publishes the accepted indexed root sweep as one anchored geometry', () => {
    const preview = buildTreeLabPreview('medium');
    const state = buildTreeRootGeometry({
      roots: preview.roots,
      lod: 'medium',
      config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
    });
    const geometry = createThreeTreeRootGeometry(state);

    expect(geometry.getAttribute('position').count).toBe(state.diagnostics.vertexCount);
    expect(geometry.getAttribute('normal').count).toBe(state.diagnostics.vertexCount);
    expect(geometry.getAttribute('uv').count).toBe(state.diagnostics.vertexCount);
    expect((geometry.index?.count ?? 0) / 3).toBe(state.diagnostics.triangleCount);
    expect(geometry.boundingBox?.isEmpty()).toBe(false);
    expect(geometry.boundingSphere?.radius ?? 0).toBeGreaterThan(0);
    expect(geometry.userData['treeRootGeometry']).toMatchObject({
      roots: state.diagnostics.renderedRootCount,
      anchoredToGround: true,
      lod: 'medium',
    });

    geometry.dispose();
  });
});
