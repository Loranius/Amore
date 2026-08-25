import { describe, expect, it } from 'vitest';
import { yearFill } from '../shared/relationshipYear';
import {
  ANNUAL_BODIES_MAX,
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
