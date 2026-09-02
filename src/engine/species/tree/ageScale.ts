// ============================================================
// Розмір дерева — закон часу, а не наслідок симуляції.
// ------------------------------------------------------------
// ДОГМА ВЛАСНИКА: «з кожним роком будь-який об'єкт стає дорослішим разом із
// парою, навіть якщо подій і фото немає ніяких; події і фото просто
// закріплюють ріст, як добриво, але ЧАС — основна валюта росту».
//
// Самоорганізаційна модель цього не дає й дати не може. Вона чесно
// моделює конкуренцію за світло, а конкуренція має скидання: гілка, що
// не набрала світла, відмирає. Виміряно на порожній історії — висота
// побудованого меша по роках:
//
//   1 -> 2.46   2 -> 4.15   3 -> 4.81   5 -> 5.88   8 -> 7.15
//  12 -> 9.29  20 -> 14.48  30 -> 14.41  40 -> 6.97
//
// Сорокарічне дерево виходило НИЖЧИМ за восьмирічне й удвічі нижчим за
// власне двадцятирічне. Пара, яка нічого не записала, діставала дерево,
// що всихає. Це не «шум у межах допуску» — це протилежність догмі.
//
// РОЗДІЛЕННЯ, ЯКЕ ЦЕ ЗАКРИВАЄ: симуляція вирішує, ЯК дерево виглядає
// (скільки гілок, куди вони пішли, де крона); закон віку вирішує, ЯКЕ
// ВОНО ЗАВБІЛЬШКИ. Розмір перестає бути результатом кидання монети й стає
// функцією часу — строго зростальною, як і вимагає догма.
//
// ЧОМУ МАСШТАБУВАННЯ ПІСЛЯ, А НЕ ІНШИЙ `internodeLength` ПЕРЕД. Це те
// саме, і це вже виміряно: `internodeLength` — чистий масштаб (за 0.10,
// 0.14, 0.18, 0.24 і 0.34 виходить те саме дерево — 141 вузол, 31 гілка,
// ті самі покоління, лише більше або менше). Отже помножити скелет після
// побудови й перебудувати його з помноженим міжвузлям дають однаковий
// результат, але перше коштує один прохід, а друге — два.
// ============================================================
import type { OrganicSkeletonState } from '../../labs/organic';
export { treeDaysTogether } from './growthLaw';
import { treeTrunkHeightScale } from './growthLaw';

/**
 * Висота скелета дорослого дерева, поділена на висоту стовбура з закону.
 *
 * `structure.trunkHeight` — число закону в його власних одиницях
 * (2.79 на сорока роках у пари з посівом лабораторії), а рушій хоче скелет
 * близько 5.0, щоб `treeFit` відображав дорослу крону в 2.7 сцени.
 * Множник посівозалежний рівно настільки, наскільки посівозалежний сам
 * `trunkHeight`, — тобто дерева різних пар лишаються різними, а кожне
 * окреме росте строго з віком.
 */
export const TREE_SKELETON_HEIGHT_PER_TRUNK = 1.79;

/**
 * Цільова висота скелета для дерева цього віку, в одиницях рушія.
 *
 * @param lawTrunkHeight `species.structure.trunkHeight` — уже помножений на
 *   `treeTrunkHeightScale`, тож містить і вік, і посів пари
 */
export function treeSkeletonTargetHeight(lawTrunkHeight: number): number {
  const height = Number.isFinite(lawTrunkHeight) ? Math.max(0, lawTrunkHeight) : 0;
  return height * TREE_SKELETON_HEIGHT_PER_TRUNK;
}

/**
 * Висота дерева, на якому виміряно сталі листя й згустків.
 *
 * `foliage/config.ts` і `leafGeometry/config.ts` тримають ДОВЖИНИ В
 * ОДИНИЦЯХ РУШІЯ: листок 0.14-0.32, згусток 0.14-0.30. Ці числа міряли на
 * живому дереві пари, у якого верхівка стояла на 4.4 (див. примітку про
 * «найвищий згусток піднявся з 3.82 на 4.28 при верхівці 4.44»).
 *
 * Доки всі дерева були приблизно однакового зросту, стала довжина
 * працювала. Відколи розмір іде за віком, вона стала вадою з протилежного
 * кінця: на ростку заввишки 0.71 листок 0.32 — це половина дерева.
 */
export const TREE_FOLIAGE_TUNED_HEIGHT = 4.4;

/**
 * Множник довжин листя й згустків для дерева цього віку.
 *
 * Іде ВІД ЗАКОНУ, а не від виміряної висоти скелета, і це не дрібниця:
 * висота симуляції гуляє (див. таблицю вгорі), тож листя, прив'язане до
 * неї, гуляло б разом із нею. Прив'язане до закону — воно росте рівно так
 * само монотонно, як і саме дерево.
 */
export function treeFoliageScale(lawTrunkHeight: number): number {
  return treeSkeletonTargetHeight(lawTrunkHeight) / TREE_FOLIAGE_TUNED_HEIGHT;
}

/** Наскільки дерево цього віку менше за доросле — частка закону. */
export function treeAgeSizeShare(daysTogether: number): number {
  return treeTrunkHeightScale(daysTogether);
}

/**
 * Рельєф кори за віком дерева — і що з нього насправді є довжиною.
 *
 * ЦЕ НЕ ПРИКРАСА, а те, що ЧУЖИЙ тест спіймав першим: «gives the trunk a
 * lobed cross-section rather than a circle» впав із 0.035 при вимозі 0.08.
 * Стовбур молодого дерева має радіус 0.012-0.03, тобто він увесь опинявся
 * нижче за `fadeRadius: 0.06` — порогу, під яким рельєф гасне ЗОВСІМ, — і
 * кора ставала гумовою трубою, рівно тією скаргою, проти якої цей рельєф
 * колись і робили.
 *
 * ПЕРША СПРОБА БУЛА НЕПРАВИЛЬНА, і виміряно це відразу: я помножив ще й
 * `depth`, і показник упав із 0.035 на 0.027, тобто стало ГІРШЕ. Причина в
 * тому, що `depth` — не довжина: `radiusScale = 1 + depth * shape`, тобто
 * це вже ЧАСТКА радіуса, і множити її означало робити рельєф дрібнішим на
 * дрібнішому дереві двічі.
 *
 * Довжини тут рівно дві категорії:
 *
 *   `fadeRadius`   — рівняється з радіусом гілки, тож множиться;
 *   частоти        — множаться на `axial`, довжину дуги в одиницях рушія
 *                    (`swellFrequency`, `striationFrequency`, `twist`), тож
 *                    ДІЛЯТЬСЯ: на вдвічі меншому дереві їх треба вдвічі
 *                    більше, щоб смуг лишилась та сама кількість.
 *
 * Решта — `lobeCount`, `overtoneCount`, `striationDepthRatio`, `depth` —
 * безрозмірні й лишаються як є.
 *
 * @param scale множник, ФАКТИЧНО застосований до скелета
 *   (`ScaledTreeSkeleton.factor`), а не множник листя: рельєф міряється
 *   проти радіуса стовбура, а радіус помножено саме ним
 */
export function scaleOrganicSurfaceToAge<T extends {
  bark: {
    fadeRadius: number; striationFrequency: number;
    swellFrequency: number; twist: number;
  };
}>(config: T, scale: number): T {
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return config;
  return {
    ...config,
    bark: {
      ...config.bark,
      fadeRadius: config.bark.fadeRadius * scale,
      striationFrequency: config.bark.striationFrequency / scale,
      swellFrequency: config.bark.swellFrequency / scale,
      twist: config.bark.twist / scale,
    },
  };
}

/**
 * Смуга розміру згустків і крок між ними — за віком дерева.
 *
 * `minClusterRadius`, `maxClusterRadius` і `clusterSpacing` — довжини в
 * одиницях рушія, виміряні на дорослому дереві. `maxClusters`, `maxLeaves`
 * і решта лічильників безрозмірні й лишаються.
 *
 * Винесено окремою функцією, а не розкладено по місцю виклику, саме тому,
 * що це мусять уміти й ТЕСТИ: три чужі перевірки порівнюють згустки
 * конвеєра з побудованими власноруч, і без спільного визначення вони
 * порівнювали б дерево із законом віку проти дерева без нього.
 */
export function scaleFoliageConfigToAge<T extends {
  minClusterRadius: number; maxClusterRadius: number; clusterSpacing: number;
}>(config: T, scale: number): T {
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return config;
  return {
    ...config,
    minClusterRadius: config.minClusterRadius * scale,
    maxClusterRadius: config.maxClusterRadius * scale,
    clusterSpacing: config.clusterSpacing * scale,
  };
}

/** Довжина листка за віком: те саме, і з тієї самої причини. */
export function scaleLeafGeometryConfigToAge<T extends {
  minimumLength: number; maximumLength: number;
}>(config: T, scale: number): T {
  if (!Number.isFinite(scale) || scale <= 0 || Math.abs(scale - 1) < 1e-9) return config;
  return {
    ...config,
    minimumLength: config.minimumLength * scale,
    maximumLength: config.maximumLength * scale,
  };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * Розтягує чи стискає готовий скелет до висоти, яку задав вік.
 *
 * Множаться ЛИШЕ довжини — положення й радіус. `direction` — одиничний
 * вектор напрямку, і множити його означало б зламати кадри кривих, які на
 * нього спираються; `generation`, `terminal`, `branchId` довжин не мають.
 *
 * Порожній скелет і скелет нульової висоти повертаються як є: ділити на
 * висоту, якої немає, — це `Infinity` в кожному вузлі, а рушій має
 * заборону на нескінченність у канонічному виході.
 */
export interface ScaledTreeSkeleton {
  skeleton: OrganicSkeletonState;
  /**
   * Множник, який ФАКТИЧНО застосовано до довжин скелета.
   *
   * Не те саме, що `treeFoliageScale`, і плутати їх не можна — на цьому вже
   * вийшла помилка. Листок міряється проти ВИСОТИ дерева (око порівнює саме
   * це), тож його множник іде від закону: `ціль / 4.4`. Рельєф кори
   * міряється проти РАДІУСА СТОВБУРА, а радіус помножено ось цим числом —
   * `ціль / сира висота`. Сира висота гуляє, тож і числа різні.
   */
  factor: number;
}

export function scaleTreeSkeletonToAge(
  skeleton: OrganicSkeletonState,
  targetHeight: number,
): ScaledTreeSkeleton {
  if (!Number.isFinite(targetHeight) || targetHeight <= 0) return { skeleton, factor: 1 };
  if (skeleton.nodes.length === 0) return { skeleton, factor: 1 };

  let top = Number.NEGATIVE_INFINITY;
  let bottom = Number.POSITIVE_INFINITY;
  for (const node of skeleton.nodes) {
    if (node.position.y > top) top = node.position.y;
    if (node.position.y < bottom) bottom = node.position.y;
  }
  const raw = top - bottom;
  if (!Number.isFinite(raw) || raw <= 1e-6) return { skeleton, factor: 1 };

  const factor = targetHeight / raw;
  // Тотожність не переписує вузлів: та сама пам'ять, той самий хеш.
  if (Math.abs(factor - 1) < 1e-9) return { skeleton, factor: 1 };

  const scaled = {
    ...skeleton,
    nodes: skeleton.nodes.map((node) => ({
      ...node,
      position: {
        x: round6(node.position.x * factor),
        y: round6(node.position.y * factor),
        z: round6(node.position.z * factor),
      },
      radius: round6(node.radius * factor),
    })),
  };
  return { skeleton: scaled, factor };
}
