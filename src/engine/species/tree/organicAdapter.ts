import {
  DEFAULT_SELF_ORGANIZING_CONFIG,
  type OrganicAttractor,
  type OrganicSkeletonConfig,
  type SelfOrganizingConfig,
} from '../../labs/organic';
import { clamp01, round6, seededUnit } from './math';
import type {
  TreeBranchKind,
  TreeGrowthInstruction,
  TreeSpeciesBlueprint,
} from './types';

export interface TreeOrganicAdapterConfig {
  /** Bump whenever instruction-to-attractor placement changes. */
  rulesVersion: string;
  maxAttractors: number;
  maxNodes: number;
  maxGeneration: number;
  maxBranchSegments: number;
  /** Ширина віяла року по висоті крони, у її частках. */
  elevationFan: number;
  /** Ширина віяла року по радіусу крони, у його частках. */
  radialFan: number;
  /** Сила, яку дістає навіть найтихіший рік. */
  yearVigourBase: number;
  /** Скільки сили додає повністю прожитий рік понад базу. */
  yearVigourSpan: number;
  /** Де сила починає насичуватись. Нижче — росте як є. */
  yearVigourKnee: number;
  /** Асимптота сили: дерево наближається до неї, ніколи не досягаючи. */
  yearVigourMaximum: number;
}

export interface TreeOrganicFieldDiagnostics {
  instructionCount: number;
  attractorCount: number;
  annualAttractorCount: number;
  eventAttractorCount: number;
  truncatedInstructionIds: string[];
}

/**
 * Сила року — те, чим широта прожитого стає розміром дерева.
 *
 * Порода вже порахувала за рік `weight` (0.3..0.85 від наповненості року) і
 * `maturity` (наскільки рік завершений). Тут вони стають силою росту:
 *
 *   • базова сила — щоб навіть найтихіший рік лишив по собі пагін, а не нічого;
 *   • частка від `weight` — щоб широкий рік було ВИДНО на силуеті;
 *   • множення на `maturity` — щоб рік, який ще триває, не рахувався
 *     прожитим наперед. Дерево пари росте разом із ними, а не стрибає на
 *     повний рік уперед 26 грудня.
 */
function yearVigour(
  instruction: TreeGrowthInstruction,
  base: number,
  span: number,
): number {
  /*
   * `fill`, А НЕ `weight` — і це та різниця, через яку дерево не чуло модулів.
   *
   * `weight` — це ТОВЩИНА гілки, і в неї вбудовано поріг: `0.3 + 0.55 * fill`.
   * Поріг там доречний (навіть тихий рік має лишити видиму гілку), але як
   * міра прожитого `weight` непридатний: порожній рік до повного виходить
   * лише 1.51 раза, і скільки той діапазон не розтягуй множником, поріг їде
   * разом із ним. Виміряно розгорткою: за баз 7, 5, 3.5, 2.5 і 1.5
   * відношення висоти «шість модулів до одного» лишалось 1.12-1.16, зате
   * бюджет вилітав.
   *
   * `fill` порога не має — це чисті 0.6 широти плюс 0.4 глибини.
   */
  const lived = clamp01(instruction.fill);
  const ripeness = clamp01(instruction.maturity);
  return round6((base + span * lived) * (0.35 + 0.65 * ripeness));
}

/**
 * Насичує силу року, лишаючи її зростання строго монотонним.
 *
 * Щойно сила пішла від справжньої наповненості року, дерево почало
 * по-справжньому відповідати на життя пари — і найактивніші пари вибили
 * мобільну стелю трикутників: виміряно 22 045 при 18 000.
 *
 * Обрізати зверху не можна (див. коментар до `YEAR_VIGOUR_KNEE`), тож тут
 * коліно: нижче за нього нічого не змінюється, вище — залишок відстані до
 * максимуму з'їдається експонентою. Кожен наступний модуль додає менше за
 * попередній, але ЗАВЖДИ додає.
 */
function saturatedYearVigour(
  instruction: TreeGrowthInstruction,
  base: number,
  span: number,
  knee: number,
  maximum: number,
): number {
  const raw = yearVigour(instruction, base, span);
  if (raw <= knee) return round6(raw);
  const headroom = Math.max(1e-6, maximum - knee);
  return round6(knee + headroom * (1 - Math.exp(-(raw - knee) / headroom)));
}

export interface TreeOrganicField {
  organicTreeFieldVersion: 1;
  sourceSpeciesBlueprintVersion: `tree:${TreeSpeciesBlueprint['speciesBlueprintVersion']}`;
  speciesRulesVersion: string;
  adapterRulesVersion: string;
  seed: number;
  attractors: OrganicAttractor[];
  skeletonConfig: OrganicSkeletonConfig;
  /**
   * Налаштування самоорганізаційного росту — те, чим дерево тепер і росте.
   *
   * `skeletonConfig` поруч лишається навмисно: на ньому тримається просторова
   * колонізація, якою ще користуються лабораторні порівняння, і викидати її
   * тим самим рухом, яким замінюють закон, означало б позбутись єдиного, з
   * чим новий закон можна зіставити.
   */
  selfOrganizingConfig: SelfOrganizingConfig;
  diagnostics: TreeOrganicFieldDiagnostics;
}

/*
 * ВІЯЛО РОКУ ПО ВИСОТІ Й РАДІУСУ — І ЧОМУ ЙОГО НЕ БУЛО.
 *
 * Порода дає на рік ОДНУ висоту (`preferredElevation`) і ОДИН відступ від
 * стовбура (`radialBias`). Адаптер розкладав азимут віялом, а ці два числа
 * брав як є — тобто всі атрактори року сідали на одну висоту й один радіус.
 * П'ять атракторів року ставали дугою горизонтального кільця, а не об'ємом.
 *
 * ВИМІРЯНО на живому дереві (три роки, 12 атракторів):
 *
 *   рік 1 (elev 0.642): y 4.43..4.74, r 1.21..1.45
 *   рік 2 (elev 0.690): y 4.54..4.85, r 1.03..1.23
 *   рік 3 (elev 0.414): y 3.93..4.24, r 0.81..0.97
 *
 * Крона заявлена заввишки 2.20 (y 3.17..5.37) і завширшки 2.20. Атрактори
 * займали 0.70 висоти — 32% — і радіуси 0.82..1.44. Решта крони порожня, а
 * гілки ростуть лише туди, куди їх тягнуть атрактори: 9 гілок з 11 починались
 * у смузі y 4.49..4.62. Звідси й крона, зміряна на екрані: суцільний шар
 * заввишки 0.84 з 5-8.5% неба всередині — те, що правило крони називає
 * «броколі», і чого НЕ можна виправити ні щільністю листя, ні його розміром.
 *
 * ЩО ЗМІНЕНО. Висота й радіус розкладаються віялом ТАК САМО, ЯК АЗИМУТ ДОСІ:
 * кожен атрактор року дістає власну страту в смузі навколо наміру породи.
 * Намір року не зміщується — зміщується лише те, що всередині нього все
 * лежало в одній точці.
 *
 * ЧОМУ СТРАТИ, А НЕ ШИРШИЙ ВИПАДКОВИЙ РОЗКИД. Ширший розкид лише СПОДІВАЄТЬСЯ
 * заповнити смугу; страти її заповнюють. Порядок страт перемішано власним
 * ключем (`stratumOrder`) саме тому, що інакше висота йшла б рівно за
 * азимутом — і рік вийшов би не об'ємом, а нахиленою дугою, тобто тією ж
 * дугою збоку.
 *
 * ШИРИНА СМУГ — 0.7 висоти крони й 0.6 її радіуса, і це ВИМІРЯНО, а не
 * вибрано. Розгортка по живому дереву; рахувалась частка кластерів у
 * найбільшому ЗЛИТОМУ згустку, бо саме вона й означає «суцільний шар»:
 *
 *   віяло 0    : 11 гілок, 29 кластерів, найбільший згусток 41%, крона 0.84
 *   віяло 0.2  : 13 гілок, 35 кластерів, 34%, крона 0.92
 *   віяло 0.34 : 13 гілок, 35 кластерів, 37%, крона 1.13
 *   віяло 0.5  : 13 гілок, 34 кластери,  29%, крона 1.30
 *   віяло 0.7  : 13 гілок, 34 кластери,  21%, крона 1.66
 *   віяло 0.9  : 13 гілок, 34 кластери,  21%, крона 1.82
 *   віяло 1.2  : 13 гілок, 34 кластери,  21%, крона 1.66
 *
 * Далі 0.7 крива стає рівною — не тому, що ширше не пробували, а тому, що
 * ширше вже нікуди: віяло звужується до наявного місця (`usableHalfWidth`
 * нижче), тож більше число впирається в саму крону. 0.7 — коліно цієї
 * кривої, і брати більше означало б записати в закон число, яке нічого не
 * робить.
 *
 * ЩО ЦЕ НЕ ЗЛАМАЛО. Рік упізнається по азимуту, і азимут тут не чіпали:
 * центри трьох років лишились 2.68 / −1.34 / 1.48 радіана (було 2.65 / −1.30
 * / 1.25) при власному розкиді ±0.21 / ±0.44 / ±0.20. Роки стоять урізно як
 * стояли — розійшлось лише те, що всередині року лежало в одній точці.
 */
const ATTRACTOR_ELEVATION_FAN = 0.7;
const ATTRACTOR_RADIAL_FAN = 0.6;

/** Межі крони в її власних частках: нижче — під кроною, вище — над вершиною. */
const CROWN_ELEVATION_MIN = 0.04;
const CROWN_ELEVATION_MAX = 0.96;
/** Найменший відступ від стовбура: від'ємний радіус був би дзеркальним азимутом. */
const CROWN_RADIAL_MIN = 0.08;

/**
 * Півширина віяла, урізана до тієї відстані, яка в цього року справді є.
 *
 * ЧОМУ НЕ ПРОСТО ОБРІЗАТИ ПОТІМ. Обрізання не розсуває — воно ЗБИРАЄ: усі
 * атрактори, що вийшли за межу, лягають на саму межу й утворюють там рівно
 * той шар, заради розсування якого віяло й заведене. Тут смуга натомість
 * звужується до наявного місця, тож щільність лишається рівною скрізь.
 *
 * НАСЛІДОК, НАЗВАНИЙ ПРЯМО. Рік, чия висота (`preferredElevation`) стоїть під
 * самою стелею крони — а канал `achievement` дає до 0.95 — дістає вузьке
 * віяло й лишається майже пласким. Це не вада: крона має верх, і рік, що
 * дотягнувся до нього, більше вгору не піде. Сунути його центр донизу заради
 * ширшого віяла було б підміною наміру породи.
 */
function usableHalfWidth(center: number, fan: number, min: number, max: number): number {
  return Math.max(0, Math.min(fan / 2, center - min, max - center));
}

/*
 * СИЛА РОКУ — І ЧОМУ ТУТ БУЛО ЗАВУЗЬКО.
 *
 * Дерево росте від того, наскільки широко пара прожила рік: `weight`
 * інструкції — це `0.3 + 0.55 * fill`, а `fill` тримається на `yearActivity`,
 * тобто на 0.6 широти (скількох РІЗНИХ модулів рік торкнувся) плюс 0.4
 * глибини. Зв'язок з модулями, отже, справжній і з правильним знаменником:
 * `PORTAL_MODULES` — це рівно ті шість джерел, які рушій чує.
 *
 * АЛЕ ЙОГО НЕ БУЛО ВИДНО. Виміряно на парах, чиї роки торкались різної
 * кількості модулів, по 24 події на рік:
 *
 *   модулів 1 -> сила 12.7, висота 5.73, гілок  61
 *   модулів 3 -> сила 13.3, висота 5.88, гілок  79
 *   модулів 6 -> сила 14.1, висота 6.40, гілок 101
 *
 * Тобто вшестеро ширше життя давало на 11% більше сили. Причина — два
 * поверхи порогів, що множаться: `0.3 + 0.55 * fill` у породі (порожній рік
 * уже має 35% ваги повного) і база сили тут. За `base = 7, span = 9`
 * порожній рік до повного виходив лише 1.51 раза.
 *
 * Обидва числа нижче ВИМІРЯНО розгорткою, і саме на розмах, а не на око.
 */
const YEAR_VIGOUR_BASE = 7;
const YEAR_VIGOUR_SPAN = 9;
/*
 * М'ЯКЕ НАСИЧЕННЯ СИЛИ — і чому не проста стеля.
 *
 * Перша редакція просто обрізала силу зверху. Власні перевірки це й
 * спіймали: за стелі 14 шість модулів давали 15.0, обрізались до 14 — і
 * п'ятий модуль переставав щось додавати. Тобто жорстка стеля клепає рівно
 * той сигнал, який має берегти, і за 12 відношення гілок навіть інвертувалось
 * (0.80).
 *
 * Тут натомість коліно: до `KNEE` сила йде як є, вище — плавно підходить до
 * `MAX`, ніколи його не досягаючи. Кожен наступний модуль додає МЕНШЕ за
 * попередній, але додає — а це саме те, як росте живе дерево: у нього є зріст
 * виду, до якого воно наближається, а не стіна, в яку впирається.
 *
 * Числа виміряно на бюджеті, на 24 деревах активної пари (6 віків × 4 зерна)
 * за кроку стиснення стовбура 8 — і саме бюджет тут і в'яже:
 *
 *   без насичення: відповідь 1.26x, найгірше 18 437, порушень 1 з 24
 *   коліно 13.5/16: 1.23x, 18 185, порушень 1 з 24
 *   коліно 13/15.5: 1.20x, 17 731, порушень 0 з 24
 *   коліно 12/15.5: 1.17x, 17 784, порушень 0 з 24
 *
 * Тобто 1.26x у відповіді коштувало б одного дерева з двадцяти чотирьох на
 * 2.4% за мобільною стелею. Стеля — це обіцянка справжньому телефону, тож
 * узято найбільшу відповідь, яка ВМІЩУЄТЬСЯ, а не найбільшу можливу.
 */
const YEAR_VIGOUR_KNEE = 13;
const YEAR_VIGOUR_MAX = 15.5;

export const DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG: TreeOrganicAdapterConfig = {
  rulesVersion: 'tree-organic-adapter-v0.2.0',
  maxAttractors: 32,
  maxNodes: 320,
  maxGeneration: 3,
  maxBranchSegments: 10,
  elevationFan: ATTRACTOR_ELEVATION_FAN,
  radialFan: ATTRACTOR_RADIAL_FAN,
  yearVigourBase: YEAR_VIGOUR_BASE,
  yearVigourSpan: YEAR_VIGOUR_SPAN,
  yearVigourKnee: YEAR_VIGOUR_KNEE,
  yearVigourMaximum: YEAR_VIGOUR_MAX,
};


/**
 * Розкладає індекси інструкції по стратах у перемішаному порядку.
 *
 * Порядок детермінований від насіння інструкції: сортування за посоленим
 * ключем, а рівні ключі розводяться індексом, щоб порядок не залежав від
 * стабільності `Array.prototype.sort`.
 */
function stratumOrder(seed: number, key: string, count: number): number[] {
  const indices = Array.from({ length: count }, (_, index) => index);
  const keys = indices.map((index) => seededUnit(seed, `${key}:${index}`));
  indices.sort((left, right) => (keys[left]! - keys[right]!) || (left - right));
  const strata = new Array<number>(count).fill(0);
  indices.forEach((index, rank) => { strata[index] = rank; });
  return strata;
}

/** Зсув страти від середини смуги: `-0.5..0.5`, рівномірно по всій ширині. */
function fanOffset(strata: readonly number[], index: number, count: number): number {
  if (count < 2) return 0;
  return (strata[index]! + 0.5) / count - 0.5;
}

function branchSpread(kind: TreeBranchKind): number {
  if (kind === 'landmark') return 0.13;
  if (kind === 'explorer' || kind === 'ornamental') return 0.25;
  if (kind === 'support') return 0.18;
  return 0.21;
}

function instructionAttractors(
  blueprint: TreeSpeciesBlueprint,
  instruction: TreeGrowthInstruction,
  elevationFan: number,
  radialFan: number,
): OrganicAttractor[] {
  const result: OrganicAttractor[] = [];
  const spread = branchSpread(instruction.kind);
  const centerOffset = (instruction.attractorCount - 1) / 2;
  const count = instruction.attractorCount;
  const elevationStrata = stratumOrder(instruction.seed, `${instruction.id}:elevation-fan`, count);
  const radialStrata = stratumOrder(instruction.seed, `${instruction.id}:radial-fan`, count);

  for (let index = 0; index < instruction.attractorCount; index += 1) {
    const id = `${instruction.id}:attractor:${index}`;
    const angleJitter = (seededUnit(instruction.seed, `${id}:angle`) * 2 - 1) * 0.07;
    const angle = instruction.preferredAzimuthRad
      + (index - centerOffset) * spread
      + angleJitter;
    const radialJitter = 0.9 + seededUnit(instruction.seed, `${id}:radius`) * 0.18;
    const radialCenter = 0.26 + instruction.radialBias * 0.68;
    const radialFactor = Math.max(CROWN_RADIAL_MIN, radialCenter
      + fanOffset(radialStrata, index, count)
        * 2 * usableHalfWidth(radialCenter, radialFan, CROWN_RADIAL_MIN, Infinity));
    const radius = blueprint.structure.crownRadius * radialFactor * radialJitter;
    const heightJitter = (seededUnit(instruction.seed, `${id}:height`) * 2 - 1) * 0.06;
    const elevationCenter = 0.08 + instruction.preferredElevation * 0.84;
    // `heightJitter` може винести атрактор на волосину за смугу — межі
    // лишаються останнім запобіжником, але після звуження вони майже не в'яжуть.
    const elevationFactor = Math.min(CROWN_ELEVATION_MAX, Math.max(
      CROWN_ELEVATION_MIN,
      elevationCenter
        + fanOffset(elevationStrata, index, count)
          * 2 * usableHalfWidth(elevationCenter, elevationFan, CROWN_ELEVATION_MIN, CROWN_ELEVATION_MAX)
        + heightJitter,
    ));
    const y = blueprint.structure.trunkHeight
      + blueprint.structure.crownHeight * elevationFactor;

    result.push({
      id,
      sequence: instruction.sequence + index,
      position: {
        x: round6(Math.cos(angle) * radius),
        y: round6(y),
        z: round6(Math.sin(angle) * radius),
      },
      weight: round6(
        Math.max(0.05, instruction.weight * (0.88 + seededUnit(instruction.seed, `${id}:weight`) * 0.12)),
      ),
    });
  }

  return result;
}

/**
 * Transitional Tree Species -> Organic Growth Lab adapter.
 *
 * The species chooses stable branch intent. This adapter turns that intent into
 * attractor points; the append-only organic Growth Lab still chooses hosts,
 * paths, generations and node topology.
 */
export function treeToOrganicField(
  blueprint: TreeSpeciesBlueprint,
  config: TreeOrganicAdapterConfig = DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG,
): TreeOrganicField {
  const rulesVersion = config.rulesVersion.trim();
  if (!rulesVersion) throw new Error('Tree organic adapter requires a non-empty rulesVersion.');
  const maxAttractors = Math.max(0, Math.floor(config.maxAttractors));
  const attractors: OrganicAttractor[] = [];
  const truncatedInstructionIds: string[] = [];
  let annualAttractorCount = 0;
  let eventAttractorCount = 0;

  for (const instruction of blueprint.growth) {
    const candidates = instructionAttractors(
      blueprint,
      instruction,
      Math.max(0, config.elevationFan),
      Math.max(0, config.radialFan),
    );
    const remaining = maxAttractors - attractors.length;
    if (remaining <= 0) {
      truncatedInstructionIds.push(instruction.id);
      continue;
    }
    const accepted = candidates.slice(0, remaining);
    attractors.push(...accepted);
    if (accepted.length < candidates.length) truncatedInstructionIds.push(instruction.id);
    if (instruction.kind === 'annual-bough') annualAttractorCount += accepted.length;
    else eventAttractorCount += accepted.length;
  }

  const structure = blueprint.structure;
  return {
    organicTreeFieldVersion: 1,
    sourceSpeciesBlueprintVersion: `tree:${blueprint.speciesBlueprintVersion}`,
    speciesRulesVersion: blueprint.rulesVersion,
    adapterRulesVersion: rulesVersion,
    seed: structure.seed,
    attractors,
    skeletonConfig: {
      rulesVersion: `${rulesVersion}:${blueprint.rulesVersion}`,
      trunkHeight: structure.trunkHeight,
      trunkStep: structure.trunkStep,
      branchStep: structure.branchStep,
      influenceRadius: round6(structure.crownRadius * 0.96),
      killRadius: round6(structure.branchStep * 0.68),
      maxBranchSegments: Math.max(1, Math.floor(config.maxBranchSegments)),
      maxGeneration: Math.max(1, Math.floor(config.maxGeneration)),
      maxNodes: Math.max(16, Math.floor(config.maxNodes)),
      crownRadius: structure.crownRadius,
      crownHeight: structure.crownHeight,
      upwardBias: structure.upwardBias,
      directionMemory: structure.directionMemory,
      lateralJitter: structure.lateralJitter,
      baseRadius: structure.baseRadius,
      radiusDecay: structure.radiusDecay,
    },
    selfOrganizingConfig: {
      ...DEFAULT_SELF_ORGANIZING_CONFIG,
      rulesVersion: `${DEFAULT_SELF_ORGANIZING_CONFIG.rulesVersion}:${blueprint.rulesVersion}`,
      // Один цикл росту — один рік стосунків.
      cycles: blueprint.growth.length,
      vigourByCycle: blueprint.growth.map((instruction) => saturatedYearVigour(
        instruction,
        config.yearVigourBase,
        config.yearVigourSpan,
        config.yearVigourKnee,
        config.yearVigourMaximum,
      )),
      // Верхівкове панування — риса пари, а не константа: дерево тієї, чиє
      // життя ширше, розкидається вільніше, ніж тягнеться вгору.
      apicalControl: round6(clamp01(0.72 - 0.16 * clamp01(structure.upwardBias * 2))),
    },
    diagnostics: {
      instructionCount: blueprint.growth.length,
      attractorCount: attractors.length,
      annualAttractorCount,
      eventAttractorCount,
      truncatedInstructionIds,
    },
  };
}
