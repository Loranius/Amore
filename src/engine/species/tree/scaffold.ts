// ============================================================
// Гілки-скелети: те, що робить крону кроною, і чого модель не давала.
// ------------------------------------------------------------
// ВЛАСНИК, дослівно: «ширину крони, яка далі гуляє, і гілки-скелети —
// додавай, якщо їх немає, а їх немає, додавай».
//
// ЧОГО НЕ БУЛО. Виміряно на дереві будь-якого віку: медіана довжини гілки
// 0.31 одиниці, тобто 2-4% висоти, і так на КОЖНОМУ віці — від третього року
// до сорокового. Дерево складалось зі стовбура й ста двадцяти однакових
// прутиків. Товстих бічних гілок, на яких у живого дерева тримається крона,
// у моделі не було жодної.
//
// ЧОМУ САМООРГАНІЗАЦІЯ ЇХ НЕ ДАЄ, і чому це не лагодиться числом. Річна сила
// насичена (`YEAR_VIGOUR_MAX`), а гілок із роками більшає, тож на кожну
// припадає дедалі менше — і бічний пагін не набирає навіть `minimumVigour`
// на одне міжвузля. Перевірено прямо: на порожній історії рік дає 9.7 за
// коліна 13, тобто стеля не в'яже взагалі, і розгортка 15.5 / 22 / 30 / 42
// дає ПОБАЙТОВО однакове дерево. Ручки, якою це вмикається, немає.
//
// ЩО ЦЕ ЛАГОДИТЬ ЗАРАЗ, окрім самих гілок. Ширина крони гуляла (падінь 16-21
// із 39 річних переходів, найгірше ×0.41) саме тому, що її задавала одна
// випадкова нижня гілочка, яка цього року пережила скидання, а наступного ні.
// Коли крону тримають скелетні гілки, чия довжина йде за законом віку,
// ширина стає такою ж монотонною, як і висота: гуляють тільки прутики
// ВСЕРЕДИНІ огинальної, а не сама огинальна.
//
// ЧЕСНЕ СПРОЩЕННЯ, яке тут є. Скелетна гілка сидить на СТАЛІЙ ЧАСТЦІ висоти
// дерева, тобто разом із деревом «їде» вгору. У живого дерева гілка не
// повзе по стовбуру — крона піднімається тим, що нижні гілки ВІДМИРАЮТЬ.
// Змоделювати відмирання означало б повернути ту саму невизначеність, від
// якої тут і йдеться, і разом із нею — «спідницю» біля землі (ADR-0091 §2).
// Взято силует, а не історію окремої гілки.
// ============================================================
import type { OrganicSkeletonNode, OrganicSkeletonState } from '../../labs/organic';
import { ORGANIC_TRUNK_BRANCH_ID } from '../../labs/organic';
import { treeAgeProgress } from './growthLaw';
import { seededUnit } from './math';

/**
 * Скільки скелетних гілок може бути в дорослого дерева.
 *
 * Сім — це верх того, що дає живе дерево з одним лідером: у садівництві
 * центральний провідник тримає 5-8 основних гілок, вище — уже не скелет, а
 * крона другого порядку. Число водночас є межею БЮДЖЕТУ: кожна гілка це
 * близько восьми вузлів меша плюс листя на них.
 */
export const MAX_SCAFFOLD_BRANCHES = 7;

/**
 * Вік, коли з'являється перша скелетна гілка.
 *
 * Власникова послідовність: «1 рік — росток; 2 рік вже видно маленький
 * стовбур; ТРЕТІЙ рік є гілки». До третього року дерево лишається пагоном.
 */
export const SCAFFOLD_FIRST_YEAR = 3;

/** Найнижча й найвища частка висоти, на якій сидить скелетна гілка. */
const CROWN_BASE_SHARE = 0.35;
const CROWN_TOP_SHARE = 0.88;

/*
 * ВИЛІТ, А НЕ ДОВЖИНА — і це різниця, яку показав вимір.
 *
 * Перша редакція задавала гілці ДОВЖИНУ й кут, а виліт лишала наслідком. На
 * знімку крона від цього не змінилась узагалі: ширина по роках лишилась
 * 0.99 / 1.18 / 1.65 / 1.80 / 1.53 / 2.49 / 4.83, тобто рівно та сама, що й
 * без скелетних гілок. Причина арифметична: гілка, яка виходить під 50° і
 * підводиться до 27°, віддає по горизонталі лише 46% своєї довжини, тож
 * навіть найдовша скелетна гілка не діставала далі за випадкові прутики.
 *
 * Тому тут задається САМЕ ВИЛІТ — половина ширини крони як частка висоти
 * дерева, — а довжина гілки виходить із нього. Це не зручність запису: поки
 * ширину задавав максимум по вершинах, вона гуляла разом зі скиданням
 * (падінь 16-21 із 39 річних переходів, найгірше ×0.41). Коли її задає
 * закон, вона монотонна за побудовою, а прутики гуляють УСЕРЕДИНІ огинальної.
 *
 * 0.45 -> 0.62: молоде дерево вужче за доросле і як частка теж, а в
 * абсолютних одиницях виліт росте з 0.50 на третьому році до 3.29 на
 * сороковому — бо росте й сама висота.
 */
const REACH_SHARE_YOUNG = 0.45;
const REACH_SHARE_MATURE = 0.62;

/**
 * Кут ВІДХОДУ від вертикалі: нижні гілки розлогіші, верхні тягнуться вгору.
 *
 * Це кут біля стовбура; далі гілка лягає вбік (див. `bend` нижче), тож
 * кінчик нижньої гілки виходить майже горизонтальним, як у старого дерева.
 */
const ELEVATION_LOW_RAD = 0.95;
const ELEVATION_HIGH_RAD = 0.62;

/*
 * АЗИМУТИ РІВНОМІРНІ, А НЕ ЗА ЗОЛОТИМ КУТОМ — і це вимога ЧУЖОГО контракту,
 * а не смак.
 *
 * Спершу гілки розставлялись золотим кутом (137.5°), як бруньки в живої
 * рослини. На трьох гілках це дає 0°, 137°, 275°, і «Tree Crown Silhouette
 * multi-view acceptance» падав на одинадцяти роках із сорока в пари
 * «couple:b»: `frontLeafCount` дорівнював НУЛЮ — з деяких напрямків попереду
 * не було жодного листка. Півпростір ловить усе, що має додатну проєкцію на
 * напрямок погляду, тож три промені в одній половині кола лишають протилежну
 * половину порожньою, хай як гарно вони розкладені між собою.
 *
 * Рівномірне коло цього не допускає за побудовою. Ціна — гілки більше не
 * ростуть по одній: усі сім є від третього року, а крона наповнюється
 * ДОВЖИНОЮ, а не кількістю. Так воно й у природі: дерево не приколює нову
 * гілку щороку, воно нарощує ті, що заклало молодим.
 */

/** Вузлів на гілку. Менше — гілка ламається кутами на згині. */
/** Вузлів на гілку. Менше — гілка ламається кутами на згині. */
const NODES_PER_SCAFFOLD = 8;

/** Частка радіуса стовбура в місці кріплення, яку бере гілка. */
const COLLAR_SHARE = 0.55;

/*
 * СКІЛЬКИ НАЙТОНШИХ ГІЛОЧОК ЗАМІЩАЮТЬ СКЕЛЕТНІ ГІЛКИ З ПАГОНАМИ — п'ятдесят.
 *
 * Число не вибране, а виміряне проти БАЗОВОЇ ЛІНІЇ на дев'яти віках × чотири
 * посіви активної пари, обидва рівні деталізації:
 *
 *   без скелетних гілок узагалі:  medium 19 591, порушень 1 з 36
 *   відкинуто 20:  medium 21 432 (4 з 36),  high 25 021 (1 з 36)
 *   відкинуто 35:  medium 20 558 (2 з 36),  high 23 898 (0 з 36)
 *   відкинуто 50:  medium 19 778 (1 з 36),  high 23 824 (0 з 36)   <-
 *   відкинуто 65:  medium 18 998 (1 з 36),  high 23 764, листя 504
 *
 * На п'ятдесяти дерево дістає сім гілок і двадцять вісім пагонів, лишаючись
 * рівно там, де було без них: одне порушення з тридцяти шести, і воно —
 * чуже (див. нижче). Далі платить тільки листя (593 -> 504), а виграш у
 * трикутниках дрібніє.
 *
 * ЧИМ САМЕ ПЛАТИМО. Середнє листя падає з 713 на 593. Це не втрата крони:
 * виміряно, що 17-41% листя сиділо ГЛИБШЕ за 0.6 оболонки крони, тобто там,
 * де його ніхто не бачить, а 56 комірок оболонки зі 128 стояли порожні.
 * Відкидається саме внутрішня дрібнота, а листя переїжджає на пагони, які
 * тримають оболонку.
 *
 * ПРО ЧУЖЕ ПОРУШЕННЯ. Воно було ДО цих змін: сорокарічна пара, що жила всіма
 * модулями, дає 19 591 при стелі 18 000 і без жодної скелетної гілки.
 * Тутешній тест її не бачив, бо перевіряв інші віки. Це окрема вада
 * (ADR-0093 §6), і закривати її треба перерозподілом бюджету між листям,
 * коренями й деревиною.
 */
const PRUNED_TWIGS_PER_SCAFFOLD_SET = 50;

/** Частка радіуса стовбура в місці кріплення, яку бере гілка. */

/*
 * БІЧНІ ПАГОНИ НА СКЕЛЕТНИХ ГІЛКАХ — по чотири на гілку.
 *
 * Сім гілок тримають оболонку крони, а оболонка ця велика: розклавши крону
 * на 8 поверхів × 16 секторів, виміряно на дереві лабораторії, що
 * **56 комірок зі 128 порожні** на сорока роках і 34 зі 128 на десяти. Тобто
 * майже половина видимої поверхні крони не мала ЖОДНОГО листка, і крона
 * читалась не кроною, а колоною з сімома спицями.
 *
 * Причина арифметична: 7 гілок × 6 згустків — це 42 точки кріплення листя на
 * 128 комірок оболонки. Решта листя (близько 580) сидить на ста трьох
 * прутиках симуляції в СЕРЕДИНІ крони, де його не видно: 17-41% усього листя
 * лежить глибше за 0.6 оболонки.
 *
 * Пагони множать точки кріплення саме там, де оболонка. Це те, що роблять
 * усі п'ять зразків власника («cards fanned off branch tips»), і те, чого в
 * моделі не було: самоорганізація дає прутики біля стовбура, а не на кінцях
 * скелетних гілок.
 *
 * ЩО СПЕРШУ НЕ СПРАЦЮВАЛО. Я спробував просто відсунути листя скелетної
 * гілки далі від стовбура (`primaryTerminalStart` 0.42 замість 0.22). Стало
 * ГІРШЕ: порожніх комірок 56 -> 66, бо листя збилось до кінчиків і оголило
 * середину гілки. Зміну відкинуто.
 */
const SIDE_TWIGS_PER_SCAFFOLD = 4;

/** Де на скелетній гілці починаються пагони — на її зовнішній половині. */
const SIDE_TWIG_FIRST_SHARE = 0.45;

/** Довжина пагона як частка ЗАЛИШКУ скелетної гілки від місця виходу. */
const SIDE_TWIG_LENGTH_SHARE = 0.55;

/** Кут пагона від напрямку материнської гілки. */
const SIDE_TWIG_ANGLE_RAD = 0.8;

/** Вузлів на пагін: він короткий, і дуга йому не потрібна. */
const NODES_PER_SIDE_TWIG = 3;

/** Частка від власної основи, яку гілка лишає кінчику. */
const TIP_SHARE = 0.18;

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Скільки скелетних гілок має дерево цього віку.
 *
 * Тільки зростає. Це не осторога, а вимога догми (`PRODUCT.md` §6): гілка,
 * яка вже є, не може зникнути наступного року, бо тоді дерево поменшає.
 */
export function scaffoldCountFor(daysTogether: number): number {
  const years = Math.max(0, daysTogether) / 365.2425;
  return years < SCAFFOLD_FIRST_YEAR ? 0 : MAX_SCAFFOLD_BRANCHES;
}

/**
 * Частка висоти, на якій сидить гілка з цим номером.
 *
 * Прив'язана до НОМЕРА, а не до поточної кількості, і це головне: коли з
 * віком з'являється восьма гілка, попередні сім лишаються там, де були.
 * Інакше кожен новий рік перетасовував би всю крону.
 */
function heightShareFor(index: number): number {
  const span = Math.max(1, MAX_SCAFFOLD_BRANCHES - 1);
  return CROWN_BASE_SHARE + (CROWN_TOP_SHARE - CROWN_BASE_SHARE) * (index / span);
}

/** Виліт гілки: росте з віком дерева й зменшується догори по кроні. */
function reachShareFor(index: number, maturity: number): number {
  const span = Math.max(1, MAX_SCAFFOLD_BRANCHES - 1);
  const byAge = REACH_SHARE_YOUNG + (REACH_SHARE_MATURE - REACH_SHARE_YOUNG) * maturity;
  // Крона найширша нижче середини, а не на маківці.
  return byAge * (1 - 0.45 * (index / span));
}

/**
 * Дотична дуги у вузлі — різниця сусідніх зміщень, зведена до одиничної.
 *
 * Для першого вузла береться напрямок від самого кріплення, бо попереднього
 * зміщення немає: гілка виходить зі стовбура саме туди.
 */
function tangentAt(
  step: number,
  offsets: readonly { horizontal: number; vertical: number }[],
  azimuth: number,
  stretch: number,
  riseScale: number,
): { x: number; y: number; z: number } {
  const here = offsets[step - 1]!;
  const before = step >= 2 ? offsets[step - 2]! : { horizontal: 0, vertical: 0 };
  const horizontal = (here.horizontal - before.horizontal) * stretch;
  const vertical = (here.vertical - before.vertical) * stretch * riseScale;
  const norm = Math.hypot(horizontal, vertical);
  if (norm <= 1e-9) return { x: 0, y: 1, z: 0 };
  return {
    x: round6((Math.cos(azimuth) * horizontal) / norm),
    y: round6(vertical / norm),
    z: round6((Math.sin(azimuth) * horizontal) / norm),
  };
}

/**
 * Відкидає `count` найтонших гілок симуляції — по найбільшому радіусу гілки.
 *
 * Стовбур недоторканний за побудовою, скелетні гілки додаються ПІСЛЯ, тож
 * під ніж потрапляє тільки дрібнота. Порядок детермінований: рівні радіуси
 * розводяться `branchId`.
 */
export function pruneThinTwigsForScaffolds(
  skeleton: OrganicSkeletonState,
  daysTogether: number,
): OrganicSkeletonState {
  /*
   * ОБРІЗАЄТЬСЯ ДО МАСШТАБУВАННЯ, А НЕ ПІСЛЯ — і це не порядок заради
   * охайності, а виправлена вада.
   *
   * Спершу я обрізав прутики всередині `addTreeScaffoldBranches`, тобто вже
   * після того, як `scaleTreeSkeletonToAge` вивів дерево на висоту закону.
   * Найтонші гілочки — це верхівкові пагони останніх років, тож обрізання
   * знімало САМУ ВЕРХІВКУ, і дерево ставало нижчим за власний закон:
   * виміряно 3.08 при цілі 4.42 на 34 роках і 3.35 при 4.91 на сорока.
   * Тест догми «стає вищим щороку» це спіймав — 40 років вийшли нижчими за
   * 30.
   *
   * Тепер обрізання — окремий крок ПЕРЕД масштабуванням: спершу вирішуємо,
   * які гілки існують, і лише потім доводимо результат до висоти закону.
   */
  const count = scaffoldCountFor(daysTogether) > 0 ? PRUNED_TWIGS_PER_SCAFFOLD_SET : 0;
  if (count <= 0) return skeleton;
  const thickest = new Map<string, number>();
  for (const node of skeleton.nodes) {
    if (node.branchId === ORGANIC_TRUNK_BRANCH_ID) continue;
    thickest.set(node.branchId, Math.max(thickest.get(node.branchId) ?? 0, node.radius));
  }
  const doomed = new Set(
    [...thickest.entries()]
      .sort(([leftId, left], [rightId, right]) => left - right || leftId.localeCompare(rightId))
      .slice(0, count)
      .map(([branchId]) => branchId),
  );
  if (doomed.size === 0) return skeleton;
  /*
   * Гілка, що росла З відкинутої, лишилась би висіти в повітрі, тож
   * відкидається все її піддерево. Обхід іде по `parentId`, а не по
   * `branchId`, бо саме він і тримає зв'язність.
   */
  const byId = new Map(skeleton.nodes.map((node) => [node.id, node]));
  const alive = (node: OrganicSkeletonNode): boolean => {
    let cursor: OrganicSkeletonNode | undefined = node;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.id)) {
      if (doomed.has(cursor.branchId)) return false;
      seen.add(cursor.id);
      cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    return true;
  };
  return { ...skeleton, nodes: skeleton.nodes.filter(alive) };
}

interface TrunkAnchor {
  node: OrganicSkeletonNode;
  height: number;
}

/** Вузол стовбура, найближчий до заданої висоти. */
function anchorAt(trunk: readonly OrganicSkeletonNode[], targetY: number): TrunkAnchor | null {
  let best: OrganicSkeletonNode | null = null;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const node of trunk) {
    const gap = Math.abs(node.position.y - targetY);
    if (gap < bestGap) { bestGap = gap; best = node; }
  }
  return best ? { node: best, height: best.position.y } : null;
}

/**
 * Додає скелетні гілки до готового скелета.
 *
 * Викликається ПІСЛЯ масштабування за віком (`scaleTreeSkeletonToAge`), щоб
 * усі довжини рахувались від тієї висоти, яку дерево справді має, а не від
 * тієї, яку випадково видала симуляція.
 */
export function addTreeScaffoldBranches(
  skeleton: OrganicSkeletonState,
  daysTogether: number,
  artifactSeed: number,
): OrganicSkeletonState {
  const count = scaffoldCountFor(daysTogether);
  if (count <= 0) return skeleton;

  const trunk = skeleton.nodes.filter((node) => node.branchId === ORGANIC_TRUNK_BRANCH_ID);
  if (trunk.length < 2) return skeleton;

  let top = Number.NEGATIVE_INFINITY;
  let bottom = Number.POSITIVE_INFINITY;
  for (const node of skeleton.nodes) {
    if (node.position.y > top) top = node.position.y;
    if (node.position.y < bottom) bottom = node.position.y;
  }
  const height = top - bottom;
  if (!Number.isFinite(height) || height <= 1e-6) return skeleton;

  const maturity = treeAgeProgress(daysTogether);
  const azimuthSeed = seededUnit(artifactSeed, 'scaffold:azimuth') * Math.PI * 2;
  /*
   * ПОРЯДКОВИЙ НОМЕР СТАВИТЬ СКЕЛЕТИ ВІДРАЗУ ЗА СТОВБУРОМ, а не в кінець.
   *
   * `branchOrder` сортує гілки за номером першого вузла, а листя обходить
   * гілки саме в цьому порядку й обрізає на бюджеті ПІЗНІШІ. Спершу я давав
   * скелетам номери понад усіма — тобто ставив у самий хвіст, — і бюджет
   * з'їдали прутики симуляції. Видно це було не в числі листя (720, стеля),
   * а в тому, ЯК ДАЛЕКО воно сягало: на 36-му році найдальший листок стояв
   * на 1.04 при вильоті скелетних гілок близько трьох. Крона була з
   * прутиків, а скелети — голі палиці всередині неї.
   *
   * Тепер номери йдуть одразу по стовбурі. Збіги з номерами симуляції
   * можливі й нешкідливі: `branchOrder` розводить рівні номери за `branchId`.
   */
  let sequence = trunk.reduce((max, node) => Math.max(max, node.sequence), 0);

  const added: OrganicSkeletonNode[] = [];
  const scaffoldTips: {
    branchId: string; azimuth: number; reach: number; nodes: OrganicSkeletonNode[];
  }[] = [];
  for (let index = 0; index < count; index += 1) {
    const anchor = anchorAt(trunk, bottom + height * heightShareFor(index));
    if (!anchor) continue;

    const span = Math.max(1, MAX_SCAFFOLD_BRANCHES - 1);
    const reach = height * reachShareFor(index, maturity);
    if (reach <= 1e-6) continue;

    const azimuth = azimuthSeed + (index / count) * Math.PI * 2
      // Живе дерево не розкладає гілки циркулем; зсув сталий для пари й
      // менший за половину проміжку, тож рівномірності не ламає.
      + (seededUnit(artifactSeed, `scaffold:jitter:${index}`) - 0.5) * (Math.PI / count);
    const elevation = ELEVATION_LOW_RAD
      + (ELEVATION_HIGH_RAD - ELEVATION_LOW_RAD) * (index / span);

    const branchId = `tree:scaffold:${index}`;
    const baseRadius = Math.max(1e-4, anchor.node.radius * COLLAR_SHARE);
    let parentId = anchor.node.id;

    /*
     * Дуга інтегрується кроками, а не ставиться формулою від частки, і це
     * теж наслідок першої помилки: за формулою «кінчик на відстані
     * довжина×частка в напрямку поточного кута» гілка виходила не дугою, а
     * спіраллю, і кінчик опинявся значно вертикальніше, ніж задумано.
     *
     * Гілка ВИГИНАЄТЬСЯ вгору: біля стовбура розлога, до кінчика
     * підводиться. Пряма палиця під кутом — найпомітніша ознака
     * згенерованого дерева.
     */
    const offsets: { horizontal: number; vertical: number }[] = [];
    let horizontalRun = 0;
    let verticalRun = 0;
    for (let step = 1; step <= NODES_PER_SCAFFOLD; step += 1) {
      const along = step / NODES_PER_SCAFFOLD;
      /*
       * Гілка до кінчика РОЗКЛАДАЄТЬСЯ, а не підводиться.
       *
       * Спершу тут стояло `elevation * (1 - 0.45 * along²)`, тобто кут від
       * вертикалі до кінця ЗМЕНШУВАВСЯ. На знімку сорокарічного дерева це
       * дало сім прямих спиць, що стирчали вгору з куща, — силует антени, а
       * не крони. У живого дерева навпаки: гілка виходить під кутом і далі
       * лягає вбік під власною вагою, тому стара крона й читається шатром.
       */
      const bend = Math.min(1.45, elevation * (1 + 0.55 * along * along));
      horizontalRun += Math.sin(bend);
      verticalRun += Math.cos(bend);
      offsets.push({ horizontal: horizontalRun, vertical: verticalRun });
    }
    // Дуга розтягується так, щоб кінчик став РІВНО на заданий виліт.
    const tip = offsets[offsets.length - 1]!;
    if (tip.horizontal <= 1e-6) continue;
    const stretch = reach / tip.horizontal;

    /*
     * СКЕЛЕТНА ГІЛКА НЕ ВИЛАЗИТЬ НАД ВЕРХІВКОЮ — і це не косметика.
     *
     * Виміряно на першому робочому варіанті: коли гілки почали діставати
     * далеко, вони почали й підніматись вище за стовбур, і висота меша
     * поїхала за ними — 4.26 на двадцятому році, 4.54 на тридцятому, 7.07 на
     * сороковому. Тобто щойно полагоджена монотонність висоти (закон віку,
     * ADR-0092) ламалась тим самим виправленням, що лагодило ширину.
     *
     * Тому стискається САМЕ ПІДЙОМ, а не виліт: виліт — це закон крони,
     * а підйом гілки й у природі тим менший, чим вище вона сидить.
     */
    const headroom = Math.max(0, (top - anchor.height) * 0.92);
    const rise = tip.vertical * stretch;
    const riseScale = rise > headroom && rise > 1e-6 ? headroom / rise : 1;

    for (let step = 1; step <= NODES_PER_SCAFFOLD; step += 1) {
      const along = step / NODES_PER_SCAFFOLD;
      const offset = offsets[step - 1]!;
      const radius = baseRadius * (1 - (1 - TIP_SHARE) * along);
      sequence += 1;
      added.push({
        id: `${branchId}:${step}`,
        branchId,
        parentId,
        attractorId: null,
        sequence,
        generation: 1,
        position: {
          x: round6(anchor.node.position.x + Math.cos(azimuth) * offset.horizontal * stretch),
          y: round6(anchor.height + offset.vertical * stretch * riseScale),
          z: round6(anchor.node.position.z + Math.sin(azimuth) * offset.horizontal * stretch),
        },
        /*
         * ДОТИЧНА, а не сталий напрямок гілки — і це спіймав ЧУЖИЙ контракт.
         *
         * Спершу я дав усім вузлам гілки один вектор (її початковий кут).
         * Наслідок був не в геометрії, а в ЛИСТІ: кадри кривих беруть із
         * напрямку нормаль, листя бере орієнтацію з нормалі, тож усе листя
         * гілки дивилось в один бік — і «Tree Crown Silhouette preservation
         * or multi-view acceptance» падав на одинадцяти роках із сорока в
         * пари «couple:b»: з деяких напрямків крона ставала лезами.
         *
         * Дотична змінюється разом із дугою, як і має, і листя разом із нею.
         */
        direction: tangentAt(step, offsets, azimuth, stretch, riseScale),
        radius: round6(Math.max(1e-4, radius)),
        terminal: step === NODES_PER_SCAFFOLD,
      });
      parentId = `${branchId}:${step}`;
    }
    scaffoldTips.push({
      branchId,
      azimuth,
      reach,
      nodes: added.filter((node) => node.branchId === branchId),
    });
  }

  /*
   * Пагони будуються ПІСЛЯ всіх скелетних гілок, окремим проходом, щоб їхні
   * порядкові номери йшли слідом за материнськими: листя обходить гілки в
   * цьому порядку, і пагін мусить дістати свою чергу разом зі своєю гілкою,
   * а не після всієї дрібноти симуляції.
   */
  const twigs: OrganicSkeletonNode[] = [];
  for (const scaffold of scaffoldTips) {
    for (let index = 0; index < SIDE_TWIGS_PER_SCAFFOLD; index += 1) {
      const share = SIDE_TWIG_FIRST_SHARE
        + ((index + 0.5) / SIDE_TWIGS_PER_SCAFFOLD) * (1 - SIDE_TWIG_FIRST_SHARE);
      const host = scaffold.nodes[
        Math.min(scaffold.nodes.length - 1, Math.round(share * scaffold.nodes.length) - 1)
      ];
      if (!host) continue;

      const twigId = `${scaffold.branchId}:twig:${index}`;
      // Пагони чергують боки й піднімаються — так галузиться жива гілка.
      const side = index % 2 === 0 ? 1 : -1;
      const spin = scaffold.azimuth + side * SIDE_TWIG_ANGLE_RAD
        + (seededUnit(artifactSeed, `${twigId}:spin`) - 0.5) * 0.6;
      const lift = 0.35 + seededUnit(artifactSeed, `${twigId}:lift`) * 0.5;
      const length = scaffold.reach * (1 - share) * SIDE_TWIG_LENGTH_SHARE;
      if (length <= 1e-6) continue;

      const horizontal = Math.cos(lift);
      /*
       * ПАГІН ТЕЖ НЕ ВИЛАЗИТЬ НАД ВЕРХІВКОЮ.
       *
       * Ту саму помилку я вже робив зі скелетними гілками, і вона тут
       * повторилась дослівно: пагони підіймаються під кутом, найвищі з них
       * пробивали верхівку, і тест догми «стає вищим щороку» впав. Підйом
       * стискається, горизонталь лишається — виліт це крона, а підйом ні.
       */
      const rise = Math.sin(lift) * length;
      const headroom = Math.max(0, (top - host.position.y) * 0.92);
      const riseScale = rise > headroom && rise > 1e-6 ? headroom / rise : 1;
      const step = {
        x: Math.cos(spin) * horizontal,
        y: Math.sin(lift) * riseScale,
        z: Math.sin(spin) * horizontal,
      };
      let parent = host.id;
      for (let node = 1; node <= NODES_PER_SIDE_TWIG; node += 1) {
        const along = node / NODES_PER_SIDE_TWIG;
        sequence += 1;
        twigs.push({
          id: `${twigId}:${node}`,
          branchId: twigId,
          parentId: parent,
          attractorId: null,
          sequence,
          generation: 2,
          position: {
            x: round6(host.position.x + step.x * length * along),
            y: round6(host.position.y + step.y * length * along),
            z: round6(host.position.z + step.z * length * along),
          },
          direction: { x: round6(step.x), y: round6(step.y), z: round6(step.z) },
          radius: round6(Math.max(1e-4, host.radius * (0.42 - 0.3 * along))),
          terminal: node === NODES_PER_SIDE_TWIG,
        });
        parent = `${twigId}:${node}`;
      }
    }
  }
  added.push(...twigs);

  if (added.length === 0) return skeleton;

  return { ...skeleton, nodes: [...skeleton.nodes, ...added] };
}
