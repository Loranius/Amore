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
    expect(scene).toMatch(/useGrowthSinceLastVisit\(growthEvents, 'crystal'\)/);
    expect(scene).toMatch(/reportGrowth\(growth === null \? null : \{ species: 'crystal'/);
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

  it('іменник підпису приходить ЗІ ЗВІТУ, а не з другого джерела', () => {
    /*
     * **ВИМОГА (ADR-0188), знайдена живим кадром.** Першою редакцією цієї
     * зміни риф до каналу під'єднали, і шапка над рифом написала
     * «У кристалі 435 нових митей»: іменник був зашитий у підпис, бо доти
     * звітував один вид.
     *
     * Вид можна було б узяти з вибору артефакта поруч — `ArtifactWorld`
     * скидає приріст при зміні виду, тож зазвичай вони збігаються. Але
     * тоді ІМЕНЕМ розпоряджався б один файл, а ЧИСЛОМ інший, і розійтись
     * вони могли б тихо. Тут їх каже один звіт.
     */
    const hero = stripComments(read('home/Hero.tsx'));
    expect(hero).toMatch(/growthCaption\(growth\.summary, partner, growth\.species\)/);

    const rules = stripComments(read('home/growthSinceLastVisit.ts'));
    expect(rules).not.toMatch(/У кристалі/);
    expect(rules).toMatch(/HOME_ARTIFACT_LOCATIVE\[species\]/);
  });

  it('зміна артефакта скидає підпис', () => {
    // Види монтуються по черзі, і підпис від попереднього, що лишився б
    // висіти над наступним, був би рядком про об'єкт, якого вже немає.
    const world = stripComments(read('world/ArtifactWorld.tsx'));
    expect(world).toMatch(/setGrowth\(null\);\s*\n\s*\}, \[artifact\]\)/);
  });
});

describe('канал приросту: риф', () => {
  /*
   * ВИМОГА (ADR-0188): пара, яка обрала риф, бачить той самий рядок
   * приросту, що й пара з кристалом.
   *
   * Доти `MODULE_STATUS.md` називав це межею: «приріст рифа рядком не
   * звітує». Тобто на рифі не було ЖОДНОЇ відповіді на питання «чи
   * змінилось наше життя з минулого разу» — а це те, заради чого
   * артефакт і стоїть на головній.
   *
   * Перевірки тут ті самі, що в кристала, і з тієї самої причини: кожна
   * з цих помилок тиха. Сцена без звіту виглядає робочою, а гак під
   * раннім виходом дає «артефакт сьогодні чомусь простіший».
   */
  const scene = stripComments(read('home/reef3d/world/ReefWorldScene.tsx'));

  it('сцена рифа звітує про приріст', () => {
    // Вид передається В ГАК, бо він обирає ще й сховище бачених подій:
    // у рифа воно своє (ADR-0188 — «різниця 107 не є приростом»).
    expect(scene).toMatch(/useGrowthSinceLastVisit\(reef\.growthEvents \?\? null, 'reef'\)/);
    expect(scene).toMatch(/reportGrowth\(growth === null \? null : \{ species: 'reef'/);
  });

  it('звіт рахується з подій РУШІЯ, а не з власного підрахунку', () => {
    /*
     * Друге визначення «що вважати подією пари» розійшлося б із рушієм
     * тихо. Події беруться з того самого `artifact.events`, з якого
     * рахує кристал, — план рифа їх лише переносить.
     */
    expect(scene).toMatch(/reef\.growthEvents/);
    const plan = stripComments(read('home/reef3d/world/useReefPlan.ts'));
    expect(plan).toMatch(/artifact\.events\.map/);
    expect(plan).toMatch(/attribution\?\.actorId/);
  });

  it('гаки приросту стоять до ранніх виходів сцени', () => {
    // Той самий регрес, що вже стався в кристала з `useWorldFrameloop`.
    const hook = scene.indexOf('useGrowthSinceLastVisit(');
    const reporter = scene.indexOf('useWorldGrowthReporter(');
    const firstReturn = scene.indexOf('if (reef.isPending)');
    expect(hook).toBeGreaterThan(-1);
    expect(reporter).toBeGreaterThan(-1);
    expect(firstReturn).toBeGreaterThan(-1);
    expect(hook).toBeLessThan(firstReturn);
    expect(reporter).toBeLessThan(firstReturn);
  });

  it('обидві сцени знімають за собою підпис', () => {
    /*
     * Перемикання виду не має лишати чужий рядок: кристал і риф
     * монтуються по черзі, і той, що йде, мусить прибрати свій звіт.
     */
    const crystal = stripComments(read('home/crystal3d/evolution/EvolutionCrystalPreviewScene.tsx'));
    expect(crystal).toMatch(/return \(\) => reportGrowth\(null\)/);
    expect(scene).toMatch(/return \(\) => reportGrowth\(null\)/);
  });
});

describe('канал приросту: дерево', () => {
  /*
   * ВИМОГА (ADR-0189): дерево було ОСТАННІМ видом, над яким пара не
   * бачила жодної відповіді на питання «чи змінилось наше життя з
   * минулого разу». Канал стояв готовий від самого початку — під'єднати
   * бракувало лише подій, які конвеєр дерева й так тримав у руках.
   */
  const scene = stripComments(read('home/crystal3d/evolution/EvolutionTreePreviewScene.tsx'));

  it('сцена дерева звітує про приріст своїм іменем', () => {
    expect(scene).toMatch(/useGrowthSinceLastVisit\(preview\?\.growthEvents \?\? null, 'tree'\)/);
    expect(scene).toMatch(/reportGrowth\(growth === null \? null : \{ species: 'tree'/);
  });

  it('звіт рахується з подій рушія, а не з власного підрахунку', () => {
    const preview = stripComments(read('home/crystal3d/treeLab/useTreeLabPortalPreview.ts'));
    expect(preview).toMatch(/artifactResult\.blueprint\.events\.map/);
    expect(preview).toMatch(/attribution\?\.actorId/);
  });

  it('гаки приросту стоять до ранніх виходів сцени', () => {
    const hook = scene.indexOf('useGrowthSinceLastVisit(');
    const reporter = scene.indexOf('useWorldGrowthReporter(');
    const firstReturn = scene.indexOf('if (isPending)');
    expect(hook).toBeGreaterThan(-1);
    expect(reporter).toBeGreaterThan(-1);
    expect(firstReturn).toBeGreaterThan(-1);
    expect(hook).toBeLessThan(firstReturn);
    expect(reporter).toBeLessThan(firstReturn);
  });

  it('усі три види знімають за собою підпис', () => {
    const crystal = stripComments(read('home/crystal3d/evolution/EvolutionCrystalPreviewScene.tsx'));
    const reef = stripComments(read('home/reef3d/world/ReefWorldScene.tsx'));
    for (const source of [crystal, reef, scene]) {
      expect(source).toMatch(/return \(\) => reportGrowth\(null\)/);
    }
  });
});
