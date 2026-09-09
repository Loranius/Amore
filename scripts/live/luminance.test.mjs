import { describe, expect, it } from 'vitest';
import {
  TONE_MAPPING_ACES,
  TONE_MAPPING_NONE,
  acesToneMap,
  facetSeparations,
  findPlateaus,
  inverseAces,
  facetProfile,
  findFacets,
  pixelAt,
  pixelLuminance,
  scanBand,
  srgbToLinear,
} from './luminance.mjs';

describe('профіль світла — обернена крива', () => {
  it('undoes the very curve three applies, across the whole range', () => {
    /*
     * ЧОМУ ЦЕ ГОЛОВНИЙ ТЕСТ ФАЙЛУ.
     *
     * Уся користь профілю тримається на одному: що яскравість, яку він
     * друкує, — це яскравість СЦЕНИ, а не байти екрана. Знімок бреше саме
     * тут, і наскільки — виміряно в сусідньому тесті нижче.
     *
     * Тому пряма крива лежить поруч із оберненою й ганяється крізь неї.
     */
    for (const scene of [0, 0.05, 0.18, 0.36, 0.5, 1, 1.6, 3, 6]) {
      const screen = acesToneMap(scene);
      expect(inverseAces(screen)).toBeCloseTo(scene, 4);
    }
  });

  it('names the ceiling instead of inventing values above it', () => {
    // Пересвічене на знімку не відновлюється ніяк: у насиченні корінь іде в
    // нескінченність. Обрізання названо межею, а не сховано.
    expect(inverseAces(1)).toBe(inverseAces(0.9999));
    expect(Number.isFinite(inverseAces(1))).toBe(true);
    expect(inverseAces(0)).toBe(0);
  });

  it('leaves an untoned frame alone', () => {
    // Якщо сцену знято без кривої, обертати нічого: залишається лише зняти
    // гамму sRGB. Інакше профіль «виправляв» би те, чого не робили.
    const tone = { toneMapping: TONE_MAPPING_NONE, exposure: 1 };
    expect(pixelLuminance(255, 255, 255, tone)).toBeCloseTo(1, 6);
    expect(pixelLuminance(0, 0, 0, tone)).toBe(0);
    // Середньосірий 128 у sRGB — це приблизно 0.216 лінійних, а не 0.5.
    expect(pixelLuminance(128, 128, 128, tone)).toBeCloseTo(srgbToLinear(128), 6);
  });

  it('expands the differences the curve squeezed, most of all in the highlights', () => {
    /*
     * ЦЕ І Є ПРИЧИНА, ЧОМУ ЗНІМОК НЕ Є ВИМІРОМ, і числа тут ВИМІРЯНІ, а не
     * припущені. Перша редакція цього тесту стверджувала протилежне —
     * що зняття кривої дає БІЛЬШУ яскравість, — і це виявилось хибним на
     * середньому сірому: там крива, навпаки, підіймає.
     *
     * Правда в іншому: крива стискає РІЗНИЦІ, і тим сильніше, чим яскравіші
     * відліки. Виміряно на цій самій реалізації:
     *
     *   байти 161→186: на екрані 27.4% різниці, у сцені 31.7%
     *   байти 200→220: на екрані 19.3%, у сцені 36.0%
     *   байти 230→245: на екрані 13.3%, у сцені 52.1%
     *
     * Тобто дві грані, що на знімку різняться на тринадцять відсотків, у
     * сцені різняться вдвічі. Саме цю різницю правило «30% між сусідніми
     * гранями» і має на увазі.
     */
    const screen = (byte) => pixelLuminance(byte, byte, byte, {
      toneMapping: TONE_MAPPING_NONE, exposure: 1,
    });
    const scene = (byte) => pixelLuminance(byte, byte, byte, {
      toneMapping: TONE_MAPPING_ACES, exposure: 1,
    });
    const spread = (read, low, high) => (read(high) - read(low)) / read(high);

    for (const [low, high] of [[161, 186], [200, 220], [230, 245]]) {
      expect(spread(scene, low, high)).toBeGreaterThan(spread(screen, low, high));
    }
    // Найяскравіша пара — найбільша брехня знімка: 13.3% проти 52.1%.
    expect(spread(screen, 230, 245)).toBeCloseTo(0.133, 2);
    expect(spread(scene, 230, 245)).toBeCloseTo(0.521, 2);
  });
});

describe('профіль світла — плато й розділення граней', () => {
  it('does not chop a smooth ramp into fake facets', () => {
    /*
     * ВАДА, ЯКУ ЦЕЙ ТЕСТ ТРИМАЄ ЗАЧИНЕНОЮ, І ЯКУ Я ЗРОБИВ САМ.
     *
     * Перша редакція групувала сусідні стовпці, якщо вони різнились менш ніж
     * на кілька відсотків. На плавному градієнті кожен КРОК малий, тож він
     * розпадався на десяток «плато», і між ними виходили «переходи» — тобто
     * профіль звітував про грані там, де була одна гладка поверхня.
     *
     * Плато мусить бути рівним ЦІЛКОМ, а не лише між сусідами.
     *
     * А сам градієнт тут РІВНОМІРНИЙ ВІДНОСНО, а не за абсолютним кроком, і
     * це теж не дрібниця: лінійний пандус зі сталим кроком стає відносно
     * пласким, коли яскравішає (крок 0.004 при 0.5 — це вже менш ніж
     * відсоток), тож у його світлому кінці плато знаходиться ЧЕСНО. Перша
     * редакція тесту брала саме такий пандус і падала — на власному хибному
     * очікуванні, а не на ваді коду.
     */
    const ramp = Array.from({ length: 120 }, (_, index) => 0.05 * 1.04 ** index);
    expect(findPlateaus(ramp)).toHaveLength(0);
  });

  it('finds real steps and ignores the silhouette', () => {
    // Тло · грань · грань · тло. Перехід тіло↔тло — це силует, не грань, і
    // він завжди вісімдесят із гаком відсотків: якби його не відкидали, він
    // ховав би справжнє число за собою.
    const columns = [
      ...Array(20).fill(0.02),
      ...Array(30).fill(0.30),
      ...Array(30).fill(0.12),
      ...Array(20).fill(0.02),
    ];
    const plateaus = findPlateaus(columns);
    expect(plateaus).toHaveLength(4);

    const report = facetSeparations(plateaus);
    expect(report.plateaus).toHaveLength(2);
    expect(report.steps).toHaveLength(1);
    // (0.30 − 0.12) / 0.30 = 60%.
    expect(report.max).toBeCloseTo(0.6, 3);
    expect(report.median).toBeCloseTo(0.6, 3);
  });

  it('reports a flat body as flat', () => {
    // Дві грані, що різняться на 4%, — це те, що правило називає «виглядає
    // гладкою формою». Профіль мусить сказати саме це, а не згладити.
    const columns = [
      ...Array(20).fill(0.02),
      ...Array(30).fill(0.200),
      ...Array(30).fill(0.192),
      ...Array(20).fill(0.02),
    ];
    const report = facetSeparations(findPlateaus(columns));
    expect(report.max).toBeLessThan(0.05);
  });
});

describe('межі граней проти переходів усередині грані', () => {
  /*
   * Прилад лагодився ПІСЛЯ того, як показав суперечливі числа: медіана
   * всіх переходів стрибала 6% → 47% при незмінній формі, бо грань у
   * 60–85 пікселів має власний перепад ~20% (ADR-0085) і ріжеться на
   * два-три плато. Більшість «сусідніх пар» тоді — переходи ВСЕРЕДИНІ
   * грані.
   */
  const plateau = (from, to, luminance) => ({ from, to, luminance });

  it('бере стрибок на межі, а не плавний схил усередині грані', () => {
    // Тло, потім грань, що пливе 0.10 → 0.12 → 0.11, потім СТРИБОК на
    // 0.30 і знову плавна грань, потім тло.
    const spread = facetSeparations([
      plateau(0, 10, 0.01),
      plateau(10, 30, 0.10),
      plateau(30, 50, 0.12),
      plateau(50, 70, 0.11),
      plateau(70, 90, 0.30),
      plateau(90, 110, 0.31),
      plateau(110, 130, 0.29),
      plateau(130, 140, 0.01),
    ]);
    // Медіана всіх переходів міряє схил усередині граней — вона мала.
    expect(spread.median).toBeLessThan(0.15);
    // Медіана меж бачить саме стрибок.
    expect(spread.boundaryMedian).toBeGreaterThan(0.55);
  });

  it('рівна поверхня не має жодної межі', () => {
    const spread = facetSeparations([
      plateau(0, 10, 0.01),
      plateau(10, 30, 0.20),
      plateau(30, 50, 0.20),
      plateau(50, 70, 0.20),
      plateau(70, 80, 0.01),
    ]);
    expect(spread.boundaryMedian).toBe(0);
  });

  it('одна межа читається, навіть коли вона крайня', () => {
    // Грань з краю тіла має лише одного сусіда; без окремої умови вона
    // ніколи не потрапила б у вибірку меж.
    const spread = facetSeparations([
      plateau(0, 10, 0.01),
      plateau(10, 30, 0.10),
      plateau(30, 50, 0.40),
      plateau(50, 60, 0.01),
    ]);
    expect(spread.boundaryMedian).toBeGreaterThan(0.7);
  });
});

describe('порожня вибірка меж — це не нуль', () => {
  const plateau = (from, to, luminance) => ({ from, to, luminance });

  it('два кроки: межа оголошується лише коли поруч рівний хід', () => {
    // Стрибок утричі більший за сусідній крок — межа.
    const clear = facetSeparations([
      plateau(0, 10, 0.01),
      plateau(10, 30, 0.10),
      plateau(30, 50, 0.11),
      plateau(50, 70, 0.40),
      plateau(70, 80, 0.01),
    ]);
    expect(clear.boundaries).toHaveLength(1);
    expect(clear.boundaryMedian).toBeGreaterThan(0.7);

    // Два схожі кроки — сказати нічого не можна, вибірка порожня.
    const murky = facetSeparations([
      plateau(0, 10, 0.01),
      plateau(10, 30, 0.10),
      plateau(30, 50, 0.16),
      plateau(50, 70, 0.24),
      plateau(70, 80, 0.01),
    ]);
    expect(murky.boundaries).toHaveLength(0);
  });
});

describe('піксель за координатами', () => {
  it('бере крок із самого зображення, а не з припущення про RGBA', () => {
    /*
     * ВАДА, ЯКУ ЦЕ ЗАМІНЮЄ. Знімки порталу — PNG типу 2, тобто ТРИ канали.
     * Одноразова мірка, написана з кроком 4 «бо RGBA», читає піксель зі
     * зсувом, що росте вздовж рядка, і повертає правдоподібні, але
     * випадкові числа. Одне таке число встигло потрапити в ADR
     * (див. ADR-0165 §6 і пастку 11 у README).
     *
     * Тест бере зображення 2×2 з трьома каналами й вимагає саме той
     * піксель, який у ньому лежить. З кроком 4 останній рядок вийшов би за
     * межі буфера й дав би undefined.
     */
    const image = {
      width: 2,
      height: 2,
      channels: 3,
      data: Uint8Array.from([
        10, 11, 12, 20, 21, 22,
        30, 31, 32, 40, 41, 42,
      ]),
    };
    expect(pixelAt(image, 0, 0)).toEqual([10, 11, 12]);
    expect(pixelAt(image, 1, 0)).toEqual([20, 21, 22]);
    expect(pixelAt(image, 0, 1)).toEqual([30, 31, 32]);
    expect(pixelAt(image, 1, 1)).toEqual([40, 41, 42]);
  });

  it('однаково працює на чотириканальному знімку', () => {
    // Тип 6 теж трапляється; помилитись має бути ніде в обидва боки.
    const image = {
      width: 1,
      height: 2,
      channels: 4,
      data: Uint8Array.from([1, 2, 3, 255, 4, 5, 6, 255]),
    };
    expect(pixelAt(image, 0, 0)).toEqual([1, 2, 3]);
    expect(pixelAt(image, 0, 1)).toEqual([4, 5, 6]);
  });
});

describe('смуга бачить лише тіло', () => {
  /*
   * ВИМОГА: профіль граней має описувати кристал, а не кадр (ADR-0174).
   *
   * Виміряно, чому це окремий тест: у смузі без маски стовпець усереднює
   * небо над тілом і щебінь під ним разом із самим тілом, і на живому
   * прогоні з двадцяти трьох плато кристалові належали два — решта була
   * каменем острова. Числа виглядали здоровими й описували не те.
   */
  const frame = (rows) => {
    const height = rows.length;
    const width = rows[0].length;
    const data = new Uint8Array(width * height * 3);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const at = (y * width + x) * 3;
        data[at] = rows[y][x];
        data[at + 1] = rows[y][x];
        data[at + 2] = rows[y][x];
      }
    }
    return { width, height, channels: 3, data };
  };
  const tone = { toneMapping: TONE_MAPPING_NONE, exposure: 1 };

  it('усереднює лише піксели маски', () => {
    // Два рядки: верхній — яскраве небо, нижній — тіло. Без маски стовпець
    // дав би середнє двох, тобто число, якого немає на жодній грані.
    const image = frame([[255, 255], [40, 40]]);
    const mask = new Uint8Array(4);
    mask[2] = 1;
    mask[3] = 1;
    const [left] = scanBand(image, { y0: 0, y1: 2, x0: 0, x1: 2 }, tone, { mask, minSamples: 1 });
    expect(left).toBeCloseTo(srgbToLinear(40), 6);
  });

  it('повертає NaN там, де тіла немає, а не нуль', () => {
    const image = frame([[40, 40], [40, 40]]);
    const mask = new Uint8Array(4);
    mask[0] = 1;
    mask[2] = 1;
    const columns = scanBand(image, { y0: 0, y1: 2, x0: 0, x1: 2 }, tone, { mask, minSamples: 1 });
    expect(Number.isFinite(columns[0])).toBe(true);
    // Нуль читався б як «дуже темна грань» і потрапив би в профіль.
    expect(Number.isNaN(columns[1])).toBe(true);
  });

  it('не тягне плато крізь порожній стовпець', () => {
    // Дві однакові площини, між ними діра — це ДВА плато, а не одне
    // широке: між ними видно небо, і оком це два різні тіла.
    const columns = [
      ...Array.from({ length: 12 }, () => 0.5),
      Number.NaN,
      ...Array.from({ length: 12 }, () => 0.5),
    ];
    expect(findPlateaus(columns)).toHaveLength(2);
  });
});

describe('грані шукаються від ребра', () => {
  /*
   * ВИМОГА (`amore-crystal-look`): сусідні грані мають різнитися на 30%+,
   * і саме це число має друкувати прилад.
   *
   * Виміряно, чому цього не робив `findPlateaus` (ADR-0174): на стовбурі
   * монарха він знайшов НУЛЬ плато там, де око бачить п'ять граней із
   * кроками 34–48%. Грань має власний перепад ~20% (ADR-0085) і несе
   * іскри — один стовпець на 17–32% яскравіший за сусідні.
   */
  const ramp = (from, to, width) => Array.from(
    { length: width },
    (_, index) => from + ((to - from) * index) / (width - 1),
  );

  it('ділить смугу по ребрах, а не по рівності', () => {
    // Дві грані, кожна з власним схилом 20% — рівного пробігу немає ніде.
    const columns = [...ramp(0.50, 0.60, 12), ...ramp(0.30, 0.36, 12)];
    const facets = findFacets(columns);
    expect(facets).toHaveLength(2);
    expect(facetProfile(facets).weakest).toBeGreaterThan(0.3);
  });

  it('не ріже грань іскрою', () => {
    const columns = [...ramp(0.50, 0.60, 12), ...ramp(0.30, 0.36, 12)];
    // Іскра: один стовпець на третину яскравіший (виміряно на кадрі).
    columns[5] = columns[5] * 1.32;
    columns[17] = columns[17] * 1.28;
    const facets = findFacets(columns);
    expect(facets).toHaveLength(2);
    // Медіана грані іскри не бачить — середнє побачило б.
    expect(facets[0].luminance).toBeLessThan(0.61);
  });

  it('не рахує гранню стовпці самого ребра', () => {
    const columns = [...ramp(0.50, 0.52, 12), 0.9, ...ramp(0.30, 0.32, 12)];
    const facets = findFacets(columns);
    expect(facets).toHaveLength(2);
    // Обвід яскравіший за обидві грані; якби він потрапив у грань, її
    // яскравість поїхала б угору.
    expect(Math.max(...facets.map((facet) => facet.luminance))).toBeLessThan(0.53);
  });

  it('розділяє грані порожнім стовпцем', () => {
    const columns = [...ramp(0.5, 0.5, 10), Number.NaN, ...ramp(0.5, 0.5, 10)];
    expect(findFacets(columns)).toHaveLength(2);
  });

  it('найслабша пара, а не медіана: одна пара, що збіглася, видна', () => {
    const facets = [
      { from: 0, to: 9, luminance: 0.5 },
      { from: 12, to: 21, luminance: 0.2 },
      { from: 24, to: 33, luminance: 0.198 },
    ];
    const profile = facetProfile(facets);
    expect(profile.weakest).toBeCloseTo(0.01, 2);
    expect(profile.strongest).toBeCloseTo(0.6, 2);
  });
});
