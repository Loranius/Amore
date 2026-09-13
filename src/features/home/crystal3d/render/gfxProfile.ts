// ============================================================
// gfxProfile — які графічні можливості вмикати в сцені.
// ------------------------------------------------------------
// ЧОМУ ЦЕ ІСНУЄ. У липні на телефоні власника фон під кристалом ставав
// суцільним білим прямокутником (виміряно по пікселях: усередині рівно
// rgb(255,255,255), навколо рожевий rgb(255,244,247)). Баг залежав від
// КУТА — зникав, коли в кадрі не було геометрії, — і не відтворювався в
// headless Chromium ані в dev, ані на продакшн-білді.
//
// За три спроби (`4c8c504`, `63bf2e7`, `ba6ad77`) зі сцени прибрали ВСЕ,
// що могло бути причиною:
//
//   • `material.transmission` — тут причина ДОВЕДЕНА по джерелах three.js:
//     `WebGLRenderer::renderTransmissionPass` жорстко ставить
//     `setClearColor(0xffffff, 0.5)`, щойно `clearAlpha < 1`, а canvas у
//     нас прозорий. Це вимкнено назавжди й прапорця не має;
//   • `<Environment>`/`<Lightformer>` і `<EffectComposer>`/`<Bloom>` —
//     прибрані В ПАРІ, тож жоден із них не ізольований. Комміт `ba6ad77`
//     прямо це визнає: «best-supported hypothesis, not a confirmed fix».
//
// Відтоді сцена бідна не тому, що так задумано, а тому що діагноз ніхто не
// поставив. Цей модуль дає інструмент, якого не було жодного з трьох разів:
// кожен підозрюваний вмикається ОКРЕМО через `?gfx=`, і власник може
// сказати, який саме білить фон.
//
// ДЕФОЛТ вмикає лише френелівське «скло» (render/skyReflection.ts) — воно
// не створює жодного render target. Обидва підозрювані (карта оточення,
// Bloom) лишаються за прапорцем, тож поки триває бісекція, звичайний
// перегляд пари не наближається до баґа. Базова лінія «як було» — `?gfx=off`.
// ============================================================

/** Можливості, які можна ввімкнути прапорцем. */
export interface GfxProfile {
  /**
   * СПРАВЖНЯ карта оточення (процедурна equirect-текстура, без CDN).
   *
   * План цієї фази припускав, що така текстура обійдеться без render
   * target — на відміну від drei `<Environment>` з його CubeCamera. Це
   * виявилось НЕПРАВДОЮ: `WebGLCubeUVMaps.get()` проганяє через
   * `PMREMGenerator` і equirect-, і cube-текстури, а той створює render
   * target типу `HalfFloatType` (`PMREMGenerator.js:273`). Для PBR-
   * матеріалів обійти це неможливо.
   *
   * Тобто це рівно той самий клас механізму, що лишився головним
   * підозрюваним. Тому — тільки прапорцем, ніколи в дефолті: це
   * ДІАГНОСТИКА для пристрою власника, а не спосіб покращити вигляд.
   * Дефолтне «скло» дає render/skyReflection.ts без жодного проходу.
   */
  env: boolean;
  /**
   * Іризація граней (`MeshPhysicalMaterial.iridescence`) — суто шейдер,
   * без повноекранних проходів, тобто ЖОДНОГО ризику. І все ж вимкнена:
   * заміряно, що в цій сцені вона нічого не робить. Іризація фарбує
   * френелівську частину ДЗЕРКАЛЬНОЇ пелюстки, а наші тіла — `metalness: 0`
   * з м'яким світлом і пласким затіненням, тож дзеркальна складова
   * мізерна проти дифузної. Навіть на максимумі (1.0) різниця з
   * вимкненою — 0.5 одиниці середньої дельти пікселя при 18.6 від карти
   * оточення. Лишається під прапорцем для майбутньої роботи з матеріалом,
   * але вмикати її «щоб було» означало б рекламувати те, чого не видно.
   */
  iridescence: boolean;
  /**
   * «Скло» без карти оточення: френелівський край + підмішане небо/земля,
   * дописані в `outgoingLight` через `onBeforeCompile`
   * (render/skyReflection.ts). Нуль render target'ів, нуль текстур — тому
   * саме це, а не env, стоїть у дефолті.
   */
  glass: boolean;
  /**
   * СПРАВЖНЄ ЗАЛОМЛЕННЯ: небо в сцені + непрозоре полотно +
   * `MeshPhysicalMaterial.transmission` (ADR-0178).
   *
   * Це не ще один відтінок «скла». `glass` вище дописує френелівський
   * край у `outgoingLight` і нічого не заломлює; тіло лишається
   * непрозорим. Тут тіло стає справді прозорим, і крізь нього видно
   * острів.
   *
   * ЧОМУ ЦЕ ДОСІ БУЛО НЕМОЖЛИВО, і чому стало можливим саме так.
   * `WebGLRenderer::renderTransmissionPass` жорстко ставить
   * `setClearColor(0xffffff, 0.5)`, щойно `clearAlpha < 1`, а наше
   * полотно прозоре — бо небо це CSS-градієнт ПІД полотном. Тому
   * прозоре тіло малювало біле там, де перекривало небо.
   *
   * Рядком нижче в тому ж `three` стоїть `background.render( scene )`:
   * замок відмикається зсередини. Небо переїжджає В СЦЕНУ
   * (`PortalSky`), полотно стає непрозорим — і буфер заломлення містить
   * небо з островом.
   *
   * Ціна названа: ще один повноекранний render target щокадру, +1 draw
   * call на небо, і повернення сортування прозорих тіл (ADR-0007
   * «непрозорий без винятків» доведеться переглядати, якщо це колись
   * піде в дефолт). Тому — прапорцем, і тільки прапорцем, доки пристрій
   * власника не скаже своє.
   */
  refraction: boolean;
  /** `<EffectComposer><Bloom/>` — повноекранний прохід. Найпідозріліший із
   *  тих, що лишились, тому в дефолт не потрапляє, доки пристрій не
   *  скаже, що це безпечно. */
  bloom: boolean;
}

/**
 * Дефолт фази 11 — рівно те, що (а) не створює жодного render target і
 * (б) справді видно на рендерах:
 *
 *   можливість | середня дельта пікселя проти «off»
 *   -----------|-----------------------------------
 *   glass      | 6.7   ← у дефолті
 *   iridescence| 0.5   ← вимкнена: невидима (див. коментар вище)
 *   env        | 18.6  ← за прапорцем: PMREM → HalfFloat render target
 *
 * Тобто найбільше для «як на референсі» дає саме карта оточення — і саме
 * вона впирається в невирішений баг із білим фоном. Тому фаза й
 * закінчується перевіркою на пристрої, а не «покращенням навмання».
 */
export const DEFAULT_GFX: GfxProfile = Object.freeze({
  refraction: false,
  env: false,
  iridescence: false,
  glass: true,
  bloom: false,
});

/**
 * Дефолт для ПОТУЖНИХ пристроїв (ADR-0173).
 *
 * 9 вересня власник провів бісекцію, якої бракувало з липня, і зняв
 * обидва підозрювані з підозри: ані карта оточення, ані Bloom не білять
 * фон на його телефоні. Заборона трималась не на властивості коду, а на
 * непоставленому діагнозі.
 *
 * ЧОМУ ЛИШЕ НА `high`, І ЦЕ РІШЕННЯ ВЛАСНИКА. Один чистий вимір — не
 * гарантія: липневий баг залежав від кута й був нестабільним. Профіль
 * якості вже вирішує, скільки сцена може собі дозволити; повноекранний
 * прохід і PMREM із HalfFloat render target — рівно та вартість, яку
 * слабкий пристрій платити не мусить. Заразом це лишає більшість
 * пристроїв поза механізмом, що колись ламався: якщо він повернеться,
 * повернеться не всюди.
 */
export const RICH_GFX: GfxProfile = Object.freeze({
  refraction: false,
  env: true,
  iridescence: false,
  glass: true,
  bloom: true,
});

/** Профіль якості сцени — той самий ключ, що в решти лічильників. */
export type GfxQuality = 'high' | 'balanced' | 'low' | 'fallback';

/**
 * Який дефолт належить цьому профілю якості.
 *
 * Єдине місце, де це вирішується. Поки таких місць було б два, вони
 * розійшлися б того дня, коли хтось поворухне одне.
 */
export function defaultGfxFor(quality: GfxQuality): GfxProfile {
  return quality === 'high' ? RICH_GFX : DEFAULT_GFX;
}

/** Профіль «як було до фази 11» — усе вимкнено. Потрібен, щоб власник міг
 *  порівняти з тим, що він уже бачив, і щоб тести мали базову лінію. */
export const BARE_GFX: GfxProfile = Object.freeze({
  refraction: false,
  env: false,
  iridescence: false,
  glass: false,
  bloom: false,
});

/** Короткі синоніми для набору в адресному рядку з телефона. */
const ALIASES: Readonly<Record<string, keyof GfxProfile>> = {
  env: 'env',
  environment: 'env',
  irid: 'iridescence',
  iridescence: 'iridescence',
  glass: 'glass',
  rim: 'glass',
  refraction: 'refraction',
  refract: 'refraction',
  // «Скло» вже зайняте френелівським краєм, тож синонім називає те, що
  // справді відбувається: крізь тіло видно острів.
  through: 'refraction',
  bloom: 'bloom',
};

/**
 * Розбирає `?gfx=` у профіль. Чиста функція від рядка — жодного window,
 * тож перевіряється тестом без DOM.
 *
 * Форми:
 *   `?gfx=off`            — базова лінія (усе вимкнено);
 *   `?gfx=all`            — усе ввімкнено, разом із Bloom;
 *   `?gfx=env`            — РІВНО env поверх базової лінії (ізоляція!);
 *   `?gfx=env,bloom`      — рівно ці дві;
 *   `?gfx=+bloom`         — дефолт ПЛЮС bloom;
 *   `?gfx=-env`           — дефолт МІНУС env.
 *
 * Перелік без знаків означає «тільки перелічене» — саме це й потрібно для
 * бісекції: інакше не можна побачити ефект однієї можливості окремо.
 * Невідоме слово ігнорується мовчки: адресний рядок телефона — не місце
 * для суворого синтаксису, а зламати ним рендер не можна.
 */
export function parseGfxProfile(
  raw: string | null | undefined,
  /**
   * Від чого рахувати «дефолт». З ADR-0173 він залежить від профілю
   * якості, тож `?gfx=-bloom` на потужному пристрої мусить знімати те,
   * що там СПРАВДІ ввімкнено, а не те, що колись було дефолтом.
   */
  fallbackProfile: GfxProfile = DEFAULT_GFX,
): GfxProfile {
  if (raw === null || raw === undefined || raw.trim() === '') return fallbackProfile;

  const tokens = raw
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((t) => t !== '');
  if (tokens.length === 0) return fallbackProfile;

  if (tokens.includes('off') || tokens.includes('none')) return BARE_GFX;
  if (tokens.includes('all')) {
    return Object.freeze({ env: true, iridescence: true, glass: true, bloom: true, refraction: true });
  }

  // Відносний режим (+/-) працює від дефолту; абсолютний — від нуля.
  const relative = tokens.some((t) => t.startsWith('+') || t.startsWith('-'));
  const base = relative ? fallbackProfile : BARE_GFX;
  const out: GfxProfile = { ...base };

  for (const token of tokens) {
    const negated = token.startsWith('-');
    const name = ALIASES[token.replace(/^[+-]/, '')];
    if (name === undefined) continue;
    out[name] = !negated;
  }
  return Object.freeze(out);
}

/** Профіль із поточного URL, від дефолту цього профілю якості. */
export function gfxProfileFromLocation(
  search: string,
  quality: GfxQuality = 'high',
): GfxProfile {
  return parseGfxProfile(new URLSearchParams(search).get('gfx'), defaultGfxFor(quality));
}

/**
 * Чи просив хтось діагностики в адресі.
 *
 * Значок показується САМЕ ЗА ЦИМ, а не за «профіль відрізняється від
 * дефолтного». Відколи Bloom у дефолті на потужних пристроях, `?gfx=bloom`
 * дорівнює дефолту — і значок зник би рівно тоді, коли він найпотрібніший
 * (ADR-0173).
 */
export function isGfxRequested(search: string): boolean {
  const raw = new URLSearchParams(search).get('gfx');
  return raw !== null && raw.trim() !== '';
}

/** Чи це звичайний режим (нічого не діагностуємо). */
export const isDefaultGfx = (p: GfxProfile): boolean =>
  p.env === DEFAULT_GFX.env &&
  p.iridescence === DEFAULT_GFX.iridescence &&
  p.glass === DEFAULT_GFX.glass &&
  p.refraction === DEFAULT_GFX.refraction &&
  p.bloom === DEFAULT_GFX.bloom;

/**
 * Підпис для видимого значка на екрані. Потрібен саме на телефоні: якщо
 * власник помилиться в слові (`?gfx=blomo`), профіль мовчки вийде порожнім,
 * він побачить кристал без білого фону й зробить ХИБНИЙ висновок, що Bloom
 * безпечний. Значок показує, що РЕАЛЬНО ввімкнено, тож помилка набору
 * видно одразу.
 */
export function describeGfx(p: GfxProfile): string {
  const on = (['env', 'iridescence', 'glass', 'refraction', 'bloom'] as const).filter((k) => p[k]);
  return on.length === 0 ? 'gfx: off' : `gfx: ${on.join(' + ')}`;
}
