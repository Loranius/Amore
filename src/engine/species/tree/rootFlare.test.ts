// ============================================================
// Комель: що саме він міняє, і чого НЕ міняє.
// ------------------------------------------------------------
// Найважливіше тут друге. Потовщення стоїть у конвеєрі між законом
// товщини й скелетними гілками, і якби воно зачепило хоч одну позицію
// вузла, поїхали б висота, силует крони й бюджет вершин одразу — а
// побачити це можна було б лише через кілька шарів, на знімку.
// ============================================================
import { describe, expect, it } from 'vitest';
import type { OrganicSkeletonNode, OrganicSkeletonState } from '../../labs/organic';
import { ORGANIC_TRUNK_BRANCH_ID } from '../../labs/organic';
import {
  TREE_ROOT_FLARE,
  TREE_ROOT_FLARE_SPAN,
  applyTreeRootFlare,
} from './rootFlare';

/** Простий стовбур: одинадцять вузлів від нуля до десяти, радіус сталий. */
function trunk(): OrganicSkeletonState {
  const nodes: OrganicSkeletonNode[] = Array.from({ length: 11 }, (_, index) => ({
    id: `n${index}`,
    branchId: ORGANIC_TRUNK_BRANCH_ID,
    parentId: index === 0 ? null : `n${index - 1}`,
    attractorId: null,
    sequence: index,
    generation: 0,
    position: { x: 0, y: index, z: 0 },
    direction: { x: 0, y: 1, z: 0 },
    radius: 0.1,
    terminal: index === 10,
  }));
  return { nodes, branches: [], diagnostics: {} } as unknown as OrganicSkeletonState;
}

const radiusAt = (state: OrganicSkeletonState, y: number): number => (
  state.nodes.find((node) => node.position.y === y)!.radius
);

describe('комель', () => {
  it('потовщує найнижчий вузол рівно на оголошений множник', () => {
    // Це і є те, що обіцяє константа. На МЕШІ вийде менше — стиснення
    // стовбура згладжує частину, і саме тому множник підбирався виміром
    // (див. `rootFlare.ts`), — але сам закон мусить робити те, що каже.
    const flared = applyTreeRootFlare(trunk());
    expect(radiusAt(flared, 0)).toBeCloseTo(0.1 * TREE_ROOT_FLARE, 6);
  });

  it('сходить нанівець на межі спаду й вище не чіпає нічого', () => {
    const flared = applyTreeRootFlare(trunk());
    // Висота 10, спад 0.20 -> потовщення живе нижче за y = 2.
    const edge = 10 * TREE_ROOT_FLARE_SPAN;
    for (const node of flared.nodes) {
      if (node.position.y >= edge) expect(node.radius).toBe(0.1);
    }
    expect(radiusAt(flared, 1)).toBeGreaterThan(0.1);
    expect(radiusAt(flared, 1)).toBeLessThan(radiusAt(flared, 0));
  });

  it('спадає монотонно, а не сходинкою', () => {
    /*
     * Комель мусить бути ПЕРЕХОДОМ. Сходинка на межі спаду читалась би
     * комірцем, надітим на жердину, — саме тією вадою, проти якої цей
     * закон і заводився.
     */
    const flared = applyTreeRootFlare(trunk());
    const inside = flared.nodes
      .filter((node) => node.position.y <= 10 * TREE_ROOT_FLARE_SPAN)
      .sort((left, right) => left.position.y - right.position.y);
    for (let index = 1; index < inside.length; index += 1) {
      expect(inside[index]!.radius).toBeLessThanOrEqual(inside[index - 1]!.radius + 1e-9);
    }
  });

  it('НЕ РУХАЄ ЖОДНОЇ ПОЗИЦІЇ', () => {
    /*
     * Головний інваріант файла. Потовщення стоїть перед скелетними
     * гілками й перед мешем; зсув хоч однієї позиції поїхав би у висоту,
     * силует крони й бюджет вершин одразу, а помітити це можна було б аж
     * на знімку.
     */
    const before = trunk();
    const after = applyTreeRootFlare(before);
    expect(after.nodes.map((node) => node.position))
      .toEqual(before.nodes.map((node) => node.position));
  });

  it('порожній скелет вертає себе, а не падає', () => {
    const empty = { ...trunk(), nodes: [] };
    expect(applyTreeRootFlare(empty)).toBe(empty);
  });

  it('дерево нульової висоти лишається як є', () => {
    // Усі вузли в одній точці: спад ділився б на нуль.
    const flat = trunk();
    const squashed = {
      ...flat,
      nodes: flat.nodes.map((node) => ({ ...node, position: { x: 0, y: 0, z: 0 } })),
    };
    expect(applyTreeRootFlare(squashed)).toBe(squashed);
  });
});
