import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { buildCrystalSpeciesBlueprint } from './crystalSpecies';

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
