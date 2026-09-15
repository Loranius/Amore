import { describe, expect, it } from 'vitest';
import {
  growthCaption,
  momentPhrase,
  summariseGrowth,
  type GrowthEvent,
} from './growthSinceLastVisit';
import { HOME_ARTIFACT_LOCATIVE } from './homeArtifact';
import {
  GROWTH_SEEN_STORAGE_KEY,
  growthSeenStorageKey,
} from './useGrowthSinceLastVisit';

const ev = (id: string, actorId: number | null = null): GrowthEvent => ({ id, actorId });

describe('що виросло з минулого разу', () => {
  it('перший візит не рахується приростом', () => {
    /*
     * Свідома розбіжність зі старим `useClusterGrowthFlash`, який на
     * першому візиті повертав `grew`. Для спалаху в 3D це доречно; для
     * підпису «N нових митей» — ні: першого разу нове геть усе, і рядок
     * сказав би парі «ваша історія щойно почалась».
     */
    const summary = summariseGrowth([ev('a'), ev('b')], null);
    expect(summary.firstVisit).toBe(true);
    expect(summary.newCount).toBe(0);
    expect(growthCaption(summary, null, 'crystal')).toBeNull();
  });

  it('нічого нового — мовчить', () => {
    const summary = summariseGrowth([ev('a'), ev('b')], new Set(['a', 'b']));
    expect(summary.newCount).toBe(0);
    expect(growthCaption(summary, { id: 2, displayName: 'Лєна' }, 'crystal')).toBeNull();
  });

  it('рахує лише те, чого раніше не бачили', () => {
    const summary = summariseGrowth([ev('a'), ev('b'), ev('c')], new Set(['a']));
    expect(summary.newCount).toBe(2);
  });

  it('видалення старих подій не робить приросту', () => {
    // Архів може вщухнути: подію видалили. Бачених ключів більше, ніж
    // подій, — але нових немає, тож і казати нічого.
    const summary = summariseGrowth([ev('a')], new Set(['a', 'b', 'c']));
    expect(summary.newCount).toBe(0);
  });

  it('збирає авторів без повторів і без null', () => {
    const summary = summariseGrowth(
      [ev('a', 2), ev('b', 2), ev('c', null), ev('d', 1)],
      new Set(),
    );
    expect(summary.newCount).toBe(4);
    expect(summary.actorIds).toEqual([1, 2]);
  });
});

describe('підпис приросту', () => {
  it('називає партнера, лише коли ВЕСЬ приріст його', () => {
    /*
     * «від Лєни» на подіях, половину яких додав Діма, — це неправда,
     * сказана заради теплоти. Такі помічають найшвидше.
     */
    const lena = { id: 2, displayName: 'Лєна' };
    const onlyHers = summariseGrowth([ev('a', 2), ev('b', 2)], new Set());
    expect(growthCaption(onlyHers, lena, 'crystal')).toBe('У кристалі 2 нові миті · Лєна');

    const mixed = summariseGrowth([ev('a', 2), ev('b', 1)], new Set());
    expect(growthCaption(mixed, lena, 'crystal')).toBe('У кристалі 2 нові миті');

    const anonymous = summariseGrowth([ev('a', null)], new Set());
    expect(growthCaption(anonymous, lena, 'crystal')).toBe('У кристалі 1 нова мить');
  });

  it('без партнера в контексті імені не вигадує', () => {
    const summary = summariseGrowth([ev('a', 2)], new Set());
    expect(growthCaption(summary, null, 'crystal')).toBe('У кристалі 1 нова мить');
  });

  it('називає той артефакт, який на екрані', () => {
    /*
     * **ВИМОГА (ADR-0188), знайдена живим кадром.** Іменник тут був
     * зашитий — «У кристалі» — і це трималось рівно доти, доки звітував
     * один вид. Щойно риф під'єднали до каналу приросту, шапка над рифом
     * написала «У кристалі 435 нових митей»: число правдиве, підмет
     * чужий.
     *
     * Старі очікування вище лишились дослівно тими самими — для кристала
     * рядок не змінився жодним знаком. Змінилось те, що вид тепер
     * ОБОВ'ЯЗКОВИЙ аргумент: мовчазної типової відповіді «кристал» тут
     * немає навмисно, бо саме вона й була помилкою.
     */
    const summary = summariseGrowth([ev('a'), ev('b')], new Set());
    expect(growthCaption(summary, null, 'crystal')).toBe('У кристалі 2 нові миті');
    expect(growthCaption(summary, null, 'tree')).toBe('У дереві 2 нові миті');
    expect(growthCaption(summary, null, 'reef')).toBe('У рифі 2 нові миті');
  });

  it('місцевий відмінок узятий таблицею, а не правилом', () => {
    /*
     * Портал уже заплатив за спробу відмінювати алгоритмом — «від Лєна»
     * замість «від Лєни» (тест нижче). Видів рівно три, вони фіксовані
     * типом; ця перевірка стереже, щоб жоден не лишився в називному
     * («У кристал»), якщо таблицю колись поповнять недбало.
     */
    for (const species of ['crystal', 'tree', 'reef'] as const) {
      expect(HOME_ARTIFACT_LOCATIVE[species]).toMatch(/[іи]$/);
    }
  });

  it('українське узгодження «миті» за кількістю', () => {
    // «3 нових митей» читається як машинний переклад. Узгоджувати треба
    // разом із прикметником, не лише іменник.
    expect(momentPhrase(1)).toBe('нова мить');
    expect(momentPhrase(2)).toBe('нові миті');
    expect(momentPhrase(4)).toBe('нові миті');
    expect(momentPhrase(5)).toBe('нових митей');
    expect(momentPhrase(11)).toBe('нових митей');
    expect(momentPhrase(14)).toBe('нових митей');
    expect(momentPhrase(21)).toBe('нова мить');
    expect(momentPhrase(22)).toBe('нові миті');
    expect(momentPhrase(25)).toBe('нових митей');
    expect(momentPhrase(111)).toBe('нових митей');
    expect(momentPhrase(309)).toBe('нових митей');
  });

  it('підпис не обіцяє геометрії, якої не буде', () => {
    /*
     * **Знайдено живим екраном.** Редакція «Кристал виріс на 309 шарів»
     * стояла над кристалом із ВОСЬМИ тіл: рушій обмежує тіла приблизно
     * одним на рік, скільки б подій пара не принесла. Підпис називав
     * число, якого на екрані немає й ніколи не буде.
     */
    const summary = summariseGrowth(
      Array.from({ length: 309 }, (_, index) => ev(`e${index}`)),
      new Set(),
    );
    const caption = growthCaption(summary, null, 'crystal')!;
    expect(caption).toBe('У кристалі 309 нових митей');
    expect(caption).not.toMatch(/шар|гран|тіл/);
  });

  it('підпис не містить дієслів із родом', () => {
    // «додала»/«додав» залежать від роду, а рід партнера портал не
    // зберігає. Підпис мусить бути правдивим для обох.
    const summary = summariseGrowth([ev('a', 2), ev('b', 2)], new Set());
    const caption = growthCaption(summary, { id: 2, displayName: 'Лєна' }, 'crystal')!;
    expect(caption).not.toMatch(/додал[аи]?|принесл[аи]?/);
  });

  it('підпис має підмет, а не лише число', () => {
    /*
     * «+2 шари» під лічильником днів читалось як ще одна метрика поруч
     * із «днів разом». Підпис існує заради питання «чи змінилось наше
     * життя?», і відповідь мусить мати підмет.
     */
    const summary = summariseGrowth([ev('a', 2), ev('b', 2)], new Set());
    const caption = growthCaption(summary, null, 'crystal')!;
    expect(caption).toContain('У кристалі');
    expect(caption).not.toMatch(/^\+/);
  });

  it('ім’я стоїть у називному, без прийменника', () => {
    /*
     * Перша редакція писала «від {ім'я}» і дала «від Лєна» замість «від
     * Лєни»: «від» вимагає родового. Відмінювати довільне ім'я надійно
     * портал не вміє (Лєна→Лєни, Настя→Насті, Олег→Олега), а зіпсоване
     * ім'я партнера ріже найдужче саме в цьому застосунку.
     */
    for (const name of ['Лєна', 'Настя', 'Олег', 'Ілля']) {
      const summary = summariseGrowth([ev('a', 7)], new Set());
      const caption = growthCaption(summary, { id: 7, displayName: name }, 'crystal')!;
      expect(caption).toBe(`У кристалі 1 нова мить · ${name}`);
      expect(caption).not.toContain('від ');
    }
  });
});
describe('пам’ять візитів на вид', () => {
  /*
   * **ВИМОГА (ADR-0188), знайдена числом на живому порталі.** Того самого
   * дня, на тій самій парі: кристал нарахував 328 подій, риф — 435.
   * Різниця рівно 107 — і це не приріст, а інший знімок порталу: риф
   * читає джерела через `portalSources.ts`, який домішує «сказані» числа
   * онбордингу, а конвеєр кристала їх не бачить. На цій парі домішка
   * рахується так (`declaredShortfall`, справжні рядки з бази):
   *
   *   2022-12-26  сказано 30 фото + 3 серіали, є 1 фото  → 29 + 3 = 32
   *   2023-12-26  сказано 30 фото + 15 фільмів, є 1 фото → 29 + 15 = 44
   *   2024-12-26  сказано 15 фільмів + 16 місць, є 0     → 15 + 16 = 31
   *                                                        разом    107
   *
   * Зі спільним ключем перехід на риф показав би ці 107 як «нові миті» —
   * події, яких пара не додавала. Ключ на вид робить перший візит на риф
   * ПЕРШИМ візитом, тобто мовчанням.
   */
  it('кожен вид пам’ятає свої події', () => {
    const keys = ['crystal', 'tree', 'reef'].map((species) => (
      growthSeenStorageKey(species as 'crystal' | 'tree' | 'reef')
    ));
    expect(new Set(keys).size).toBe(3);
  });

  it('кристал лишається на старому ключі', () => {
    /*
     * Не виняток, а визнання того, чиї події там лежать: ключ писав рівно
     * кристал. Перейменування стерло б парі пам'ять про візити й
     * коштувало б одного зайвого мовчання замість підпису.
     */
    expect(growthSeenStorageKey('crystal')).toBe(GROWTH_SEEN_STORAGE_KEY);
    expect(growthSeenStorageKey('reef')).toBe(`${GROWTH_SEEN_STORAGE_KEY}:reef`);
  });

  it('перший візит виду мовчить, а не рахує приростом увесь знімок', () => {
    // Саме це й рятує риф від «+107»: сховище виду порожнє → `firstVisit`.
    const summary = summariseGrowth([ev('a'), ev('b'), ev('c')], null);
    expect(summary.firstVisit).toBe(true);
    expect(growthCaption(summary, null, 'reef')).toBeNull();
  });
});
