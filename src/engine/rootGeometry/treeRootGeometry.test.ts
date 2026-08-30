import { describe, expect, it } from 'vitest';
import { buildTreeLabPreview } from '@/features/home/crystal3d/treeLab/buildTreeLabPreview';
import { DEFAULT_TREE_ROOT_GEOMETRY_CONFIG } from './config';
import { buildTreeRootGeometry } from './treeRootGeometry';

function build(lod: 'high' | 'medium' | 'low') {
  const preview = buildTreeLabPreview('medium');
  return buildTreeRootGeometry({
    roots: preview.roots,
    lod,
    config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
  });
}

describe('Tree Root Geometry Integration Lab', () => {
  it('is deterministic, provenance-safe and inside the dedicated mobile budget', () => {
    const first = build('medium');
    const second = build('medium');

    expect(second).toEqual(first);
    expect(first.mesh.branches.map((branch) => branch.branchId)).toEqual(
      buildTreeLabPreview('medium').roots.roots.map((root) => root.id),
    );
    expect(first.diagnostics.renderedRootCount).toBe(first.diagnostics.sourceRootCount);
    expect(first.diagnostics.vertexBudgetExceeded).toBe(false);
    expect(first.diagnostics.triangleBudgetExceeded).toBe(false);
    expect(first.diagnostics.missingRootMeshIds).toEqual([]);
    expect(first.diagnostics.unexpectedMeshBranchIds).toEqual([]);
    expect(first.diagnostics.estimatedDrawCalls).toBe(first.diagnostics.renderedRootCount > 0 ? 1 : 0);
    expect(first.diagnostics.anchoredToGround).toBe(true);
  });

  it('keeps logical roots stable while geometry complexity decreases by LOD', () => {
    const high = build('high');
    const medium = build('medium');
    const low = build('low');

    expect(high.mesh.branches.map((branch) => branch.branchId)).toEqual(
      medium.mesh.branches.map((branch) => branch.branchId),
    );
    expect(medium.mesh.branches.map((branch) => branch.branchId)).toEqual(
      low.mesh.branches.map((branch) => branch.branchId),
    );
    expect(high.diagnostics.vertexCount).toBeGreaterThanOrEqual(medium.diagnostics.vertexCount);
    expect(medium.diagnostics.vertexCount).toBeGreaterThanOrEqual(low.diagnostics.vertexCount);
    expect(high.diagnostics.triangleCount).toBeGreaterThanOrEqual(medium.diagnostics.triangleCount);
    expect(medium.diagnostics.triangleCount).toBeGreaterThanOrEqual(low.diagnostics.triangleCount);
  });

  it('merges Ground Contact and Terrain Binding without changing accepted states', () => {
    const preview = buildTreeLabPreview('medium');
    const rootsBefore = JSON.stringify(preview.roots);
    const contactBefore = JSON.stringify(preview.groundContact);
    const terrainBefore = JSON.stringify(preview.terrain);

    const state = buildTreeRootGeometry({
      roots: preview.roots,
      contact: preview.groundContact,
      terrain: preview.terrain,
      lod: 'medium',
      config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
    });

    expect(state.diagnostics.contactApplied).toBe(true);
    expect(state.diagnostics.terrainApplied).toBe(true);
    expect(state.diagnostics.terrainVertexCount).toBe(preview.terrain.diagnostics.vertexCount);
    expect(state.diagnostics.terrainTriangleCount).toBe(preview.terrain.diagnostics.triangleCount);
    expect(state.diagnostics.terrainMergedIntoStaticMesh).toBe(true);
    expect(state.diagnostics.estimatedDrawCalls).toBe(1);
    expect(JSON.stringify(preview.roots)).toBe(rootsBefore);
    expect(JSON.stringify(preview.groundContact)).toBe(contactBefore);
    expect(JSON.stringify(preview.terrain)).toBe(terrainBefore);
  });

  it('does not mutate accepted root architecture', () => {
    const preview = buildTreeLabPreview('medium');
    const before = JSON.stringify(preview.roots);

    buildTreeRootGeometry({
      roots: preview.roots,
      lod: 'medium',
      config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
    });

    expect(JSON.stringify(preview.roots)).toBe(before);
  });

  it('thins the roots to fit the budget instead of refusing to grow', () => {
    /*
     * ВАДА, ЯКУ ЦЕ ЛОВИТЬ, І ЯКА СТОЯЛА В ПРОДІ.
     *
     * Бюджет коренів був СТЕЛЕЮ, ОБ ЯКУ ДЕРЕВО РОЗБИВАЛОСЬ: сітку будували
     * раз, і якщо вона не влізла — кидали помилку. Портал ловить її й
     * показує заглушку, тобто пара не бачить свого дерева взагалі.
     *
     * Виміряно на синтетичних історіях (12 подій на рік, medium): на 6, 8 і
     * 10 роках корені виходили 1 320, 1 347 і 1 365 трикутників проти
     * бюджету 1 300, а на 7 роках проходили (1 068). Тобто у дорослого
     * дерева це була орлянка, і залежала вона від форми, яку дала коренями
     * архітектура, а не від віку.
     *
     * Ніхто цього не бачив, бо всі тести будували фікстуру на два з
     * половиною роки — вона в бюджет уміщається з запасом.
     */
    const preview = buildTreeLabPreview('medium');
    const roomy = buildTreeRootGeometry({
      roots: preview.roots,
      lod: 'medium',
      config: DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
    });
    // Фікстура влазить на заданих дев'яти — підгонка мовчить.
    expect(roomy.diagnostics.radialSegmentsUsed)
      .toBe(roomy.diagnostics.radialSegmentsConfigured);

    // Стеля, що лежить між дев'ятьма сегментами й вісьмома. Виміряно на цій
    // фікстурі: 819 трикутників на дев'яти, 728 на восьми, 637 на семи.
    const tight = buildTreeRootGeometry({
      roots: preview.roots,
      lod: 'medium',
      config: {
        ...DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
        maximumTrianglesByLod: {
          ...DEFAULT_TREE_ROOT_GEOMETRY_CONFIG.maximumTrianglesByLod,
          medium: 780,
        },
      },
    });

    expect(tight.diagnostics.radialSegmentsUsed).toBe(8);
    expect(tight.diagnostics.triangleBudgetExceeded).toBe(false);
    expect(tight.diagnostics.vertexBudgetExceeded).toBe(false);
    expect(tight.diagnostics.triangleCount).toBeLessThan(roomy.diagnostics.triangleCount);
    // Спрощення НЕ КОШТУЄ ЖОДНОГО КОРЕНЯ: тоншає поверхня, а не склад.
    expect(tight.diagnostics.renderedRootCount).toBe(roomy.diagnostics.renderedRootCount);
    expect(tight.mesh.branches.map((branch) => branch.branchId))
      .toEqual(roomy.mesh.branches.map((branch) => branch.branchId));
  });

  it('never thins the roots into flat spikes, whatever the budget says', () => {
    /*
     * Підгонка має підлогу — сім сегментів. На ШЕСТИ корені вже пробували, і
     * в коментарі до `radialSegmentsByLod` записано, чим це скінчилось:
     * «пласкі гострі шипи, що лежать на ґрунті, а не дерево, яке входить у
     * землю». Бюджет має право спростити корені, але не має права повернути
     * те, що одного разу відкинули за виглядом.
     *
     * Тому при нездійсненній стелі рушій кидає помилку, а не тоншає далі.
     * 600 — нижче за 637, які корені важать навіть на підлозі.
     */
    const preview = buildTreeLabPreview('medium');
    expect(() => buildTreeRootGeometry({
      roots: preview.roots,
      lod: 'medium',
      config: {
        ...DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
        maximumTrianglesByLod: {
          ...DEFAULT_TREE_ROOT_GEOMETRY_CONFIG.maximumTrianglesByLod,
          medium: 600,
        },
      },
    })).toThrow(/at 7 radial segments/);
  });

  it('rejects publication when a configured mesh budget is exceeded', () => {
    const preview = buildTreeLabPreview('medium');

    expect(() => buildTreeRootGeometry({
      roots: preview.roots,
      lod: 'medium',
      config: {
        ...DEFAULT_TREE_ROOT_GEOMETRY_CONFIG,
        maximumVerticesByLod: {
          ...DEFAULT_TREE_ROOT_GEOMETRY_CONFIG.maximumVerticesByLod,
          medium: 0,
        },
      },
    })).toThrow(/exceeded the medium mobile mesh budget/);
  });
});
