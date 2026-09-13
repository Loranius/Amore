// ============================================================
// Небо в сцені — та сама градієнтна заливка, що й у CSS, але як текстура
// тла сцени.
// ------------------------------------------------------------
// НАВІЩО ЦЕ ІСНУЄ, одним абзацом (ADR-0178).
//
// Небо порталу — CSS-градієнт ПІД прозорим полотном, і саме тому
// `MeshPhysicalMaterial.transmission` у нас вимкнено назавжди:
// `WebGLRenderer::renderTransmissionPass` жорстко ставить
// `setClearColor(0xffffff, 0.5)`, щойно `clearAlpha < 1`. Прозоре тіло
// малювало біле там, де перекривало небо.
//
// Рядком нижче в тому ж `three` стоїть `background.render( scene )`. Тобто
// достатньо, щоб небо було В СЦЕНІ, а полотно непрозорим, — і буфер
// заломлення міститиме небо з островом.
//
// ЧОМУ `scene.background`, А НЕ ВЛАСНИЙ ПРЯМОКУТНИК. Перша редакція
// ставила перед камерою меш, розтягнутий під поле зору. Виміряно на
// живому кадрі, що з цього вийшло: тепла смуга, яка в CSS стоїть на 27%
// висоти екрана, у сцені виїхала на 46%, а розмах градієнта стиснувся
// майже вдвічі (51,39,71 у піку проти 34,25,47). Тобто «те саме небо»
// ним не виходило, а прапорець, який міняє ДВІ речі одночасно, нічого не
// діагностує.
//
// Тло сцени малює сам `three`, і малює його в екранних координатах —
// рівно так, як CSS розтягує градієнт по елементу. Арифметики кадру тут
// не лишається взагалі, а отже не лишається й місця, де вона могла б
// розійтися.
// ============================================================
import * as THREE from 'three';
import type { PortalPalette } from './portalScene';

/**
 * Зупинки градієнта, згори кадру вниз — ті самі й у тому ж порядку, що в
 * `.portal-backdrop` (`portalBackdrop.css`).
 *
 * Горизонт лежить НАД верхнім краєм кадру (ADR-0165), тож верх кадру — це
 * далина, пофарбована туманом, а низ — повітря під островом. Саме тому
 * перша зупинка бере `fog`, а не `skyDeep`.
 */
export const PORTAL_SKY_STOPS: readonly { at: number; from: keyof PortalPalette }[] = [
  { at: 0, from: 'fog' },
  { at: 0.22, from: 'skyGlow' },
  { at: 0.56, from: 'skyMid' },
  { at: 1, from: 'skyDeep' },
];

/**
 * Тепла пляма низького сонця — другий шар CSS-градієнта:
 * `radial-gradient(120% 40% at 68% 16%, glow 0%, transparent 68%)`.
 *
 * Радіуси в частках ШИРИНИ й ВИСОТИ кадру відповідно, як і в CSS.
 */
export const PORTAL_SKY_GLOW = Object.freeze({
  atX: 0.68,
  atY: 0.16,
  radiusX: 1.2,
  radiusY: 0.4,
  fadeAt: 0.68,
});

/**
 * Розмір текстури.
 *
 * Градієнт по вертикалі описали б і чотири рядки, але тепла пляма кругла:
 * на грубій сітці її край стає сходинкою. 64 × 256 — 64 кілобайти, тобто
 * менше, ніж один кадр іскор, і жодного draw call: тло малює сам `three`.
 */
export const PORTAL_SKY_TEXTURE_WIDTH = 64;
export const PORTAL_SKY_TEXTURE_HEIGHT = 256;

/** Колір лінійної частини на висоті `v` (0 — верх кадру, 1 — низ). */
function stopColor(palette: PortalPalette, v: number, out: THREE.Color): THREE.Color {
  const stops = PORTAL_SKY_STOPS;
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1]!;
    const current = stops[index]!;
    if (v > current.at && index + 1 < stops.length) continue;
    const span = Math.max(1e-6, current.at - previous.at);
    const t = Math.min(1, Math.max(0, (v - previous.at) / span));
    return out
      .set(palette[previous.from] as string)
      .lerp(new THREE.Color(palette[current.from] as string), t);
  }
  return out.set(palette[stops[stops.length - 1]!.from] as string);
}

/** Наскільки тепла пляма присутня в цій точці кадру, 0…1. */
export function portalSkyGlowAt(u: number, v: number): number {
  const dx = (u - PORTAL_SKY_GLOW.atX) / PORTAL_SKY_GLOW.radiusX;
  const dy = (v - PORTAL_SKY_GLOW.atY) / PORTAL_SKY_GLOW.radiusY;
  const distance = Math.hypot(dx, dy);
  // CSS переходить від кольору до прозорого лінійно між 0% і 68% радіуса.
  return Math.min(1, Math.max(0, 1 - distance / PORTAL_SKY_GLOW.fadeAt));
}

/**
 * Колір неба в точці кадру, у байтах sRGB — рівно тих, якими його
 * малює CSS.
 *
 * `u` — 0 ліворуч, 1 праворуч; `v` — 0 угорі кадру, 1 унизу.
 */
export function portalSkyPixel(palette: PortalPalette, u: number, v: number): [number, number, number] {
  const linear = stopColor(palette, v, new THREE.Color());
  const glow = new THREE.Color(palette.skyGlow);
  const warm = portalSkyGlowAt(u, v);
  const mixed = new THREE.Color(
    linear.r + (glow.r - linear.r) * warm,
    linear.g + (glow.g - linear.g) * warm,
    linear.b + (glow.b - linear.b) * warm,
  );
  /*
   * Назад у sRGB власноруч, бо текстура оголошена як `SRGBColorSpace`:
   * `THREE.Color` тримає робочий (лінійний) простір, а в байти йде те, що
   * написав би CSS.
   */
  const byte = (channel: number) => Math.round(
    Math.min(1, Math.max(0, linearToSrgb(channel))) * 255,
  );
  return [byte(mixed.r), byte(mixed.g), byte(mixed.b)];
}

/** Та сама крива, що й у `LinearSRGBColorSpace → SRGBColorSpace` у three. */
function linearToSrgb(channel: number): number {
  return channel < 0.0031308 ? channel * 12.92 : 1.055 * Math.pow(channel, 0.41666) - 0.055;
}

/**
 * Текстура тла сцени.
 *
 * Рядок 0 даних — НИЗ екрана: тло малюється площиною, у якої `uv` рахується
 * знизу вгору. Переплутати це означало б перевернути небо, і саме тому
 * рядок нижче єдиний, де є `1 - `.
 */
export function buildPortalSkyTexture(palette: PortalPalette): THREE.DataTexture {
  const width = PORTAL_SKY_TEXTURE_WIDTH;
  const height = PORTAL_SKY_TEXTURE_HEIGHT;
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row += 1) {
    const v = 1 - row / (height - 1);
    for (let column = 0; column < width; column += 1) {
      const u = column / (width - 1);
      const [r, g, b] = portalSkyPixel(palette, u, v);
      const at = (row * width + column) * 4;
      data[at] = r;
      data[at + 1] = g;
      data[at + 2] = b;
      data[at + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
