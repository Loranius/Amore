import { describe, expect, it } from 'vitest';
import {
  neighbourSky,
  NEIGHBOUR_MAX_STARS,
  NEIGHBOUR_MAX_YEARS,
  type NeighbourSky,
} from './neighbourSky';

const SOURCE = {
  key: 'couple-42',
  levels: { key: 2, important: 5, regular: 11 },
  years: 4,
};

describe('межа приватності', () => {
  /*
   * Головний і майже єдиний сенс цього файлу.
   *
   * Найдешевший спосіб намалювати сусіднє небо — узяти готовий масив подій і
   * пропустити його через ту саму розкладку. Це і найгірший: у ньому лежать
   * дати й вага подій, тобто хронологія чужих стосунків із точністю до дня.
   * Через один кадр можна було б прочитати, коли сусіди одружились.
   *
   * Тому форма не «не несе» особистого, а НЕ ЗДАТНА його нести: у ній немає
   * жодного поля, куди його можна покласти. Цей тест перевіряє не поведінку —
   * він перевіряє, що форма лишилась вузькою.
   */
  it('у силуеті немає жодного рядка', () => {
    const sky = neighbourSky(SOURCE);
    const strings = Object.entries(sky).filter(([, value]) => typeof value === 'string');
    expect(strings).toEqual([]);
  });

  it('поля рівно ті, що дозволені, і жодного понад', () => {
    // Якщо колись сюди додадуть `title`, `date` чи `photo` — тест упаде, і це
    // його єдина робота.
    expect(Object.keys(neighbourSky(SOURCE)).sort())
      .toEqual(['levels', 'seed', 'size', 'years']);
  });

  it('насіння не веде назад до пари', () => {
    const sky = neighbourSky(SOURCE);
    expect(typeof sky.seed).toBe('number');
    expect(String(sky.seed)).not.toContain('couple');
    expect(sky.seed).toBeGreaterThanOrEqual(0);
    expect(sky.seed).toBeLessThan(1);
  });

  it('те саме джерело дає те саме небо', () => {
    expect(neighbourSky(SOURCE)).toEqual(neighbourSky(SOURCE));
  });

  it('інша пара — інше небо', () => {
    expect(neighbourSky({ ...SOURCE, key: 'couple-43' }).seed)
      .not.toBe(neighbourSky(SOURCE).seed);
  });
});

describe('стелі', () => {
  it('точна кількість подій не витікає понад стелю', () => {
    // «У них 147 подій» каже про пару більше, ніж хотілося б віддати. Понад
    // стелю всі сузір'я виглядають однаково великими.
    const huge = neighbourSky({
      key: 'couple-9',
      levels: { key: 2, important: 40, regular: 400 },
      years: 3,
    });
    expect(huge.size).toBe(NEIGHBOUR_MAX_STARS);
  });

  it('стаж теж має стелю', () => {
    expect(neighbourSky({ ...SOURCE, years: 90 }).years).toBe(NEIGHBOUR_MAX_YEARS);
  });

  it('розмір дорівнює сумі рівнів, поки стеля не втрутилась', () => {
    const sky = neighbourSky(SOURCE);
    expect(sky.size).toBe(sky.levels.key + sky.levels.important + sky.levels.regular);
  });
});

describe('зіпсуте джерело не ламає небо', () => {
  it('від’ємні й нецілі числа стають цілими невід’ємними', () => {
    const sky = neighbourSky({
      key: 'x',
      levels: { key: -3, important: 2.7, regular: Number.NaN },
      years: -5,
    });
    expect(sky.levels).toEqual({ key: 0, important: 3, regular: 0 });
    expect(sky.years).toBe(0);
  });

  it('порожня пара дає порожнє небо, а не виняток', () => {
    const empty: NeighbourSky = neighbourSky({
      key: 'new',
      levels: { key: 0, important: 0, regular: 0 },
      years: 0,
    });
    expect(empty.size).toBe(0);
  });
});
