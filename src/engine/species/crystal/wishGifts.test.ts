// ============================================================
// Колір від виконаних бажань — правило власника числами.
// ------------------------------------------------------------
// ЗАПИТ (2026-09-07): «Якщо дівчина виконує бажання, додається червоний
// колір. Якщо хлопець виконує бажання, додається блакитний колір. Якщо
// спільне бажання виконане, то зелений колір.» На питання, куди саме йде
// колір, власник обрав «увесь тон кристала».
//
// Це скасовує половину ADR-0059: тон і далі ОДИН на всю колонію, але він
// більше не сталий. Що лишається від дати початку стосунків — відтінок, з
// якого все починається, і той, до якого камінь повертається, коли
// подарунки врівноважились.
//
// У рушії немає ані статі, ані імен: є `first` і `second`, а хто з них
// хто — рішення застосунку (`colorPartners`). Тому тут не «її» й «його», а
// перший і другий.
// ============================================================
import { describe, expect, it } from 'vitest';
import { buildArtifactBlueprint } from '../../evolution';
import { buildCrystalSpeciesBlueprint } from './crystalSpecies';
import { coupleTint, type CrystalWishGifts } from './growthModel';

const START = '2022-12-26';
const NONE: CrystalWishGifts = { toFirst: 0, toSecond: 0, shared: 0 };

function rgbOf(gifts: CrystalWishGifts): readonly [number, number, number] {
  const [r, g, b] = coupleTint(START, gifts).rgb;
  return [r!, g!, b!];
}

/** Наскільки колір узагалі є кольором: розмах між найяскравішим і найтьмянішим каналом. */
function chroma(rgb: readonly [number, number, number]): number {
  return Math.max(...rgb) - Math.min(...rgb);
}

describe('колір від виконаних бажань', () => {
  it('БАЖАННЯ ПЕРШОГО, ВИКОНАНІ ДРУГИМ, роблять камінь червоним', () => {
    const [r, g, b] = rgbOf({ toFirst: 12, toSecond: 0, shared: 0 });
    expect(r).toBeGreaterThan(g);
    expect(r).toBeGreaterThan(b);
    // Не просто «червоніший за зелений» — червоніший за камінь без
    // подарунків: базовий відтінок пари сам трояндовий, тож перевіряти
    // треба РУХ, а не абсолют.
    const base = rgbOf(NONE);
    expect(r - Math.max(g, b)).toBeGreaterThan(base[0] - Math.max(base[1], base[2]));
  });

  it('БАЖАННЯ ДРУГОГО, ВИКОНАНІ ПЕРШИМ, роблять камінь блакитним', () => {
    const [r, g, b] = rgbOf({ toFirst: 0, toSecond: 12, shared: 0 });
    expect(b).toBeGreaterThan(r);
    expect(b).toBeGreaterThan(g);
  });

  it('СПІЛЬНІ БАЖАННЯ роблять камінь зеленим', () => {
    const [r, g, b] = rgbOf({ toFirst: 0, toSecond: 0, shared: 12 });
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThan(b);
  });

  it('ПОРІВНУ ЛИШАЄ КОЛІР ПАРИ, а не змішує його в сірий', () => {
    /*
     * Головне число цього файла. Червоний, зелений і синій у рівних
     * частках дають у RGB СІРИЙ — тобто пара, яка дарує порівну,
     * діставала б камінь без кольору взагалі. «Порівну» означає «жоден
     * бік не переважає», а не «кольору немає».
     *
     * Кругове середнє відповідає саме на це: при рівних частках його
     * довжина нульова, тож тягти нема куди.
     */
    expect(rgbOf({ toFirst: 5, toSecond: 5, shared: 5 })).toEqual(rgbOf(NONE));
    expect(rgbOf({ toFirst: 40, toSecond: 40, shared: 40 })).toEqual(rgbOf(NONE));
  });

  it('ЖОДНЕ ПОЄДНАННЯ НЕ ДАЄ НІ СІРОГО, НІ ЖОВТОГО', () => {
    /*
     * Прокручування відтінку замість змішування кольорів обрано саме
     * тут: пряма суміш «троянда + зелень» на 2/2/8 давала `#bba9aa` —
     * камінь без кольору. А найкоротша дуга до зеленого йшла через
     * помаранчевий, тобто через жовтий кут кола, який §6 брифу
     * забороняє окремо.
     *
     * Перебирається вся сітка 0…6 подарунків на канал — 343 стани.
     */
    const base = chroma(rgbOf(NONE));
    for (let first = 0; first <= 6; first += 1) {
      for (let second = 0; second <= 6; second += 1) {
        for (let shared = 0; shared <= 6; shared += 1) {
          const rgb = rgbOf({ toFirst: first, toSecond: second, shared });
          const label = `${first}/${second}/${shared}`;
          expect(chroma(rgb), label).toBeGreaterThanOrEqual(base * 0.95);
          // Жовтий — це високі червоний і зелений при низькому синьому.
          const [r, g, b] = rgb;
          expect(r > 0.6 && g > 0.6 && b < Math.min(r, g) * 0.7, label).toBe(false);
        }
      }
    }
  });

  it('колір рухається ПОСТУПОВО, а не стрибком на першому подарунку', () => {
    /*
     * Один подарунок на тлі тридцяти не має права перефарбувати камінь:
     * власник називав колір ідентичністю, а ідентичність не міняється
     * від одного вечора.
     *
     * Міряється саме ПРИРІСТ: 10/10/10 проти 11/10/10. Перша редакція
     * цього тесту порівнювала 1/10/10 з каменем без подарунків і чесно
     * впала — але падала вона не на «стрибку від одного подарунка», а на
     * тому, що десять синіх і десять зелених САМІ тягнуть у бірюзу.
     * Тест міряв не те, що називав.
     */
    const before = rgbOf({ toFirst: 10, toSecond: 10, shared: 10 });
    const after = rgbOf({ toFirst: 11, toSecond: 10, shared: 10 });
    const step = Math.hypot(
      after[0] - before[0], after[1] - before[1], after[2] - before[2],
    );
    expect(step).toBeLessThan(0.1);
  });
});

describe('подарунки доходять до опублікованого кристала', () => {
  /*
   * Мірка вище — про саму формулу. Тут перевіряється ЛАНЦЮГ: подія
   * вішліста з атрибуцією → `colorPartners` у конфігу виду → тон, який
   * бачить Volume VI. Між ними три файли, і кожен уже одного разу губив
   * цю ниточку: `colorPartners` пролежав у конфігу мертвим від ADR-0059
   * до ADR-0151, і жоден тест цього не помітив.
   */
  const PARTNERS = { first: 1, second: 2 };

  function wish(index: number, subjectId: number, actorId: number, shared = false) {
    return {
      id: `wish-${index}`,
      occurredAt: `2023-0${(index % 9) + 1}-12T10:00:00Z`,
      source: 'wishlist@1',
      evidence: 'verified' as const,
      channels: { achievement: 0.5, significance: 0.28 },
      portalActivity: 0.24,
      attribution: { subjectId, actorId, shared },
    };
  }

  function tintOf(events: ReturnType<typeof wish>[]) {
    const artifact = buildArtifactBlueprint({
      coupleId: 'gifts',
      config: {
        engineVersion: '1.0.0',
        relationshipStartedAt: '2022-12-26',
        timeZone: 'Europe/Kyiv',
        leapDayPolicy: 'feb-28',
      },
      events,
    });
    const species = buildCrystalSpeciesBlueprint({
      artifact,
      config: { asOf: '2024-01-02T09:00:00Z', rulesVersion: '1.0.0', colorPartners: PARTNERS },
    });
    return species;
  }

  it('виконане ВЛАСНЕ бажання не фарбує камінь', () => {
    /*
     * Правило ADR-0004, яке повертається разом із кольором: колір про те,
     * що вони дали ОДНЕ ОДНОМУ. Виконати власне бажання — це не подарунок.
     */
    const own = tintOf([wish(1, 1, 1), wish(2, 2, 2), wish(3, 1, 1)]);
    const none = tintOf([]);
    expect(own.mother.tintRgb).toEqual(none.mother.tintRgb);
  });

  it('подарунки другого першому червонять монарха', () => {
    const gifts = tintOf(Array.from({ length: 8 }, (_, index) => wish(index, 1, 2)));
    const [r, g, b] = tintOf([]).mother.tintRgb;
    const [gr, gg, gb] = gifts.mother.tintRgb;
    expect(gr! - Math.max(gg!, gb!)).toBeGreaterThan(r! - Math.max(g!, b!));
  });

  it('ОДИН ТОН НА ВСЮ КОЛОНІЮ: діти беруть колір монарха', () => {
    /*
     * Половина ADR-0059, яка НЕ скасована: різного кольору в різних
     * частинах одного кристала немає. Скасовано лише те, що тон сталий.
     */
    const species = tintOf(Array.from({ length: 6 }, (_, index) => wish(index, 2, 1)));
    for (const formation of species.formations) {
      expect(formation.tintRgb).toEqual(species.mother.tintRgb);
    }
  });
});
