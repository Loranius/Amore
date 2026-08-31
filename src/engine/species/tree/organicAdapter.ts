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
const YEAR_VIGOUR_BASE = 7;
const YEAR_VIGOUR_SPAN = 9;

function yearVigour(instruction: TreeGrowthInstruction): number {
  const breadth = clamp01(instruction.weight);
  const ripeness = clamp01(instruction.maturity);
  return round6((YEAR_VIGOUR_BASE + YEAR_VIGOUR_SPAN * breadth) * (0.35 + 0.65 * ripeness));
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

export const DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG: TreeOrganicAdapterConfig = {
  rulesVersion: 'tree-organic-adapter-v0.2.0',
  maxAttractors: 32,
  maxNodes: 320,
  maxGeneration: 3,
  maxBranchSegments: 10,
  elevationFan: ATTRACTOR_ELEVATION_FAN,
  radialFan: ATTRACTOR_RADIAL_FAN,
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
      vigourByCycle: blueprint.growth.map(yearVigour),
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
