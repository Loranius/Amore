import { describe, expect, it } from 'vitest';
import { ORGANIC_TRUNK_BRANCH_ID, type OrganicSkeletonState } from '../../labs/organic';
import {
  MAX_SCAFFOLD_BRANCHES,
  SCAFFOLD_FIRST_YEAR,
  addTreeScaffoldBranches,
  scaffoldCountFor,
} from './scaffold';

const DAYS_PER_YEAR = 365.2425;

/**
 * Стовбур із десяти вузлів заввишки одиниця — рівно те, що потрібно
 * скелетним гілкам: вони чіпляються за вузол стовбура на заданій частці
 * висоти й нічого більше про дерево не питають.
 */
function trunkSkeleton(): OrganicSkeletonState {
  return {
    organicSkeletonVersion: 1,
    rulesVersion: 'test',
    seed: 7,
    nodes: Array.from({ length: 10 }, (_, index) => ({
      id: `trunk:${index}`,
      branchId: ORGANIC_TRUNK_BRANCH_ID,
      parentId: index === 0 ? null : `trunk:${index - 1}`,
      attractorId: null,
      sequence: index,
      generation: 0,
      position: { x: 0, y: index / 9, z: 0 },
      direction: { x: 0, y: 1, z: 0 },
      radius: 0.05 * (1 - index / 18),
      terminal: index === 9,
    })),
    diagnostics: {
      consumedAttractorIds: [], unresolvedAttractorIds: [],
      truncatedAttractorIds: [], fallbackHostAttractorIds: [],
      maxGeneration: 0,
    },
  };
}

const scaffoldsOf = (skeleton: OrganicSkeletonState) =>
  skeleton.nodes.filter((node) => node.branchId.startsWith('tree:scaffold:'));

const reachOf = (skeleton: OrganicSkeletonState) => Math.max(
  0,
  ...scaffoldsOf(skeleton).map((node) => Math.hypot(node.position.x, node.position.z)),
);

describe('гілки-скелети', () => {
  /*
   * ВЛАСНИК: «ширину крони, яка далі гуляє, і гілки-скелети — додавай, якщо
   * їх немає, а їх немає, додавай». Виміряно до цього: медіана довжини гілки
   * 2-4% висоти на КОЖНОМУ віці, тобто дерево було стовбуром зі ста
   * двадцятьма однаковими прутиками.
   */
  it('не дає гілок ростку, і дає з третього року', () => {
    expect(scaffoldCountFor(1 * DAYS_PER_YEAR)).toBe(0);
    expect(scaffoldCountFor((SCAFFOLD_FIRST_YEAR - 0.1) * DAYS_PER_YEAR)).toBe(0);
    expect(scaffoldCountFor(SCAFFOLD_FIRST_YEAR * DAYS_PER_YEAR)).toBe(MAX_SCAFFOLD_BRANCHES);
    expect(scaffoldCountFor(40 * DAYS_PER_YEAR)).toBe(MAX_SCAFFOLD_BRANCHES);
  });

  /*
   * ВИЛІТ РОСТЕ Й НІКОЛИ НЕ ЗМЕНШУЄТЬСЯ — це і є полагоджена ширина крони.
   * Доти її задавала одна випадкова нижня гілочка, яка цього року пережила
   * скидання, а наступного ні: падінь ширини було 16-21 із 39 річних
   * переходів, найгірше ×0.41.
   */
  it('розсуває крону щороку', () => {
    let previous = 0;
    for (let years = SCAFFOLD_FIRST_YEAR; years <= 40; years += 1) {
      const grown = addTreeScaffoldBranches(trunkSkeleton(), years * DAYS_PER_YEAR, 11);
      const reach = reachOf(grown);
      expect({ years, grew: reach > previous }).toEqual({ years, grew: true });
      previous = reach;
    }
  });

  /*
   * АЗИМУТИ РІВНОМІРНІ, і це вимога чужого контракту, а не смак: за золотим
   * кутом три гілки лягали в одну половину кола, і «Tree Crown Silhouette
   * multi-view acceptance» падав на одинадцяти роках із сорока — з деяких
   * напрямків попереду не було ЖОДНОГО листка.
   *
   * Перевірка тут саме півпросторова, бо саме її й не витримував золотий
   * кут: із будь-якого напрямку хоч одна гілка мусить бути попереду.
   */
  it('не лишає жодного напрямку без гілки попереду', () => {
    const grown = addTreeScaffoldBranches(trunkSkeleton(), 20 * DAYS_PER_YEAR, 11);
    // Кінчики САМИХ скелетних гілок, без пагонів на них (ADR-0093 §7).
    const tips = scaffoldsOf(grown).filter(
      (node) => node.terminal && !node.branchId.includes(':twig:'),
    );
    expect(tips).toHaveLength(MAX_SCAFFOLD_BRANCHES);

    for (let view = 0; view < 36; view += 1) {
      const angle = (view / 36) * Math.PI * 2;
      const ahead = tips.filter((tip) => (
        tip.position.x * Math.cos(angle) + tip.position.z * Math.sin(angle) > 0
      ));
      expect({ view, ahead: ahead.length > 0 }).toEqual({ view, ahead: true });
    }
  });

  /*
   * Гілка не сміє вилізти над верхівкою: коли вона це робила, висота меша
   * їхала за нею (4.26 на двадцятому році, 4.54 на тридцятому, 7.07 на
   * сороковому) і ламала монотонність, полагоджену в ADR-0092.
   */
  it('не піднімається над верхівкою дерева', () => {
    for (const years of [3, 10, 20, 40]) {
      const base = trunkSkeleton();
      const top = Math.max(...base.nodes.map((node) => node.position.y));
      const grown = addTreeScaffoldBranches(base, years * DAYS_PER_YEAR, 11);
      for (const node of scaffoldsOf(grown)) {
        expect({ years, above: node.position.y > top + 1e-6 }).toEqual({ years, above: false });
      }
    }
  });

  it('лишає вихідний скелет незмінним і детермінований', () => {
    const base = trunkSkeleton();
    const first = addTreeScaffoldBranches(base, 20 * DAYS_PER_YEAR, 11);
    const second = addTreeScaffoldBranches(base, 20 * DAYS_PER_YEAR, 11);
    expect(first).toEqual(second);
    expect(base.nodes).toHaveLength(10);
    /*
     * Сім скелетних гілок по вісім вузлів плюс по чотири пагони на кожну по
     * три вузли: 10 + 7×8 + 7×4×3 = 150. Пагони додано, бо сім гілок на 128
     * комірок оболонки крони лишали 56 із них порожніми (ADR-0093 §7).
     */
    expect(first.nodes.length).toBe(10 + MAX_SCAFFOLD_BRANCHES * 8 + MAX_SCAFFOLD_BRANCHES * 4 * 3);
  });
});
