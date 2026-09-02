// ============================================================
// Огинальна крони — і чим вона звірена.
// ------------------------------------------------------------
// Головне тут — ДРУГИЙ тест. Числа профілю (`TREE_CROWN_WIDEST_AT`,
// показник спаду) продубльовані з еталонного скрипта на Python, і спільного
// джерела в них бути не може. Замість спільного файла стоїть спільний
// ВИМІР: закон мусить відтворювати смуги силуету справжнього GLB.
//
// Без цього дублювання мовчки роз'їхалося б — і найгірше, що роз'їхалась би
// саме МІРКА, тобто всі висновки, зроблені проти неї.
// ============================================================
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGlbPositions } from '@/features/home/crystal3d/evolution/glbPositions';
import { treeSilhouetteProfile } from './treeProfile';
import type { OrganicSkeletonNode, OrganicSkeletonState } from '../../labs/organic';
import { ORGANIC_TRUNK_BRANCH_ID } from '../../labs/organic';
import {
  TREE_CROWN_BOTTOM_SHARE,
  TREE_CROWN_HALF_WIDTH_SHARE,
  TREE_CROWN_WIDEST_AT,
  applyTreeCrownEnvelope,
  treeCrownHalfWidthAt,
  treeCrownRadiusShare,
} from './crownProfile';

describe('огинальна крони', () => {
  it('сходить у нуль на обох кінцях і тримає одиницю на найширшому місці', () => {
    expect(treeCrownRadiusShare(0)).toBeGreaterThan(0);
    expect(treeCrownRadiusShare(1)).toBeCloseTo(0, 6);
    expect(treeCrownRadiusShare(TREE_CROWN_WIDEST_AT)).toBeCloseTo(1, 6);
    expect(treeCrownRadiusShare(-0.1)).toBe(0);
    expect(treeCrownRadiusShare(1.4)).toBe(0);
  });

  it('росте до найширшого місця й спадає після нього, без сходинок', () => {
    let previous = -1;
    for (let step = 0; step <= 40; step += 1) {
      const share = step / 40;
      const value = treeCrownRadiusShare(share);
      if (share <= TREE_CROWN_WIDEST_AT) expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
    for (let step = 40; step >= 0; step -= 1) {
      const share = step / 40;
      if (share < TREE_CROWN_WIDEST_AT) break;
      expect(treeCrownRadiusShare(share))
        .toBeLessThanOrEqual(treeCrownRadiusShare(Math.max(TREE_CROWN_WIDEST_AT, share - 0.025)) + 1e-9);
    }
  });

  it('ВІДТВОРЮЄ СМУГИ СПРАВЖНЬОГО ЕТАЛОНА', () => {
    /*
     * Еталонний GLB міряється тією самою `treeSilhouetteProfile`, що й наше
     * дерево. Закон мусить лягати на його смуги в межах, які лишає сама
     * дискретизація: двадцять смуг на висоту, і крона еталона має горби по
     * висоті й азимуту (`crown_shell`), тож збіг у смугу не буває точним.
     */
    const reference = treeSilhouetteProfile(
      readGlbPositions(new Uint8Array(readFileSync('scripts/models/reference/tree-40y.glb'))),
    );
    const bands = reference.bands;
    let worst = 0;
    for (let index = 0; index < bands.length; index += 1) {
      const heightShare = (index + 0.5) / bands.length;
      if (heightShare < TREE_CROWN_BOTTOM_SHARE) continue;
      const law = treeCrownHalfWidthAt(heightShare);
      worst = Math.max(worst, Math.abs(law - bands[index]!));
    }
    // Виміряно: найбільше розходження 0.06 півширини на висоту.
    expect(worst).toBeLessThan(0.08);
  });

  it('найширше місце закону збігається з найширшим місцем еталона', () => {
    const reference = treeSilhouetteProfile(
      readGlbPositions(new Uint8Array(readFileSync('scripts/models/reference/tree-40y.glb'))),
    );
    const lawWidest = TREE_CROWN_BOTTOM_SHARE
      + TREE_CROWN_WIDEST_AT * (1 - TREE_CROWN_BOTTOM_SHARE);
    expect(Math.abs(lawWidest - reference.widestAt)).toBeLessThan(0.06);
    expect(Math.abs(TREE_CROWN_HALF_WIDTH_SHARE - reference.spread)).toBeLessThan(0.05);
  });
});

/** Стовбур плюс одна гілка, що стирчить далеко за будь-яку огинальну. */
function tree(): OrganicSkeletonState {
  const nodes: OrganicSkeletonNode[] = [];
  for (let index = 0; index <= 10; index += 1) {
    nodes.push({
      id: `t${index}`,
      branchId: ORGANIC_TRUNK_BRANCH_ID,
      parentId: index === 0 ? null : `t${index - 1}`,
      attractorId: null,
      sequence: index,
      generation: 0,
      position: { x: 0, y: index, z: 0 },
      direction: { x: 0, y: 1, z: 0 },
      radius: 0.1,
      terminal: false,
    });
  }
  for (let index = 1; index <= 3; index += 1) {
    nodes.push({
      id: `b${index}`,
      branchId: 'branch',
      parentId: index === 1 ? 't9' : `b${index - 1}`,
      attractorId: null,
      sequence: 10 + index,
      generation: 1,
      // Висота 9 з десяти — верхівка, де стеля найвужча; виліт 5 із 10.
      position: { x: index * 1.7, y: 9, z: 0 },
      direction: { x: 1, y: 0, z: 0 },
      radius: 0.02,
      terminal: index === 3,
    });
  }
  return { nodes, branches: [], diagnostics: {} } as unknown as OrganicSkeletonState;
}

describe('стеля крони', () => {
  it('підтягує те, що вилізло за огинальну', () => {
    const capped = applyTreeCrownEnvelope(tree());
    const tip = capped.nodes.find((node) => node.id === 'b3')!;
    const cap = 10 * treeCrownHalfWidthAt(0.9);
    expect(Math.hypot(tip.position.x, tip.position.z)).toBeCloseTo(cap, 5);
  });

  it('НЕ ЧІПАЄ ВИСОТИ Й ТОВЩИНИ', () => {
    /*
     * Стеля — закон ФОРМИ КРОНИ. Якби вона рухала y, поїхав би закон віку
     * (`scaleTreeSkeletonToAge`), а якби радіуси — закон трубки; помітити це
     * можна було б аж на знімку, через кілька шарів.
     */
    const before = tree();
    const after = applyTreeCrownEnvelope(before);
    expect(after.nodes.map((node) => node.position.y)).toEqual(before.nodes.map((n) => n.position.y));
    expect(after.nodes.map((node) => node.radius)).toEqual(before.nodes.map((n) => n.radius));
  });

  it('не чіпає стовбура', () => {
    const after = applyTreeCrownEnvelope(tree());
    for (const node of after.nodes) {
      if (node.branchId !== ORGANIC_TRUNK_BRANCH_ID) continue;
      expect(node.position.x).toBe(0);
      expect(node.position.z).toBe(0);
    }
  });

  it('дерево всередині огинальної вертає СЕБЕ, а не копію', () => {
    // Тотожність не переписує вузлів: та сама пам'ять, той самий хеш.
    const thin = tree();
    const inside = {
      ...thin,
      nodes: thin.nodes.map((node) => ({ ...node, position: { ...node.position, x: 0.01 } })),
    };
    expect(applyTreeCrownEnvelope(inside)).toBe(inside);
  });

  it('звуження за віком звужує стелю рівно на себе', () => {
    const full = applyTreeCrownEnvelope(tree());
    const half = applyTreeCrownEnvelope(tree(), 0.5);
    const reach = (state: OrganicSkeletonState): number => Math.hypot(
      state.nodes.find((node) => node.id === 'b3')!.position.x,
      state.nodes.find((node) => node.id === 'b3')!.position.z,
    );
    expect(reach(half)).toBeCloseTo(reach(full) * 0.5, 5);
  });

  it('порожній скелет і дерево нульової висоти вертають себе', () => {
    const empty = { ...tree(), nodes: [] };
    expect(applyTreeCrownEnvelope(empty)).toBe(empty);
    const flat = tree();
    const squashed = {
      ...flat,
      nodes: flat.nodes.map((node) => ({ ...node, position: { ...node.position, y: 0 } })),
    };
    expect(applyTreeCrownEnvelope(squashed)).toBe(squashed);
  });
});
