import { describe, expect, it } from 'vitest';
import { buildReefPlan, type BuildReefPlanInput, type ReefHistoryEvent } from './reefAssembly';
import { PORTAL_MODULES } from '../shared/relationshipYear';
import { REEF_REFERENCE, reefSilhouetteProfile } from './reefProfile';

/*
 * ВИМОГА: у рифа з'явилась мірка силуету — перша в цьому виді (ADR-0182).
 * Кристал і дерево мають свою (`crystalProfile.ts`, `crownProfile.ts`), риф
 * не мав жодної, і через це про нього не можна було сказати нічого
 * перевірюваного.
 *
 * Тести тут двох різних родів, і плутати їх не можна:
 *
 *   • ВЛАСТИВОСТІ МІРКИ — те, що має лишатись правдою завжди;
 *   • ЗАПИСАНИЙ СТАН — числа сьогоднішнього рифа, зокрема ДВІ ЗНАЙДЕНІ
 *     ВАДИ. Вони закріплені НЕ як правильні, а щоб зміна, яка їх
 *     зрушить, зрушила й тест — і тоді довелось би сказати, куди саме.
 */

const SEED = 4242;

/** Насичена історія: кожен рік має події з усіх модулів порталу. */
function busyHistory(years: number): ReefHistoryEvent[] {
  const out: ReefHistoryEvent[] = [];
  for (let year = 0; year < years; year += 1) {
    for (let m = 0; m < PORTAL_MODULES.length; m += 1) {
      for (let k = 0; k < 4; k += 1) {
        const month = String(1 + ((m + k) % 12)).padStart(2, '0');
        out.push({ occurredAt: `${2023 + year}-${month}-1${k % 9}`, module: PORTAL_MODULES[m]! });
      }
    }
  }
  return out;
}

function planFor(years: number, events = busyHistory(years)) {
  const input: BuildReefPlanInput = {
    relationshipStartedAt: '2022-12-26',
    asOf: `${2022 + years}-12-20`,
    leapDayPolicy: 'feb-28',
    seed: SEED,
    events,
    sharedDaysOff: [],
    theme: 'dark',
  };
  return buildReefPlan(input);
}

describe('мірка силуету', () => {
  it('порожній план не ділить на нуль і не вигадує чисел', () => {
    // Нуль тут звичайний стан: пара, яка щойно відкрила портал.
    const profile = reefSilhouetteProfile(planFor(0, []));
    expect(Number.isFinite(profile.coverage)).toBe(true);
    expect(Number.isFinite(profile.coralSilhouetteShare)).toBe(true);
    expect(profile.coralSilhouetteShare).toBeGreaterThanOrEqual(0);
  });

  it('частки лишаються частками', () => {
    const profile = reefSilhouetteProfile(planFor(4));
    expect(profile.coralSilhouetteShare).toBeGreaterThan(0);
    expect(profile.coralSilhouetteShare).toBeLessThan(1);
    expect(profile.coverage).toBeGreaterThan(0);
  });

  it('мірка безрозмірна: той самий риф удвічі більший дає ті самі частки', () => {
    /*
     * Це і є причина, чому профіль у частках. Еталон лежить у своїх
     * одиницях, риф пари росте з роками, і порівнювати можна лише те, що
     * не залежить від розміру.
     */
    const plan = planFor(4);
    const doubled = {
      ...plan,
      head: { radius: plan.head.radius * 2, rise: plan.head.rise * 2 },
      colonies: plan.colonies.map((colony) => ({
        ...colony,
        size: { ...colony.size, radius: colony.size.radius * 2 },
        bodies: colony.bodies.map((body) => ({
          ...body,
          radius: body.radius * 2,
          height: body.height * 2,
        })),
      })),
    };
    const a = reefSilhouetteProfile(plan);
    const b = reefSilhouetteProfile(doubled);
    expect(b.coralSilhouetteShare).toBeCloseTo(a.coralSilhouetteShare, 6);
    expect(b.coverage).toBeCloseTo(a.coverage, 6);
    expect(b.bodyAspect).toBeCloseTo(a.bodyAspect, 6);
    expect(b.domeAspect).toBeCloseTo(a.domeAspect, 6);
  });
});

describe('форма ОДНОГО корала вже збігається з еталоном', () => {
  it('стрункість тіла тримається біля еталонних 1.05', () => {
    /*
     * НАЙВАЖЛИВІШИЙ ТЕСТ ЦЬОГО ФАЙЛУ, і саме тому, що він проходить.
     *
     * Він каже: тіло корала правити НЕ ТРЕБА. Кристал цей поворот уже
     * пройшов — «медіана сказала справжню історію: маленькі кристали вже
     * були праві», — і риф повторює його один в один. Якщо колись
     * з'явиться спокуса витягнути корали вгору заради силуету, цей тест
     * має впасти першим: він сторожить те, що вже правильне.
     */
    for (const years of [1, 4, 10, 25]) {
      const profile = reefSilhouetteProfile(planFor(years));
      expect(Math.abs(profile.bodyAspect - REEF_REFERENCE.bodyAspect)).toBeLessThan(0.2);
    }
  });
});

describe('ЗАПИСАНИЙ СТАН: що мірка знайшла — і чим це виявилось', () => {
  it('НЕ ВАДА: стала частка корала в силуеті — це пропорція, а не діагноз', () => {
    /*
     * **ТУТ БУЛА «ВАДА 1», І ЇЇ ЗНЯТО ДОКАЗОМ (ADR-0191).**
     *
     * Два ADR писали: частка найвищого корала в повній висоті рифа стоїть
     * ~28% і на першому році, і на двадцять п'ятому, отже «риф не стає
     * кораловішим із віком». Звучало як діагноз і мало число.
     *
     * Лабораторія показала перший і двадцять п'ятий рік поруч
     * (`node scripts/lab/artifact.mjs --species=reef --years=1|25`), і
     * кадр каже протилежне: на першому році це гола брила з одним
     * кущиком, на двадцять п'ятому — суцільний масив, у якому каменю
     * майже не видно. Риф СТАЄ кораловішим, і ще й як.
     *
     * Стала тут не вада, а арифметика: висота корала й висота купола
     * ростуть від ОДНОГО масштабу голови, тож їхня частка скорочується.
     * Число каже «риф тримає свою пропорцію в будь-якому віці», і це
     * властивість, яку варто стерегти.
     *
     * Та сама помилка, що в ADR-0174 (мірка міряла острів) і ADR-0187
     * (насиченість міряла дрібноту): **мірка, яка ставить не те питання,
     * дає числа схожого порядку й нічим не кричить.** Ярлик «вада»
     * протримався два ADR саме тому.
     */
    const shares = [1, 4, 10, 25].map((y) => reefSilhouetteProfile(planFor(y)).coralSilhouetteShare);
    for (const share of shares) {
      expect(share).toBeGreaterThan(0.28);
      expect(share).toBeLessThan(0.37);
    }
    expect(Math.abs(shares[shares.length - 1]! - shares[0]!)).toBeLessThan(0.03);
  });

  it('ВИМОГА: корала на рифі більшає з роками — і ось число, яке це каже', () => {
    /*
     * ВИМОГА власника: «корал робимо більш кораловим». Питання «скільки
     * тут корала» має свою мірку — `coralCoverage`, площа самих ТІЛ проти
     * площі купола (ADR-0191).
     *
     * Чому не `coverage`: та рахує заявку ШАПОК на площу, а тіла
     * всередині шапки стоять не щільно. Різниця невелика (≈0.9), але
     * плутати два числа про одне вже коштувало неправильного висновку
     * вище.
     *
     * Виміряно: 14.4% → 45.8% → 100.6% → 228.3% на роках 1/4/10/25.
     * Більше за одиницю означає, що тіла стоять уже в кілька шарів —
     * саме це на кадрі й читається зрощеним масивом.
     */
    const coverage = [1, 4, 10, 25].map((y) => reefSilhouetteProfile(planFor(y)).coralCoverage);
    for (let at = 1; at < coverage.length; at += 1) {
      expect(coverage[at]!).toBeGreaterThan(coverage[at - 1]!);
    }
    expect(coverage[0]!).toBeLessThan(0.2);
    expect(coverage[1]!).toBeGreaterThan(0.4);
    expect(coverage[3]!).toBeGreaterThan(2);
    // І менша за заявку шапок: тіла всередині шапки стоять не щільно.
    for (const years of [1, 4, 25]) {
      const profile = reefSilhouetteProfile(planFor(years));
      expect(profile.coralCoverage).toBeLessThan(profile.coverage);
    }
  });

  it('ВАДА 2 — покриття купола, зменшена вужчим куполом, але не закрита', () => {
    /*
     * СМУГА ОНОВЛЕНА РАЗОМ ІЗ `HEAD_BREADTH_GAIN` 0.40 → 0.15 (ADR-0182),
     * і це семантична зміна, а не підгонка під новий результат.
     *
     * Було: 7.1% на першому році, 22.4% на четвертому, 49.1% на
     * десятому — чотири п'ятих кадру гола порода саме тоді, коли пара
     * дивиться.
     * Стало: 10.6% / 33.2% / 72.8%.
     *
     * Що саме зрушило. Радіус колонії прив'язаний до МАСШТАБУ голови, а
     * не до її радіуса, тож єдиний дометний важіль покриття — наскільки
     * широта життя розширює купол. Власник обрав «купол вужчий за
     * колонії»; вимір по діапазону (0.40/0.25/0.15/0.05 → 22.4/28.1/
     * 33.2/39.8% на четвертому році) назвав 0.15 як точку, де правило
     * «широта розширює голову» ще живе.
     *
     * ЧОГО ЦЕ НЕ ЗАКРИЛО, і тому тест лишається в розділі вад: на
     * ПЕРШОМУ році покриття все одно лише десята частина купола. Причина
     * структурна й важелем не береться — купол росте за 25-річним
     * годинником (`HEAD_FULL_TERM_YEARS`), а колоній стільки, скільки
     * прожито років.
     */
    /*
     * СМУГА ЗРУШЕНА ВДРУГЕ — `ANNUAL_HEAD_SHARE` 0.40 → 0.50 (ADR-0190),
     * на вимогу власника «корал робимо більш кораловим».
     *
     * Було (після ADR-0182): 10.6% / 33.2% / 72.8% на роках 1/4/10.
     * Стало: 16.2% / 51.0% / 111.9%.
     *
     * Це ДРУГИЙ важіль тієї самої арифметики: перший (ширина купола)
     * міняв знаменник, цей — чисельник. Обидва вперлись би в ту саму
     * межу, якби покриття міряли саме шапки; тому поруч із ним міряне
     * й фактичне вкриття ТІЛАМИ (сума їхніх площ): на четвертому році
     * 29.8% → 45.8%, тобто корал справді додався, а не тільки заявка
     * на площу.
     *
     * ЧОГО ЦЕ ЗНОВУ НЕ ЗАКРИЛО: на ПЕРШОМУ році гола порода все одно
     * займає п'ять шостих купола. Причина та сама структурна — купол
     * росте за 25-річним годинником, а колоній стільки, скільки
     * прожито років.
     */
    expect(reefSilhouetteProfile(planFor(1)).coverage).toBeLessThan(0.20);
    const atFour = reefSilhouetteProfile(planFor(4)).coverage;
    expect(atFour).toBeGreaterThan(0.48);
    expect(atFour).toBeLessThan(0.54);
    expect(reefSilhouetteProfile(planFor(10)).coverage).toBeGreaterThan(1.0);
  });

  it('купол став ближчим до півкулі, якою його й описує власний коментар', () => {
    /*
     * `HEAD_RISE_SHARE` у `colonyFormations.ts` пише: «живий масив ближчий
     * до півкулі, ніж до тарілки». Півкуля — це радіус на висоту 1.00.
     * Було 1.71, стало 1.40: не півкуля, але вже не тарілка, і напрямок
     * тепер збігається з тим, що код про себе каже.
     */
    const profile = reefSilhouetteProfile(planFor(4));
    expect(profile.domeAspect).toBeGreaterThan(1.3);
    expect(profile.domeAspect).toBeLessThan(1.5);
  });

  it('ВАДА 2б — із П’ЯТОГО року шапки колоній перетинаються', () => {
    /*
     * Зворотний бік тієї самої арифметики, і вже не про смак.
     * `colonyBodies.ts` пише: «оголошений радіус колонії ... саме на
     * нього спирається зазор між сусідніми роками». З шостого року цього
     * зазору НЕМАЄ: позиції розсіюються як 1/N, а радіуси ростуть як √t,
     * тож вони зустрічаються.
     *
     * ЧИСЛО ВИМІРЯНЕ ПОРІК, І ПЕРША ВЕРСІЯ ЦЬОГО ТЕСТУ БУЛА НЕПРАВИЛЬНА.
     * Я написав «з десятого», бо прогін міряв 4, 10, 15, 25 — і роки
     * 5–9 просто не перевірялись. Насправді перший перетин з'являється
     * на ШОСТОМУ (запас −0.018), на восьмому зазор ненадовго
     * повертається (+0.013), а далі росте вже тільки вглиб. Пара сьогодні
     * на четвертому році, тобто до вади їй два роки, а не шість.
     *
     * Полагодити це рухом колоній НЕ МОЖНА: місце року залежить лише від
     * його номера (заморозка минулого), і це правило сильніше за зазор.
     * Тому тут записана МЕЖА, а не виправлення — щоб число було видно
     * тому, хто вирішуватиме.
     *
     * І ОДРАЗУ ПОПРАВКА ДО ВЛАСНОГО СЛОВА «ВАДА» (ADR-0184). Щойн
     * з'явилась лабораторія рифа, двадцять п'ятий рік стало видно очима —
     * і перетини на ньому читаються ЗРОЩЕНИМ МАСИВОМ, а не поломкою:
     * колонії змикаються в суцільну кору, і риф виглядає дорослим саме
     * завдяки цьому. Тобто число правдиве, а ярлик був поспішний: під
     * питанням сам оголошений зазор, а не його відсутність.
     *
     * Тест лишається, бо стереже ЧИСЛО, а не оцінку: якщо межа зрушить,
     * це має бути видно й названо.
     */
    const collisions = (years: number): number => {
      const colonies = planFor(years).colonies;
      let hits = 0;
      for (let i = 0; i < colonies.length; i += 1) {
        for (let j = i + 1; j < colonies.length; j += 1) {
          const a = colonies[i]!.anchor.point;
          const b = colonies[j]!.anchor.point;
          const distance = Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
          if (distance < colonies[i]!.size.radius + colonies[j]!.size.radius) hits += 1;
        }
      }
      return hits;
    };
    /*
     * МЕЖА ЗРУШИЛАСЬ НА РІК РАНІШЕ (ADR-0190): `ANNUAL_HEAD_SHARE`
     * 0.40 → 0.50 робить кожну шапку ширшою, тож зустрічаються вони
     * швидше — перший перетин тепер на П'ЯТОМУ році, а не на шостому.
     *
     * Ціну названо й зважено: пара сьогодні на ЧЕТВЕРТОМУ році, і саме
     * тому число 0.50 обране з-поміж виміряних. 0.55 дало б на
     * четвертому році вже 1 перетин, тобто вносило б ваду в той рік, у
     * якому пара живе. Наступний рядок стереже саме це.
     */
    // До четвертого року включно зазор ще є — саме там пара сьогодні.
    for (const clean of [1, 2, 3, 4]) expect(collisions(clean)).toBe(0);
    // З п'ятого вже немає.
    expect(collisions(5)).toBeGreaterThan(0);
    expect(collisions(10)).toBeGreaterThan(0);
    expect(collisions(25)).toBeGreaterThan(collisions(15));
    /*
     * НАЗВАНА ЦІНА двох важелів разом. Вужчий купол (ADR-0182) звів
     * колонії ближче; ширші шапки (ADR-0190) зробили їх більшими.
     * Перетинів на двадцять п'ятому році: 32 → 43 → **69**.
     *
     * Ярлик «вада» тут і далі поспішний — лабораторія показала, що на
     * двадцять п'ятому році це читається зрощеним масивом, — але число
     * мусить лишатись видним тому, хто вирішуватиме далі.
     */
    expect(collisions(25)).toBeGreaterThan(60);
  });
});

describe('числа еталона', () => {
  it('записані так, як їх друкує `scripts/models/measure-reef.mjs`', () => {
    /*
     * Константи мають збігатися з тим, що скрипт дістає з GLB. Інакше
     * вони — моє слово, а не вимір; саме так у цьому проєкті вже
     * народжувались числа, які потім доводилось забирати з ADR.
     */
    expect(REEF_REFERENCE.bodyAspect).toBeCloseTo(1.05, 2);
    expect(REEF_REFERENCE.bodyTriangles).toBe(760);
    // Один колір на тіло — головне, що каже еталон: його не освітлюють,
    // його фарбують, і фарбують ПЛОСКО.
    expect(REEF_REFERENCE.coloursPerBody).toBe(1);
    expect(REEF_REFERENCE.hues).toHaveLength(8);
    expect([...REEF_REFERENCE.hues].sort((a, b) => a - b)).toEqual([...REEF_REFERENCE.hues]);
  });
});
