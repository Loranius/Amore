import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  SKELETON_DELAY_MS,
  SKELETON_MIN_VISIBLE_MS,
  skeletonHoldMs,
} from './useSettledPending';

const PAGES = {
  wishlist: '../features/wishlist/WishlistPageBase.tsx',
  plans: '../features/plans/PlansPage.tsx',
  memories: '../features/memories/MemoriesPage.tsx',
} as const;

function source(relative: string): string {
  return readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
}

/**
 * Той самий текст без коментарів.
 *
 * Потрібно саме для перевірок ПОРЯДКУ: коментар над хуками цитує рядок
 * `if (partnerPending) return …`, пояснюючи, чому хук стоїть вище за
 * ранній вихід. Пошук підрядком знаходив цитату раніше за сам код — і
 * перевірка падала на правильному файлі.
 */
function code(relative: string): string {
  return source(relative)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe('пороги показу скелета', () => {
  it('затримка коротша за мінімальний показ', () => {
    // Інакше поріг просто зсунув би блимання: скелет з'являвся б пізно й
    // одразу зникав, тобто та сама вада, лише відкладена.
    expect(SKELETON_DELAY_MS).toBeLessThan(SKELETON_MIN_VISIBLE_MS);
  });

  it('скелета, якого не показували, тримати нічого', () => {
    expect(skeletonHoldMs(null, 1_000)).toBe(0);
  });

  it('щойно показаний скелет тримається майже весь мінімум', () => {
    expect(skeletonHoldMs(1_000, 1_000)).toBe(SKELETON_MIN_VISIBLE_MS);
    expect(skeletonHoldMs(1_000, 1_100)).toBe(SKELETON_MIN_VISIBLE_MS - 100);
  });

  it('відвисілий скелет знімається негайно, а не «доганяє» мінімум', () => {
    expect(skeletonHoldMs(1_000, 1_000 + SKELETON_MIN_VISIBLE_MS)).toBe(0);
    expect(skeletonHoldMs(1_000, 9_999)).toBe(0);
  });
});

describe('скелет тримає гілку сам, а не всередині «поки вантажиться»', () => {
  /*
   * Виміряна вада, і саме вона робить порядок гілок вимогою, а не смаком.
   *
   * Спершу було `if (isPending) { … skeletonVisible && <скелет> }`: зовнішню
   * гілку обирало завантаження, а скелет лише ховався всередині. Щойно дані
   * приїжджали, гілка мінялась ЦІЛКОМ — і мінімальний час показу не діяв.
   * На живому екрані «Спогади» блимнули скелетом на 10 мс, тобто рівно тим
   * блиманням, яке поріг мав прибрати.
   */
  it('«Спогади» перевіряють скелет перед завантаженням', () => {
    const memories = code(PAGES.memories);
    expect(memories.indexOf('if (skeletonVisible)'))
      .toBeGreaterThan(-1);
    expect(memories.indexOf('if (skeletonVisible)'))
      .toBeLessThan(memories.indexOf('if (isPending) return'));
  });

  it('«Вішліст» перевіряє скелет перед завантаженням', () => {
    const wishlist = code(PAGES.wishlist);
    expect(wishlist.indexOf('if (partnerSkeletonVisible)'))
      .toBeGreaterThan(-1);
    expect(wishlist.indexOf('if (partnerSkeletonVisible)'))
      .toBeLessThan(wishlist.indexOf('if (partnerPending)'));
    // Сітка бульбашок — те саме: `gridSkeletonVisible` попереду `isPending`.
    expect(wishlist).toContain(') : gridSkeletonVisible ? (');
    expect(wishlist).toContain(') : isPending ? null : isError ? (');
  });

  it('«Плани» перевіряють скелет перед завантаженням', () => {
    const plans = source(PAGES.plans);
    expect(plans).toContain(') : skeletonVisible ? (');
    expect(plans).toContain(') : busy ? null : (');
  });
});

describe('скелет планів не в’їжджає вдруге', () => {
  it('контейнер скелета несе власний клас, і той знімає анімацію', () => {
    // `.pm-sheet` дає розкладку — і разом із нею давав вхідну анімацію.
    // `pm-sheet-in` грав двічі поспіль (скелет, потім вміст) на двох
    // розкладках різної висоти: власник назвав це «тупим ривком».
    expect(source(PAGES.plans)).toContain('className="pm-sheet pm-sheet--loading"');
    const css = source('../features/plans/plansModule.css');
    expect(css).toMatch(/\.plans-module \.pm-sheet--loading \{\s*animation: none;\s*\}/);
  });
});
