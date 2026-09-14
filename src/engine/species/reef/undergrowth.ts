// ============================================================
// Жива шкіра рифа: дрібнота, якою вкрито все інше.
// ------------------------------------------------------------
// Власник дав п'ять референсів і сказав: «передай атмосферу цих фото».
// Спільного в них три речі — світло крізь товщу, світле дно і ЩІЛЬНЕ
// ЖИТТЯ. Останнє й виявилось найбільшою прогалиною: наш риф був голою
// брилою з чотирма колоніями, і жодне світло цього не рятувало.
//
// ЩО ЦЕ ТАКЕ І ЧИМ ВОНО НЕ Є. Дрібнота — не літопис. Вона не рахує
// років, не міряє модулів і нічого не означає; вона робить поверхню
// поверхнею. Річні колонії лишаються єдиним, що несе історію, і саме
// тому дрібнота мусить бути дрібною: якби вона змагалась із ними за
// увагу, кільце років перестало б читатись.
//
// Три види, і кожен узятий з референсів:
//   `blade`  — пучок стрічок, що тягнуться вгору (трава й м'які корали);
//   `tuft`   — кулька з голок (актинія, губка, їжак);
//   `pebble` — камінець на піску, той самий, що лежить купками внизу;
//   `weed`   — висока водорість, що тягнеться до світла й гойдається.
//
// Водорості стоять окремо від решти: їх мало, вони високі, і саме вони
// дають кадру вертикаль. Без них риф лежить пласко, хай яка густа на
// ньому дрібнота — це видно на першому й третьому референсах, де
// стрічки тягнуться від дна до самого верху кадру.
//
// РОЗКЛАДКА НЕ ВИПАДКОВА, А НИЗЬКОРОЗБІЖНА — золотий кут по азимуту й
// ван дер Корпут по висоті, як у річних колоній. Причина та сама:
// випадкові точки збиваються в грона й лишають лисини, і на куполі це
// видно одразу.
// ============================================================
import { clamp01, round6, seededUnit } from './math';
import {
  REEF_HEAD_RADIUS_MAX,
  REEF_HEAD_RADIUS_MIN,
  reefColonyLayout,
  type ReefColonyAnchor,
  type ReefHeadSize,
} from './colonyFormations';
import { reefHeadSurfacePoint } from './headMesh';
import type { ReefStanding } from './reefStaging';

export type ReefGrowthKind = 'blade' | 'tuft' | 'pebble' | 'weed';

/**
 * Палітра життя: те, чим риф укритий поза кольором пари.
 *
 * Зелень, бірюза, бузок, охра, коралово-червоне. Ці тони на референсах
 * і роблять кадр рифом: там немає жодного однотонного місця.
 */
export const REEF_LIFE_COLOURS: ReadonlyArray<readonly [number, number, number]> = [
  [0.18, 0.72, 0.38],
  [0.06, 0.66, 0.66],
  [0.55, 0.28, 0.86],
  [0.95, 0.55, 0.10],
  [0.90, 0.20, 0.34],
  [0.42, 0.84, 0.20],
  [0.14, 0.44, 0.92],
  [0.96, 0.78, 0.16],
];

/** Камені кольору не мають — вони камені. */
export const REEF_PEBBLE_COLOUR: readonly [number, number, number] = [0.62, 0.63, 0.6];

/** Скільки високих водоростей навколо рифа. */
const WEED_MIN = 12;
const WEED_MAX = 26;

/**
 * Скільки дрібноти на найменшому й найбільшому рифі.
 *
 * ЩІЛЬНІСТЬ НЕ СТАЛА, І ЦЕ ТЕПЕР СКАЗАНО ЧЕСНО. Тут стояв коментар
 * «щільність тримається сталою», а вимір показав протилежне — кількість
 * на одиницю площі купола:
 *
 *   рік 1 → 126,  рік 4 → 70,  рік 10 → 41,  рік 25 → 20
 *
 * Тобто вона падає вшестеро, бо площа росте вчетверо з гаком, а
 * кількість майже стоїть (81 на першому році й 81 на двадцять п'ятому).
 *
 * Але СТАЛА щільність і не потрібна, і в цьому суть: на старому рифі
 * колонії вкривають купол самі (174% на двадцять п'ятому році за
 * `reefSilhouetteProfile`), тож дрібнота там лише додає кольору. Потрібна
 * вона рівно там, де голо, — на молодому рифі, де колонія одна.
 *
 * Тому правиться не крива, а її НИЖНІЙ край: 96 → 150. Це +42% дрібноти
 * саме на першому році (81 → 115 на куполі) і майже нічого на двадцять
 * п'ятому, де вона й не вирішує.
 */
const GROWTH_MIN = 150;
const GROWTH_MAX = 260;

/** Яка частка з них сидить на куполі, а не на піску. */
const ON_HEAD_SHARE = 0.7;

/**
 * Наскільки близько до річної колонії дрібноті підходити не можна.
 *
 * У частках радіуса колонії. Колонія — те, що несе історію; заростити
 * її дрібнотою означало б сховати єдине, що на цьому рифі щось
 * означає.
 *
 * Перша редакція мала 1.25 — і на знімку купол вийшов лисим: чотири
 * зони по 0.5 одиниці кожна з'їдали більшу частину видимої поверхні,
 * а дрібнота лишалась тільки на обідку. 0.85 лишає колонію вільною й
 * не звільняє під неї півкупола.
 */
const COLONY_KEEP_OUT = 0.85;

/** Смуга купола, у якій сидить дрібнота: від самого низу майже до маківки. */
const HEAD_BAND_LOW = 0.06;
const HEAD_BAND_HIGH = 0.94;

const GOLDEN_ANGLE_RAD = Math.PI * (3 - Math.sqrt(5));

export interface ReefGrowth {
  kind: ReefGrowthKind;
  /** Точка на поверхні — купола або піску. */
  point: { x: number; y: number; z: number };
  /** Куди росте: зовнішня нормаль поверхні в цій точці. */
  normal: { x: number; y: number; z: number };
  /** Розмір в одиницях виду. */
  size: number;
  /** Поворот навколо власної нормалі, радіани. */
  spinRad: number;
  colourIndex: number;
}

function radicalInverse2(index: number): number {
  let bits = Math.max(0, Math.floor(index)) + 1;
  let result = 0;
  let denominator = 0.5;
  while (bits > 0) {
    result += (bits % 2) * denominator;
    bits = Math.floor(bits / 2);
    denominator *= 0.5;
  }
  return result;
}

/**
 * Уся дрібнота цього рифа.
 *
 * Кількість росте з розміром голови, а не з історії. Але щільність при
 * цьому ПАДАЄ, і це не вада: на старому рифі купол вкривають самі
 * колонії, а дрібнота потрібна там, де голо, — на молодому. Числа й
 * причину див. у `GROWTH_MIN`.
 */
export function reefUndergrowth(
  head: ReefHeadSize,
  standing: ReefStanding,
  yearCount: number,
  seed: number,
): ReefGrowth[] {
  const radius = Math.max(1e-6, head.radius);
  const colonies = reefColonyLayout(head, yearCount);

  /*
   * Де радіус купола стоїть між своїми краями, 0..1.
   *
   * МЕЖІ ВИВЕДЕНІ, А НЕ ПЕРЕПИСАНІ ЧИСЛОМ. Тут стояло
   * `(radius - 0.25) / 1.15`, і 1.15 було рівно `1.4 - 0.25`, тобто
   * старий `HEAD_BREADTH_GAIN` із сусіднього файлу. Щойно той став 0.15
   * (ADR-0182), вираз перестав доходити до одиниці — на найбільшому рифі
   * давав 0.783, — і дрібноти ставало менше, ніж задумано, тихо й без
   * жодної помилки. Тепер обидва краї приходять звідти, де живуть.
   */
  const spread = clamp01(
    (radius - REEF_HEAD_RADIUS_MIN) / (REEF_HEAD_RADIUS_MAX - REEF_HEAD_RADIUS_MIN),
  );
  const total = Math.round(GROWTH_MIN + (GROWTH_MAX - GROWTH_MIN) * spread);
  const onHead = Math.round(total * ON_HEAD_SHARE);

  const growths: ReefGrowth[] = [];

  /*
   * ВІДКИНУТИЙ КАНДИДАТ ЗАМІНЮЄТЬСЯ, А НЕ ЗНИКАЄ.
   *
   * Тут стояв простий цикл до `onHead`, і кандидат, що впав у зону
   * колонії, просто губився. Наслідок був тихий і саме той, якого цей
   * файл клявся не допустити: при ОДНОМУ Й ТОМУ САМОМУ куполі дрібноти
   * виходило 217 на першому році й 162 на двадцять п'ятому, бо двадцять
   * п'ять колоній відкидають більше кандидатів, ніж одна.
   *
   * Тобто дрібнота таки несла річний сигнал — слабкий, зворотний і
   * ніким не задуманий. Тест «кількість не залежить від прожитих років»
   * стояв поруч і пропускав це, бо мав смугу 25%, а вада сиділа рівно
   * під нею.
   *
   * Тепер кількість задана: індекс іде далі, доки не набереться `onHead`.
   * Стеля спроб потрібна, бо на дуже старому рифі вільного місця може
   * не лишитись узагалі, і без неї цикл не скінчився б.
   */
  const ATTEMPT_CEILING = onHead * 6;
  for (let index = 0, placed = 0; placed < onHead && index < ATTEMPT_CEILING; index += 1) {
    const azimuth = index * GOLDEN_ANGLE_RAD;
    const band = HEAD_BAND_LOW + (HEAD_BAND_HIGH - HEAD_BAND_LOW) * radicalInverse2(index);
    /*
     * СПРАВЖНЯ поверхня, а не ідеальний еліпсоїд.
     *
     * Перша редакція рахувала точку з рівняння купола — і на знімку
     * дрібнота плавала над ним: меш зміщений частками до ±30% радіуса,
     * тож ідеальна поверхня проходить то під ним, то над.
     */
    const surface = reefHeadSurfacePoint(head, seed, azimuth, band);

    if (nearAnyColony(surface.point, colonies)) continue;

    const salt = `reef:growth:head:${index}`;
    const roll = seededUnit(seed, `${salt}:kind`);

    growths.push({
      // На куполі каменів немає: камінь лежить, а не тримається.
      kind: roll < 0.55 ? 'tuft' : 'blade',
      point: surface.point,
      normal: surface.normal,
      size: round6(radius * (0.075 + 0.075 * seededUnit(seed, `${salt}:size`))),
      spinRad: round6(seededUnit(seed, `${salt}:spin`) * Math.PI * 2),
      colourIndex: index % REEF_LIFE_COLOURS.length,
    });
    placed += 1;
  }

  /*
   * Пісок навколо каменя. Кільце, а не диск: під самим каменем нічого
   * не видно, а далеко все з'їдає туман, тож усе, що там намалюється,
   * буде сплачене й невидиме.
   */
  /*
   * Кільце починається ЗА каменем, а не від його номінального радіуса:
   * камінь будується тим самим куполом, тож його край гуляє до +30%.
   * Перша редакція брала 0.95 — і частина камінців опинялась усередині
   * каменю, звідки стирчала кутами.
   */
  const inner = standing.rock.radius * 1.4;
  const outer = standing.rock.radius * 3.2;

  /*
   * Водорості — окремим колом і рідше. Вони високі, тож на місці
   * дрібноти читалися б лісом, а риф за ними зник би.
   */
  const weeds = Math.round(WEED_MIN + (WEED_MAX - WEED_MIN) * spread);
  for (let index = 0; index < weeds; index += 1) {
    const azimuth = index * GOLDEN_ANGLE_RAD + 0.4;
    /*
     * 1.38, а не ближче: власний тест «те, що на піску, лежить ЗА
     * каменем» упіймав спробу підсунути водорості на 1.15 радіуса.
     * Він має рацію — край каменя гуляє до +30%, і водорість там
     * проросла б крізь породу.
     */
    const distance = standing.rock.radius * (1.8 + 2.2 * radicalInverse2(index));
    const salt = `reef:weed:${index}`;
    growths.push({
      kind: 'weed',
      point: {
        x: round6(Math.cos(azimuth) * distance),
        y: 0,
        z: round6(Math.sin(azimuth) * distance),
      },
      normal: { x: 0, y: 1, z: 0 },
      /*
       * Висока — але не на весь екран.
       *
       * 0.62–1.17 радіуса голови було завелико: на ТЕЛЕФОНІ камера
       * стоїть утричі далі (кадр рахується з описаної сфери й
       * співвідношення сторін), тож водорості опинялись між нею й
       * рифом і затуляли пів кадру двома зеленими стрічками. На
       * широкому екрані та сама розкладка виглядала правильно — саме
       * тому перевіряти треба обидва.
       */
      size: round6(radius * (0.42 + 0.34 * seededUnit(seed, `${salt}:size`))),
      spinRad: round6(seededUnit(seed, `${salt}:spin`) * Math.PI * 2),
      colourIndex: index % 2 === 0 ? 0 : 5,
    });
  }
  for (let index = 0; index < total - onHead; index += 1) {
    const azimuth = index * GOLDEN_ANGLE_RAD;
    const distance = inner + (outer - inner) * Math.sqrt(radicalInverse2(index));
    const salt = `reef:growth:sand:${index}`;
    const roll = seededUnit(seed, `${salt}:kind`);

    growths.push({
      kind: roll < 0.42 ? 'pebble' : roll < 0.74 ? 'blade' : 'tuft',
      point: {
        x: round6(Math.cos(azimuth) * distance),
        y: 0,
        z: round6(Math.sin(azimuth) * distance),
      },
      normal: { x: 0, y: 1, z: 0 },
      // На піску дрібнота менша: там її видно збоку, і великий камінець
      // читається валуном, а не галькою.
      size: round6(radius * (0.045 + 0.055 * seededUnit(seed, `${salt}:size`))),
      spinRad: round6(seededUnit(seed, `${salt}:spin`) * Math.PI * 2),
      colourIndex: index % REEF_LIFE_COLOURS.length,
    });
  }

  return growths;
}

/** Чи стоїть точка надто близько до котроїсь річної колонії. */
function nearAnyColony(
  point: { x: number; y: number; z: number },
  colonies: readonly ReefColonyAnchor[],
): boolean {
  for (const colony of colonies) {
    const gap = Math.hypot(
      point.x - colony.point.x,
      point.y - colony.point.y,
      point.z - colony.point.z,
    );
    // Радіус колонії тут не переданий, тож береться той самий масштаб,
    // яким вона й будується: частка від зсуву прив'язки до поверхні.
    if (gap < COLONY_KEEP_OUT * colonyReach(colony)) return true;
  }
  return false;
}

/**
 * Приблизний обхват колонії з її прив'язки.
 *
 * Точний радіус живе в плані, а сюди його не передають навмисно:
 * дрібнота не має залежати від наповненості року, інакше бідний рік
 * заростав би травою, а це вже було б твердження про пару.
 */
function colonyReach(colony: ReefColonyAnchor): number {
  return Math.hypot(colony.point.x, colony.point.y, colony.point.z) * 0.26;
}
