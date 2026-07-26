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
  env: false,
  iridescence: false,
  glass: true,
  bloom: false,
});

/** Профіль «як було до фази 11» — усе вимкнено. Потрібен, щоб власник міг
 *  порівняти з тим, що він уже бачив, і щоб тести мали базову лінію. */
export const BARE_GFX: GfxProfile = Object.freeze({
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
export function parseGfxProfile(raw: string | null | undefined): GfxProfile {
  if (raw === null || raw === undefined || raw.trim() === '') return DEFAULT_GFX;

  const tokens = raw
    .toLowerCase()
    .split(/[,\s]+/)
    .filter((t) => t !== '');
  if (tokens.length === 0) return DEFAULT_GFX;

  if (tokens.includes('off') || tokens.includes('none')) return BARE_GFX;
  if (tokens.includes('all')) {
    return Object.freeze({ env: true, iridescence: true, glass: true, bloom: true });
  }

  // Відносний режим (+/-) працює від дефолту; абсолютний — від нуля.
  const relative = tokens.some((t) => t.startsWith('+') || t.startsWith('-'));
  const base = relative ? DEFAULT_GFX : BARE_GFX;
  const out: GfxProfile = { ...base };

  for (const token of tokens) {
    const negated = token.startsWith('-');
    const name = ALIASES[token.replace(/^[+-]/, '')];
    if (name === undefined) continue;
    out[name] = !negated;
  }
  return Object.freeze(out);
}

/** Профіль із поточного URL. Читається один раз при монтуванні сцени. */
export function gfxProfileFromLocation(search: string): GfxProfile {
  return parseGfxProfile(new URLSearchParams(search).get('gfx'));
}

/** Чи це звичайний режим (нічого не діагностуємо). */
export const isDefaultGfx = (p: GfxProfile): boolean =>
  p.env === DEFAULT_GFX.env &&
  p.iridescence === DEFAULT_GFX.iridescence &&
  p.glass === DEFAULT_GFX.glass &&
  p.bloom === DEFAULT_GFX.bloom;

/**
 * Підпис для видимого значка на екрані. Потрібен саме на телефоні: якщо
 * власник помилиться в слові (`?gfx=blomo`), профіль мовчки вийде порожнім,
 * він побачить кристал без білого фону й зробить ХИБНИЙ висновок, що Bloom
 * безпечний. Значок показує, що РЕАЛЬНО ввімкнено, тож помилка набору
 * видно одразу.
 */
export function describeGfx(p: GfxProfile): string {
  const on = (['env', 'iridescence', 'glass', 'bloom'] as const).filter((k) => p[k]);
  return on.length === 0 ? 'gfx: off' : `gfx: ${on.join(' + ')}`;
}
