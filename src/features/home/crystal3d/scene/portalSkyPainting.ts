// ============================================================
// Намальоване небо порталу — захід над морем хмар (ADR-0210).
// ------------------------------------------------------------
// ЗВІДКИ ЦЕ. Власник приніс еталон кадру: острів із кристалом висить у
// сутінковому небі, над морем хмар, а сонце сідає просто за кристалом.
// Доти небо було градієнтом із чотирьох зупинок і однією теплою плямою
// (`portalSkyBackdrop.ts`) — і за площею це 65% кадру, тобто найбільший
// розрив із еталоном узагалі.
//
// ЧОМУ НЕ КАРТИНКА. Генератор зображень недоступний (нуль кредитів), а сам
// еталон як текстуру взяти не можна: у ньому впечені інтерфейс, привітання
// й док, і роздільність лише 941 px. Тому небо МАЛЮЄТЬСЯ — тим самим
// прийомом, яким роблять процедурні скайбокси: градієнт, сонце, і хмари з
// шуму, освітлені зсувом густини до сонця.
//
// ЧОМУ ЦЕ ЧИСТА ФУНКЦІЯ БЕЗ THREE. Кольори тут виміряні з еталона
// пікселями (таблиця нижче), і перевіряти їх треба тестом у Node, а не
// оком по знімку. `portalSkyBackdrop.ts` лише кладе ці байти в текстуру.
//
// ДЕТЕРМІНОВАНО. Шум — власний хеш від цілих координат і сталого зерна;
// `Math.random` тут немає і бути не може (CLAUDE.md): небо однакове на
// кожному відкритті й на кожному пристрої.
// ============================================================

/** Колір як три байти sRGB. */
export type Rgb = readonly [number, number, number];

/** Зупинка градієнта: висота кадру (0 — верх) і колір. */
export interface SkyStop {
  at: number;
  color: string;
}

export interface SkyLook {
  /** Небо над обрієм, згори вниз. */
  sky: readonly SkyStop[];
  /** Під обрієм — ґрунт моря хмар, від обрію вниз. */
  below: readonly SkyStop[];
  /** Ядро сонця й широке сяйво навколо нього. */
  sunCore: string;
  sunHalo: string;
  /** Скільки сонця взагалі: 1 — захід, менше — сутінки. */
  sunStrength: number;
  /** Хмари вгорі: освітлений бік, тінь, і край, що горить проти сонця. */
  cloudLit: string;
  cloudShadow: string;
  cloudRim: string;
  /** Море хмар: освітлені верхівки, тіні між ними, і глибина внизу. */
  seaLit: string;
  seaShadow: string;
  seaDeep: string;
}

/**
 * Де що стоїть у кадрі. Усе — частки ширини (`x`) і висоти (`y`, 0 — верх).
 *
 * ВИМІРЯНО НА ЕТАЛОНІ. Найсвітліша смуга неба — y 0.42–0.56, ядро сонця
 * (`#fcf0d8`) праворуч від кристала на y≈0.56. Море хмар починається під
 * верхом острова. У нашому кадрі верх острова стоїть вище, ніж у
 * еталоні (≈0.48 проти 0.58), тож обрій зсунуто разом із ним — інакше
 * сонце сідало б не за кристал, а під острів.
 */
export const PORTAL_SKY_LAYOUT = Object.freeze({
  horizon: 0.55,
  sunX: 0.64,
  sunY: 0.5,
  /** Розмах ядра й сяйва — у частках висоти кадру. */
  sunCoreRadius: 0.05,
  sunHaloRadius: 0.36,
});

/**
 * Кольори з еталона, виміряні усередненням 13×13 пікселів.
 *
 *   y 0.01  #1b2654   y 0.16  #34407c   y 0.31  #4a5895…#7f76b7
 *   y 0.42  #cfb6df   y 0.51  #f8dfd5   y 0.56  #fdd5cb, #fcf0d8 (сонце)
 *   море    #d5afca, #dfc5e5 (верхівки), #b59ac7, #9284b9 (тіні), #746c98
 *
 * Темна тема — той самий кадр на півгодини пізніше: сонце вже сіло, лишилась
 * рожева смуга над морем хмар. Еталон показує лише день; ніч тут — рішення,
 * а не замір, і назване як таке в ADR-0210.
 */
export const PORTAL_SKY_LOOKS: Readonly<Record<'light' | 'dark', SkyLook>> = {
  light: {
    sky: [
      { at: 0, color: '#1b2654' },
      { at: 0.16, color: '#34407c' },
      { at: 0.3, color: '#56609f' },
      { at: 0.4, color: '#8e84c2' },
      { at: 0.48, color: '#dcbcdc' },
      { at: 0.55, color: '#fbd9d0' },
    ],
    below: [
      { at: 0.55, color: '#fbd9d0' },
      { at: 0.68, color: '#cfaccd' },
      { at: 0.84, color: '#a793c3' },
      { at: 1, color: '#7c6ea3' },
    ],
    sunCore: '#fff3de',
    sunHalo: '#f8c9c4',
    sunStrength: 1,
    cloudLit: '#f4d6e4',
    cloudShadow: '#7a78b3',
    cloudRim: '#fff0dc',
    seaLit: '#f5dbe2',
    seaShadow: '#a08dc2',
    seaDeep: '#6c6297',
  },
  dark: {
    sky: [
      { at: 0, color: '#0a0d26' },
      { at: 0.2, color: '#171c46' },
      { at: 0.36, color: '#2e3068' },
      { at: 0.46, color: '#5a4a82' },
      { at: 0.55, color: '#a0708e' },
    ],
    below: [
      { at: 0.55, color: '#a0708e' },
      { at: 0.7, color: '#584a7c' },
      { at: 0.86, color: '#3a325e' },
      { at: 1, color: '#221d3c' },
    ],
    sunCore: '#f4b8a8',
    sunHalo: '#9a5f86',
    sunStrength: 0.55,
    cloudLit: '#8c7aa8',
    cloudShadow: '#2c2a58',
    cloudRim: '#e3a3a6',
    seaLit: '#9c83aa',
    seaShadow: '#4a3f70',
    seaDeep: '#262042',
  },
};

// ── Шум ─────────────────────────────────────────────────────

/** Цілочисельний хеш двох координат і зерна → [0, 1). */
function hash2(x: number, y: number, seed: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 144269504);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, seed);
  const b = hash2(ix + 1, iy, seed);
  const c = hash2(ix, iy + 1, seed);
  const d = hash2(ix + 1, iy + 1, seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/**
 * Фрактальний шум, 0…1.
 *
 * Кожна октава повернута на ~37°, щоб сітка значень не читалась рядами:
 * без повороту купчасті хмари вишиковувались уздовж осей, і небо
 * виглядало вишитим, а не намальованим.
 */
export function fbm(x: number, y: number, octaves: number, seed: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let norm = 0;
  let px = x;
  let py = y;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * valueNoise(px, py, seed + octave * 17);
    norm += amplitude;
    const rx = px * 0.8 - py * 0.6;
    const ry = px * 0.6 + py * 0.8;
    px = rx * 2.03 + 1.7;
    py = ry * 2.03 + 9.2;
    amplitude *= 0.56;
  }
  return sum / norm;
}

// ── Колір ───────────────────────────────────────────────────

export function hexToRgb(hex: string): Rgb {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function gradient(stops: readonly SkyStop[], rgb: readonly Rgb[], v: number): Rgb {
  if (v <= stops[0]!.at) return rgb[0]!;
  for (let index = 1; index < stops.length; index += 1) {
    const current = stops[index]!;
    if (v <= current.at) {
      const previous = stops[index - 1]!;
      const t = (v - previous.at) / Math.max(1e-6, current.at - previous.at);
      return mix(rgb[index - 1]!, rgb[index]!, t);
    }
  }
  return rgb[rgb.length - 1]!;
}

// ── Малювання ───────────────────────────────────────────────

/** Зерно неба. Стале: небо однакове на кожному відкритті. */
const SKY_SEED = 20221226;

/**
 * Розмір полотна неба.
 *
 * 256 × 560 — пропорція телефона (≈9:19.5), бо портал живе на телефоні.
 * Небо м'яке, і лінійна фільтрація текстури розтягує його без сходинок;
 * а кожен піксель тут коштує два фрактальні шуми, тож учетверо більше
 * пікселів — учетверо довший перший кадр на телефоні.
 */
export const PORTAL_SKY_PAINT_WIDTH = 256;
export const PORTAL_SKY_PAINT_HEIGHT = 560;

/**
 * Хмарне поле в точці кадру.
 *
 * Над обрієм — окремі купчасті хмари, яких більшає донизу, до обрію.
 * Під обрієм — суцільне море, стиснуте перспективою: що ближче до обрію,
 * то дрібніші й щільніші верхівки. Повертається густина й координати
 * в «світі хмар», щоб освітлення брало зсув у тому самому просторі.
 */
/**
 * Поріг густини для частки неба, вкритої хмарами (0…1).
 *
 * НЕ ЛІНІЙНИЙ ВІД «ПОКРИТТЯ», І ЦЕ ВИМІРЯНО. Фрактальний шум не
 * рівномірний: його значення тиснуться до 0.5 і рідко виходять за 0.7.
 * Четвертий прохід рахував поріг як `1 − покриття`, і при «покритті» 0.46
 * небо лишилось майже чистим — поріг 0.54 шум перетинав рідко. Тому
 * частка перекладається в поріг у тій смузі, де шум справді живе.
 */
function cloudThreshold(amount: number): number {
  return 0.68 - 0.26 * Math.min(1, Math.max(0, amount));
}

function cloudField(u: number, v: number, aspect: number, layout: typeof PORTAL_SKY_LAYOUT) {
  const horizon = layout.horizon;
  if (v < horizon) {
    /*
     * Великі купи, а не пасма: перший прохід брав дрібніший масштаб і
     * сильне викривлення — поруч з еталоном це читалось як мазки пензля.
     * У еталоні боки кадру повні хмар, а середина вгорі чистіша, тож
     * покриття росте і до обрію, і до країв.
     */
    const x = u * aspect * 2.3;
    const y = v * 3.2;
    const warp = fbm(x * 0.6, y * 0.6, 2, SKY_SEED + 101);
    const density = fbm(x + warp * 0.7, y * 1.3 + warp * 0.45, 6, SKY_SEED);
    const side = smoothstep(0.12, 0.5, Math.abs(u - 0.5));
    /*
     * Біля обрію високі хмари ЗНИКАЮТЬ, а не обриваються: другий прохід
     * різав їх рівною лінією на висоті обрію, і саме ця лінія читалась як
     * межа неба й моря — хоч градієнт під нею вже був неперервним.
     */
    const fade = 1 - smoothstep(horizon - 0.1, horizon - 0.01, v);
    /*
     * ГРЯДИ, А НЕ ВЕЖІ. Третій прохід давав покриття лише за відстанню від
     * центру, і хмари стали вертикальними стовпами по краях кадру. У
     * еталоні вони лежать ярусами: розріджений ярус угорі, щільна гряда
     * над обрієм, — і край кадру лише підсилює обидва.
     */
    const lowBank = smoothstep(0.24, 0.48, v);
    const highBank = Math.exp(-(((v - 0.13) / 0.07) ** 2));
    /*
     * ТИХА ЗОНА ЗА ТЕКСТОМ. Привітання й лічильник днів лежать прямо на
     * небі (y ≈ 0.02–0.24, по центру), і освітлена хмара за ними з'їла б
     * контраст світлого чорнила — яке тут і стоїть саме тому, що небо
     * темне. У еталоні так само: хмари по кутах, середина вгорі чиста.
     */
    const quiet = (1 - smoothstep(0.18, 0.34, Math.abs(u - 0.5))) * (1 - smoothstep(0.2, 0.3, v));
    const amount = Math.min(1, 0.12 + 0.8 * lowBank + 0.5 * highBank + 0.3 * side) * fade * (1 - quiet);
    return { density, threshold: cloudThreshold(amount), sea: false };
  }
  /*
   * ПЕРСПЕКТИВА — НЕ ПОВНА, І ЦЕ СВІДОМО. Чесна площина хмар стискає шум
   * по вертикалі як depth², і перший прохід показав, що з цього виходить:
   * смуги, схожі на крижини на воді. Купчасті хмари — горби, а не
   * розмальована площина, тож вертикаль тут стискається слабше (степінь
   * 0.7), і верхівки лишаються круглими.
   */
  const below = v - horizon;
  const depth = 1 / (below + 0.06);
  const x = (u - 0.5) * aspect * depth * 0.5;
  const y = Math.pow(depth, 0.6) * 1.35;
  const warp = fbm(x * 0.55, y * 0.55, 2, SKY_SEED + 303);
  const density = fbm(x + warp * 0.9, y + warp * 0.7, 5, SKY_SEED + 202);
  // Хмари виринають із сяйва обрію, а не починаються на лінії.
  const emerge = smoothstep(0, 0.08, below);
  /*
   * Море — суцільне: поріг нижчий за найщільніше небо. Спершу воно брало
   * той самий переклад, що й небо, і стало смугами хмар на порожньому тлі.
   */
  return { density, threshold: 0.46 - 0.16 * emerge, sea: true };
}

/**
 * Намалювати небо. Рядок 0 — ВЕРХ кадру (як читає око й як пише тест);
 * у текстуру його перевертає `portalSkyBackdrop.ts`.
 */
export function paintPortalSky(
  look: SkyLook,
  width = PORTAL_SKY_PAINT_WIDTH,
  height = PORTAL_SKY_PAINT_HEIGHT,
  layout = PORTAL_SKY_LAYOUT,
): Uint8Array {
  const skyRgb = look.sky.map((stop) => hexToRgb(stop.color));
  const belowRgb = look.below.map((stop) => hexToRgb(stop.color));
  const sunCore = hexToRgb(look.sunCore);
  const sunHalo = hexToRgb(look.sunHalo);
  const cloudLit = hexToRgb(look.cloudLit);
  const cloudShadow = hexToRgb(look.cloudShadow);
  const cloudRim = hexToRgb(look.cloudRim);
  const seaLit = hexToRgb(look.seaLit);
  const seaShadow = hexToRgb(look.seaShadow);
  const seaDeep = hexToRgb(look.seaDeep);
  const horizonRgb = skyRgb[skyRgb.length - 1]!;

  const aspect = width / height;
  const out = new Uint8Array(width * height * 4);

  for (let row = 0; row < height; row += 1) {
    const v = (row + 0.5) / height;
    for (let column = 0; column < width; column += 1) {
      const u = (column + 0.5) / width;

      // 1. Градієнт.
      let color: Rgb = v < layout.horizon
        ? gradient(look.sky, skyRgb, v)
        : gradient(look.below, belowRgb, v);

      // 2. Сонце: відстань у частках ВИСОТИ, тобто коло, а не еліпс.
      const dx = (u - layout.sunX) * aspect;
      const dy = v - layout.sunY;
      const sunDistance = Math.hypot(dx, dy);
      const halo = Math.exp(-((sunDistance / layout.sunHaloRadius) ** 2)) * look.sunStrength;
      const core = Math.exp(-((sunDistance / layout.sunCoreRadius) ** 2)) * look.sunStrength;
      color = mix(color, sunHalo, halo * 0.55);

      // 3. Хмари.
      const field = cloudField(u, v, aspect, layout);
      const edge0 = field.threshold;
      const alpha = smoothstep(edge0, edge0 + 0.06, field.density);
      if (alpha > 0.002) {
        /*
         * Освітлення зсувом до сонця: де густина СПАДАЄ в бік сонця, там
         * бік хмари, повернутий до світла. Це дає об'єм одним додатковим
         * шумом замість справжнього проходу крізь хмару.
         */
        const towardSunX = -dx / Math.max(1e-3, sunDistance);
        const towardSunY = -dy / Math.max(1e-3, sunDistance);
        const sunward = cloudField(
          Math.min(1, Math.max(0, u + towardSunX * 0.02 / aspect)),
          Math.min(1, Math.max(0, v + towardSunY * 0.02)),
          aspect,
          layout,
        );
        /*
         * Два світла, а не одне. Зсув до сонця дає край, що горить; зсув
         * ДОГОРИ дає об'єм — верх купи освітлений небом, низ у тіні. Без
         * другого хмари на протилежному від сонця боці кадру лишались
         * пласкими плямами, а в еталоні вони там найоб'ємніші.
         */
        const above = cloudField(u, Math.max(0, v - 0.016), aspect, layout);
        const lit = smoothstep(-0.02, 0.06, field.density - sunward.density);
        const top = smoothstep(-0.03, 0.05, field.density - above.density);
        let cloud: Rgb;
        if (field.sea) {
          const depthShade = smoothstep(layout.horizon, 1, v);
          const shadow = mix(seaShadow, seaDeep, depthShade);
          cloud = mix(shadow, seaLit, lit * 0.45 + top * 0.55);
          // Далекі верхівки тонуть у сяйві обрію — повітряна перспектива.
          const haze = 1 - smoothstep(layout.horizon, layout.horizon + 0.12, v);
          cloud = mix(cloud, horizonRgb, haze * 0.7);
        } else {
          cloud = mix(cloudShadow, cloudLit, lit * 0.45 + top * 0.55);
          // Висока хмара бере колір неба за собою: верхні — сині, нижні — рожеві.
          cloud = mix(cloud, color, 0.28 * (1 - smoothstep(0.1, layout.horizon, v)));
        }
        // Край проти сонця горить.
        cloud = mix(cloud, cloudRim, lit * halo * 0.9);
        color = mix(color, cloud, alpha);
      }

      // Смуга сяйва на обрії — з обох боків лінії, щоб лінії не лишилось.
      const band = Math.exp(-(((v - layout.horizon) / 0.045) ** 2));
      color = mix(color, horizonRgb, band * 0.55);

      // 4. Ядро сонця — поверх хмар, бо воно просвічує їхній край.
      color = mix(color, sunCore, core * 0.9);

      const at = (row * width + column) * 4;
      out[at] = Math.round(color[0]);
      out[at + 1] = Math.round(color[1]);
      out[at + 2] = Math.round(color[2]);
      out[at + 3] = 255;
    }
  }
  return out;
}
