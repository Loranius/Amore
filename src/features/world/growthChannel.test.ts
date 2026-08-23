import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// ============================================================
// Приріст рахує сцена, а каже шапка.
// ------------------------------------------------------------
// **Знайдено критикою Головної.** Механізм «щось виросло» у порталі був,
// але підключений РІВНО до `CrystalScene.tsx` — застарілого рендерера,
// який завантажується лише в гілці `if (error)`. Тобто відповідь на
// головне питання `PRODUCT.md` («чи змінилось наше життя?») з'являлась
// тільки тоді, коли основний рендерер падав.
//
// Друга частина інваріанта — де рядок ЖИВЕ. `.artifact-world` має
// `aria-hidden="true"` (§48), тож підпис усередині сцени для читача не
// існує; він мусить бути в `.home`, а це сусід сцени, не її нащадок.
//
// Тест дивиться в текст: підняти сцену в jsdom означає підняти WebGL,
// якого в цьому середовищі немає.
// ============================================================

const SRC = join(__dirname, '..');
const read = (relative: string) => readFileSync(join(SRC, relative), 'utf8');

/** Текст без коментарів, довжина рядків збережена. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (_match, lead: string) => lead);
}

describe('канал приросту', () => {
  it('живий рендерер кристала звітує про приріст', () => {
    /*
     * Саме `EvolutionCrystalPreviewScene` — той, що малює кристал у
     * звичайному стані. Якщо звіт колись переїде у `CrystalScene.tsx`,
     * підпис знову існуватиме лише під час аварії.
     */
    const scene = stripComments(read('home/crystal3d/evolution/EvolutionCrystalPreviewScene.tsx'));
    expect(scene).toMatch(/useGrowthSinceLastVisit\(growthEvents\)/);
    expect(scene).toMatch(/reportGrowth\(growth\)/);
  });

  it('звіт рахується з подій рушія, а не з власного підрахунку', () => {
    // Друге визначення «що вважати подією пари» розійшлося б із рушієм
    // тихо: підпис казав би «+2», коли кристал виріс на три.
    const scene = stripComments(read('home/crystal3d/evolution/EvolutionCrystalPreviewScene.tsx'));
    expect(scene).toMatch(/pipeline\?\.artifact\.events/);
  });

  it('гаки приросту стоять до ранніх виходів сцени', () => {
    /*
     * Регрес, який у цьому файлі вже стався одного разу з
     * `useWorldFrameloop`: гак поставили нижче, ніж `if (error)` та
     * `if (isPending)`, і на частині рендерів він не викликався зовсім.
     * React каже «Rendered more hooks than during the previous render»,
     * але на екрані це виглядає не як помилка, а як «кристал сьогодні
     * чомусь простіший».
     */
    const scene = stripComments(read('home/crystal3d/evolution/EvolutionCrystalPreviewScene.tsx'));
    const hook = scene.indexOf('useGrowthSinceLastVisit(');
    const reporter = scene.indexOf('useWorldGrowthReporter(');
    const firstReturn = scene.indexOf('if (error)');
    expect(hook).toBeGreaterThan(-1);
    expect(reporter).toBeGreaterThan(-1);
    expect(firstReturn).toBeGreaterThan(-1);
    expect(hook).toBeLessThan(firstReturn);
    expect(reporter).toBeLessThan(firstReturn);
  });

  it('рядок малюється в шапці, а не всередині aria-hidden сцени', () => {
    const hero = stripComments(read('home/Hero.tsx'));
    const world = stripComments(read('world/ArtifactWorld.tsx'));
    expect(hero).toMatch(/className="home-hero-growth"/);
    expect(hero).toMatch(/useWorldGrowth\(\)/);
    // Світ лишається без тексту: він `aria-hidden`, і рядок там був би
    // невидимим для читача з екранним диктором.
    expect(world).not.toMatch(/home-hero-growth/);
    expect(world).toMatch(/aria-hidden="true"/);
  });

  it('зміна артефакта скидає підпис', () => {
    // Конвеєр дерева ще не звітує; підпис від кристала, що лишився б
    // висіти над деревом, був би рядком про об'єкт, якого немає.
    const world = stripComments(read('world/ArtifactWorld.tsx'));
    expect(world).toMatch(/setGrowth\(null\);\s*\n\s*\}, \[artifact\]\)/);
  });
});
