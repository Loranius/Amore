import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type ArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { PORTAL_MODULES } from '../shared/relationshipYear';
import { treeToOrganicField } from './organicAdapter';
import { buildTreeSpeciesBlueprint } from './treeSpecies';

const SOURCES = ['memories@1', 'plans@1', 'wishlist@1', 'calendar@1', 'media@1', 'map@1'];
const AS_OF = '2026-08-30T12:00:00+03:00';

/** Пара, чиї роки торкались рівно `moduleCount` модулів. */
function couple(moduleCount: number, perYear = 24, years = 3): ArtifactBlueprint {
  const start = new Date(Date.UTC(2026 - years, 7, 30));
  const events: EvolutionEventInput[] = [];
  for (let year = 0; year < years; year += 1) {
    for (let index = 0; index < perYear; index += 1) {
      const day = new Date(start.getTime()
        + (year + (index + 0.5) / perYear) * 365.2425 * 86_400_000);
      events.push({
        id: `m${moduleCount}:${year}:${index}`,
        occurredAt: `${day.toISOString().slice(0, 10)}T12:00:00+03:00`,
        source: SOURCES[index % moduleCount]!,
        evidence: 'verified',
        channels: { remembrance: 0.5, culture: 0.3, exploration: 0.4 },
        portalActivity: 0.3,
      });
    }
  }
  return buildArtifactBlueprint({
    coupleId: `amore:modules-${moduleCount}`,
    config: {
      engineVersion: 'tree-preview-1.0.0',
      relationshipStartedAt: start.toISOString().slice(0, 10),
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
    events,
  });
}

function vigourOfFirstYear(moduleCount: number): number {
  const species = buildTreeSpeciesBlueprint({
    artifact: couple(moduleCount),
    config: { asOf: AS_OF, rulesVersion: 'tree-species-modules' },
  });
  return treeToOrganicField(species).selfOrganizingConfig.vigourByCycle![0]!;
}

describe('Дерево чує модулі', () => {
  it('counts every source the engine actually hears, and only those', () => {
    /*
     * Знаменник широти — `PORTAL_MODULES`, і він мусить збігатися зі
     * складом адаптерів. Якби в ньому були модулі, яких рушій не чує,
     * широта ніколи не дійшла б до одиниці, і повністю прожитий рік
     * виглядав би наполовину порожнім.
     *
     * Склад ЗАФІКСОВАНО рішенням власника (ADR-0017): покупки, гра, «куди
     * піти», кулінарія — свідомо не впливають на артефакт. Тому цей тест
     * стереже не «щоб модулів було більше», а щоб список і адаптери не
     * розійшлись мовчки.
     */
    expect([...PORTAL_MODULES].sort()).toEqual(
      ['calendar', 'map', 'media', 'memories', 'plans', 'wishlist'],
    );
  });

  it('grows visibly more for a year that touched more of the portal', () => {
    /*
     * ВАДА, ЯКУ ЦЕЙ ТЕСТ ТРИМАЄ ЗАЧИНЕНОЮ, І ВОНА БУЛА ТИХОЮ.
     *
     * Сила росту бралась від `instruction.weight`, а в нього вбудовано поріг
     * `0.3 + 0.55 * fill`: навіть порожній рік має 35% ваги повного. Поріг
     * там доречний — тихий рік мусить лишити видиму гілку, — але як МІРА
     * прожитого `weight` непридатний.
     *
     * Виміряно на парах, чиї роки торкались різної кількості модулів:
     *
     *   від `weight`: 1 модуль -> сила 12.7, 6 -> 14.1   (+11%)
     *   від `fill`:   1 модуль -> сила 12.0, 6 -> 15.2   (+27%)
     *
     * Тобто життя вшестеро ширше давало на одну десяту більше дерева. Пара
     * не могла побачити в дереві, що почала користуватись порталом ширше, —
     * а це й є те, заради чого артефакт існує.
     *
     * ЧОМУ ПОРІГ 1.18, А НЕ БІЛЬШЕ. Не тому, що більшого не досягти, а тому,
     * що більше НЕ ВМІЩУЄТЬСЯ. Виміряно на 24 деревах активної пари:
     *
     *   без насичення сили: відповідь 1.26x, порушень бюджету 1 з 24
     *   з колінoм 13/15.5:  відповідь 1.20x, порушень 0 з 24
     *
     * Мобільна стеля — це обіцянка справжньому телефону, тож узято найбільшу
     * відповідь, яка вміщується. Поріг тесту трохи нижчий за неї, щоб він
     * стеріг закон, а не фіксував сьогоднішнє число до сотих.
     */
    const lean = vigourOfFirstYear(1);
    const rich = vigourOfFirstYear(6);

    expect(rich).toBeGreaterThan(lean * 1.18);
  });

  it('answers every extra module, not just the last one', () => {
    // Монотонність: кожен наступний модуль додає, інакше «ширше життя»
    // означало б різне в різних місцях шкали.
    const series = [1, 2, 3, 4, 5, 6].map(vigourOfFirstYear);
    for (let index = 1; index < series.length; index += 1) {
      expect({ index, grew: series[index]! > series[index - 1]! })
        .toEqual({ index, grew: true });
    }
  });

  it('keeps a quiet year on the tree instead of erasing it', () => {
    /*
     * Зворотний бік тієї ж вимоги, і він важить не менше: рік, у якому пара
     * майже нічого не робила, мусить лишити гілку, а не зникнути. Саме тому
     * база сили не нульова.
     */
    expect(vigourOfFirstYear(1)).toBeGreaterThan(6);
  });
});
