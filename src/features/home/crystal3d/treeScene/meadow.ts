// ============================================================
// Луг під деревом: рельєф і розкладка того, що на ньому стоїть.
// ------------------------------------------------------------
// Винесено з двох компонентів, і не заради охайності. `TreeTexturedStage`
// і `TreeLifeDetailsPolished` тримали ВЛАСНІ копії `terrainHeight` —
// однакові рядок у рядок. Обидві системи саджають свої предмети на ту
// саму землю, тож будь-яке розходження між копіями означало б траву, що
// висить над рельєфом або тоне в ньому, і побачити це можна було б лише
// на знімку.
//
// Тут же живуть розміри всього, що стоїть на лузі. Кожен написаний у
// метрах через `metres()` (`sceneScale.ts`) — після того, як виявилось,
// що вони були підібрані на око проти дорослого дерева й через це
// вдвічі-вп'ятеро завеликі для реального віку пари.
// ============================================================
import * as THREE from 'three';
import { metres } from './sceneScale';

export type GroundInstance = {
  x: number;
  y: number;
  z: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  tone: number;
};

export type GroundItem = {
  x: number;
  y: number;
  z: number;
  rotation: number;
  scale: number;
  tone: number;
  /** Зсув фази хитання — щоб трава не гойдалась усім лугом в один такт. */
  phase: number;
};

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const smoothStep = (edge0: number, edge1: number, value: number) => {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * (3 - 2 * t);
};

export const hash2 = (x: number, z: number, salt: number) => {
  const value = Math.sin(x * 127.1 + z * 311.7 + salt * 74.7) * 43758.5453123;
  return value - Math.floor(value);
};

export const hash = (index: number, salt: number) => hash2(index, salt * 0.17, salt);

export const valueNoise = (x: number, z: number, salt: number) => {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const n00 = hash2(x0, z0, salt);
  const n10 = hash2(x0 + 1, z0, salt);
  const n01 = hash2(x0, z0 + 1, salt);
  const n11 = hash2(x0 + 1, z0 + 1, salt);
  const nx0 = THREE.MathUtils.lerp(n00, n10, sx);
  const nx1 = THREE.MathUtils.lerp(n01, n11, sx);
  return THREE.MathUtils.lerp(nx0, nx1, sz);
};

/** Висота рельєфу лугу в точці — ОДНА на всі системи, що на ньому стоять. */
export const terrainHeight = (x: number, z: number, radius: number) => {
  const radial = Math.min(1, Math.hypot(x, z) / radius);
  const distance = Math.hypot(x, z);
  const summitMask = smoothStep(0.55, 2.2, distance);
  const dome = -radius * 0.2 * Math.pow(radial, 1.58);
  const broad = (valueNoise(x * 0.25, z * 0.25, 3) - 0.5) * 0.72;
  const medium = (valueNoise(x * 0.62, z * 0.62, 11) - 0.5) * 0.22;
  const ridge = Math.sin(x * 0.53 + z * 0.19) * 0.055;
  const edgeWeight = 0.48 + radial * 0.52;
  return dome + (broad + medium + ridge) * summitMask * edgeWeight;
};

export const groundYAt = (x: number, z: number, radius: number, groundY: number) =>
  groundY + terrainHeight(x, z, radius);

/**
 * Радіус лугу — ВІД ДЕРЕВА, а не стала вісімка.
 *
 * Підлога 8 не залежала ні від чого й перемагала на КОЖНОМУ віці:
 * `crownRadius * 3.8` доходить лише до 6.3 навіть на сороковому році. Тобто
 * луг завжди був один і той самий круг радіусом 8 одиниць — тридцять п'ять
 * метрів, — а камера за той час від'їжджала з 2.07 на 10.08.
 *
 * Що з цього виходило, видно на знімку першого року: пагорб СТОЯВ ЛИСИЙ.
 * Не тому, що трави не було — чотириста двадцять жмутків розсівались
 * рівномірно по площі круга радіусом 6.08, а камера на відстані 2.07
 * бачила лише вузький клин ближнього поля перед гребенем. У той клин
 * потрапляло кілька штук.
 *
 * Луг, прив'язаний до дерева, тримає той самий КУТОВИЙ розмір: камера
 * від'їжджає пропорційно висоті, і луг разом із нею. Предмети на лузі при
 * цьому НЕ ростуть — вони лишаються в метрах, і саме тому дерево видно, як
 * воно їх переростає.
 *
 * Підлога в метрах лишається для нульового року, коли дерева ще майже
 * немає: без неї луг звівся б до плями під паростком.
 */
export function treeMeadowRadius(soilRadius: number, crownRadius: number, treeHeight: number) {
  return Math.max(metres(14), treeHeight * 5.2, crownRadius * 3.8, soilRadius * 4.2);
}

/** Висота найбільшої картки жмутка — з неї рахується масштаб інстансу. */
export const GRASS_CARD_HEIGHT = metres(0.36);
/** Наскільки картка опущена нижче нуля, щоб жмуток сів НА землю, а не в неї. */
export const GRASS_CARD_BASE = metres(0.3);
/** Найнижча і найвища лугова трава. */
export const GRASS_MIN_HEIGHT = metres(0.22);
export const GRASS_MAX_HEIGHT = metres(0.42);

export function buildGrassInstances(hillRadius: number, soilRadius: number, groundY: number) {
  const instances: GroundInstance[] = [];
  /*
   * 420 жмутків, а було 235.
   *
   * Не «густіше стало краще»: жмуток змалів утричі за лінійним розміром
   * (`sceneScale.ts`), тобто вдев'ятеро за площею, яку він накриває. Тими
   * самими 235 луг став би лисим. 420 повертає приблизно те саме покриття
   * ближнього поля, і коштує це 1 850 трикутників — рівно стільки, скільки
   * звільнили хмари, яких ніхто ніколи не бачив, плюс тисяча.
   */
  const count = 420;
  // Підлога в МЕТРАХ, а не 1.08 одиниці: та підлога лишала навколо
  // трирічного дерева голе кільце завширшки майже п'ять метрів.
  const minRadius = Math.max(soilRadius * 1.38, metres(0.9));
  const maxRadius = hillRadius * 0.76;
  const golden = Math.PI * (3 - Math.sqrt(5));

  /*
   * КУПИНАМИ, А НЕ РІВНО ПО ВСІЙ ГАЛЯВИНІ.
   *
   * Розкладка золотим кутом — це НАЙРІВНІШИЙ можливий розподіл на крузі;
   * саме тому нею сіють соняшникове насіння. Для лугу це рівно навпаки те,
   * що треба: трава росте купинами, між якими видно землю, і рівний розсів
   * читається як візерунок, а не як заріст.
   *
   * Тому центри купин лишаються на золотому куті (щоб вони самі не збивались
   * у грудку), а кожен кущик сідає біля свого центру.
   *
   * По ДВАНАДЦЯТЬ у купині, а було по сім: коли жмуток змалів, купина з
   * семи перестала читатись купиною й розсипалась на окремі цятки —
   * виміряно на знімку, трава виглядала розставленою, а не рослою.
   */
  const clumpCount = Math.max(1, Math.round(count / 12));
  for (let i = 0; i < count; i += 1) {
    const clump = i % clumpCount;
    const radialSeed = hash2(clump, 2, 101);
    const clumpAngle = clump * golden + (hash2(clump, 3, 103) - 0.5) * 0.82;
    const clumpRadius = Math.sqrt(
      minRadius * minRadius + (maxRadius * maxRadius - minRadius * minRadius) * radialSeed,
    );
    // Розкид усередині купини росте з відстанню від дерева, щоб дальні
    // купини не виглядали дрібнішими за ближні.
    const scatter = 0.22 + (clumpRadius / maxRadius) * 0.5;
    const angle = clumpAngle + (hash2(i, 11, 149) - 0.5) * scatter * 0.9;
    const radius = clumpRadius + (hash2(i, 12, 151) - 0.5) * scatter * 2.4;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const localY = terrainHeight(x, z, hillRadius);
    // Лугова трава: від двадцяти сантиметрів до сорока з гаком.
    const tuftHeight = THREE.MathUtils.lerp(GRASS_MIN_HEIGHT, GRASS_MAX_HEIGHT, hash2(i, 4, 107));
    const heightScale = tuftHeight / GRASS_CARD_HEIGHT;
    const tuftWidth = THREE.MathUtils.lerp(0.82, 1.2, hash2(i, 5, 109));
    instances.push({
      x,
      // Підйом рівно на опущену основу картки: жмуток стоїть на землі.
      y: groundY + localY + GRASS_CARD_BASE * heightScale,
      z,
      rotationX: (hash2(i, 6, 113) - 0.5) * 0.08,
      rotationY: angle + hash2(i, 7, 127) * Math.PI,
      rotationZ: (hash2(i, 8, 131) - 0.5) * 0.12,
      scaleX: tuftWidth,
      scaleY: heightScale,
      scaleZ: tuftWidth,
      tone: hash2(i, 9, 137),
    });
  }
  return instances;
}

/** Найбільший польовий камінь: пів метра заввишки, метр із чвертю завширшки. */
export const STONE_MAX_HALF_HEIGHT = metres(0.4);
export const STONE_MAX_HALF_WIDTH = metres(0.62);

export function buildRockInstances(hillRadius: number, soilRadius: number, groundY: number) {
  const instances: GroundInstance[] = [];
  /*
   * ПОЛЬОВЕ КАМІННЯ, А НЕ БРИЛИ.
   *
   * Було: піврозміри 0.2-0.55 одиниці, тобто камені від 1.8 до 4.9 МЕТРА
   * завширшки й до трьох метрів заввишки. На знімку трирічної пари такий
   * камінь стояв заввишки з дві третини дерева — і саме він першим кидався
   * в очі як «сцена завелика».
   *
   * Тепер це те, що лежить на лузі: від чверті метра до метра з чвертю.
   * Двадцять шість замість вісімнадцяти, бо дрібніший камінь менше
   * тримає око.
   */
  const count = 26;
  const minRadius = Math.max(soilRadius * 1.5, metres(1.6));
  const maxRadius = hillRadius * 0.73;

  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + hash2(i, 1, 211) * 0.8;
    const radius = THREE.MathUtils.lerp(minRadius, maxRadius, 0.18 + hash2(i, 2, 223) * 0.82);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const scaleX = THREE.MathUtils.lerp(metres(0.12), STONE_MAX_HALF_WIDTH, hash2(i, 3, 227));
    const scaleY = THREE.MathUtils.lerp(metres(0.09), STONE_MAX_HALF_HEIGHT, hash2(i, 4, 229));
    const scaleZ = THREE.MathUtils.lerp(metres(0.13), metres(0.58), hash2(i, 5, 233));
    instances.push({
      x,
      y: groundY + terrainHeight(x, z, hillRadius) + scaleY * 0.18,
      z,
      rotationX: (hash2(i, 6, 239) - 0.5) * 0.52,
      rotationY: hash2(i, 7, 241) * Math.PI * 2,
      rotationZ: (hash2(i, 8, 251) - 0.5) * 0.42,
      scaleX,
      scaleY,
      scaleZ,
      tone: hash2(i, 9, 257),
    });
  }
  return instances;
}

export function buildGroundItems(
  count: number,
  minRadius: number,
  maxRadius: number,
  hillRadius: number,
  groundY: number,
  salt: number,
) {
  const items: GroundItem[] = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i += 1) {
    const angle = i * golden + (hash(i, salt) - 0.5) * 0.92;
    const radius = Math.sqrt(
      minRadius * minRadius + (maxRadius * maxRadius - minRadius * minRadius) * hash(i, salt + 2),
    );
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    items.push({
      x,
      y: groundYAt(x, z, hillRadius, groundY),
      z,
      rotation: angle + hash(i, salt + 3) * Math.PI,
      scale: THREE.MathUtils.lerp(0.72, 1.2, hash(i, salt + 5)),
      tone: hash(i, salt + 7),
      phase: hash(i, salt + 11) * Math.PI * 2,
    });
  }
  return items;
}

/**
 * Обидві тіні під деревом — ВІД ДЕРЕВА, А НЕ ВІД ПІДЛОГИ.
 *
 * Підлоги 1.15 і 1.9 перемагали НЕ ІНОДІ, а на кожному віці до двадцяти
 * років: у трирічної пари `crownRadius` 0.44, і множник давав 0.42 —
 * підлога 1.9 була вчетверо більша. На лузі під сіянцем лежала пляма
 * 3.8 одиниці завширшки, тобто сімнадцять метрів тіні від крони
 * чотириметрової завширшки.
 *
 * Підлога лишається — без неї тінь у нульовому році зникає зовсім, — але
 * тепер вона в МЕТРАХ і мала: рівно стільки, щоб під найменшим паростком
 * було видно, що він стоїть на землі.
 */
export function treeMeadowShadows(soilRadius: number, crownRadius: number) {
  return {
    rootScaleX: Math.max(metres(0.9), soilRadius * 1.45),
    rootScaleZ: Math.max(metres(0.5), soilRadius * 0.82),
    crownScaleX: Math.max(metres(1.2), crownRadius * 0.95),
    crownScaleZ: Math.max(metres(0.6), crownRadius * 0.48),
    /*
     * ЗНОС ТІНІ КРОНИ — від крони, а не стала 0.72.
     *
     * Сонце стоїть ліворуч-спереду (`directionalLight` на -7, 10, 5), тож
     * тінь крони лягає праворуч-назад. Наскільки далеко — залежить від
     * того, яка та крона: стала 0.72 при кроні радіусом 0.44 відносила
     * пляму далі, ніж сягає саме гілля, і тінь відривалась від дерева.
     */
    crownOffsetX: Math.max(metres(0.4), crownRadius * 0.44),
    crownOffsetZ: -Math.max(metres(0.3), crownRadius * 0.3),
  };
}

/** Розмах крил метелика — сім сантиметрів, а не сорок сім. */
export const BUTTERFLY_WING_RADIUS = metres(0.035);

/**
 * Де літають два метелики — у одиницях сцени, від основи дерева.
 *
 * Місце береться від КРОНИ, з підлогою в метрах для нульового року, коли
 * крони ще немає. Раніше обидва сиділи на сталих висотах 2.15 і 2.72 над
 * землею — і в трирічної пари, чиє дерево має 1.10, обидва були ПОВНІСТЮ
 * за верхнім ребром кадру.
 */
export function butterflyFlight(crownRadius: number, treeHeight: number) {
  const radius = Math.max(metres(1.2), crownRadius * 1.15);
  const height = Math.max(metres(0.6), treeHeight * 0.55);
  return [
    [radius, height, radius * 0.35],
    [-radius * 1.25, height * 1.24, -radius * 0.7],
  ] as const;
}
