import { DEFAULT_TREE_GROUND_DETAIL_CONFIG } from '../groundDetail';
import type { OrganicMeshLod } from '../labs/organic';
import type {
  TreeProductionMobileBudget,
  TreeProductionPhaseId,
} from './types';

export const TREE_PRODUCTION_ACCEPTANCE_RULES_VERSION = 'tree-production-acceptance-v1.2.0';

export const TREE_PRODUCTION_PIPELINE_PHASES: readonly TreeProductionPhaseId[] = [
  'tree-species',
  'organic-skeleton',
  'curve-frames',
  'tree-composition',
  'root-architecture',
  'ground-contact',
  'terrain-binding',
  'root-geometry',
  'foliage-architecture',
  'leaf-geometry',
  'tree-material',
  'canopy-depth',
  'canopy-light',
  'phenology',
  'leaf-orientation',
  'crown-silhouette',
  'soil-surface',
  'bark-surface',
  'ground-detail',
  'tree-life',
];

export const TREE_PRODUCTION_MOBILE_BUDGET: TreeProductionMobileBudget = {
  maxVertices: 12_000,
  maxTriangles: 18_000,
  maxBuildMs: 220,
  maxDrawCalls: 4,
  maxMaterials: 3,
};

export const TREE_PRODUCTION_HIGH_DETAIL_BUDGET: TreeProductionMobileBudget = {
  ...TREE_PRODUCTION_MOBILE_BUDGET,
  maxTriangles: 24_000,
};

/**
 * Скільки трикутників лишається СТОВБУРУ після всіх решти.
 *
 * ЧОМУ ЦЕ ІСНУЄ. Листя, корені й дрібнота на землі мають кожне свою стелю і
 * не можуть вирости понад неї. Стовбур такої стелі не мав ЖОДНОЇ — він просто
 * ріс із роками пари, а загальний бюджет дерева перевіряли вже після
 * складання й, у разі перевищення, писали м'яке порушення, якого ніхто не
 * читав.
 *
 * Виміряно на синтетичних історіях (40 зерен на вік, medium): у **восьми з
 * сорока** восьмирічних пар дерево виходило за мобільну стелю 18 000, у
 * п'ятнадцятирічних — у двох із сорока; найважче дало 18 786. Тобто бюджет
 * ламала не рідкісна аномалія, а кожна п'ята пара певного віку — і винен був
 * єдиний учасник без власної стелі.
 *
 * СТЕЛЯ ЖИВА, А НЕ ЧАСТКА. Перша редакція ділила бюджет на фіксовані частки
 * за опублікованими стелями всіх учасників — і виміряно, що вона проріджувала
 * 25 дерев із 40 там, де за бюджет виходило вісім. Крона в більшості пар
 * менша за свою стелю, і фіксована частка змушувала стовбур платити за листя,
 * якого немає.
 *
 * Тому сюди передається СПОЖИТЕ: корені й листя на цей момент уже зібрані
 * (`buildTreeLabPreview` будує їх раніше), тож відомі точно. Дрібнота на землі
 * будується пізніше, і за неї береться її стеля — 24 предмети по 24
 * трикутники; помилитись у більший бік тут безпечніше, ніж у менший.
 */
export function treeTrunkTriangleBudget(
  lod: OrganicMeshLod,
  spent: { leafTriangles: number; rootTriangles: number },
): number {
  const budget = lod === 'high'
    ? TREE_PRODUCTION_HIGH_DETAIL_BUDGET
    : TREE_PRODUCTION_MOBILE_BUDGET;

  const groundKinds = DEFAULT_TREE_GROUND_DETAIL_CONFIG.maximumInstancesByKindByLod[lod];
  const groundCap = Object.values(groundKinds).reduce((sum, count) => sum + count, 0)
    * DEFAULT_TREE_GROUND_DETAIL_CONFIG.maximumTemplateTriangles;

  return Math.max(
    0,
    budget.maxTriangles
      - Math.max(0, spent.leafTriangles)
      - Math.max(0, spent.rootTriangles)
      - groundCap,
  );
}

/**
 * Наскільки грубо дозволено проріджувати кільця стовбура заради бюджету.
 *
 * Крок уздовж кривої, а не радіальні сегменти, — і це вибір, а не зручність:
 * рельєф кори живе В РАДІАЛЬНОМУ напрямку (три долі плюс обертон), тож
 * зменшення сегментів по колу перетворює стовбур на шестерню — це вже
 * записано в коментарі до `radialSegmentsByLod`. Стовбур же — плавна крива,
 * і кільця через одне на ній не видно: перевірено знімком, коли крок
 * піднімали з 1 на 2.
 *
 * Стеля — чотири. Далі крива стає ламаною, і згин стовбура почне читатись
 * колінами.
 */
export const TREE_TRUNK_MAX_AXIAL_STRIDE = 4;
