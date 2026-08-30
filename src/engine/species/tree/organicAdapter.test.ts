import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint, type EvolutionEventInput } from '../../evolution';
import { DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG, treeToOrganicField } from './organicAdapter';
import { buildTreeSpeciesBlueprint } from './treeSpecies';
import type { TreeGrowthInstruction, TreeSpeciesBlueprint } from './types';

/** Пара з трьома прожитими роками — те саме дерево, що стоїть на головній. */
function livingTree(): TreeSpeciesBlueprint {
  const events: EvolutionEventInput[] = [];
  for (let index = 0; index < 36; index += 1) {
    const day = new Date(Date.UTC(2022, 11, 26) + index * 30 * 86_400_000);
    events.push({
      id: `probe:${index}`,
      occurredAt: `${day.toISOString().slice(0, 10)}T12:00:00+03:00`,
      source: 'memories-preview@1',
      evidence: 'verified',
      channels: { remembrance: 0.5, culture: 0.3, exploration: 0.4 },
      portalActivity: 0.3,
    });
  }
  return buildTreeSpeciesBlueprint({
    artifact: buildArtifactBlueprint({
      coupleId: 'amore:fan-probe',
      config: {
        engineVersion: 'tree-preview-1.0.0',
        relationshipStartedAt: '2022-12-26',
        timeZone: 'Europe/Kyiv',
        leapDayPolicy: 'feb-28',
      },
      events,
    }),
    config: { asOf: '2026-08-30T12:00:00+03:00', rulesVersion: 'tree-species-fan-probe' },
  });
}

/**
 * Дерево з ОДНИМ роком на заданій висоті.
 *
 * Потрібне саме синтетичне: канал вибирає висоту сам (`achievement` дає
 * 0.67..0.93), і підібрати подіями рік, що стане рівно під стелею крони,
 * означало б залежати від того, як канали рахуються сьогодні.
 */
function oneYearAt(preferredElevation: number, radialBias = 0.5): TreeSpeciesBlueprint {
  const base = livingTree();
  const instruction: TreeGrowthInstruction = {
    ...base.growth[0]!,
    attractorCount: 6,
    preferredElevation,
    radialBias,
  };
  return { ...base, growth: [instruction] };
}

function elevations(blueprint: TreeSpeciesBlueprint): number[] {
  const { trunkHeight, crownHeight } = blueprint.structure;
  return treeToOrganicField(blueprint).attractors
    .map((attractor) => (attractor.position.y - trunkHeight) / crownHeight)
    .sort((left, right) => left - right);
}

describe('Tree organic adapter — віяло року', () => {
  it('does not stack a year on one altitude and one radius', () => {
    /*
     * ВАДА, ЯКУ ЦЕЙ ТЕСТ ТРИМАЄ ЗАЧИНЕНОЮ.
     *
     * Порода дає на рік одну висоту й один відступ. Адаптер розкладав віялом
     * ЛИШЕ азимут, тож усі атрактори року сідали на одну висоту та один
     * радіус — рік ставав дугою горизонтального кільця. Гілки ростуть тільки
     * туди, куди тягнуть атрактори, тож крона виходила суцільним шаром: 9
     * гілок з 11 починались у смузі y 4.49..4.62, а на екрані всередині крони
     * лишалось 5-8.5% неба.
     *
     * ЧОМУ ЖОДЕН ТЕСТ ЦЬОГО НЕ БАЧИВ. Усі перевірки адаптера питали, скільки
     * атракторів і в якому порядку, — і на це він відповідав правильно. Про
     * те, чи вони РОЗІЙШЛИСЬ, не питав ніхто.
     *
     * Пороги нижче — не круглі числа: за нинішнього віяла рік розходиться на
     * 0.30 висоти крони й 0.25 її радіуса; зі звуженим до нуля віялом
     * лишається лише тремтіння ±0.06, тобто розкид ≈0.12. Порог 0.18 лежить
     * між цими двома станами, тож він падає рівно тоді, коли віяло зникає.
     */
    const blueprint = livingTree();
    const field = treeToOrganicField(blueprint);
    const { trunkHeight, crownHeight, crownRadius } = blueprint.structure;

    for (const instruction of blueprint.growth) {
      const own = field.attractors.filter((attractor) => attractor.id.startsWith(`${instruction.id}:`));
      expect(own.length).toBe(instruction.attractorCount);
      if (own.length < 3) continue;

      const ys = own.map((a) => (a.position.y - trunkHeight) / crownHeight);
      const rs = own.map((a) => Math.hypot(a.position.x, a.position.z) / crownRadius);
      expect({ id: instruction.id, spread: Math.max(...ys) - Math.min(...ys) > 0.18 })
        .toEqual({ id: instruction.id, spread: true });
      expect({ id: instruction.id, spread: Math.max(...rs) - Math.min(...rs) > 0.18 })
        .toEqual({ id: instruction.id, spread: true });
    }
  });

  it('fills the band evenly instead of leaving a hole in it', () => {
    /*
     * Розкид сам собою ще не означає заповнення: два атрактори на краях смуги
     * дали б той самий розкид і порожнечу посередині — тобто ДВА шари замість
     * одного. Страти для того й заведені, щоб такого не було.
     *
     * Найбільший проміжок між сусідніми висотами не має перевищувати подвійну
     * ширину страти. Виміряно: за шести атракторів найбільший проміжок —
     * 0.11 при ширині страти 0.117, тобто вдвічі менше за поріг.
     */
    const blueprint = oneYearAt(0.5);
    const sorted = elevations(blueprint);
    const stratum = DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.elevationFan / sorted.length;
    let widest = 0;
    for (let index = 1; index < sorted.length; index += 1) {
      widest = Math.max(widest, sorted[index]! - sorted[index - 1]!);
    }
    expect(widest).toBeLessThan(stratum * 2);
  });

  it('does not let a year become a tilted arc', () => {
    /*
     * ЧОМУ `stratumOrder` ІСНУЄ.
     *
     * Азимут розкладено за індексом. Якби висота теж ішла за індексом, вона
     * була б ФУНКЦІЄЮ азимута — і рік вийшов би не об'ємом, а нахиленою
     * дугою: збоку це та сама дуга, лише під кутом, тобто вада лишилась би на
     * місці, змінивши тільки нахил.
     *
     * Тест міряє це прямо: кореляція між порядком за азимутом і порядком за
     * висотою має бути далеко від одиниці. Якщо прибрати перемішування, вона
     * стане рівно 1 (або −1) — і тест упаде.
     */
    const blueprint = oneYearAt(0.5);
    const { trunkHeight, crownHeight } = blueprint.structure;
    const attractors = treeToOrganicField(blueprint).attractors;
    const count = attractors.length;
    const ys = attractors.map((a) => (a.position.y - trunkHeight) / crownHeight);
    const indices = ys.map((_, index) => index);
    const meanIndex = (count - 1) / 2;
    const meanY = ys.reduce((sum, y) => sum + y, 0) / count;

    let covariance = 0;
    let indexVariance = 0;
    let yVariance = 0;
    for (const index of indices) {
      covariance += (index - meanIndex) * (ys[index]! - meanY);
      indexVariance += (index - meanIndex) ** 2;
      yVariance += (ys[index]! - meanY) ** 2;
    }
    const correlation = covariance / Math.sqrt(indexVariance * yVariance);
    expect(Math.abs(correlation)).toBeLessThan(0.75);
  });

  it('narrows the fan at the crown ceiling instead of piling up against it', () => {
    /*
     * ВАДА, ЯКОЇ ТУТ НЕ СТАЛОСЬ, І ЯКУ Я МАЛО НЕ ЗАЛИШИВ.
     *
     * Перша редакція просто обрізала висоту межами крони. На цьому дереві
     * ніщо не впиралось — три його роки стоять посередині, — але канал
     * `achievement` дає рік аж до висоти 0.95, а віяло має півширину 0.35.
     * Такий рік уперся б у стелю ПОЛОВИНОЮ своїх атракторів, і всі вони
     * лягли б на неї в одну точку — тобто обрізання повернуло б рівно той
     * шар, заради розсування якого віяло й заведене, лише під самою стелею.
     *
     * Тому смуга звужується до наявного місця. Перевіряється і те, і те:
     * жодного дубля на самій межі — і рік усе одно РОЗХОДИТЬСЯ, хай і вужче.
     */
    const sorted = elevations(oneYearAt(0.95));
    const factor = sorted.map((value) => Math.round(value * 1e6) / 1e6);

    expect(Math.max(...factor)).toBeLessThanOrEqual(0.96 + 1e-6);
    expect(new Set(factor).size).toBe(factor.length);
    expect(Math.max(...factor) - Math.min(...factor)).toBeGreaterThan(0.05);

    // Те саме біля підлоги крони, з іншого боку смуги.
    const low = elevations(oneYearAt(0.02)).map((value) => Math.round(value * 1e6) / 1e6);
    expect(Math.min(...low)).toBeGreaterThanOrEqual(0.04 - 1e-6);
    expect(new Set(low).size).toBe(low.length);
  });

  it('keeps a narrow radial year outside the trunk', () => {
    // Віяло по радіусу може завести атрактор всередину стовбура, а від'ємний
    // радіус — це вже дзеркальний азимут, тобто гілка в протилежний бік.
    const blueprint = oneYearAt(0.5, 0.02);
    const { crownRadius } = blueprint.structure;
    for (const attractor of treeToOrganicField(blueprint).attractors) {
      expect(Math.hypot(attractor.position.x, attractor.position.z) / crownRadius)
        .toBeGreaterThan(0);
    }
  });

  it('leaves the year where its azimuth put it', () => {
    /*
     * Рік упізнається по азимуту, і саме азимут віяло НЕ чіпає — тут це
     * перевірено прямо, зіставленням із тим самим деревом при нульовому
     * віялі.
     *
     * ПЕРША РЕДАКЦІЯ ЦЬОГО ТЕСТУ СТВЕРДЖУВАЛА ІНШЕ — що будь-які два роки
     * стоять на радіан один від одного, — і це просто неправда: азимут року
     * йде золотим кутом, а на четвертому році спіраль повертається близько до
     * першого. Тест падав на власному хибному очікуванні, а не на ваді коду.
     * Розводить роки спіраль, а не віяло; віяло лише не має їй заважати.
     */
    const blueprint = livingTree();
    const centers = (elevationFan: number, radialFan: number) => {
      const field = treeToOrganicField(blueprint, {
        ...DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG, elevationFan, radialFan,
      });
      return blueprint.growth.map((instruction) => {
        const own = field.attractors.filter((a) => a.id.startsWith(`${instruction.id}:`));
        const angles = own.map((a) => Math.atan2(a.position.z, a.position.x));
        return Math.atan2(
          angles.reduce((sum, angle) => sum + Math.sin(angle), 0) / angles.length,
          angles.reduce((sum, angle) => sum + Math.cos(angle), 0) / angles.length,
        );
      });
    };

    const flat = centers(0, 0);
    const fanned = centers(
      DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.elevationFan,
      DEFAULT_TREE_ORGANIC_ADAPTER_CONFIG.radialFan,
    );
    expect(fanned).toHaveLength(flat.length);
    for (let index = 0; index < flat.length; index += 1) {
      // Розгортка виміряла зсув центрів на соті радіана; десята — стеля з
      // великим запасом, за яку віяло не має права винести рік.
      const delta = Math.abs(Math.atan2(
        Math.sin(fanned[index]! - flat[index]!),
        Math.cos(fanned[index]! - flat[index]!),
      ));
      expect({ index, moved: delta < 0.1 }).toEqual({ index, moved: true });
    }
  });

  it('places the same tree the same way twice', () => {
    // Віяло тримається на `seededUnit` і на порядку страт; будь-яка залежність
    // від порядку перебору чи від нестабільного сортування зламала б це.
    const blueprint = livingTree();
    expect(treeToOrganicField(blueprint)).toEqual(treeToOrganicField(blueprint));
  });
});
