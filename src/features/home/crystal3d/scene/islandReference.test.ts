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
import {
  cloudSilhouetteProfile,
  islandSilhouetteProfile,
  rockFacetProfile,
  templeFrontProfile,
} from './islandProfile';
import {
  PORTAL_CLOUD_BANKS,
  PORTAL_ISLAND_CROWN_TRIANGLES,
  PORTAL_ISLAND_RUBBLE,
  buildPortalCloudGeometry,
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
 * Виміри еталона.
 *
 * Це ЗАПИСАНІ ВИМІРИ, а не оголошені константи скрипта. Різниця істотна:
 * профіль нормує все на найширше місце тіла, а найширшим виявляється
 * вершина карниза з власним шумом, тож `overhangDrop` — не те саме, що
 * оголошені 0.13 просідання.
 *
 * ЧИСЛА ПЕРЕПИСАНО РАЗОМ ІЗ ADR-0147, і ось що саме змінилось у формі
 * еталона: скеля перестала бути гладким кільцевим каркасом. Blender
 * ламає її зміщенням за об'ємною текстурою і ПЛОСКИМ спрощенням, тобто
 * робить те, чого процедурний код у сцені зробити не може. Форма (баня,
 * карниз, корінь) лишилась оголошеною тією самою — але тепер вона з
 * породи, а не з гуми, і мірка це бачить: 1 418 трикутників стало 8 746,
 * а `rimRagged` виріс із 0.048 до значення нижче, бо обрис тепер ламаний,
 * а не хвилястий.
 *
 * Числа `crown*` зняті лише з граней, ПОВЕРНУТИХ УГОРУ: інакше в них
 * потрапляє обрив із коренем, у яких злам різкий за побудовою.
 *
 * ЧИСЛА ХМАРИ ДОДАНО РАЗОМ ІЗ ADR-0148, і разом з ними змінився сам
 * файл еталона: у GLB з'явилось третє тіло, `ReferenceCloud`, тож
 * розмір і sha256 фікстури інші (411 552 байти, 71336c11d11623ed).
 * Змістовно це не правка старих тіл — острів і храм у ньому побайтово
 * ті самі, — а нове тіло поруч: пасмо кумулусів із метакуль, зрізане
 * знизу площиною. Метакулі тут не примха: злиття куль дає перетяжки між
 * горбами, яких кільцевий генератор сцени не зробить жодним шумом, а
 * зріз площиною дає пласке дно ЗА ПОБУДОВОЮ, а не за наміром.
 */
const REFERENCE_WAS = {
  overhangDrop: 0.264,
  topTaper: 0.837,
  rootDepth: 1.414,
  rimRagged: 0.046,
  colonnadeVoid: 0.656,
  colonnadeShare: 0.6,
  pedimentSlopeDeg: 13.231,
  crownDihedralMean: 19.9,
  crownDihedralMedian: 13.7,
  crownAreaSpread: 1.08,
  cloudTopRough: 0.222,
  cloudBaseFlat: 0.035,
  cloudAspect: 5.23,
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

  it('ЕТАЛОН — БИТИЙ КАМІНЬ, а не гладкий каркас', () => {
    /*
     * Це те, заради чого Blender тут і стоїть: зміщення за об'ємною
     * текстурою й пласке спрощення роблять із кільцевого каркаса породу з
     * пласкими гранями різного розміру. Процедурний код у сцені так не
     * вміє — і не мусить, бо він будує форму, а не ліпить.
     *
     * Якщо колись хтось зніме модифікатори, еталон тихо стане гумовим
     * горбом, і всі висновки про наш камінь підуть за ним. Тому це
     * перевіряється тут, а не в наших числах.
     */
    const rock = rockFacetProfile(reference('ReferenceIsland'));
    expect(rock.dihedralMean).toBeCloseTo(REFERENCE_WAS.crownDihedralMean, 0);
    expect(rock.dihedralMedian).toBeCloseTo(REFERENCE_WAS.crownDihedralMedian, 0);
    expect(rock.areaSpread).toBeCloseTo(REFERENCE_WAS.crownAreaSpread, 1);
    // Гладкий каркас давав медіану 12.4° на всьому тілі й лише 5.5° на
    // верху; порода мусить ламатись помітно частіше.
    expect(rock.dihedralMedian).toBeGreaterThan(10);
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

  it('ЕТАЛОННА ХМАРА КУПЧАСТА: верх бугристий, дно рівне', () => {
    /*
     * Хмару від столової гори відрізняє не форма взагалі, а РІЗНИЦЯ між
     * верхом і низом. Рівень конденсації один на все пасмо, тож дно
     * рівне; вгору кумулус росте купками, тож верх рваний. У гори рвані
     * обидва краї, у пластини — жоден.
     *
     * Числа еталона: верх 0.222 висоти, дно 0.035 — усемеро рівніше.
     * Якщо колись зі скрипта зникне `bisect_plane`, залишиться
     * картоплина з метакуль, і всі наші висновки про хмари підуть за
     * нею. Тому це стоїть тут, у мірці еталона.
     */
    const cloud = cloudSilhouetteProfile(reference('ReferenceCloud'));
    expect(cloud.topRough).toBeCloseTo(REFERENCE_WAS.cloudTopRough, 2);
    expect(cloud.baseFlat).toBeCloseTo(REFERENCE_WAS.cloudBaseFlat, 2);
    expect(cloud.aspect).toBeCloseTo(REFERENCE_WAS.cloudAspect, 1);
    expect(cloud.baseFlat).toBeLessThan(cloud.topRough * 0.4);
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

  it('ПЛАТО — БИТИЙ КАМІНЬ, а не згладжений горб', () => {
    /*
     * Вимір, заради якого еталон і зробили породою (ADR-0147). Двогранний
     * кут між сусідніми гранями, узятий лише на гранях, ПОВЕРНУТИХ УГОРУ,
     * тобто на тій поверхні, на яку пара дивиться згори:
     *
     *   було    медіана  5.5°, середнє 11.9°, розкид площ 0.52
     *   еталон  медіана 13.7°, середнє 19.9°, розкид площ 1.08
     *
     * Один великий октав рельєфу дає пагорби, а не злам: між сусідніми
     * вершинами висота майже не міняється. Другий, усемеро частіший
     * октав ламає поверхню, а зсув вершин уздовж власного радіуса ламає
     * саму ґратку — бо однаковий розмір граней читається токарним
     * верстатом, хай яким рваним буде рельєф.
     */
    const rock = rockFacetProfile(
      ours(buildPortalIslandGeometry(SEED, PORTAL_ISLAND_RUBBLE.high))
        .slice(0, PORTAL_ISLAND_CROWN_TRIANGLES * 9),
    );
    expect(rock.dihedralMedian).toBeGreaterThan(REFERENCE_WAS.crownDihedralMedian * 0.7);
    /*
     * СТЕЛЮ СТЕРЕЖЕ СЕРЕДНЄ, А НЕ МЕДІАНА, і це виправлення знайшла
     * мутація. Медіана насичується й на великих розмахах повертає назад:
     * виміряно по амплітуді дрібного октава 0.04 → 13.9, 0.08 → 16.8,
     * 0.12 → 18.1, 0.20 → 14.8. Тобто «утричі більше» вона пропускала.
     * Середнє росте монотонно: 22.7 → 26.7 → 29.2, і межа 1.3 еталонного
     * (25.9) валить обидві сусідні мутації, лишаючи нам запас.
     *
     * Стеля потрібна не для охайності: на екрані телефона грань
     * завбільшки з піксель читається шумом, а не каменем.
     */
    expect(rock.dihedralMean).toBeLessThan(REFERENCE_WAS.crownDihedralMean * 1.3);
    /*
     * Розкид площ лишається НИЖЧИМ за еталонний, і це записана межа, а не
     * досягнення: 0.72 проти 1.08. Кільцева сітка не може дати повного
     * розкиду породи, не зламавши ані посадку уламків, ані рівну зону під
     * жеодою. Межа стереже те, що вже здобуто.
     */
    expect(rock.areaSpread).toBeGreaterThan(0.62);
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

describe('наші хмари проти еталона', () => {
  /*
   * Хмари міряються ПОШТУЧНО, і це не педантизм. Пасмо кидає розмір
   * випадково, тож середнє по вісімнадцяти може бути еталонним і тоді,
   * коли дві-три хмари з нього — столові гори. Проміжна редакція цієї
   * правки саме такою й була: середнє 5.13 при розкиді від 2.6 до 10.6.
   */
  const banks = PORTAL_CLOUD_BANKS.high;
  const all = ours(buildPortalCloudGeometry(SEED, banks));
  const floatsPerCloud = all.length / banks;
  const clouds = Array.from({ length: banks }, (_, index) =>
    cloudSilhouetteProfile(all.slice(index * floatsPerCloud, (index + 1) * floatsPerCloud)));
  const mean = (pick: (cloud: (typeof clouds)[number]) => number): number =>
    clouds.reduce((sum, cloud) => sum + pick(cloud), 0) / clouds.length;

  it('ЖОДНА ХМАРА НЕ Є СТОЛОВОЮ ГОРОЮ', () => {
    /*
     * Число, заради якого міряли. Ширина й висота кидались незалежно, і
     * стрункість виходила добутком двох випадковостей: середнє 8.94 при
     * розкиді від 4.46 до 18.59, тоді як в еталона 5.23. Хмара зі
     * стрункістю 18 — це пласка смуга на горизонті, тобто рівно той
     * краєвид, який літаючий острів мав скасувати.
     *
     * Тепер вільним лишається РОЗМІР, а форма кидається у вузькій смузі:
     * ширина 4.2…10.8, стрункість 2.95…3.70 (на екрані це 4.1…6.3, бо
     * профіль міряє силует із горбами, а не прямокутник).
     */
    for (const cloud of clouds) {
      expect(cloud.aspect).toBeGreaterThan(3.4);
      expect(cloud.aspect).toBeLessThan(7);
    }
    expect(mean((cloud) => cloud.aspect)).toBeCloseTo(REFERENCE_WAS.cloudAspect, 0);
  });

  it('ВЕРХ БУГРИСТИЙ, ДНО РІВНЕ — та сама різниця, що в еталона', () => {
    /*
     * Дно рівне, але НЕ ВИМІРЯНЕ ЛІНІЙКОЮ: до цієї правки розкид дна був
     * рівно 0.000 в усіх вісімнадцяти хмар, бо всі п'ять горбів сиділи
     * на одній константі, а рівний нуль у природі виглядає різаним
     * склом. Еталон дає 0.035, ми тепер 0.031.
     *
     * Стеля тут важливіша за підлогу: щойно дно стає таким же рваним, як
     * верх, хмара перестає бути хмарою.
     */
    for (const cloud of clouds) {
      expect(cloud.baseFlat).toBeLessThan(cloud.topRough * 0.5);
    }
    expect(mean((cloud) => cloud.baseFlat)).toBeGreaterThan(REFERENCE_WAS.cloudBaseFlat * 0.5);
    expect(mean((cloud) => cloud.baseFlat)).toBeLessThan(REFERENCE_WAS.cloudBaseFlat * 1.5);
    expect(mean((cloud) => cloud.topRough)).toBeGreaterThan(REFERENCE_WAS.cloudTopRough * 0.8);
    expect(mean((cloud) => cloud.topRough)).toBeLessThan(REFERENCE_WAS.cloudTopRough * 1.25);
  });
});
