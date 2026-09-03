import { describe, expect, it } from 'vitest';
import {
  PORTAL_KEY_LIGHT,
  PORTAL_PALETTES,
  PORTAL_RIM_LIGHT,
} from './portalScene';

/** Обидві пори доби одного місця. §10 має триматись у кожній окремо. */
const THEMES = ['light', 'dark'] as const;

// ============================================================
// Освітлення порталу — §10 брифу кристала.
// ------------------------------------------------------------
// Один теплий рожево-білий ключ згори-ліворуч, прохолодна бузкова заливка,
// низький ambient, слабке світло від кореня, жодного жовтого джерела.
//
// Ці числа перевіряються тестом, а не лишаються літералами в JSX, саме тому,
// що вимога «ключ домінує» — це відношення між ними. Поки вони були розкидані
// по розмітці, точкове світло подіуму виросло втричі за ключ, а коментар над
// напрямленими джерелами тим часом стверджував, що заливку приборкано.
// ============================================================

/** Згасання точкового джерела в three: decay 2 з обрізанням по `distance`. */
function attenuation(distance: number, cutoff: number): number {
  const inverseSquare = 1 / Math.max(distance * distance, 1e-8);
  if (cutoff <= 0) return inverseSquare;
  const window = Math.min(1, Math.max(0, 1 - (distance / cutoff) ** 4));
  return inverseSquare * window * window;
}

/** Жовтий — це зелений високо проти синього. Жодне джерело не має права. */
function isYellowish(hex: string): boolean {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  const r = ((value >> 16) & 0xff) / 255;
  const g = ((value >> 8) & 0xff) / 255;
  const b = (value & 0xff) / 255;
  return g > b + 0.06 && r > b + 0.06;
}

describe('світло порталу (§10 брифу кристала)', () => {
  it('ставить теплий ключ згори-ліворуч у кожній порі доби', () => {
    // Камера дивиться з +Z на початок координат (`portalCameraFrame` повертає
    // position [0, eyeY, +z]), тож екранне «ліворуч» — це від'ємний X. Ключ
    // стояв на +3, тобто праворуч, і був чисто білий.
    //
    // Позиція спільна навмисно: §10 каже, ЗВІДКИ падає ключ, і це композиція
    // сцени, а не властивість пори доби. Різняться лише сила й колір.
    expect(PORTAL_KEY_LIGHT.position[0]).toBeLessThan(0);
    expect(PORTAL_KEY_LIGHT.position[1]).toBeGreaterThan(0);

    for (const theme of THEMES) {
      const { keyColour } = PORTAL_PALETTES[theme];
      const value = Number.parseInt(keyColour.replace('#', ''), 16);
      const r = ((value >> 16) & 0xff) / 255;
      const b = (value & 0xff) / 255;
      // Теплий: червоного більше за синій. І не жовтий.
      expect(r, theme).toBeGreaterThan(b);
      expect(isYellowish(keyColour), theme).toBe(false);
    }
  });

  it('ставить прохолодну заливку навпроти ключа в кожній порі доби', () => {
    // Асиметрія — це весь сенс: заливка того ж відтінку, що й ключ, і з того
    // самого боку не додає різниці між боками кристала. Була майже біла
    // рожева на тому ж боці, що й новий ключ.
    expect(Math.sign(PORTAL_RIM_LIGHT.position[0]))
      .not.toBe(Math.sign(PORTAL_KEY_LIGHT.position[0]));

    for (const theme of THEMES) {
      const palette = PORTAL_PALETTES[theme];
      const value = Number.parseInt(palette.rimColour.replace('#', ''), 16);
      const r = ((value >> 16) & 0xff) / 255;
      const b = (value & 0xff) / 255;
      // Прохолодна: синього більше за червоний — протилежно до ключа.
      // Уночі це бузок, удень — відбите небо; обидва прохолодні.
      expect(b, theme).toBeGreaterThan(r);
      expect(palette.rimIntensity, theme).toBeLessThan(palette.keyIntensity * 0.3);
    }
  });

  it('денна сцена яскравіша за нічну, і це видно в числах', () => {
    // Інакше «денний храм» був би нічним храмом, перефарбованим у білий:
    // білий мармур при ambient 0.1 читається сірим. Перевіряється напрямок,
    // а не конкретні значення — власник їх ще рухатиме.
    const day = PORTAL_PALETTES.light;
    const night = PORTAL_PALETTES.dark;
    expect(day.ambient).toBeGreaterThan(night.ambient * 2);
    expect(day.hemisphere).toBeGreaterThan(night.hemisphere * 2);
    expect(day.keyIntensity).toBeGreaterThan(night.keyIntensity);
    /*
     * У печері день і ніч розрізняє РОЗЛОМ і ДРУЗА, а не зорі й вогонь у
     * чашах: удень крізь тріщину в склепінні падає промінь, уночі
     * світиться сам камінь. Тому обидві перевірки перевернуті проти
     * храмових — сильніше вдень одне, сильніше вночі інше.
     */
    expect(day.oculusIntensity).toBeGreaterThan(night.oculusIntensity * 4);
    expect(night.caveDruseEmissive).toBeGreaterThan(day.caveDruseEmissive * 2);
  });

  it('камінь печери — це камінь в обох порах доби, а не два різні місця', () => {
    /*
     * Тут стояла перевірка матовості підлоги храму (`floorRoughness`,
     * `floorNormalScale`) — ролі, яких у печери немає: її камінь
     * намальований вершинним кольором, а не освітлений PBR-картою.
     *
     * Перевіряється те, що лишилось правдою: удень камінь СВІТЛІШИЙ, але
     * це той самий камінь — стіни ясніші за підлогу в обох темах, бо
     * світло падає згори.
     */
    const luminance = (hex: string): number => {
      const value = Number.parseInt(hex.slice(1), 16);
      return ((value >> 16) & 255) * 0.2126
        + ((value >> 8) & 255) * 0.7152
        + (value & 255) * 0.0722;
    };
    const day = PORTAL_PALETTES.light;
    const night = PORTAL_PALETTES.dark;
    expect(luminance(day.caveRock)).toBeGreaterThan(luminance(night.caveRock));
    for (const theme of THEMES) {
      const palette = PORTAL_PALETTES[theme];
      expect(luminance(palette.caveRock), theme)
        .toBeGreaterThan(luminance(palette.caveFloor));
    }
  });

  it('не має жодного жовтого джерела в сцені', () => {
    /*
     * §10 забороняє жовте світло на артефакті. Перевірка була про чаші
     * вогню на колонах — їх немає разом із колонадою (ADR-0117), — тож
     * лишається те, що світить сьогодні: корінь, ключ, заливка й розлом.
     */
    for (const theme of THEMES) {
      const palette = PORTAL_PALETTES[theme];
      expect(isYellowish(palette.rootLight), `${theme} корінь`).toBe(false);
      expect(isYellowish(palette.keyColour), `${theme} ключ`).toBe(false);
      expect(isYellowish(palette.rimColour), `${theme} заливка`).toBe(false);
      expect(isYellowish(palette.oculus), `${theme} розлом`).toBe(false);
    }
  });

  it('лишає ключ сильнішим за всю заливку разом уздовж усього кристала', () => {
    // Вада, яку це замінює. Точкове світло подіуму стояло на 2.2–2.6 на висоті
    // ground+1.15 і було найсильнішим джерелом сцени: у найгіршій точці
    // ключ/заливка = 0.36–0.48, тобто заливка була вдвічі-втричі сильнішою за
    // ключ саме там, де кристал найширший і граней найбільше. Тіні між гранями
    // заповнювались, і скільки б фасетів не мала геометрія, кристал читався
    // рівним.
    for (const theme of THEMES) {
      const palette = PORTAL_PALETTES[theme];
      // Заливка рахується з палітри, а не з констант: денна вчетверо
      // сильніша, і поріг має триматись саме на ній, а не на нічній.
      const fixedFill = palette.ambient + palette.hemisphere + palette.rimIntensity;
      // Світло від кореня стоїть на ground+0.35, зміщене на 0.9 вперед; кристал
      // росте вгору від ground. Проходимо по його висоті.
      for (const height of [0.9, 2.6, 5.5]) {
        for (let share = 0.02; share <= 0.98; share += 0.08) {
          const toRoot = Math.hypot(0, height * share - 0.35, 0.9);
          const root = palette.rootLightIntensity * attenuation(toRoot, 6.5);
          const ratio = palette.keyIntensity / (fixedFill + root);
          expect(ratio, `${theme} h=${height} ${share.toFixed(2)}`).toBeGreaterThan(1.3);
        }
      }
    }
  });

  it('світить від кореня, а не згори на кристал', () => {
    // «Слабке світло від кореня» — це не лише про силу, а й про напрямок.
    // На ground+1.15 низ отримував менше за верх (0.43 від нього), тобто
    // світло падало згори; на ground+0.35 низ отримує у 2.4 раза більше.
    for (const theme of THEMES) {
      const intensity = PORTAL_PALETTES[theme].rootLightIntensity;
      const height = 2.6;
      const atFoot = intensity * attenuation(Math.hypot(0, 0.02 * height - 0.35, 0.9), 6.5);
      const atTip = intensity * attenuation(Math.hypot(0, 0.9 * height - 0.35, 0.9), 6.5);
      expect(atFoot / atTip, theme).toBeGreaterThan(1.5);
      // І воно слабке: сильніше за нього тут лише ключ.
      expect(atFoot, theme).toBeLessThan(PORTAL_PALETTES[theme].keyIntensity);
    }
  });

  it('тримає рівномірну заливку меншиною проти ключа', () => {
    // Ambient однаково піднімає КОЖНУ площину, тож він і є те, що стирає
    // рельєф найпряміше — а рельєф і є те, що робить грань гранню.
    //
    // Було абсолютне число (≤0.12). Воно правильно описувало ніч і стало
    // неправильним у полудень: денний храм при ambient 0.1 — це білий
    // мармур у темряві. Те, що не залежить від пори доби, — частка:
    // рівномірна заливка мусить лишатись меншиною проти напрямленого
    // ключа, скільки б світла в сцені не було.
    //
    // Виміряно: ніч 5% і 13%, полудень 12% і 16%.
    for (const theme of THEMES) {
      const { ambient, hemisphere, keyIntensity } = PORTAL_PALETTES[theme];
      expect(ambient / keyIntensity, `${theme} ambient`).toBeLessThanOrEqual(0.4);
      expect(hemisphere / keyIntensity, `${theme} hemisphere`).toBeLessThanOrEqual(0.4);
    }
  });
});
