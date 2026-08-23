import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// «Наш шлях» відкривається з головної, і лише з неї (ADR-0041).
// ------------------------------------------------------------
// Раніше єдиним входом був рядок-тизер у вкладці «Події» модуля «Плани»
// (`RelationshipJourney.tsx`). Власник попросив прибрати проміжну
// зупинку: дотик по лічильнику днів на головній має одразу відкривати
// небо. Вкладку прибрали разом із рядком — другого шляху на `/journey`
// у порталі більше немає.
//
// Ці перевірки стережуть не вигляд, а сам факт: що вхід один, що вихід
// веде туди, звідки прийшли, і що стара адреса `/plans?tab=events` не
// лишилась ціллю навігації, куди дорога вже не веде.
// ============================================================

const ROOT = join(__dirname, '../../..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('вхід у «Наш шлях»', () => {
  it('лічильник днів на головній веде на /journey', () => {
    const hero = read('src/features/home/Hero.tsx');
    expect(hero).toMatch(/<Link\s+to="\/journey"/);
    // Клікабельний елемент має назву дії: підпису всередині немає,
    // самого лише числа й дати недостатньо для читача екрана.
    expect(hero).toMatch(/aria-label="[^"]*Наш шлях[^"]*"/);
  });

  it('другого входу через «Плани» більше не існує', () => {
    expect(existsSync(join(ROOT, 'src/features/calendar/RelationshipJourney.tsx'))).toBe(false);
    expect(existsSync(join(ROOT, 'src/features/calendar/relationshipJourney.css'))).toBe(false);

    const plans = read('src/features/plans/PlansPage.tsx');
    expect(plans).not.toMatch(/RelationshipJourney/);
    expect(plans).not.toMatch(/\?tab=events|tab=.events./);
    // Вкладок немає — а з ними й стану розділу, який вони перемикали.
    expect(plans).not.toMatch(/role="tab"/);
  });

  it('вихід із неба веде на головну, а не на застарілу адресу планів', () => {
    const journey = read('src/features/journey/JourneyPage.tsx');
    expect(journey).not.toMatch(/\/plans\?tab=events/);
    expect(journey).toMatch(/navigate\('\/'\)/);
  });
});
