import { describe, expect, it } from 'vitest';
import { buildStarfield, starfieldBudget, steadyShadow } from './starfield';

const SEED = 'couple-42';

describe('buildStarfield', () => {
  it('те саме насіння дає те саме небо', () => {
    expect(buildStarfield(SEED, 'high')).toEqual(buildStarfield(SEED, 'high'));
  });

  it('інша пара дістає інше небо', () => {
    expect(buildStarfield(SEED, 'high')).not.toEqual(buildStarfield('couple-43', 'high'));
  });

  it('кількість крапок відповідає профілю пристрою', () => {
    for (const quality of ['high', 'balanced', 'low', 'fallback'] as const) {
      const budget = starfieldBudget(quality);
      const field = buildStarfield(SEED, quality);
      expect(field.steady).toHaveLength(budget.steady);
      expect(field.twinkling).toHaveLength(budget.twinkling);
    }
  });

  it('слабший профіль ніколи не дістає більше роботи за сильніший', () => {
    const high = starfieldBudget('high');
    const balanced = starfieldBudget('balanced');
    const low = starfieldBudget('low');
    const fallback = starfieldBudget('fallback');
    expect(balanced.twinkling).toBeLessThan(high.twinkling);
    expect(low.twinkling).toBeLessThan(balanced.twinkling);
    // Без WebGL не мерехтить нічого: там зайвий цикл анімації найдорожчий.
    expect(fallback.twinkling).toBe(0);
  });

  it('жодна крапка не виходить за кадр', () => {
    const field = buildStarfield(SEED, 'high');
    for (const star of [...field.steady, ...field.twinkling]) {
      expect(star.x).toBeGreaterThanOrEqual(0);
      expect(star.x).toBeLessThan(1);
      expect(star.y).toBeGreaterThanOrEqual(0);
      expect(star.y).toBeLessThan(1);
    }
  });

  it('фонова крапка лишається дрібнішою за найменшу зірку сузір’я', () => {
    // Найменша зірка сузір'я — 2.1 одиниці радіуса, тобто 4.2 діаметра при
    // ширині полотна 100. Фон мусить читатись як пил, а не як подія.
    const field = buildStarfield(SEED, 'high');
    for (const star of [...field.steady, ...field.twinkling]) {
      expect(star.size).toBeLessThan(2.5);
    }
  });

  it('мерехтіння розкидане у часі, а не в такт', () => {
    const field = buildStarfield(SEED, 'high');
    const delays = new Set(field.twinkling.map((star) => star.delay.toFixed(3)));
    expect(delays.size).toBeGreaterThan(field.twinkling.length * 0.8);
  });

  it('усі числа скінченні', () => {
    const field = buildStarfield(SEED, 'high');
    for (const star of field.twinkling) {
      expect(Number.isFinite(star.x)).toBe(true);
      expect(Number.isFinite(star.period)).toBe(true);
      expect(star.period).toBeGreaterThan(0);
    }
  });
});

describe('steadyShadow', () => {
  it('порожнє поле дає порожній рядок, а не «none»', () => {
    expect(steadyShadow([])).toBe('');
  });

  it('кожна крапка стає однією тінню', () => {
    const shadow = steadyShadow(buildStarfield(SEED, 'low').steady);
    expect(shadow.split('), ').length).toBe(starfieldBudget('low').steady);
  });
});

describe('розсип, а не смуги', () => {
  /** Скільки пар крапок стоять ближче, ніж `gap` частки кадру. */
  function crowdedPairs(stars: readonly { x: number; y: number }[], gap: number): number {
    let pairs = 0;
    for (let i = 0; i < stars.length; i += 1) {
      for (let j = i + 1; j < stars.length; j += 1) {
        const dx = stars[i]!.x - stars[j]!.x;
        const dy = stars[i]!.y - stars[j]!.y;
        if (Math.hypot(dx, dy) < gap) pairs += 1;
      }
    }
    return pairs;
  }

  /**
   * Регрес, який уже стався і якого КОРЕЛЯЦІЯ НЕ ЛОВИЛА.
   *
   * Солі `s0x` і `s0y` різняться останнім байтом, а FNV-1a його слабко
   * розмиває: координати виходили пов'язаними, і фоновий пил на живому екрані
   * ліг діагональними смугами. Коефіцієнт Пірсона при цьому лишався в межах —
   * він міряє загальний нахил, а не збивання в пари. Тому міряємо саме те, що
   * було видно оком: скільки крапок сидять одна на одній.
   *
   * На 150 крапках рівномірного поля пар ближче за 1% кадру очікується одиниці;
   * при зіпсутому хеші їх були десятки.
   */
  it('фонові зірки не збиваються в пари', () => {
    const { steady } = buildStarfield(SEED, 'high');
    expect(crowdedPairs(steady, 0.01)).toBeLessThan(6);
  });

  it('те саме для мерехтливих', () => {
    const { twinkling } = buildStarfield(SEED, 'high');
    expect(crowdedPairs(twinkling, 0.02)).toBeLessThan(4);
  });

  it('поле накриває весь кадр, а не куток', () => {
    const { steady } = buildStarfield(SEED, 'high');
    const xs = steady.map((s) => s.x);
    const ys = steady.map((s) => s.y);
    expect(Math.min(...xs)).toBeLessThan(0.12);
    expect(Math.max(...xs)).toBeGreaterThan(0.88);
    expect(Math.min(...ys)).toBeLessThan(0.12);
    expect(Math.max(...ys)).toBeGreaterThan(0.88);
  });

  it('кожна чверть кадру дістає свою частку зірок', () => {
    const { steady } = buildStarfield(SEED, 'high');
    const quads = [0, 0, 0, 0];
    for (const star of steady) {
      quads[(star.x < 0.5 ? 0 : 1) + (star.y < 0.5 ? 0 : 2)]! += 1;
    }
    // Рівний розподіл дав би по 37–38; смуги залишали чверті майже порожніми.
    for (const count of quads) expect(count).toBeGreaterThan(steady.length / 8);
  });
});
