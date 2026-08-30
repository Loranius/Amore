import { describe, expect, it } from 'vitest';
import {
  TONE_MAPPING_ACES,
  TONE_MAPPING_NONE,
  acesToneMap,
  facetSeparations,
  findPlateaus,
  inverseAces,
  pixelLuminance,
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
