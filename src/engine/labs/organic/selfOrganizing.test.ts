import { describe, expect, it } from 'vitest';
import { buildSelfOrganizingSkeleton } from './selfOrganizing';
import { DEFAULT_SELF_ORGANIZING_CONFIG } from './selfOrganizingConfig';
import type { SelfOrganizingConfig } from './selfOrganizing';
import type { OrganicSkeletonNode } from './types';

const SEED = 20221226;

function grow(patch: Partial<SelfOrganizingConfig> = {}) {
  return buildSelfOrganizingSkeleton({
    seed: SEED,
    config: { ...DEFAULT_SELF_ORGANIZING_CONFIG, cycles: 6, ...patch },
  });
}

function branchIds(nodes: readonly OrganicSkeletonNode[]): Set<string> {
  return new Set(nodes.map((node) => node.branchId));
}

function height(nodes: readonly OrganicSkeletonNode[]): number {
  return Math.max(...nodes.map((node) => node.position.y));
}

/** Найнижча бічна гілка, у частках висоти: 3% — кущ, 55% — жердина з мітлою. */
function lowestBranchShare(nodes: readonly OrganicSkeletonNode[]): number {
  const lateral = nodes.filter((node) => node.branchId !== 'organic:trunk');
  if (lateral.length === 0) return 1;
  return Math.min(...lateral.map((node) => node.position.y)) / height(nodes);
}

describe('Самоорганізаційний ріст — форма', () => {
  it('grows a hierarchy instead of a pole with a broom on top', () => {
    /*
     * ТЕ, ЗАРАДИ ЧОГО МОДЕЛЬ ЗАМІНЕНО, і всі три числа тут — з виміру старої.
     *
     * Просторова колонізація давала 13 гілок зі стелею в три покоління,
     * стрункість 9.2 (у справжніх дерев 20-60) і найнижчу гілку аж на 55%
     * висоти. Тобто стовбур-довбня, гола знизу, з мітлою нагорі.
     *
     * Пороги нижче навмисно широкі: це не фіксація нинішніх чисел, а межа,
     * нижче за яку дерево перестає бути деревом.
     */
    const nodes = grow().nodes;
    const slenderness = height(nodes) / (nodes[0]!.radius * 2);

    expect(branchIds(nodes).size).toBeGreaterThan(20);
    expect(slenderness).toBeGreaterThan(20);
    expect(slenderness).toBeLessThan(60);
    /*
     * Стереже САМЕ ЖЕРДИНУ, і тільки її. Стара модель ставила найнижчу гілку
     * на 55% висоти; тут вимагається нижче половини.
     *
     * Протилежний край — кущ від самої землі — цим тестом НЕ стережеться, і
     * це сказано прямо, бо за нинішніх чисел дерево саме там і сидить:
     * синтетичне дає 0%, справжнє дерево пари — 8%. Скидання гілок, яке мало б
     * підняти низ, на трьох-шести циклах ще не встигає спрацювати: молода
     * крона нікого не затіняє. Написати тут поріг знизу означало б або
     * зафіксувати те, чого немає, або тихо його підігнати.
     */
    expect(lowestBranchShare(nodes)).toBeLessThan(0.5);
  });

  it('survives a lean year instead of being killed by it', () => {
    /*
     * НАЙГІРША З ЧОТИРЬОХ ВАД, І ВОНА ХОВАЛАСЬ ЗА ОДНИМ `continue`.
     *
     * Пуп'янок, якому цього циклу не дісталось сили на ціле міжвузля, не
     * потрапляв у список наступного циклу — тобто зникав НАЗАВЖДИ. У живої
     * рослини сплячі бруньки для того й сплять: вони чекають роками й
     * прокидаються, коли над ними звільниться світло.
     *
     * ЩО ТУТ ВИМІРЯНО. Три історії по три роки, з тим самим зерном:
     *
     *   рясно-рясно-рясно  -> 73 гілки
     *   рясно-ПУСТО-рясно  -> 13 гілок     (бруньки перечекали)
     *   рясно-пусто-пусто  ->  1 гілка
     *
     * Зі зламаною сплячістю середній рядок дає ОДНУ гілку — тобто один тихий
     * рік убивав дерево остаточно, і наступний рясний рік не мав уже кому
     * дістатись. Для пари це означало б, що місяць без записів у порталі
     * знищує дерево безповоротно.
     *
     * Перша редакція цього тесту міряла монотонність кількості гілок за
     * силою тіні — і НЕ ЛОВИЛА зламу: за нинішніх чисел дерево й без сплячих
     * лишалось монотонним. Тест, що проходить з правильної причини лише
     * випадково, не стереже нічого.
     */
    const branches = (vigourByCycle: number[]) =>
      branchIds(grow({ cycles: vigourByCycle.length, vigourByCycle }).nodes).size;

    const steady = branches([12, 12, 12]);
    const recovered = branches([12, 0.4, 12]);
    const abandoned = branches([12, 0.4, 0.4]);

    expect(steady).toBeGreaterThan(20);
    expect(abandoned).toBeLessThan(5);
    // Головне: після тихого року дерево ще вміє рости.
    expect(recovered).toBeGreaterThan(abandoned * 5);
  });

  it('treats gnarliness as an angle that actually does something', () => {
    /*
     * Вузлуватість ділилась на радіус кінчика (0.014), давала 2 радіани й
     * упиралась у запобіжник 0.6 — тобто кожне міжвузля довертало пагін на
     * 34° у випадковий бік, і крону зносило набік. Виміряно: 0.012, 0.028 і
     * 0.05 давали дерево ДО ВУЗЛА однакове.
     *
     * Причина, озирнувшись, очевидна: росте дерево кінчиком, а кінчик за
     * трубковою моделлю завжди завтовшки з кінчик. Ділити на нього — значить
     * ділити на константу.
     */
    const straight = grow({ gnarliness: 0.02 }).nodes;
    const wild = grow({ gnarliness: 0.4 }).nodes;

    const wander = (nodes: readonly OrganicSkeletonNode[]) => {
      const trunk = nodes.filter((node) => node.branchId === 'organic:trunk');
      const top = trunk[trunk.length - 1]!;
      return Math.hypot(top.position.x, top.position.z) / height(nodes);
    };

    expect(wander(wild)).toBeGreaterThan(wander(straight));
  });

  it('spreads the crown instead of pressing it against the trunk', () => {
    /*
     * Порожній градієнт тіні віддавав «угору» — мовляв, як ніщо не затіняє,
     * то найсвітліше вгорі. Сітка ж рідка, тож градієнт нульовий майже
     * скрізь, і світло ставало СТАЛИМ ПОТЯГОМ УГОРУ: кожна бічна гілка після
     * першого ж міжвузля повертала вертикально. Виходив йоржик — відношення
     * ширини до висоти 0.44.
     *
     * «Немає даних» має означати «немає впливу».
     */
    const nodes = grow().nodes;
    const width = Math.max(
      ...nodes.map((node) => Math.hypot(node.position.x, node.position.z)),
    ) * 2;
    expect(width / height(nodes)).toBeGreaterThan(0.55);
  });

  it('slopes branches upward, not down like a willow', () => {
    /*
     * Ширина не відрізняє розлогого дерева від плакучого: обидва широкі. На
     * знімку виросла ВЕРБА — гілки звисали до землі, — а відношення ширини до
     * висоти при цьому казало 0.98, тобто «все гаразд».
     *
     * Тому міряється похил: синус кута від основи гілки до її кінця.
     */
    const nodes = grow().nodes;
    const byBranch = new Map<string, OrganicSkeletonNode[]>();
    for (const node of nodes) {
      if (node.branchId === 'organic:trunk') continue;
      const list = byBranch.get(node.branchId) ?? [];
      list.push(node);
      byBranch.set(node.branchId, list);
    }

    let total = 0;
    let counted = 0;
    for (const list of byBranch.values()) {
      if (list.length < 2) continue;
      const first = list[0]!;
      const last = list[list.length - 1]!;
      const flat = Math.hypot(last.position.x - first.position.x, last.position.z - first.position.z);
      const rise = last.position.y - first.position.y;
      const span = Math.hypot(flat, rise);
      if (span < 1e-6) continue;
      total += rise / span;
      counted += 1;
    }

    expect(counted).toBeGreaterThan(5);
    expect(total / counted).toBeGreaterThan(0);
  });
});

describe('Самоорганізаційний ріст — закон', () => {
  it('makes the trunk thickness a consequence of its branches', () => {
    /*
     * ГОЛОВНА ВАДА СТАРОЇ МОДЕЛІ В ОДНОМУ РЯДКУ: радіус був
     * `baseRadius * (1 - t * 0.58)` — ідеально лінійний конус, що про гілки
     * не знав нічого.
     *
     * Тут він наслідок: `r^n = Σ r_дитини^n`, правило да Вінчі. Отже вузол
     * ніколи не тонший за будь-яку зі своїх гілок, а основа — найтовща.
     */
    const nodes = grow().nodes;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const exponent = DEFAULT_SELF_ORGANIZING_CONFIG.pipeExponent;

    const children = new Map<string, OrganicSkeletonNode[]>();
    for (const node of nodes) {
      if (node.parentId === null) continue;
      const list = children.get(node.parentId) ?? [];
      list.push(node);
      children.set(node.parentId, list);
    }

    let forks = 0;
    for (const [parentId, list] of children) {
      const parent = byId.get(parentId)!;
      const sum = list.reduce((total, child) => total + child.radius ** exponent, 0);
      expect(parent.radius + 1e-6).toBeGreaterThanOrEqual(sum ** (1 / exponent) - 1e-6);
      for (const child of list) {
        expect(parent.radius + 1e-9).toBeGreaterThanOrEqual(child.radius);
      }
      if (list.length > 1) forks += 1;
    }

    expect(forks).toBeGreaterThan(3);
    expect(nodes[0]!.radius).toBe(Math.max(...nodes.map((node) => node.radius)));
  });

  it('grows one cycle per year, and a fuller year grows more', () => {
    /*
     * Те, заради чого все інше: історія пари має бути ФОРМОЮ дерева, а не
     * підписом під ним. Рік — цикл; сила року — з того, наскільки широко
     * його прожили.
     */
    const young = grow({ cycles: 2 }).nodes;
    const old = grow({ cycles: 6 }).nodes;
    expect(height(old)).toBeGreaterThan(height(young));
    expect(branchIds(old).size).toBeGreaterThan(branchIds(young).size);

    const lean = grow({ cycles: 4, vigourByCycle: [6, 6, 6, 6] }).nodes;
    const rich = grow({ cycles: 4, vigourByCycle: [6, 6, 6, 16] }).nodes;
    expect(branchIds(rich).size).toBeGreaterThan(branchIds(lean).size);
  });

  it('keeps the past where it grew', () => {
    /*
     * «Минуле не переписується» (PRODUCT.md). Цикл ДОДАЄ пагони до вже
     * вирослого, тож дерево на N років мусить починатись тим самим, чим
     * скінчилось дерево на N-1 — доти, доки скидання не забере голодну гілку.
     *
     * Тому звіряється НАЙДОВШИЙ СПІЛЬНИЙ ПОЧАТОК, а не повний збіг: те, що
     * відмерло, відмерти мало.
     */
    const before = grow({ cycles: 3 }).nodes;
    const after = grow({ cycles: 4 }).nodes;

    const survived = new Set(after.map((node) => node.id));
    const kept = before.filter((node) => survived.has(node.id));
    expect(kept.length).toBeGreaterThan(before.length * 0.5);
    for (const node of kept) {
      const later = after.find((item) => item.id === node.id)!;
      expect({ id: node.id, position: later.position }).toEqual({ id: node.id, position: node.position });
    }
  });

  it('treats internode length as pure scale', () => {
    /*
     * Тіньова сітка міряється в довжинах міжвузля саме заради цього. Доти
     * ребро було абсолютним, і менше дерево вміщувалось у власну тінь: за
     * 0.34 виростало 39 гілок, за 0.20 — ГОЛИЙ СТОВБУР.
     */
    const small = grow({ internodeLength: 0.1 });
    const large = grow({ internodeLength: 0.3 });

    expect(small.nodes.length).toBe(large.nodes.length);
    expect(branchIds(small.nodes).size).toBe(branchIds(large.nodes).size);
    expect(height(large.nodes) / height(small.nodes)).toBeCloseTo(3, 1);
  });

  it('gives the same couple the same tree twice', () => {
    // Жодного `Math.random`: форма тримається на `seededUnit` і на стабільному
    // порядку обходу, бо порядок тут впливає на результат.
    expect(grow()).toEqual(grow());
    expect(buildSelfOrganizingSkeleton({ seed: SEED + 1, config: { ...DEFAULT_SELF_ORGANIZING_CONFIG, cycles: 6 } }).nodes)
      .not.toEqual(grow().nodes);
  });

  it('refuses to publish without a rules version', () => {
    // Версія правил — те, чим відрізняються два несумісні закони росту.
    expect(() => grow({ rulesVersion: '  ' })).toThrow(/rulesVersion/);
  });
});
