// ============================================================
// Еталонний острів проти нашого — форма сцени числами.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «допрацьовуй сцену кристала за допомогою блендер».
//
// Той самий метод, що вже спрацював на дереві (ADR-0104) і на кристалі
// (ADR-0114). Доти еталоном сцени була ПРОЗА — «древній маленький храм,
// який знаходиться на літаючому острові», — а з прози не дістати ні
// глибини кореня, ні того, чи нависає обрив, ні стрункості колони. Кожна
// правка форми була думкою проти думки.
//
// Тепер еталон — геометрія (`scripts/models/reference-island.py`), і
// обидва тіла міряє ОДНА функція (`islandProfile.ts`). Дві мірки дали б
// числа, які не можна класти поруч.
//
// ЩО ЦЕЙ ФАЙЛ СТЕРЕЖЕ:
//
//   • Еталон мусить лишатись тим, чим був. Числа нижче зняті з
//     побайтово відтворюваного GLB (два прогони скрипта дають однаковий
//     sha256), і якщо скрипт зміниться — вони мусять змінитись явно, а
//     не тихо переїхати разом із висновками.
//   • Наша сцена мусить лишатись у названій смузі навколо еталона. Смуги
//     широкі там, де число — смак, і вузькі там, де воно — пропорція,
//     яку око впізнає.
// ============================================================
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readGlbPositions } from '../evolution/glbPositions';
import { islandSilhouetteProfile, templeFrontProfile } from './islandProfile';
import {
  PORTAL_ISLAND_RUBBLE,
  buildPortalIslandGeometry,
  buildPortalTempleGeometry,
} from './portalIsland';

const REFERENCE = 'scripts/models/reference/island-temple.glb';
const SEED = 20221226;

function reference(name: string): number[] {
  return readGlbPositions(new Uint8Array(readFileSync(REFERENCE)), name);
}

function ours(build: { getAttribute(name: string): { array: ArrayLike<number> } }): number[] {
  return Array.from(build.getAttribute('position').array);
}

/**
 * Виміри еталона на день, коли писався ADR-0145.
 *
 * Це ЗАПИСАНІ ВИМІРИ, а не оголошені константи скрипта. Різниця істотна:
 * профіль нормує все на найширше місце тіла, а найширшим виявляється
 * вершина карниза з власним шумом по глибині, тож 0.299 — не те саме, що
 * оголошені 0.13 просідання. Переписувати ці числа можна лише разом із
 * поясненням, що саме змінилось у формі еталона.
 */
const REFERENCE_WAS = {
  overhangDrop: 0.299,
  topTaper: 0.917,
  rootDepth: 1.365,
  rimRagged: 0.048,
  colonnadeVoid: 0.656,
  colonnadeShare: 0.6,
  pedimentSlopeDeg: 13.231,
};

describe('еталон острова', () => {
  const island = islandSilhouetteProfile(reference('ReferenceIsland'));
  const temple = templeFrontProfile(reference('ReferenceTemple'));

  it('лишається тим, чим був', () => {
    expect(island.overhangDrop).toBeCloseTo(REFERENCE_WAS.overhangDrop, 2);
    expect(island.topTaper).toBeCloseTo(REFERENCE_WAS.topTaper, 2);
    expect(island.rootDepth).toBeCloseTo(REFERENCE_WAS.rootDepth, 2);
    expect(island.rimRagged).toBeCloseTo(REFERENCE_WAS.rimRagged, 2);
    expect(temple.colonnadeVoid).toBeCloseTo(REFERENCE_WAS.colonnadeVoid, 2);
    expect(temple.colonnadeShare).toBeCloseTo(REFERENCE_WAS.colonnadeShare, 2);
    expect(temple.pedimentSlopeDeg).toBeCloseTo(REFERENCE_WAS.pedimentSlopeDeg, 1);
  });

  it('еталонний храм тримає грецькі пропорції, а не просто «схожі»', () => {
    // Дорика: просвіт 1.2–1.5 діаметра дає близько двох третин повітря в
    // колонаді, фронтон — 12.5–16°. Якщо скрипт колись розійдеться з
    // власним описом, це впаде тут, а не в наших числах.
    expect(temple.pedimentSlopeDeg).toBeGreaterThan(12.5);
    expect(temple.pedimentSlopeDeg).toBeLessThan(16.5);
    expect(temple.colonnadeVoid).toBeGreaterThan(0.55);
    expect(temple.colonnadeVoid).toBeLessThan(0.75);
  });
});

describe('наш острів проти еталона', () => {
  const island = islandSilhouetteProfile(
    ours(buildPortalIslandGeometry(SEED, PORTAL_ISLAND_RUBBLE.high)),
  );

  it('ВЕРХ НЕ Є НАЙШИРШИМ МІСЦЕМ: карниз під кромкою є й він помітний', () => {
    /*
     * Головне число жанру, і перший же вимір показав, що в нас його
     * майже немає: 0.192 проти 0.299 в еталона, а до появи карниза —
     * 0.022, та ще й зроблених шумом, а не будовою. На силуеті це
     * читалось фаскою, а не карнизом, тобто тіло було усіченим конусом —
     * плитою, яка ні на чому не лежить.
     */
    expect(island.overhangDrop).toBeGreaterThan(REFERENCE_WAS.overhangDrop * 0.75);
    expect(island.overhangDrop).toBeLessThan(REFERENCE_WAS.overhangDrop * 1.45);
  });

  it('ТІЛО ЗВУЖУЄТЬСЯ ДО ВЕРХУ, а не стоїть стовпом', () => {
    // Плита лишається одиницею до самого краю. Смуга знизу — щоб острів
    // не перетворився на пагорб, у якого верху взагалі не видно.
    expect(island.topTaper).toBeLessThan(0.95);
    expect(island.topTaper).toBeGreaterThan(0.72);
  });

  it('КОРІНЬ ДОВШИЙ ЗА ПІВШИРИНУ ОСТРОВА', () => {
    /*
     * Літаючий острів читається літаючим тому, що під ним висить більше
     * каменю, ніж видно згори. Коротший корінь дає млинець, який просто
     * ні на чому не лежить.
     */
    expect(island.rootDepth).toBeGreaterThan(1);
    expect(island.rootDepth).toBeGreaterThan(REFERENCE_WAS.rootDepth * 0.8);
  });

  it('обрис рваний, але не розсипаний', () => {
    // Смуга широка навмисно: рваність — це смак у межах «не токарний
    // верстат» і «не зубці». Еталон 0.048, ми 0.052.
    expect(island.rimRagged).toBeGreaterThan(REFERENCE_WAS.rimRagged * 0.5);
    expect(island.rimRagged).toBeLessThan(REFERENCE_WAS.rimRagged * 2.5);
  });
});

describe('наш храм проти еталона', () => {
  const temple = templeFrontProfile(ours(buildPortalTempleGeometry(SEED)));

  it('КОЛОНИ СТОЯТЬ ПО-ДОРІЙСЬКИ, а не як вийде', () => {
    /*
     * Перший вимір: 0.717 повітря проти 0.656 в еталона, бо крок колон
     * був 2.02 діаметра при дорійських 1.2–1.5. Стрункість при цьому
     * випадково збігалась (5.7 при 5.6) — і саме тому вада не була видна
     * оком: одна вірна пропорція з трьох рятує силует рівно настільки,
     * щоб він не читався поламаним.
     */
    /*
     * Смуга ВИМІРЯНА, а не взята як відхилення від еталона, і це
     * виправлення знайшла мутація: `colonnadeVoid` нормується на ширину
     * силуету, а ширина храму ВИВОДИТЬСЯ з кроку колон — тож рівномірне
     * розтягнення будівлі числа не рухає майже зовсім. Перша редакція з
     * межею ±0.10 мутацію «крок 2.02» пропускала.
     *
     * Виміряно, як число відповідає на крок: 1.05 діаметра → 0.616,
     * 1.35 → 0.655 (еталон 0.656), 2.02 → 0.717. Дорика тримається
     * 1.2–1.5, тобто 0.63–0.68; смуга нижче лишає по сотій із запасом і
     * валить обидві сусідні мутації.
     */
    expect(temple.colonnadeVoid).toBeGreaterThan(0.62);
    expect(temple.colonnadeVoid).toBeLessThan(0.7);
  });

  it('КОЛОНАДА ЗАЙМАЄ СВОЮ ЧАСТКУ ВИСОТИ', () => {
    // Було 0.525 проти 0.600: антаблемент і фронтон з'їдали висоту, яка
    // належить колонам, і храм читався присадкуватим.
    expect(Math.abs(temple.colonnadeShare - REFERENCE_WAS.colonnadeShare)).toBeLessThan(0.12);
  });

  it('ФРОНТОН ГРЕЦЬКИЙ, а не двосхилий дах хати', () => {
    // Було 21.0° — за межами будь-якого грецького храму. 12.5–16.5 — та
    // сама смуга, якою міряється еталон.
    expect(temple.pedimentSlopeDeg).toBeGreaterThan(12.5);
    expect(temple.pedimentSlopeDeg).toBeLessThan(16.5);
  });
});
