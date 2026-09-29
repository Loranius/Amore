// ============================================================
// Небо «Нашого шляху» — намальоване, а не завантажене (ADR-0214, ADR-0231).
// ------------------------------------------------------------
// ADR-0214 зробив небо намальованим: туманність малює воркер, зірки —
// точки GPU у пікселях екрана, тож нічого не вантажиться й не розмивається.
//
// ADR-0231 перемалював його З НУЛЯ на слово власника: «фон повністю знуля
// перемалюй на 3д зоряне небо 360°». Небо над світом порталу (вуаль
// ADR-0216) було бузковою мрякою, крізь яку видно кристал, а шар «зоряного
// пилу» у фрагментному шейдері на телефоні читався як телевізійний шум.
// Тепер небо — справжній глибокий космос навколо камери на всі 360°:
//
//  - ЧУМАЦЬКИЙ ШЛЯХ — смуга зі структурою: зоряні хмари, тонке зерно,
//    темні пилові прожилки вздовж осі й тепле ядро в одному напрямку, як у
//    справжньої галактики; поза ядром смуга холодна, бузково-блакитна;
//  - ТУМАННОСТІ ЕМІСІЇ — рідкі рожеві й бірюзові хмари, гущі біля смуги;
//  - ЗІРКИ — три роди: тисячі дрібних (густіші в смузі), яскравіші й кілька
//    десятків «героїв» із променями (`journeyHeroStars`).
//
// Модуль чистий і детермінований: власний хеш-шум, стале зерно, жодного
// `Math.random`. Небо однакове на кожному відкритті.
// ============================================================

/**
 * Розгортка туманності. 1024×512 → 1536×768 (ADR-0231): у новому небі є
 * тонка структура — прожилки пилу й зерно зоряних хмар, — і на меншій
 * розгортці вона розпливалась. Малюється у воркері; зірки світять одразу.
 */
export const JOURNEY_NEBULA_WIDTH = 1536;
export const JOURNEY_NEBULA_HEIGHT = 768;

/**
 * Скільки зірок у небі. 5200 → 11 000 після виміру: щільність іскор на кадрі
 * була 4.0 на тисячу пікселів проти 5.2 на скриншоті власника. Точки GPU —
 * один виклик малювання на весь шар, тож число майже нічого не коштує.
 */
export const JOURNEY_STAR_COUNT = 16_000;

const SKY_SEED = 0x5a17_2022;

/**
 * Кольори, виміряні з екрана власника (скриншот «Наш шлях», 2026-09-27):
 * квантилі розмитого кадру від найтемнішого до найсвітлішого.
 */
export const JOURNEY_SKY_COLOURS = {
  /** Глибокий космос між хмарами — синьо-чорний. */
  void: '#050414',
  /** Ледь помітний підсвіт порожнечі. */
  deep: '#0e0b2a',
  /** Холодне сяйво смуги. */
  cold: '#5b5aa8',
  /** Бузкові гребені зоряних хмар. */
  lavender: '#9a8fd6',
  /** Тепле ядро галактики. */
  core: '#f2c9a3',
  /** Найгарячіша середина ядра. */
  coreHot: '#fff1dc',
  /** Туманність емісії — рожева. */
  pink: '#c8468a',
  /** Туманність емісії — бірюзова. */
  teal: '#2c93a8',
} as const;

/**
 * Площина Чумацького Шляху: одинична нормаль. Смуга трохи нахилена, щоб
 * не лягати рівно по горизонту — так небо виглядає знайденим, а не
 * розрахованим. Спільна для туманності й зірок: зірки густішають рівно там,
 * де світиться смуга.
 *
 * Нормаль майже перпендикулярна до погляду камери (камера дивиться з +x на
 * сузір'я): смуга перетинає кадр навскіс, а ядро (`JOURNEY_CORE_DIRECTION`)
 * стоїть трохи збоку від сузір'я. Перший живий кадр ADR-0231 з попередньою
 * нормаллю показав порожню частину неба — смуга була за спиною камери.
 */
export const JOURNEY_BAND_NORMAL: readonly [number, number, number] = (() => {
  const raw = [0.25, 0.8, 0.55];
  const length = Math.hypot(raw[0]!, raw[1]!, raw[2]!);
  return [raw[0]! / length, raw[1]! / length, raw[2]! / length] as const;
})();

export function hexToRgb(hex: string): [number, number, number] {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

// ── Шум ──────────────────────────────────────────────────────

function hash3(x: number, y: number, z: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(z, 0x9e3779b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Тривимірний value noise: без шва на сфері, бо сфера лежить у просторі. */
export function valueNoise3(x: number, y: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const fz = fade(z - z0);
  const c = (dx: number, dy: number, dz: number) => hash3(x0 + dx, y0 + dy, z0 + dz, seed);
  const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * fx;
  const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * fx;
  const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * fx;
  const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * fx;
  const y0v = x00 + (x10 - x00) * fy;
  const y1v = x01 + (x11 - x01) * fy;
  return y0v + (y1v - y0v) * fz;
}

export function fbm3(x: number, y: number, z: number, octaves: number, seed: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let norm = 0;
  let frequency = 1;
  for (let octave = 0; octave < octaves; octave += 1) {
    sum += amplitude * valueNoise3(x * frequency, y * frequency, z * frequency, seed + octave * 1013);
    norm += amplitude;
    amplitude *= 0.52;
    frequency *= 2.03;
  }
  return sum / norm;
}

// ── Сфера ────────────────────────────────────────────────────

/**
 * Напрямок для пікселя розгортки — ТОЧНО та сама угода, що в
 * `THREE.SphereGeometry`: `x = −cos φ · sin θ`, `y = cos θ`, `z = sin φ · sin θ`,
 * де `u = φ / 2π`, а рядок 0 — південний полюс (текстура без `flipY`).
 * Інша угода розвела б смугу туманності й смугу зірок.
 */
export function nebulaDirection(u: number, v: number): [number, number, number] {
  const phi = u * Math.PI * 2;
  const theta = (1 - v) * Math.PI;
  return [-Math.cos(phi) * Math.sin(theta), Math.cos(theta), Math.sin(phi) * Math.sin(theta)];
}

/** Близькість до смуги Чумацького Шляху, 0…1. */
export function bandCloseness(direction: readonly [number, number, number]): number {
  const [nx, ny, nz] = JOURNEY_BAND_NORMAL;
  const off = direction[0] * nx + direction[1] * ny + direction[2] * nz;
  return Math.exp(-((off / 0.34) ** 2));
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function mix(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  return [a[0]! + (b[0]! - a[0]!) * t, a[1]! + (b[1]! - a[1]!) * t, a[2]! + (b[2]! - a[2]!) * t];
}

/**
 * Напрям ядра галактики — точка на самій смузі (перпендикуляр до її нормалі),
 * куди світло смуги тепліє й густішає.
 */
export const JOURNEY_CORE_DIRECTION: readonly [number, number, number] = (() => {
  const [nx, , nz] = JOURNEY_BAND_NORMAL;
  // cross(N, up) лежить у площині смуги.
  const raw = [-nz, 0, nx];
  const length = Math.hypot(raw[0]!, raw[1]!, raw[2]!);
  return [raw[0]! / length, raw[1]! / length, raw[2]! / length] as const;
})();

/** Наскільки напрям близький до ядра галактики, 0…1. */
export function coreCloseness(direction: readonly [number, number, number]): number {
  const [cx, cy, cz] = JOURNEY_CORE_DIRECTION;
  const along = direction[0] * cx + direction[1] * cy + direction[2] * cz;
  return smoothstep(0.45, 1, along) ** 1.6;
}

/**
 * Туманність на розгортці `width×height`, RGBA байтами (sRGB).
 *
 * Шари додаються світлом до майже чорної порожнечі, а не змішуються між
 * собою: так смуга світиться, а не «фарбує» небо, і темні прожилки пилу
 * справді гасять світло, а не лягають сірою плямою.
 */
export function paintJourneyNebula(
  width = JOURNEY_NEBULA_WIDTH,
  height = JOURNEY_NEBULA_HEIGHT,
): Uint8Array {
  const c = Object.fromEntries(
    Object.entries(JOURNEY_SKY_COLOURS).map(([key, hex]) => [key, hexToRgb(hex)]),
  ) as Record<keyof typeof JOURNEY_SKY_COLOURS, [number, number, number]>;
  const [nx, ny, nz] = JOURNEY_BAND_NORMAL;
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const v = (row + 0.5) / height;
    for (let column = 0; column < width; column += 1) {
      const u = (column + 0.5) / width;
      const d = nebulaDirection(u, v);
      const [x, y, z] = d;

      // Смуга не рівна: її вісь хвилюється, ширина дихає.
      const warp = fbm3(x * 1.7, y * 1.7, z * 1.7, 3, SKY_SEED + 7) - 0.5;
      const off = x * nx + y * ny + z * nz + warp * 0.14;
      const narrow = Math.exp(-((off / 0.2) ** 2));
      const wide = Math.exp(-((off / 0.5) ** 2));

      // Зоряні хмари — середній масштаб; зерно — дрібний.
      const clouds = fbm3(x * 5 + warp * 2, y * 5 - warp, z * 5 + warp, 5, SKY_SEED);
      const grain = fbm3(x * 17, y * 17, z * 17, 3, SKY_SEED + 19);
      // Прожилки пилу — «хребти» шуму, лише вздовж осі смуги.
      const ridgeNoise = fbm3(x * 4.2 + 3.1, y * 4.2, z * 4.2 - 1.7, 4, SKY_SEED + 41);
      const ridge = 1 - Math.abs(ridgeNoise * 2 - 1);
      const lanes = smoothstep(0.7, 0.93, ridge) * narrow;

      const core = coreCloseness(d);
      const cloudLight = smoothstep(0.35, 0.8, clouds);
      let light = wide * 0.09
        + narrow * (0.22 + 0.55 * cloudLight) * (0.6 + 0.4 * grain)
        + core * narrow * (0.26 + 0.38 * cloudLight);
      light *= 1 - 0.82 * lanes;

      const glowColour = mix(mix(c.cold, c.lavender, cloudLight), c.core, Math.min(1, core * 1.6));
      const hot = core * narrow * smoothstep(0.55, 0.9, clouds) * (1 - lanes);

      // Туманності емісії — рідкі, гущі біля смуги.
      const emission = fbm3(x * 2.3 + 13, y * 2.3, z * 2.3 - 5, 4, SKY_SEED + 57);
      const pinkAmount = smoothstep(0.6, 0.8, emission) * (0.25 + 0.75 * wide);
      const tealField = fbm3(x * 2.8 - 7, y * 2.8 + 2, z * 2.8, 4, SKY_SEED + 83);
      const tealAmount = smoothstep(0.64, 0.82, tealField) * (0.2 + 0.8 * wide) * (1 - pinkAmount);

      // Порожнеча не пласка: ледь помітний підсвіт великого масштабу.
      const depth = fbm3(x * 1.2 - 4, y * 1.2, z * 1.2 + 2, 2, SKY_SEED + 97);
      const base = mix(c.void, c.deep, smoothstep(0.35, 0.75, depth));

      const at = (row * width + column) * 4;
      for (let k = 0; k < 3; k += 1) {
        const value = base[k]!
          + glowColour[k]! * light
          + c.coreHot[k]! * hot * 0.32
          + c.pink[k]! * pinkAmount * 0.42
          + c.teal[k]! * tealAmount * 0.36;
        out[at + k] = Math.round(Math.min(255, Math.max(0, value)));
      }
      out[at + 3] = 255;
    }
  }
  return out;
}

export interface JourneyStarField {
  /** Одиничні напрямки, xyz поспіль. */
  positions: Float32Array;
  /** Розмір точки в CSS-пікселях. */
  sizes: Float32Array;
  /** Колір, rgb 0…1 поспіль. */
  colours: Float32Array;
  /** Фаза мерехтіння, радіани. */
  phases: Float32Array;
}

/**
 * Каталог зірок. Розподіл за яскравістю — степеневий, як у справжнього
 * неба: тисячі ледь помітних іскор і кілька десятків яскравих. Колір — від
 * блакитно-білого до рідкого теплого, бо саме «червоні й сині іскри»
 * власник відзначив у старій панорамі.
 */
export function journeyStarField(count = JOURNEY_STAR_COUNT): JourneyStarField {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colours = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const r = (index: number, salt: number) => hash3(index, salt, 17, SKY_SEED);
  let placed = 0;
  let attempt = 0;
  while (placed < count && attempt < count * 8) {
    attempt += 1;
    // Рівномірно на сфері…
    const z = r(attempt, 1) * 2 - 1;
    const angle = r(attempt, 2) * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    const d: [number, number, number] = [Math.cos(angle) * ring, z, Math.sin(angle) * ring];
    // …але зі згущенням уздовж смуги й до ядра: поза смугою більшість
    // кандидатів відпадає — так на кадрі видно, де Чумацький Шлях.
    if (r(attempt, 3) > 0.22 + bandCloseness(d) * 0.6 + coreCloseness(d) * 0.18) continue;
    positions.set(d, placed * 3);
    const bright = r(attempt, 4) ** 5.5;
    sizes[placed] = 1.15 + bright * 3.4;
    const temperature = r(attempt, 5);
    const tint: [number, number, number] = temperature < 0.08
      ? [1, 0.62, 0.55]
      : temperature < 0.18
        ? [1, 0.86, 0.72]
        : temperature < 0.62
          ? [0.9, 0.93, 1]
          : [0.72, 0.8, 1];
    const level = 0.62 + bright * 0.38;
    colours.set([tint[0] * level, tint[1] * level, tint[2] * level], placed * 3);
    phases[placed] = r(attempt, 6) * Math.PI * 2;
    placed += 1;
  }
  return {
    positions: positions.subarray(0, placed * 3),
    sizes: sizes.subarray(0, placed),
    colours: colours.subarray(0, placed * 3),
    phases: phases.subarray(0, placed),
  };
}

/** Яскраві зірки з променями — окремий каталог, окремий шейдер. */
export const JOURNEY_HERO_COUNT = 56;

export interface JourneyHeroStars {
  positions: Float32Array;
  /** Розмір спрайта в CSS-пікселях — із запасом під промені. */
  sizes: Float32Array;
  colours: Float32Array;
  phases: Float32Array;
}

/**
 * Кілька десятків найяскравіших зірок. Саме вони роблять небо НЕБОМ, а не
 * рівним зерном: погляд чіпляється за них і відчуває глибину. Рівномірно по
 * сфері, трохи гущі біля смуги; колір — від гарячого блакитного до теплого
 * жовтого, як у справжніх яскравих зірок.
 */
export function journeyHeroStars(count = JOURNEY_HERO_COUNT): JourneyHeroStars {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const colours = new Float32Array(count * 3);
  const phases = new Float32Array(count);
  const r = (index: number, salt: number) => hash3(index, salt, 29, SKY_SEED + 131);
  let placed = 0;
  let attempt = 0;
  while (placed < count && attempt < count * 20) {
    attempt += 1;
    const z = r(attempt, 1) * 2 - 1;
    const angle = r(attempt, 2) * Math.PI * 2;
    const ring = Math.sqrt(1 - z * z);
    const d: [number, number, number] = [Math.cos(angle) * ring, z, Math.sin(angle) * ring];
    if (r(attempt, 3) > 0.55 + bandCloseness(d) * 0.45) continue;
    positions.set(d, placed * 3);
    sizes[placed] = 14 + r(attempt, 4) ** 2 * 18;
    const temperature = r(attempt, 5);
    const tint: [number, number, number] = temperature < 0.35
      ? [0.72, 0.84, 1]
      : temperature < 0.75
        ? [1, 0.97, 0.92]
        : [1, 0.84, 0.62];
    colours.set(tint, placed * 3);
    phases[placed] = r(attempt, 6) * Math.PI * 2;
    placed += 1;
  }
  return {
    positions: positions.subarray(0, placed * 3),
    sizes: sizes.subarray(0, placed),
    colours: colours.subarray(0, placed * 3),
    phases: phases.subarray(0, placed),
  };
}
