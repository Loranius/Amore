import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildCrystalSpeciesBlueprint } from './crystalSpecies';
import { coupleTint } from './growthModel';

// ============================================================
// Три умови, які власник назвав необговорюваними.
// ------------------------------------------------------------
// Вони записані окремим файлом, а не дописані до `crystalSpecies.test.ts`,
// навмисно: решта тестів стереже те, ЯК модель рахує, а ці — те, ЧОГО
// вона не має права робити, хай як її перерахують.
//
// Приводом стало саме те, що ці правила НЕ впіймались. Коли дітей
// перевели з «мірятись сьогоднішнім монархом» на «застигати у своєму
// році» — зміну, яка міняє розмір кожного тіла в кільці, — усі 96
// наявних тестів лишились зеленими. Тобто найважливіше в моделі не
// стеріг ніхто.
// ============================================================

const MODULES = ['memories', 'plans', 'wishlist', 'calendar', 'media', 'shopping'] as const;

/**
 * Історія на задану кількість років.
 *
 * Дати будуються з індексів, а не з годинника: рушій не має права
 * залежати від того, коли запустили тест.
 */
function history(years: number, perYear: number): EvolutionEventInput[] {
  const events: EvolutionEventInput[] = [];
  for (let year = 0; year < years; year += 1) {
    for (let index = 0; index < perYear; index += 1) {
      const module = MODULES[index % MODULES.length]!;
      const month = String(1 + (index % 12)).padStart(2, '0');
      const day = String(1 + (index % 27)).padStart(2, '0');
      events.push({
        id: `${module}:${year}:${index}`,
        occurredAt: `${2024 + year}-${month}-${day}`,
        source: `${module}@1`,
        evidence: 'verified',
        channels: { remembrance: 0.4, stability: 0.2 },
        portalActivity: 0.1,
      });
    }
  }
  return events;
}

function buildCrystal(events: readonly EvolutionEventInput[], asOf: string) {
  return buildCrystalSpeciesBlueprint({
    artifact: buildArtifactBlueprint({
      coupleId: 'amore:owner-rules',
      config: {
        engineVersion: '1.0.0',
        relationshipStartedAt: '2024-01-01',
        timeZone: 'Europe/Kyiv',
        leapDayPolicy: 'feb-28',
      },
      events,
    }),
    config: { asOf, rulesVersion: 'crystal-1.0.0' },
  });
}

describe('§1 один рік — один дочірній кристал', () => {
  it.each([
    ['2024-06-01', 1],
    ['2025-06-01', 2],
    ['2026-06-01', 3],
    ['2030-06-01', 7],
  ])('на %s кільце має %i тіл', (asOf, expected) => {
    /*
     * Рахуються ЗАВЕРШЕНІ роки плюс той, який триває. Пара на півдорозі
     * до першої річниці вже має один кристал — свій поточний рік, — бо
     * інакше перші дванадцять місяців артефакт був би порожній.
     */
    const crystal = buildCrystal(history(8, 6), asOf);
    expect(crystal.formations).toHaveLength(expected);
  });

  it('жодного тіла, крім монарха й років', () => {
    /*
     * Тут була ще «спідниця» — до двадцяти чотирьох дрібних кристалів за
     * виконані плани, які стояли біля монарха й не кріпились до неї.
     * Власник зажадав цільного кристала, і саме спідниця робила з нього
     * купу.
     */
    const crystal = buildCrystal(history(5, 12), '2028-06-01');
    const kinds = new Set(crystal.formations.map((formation) => formation.kind));
    expect([...kinds]).toEqual(['annual']);
  });

  it('роки не дублюються й не пропускаються', () => {
    const crystal = buildCrystal(history(6, 4), '2029-06-01');
    const epochs = crystal.formations.map((formation) => formation.epochIndex);
    expect(epochs).toEqual([...epochs].sort((a, b) => a - b));
    expect(new Set(epochs).size).toBe(epochs.length);
    expect(epochs[0]).toBe(0);
  });
});

describe('§2 дочірні ніколи не наздоганяють монарха', () => {
  /*
   * Правило виконується ЗА ПОБУДОВОЮ: монарх лише росте, а дитина
   * зафіксована на частці його висоти на кінець СВОГО року. Але
   * «за побудовою» — це твердження про сьогоднішній код, а не про
   * завтрашній, тож воно перевіряється числом.
   */
  const AGES = ['2024-06-01', '2025-03-01', '2026-06-01', '2028-01-01', '2031-06-01', '2040-06-01'];
  const DENSITIES = [1, 4, 12, 40];

  it.each(AGES)('на %s жодна дитина не сягає монарха', (asOf) => {
    for (const perYear of DENSITIES) {
      const crystal = buildCrystal(history(16, perYear), asOf);
      const monarch = crystal.mother.axialScale;
      for (const child of crystal.formations) {
        expect(
          child.axialScale,
          `${asOf}, ${perYear} подій/рік, ${child.id}`,
        ).toBeLessThan(monarch);
        // Не просто «менша», а з тим запасом, який назвав власник.
        expect(child.axialScale / monarch).toBeLessThanOrEqual(0.4 + 1e-9);
      }
    }
  });

  it('найповніша можлива дитина програє найбіднішому монарху', () => {
    // Крайній випадок: рік, набитий подіями всіх модулів, проти пари,
    // яка щойно почалась. Якщо правило десь ламається, то тут.
    const crystal = buildCrystal(history(1, 60), '2024-12-31');
    for (const child of crystal.formations) {
      expect(child.axialScale).toBeLessThan(crystal.mother.axialScale);
    }
  });
});

describe('§3 завершений рік більше не змінюється', () => {
  it('дитина, застигла торік, лишається тією самою й через роки', () => {
    /*
     * `PRODUCT.md`: «минуле не переписується. Нова подія додає шар».
     * До цієї правки діти мірялись сьогоднішнім монархом, тож кожен
     * прожитий день ТИХО збільшував усі минулі роки — тобто минуле
     * переписувалось на кожному відкритті головної.
     */
    const events = history(6, 8);
    const early = buildCrystal(events, '2026-06-01');
    const late = buildCrystal(events, '2030-06-01');

    const frozen = (crystal: typeof early, epoch: number) =>
      crystal.formations.find((formation) => formation.epochIndex === epoch);

    for (const epoch of [0, 1]) {
      const before = frozen(early, epoch);
      const after = frozen(late, epoch);
      expect(before, `рік ${epoch} має існувати в обох`).toBeDefined();
      expect(after).toBeDefined();
      expect(after!.axialScale).toBe(before!.axialScale);
    }
  });

  it('а монарх за той самий час виріс', () => {
    // Контроль: якби виріс НІХТО, попередній тест проходив би дарма.
    const events = history(6, 8);
    expect(buildCrystal(events, '2030-06-01').mother.axialScale)
      .toBeGreaterThan(buildCrystal(events, '2026-06-01').mother.axialScale);
  });
});

describe('§4 колір пари — з дати початку, і назавжди', () => {
  /*
   * Четверта умова власника: «колір кристала у кожної пари
   * індивідуальний». Джерело він обрав сам — дата початку стосунків.
   */

  it('та сама дата завжди дає той самий колір', () => {
    // Це і є сенс «ідентичності»: колір не має права поповзти між двома
    // відкриттями головної.
    expect(coupleTint('2022-12-26')).toEqual(coupleTint('2022-12-26'));
  });

  it('палітра справді розгорнута, а сусідні відтінки — розрізнювані', () => {
    /*
     * «Індивідуальний» тут означає перевірну річ, і не ту, якою вона
     * здається спершу.
     *
     * Перша редакція стверджувала «різні дати → різні кольори». Це
     * НЕПРАВДА за побудовою: дуга родини ділиться на дев'ять щаблів, тож
     * дві дати можуть сісти на один — і мусять, інакше щаблі не мали б
     * сенсу. Твердження впало на реальних датах (2018-12-15 і 2019-01-15
     * дають той самий `1.000,0.438,0.766`), і правильно зробило.
     *
     * Правда, яку варто стерегти, інша: палітра НЕ вироджена — вона
     * справді розходиться по родині, — і два РІЗНІ відтінки видно
     * оком, а не лише в числах.
     */
    const dates: string[] = [];
    for (let year = 2018; year < 2026; year += 1) {
      for (const month of ['01', '04', '07', '10']) dates.push(`${year}-${month}-15`);
    }
    const seen = new Map<string, readonly number[]>();
    for (const date of dates) {
      const rgb = coupleTint(date).rgb;
      seen.set(rgb.join(','), rgb);
    }

    // Дев'ять щаблів на тридцяти двох датах: виродження в один-два тони
    // означало б, що дата на колір майже не впливає.
    expect(seen.size, 'палітра вироджена').toBeGreaterThanOrEqual(6);

    const distance = (a: readonly number[], b: readonly number[]) =>
      Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
    const shades = [...seen.values()];
    for (let i = 0; i < shades.length; i += 1) {
      for (let j = i + 1; j < shades.length; j += 1) {
        // Найтісніша пара сусідніх щаблів, виміряна на цій дузі, — 0.14.
        expect(distance(shades[i]!, shades[j]!)).toBeGreaterThan(0.1);
      }
    }
  });

  it('колір лишається каменем, а не фарбою', () => {
    /*
     * Крізь кристал видно світло, тож жоден канал не має падати надто
     * низько: тіло, залите чистим тоном, читається пластиком. Смуга та
     * сама, що була відкалібрована для трьох мінеральних тонів.
     */
    for (const date of ['2022-12-26', '2020-01-01', '2018-08-08', '2025-05-05']) {
      const { rgb, iridescence } = coupleTint(date);
      for (const channel of rgb) {
        expect(channel, `${date}: канал поза смугою`).toBeGreaterThan(0.25);
        expect(channel).toBeLessThanOrEqual(1);
      }
      // Хоч один канал майже повний — інакше це сірий, а не відтінок.
      expect(Math.max(...rgb), `${date}: немає провідного каналу`).toBeGreaterThan(0.9);
      expect(iridescence).toBeGreaterThanOrEqual(0.14);
      expect(iridescence).toBeLessThanOrEqual(0.42);
    }
  });

  it('порожня дата лишає кристал білим, а не вигадує колір', () => {
    expect(coupleTint('').rgb).toEqual([1, 1, 1]);
    expect(coupleTint('   ').rgb).toEqual([1, 1, 1]);
  });

  it('монарх і всі його роки одного кольору', () => {
    /*
     * Друга половина «цільності». Раніше монарх мав один тон, а кожна
     * дитина — свій, за подарунки того року. Колір належить парі, а не
     * рокові, тож у одного кристала він може бути лише один.
     */
    const crystal = buildCrystal(history(5, 6), '2028-06-01');
    for (const child of crystal.formations) {
      expect(child.tintRgb, child.id).toEqual(crystal.mother.tintRgb);
      expect(child.iridescence, child.id).toBe(crystal.mother.iridescence);
    }
  });

  it('колір не змінюється, скільки б пара не прожила', () => {
    const events = history(6, 8);
    const young = buildCrystal(events, '2025-06-01');
    const old = buildCrystal(events, '2031-06-01');
    expect(old.mother.tintRgb).toEqual(young.mother.tintRgb);
  });
});
