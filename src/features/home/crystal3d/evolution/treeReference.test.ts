// ============================================================
// Еталонне дерево проти нашого — перший вимір форми числами.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «починай з еталонного дерева».
//
// Доти еталоном були КАРТИНКИ: п'ять моделей, розібраних у
// `amore-tree-look` на прозу. Через це кожна скарга на форму — «замале»,
// «більше на кущ схоже», «ширина крони гуляє» — упиралась у те, що
// порівнювати не було з чим, і лагодилось те, до чого дотягувалась рука.
//
// Тепер еталон — геометрія (`scripts/models/reference-tree.py`), і обидва
// дерева міряє ОДНА функція (`treeSilhouetteProfile`). Дві мірки дали б
// числа, які не можна класти поруч.
//
// ЩО ЦЕЙ ФАЙЛ СТЕРЕЖЕ, А ЩО ЛИШЕ ЗАПИСУЄ:
//
//   • Еталон мусить бути тим, чим себе називає. Скрипт оголошує зверху
//     свої частки — 0.85 ширини, 0.60 висоти найширшого місця, 0.28
//     чистого стовбура, — і виміряний GLB мусить їх давати. Інакше мірка
//     тихо стане іншою, і всі висновки з неї — теж.
//   • Розрив між еталоном і нами лише ЗАПИСАНО храповиком: він великий,
//     він названий у `MODULE_STATUS.md`, і поки що завдання цього файлу —
//     не дати йому вирости, поки лагодять щось інше.
// ============================================================
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildArtifactFromSnapshot } from '@/engine/evolution/adapters';
import { applyEvolutionSandboxSources } from '@/features/home/evolutionSandbox';
import {
  treeProfileDistance,
  treeSilhouetteProfile,
  type TreeProfile,
} from '@/engine/species/tree/treeProfile';
import { buildTreeLabPreviewFromArtifact } from '../treeLab/buildTreeLabPreview';
import { readGlbPositions } from './glbPositions';

const REFERENCE = 'scripts/models/reference/tree-40y.glb';

/**
 * Частки, оголошені в `reference-tree.py`.
 *
 * Продубльовані тут навмисно: тест мусить упасти, якщо скрипт і його
 * власний опис розійдуться. Читати їх із файла означало б звіряти файл
 * сам із собою.
 */
const DECLARED = {
  crownSpread: 0.85,
  widestAt: 0.60,
  clearBole: 0.28,
};

const START = '2022-12-26';
const DAYS_PER_YEAR = 365.2425;
/** Профіль «середня» — той самий, яким знімається лабораторія. */
const PROFILE = { cal: 4, plan: 2, wish: 2, place: 3, mem: 8, media: 4, off: 15 };

function referenceProfile(): TreeProfile {
  return treeSilhouetteProfile(readGlbPositions(new Uint8Array(readFileSync(REFERENCE))));
}

function ourProfile(years: number): TreeProfile {
  const days = Math.round(years * DAYS_PER_YEAR);
  const asOf = new Date(Date.parse(`${START}T00:00:00.000Z`) + days * 86_400_000).toISOString();
  const sources = applyEvolutionSandboxSources({
    enabled: true,
    values: {
      relationshipDays: days,
      calendarEvents: Math.round(years * PROFILE.cal),
      completedPlans: Math.round(years * PROFILE.plan),
      fulfilledWishes: Math.round(years * PROFILE.wish),
      visitedPlaces: Math.round(years * PROFILE.place),
      memories: Math.round(years * PROFILE.mem),
      finishedMedia: Math.round(years * PROFILE.media),
      sharedDaysOff: Math.round(years * PROFILE.off),
    },
    asOf,
    relationshipStartedAt: START,
    snapshot: {
      calendarEvents: [], plans: [], wishlistItems: [],
      mapPlaces: [], memories: [], memoryLinks: [], media: [],
    },
  });
  const artifact = buildArtifactFromSnapshot({
    coupleId: 'amore:tree-reference',
    asOf,
    snapshot: sources.snapshot,
    engineConfig: {
      engineVersion: '1.0.0',
      relationshipStartedAt: START,
      timeZone: 'Europe/Kyiv',
      leapDayPolicy: 'feb-28',
    },
  }).blueprint;
  const build = buildTreeLabPreviewFromArtifact({
    artifact, asOf, lod: 'medium', rulesVersion: 'tree-reference', asOfPolicy: 'fixed-fixture',
  });

  /*
   * Гілки ПЛЮС листя: силует — це те, що видно з боку, і картка листка в
   * ньому є так само, як гілка. Межа листка береться тією самою формулою,
   * що в `measureThreeTreeReach` — радіус осі плюс довжина картки, — щоб
   * це не було числом, вигаданим заради цього порівняння.
   */
  const positions = [...build.mesh.positions];
  for (const leaf of build.leaves.instances) {
    const canopy = build.canopyDepth.profiles[leaf.sequence];
    const silhouette = build.crownSilhouette.profiles[leaf.sequence];
    const point = silhouette?.renderPosition ?? canopy?.renderPosition ?? leaf.position;
    const length = leaf.length
      * (canopy?.scaleMultiplier ?? 1)
      * (silhouette?.scaleMultiplier ?? 1);
    const radial = Math.hypot(point.x, point.z) + length;
    const azimuth = Math.atan2(point.z, point.x);
    positions.push(point.x, point.y, point.z);
    positions.push(Math.cos(azimuth) * radial, point.y, Math.sin(azimuth) * radial);
    positions.push(point.x, point.y + length, point.z);
  }
  return treeSilhouetteProfile(positions);
}

const reference = referenceProfile();

describe('еталонне дерево', () => {
  it('читається як проста сцена без трансформацій', () => {
    // Мірка бере позиції з буфера НАПРЯМУ. Якщо експорт колись почне
    // класти дерево у зсунутий вузол, краще впасти, ніж міряти не те.
    expect(() => referenceProfile()).not.toThrow();
    expect(reference.height).toBeGreaterThan(0);
  });

  it('має ту форму, яку сам оголошує', () => {
    /*
     * Скрипт пише зверху три частки. Якщо після правки геометрії виміряне
     * розійдеться з написаним, мірка стане іншою мовчки — а з нею й усі
     * висновки, зроблені проти неї.
     */
    expect(reference.spread).toBeCloseTo(DECLARED.crownSpread / 2, 1);
    expect(Math.abs(reference.widestAt - DECLARED.widestAt)).toBeLessThan(0.06);
    expect(Math.abs(reference.clearBole - DECLARED.clearBole)).toBeLessThan(0.06);
  });

  it('крона сходить угорі, а не зрізана', () => {
    // Найвища смуга мусить бути ВУЖЧОЮ за найширшу принаймні вдвічі —
    // саме цим дерево кінчається верхівкою, а не пласким зрізом.
    const top = reference.bands.at(-1)!;
    expect(top).toBeLessThan(reference.spread * 0.5);
  });

  it('стовбур унизу товщий, ніж крона там широка', () => {
    // Комель — це перша смуга; вище стовбур тонший, поки не почалась крона.
    expect(reference.bands[0]!).toBeGreaterThan(reference.bands[2]!);
  });
});

describe('наше дерево проти еталона', () => {
  /*
   * ХРАПОВИК, А НЕ ЦІЛЬ.
   *
   * Числа нижче — це те, що виміряно СЬОГОДНІ, з невеликим запасом. Вони
   * не кажуть «так добре»; вони кажуть «не гірше».
   *
   * ADR-0105 закрив ширину крони, ADR-0106 — решту три: порожню смугу між
   * стовбуром і кроною, незімкнену верхівку й тонкий комель. Пороги нижче
   * підтягнуто до нових вимірів, тож вони більше не «терплять» ваду, а
   * стережуть здобуте.
   */
  const mature = ourProfile(40);

  it('форма не розходиться з еталоном більше, ніж уже розходиться', () => {
    /*
     * Виміряно: 0.358 -> 0.141 (ADR-0105) -> 0.106 (ADR-0106). Останні два
     * числа проти УТОЧНЕНОГО еталона: його крону перебудовано з дискретних
     * куль на оболонку обертання, бо кулі давали пилчасту огинальну з
     * розмахом 30% у верхній чверті, і проти такої пилки не можна було
     * судити, чи сходиться наша верхівка.
     */
    expect(treeProfileDistance(reference, mature)).toBeLessThan(0.14);
  });

  it('чистий стовбур не задирається', () => {
    /*
     * ПОРОЖНЯ СМУГА МІЖ СТОВБУРОМ І КРОНОЮ — четвертий розрив. Крона
     * починалась аж із 0.38 зросту при еталонних 0.275: смуги 25-40%
     * висоти давали 0.01-0.03 радіуса там, де еталон тримає 0.14-0.27.
     * Форма читалась льодяником. Після ADR-0106 (`CROWN_BASE_SHARE`
     * 0.35 -> 0.27) — 0.28.
     */
    expect(mature.clearBole).toBeLessThan(0.32);
  });

  it('крона не ширшає далі', () => {
    /*
     * НАЙБІЛЬШИЙ РОЗРИВ, І ВІН ЖЕ — ВІДПОВІДЬ НА «БІЛЬШЕ НА КУЩ СХОЖЕ».
     * Було 0.661 півширини на висоту проти 0.410 в еталона — дерево
     * ШИРШЕ, НІЖ ВИЩЕ, 1.32 проти 0.82. Кущ — це саме воно, і розміром
     * воно не лікувалось: криву росту піднімали двічі, а форма лишалась.
     *
     * Після ADR-0105 — 0.396 проти еталонних 0.423. Поріг стоїть ледь вище
     * за еталон: якщо крона знову поповзе вшир, це впаде ще до того, як
     * стане видно на екрані.
     */
    expect(mature.spread).toBeLessThan(0.45);
  });

  it('верхівка не стає ще пласкішою', () => {
    /*
     * Було 0.239 при найширшій 0.399 — верхівка тримала 60% ширини крони,
     * тобто дерево кінчалось зрізом. Після ADR-0106 (збіг вильоту догори
     * 0.45 -> 0.78) — 0.093 при 0.396, тобто 23%; в еталона 0.046 при
     * 0.423, тобто 11%.
     */
    expect(mature.bands.at(-1)!).toBeLessThan(mature.spread * 0.30);
  });

  it('комель не тоншає далі', () => {
    /*
     * Було 0.0230 радіуса на висоту проти еталонних 0.0380 — кореневого
     * потовщення в нашого стовбура не було взагалі. Після ADR-0106
     * (`applyTreeRootFlare` плюс стрункість 29 -> 25) — рівно 0.0380.
     */
    expect(mature.baseRadius).toBeGreaterThan(0.034);
  });

  it('дерево все ще росте вгору з роками', () => {
    // Догма `PRODUCT.md` §6, перевірена тією самою міркою: висота профілю
    // мусить рости, хоч би що робила форма.
    const young = ourProfile(12);
    expect(mature.height).toBeGreaterThan(young.height);
  });
});
