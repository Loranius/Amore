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
      contactApplied: false,
      terrainApplied: false,
      lod: 'medium',
    });

    geometry.dispose();
  });

  it('publishes Ground Contact, collar and terrain as one static geometry', () => {
    const state = buildTreeLabPreview('medium').rootGeometry;
    const geometry = createThreeTreeRootGeometry(state);

    expect(state.diagnostics.contactApplied).toBe(true);
    expect(state.diagnostics.collarVertexCount).toBeGreaterThan(0);
    expect(state.diagnostics.collarTriangleCount).toBeGreaterThan(0);
    expect(state.diagnostics.terrainApplied).toBe(true);
    expect(state.diagnostics.terrainVertexCount).toBeGreaterThan(0);
    expect(state.diagnostics.terrainTriangleCount).toBeGreaterThan(0);
    expect(state.diagnostics.terrainMergedIntoStaticMesh).toBe(true);
    expect(geometry.getAttribute('position').count).toBe(state.diagnostics.vertexCount);
    expect(geometry.userData['treeRootGeometry']).toMatchObject({
      contactApplied: true,
      groundLevelY: state.diagnostics.groundLevelY,
      visiblePathFraction: state.diagnostics.visiblePathFraction,
      collarVertices: state.diagnostics.collarVertexCount,
      collarTriangles: state.diagnostics.collarTriangleCount,
      terrainApplied: true,
      terrainVertices: state.diagnostics.terrainVertexCount,
      terrainTriangles: state.diagnostics.terrainTriangleCount,
      terrainMergedIntoStaticMesh: true,
    });

    geometry.dispose();
  });
});
