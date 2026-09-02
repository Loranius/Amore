// ============================================================
// Огинальна крони — один закон для еталона, для симуляції й для скелетів.
// ------------------------------------------------------------
// П'ЯТИЙ РОЗРИВ, І ВІН НАЙГЛИБШИЙ: У СИМУЛЯЦІЇ КРОНИ НЕ БУЛО ВЗАГАЛІ.
//
// Самоорганізаційний ріст (`selfOrganizing.ts`) не має поняття огинальної:
// пагін іде туди, де світліше, і зупиняється, коли бракує сили. Форму
// задають тінь, верхівкове панування й тропізм — усе це закони РОСТУ, а не
// закони ФОРМИ. Тому крона виходила стовпом, і виміряти це стало можливо аж
// тоді, коли полагодили обрізання (§1 нижче) і на сороковому році крона
// повернулась із однієї гілки в п'ятнадцять. Смуги силуету:
//
//   0.04 0.03 0.03 0.36 0.38 0.35 0.39 0.39 0.36 0.37 0.38 0.38 0.39 0.33
//   0.37 0.39 0.38 0.35 0.37 0.27
//
// Від 15% зросту до самої маківки ширина стоїть на 0.36-0.39 і не думає
// сходити. Доти цього не було видно, бо від симуляції на сорока роках
// лишалась одна гілка, і всю крону малювали сім скелетних гілок, які свій
// профіль мають.
//
// ЧОМУ ЗАКОН, А НЕ ЧИСЛО. Еталонне дерево оголошує крону тілом обертання за
// профілем `crown_radius_at` (`scripts/models/reference-tree.py`). Поки той
// профіль був тільки в еталона, ми могли лише МІРЯТИ розрив. Тепер він
// задає й нашу крону — і симуляції, і скелетним гілкам, — тож виміряна
// відстань стає відстанню між тим самим законом, по-різному втіленим, а не
// між формою та її відсутністю.
//
// ЧОМУ НЕ ВСЕРЕДИНІ СИМУЛЯЦІЇ. Огинальна — це властивість ПОРОДИ, а не
// росту: риф і кристал ростуть тим самим механізмом і крони не мають.
// Тому закон стоїть у породі й накладається на готовий скелет, як уже
// стоять закон висоти (`scaleTreeSkeletonToAge`) і закон комля
// (`applyTreeRootFlare`).
// ============================================================
import type { OrganicSkeletonNode, OrganicSkeletonState } from '../../labs/organic';
import { ORGANIC_TRUNK_BRANCH_ID } from '../../labs/organic';

/**
 * Частка висоти дерева, нижче якої крони немає.
 *
 * Еталон оголошує чистий стовбур 0.28 і міряється в 0.275. У нас 0.27 —
 * звідси ж сидить і найнижча скелетна гілка (ADR-0106 §1): вільне дерево
 * гілкується низько, саме тим воно й відрізняється від лісового.
 */
export const TREE_CROWN_BOTTOM_SHARE = 0.27;

/**
 * Півширина крони як частка висоти дерева.
 *
 * ЧИСЛО З ЕТАЛОНА (ADR-0104, ADR-0105). Еталон міряється в 0.423; наше
 * дерево давало 0.661 — крона ширша, ніж дерево високе, тобто рівно те, що
 * власник назвав «більше на кущ схоже».
 *
 * Раніше це число звалось `TREE_SCAFFOLD_REACH_SHARE` і жило в
 * `scaffold.ts`, бо тоді крону тримали САМЕ скелетні гілки. Ім'я було
 * помилкою вимірювання, а не скороченням: до скелетів воно стосунку не має,
 * це ширина крони, і тепер за ним іде й симуляція.
 */
export const TREE_CROWN_HALF_WIDTH_SHARE = 0.38;

/**
 * Частка ВИСОТИ КРОНИ, на якій крона найширша.
 *
 * Еталон оголошує це в частках висоти ДЕРЕВА — найширше на 0.60 при кроні
 * від 0.30 до 1.00. Тут перерахунок у частки самої крони від нашого
 * `TREE_CROWN_BOTTOM_SHARE`.
 *
 * Числа продубльовані, а не імпортовані, і це навмисно: еталон — скрипт на
 * Python, спільного джерела в них бути не може. Замість спільного файла
 * стоїть спільний ВИМІР: `crownProfile.test.ts` перевіряє, що цей закон
 * відтворює смуги силуету справжнього еталонного GLB.
 */
export const TREE_CROWN_WIDEST_AT = (0.60 - TREE_CROWN_BOTTOM_SHARE)
  / (1 - TREE_CROWN_BOTTOM_SHARE);

/**
 * Показник спаду.
 *
 * 1.7 робить спад ДОГОРИ крутішим за спад донизу — так і сходить листяна
 * крона: верхівка вужчає швидко, а під найширшим місцем ширина тримається.
 * Взято з еталона.
 */
export const TREE_CROWN_FALLOFF_EXPONENT = 1.7;

/**
 * Яку частку найбільшого радіуса крона тримає на цій частці СВОЄЇ висоти.
 *
 * `share` — 0 біля низу крони, 1 на маківці. Поза межами — нуль.
 */
export function treeCrownRadiusShare(share: number): number {
  if (!Number.isFinite(share) || share < 0 || share > 1) return 0;
  const span = Math.max(TREE_CROWN_WIDEST_AT, 1 - TREE_CROWN_WIDEST_AT);
  const away = Math.min(1, Math.abs(share - TREE_CROWN_WIDEST_AT) / span);
  return 1 - away ** TREE_CROWN_FALLOFF_EXPONENT;
}

/**
 * Яку частку висоти дерева крона тримає на цій частці висоти ДЕРЕВА.
 *
 * Це та сама огинальна, лише в координатах, у яких міряється силует, — щоб
 * порівняння з еталоном не вимагало перерахунку в голові.
 */
export function treeCrownHalfWidthAt(heightShare: number, narrowing = 1): number {
  if (heightShare < TREE_CROWN_BOTTOM_SHARE) return 0;
  if (heightShare > 1) return 0;
  const local = (heightShare - TREE_CROWN_BOTTOM_SHARE) / (1 - TREE_CROWN_BOTTOM_SHARE);
  return TREE_CROWN_HALF_WIDTH_SHARE * treeCrownRadiusShare(local) * narrowing;
}

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

/**
 * Підтягнути гілки симуляції всередину огинальної крони.
 *
 * НЕ МАСШТАБУВАННЯ, А СТЕЛЯ. Рівномірне стиснення (як `narrowing` у
 * `scaleTreeSkeletonToAge`) звузило б і найширше місце, тобто просто
 * зробило б стовп тоншим стовпом. Тут кожен вузол лишається де був, якщо
 * він усередині огинальної, і підтягується до неї, якщо виліз, — так само,
 * як жива гілка впирається в поверхню крони й далі не росте.
 *
 * СТОВБУР НЕДОТОРКАННИЙ: він вертикальний, від осі майже не відходить, а
 * нижче за низ крони стеля дорівнює нулю — без цього виняток обвалив би
 * дерево в лінію.
 *
 * Чіпає САМЕ ГОРИЗОНТАЛЬ: висота лишається законом віку, товщина — законом
 * трубки.
 *
 * ЗВУЖЕННЯ ЗА ВІКОМ передається сюди, бо стеля накладається ПІСЛЯ
 * `scaleTreeSkeletonToAge`, тобто на дерево, яке вже звужене: без нього
 * стеля на молодому дереві не в'язала б зовсім.
 */
export function applyTreeCrownEnvelope(
  skeleton: OrganicSkeletonState,
  narrowing = 1,
): OrganicSkeletonState {
  if (skeleton.nodes.length === 0) return skeleton;

  let top = Number.NEGATIVE_INFINITY;
  let bottom = Number.POSITIVE_INFINITY;
  for (const node of skeleton.nodes) {
    if (node.position.y > top) top = node.position.y;
    if (node.position.y < bottom) bottom = node.position.y;
  }
  const height = top - bottom;
  if (!Number.isFinite(height) || height <= 1e-6) return skeleton;

  let touched = false;
  const nodes: OrganicSkeletonNode[] = skeleton.nodes.map((node) => {
    if (node.branchId === ORGANIC_TRUNK_BRANCH_ID) return node;
    const radial = Math.hypot(node.position.x, node.position.z);
    if (radial <= 1e-9) return node;
    const heightShare = (node.position.y - bottom) / height;
    /*
     * НИЖЧЕ ЗА НИЗ КРОНИ СТЕЛЯ СХОДИТЬ ДО НУЛЯ, А НЕ ОБРИВАЄТЬСЯ.
     *
     * Обірвати її на нулі означало б утягнути в стовбур ті гілки, які
     * ПОЧИНАЮТЬСЯ під кроною, а закінчуються в ній, — а до сорокового року
     * саме такі гілки й тримають півкрони (див. `scaffold.ts`, підтримка
     * піддерева). Лінійний спад лишає стеблу дорогу вгору й водночас
     * підтягує до осі дрібні пагони, що росли б збоку від чистого стовбура.
     */
    const cap = height * (heightShare < TREE_CROWN_BOTTOM_SHARE
      ? treeCrownHalfWidthAt(TREE_CROWN_BOTTOM_SHARE, narrowing)
        * (heightShare / TREE_CROWN_BOTTOM_SHARE)
      : treeCrownHalfWidthAt(heightShare, narrowing));
    if (radial <= cap) return node;
    touched = true;
    const squeeze = cap / radial;
    return {
      ...node,
      position: {
        x: round6(node.position.x * squeeze),
        y: node.position.y,
        z: round6(node.position.z * squeeze),
      },
    };
  });

  return touched ? { ...skeleton, nodes } : skeleton;
}
