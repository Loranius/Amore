import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// ============================================================
// Модулі «на один лад» (ADR-0215).
// ------------------------------------------------------------
// ВИМОГА ВЛАСНИКА: «загальний стан порталу треба адаптувати на один лад,
// всі модулі мають просвітлятись, як це адаптовано в модулях вішлиста й
// планів, окрім модуля гри».
//
// Сторож читає вихідний код: модуль, що забуде ввімкнути світ, у тесті
// рендеру не впаде — він просто стоятиме на суцільному тлі, і побачить це
// лише пара.
// ============================================================

const read = (path: string) =>
  readFileSync(fileURLToPath(new URL(`../../${path}`, import.meta.url)), 'utf8');

/** Модулі, що вмикають світ спільним хуком і спільним класом. */
const UNIFIED = [
  'features/schedule/SchedulePage.tsx',
  'features/memories/MemoriesPage.tsx',
  'features/memories/MomentPage.tsx',
  'features/media/MediaPage.tsx',
  'features/culinary/CulinaryPage.tsx',
  'features/whereto/WhereToPage.tsx',
  'features/sizes/SizesPage.tsx',
  'features/onboarding/HistorySweepPage.tsx',
];

/** Модулі, що вмикали світ раніше власним кодом — і вмикають досі. */
const EARLIER = [
  'features/wishlist/WishlistPageBase.tsx',
  'features/plans/PlansPage.tsx',
  'features/plans/PlanDetailsPage.tsx',
  'features/shopping/ShoppingPage.tsx',
];

describe('усі модулі просвічуються світом (ADR-0215)', () => {
  it.each(UNIFIED)('%s вмикає світ і носить клас world-module', (path) => {
    const source = read(path);
    expect(source).toContain('useWorldModule()');
    // Сама сторінка або її вигляд мусять носити клас, інакше власне тло
    // модуля лишиться й закриє сцену.
    const view = path.endsWith('HistorySweepPage.tsx')
      ? read('features/onboarding/HistorySweepView.tsx')
      : source;
    expect(view).toContain('world-module');
  });

  it.each(EARLIER)('%s і далі просвічується', (path) => {
    expect(read(path)).toMatch(/useWorldVisibleRoute\(\)|useWorldModule\(\)/);
  });

  it('гра — виняток за словом власника: світу в ній немає', () => {
    const game = read('features/game/GamePage.tsx');
    expect(game).not.toContain('useWorldModule');
    expect(game).not.toContain('useWorldVisibleRoute');
  });

  it('спільний шар стилів прибирає тло модуля й переводить його токени на світ', () => {
    const css = read('features/world/worldSurface.css');
    const rule = css.slice(css.indexOf("[data-portal-scene='true'] .world-module {"));
    const body = rule.slice(0, rule.indexOf('}'));
    expect(body).toContain('background: none');
    expect(body).toContain('--text: var(--world-text)');
    expect(body).toContain('--surface: var(--world-surface-strong)');
  });
});
