// ============================================================
// envMap — процедурна карта оточення. ТІЛЬКИ ДІАГНОСТИКА (`?gfx=env`).
// ------------------------------------------------------------
// Це НЕ спосіб покращити вигляд, і саме тому воно не в дефолті.
//
// Первісна ідея фази була: взяти equirect-текстуру замість drei
// `<Environment>`, щоб дістати відбиття «без HalfFloat render target», який
// лишився головним підозрюваним у білому фоні на пристрої власника.
// Перевірка джерел three.js цю ідею спростувала:
//
//   `WebGLCubeUVMaps.get()` → `PMREMGenerator.fromEquirectangular()`
//   `PMREMGenerator._allocateTargets()` → `type: HalfFloatType`
//
// Через PMREM проходить будь-яка карта оточення для PBR-матеріалу —
// і equirect, і кубічна. Прямий шлях є лише в не-PBR матеріалів
// (Basic/Lambert/Phong), які нам не годяться.
//
// Тож карта лишається рівно з однією метою: дати власникові ввімкнути
// підозрюваний механізм ОКРЕМО від Bloom і сказати, чи білить фон саме він.
// Три липневі спроби провалились саме тому, що обидва прибрали разом і
// жоден не перевірили поодинці.
//
// Текстура генерується на CPU, без мережі: жодного CDN, жодного HDR-файлу,
// тож PWA лишається офлайновою, а результат — детермінованим і придатним
// для тесту.
// ============================================================
import * as THREE from 'three';

/** Ширина/висота equirect-мапи. 128×64 достатньо: PMREM однаково розмиває
 *  її по рівнях шорсткості, а пам'ять лишається дрібницею (32 КБ). */
const WIDTH = 128;
const HEIGHT = 64;

export interface EnvMapColors {
  /** Зеніт. */
  sky: string;
  /** Горизонт. */
  horizon: string;
  /** Надир. */
  ground: string;
  /** Колір м'яких «світильників» угорі — те, що дає відблиски на гранях. */
  key: string;
}

export const STUDIO_COLORS: EnvMapColors = {
  sky: '#f4f8ff',
  horizon: '#ffe8f0',
  ground: '#c9a6b4',
  key: '#ffffff',
};

/** Три м'які плями світла: азимут (0..1 по колу), висота (0..1 знизу вгору),
 *  кутовий радіус, сила. Фіксовані — оточення не має «мерехтіти» від даних. */
const LAMPS: readonly { az: number; alt: number; r: number; power: number }[] = [
  { az: 0.18, alt: 0.82, r: 0.16, power: 1 },
  { az: 0.62, alt: 0.66, r: 0.22, power: 0.55 },
  { az: 0.88, alt: 0.45, r: 0.14, power: 0.35 },
];

const smoothstep = (t: number): number => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * (3 - 2 * x);
};

/**
 * Будує equirect-текстуру студійного оточення. Чиста функція від кольорів:
 * двічі викликана, дає побайтово однакові дані (перевіряється тестом).
 *
 * Викликач відповідає за `dispose()`.
 */
export function buildStudioEnvMap(colors: EnvMapColors = STUDIO_COLORS): THREE.DataTexture {
  const sky = new THREE.Color(colors.sky);
  const horizon = new THREE.Color(colors.horizon);
  const ground = new THREE.Color(colors.ground);
  const key = new THREE.Color(colors.key);

  const data = new Uint8Array(WIDTH * HEIGHT * 4);
  const c = new THREE.Color();

  for (let y = 0; y < HEIGHT; y++) {
    // v=0 — верх текстури (зеніт), v=1 — низ (надир).
    const v = (y + 0.5) / HEIGHT;
    const alt = 1 - v;
    // Градієнт неба: зеніт → горизонт → земля, з м'якими переходами.
    if (alt >= 0.5) c.copy(horizon).lerp(sky, smoothstep((alt - 0.5) * 2));
    else c.copy(ground).lerp(horizon, smoothstep(alt * 2));

    for (let x = 0; x < WIDTH; x++) {
      const u = (x + 0.5) / WIDTH;
      let r = c.r;
      let g = c.g;
      let b = c.b;

      for (const lamp of LAMPS) {
        // Кутова відстань по азимуту з урахуванням замикання кола.
        let du = Math.abs(u - lamp.az);
        if (du > 0.5) du = 1 - du;
        const dv = alt - lamp.alt;
        const d = Math.hypot(du * 2, dv) / lamp.r;
        if (d >= 1) continue;
        const w = smoothstep(1 - d) * lamp.power;
        r += (key.r - r) * w;
        g += (key.g - g) * w;
        b += (key.b - b) * w;
      }

      const i = (y * WIDTH + x) * 4;
      data[i] = Math.round(Math.min(1, r) * 255);
      data[i + 1] = Math.round(Math.min(1, g) * 255);
      data[i + 2] = Math.round(Math.min(1, b) * 255);
      data[i + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, WIDTH, HEIGHT, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}
