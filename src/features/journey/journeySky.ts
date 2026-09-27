// ============================================================
// Небо «Нашого шляху» — намальоване, а не завантажене (ADR-0214).
// ------------------------------------------------------------
// Власник: «при відкритті довго вантажиться фон і в поганій якості».
//
// Обидві вади мали одну причину. Небо було панорамою 2048×2048 у GLB на
// 8.5 МБ: поки вона їхала, пара дивилась на чорноту, а коли приїжджала —
// розтягнута на екрані приблизно втричі, і кожна зірка ставала розмитою
// плямою з JPEG-подібним зерном. Перетиснути її не можна було (ADR у
// `AMORE_JOURNEY_LICENSE.txt`: WebP злив червоні й сині іскри у фіолет),
// зменшити — тим паче.
//
// Тому небо розділене на дві речі, які панорама змішувала:
//
//  - ТУМАННІСТЬ — м'яка за природою. Їй не потрібна роздільність, їй
//    потрібна плавність, тож 1024×512 тут досить, і малюється вона у
//    воркері за частку секунди.
//  - ЗІРКИ — точки. Вони малюються точками GPU у пікселях ЕКРАНА, тож
//    лишаються гострими на будь-якій щільності й при будь-якому масштабі:
//    розтягувати тут нічого.
//
// Модуль чистий і детермінований: власний хеш-шум, стале зерно, жодного
// `Math.random`. Небо однакове на кожному відкритті.
// ============================================================

export const JOURNEY_NEBULA_WIDTH = 1024;
export const JOURNEY_NEBULA_HEIGHT = 512;

/**
 * Скільки зірок у небі. 5200 → 11 000 після виміру: щільність іскор на кадрі
 * була 4.0 на тисячу пікселів проти 5.2 на скриншоті власника. Точки GPU —
 * один виклик малювання на весь шар, тож число майже нічого не коштує.
 */
export const JOURNEY_STAR_COUNT = 11_000;

const SKY_SEED = 0x5a17_2022;

/**
 * Кольори, виміряні з екрана власника (скриншот «Наш шлях», 2026-09-27):
 * квантилі розмитого кадру від найтемнішого до найсвітлішого.
 */
export const JOURNEY_SKY_COLOURS = {
  /** Порожнеча між хмарами — майже чорний бордо (#180918). */
  void: '#170816',
  /** Тіло туманності (#271528). */
  dust: '#2a1429',
  /** Холодні хмари (#2f2343 … #483e6b). */
  cold: '#3a3160',
  /** Найсвітліші гребені хмар. */
  glow: '#5d4f8c',
  /** Теплий пил — рідкі малинові плями. */
  warm: '#4a1a3a',
} as const;

/**
 * Площина Чумацького Шляху: одинична нормаль. Смуга трохи нахилена, щоб
 * не лягати рівно по горизонту — так небо виглядає знайденим, а не
 * розрахованим. Спільна для туманності й зірок: зірки густішають рівно там,
 * де світиться смуга.
 */
export const JOURNEY_BAND_NORMAL: readonly [number, number, number] = (() => {
  const raw = [0.34, 0.86, -0.38];
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
 * Туманність: RGBA розгортка, рядок 0 — південь.
 *
 * Шари, від тла до світла: порожнеча → пил (скрізь, але плямами) → холодні
 * хмари (густіші вздовж смуги) → світлі гребені → рідкий теплий пил. Усе
 * в межах виміряних кольорів: небо тло, воно не має права перегнати зірки.
 */
export function paintJourneyNebula(
  width = JOURNEY_NEBULA_WIDTH,
  height = JOURNEY_NEBULA_HEIGHT,
): Uint8Array {
  const colours = {
    void: hexToRgb(JOURNEY_SKY_COLOURS.void),
    dust: hexToRgb(JOURNEY_SKY_COLOURS.dust),
    cold: hexToRgb(JOURNEY_SKY_COLOURS.cold),
    glow: hexToRgb(JOURNEY_SKY_COLOURS.glow),
    warm: hexToRgb(JOURNEY_SKY_COLOURS.warm),
  };
  const out = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const v = (row + 0.5) / height;
    for (let column = 0; column < width; column += 1) {
      const u = (column + 0.5) / width;
      const d = nebulaDirection(u, v);
      const band = bandCloseness(d);
      // Викривлення координат дає клубки, а не рівні плями.
      const warp = fbm3(d[0] * 1.3, d[1] * 1.3, d[2] * 1.3, 3, SKY_SEED + 7);
      const s = 2.4;
      const dust = fbm3(d[0] * s + warp, d[1] * s - warp, d[2] * s + warp * 0.6, 5, SKY_SEED);
      const cloud = fbm3(d[0] * 3.6 - warp * 0.8, d[1] * 3.6 + warp, d[2] * 3.6, 5, SKY_SEED + 31);
      const warmth = fbm3(d[0] * 2.1 + 5.2, d[1] * 2.1, d[2] * 2.1 - 3.1, 4, SKY_SEED + 57);

      let colour = mix(colours.void, colours.dust, smoothstep(0.38, 0.62, dust));
      const coldAmount = smoothstep(0.5 - band * 0.12, 0.72, cloud) * (0.35 + band * 0.65);
      colour = mix(colour, colours.cold, coldAmount);
      colour = mix(colour, colours.glow, smoothstep(0.66, 0.86, cloud) * band * 0.8);
      colour = mix(colour, colours.warm, smoothstep(0.58, 0.74, warmth) * 0.55 * (1 - coldAmount));

      const at = (row * width + column) * 4;
      out[at] = Math.round(Math.min(255, Math.max(0, colour[0])));
      out[at + 1] = Math.round(Math.min(255, Math.max(0, colour[1])));
      out[at + 2] = Math.round(Math.min(255, Math.max(0, colour[2])));
      out[at + 3] = 255;
    }
  }
  return out;
}

// ── Зірки ────────────────────────────────────────────────────

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
    // …але зі згущенням уздовж смуги: поза нею половина кандидатів відпадає.
    if (r(attempt, 3) > 0.35 + bandCloseness(d) * 0.65) continue;
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
