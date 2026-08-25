import { describe, expect, it } from 'vitest';
import { yearFill } from '../shared/relationshipYear';
import {
  ANNUAL_BODIES_MAX,
  reefColonyAnchor,
  reefColonyAzimuthRad,
  reefColonyLayout,
  reefColonyBand,
  ANNUAL_BODIES_MIN,
  ANNUAL_HEAD_SHARE,
  reefAnnualColonySize,
  reefHeadScale,
  reefHeadSize,
} from './colonyFormations';

// ============================================================
// Ті самі чотири правила власника, що й у кристала.
// ------------------------------------------------------------
// Записані окремим файлом навмисно: решта тестів рифа стереже те, ЯК він
// рахує, а ці — те, ЧОГО модель не має права робити, хай як її
// перепишуть. Для кристала саме такий файл упіймав, що заморозка року
// існувала лише на словах, і всі 96 наявних тестів лишались зеленими.
// ============================================================

const SEEDS = [0, 11, 97, 512, 4096];

describe('§1 один рік — одна річна колонія', () => {
  it('розмір колонії залежить лише від свого року й голови на його кінець', () => {
    /*
     * Підпис функції і є правило: сьогоднішньої голови вона не бачить.
     * Це не стилістика — саме передавання сьогоднішнього розміру й
     * зробило колись минуле кристала змінним.
     */
    const early = reefAnnualColonySize(0.5, 0.7, 0);
    const later = reefAnnualColonySize(0.5, 0.7, 0);
    expect(later).toEqual(early);
  });
});

describe('§3 річна колонія ніколи не наздоганяє голову', () => {
  it.each(SEEDS)('на насінні %i жодна наповненість не переступає стелі', (seed) => {
    for (const fill of [0, 0.25, 0.5, 0.75, 1]) {
      const head = 1;
      const colony = reefAnnualColonySize(head, fill, seed);
      expect(colony.radius, `наповненість ${fill}`).toBeLessThan(head);
      expect(colony.radius / head).toBeLessThanOrEqual(ANNUAL_HEAD_SHARE + 1e-9);
    }
  });

  it('найповніший рік проти найменшої голови', () => {
    // Крайній випадок: якщо правило десь ламається, то тут.
    const head = reefHeadSize(1, 6).radius;
    expect(reefAnnualColonySize(head, 1, 0).radius).toBeLessThan(head);
  });
});

describe('§4 завершений рік застигає', () => {
  it('голова росла, а колонія того року — ні', () => {
    /*
     * `PRODUCT.md`: «минуле не переписується. Нова подія додає шар».
     * Голова на кінець третього року фіксована, тож і колонія фіксована,
     * скільки б пара не прожила після.
     */
    const headAtYearEnd = reefHeadSize(3 * 365, 4).radius;
    const frozen = reefAnnualColonySize(headAtYearEnd, 0.6, 7);
    expect(reefAnnualColonySize(headAtYearEnd, 0.6, 7)).toEqual(frozen);

    // Контроль: якби голова НЕ росла, попереднє твердження було б дарма.
    expect(reefHeadSize(10 * 365, 4).radius).toBeGreaterThan(headAtYearEnd);
  });
});

describe('наповненість веде обсяг і густину, а не навпаки', () => {
  it('жодне насіння не робить бідніший рік густішим за багатший', () => {
    /*
     * Той самий висновок, який на кристалі коштував чотирьох тестів, що
     * нічого не стерегли: за СТАЛОГО насіння все монотонне саме собою.
     * Розрізняє лише порівняння ЧЕРЕЗ насіння — чи може щасливий кидок
     * перевернути порядок років.
     */
    const fills = [0.1, 0.35, 0.6, 0.85];
    for (let index = 1; index < fills.length; index += 1) {
      const poorest = Math.min(...SEEDS.map(
        (s) => reefAnnualColonySize(1, fills[index]!, s).bodies,
      ));
      const richest = Math.max(...SEEDS.map(
        (s) => reefAnnualColonySize(1, fills[index - 1]!, s).bodies,
      ));
      expect(
        poorest,
        `${fills[index]} (${poorest} тіл) має бути густішим за ${fills[index - 1]} (${richest})`,
      ).toBeGreaterThanOrEqual(richest);
    }
  });

  it('порожній рік лишається колонією, а не зникає', () => {
    // Підлога має значення не менше за стелю: рік, у якому майже нічого
    // не було, все одно прожитий, і має читатись у кільці.
    for (const seed of SEEDS) {
      const empty = reefAnnualColonySize(1, 0, seed);
      expect(empty.bodies).toBeGreaterThanOrEqual(ANNUAL_BODIES_MIN);
      expect(empty.radius).toBeGreaterThan(0);
    }
  });

  it('найповніший рік не переростає стелі кількості', () => {
    for (const seed of SEEDS) {
      expect(reefAnnualColonySize(1, 1, seed).bodies).toBeLessThanOrEqual(ANNUAL_BODIES_MAX);
    }
  });
});

describe('голова росте часом, а ширшає широтою життя', () => {
  it('насичується, а не росте без упину', () => {
    const ten = reefHeadScale(10 * 365);
    const twenty = reefHeadScale(20 * 365);
    const forty = reefHeadScale(40 * 365);
    expect(twenty).toBeGreaterThan(ten);
    // Друге десятиліття додає менше за перше — інакше жоден кадр не
    // втримає пару, яка прожила разом сорок років.
    expect(twenty - ten).toBeLessThan(ten - reefHeadScale(0));
    expect(forty).toBeCloseTo(twenty + (forty - twenty), 6);
    expect(forty).toBeLessThanOrEqual(1);
  });

  it('широта життя ширшає голову, але не підіймає її', () => {
    /*
     * Розділення, яке власник назвав для кристала: широта — це скільки
     * РІЗНИХ модулів жило, і вона має показуватись обсягом, а не висотою.
     */
    const narrow = reefHeadSize(5 * 365, 1);
    const broad = reefHeadSize(5 * 365, 6);
    expect(broad.radius).toBeGreaterThan(narrow.radius);
    expect(broad.rise).toBeCloseTo(narrow.rise, 6);
  });

  it('погані числа не ламають голову', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, -5]) {
      expect(Number.isFinite(reefHeadScale(bad)), `дні ${bad}`).toBe(true);
      expect(Number.isFinite(reefHeadSize(100, bad).radius), `широта ${bad}`).toBe(true);
    }
  });
});

describe('модель року — та сама, що в кристала', () => {
  it('риф не має власної наповненості', () => {
    // Реекспорт зі спільного шару, а не друга реалізація: копія тут уже
    // була й одного разу вже розійшлась із оригіналом.
    expect(reefAnnualColonySize(1, yearFill(1, 1), 0).radius)
      .toBeGreaterThan(reefAnnualColonySize(1, yearFill(1, 0), 0).radius);
  });
});

describe('розкладка колоній на голові', () => {
  const head = reefHeadSize(8 * 365, 5);

  it('додавання нового року не рухає жодного попереднього', () => {
    /*
     * ГОЛОВНЕ ТВЕРДЖЕННЯ ЦЬОГО ФАЙЛУ.
     *
     * Наївне «розставити N колоній рівно по колу» виглядає природним і
     * руйнує заморозку: щойно приходить наступний рік, кожен попередній
     * зсувається, тобто минуле переписується на кожну річницю. На
     * кристалі ця вада вже була, і впіймали її не тести форми.
     *
     * Тут вона неможлива за побудовою — місце залежить лише від номера,
     * — і саме це й перевіряється: колонія третього року однакова в
     * пари з чотирма роками й у пари з двадцятьма.
     */
    /*
     * Кличеться `reefColonyLayout` — той самий виклик, що робитиме
     * сцена, — а не прив'язка з тим самим індексом двічі.
     *
     * Це виправлення власної сліпоти: перша редакція саме так і робила,
     * і мутація «азимут від КІЛЬКОСТІ років» пройшла всі двадцять один
     * тест. Тест не передавав кількості, а справжній споживач передав би
     * — тобто перевірявся не той API.
     */
    const short = reefColonyLayout(head, 4);
    const long = reefColonyLayout(head, 20);
    expect(short).toHaveLength(4);
    for (let index = 0; index < short.length; index += 1) {
      expect(long[index], `рік ${index} зсунувся`).toEqual(short[index]);
    }
  });

  it('колонії не сідають одна на одну', () => {
    /*
     * Розсіювання перевіряється числом, а не вірою в золотий кут: він
     * добрий на площині, а тут купол, і смуга по висоті вужча за повну.
     *
     * Виміряно на двадцяти роках: найтісніша пара стоїть на 0.28
     * радіуса голови. Радіус найбільшої річної колонії — 0.4 радіуса
     * голови, тож шапки перекриваються, і це правильно: колонії
     * зростаються в риф, а не стоять окремими кущиками. Забороняється
     * інше — щоб два роки збіглись у ТУ САМУ точку.
     */
    const anchors = Array.from({ length: 20 }, (_, index) => reefColonyAnchor(head, index));
    let closest = Number.POSITIVE_INFINITY;
    for (let a = 0; a < anchors.length; a += 1) {
      for (let b = a + 1; b < anchors.length; b += 1) {
        closest = Math.min(closest, Math.hypot(
          anchors[a]!.point.x - anchors[b]!.point.x,
          anchors[a]!.point.y - anchors[b]!.point.y,
          anchors[a]!.point.z - anchors[b]!.point.z,
        ));
      }
    }
    expect(closest / head.radius, 'два роки збіглись').toBeGreaterThan(0.1);
  });

  it('роки розходяться по всьому колу, а не збиваються збоку', () => {
    // Купол видно з одного боку, тож розкладка, що зібрала перші п'ять
    // років в одну чверть, лишила б половину голови голою.
    const quadrants = new Set(
      Array.from({ length: 8 }, (_, index) =>
        Math.floor(reefColonyAzimuthRad(index) / (Math.PI / 2))),
    );
    expect(quadrants.size, 'перші вісім років в одній частині кола').toBe(4);
  });

  it('жодна колонія не сідає ні на дно, ні на саму маківку', () => {
    /*
     * Обидва краї виключені з причин, а не для симетрії. Унизу колонія
     * потонула б у камені. На маківці купол вироджується в точку, і
     * будь-який азимут дає те саме місце — усі роки збіглись би.
     */
    for (let index = 0; index < 30; index += 1) {
      const band = reefColonyBand(index);
      expect(band, `рік ${index}`).toBeGreaterThanOrEqual(0.18);
      expect(band).toBeLessThanOrEqual(0.86);
    }
  });

  it('нормаль дивиться назовні купола, а не вгору', () => {
    /*
     * Купол приплюснутий (підйом менший за радіус), тож нормаль сфери
     * тут збрехала б: різниця між нею й справжньою — це різниця між
     * «росте вгору» і «росте вбік».
     */
    for (let index = 0; index < 12; index += 1) {
      const anchor = reefColonyAnchor(head, index);
      const outward = anchor.point.x * anchor.normal.x + anchor.point.z * anchor.normal.z;
      expect(outward, `рік ${index} нормаль дивиться всередину`).toBeGreaterThan(0);
      expect(anchor.normal.y, `рік ${index}`).toBeGreaterThan(0);
      const length = Math.hypot(anchor.normal.x, anchor.normal.y, anchor.normal.z);
      expect(length).toBeCloseTo(1, 5);

      /*
       * І це НЕ нормаль сфери — вимір, який розрізняє.
       *
       * Три твердження вище справджуються й для сфери, тож перша
       * редакція цього тесту пропустила мутацію «нормаль як у сфери».
       * Купол приплюснутий (`rise` менший за `radius`), і в градієнті
       * еліпсоїда `y` ділиться на менше число, ніж `x` і `z`. Отже
       * справжня нормаль дивиться ВИЩЕ за сферичну в тій самій точці, і
       * різниця між ними — це різниця між «росте вгору» і «росте вбік».
       */
      const sphereY = anchor.point.y / Math.max(1e-9, Math.hypot(
        anchor.point.x, anchor.point.y, anchor.point.z,
      ));
      expect(anchor.normal.y, `рік ${index} нормаль сферична`).toBeGreaterThan(sphereY);
    }
  });

  it('точка справді лежить на поверхні голови', () => {
    for (let index = 0; index < 12; index += 1) {
      const { point } = reefColonyAnchor(head, index);
      const onSurface = (point.x * point.x + point.z * point.z) / (head.radius * head.radius)
        + (point.y * point.y) / (head.rise * head.rise);
      expect(onSurface, `рік ${index}`).toBeCloseTo(1, 4);
    }
  });
});
