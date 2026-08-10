import { describe, expect, it } from 'vitest';
import {
  PORTAL_AMBIENT_INTENSITY,
  PORTAL_DAIS_TOP_RADIUS,
  PORTAL_HEMISPHERE_INTENSITY,
  PORTAL_KEY_LIGHT,
  PORTAL_PALETTES,
  PORTAL_RIM_LIGHT,
  portalCameraFrame,
  portalDaisScale,
  portalLampInstances,
  portalLampReach,
} from './portalScene';

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
  it('ставить теплий рожево-білий ключ згори-ліворуч', () => {
    // Камера дивиться з +Z на початок координат (`portalCameraFrame` повертає
    // position [0, eyeY, +z]), тож екранне «ліворуч» — це від'ємний X. Ключ
    // стояв на +3, тобто праворуч, і був чисто білий.
    expect(PORTAL_KEY_LIGHT.position[0]).toBeLessThan(0);
    expect(PORTAL_KEY_LIGHT.position[1]).toBeGreaterThan(0);

    const value = Number.parseInt(PORTAL_KEY_LIGHT.color.replace('#', ''), 16);
    const r = ((value >> 16) & 0xff) / 255;
    const b = (value & 0xff) / 255;
    // Теплий: червоного більше за синій. І не жовтий.
    expect(r).toBeGreaterThan(b);
    expect(isYellowish(PORTAL_KEY_LIGHT.color)).toBe(false);
  });

  it('ставить прохолодну бузкову заливку навпроти ключа', () => {
    // Асиметрія — це весь сенс: заливка того ж відтінку, що й ключ, і з того
    // самого боку не додає різниці між боками кристала. Була майже біла
    // рожева на тому ж боці, що й новий ключ.
    expect(Math.sign(PORTAL_RIM_LIGHT.position[0]))
      .not.toBe(Math.sign(PORTAL_KEY_LIGHT.position[0]));

    const value = Number.parseInt(PORTAL_RIM_LIGHT.color.replace('#', ''), 16);
    const r = ((value >> 16) & 0xff) / 255;
    const b = (value & 0xff) / 255;
    // Прохолодна: синього більше за червоний — протилежно до ключа.
    expect(b).toBeGreaterThan(r);
    expect(PORTAL_RIM_LIGHT.intensity).toBeLessThan(PORTAL_KEY_LIGHT.intensity * 0.3);
  });

  it('не має жодного жовтого джерела, що дістає до кристала', () => {
    // Полум'я в чашах лишається помаранчевим — це декорація сцени, і §10
    // говорить про світло на артефакті. Перевіряється саме те: скільки його
    // доходить. Відповідь має бути «нічого», на будь-якому віці стосунків.
    for (const theme of ['light', 'dark'] as const) {
      const palette = PORTAL_PALETTES[theme];
      expect(isYellowish(palette.daisLight), `${theme} корінь`).toBe(false);

      for (const [radius, height] of [[0.4, 0.9], [1.2, 2.6], [2.4, 5.5]] as const) {
        const frame = portalCameraFrame(0.46, radius, height);
        const daisScale = portalDaisScale(radius);
        const daisRadius = PORTAL_DAIS_TOP_RADIUS * daisScale;
        for (const lamp of portalLampInstances(frame, 0.46).filter((one) => one.lit)) {
          const reach = portalLampReach(lamp.position, daisScale);
          const fromCentre = Math.hypot(lamp.position[0], lamp.position[2]);
          // Вогонь зупиняється рівно на краю подіуму. Артефакт стоїть на
          // подіумі, тож далі за край йому нічого не дістається.
          expect(fromCentre - reach, `${theme} ${radius}`).toBeGreaterThanOrEqual(
            daisRadius - 1e-6,
          );
          // І сама межа не залежить від камери — була `frame.distance * 1.35`,
          // тобто їхала за нею: 4.3 у молодої пари й 34.6 у двадцятип'ятирічної.
          expect(reach).toBe(portalLampReach(lamp.position, daisScale));
        }
      }
    }
  });

  it('лишає ключ сильнішим за всю заливку разом уздовж усього кристала', () => {
    // Вада, яку це замінює. Точкове світло подіуму стояло на 2.2–2.6 на висоті
    // ground+1.15 і було найсильнішим джерелом сцени: у найгіршій точці
    // ключ/заливка = 0.36–0.48, тобто заливка була вдвічі-втричі сильнішою за
    // ключ саме там, де кристал найширший і граней найбільше. Тіні між гранями
    // заповнювались, і скільки б фасетів не мала геометрія, кристал читався
    // рівним.
    const fixedFill = PORTAL_AMBIENT_INTENSITY
      + PORTAL_HEMISPHERE_INTENSITY
      + PORTAL_RIM_LIGHT.intensity;

    for (const theme of ['light', 'dark'] as const) {
      const palette = PORTAL_PALETTES[theme];
      // Світло від кореня стоїть на ground+0.35, зміщене на 0.9 вперед; кристал
      // росте вгору від ground. Проходимо по його висоті.
      for (const height of [0.9, 2.6, 5.5]) {
        for (let share = 0.02; share <= 0.98; share += 0.08) {
          const toRoot = Math.hypot(0, height * share - 0.35, 0.9);
          const root = palette.daisLightIntensity * attenuation(toRoot, 6.5);
          const ratio = PORTAL_KEY_LIGHT.intensity / (fixedFill + root);
          expect(ratio, `${theme} h=${height} ${share.toFixed(2)}`).toBeGreaterThan(1.3);
        }
      }
    }
  });

  it('світить від кореня, а не згори на кристал', () => {
    // «Слабке світло від кореня» — це не лише про силу, а й про напрямок.
    // На ground+1.15 низ отримував менше за верх (0.43 від нього), тобто
    // світло падало згори; на ground+0.35 низ отримує у 2.4 раза більше.
    for (const theme of ['light', 'dark'] as const) {
      const intensity = PORTAL_PALETTES[theme].daisLightIntensity;
      const height = 2.6;
      const atFoot = intensity * attenuation(Math.hypot(0, 0.02 * height - 0.35, 0.9), 6.5);
      const atTip = intensity * attenuation(Math.hypot(0, 0.9 * height - 0.35, 0.9), 6.5);
      expect(atFoot / atTip, theme).toBeGreaterThan(1.5);
      // І воно слабке: сильніше за нього тут лише ключ.
      expect(atFoot, theme).toBeLessThan(PORTAL_KEY_LIGHT.intensity);
    }
  });

  it('тримає ambient низьким', () => {
    // Ambient однаково піднімає кожну площину, тож він і є те, що стирає
    // рельєф найпряміше.
    expect(PORTAL_AMBIENT_INTENSITY).toBeLessThanOrEqual(0.12);
    expect(PORTAL_HEMISPHERE_INTENSITY).toBeLessThanOrEqual(0.3);
  });
});
