import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Одні двері для всіх модулів.
// ------------------------------------------------------------
// **Виміряно знімками всіх маршрутів.** Портал мав п'ять різних способів
// почати сторінку (`mm-head`, `sched-hero`, `media-head`, схований
// `budget-title`, і картка-самозванець у «Скарбничці») та чотири модулі,
// які не починали її ніяк. Пара, яка ходить між вкладками, щоразу
// отримувала інші двері.
//
// Тест дивиться в текст сторінок: підняти їх у jsdom означає підняти
// WebGL, якого в цьому середовищі немає.
// ============================================================

const FEATURES = join(__dirname, '..', '..', 'features');

/**
 * Модулі-документи — ті, що показують список або набір карток.
 *
 * Головна й «Вішліст» тут відсутні НАВМИСНО: вони малюють вміст поверх
 * тривимірної сцени, де заголовок з'їв би висоту в артефакта, заради
 * якого екран існує. У них свої двері — привітання з лічильником і
 * панель-пігулка. Виняток названий, а не забутий (ADR-0046).
 */
const DOCUMENT_PAGES = [
  'memories/MemoriesPage.tsx',
  'media/MediaPage.tsx',
  'piggybank/PiggyBankPage.tsx',
  'schedule/SchedulePage.tsx',
  'shopping/ShoppingPage.tsx',
  'plans/PlansPage.tsx',
  'whereto/WhereToPage.tsx',
  'culinary/CulinaryPage.tsx',
];

const WORLD_PAGES = ['home/HomePage.tsx', 'wishlist/WishlistPage.tsx'];

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, lead: string) => lead);
}

const read = (relPath: string) => stripComments(readFileSync(join(FEATURES, relPath), 'utf8'));

describe('двері модуля', () => {
  for (const page of DOCUMENT_PAGES) {
    it(`${page} відчиняється спільним PageHeader`, () => {
      const source = read(page);
      expect(source).toMatch(/<PageHeader/);
      expect(source).toMatch(/from '@\/components\/ui\/PageHeader'/);
    });
  }

  for (const page of WORLD_PAGES) {
    it(`${page} лишається світовим екраном без заголовка`, () => {
      // Не «ще не зробили»: заголовок тут забрав би висоту в артефакта.
      expect(read(page)).not.toMatch(/<PageHeader/);
    });
  }

  it('старих реалізацій заголовка не лишилось', () => {
    /*
     * Саме тут ховається рецидив: достатньо, щоб один модуль лишив
     * власний заголовок, і «однаково оформлено» знову стає майже.
     */
    const dead = ['mm-head', 'media-head', 'sched-title', 'sched-subtitle'];
    const found: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) { walk(path); continue; }
        if (!/\.(tsx?|css)$/.test(entry) || /\.test\./.test(entry)) continue;
        if (path.includes(`components${sep}ui${sep}PageHeader`)) continue;
        const text = stripComments(readFileSync(path, 'utf8'));
        for (const name of dead) {
          if (text.includes(name)) found.push(`${relative(FEATURES, path)}: ${name}`);
        }
      }
    };
    walk(FEATURES);
    expect(found).toEqual([]);
  });
});
