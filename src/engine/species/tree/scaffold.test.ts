import { describe, expect, it } from 'vitest';
import { ORGANIC_TRUNK_BRANCH_ID, type OrganicSkeletonState } from '../../labs/organic';
import {
  LEADER_SHOOTS,
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
   * ВИЛІТ НІКОЛИ НЕ ЗМЕНШУЄТЬСЯ — це і є полагоджена ширина крони. Доти її
   * задавала одна випадкова нижня гілочка, яка цього року пережила скидання,
   * а наступного ні: падінь ширини було 16-21 із 39 річних переходів,
   * найгірше ×0.41.
   *
   * НЕ СТРОГО БІЛЬШЕ, і це змінилось разом із законом (ADR-0105). Виліт —
   * це `висота × частка × звуження`. Частка стала СТАЛОЮ, взятою з еталона;
   * за віком її множить лише `treeCrownNarrowing`, яке насичується на 1.0
   * приблизно на двадцятому році. Тут стовбур фіксованої висоти, тож після
   * двадцяти зростати вже нічому — і це правильно: на дереві, яке перестало
   * рости вгору, крона не має розсуватись далі сама собою. У справжньому
   * конвеєрі виліт росте, бо росте висота.
   */
  it('розсуває крону щороку й ніколи не звужує', () => {
    let previous = 0;
    let atTwenty = 0;
    for (let years = SCAFFOLD_FIRST_YEAR; years <= 40; years += 1) {
      const grown = addTreeScaffoldBranches(trunkSkeleton(), years * DAYS_PER_YEAR, 11);
      const reach = reachOf(grown);
      expect({ years, shrank: reach < previous - 1e-9 }).toEqual({ years, shrank: false });
      if (years === 20) atTwenty = reach;
      previous = reach;
    }
    // Поки звуження ще не насичене, виліт мусить саме РОСТИ, а не стояти.
    const atThree = reachOf(
      addTreeScaffoldBranches(trunkSkeleton(), SCAFFOLD_FIRST_YEAR * DAYS_PER_YEAR, 11),
    );
    expect(atTwenty).toBeGreaterThan(atThree * 1.4);
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
     * Сім скелетних гілок по вісім вузлів, по чотири пагони на кожну по три
     * вузли, плюс вісім пагонів лідера по три: 10 + 7×8 + 7×4×3 + 8×3 = 174.
     *
     * Пагони на гілках додано, бо сім гілок на 128 комірок оболонки крони
     * лишали 56 із них порожніми (ADR-0093 §7). Пагони ЛІДЕРА — бо над
     * найвищою скелетною гілкою (0.72 зросту після ADR-0111) не було
     * жодної будови взагалі: листя липло просто до стовбура (ADR-0112).
     */
    expect(first.nodes.length).toBe(
      10
      + MAX_SCAFFOLD_BRANCHES * 8
      + MAX_SCAFFOLD_BRANCHES * 4 * 3
      + LEADER_SHOOTS * 3,
    );
  });
});

describe('пагони лідера', () => {
  /*
   * ЩО ВОНИ ЗАКРИВАЮТЬ. ADR-0111 опустив найвищу скелетну гілку з 0.88 на
   * 0.72 зросту, і підстава була правильна — скелетна гілка майже на
   * маківці не буває в дерева з одним провідником. Але над нею не лишилось
   * НІЯКОЇ будови: лідер ніс листя, а гілок не мав, тож листя липло до
   * стовбура.
   *
   * Тест стереже три речі, які легко втратити мовчки: що пагони взагалі є,
   * що вони СПРАВДІ вгорі, і що вони не пробивають верхівку. Ширину їм
   * задає огинальна породи, і окремої перевірки на неї тут немає навмисно —
   * вона стоїть у `crownProfile.test.ts`, де живе сам закон.
   */
  const shootsOf = (skeleton: OrganicSkeletonState) =>
    skeleton.nodes.filter((node) => node.branchId.startsWith('tree:leader:'));

  it('з\'являються разом зі скелетними гілками, а не раніше', () => {
    // Росток лишається ростком: до третього року в нього немає нічого.
    const seedling = addTreeScaffoldBranches(trunkSkeleton(), 1 * DAYS_PER_YEAR, 11);
    expect(shootsOf(seedling)).toHaveLength(0);

    const grown = addTreeScaffoldBranches(trunkSkeleton(), 20 * DAYS_PER_YEAR, 11);
    expect(new Set(shootsOf(grown).map((node) => node.branchId)).size).toBe(LEADER_SHOOTS);
  });

  it('СИДЯТЬ ВИЩЕ ЗА ВСІ СКЕЛЕТНІ ГІЛКИ', () => {
    /*
     * Головне тут. Пагін лідера, який опинився серед скелетних гілок, — це
     * просто ще одна гілка, і весь сенс зникає: верх крони знову
     * лишається порожнім, а середина глушиться.
     */
    const grown = addTreeScaffoldBranches(trunkSkeleton(), 20 * DAYS_PER_YEAR, 11);
    /*
     * Міряється КРІПЛЕННЯ, а не найвищий вузол: скелетна гілка підіймається
     * від свого вузла (`ADR-0111`), тож її кінчик буває вище за основу
     * пагона — і це нормально, вони переплітаються. Не нормально було б,
     * якби пагін лідера ЧІПЛЯВСЯ нижче за скелетну гілку.
     */
    const byId = new Map(grown.nodes.map((node) => [node.id, node]));
    const attachmentOf = (prefix: string) => Math.max(...grown.nodes
      .filter((node) => node.branchId.startsWith(prefix) && node.parentId !== null
        && byId.get(node.parentId)?.branchId === ORGANIC_TRUNK_BRANCH_ID)
      .map((node) => byId.get(node.parentId!)!.position.y));

    expect(attachmentOf('tree:leader:')).toBeGreaterThan(attachmentOf('tree:scaffold:'));
  });

  it('не пробивають верхівку на жодному віці', () => {
    // Та сама догма, що й для скелетних гілок: висота — закон віку.
    const base = trunkSkeleton();
    const top = Math.max(...base.nodes.map((node) => node.position.y));
    for (const years of [3, 8, 20, 40]) {
      const grown = addTreeScaffoldBranches(base, years * DAYS_PER_YEAR, 11);
      for (const node of shootsOf(grown)) {
        expect({ years, above: node.position.y > top + 1e-6 }).toEqual({ years, above: false });
      }
    }
  });

  it('СТОЯТЬ НА ПОВНОМУ КОЛІ, а не на одній дузі', () => {
    /*
     * Вада, яку цей тест закриває, жила в арифметиці наміру, а не в
     * намірі. Азимут рахувався як `(count + index) / (count + LEADER_SHOOTS)`
     * — щоб пагони «продовжували коло скелетних гілок» і жоден не став
     * точно за гілкою. Але при семи гілках і восьми пагонах частки йдуть
     * від 7/15 до 14/15, тобто всі вісім лягають у дугу 168°.
     *
     * Верх крони був односторонній ЗА ПОБУДОВОЮ. Виміряно на власній
     * сітці рушія (8 секторів × 4 шари): верхній шар займав 4–6 секторів
     * із восьми на активному профілі, 7 після правки.
     *
     * Міряється НАЙБІЛЬШИЙ РОЗРИВ між сусідніми азимутами, а не розмах:
     * розмах не побачив би восьми пагонів, збитих у пів кола з одним
     * відлетілим. Межа — півтора номінальних кроки: дрижання дозволене
     * (±півкроку), злипання — ні.
     */
    for (const years of [8, 20, 40]) {
      const grown = addTreeScaffoldBranches(trunkSkeleton(), years * DAYS_PER_YEAR, 11);
      const byBranch = new Map<string, number>();
      for (const node of shootsOf(grown)) {
        // Азимут гілки беремо з найдальшого від осі вузла: біля стовбура
        // напрямок ще не розділився, і всі пагони дивились би в один бік.
        const radial = Math.hypot(node.position.x, node.position.z);
        const previous = byBranch.get(`${node.branchId}:r`) ?? 0;
        if (radial > previous) {
          byBranch.set(`${node.branchId}:r`, radial);
          byBranch.set(node.branchId, Math.atan2(node.position.z, node.position.x));
        }
      }
      const azimuths = [...byBranch.entries()]
        .filter(([key]) => !key.endsWith(':r'))
        .map(([, angle]) => (angle + Math.PI * 2) % (Math.PI * 2))
        .sort((left, right) => left - right);
      expect(azimuths, `${years}р пагонів`).toHaveLength(LEADER_SHOOTS);

      let widestGap = 0;
      for (let index = 0; index < azimuths.length; index += 1) {
        const next = azimuths[(index + 1) % azimuths.length]!;
        const gap = index + 1 === azimuths.length
          ? next + Math.PI * 2 - azimuths[index]!
          : next - azimuths[index]!;
        widestGap = Math.max(widestGap, gap);
      }
      const step = (Math.PI * 2) / LEADER_SHOOTS;
      expect(widestGap, `${years}р найбільший розрив`).toBeLessThan(step * 1.5);
    }
  });

  it('коротшають догори, бо огинальна там вужча', () => {
    const grown = addTreeScaffoldBranches(trunkSkeleton(), 20 * DAYS_PER_YEAR, 11);
    const byBranch = new Map<string, number>();
    for (const node of shootsOf(grown)) {
      const radial = Math.hypot(node.position.x, node.position.z);
      byBranch.set(node.branchId, Math.max(byBranch.get(node.branchId) ?? 0, radial));
    }
    const ordered = [...byBranch.entries()].sort(([left], [right]) => (
      left < right ? -1 : left > right ? 1 : 0
    ));
    /*
     * «Не довший за попередній», а не «строго коротший»: на грубому
     * стовбурі (тут десять вузлів на всю висоту) сусідні пагони чіпляються
     * за ОДИН вузол, дістають однакову висоту й, отже, однаковий виліт.
     * Вимагати строгого спадання означало б перевіряти щільність фікстури.
     */
    for (let index = 1; index < ordered.length; index += 1) {
      // Допуск — сітка округлення позицій (`round6`): два пагони на одному
      // вузлі різняться в сьомому знаку, і це не спадання, а шум.
      expect(ordered[index]![1]).toBeLessThanOrEqual(ordered[index - 1]![1] + 1e-6);
    }
    expect(ordered.at(-1)![1]).toBeLessThan(ordered[0]![1]);
  });
});
