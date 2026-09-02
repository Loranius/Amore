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
import { treeAgeProgress, treeTrunkHeightScale } from './growthLaw';

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

/*
 * ВУЗЬКА КРОНА МОЛОДОГО ДЕРЕВА.
 *
 * Власник на живому порталі, 1345-й день: «замале дерево для трьох років,
 * більше на кущ схоже». Виміряно на його ж дереві: ширина крони **1.07
 * висоти**, тобто крона — куля. У живого саджанця цього віку крона вужча за
 * висоту приблизно вдвічі; кулю має старе дерево, і саме тому куля на
 * молодому читається кущем.
 *
 * Ширину давали ОБИДВА джерела нарівно: огинальна скелетних гілок на трьох
 * роках сягає 0.98 висоти, а найширший прутик симуляції — 1.07. Тому
 * звуження прикладається й до скелета симуляції, і до вильоту скелетних
 * гілок; окремо жодне з них ширини не міняло (виміряно: молодий виліт
 * 0.45 / 0.38 / 0.32 / 0.26 дає 1.07 незмінно).
 *
 * Це НЕ спотворення заради силуету. Молодий пагін і в природі росте вгору
 * різкіше, ніж убік: гілка відходить під гострішим кутом, поки над нею
 * немає затінення. Звуження по x і z — найпростіше вираження того самого.
 *
 *   вік  1 рік  -> 0.45      вік 10 років -> 0.76
 *   вік  3.7    -> 0.56      вік 20+      -> 1.00 (без змін)
 */
export function treeCrownNarrowing(daysTogether: number): number {
  return Math.min(1, 0.37 + 0.97 * treeAgeProgress(daysTogether));
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
/*
 * СТРУНКІСТЬ — висота, поділена на діаметр основи, і саме вона тут закон.
 *
 * Розгортка від нуля до сорока років по п'яти профілях заповнення показала,
 * що радіус основи падає в 17-18 переходах із 43, найгірше ×0.39. Тобто
 * стовбур ТОНШАВ з роками — просто в протилежність власниковому «3 рік
 * стовбур стає грубшим… 40 років — міцний товстий стовбур».
 *
 * Причина не в законі, а в тому, що закону не було. Товщину давала трубкова
 * модель: `радіус = радіус кінчика × N^(1/показник)`, де N — число кінчиків.
 * Кінчиків у симуляції від 38 до 87 залежно від року, тож і радіус скакав
 * разом із ними. ADR-0091 підняв СЕРЕДНЮ товщину показником труби, але шум
 * від числа кінчиків нікуди не дівся.
 *
 * Тепер так само, як із висотою: закон дає РОЗМІР, симуляція лишає собі
 * ФОРМУ. Радіус основи виводиться зі стрункості, а трубкова модель і далі
 * вирішує, як товщина розподілена вздовж дерева — усі радіуси множаться на
 * одне число, тож звуження до кінчика лишається її.
 *
 * Числа стрункості взято з ADR-0091, де їх назвали бажаними: молоде дерево
 * стрункіше (34), доросле осідає. Обидва в межах живих дерев (20-60).
 *
 * ДОРОСЛЕ 29 -> 25, І ЦЕ ЧИСЛО ТЕПЕР З ЕТАЛОНА (ADR-0106). 29 було
 * бажаним, тобто ні з чим не звіреним; еталон оголошує стовбур 25 і
 * міряється в нього. Сама стрункість розриву не закриває — навіть 19 дає
 * радіус основи 0.0312 при еталонних 0.0380, — бо різниця сидить у КОМЕЛІ
 * (`rootFlare.ts`), а не в стовбурі. 25 ставить стовбур туди, де його
 * бачить еталон, а комель доробляє решту.
 */
const SLENDERNESS_YOUNG = 34;
const SLENDERNESS_MATURE = 25;

/** Стрункість дерева цього віку: висота на діаметр основи. */
export function treeSlenderness(daysTogether: number): number {
  return SLENDERNESS_YOUNG
    + (SLENDERNESS_MATURE - SLENDERNESS_YOUNG) * treeAgeProgress(daysTogether);
}

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
  narrowing = 1,
  slenderness = 0,
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

  /*
   * Радіуси множаться СВОЇМ числом, а не масштабом висоти: висота — один
   * закон, товщина — другий. Коли стрункості не задано (0), лишається старе
   * рівномірне масштабування, щоб функція була придатна й без закону.
   */
  let radiusFactor = factor;
  if (slenderness > 0) {
    let base = 0;
    const baseBand = bottom + raw * 0.05;
    for (const node of skeleton.nodes) {
      if (node.position.y <= baseBand && node.radius > base) base = node.radius;
    }
    if (base > 1e-9) radiusFactor = targetHeight / (2 * slenderness) / base;
  }

  // Тотожність не переписує вузлів: та сама пам'ять, той самий хеш.
  if (Math.abs(factor - 1) < 1e-9
    && Math.abs(narrowing - 1) < 1e-9
    && Math.abs(radiusFactor - 1) < 1e-9) {
    return { skeleton, factor: 1 };
  }

  const scaled = {
    ...skeleton,
    nodes: skeleton.nodes.map((node) => ({
      ...node,
      position: {
        // Звуження — тільки по горизонталі: висота лишається законом.
        x: round6(node.position.x * factor * narrowing),
        y: round6(node.position.y * factor),
        z: round6(node.position.z * factor * narrowing),
      },
      radius: round6(node.radius * radiusFactor),
    })),
  };
  return { skeleton: scaled, factor };
}
