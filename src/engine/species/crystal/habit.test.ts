import { describe, expect, it } from 'vitest';
import { stableHash32 } from '../../evolution';
import { coupleHueStep } from '../shared/relationshipYear';
import { CRYSTAL_HABITS, MONARCH_HABITS, coupleCrystalHabit } from './habit';

/*
 * Вимога власника, дослівно: «кристал має мати різні форми — або
 * гострокінечний, або такий, як зараз, тупий, як сталагміт, або ще
 * якийсь третій. Щоб у кожної пари була більша варіація».
 *
 * Цей файл стереже ВИБІР форми (риса пари). Те, чим одна форма
 * відрізняється від іншої на вигляд, стереже `geometry/profile.test.ts`.
 */
describe('crystal habit — one form per couple, taken from the day they began', () => {
  it('gives the same couple the same form forever', () => {
    // Форма — ідентичність, а не показник: вона не сміє рухатись ні від
    // активності, ні від повторного виклику.
    const first = coupleCrystalHabit('2022-12-26');
    for (let repeat = 0; repeat < 5; repeat += 1) {
      expect(coupleCrystalHabit('2022-12-26')).toBe(first);
    }
    expect(CRYSTAL_HABITS).toContain(first);
    /*
     * 26 грудня 2022 — дата цієї пари, і вона дає `needle`.
     *
     * Дала `massive`, доки монарх брав усі чотири форми. Власник,
     * дивлячись на живий портал, назвав ту форму «монолітом» і, побачивши
     * кадр трьох форм поруч, обрав голку (ADR-0155). Тепер монарх бере
     * тільки гострокінечні, і його дата дає найгострішу з них.
     *
     * Записано числом навмисно: якби розклад колись поїхав, кристал
     * власника змінився б мовчки, і дізнались би про це з екрана.
     */
    expect(first).toBe('needle');
  });

  it('leaves the form unnamed until the couple names their day', () => {
    /*
     * Порожня дата дає призму — і це НЕ «варіант за замовчуванням, бо
     * треба щось повернути». Призма — базова форма кварцу; вигадувати
     * парі рідкісну огранку, доки вона не сказала, коли почалась, було б
     * домислом, який потім мовчки зміниться в них під руками.
     */
    expect(coupleCrystalHabit('')).toBe('prismatic');
    expect(coupleCrystalHabit('   ')).toBe('prismatic');
  });

  it('reaches every form the monarch may wear, and none of them swallows the other', () => {
    /*
     * Найтихіша можлива вада тут — форма, до якої не веде жодна дата:
     * код на неї є, таблиця чисел на неї є, а не бачив її ніхто. Тому
     * перевіряється не «функція повертає щось із списку», а покриття.
     *
     * ІНВАРІАНТ ЗМІНИВСЯ, І ЦЕ РІШЕННЯ ВЛАСНИКА, А НЕ ПОСЛАБЛЕННЯ ТЕСТУ.
     * Тут стояло «дістає всі чотири форми», і ADR-0154 §5 назвав наперед,
     * що звуження вибору цей інваріант скасує — саме тому питання винесли
     * власникові разом із кадром трьох форм. Він обрав голку, тобто
     * обрав, щоб монарх більше не носив тупих форм узагалі.
     *
     * `massive` і `tabular` не викинуто: їх носять дрібні тіла
     * (`chooseArchetype`), і `CRYSTAL_HABITS` нижче стереже, що словник
     * лишився повним. Монарх бере з `MONARCH_HABITS`.
     *
     * 1 461 дата — рівно чотири роки поспіль, з високосним усередині.
     */
    const counts = new Map<string, number>(MONARCH_HABITS.map((habit) => [habit, 0]));
    const day = new Date(Date.UTC(2020, 0, 1));
    let total = 0;
    while (day.getUTCFullYear() < 2024) {
      const iso = day.toISOString().slice(0, 10);
      const habit = coupleCrystalHabit(iso);
      expect(counts.has(habit), iso).toBe(true);
      counts.set(habit, counts.get(habit)! + 1);
      total += 1;
      day.setUTCDate(day.getUTCDate() + 1);
    }

    expect(total).toBe(1461);
    for (const habit of MONARCH_HABITS) {
      // Рівна половина — 50%. Смуга 40–60% лишає розкладу простір
      // хитатись, але ловить і мертву форму (0%), і форму, що з'їла
      // другу. Виміряно на цих 1 461 датах: голка 50.5%, призма 49.5%.
      const share = counts.get(habit)! / total;
      expect(share, habit).toBeGreaterThan(0.4);
      expect(share, habit).toBeLessThan(0.6);
    }

    /*
     * А словник лишається повним — і це не декоративна перевірка.
     * Прибрати з нього тупі форми означало б відібрати їх і в дітей, де
     * присадкуватість — різноманіття, а не вада; саме на дітях тримається
     * те, щоб скупчення читалось скупченням, а не одним кристалом,
     * повтореним п'ятнадцять разів.
     */
    expect(CRYSTAL_HABITS).toContain('massive');
    expect(CRYSTAL_HABITS).toContain('tabular');
    expect(MONARCH_HABITS.every((habit) => CRYSTAL_HABITS.includes(habit))).toBe(true);
  });

  it('keeps the form independent of the colour drawn from the same date', () => {
    /*
     * Форма й колір беруться з ОДНІЄЇ дати, тож найлегше було б узяти
     * одне число двічі. Тоді «дві риси» були б однією: всі пари з
     * рожевим кристалом носили б однакову огранку, і друга риса не
     * додавала б ніякої варіації — рівно того, чого просив власник.
     *
     * Перевірка пряма: у межах однієї форми мусять траплятись різні
     * кольорові щаблі, і навпаки.
     */
    const pairs = new Map<string, Set<number>>();
    const day = new Date(Date.UTC(2021, 0, 1));
    while (day.getUTCFullYear() < 2023) {
      const iso = day.toISOString().slice(0, 10);
      const habit = coupleCrystalHabit(iso);
      const hue = coupleHueStep(iso, 12, stableHash32);
      if (hue !== null) {
        const seen = pairs.get(habit) ?? new Set<number>();
        seen.add(hue);
        pairs.set(habit, seen);
      }
      day.setUTCDate(day.getUTCDate() + 1);
    }

    expect(pairs.size).toBe(MONARCH_HABITS.length);
    for (const hues of pairs.values()) {
      // Усі дванадцять відтінків усередині кожної форми: жодна форма не
      // тягне за собою кольору.
      expect(hues.size).toBe(12);
    }
  });
});
