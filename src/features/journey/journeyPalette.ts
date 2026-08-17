// ============================================================
// Барва «Нашого шляху».
// ------------------------------------------------------------
// Три рівні події — три кольори, і власник обрав їх сам: звичайна бірюзова,
// важлива жовта, ключова лишається неоном пари. Неон виводиться з ДНК пари,
// тобто небо в кожних своє, але в межах палітри порталу.
//
// Переїхало сюди з `RelationshipJourney.tsx`, коли кольори знадобились сцені:
// у CSS вони жили змінними, а WebGL змінних не читає. Два джерела на один
// колір розійшлися б за перший же тиждень.
// ============================================================
import { generateArtifactDNA } from '@/features/home/artifact/artifactDNA';
import type { ConstellationLevel } from './constellationRules';

/** HSL hue базового `BASE_PALETTE.core[0]` (#6d4fa8) у crystalCluster.ts. */
const CRYSTAL_CORE_BASE_HUE = 260.2247191011;

/**
 * Наскільки ДНК пари може відхилити сузір'я від фіолетового порталу.
 *
 * Було: повний оберт (`hueRotation` — це rng()×360), тобто небо могло вийти
 * будь-якого кольору. Виміряно на живому екрані цієї пари — воно вийшло
 * салатовим посеред фіолетового світу. Відколи гама референсу стала базою
 * порталу, це не «своя барва», а чужа.
 *
 * Смуга лишає небо впізнавано їхнім, але всередині палітри.
 */
const JOURNEY_HUE_SPREAD = 34;

export interface JourneyPalette {
  /** Неон пари — колір ключових подій і ядра. */
  key: string;
  /** Світле осердя ключової зірки. */
  keyCore: string;
  important: string;
  regular: string;
}

export function journeyHue(seed: string | null): number {
  const rotation = seed ? generateArtifactDNA(seed).hueRotation : 0;
  const shift = (rotation / 360) * (JOURNEY_HUE_SPREAD * 2) - JOURNEY_HUE_SPREAD;
  return (CRYSTAL_CORE_BASE_HUE + shift + 360) % 360;
}

export function journeyPalette(seed: string | null): JourneyPalette {
  const hue = journeyHue(seed).toFixed(1);
  return {
    key: `hsl(${hue} 88% 72%)`,
    keyCore: `hsl(${hue} 96% 88%)`,
    // Жовта й бірюзова не залежать від пари навмисно: вони означають РІВЕНЬ, і
    // якби вони теж їхали за ДНК, у двох пар «важлива» була б різного кольору.
    important: 'hsl(44 92% 62%)',
    regular: 'hsl(184 76% 58%)',
  };
}

export function levelColour(palette: JourneyPalette, level: ConstellationLevel): string {
  if (level === 'key') return palette.key;
  return level === 'important' ? palette.important : palette.regular;
}

/**
 * HSL у три числа 0…1 для `three`.
 *
 * **`THREE.Color.set()` тут не годиться, і це виміряно на живому екрані.** Його
 * розбірник знає лише СТАРИЙ синтаксис із комами — `hsl(184, 76%, 58%)`. Наші
 * кольори записані сучасним, через пробіли, бо вони їдуть ще й у CSS-змінні; на
 * такому рядку `set()` мовчки лишає колір білим. Наслідок був точно такий:
 * усі вісім зірок вийшли однакового нейтрального світіння, а три рівні, які
 * власник розрізняє саме кольором, перестали розрізнятись.
 *
 * Тому перетворення тут своє й чисте — його видно в тесті, який нічого не
 * рендерить, а не лише на знімку.
 */
export function hslToRgb(colour: string): [number, number, number] {
  const match = /^hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)$/.exec(colour);
  if (!match) throw new Error(`не HSL: ${colour}`);
  const hue = Number(match[1]) / 360;
  const saturation = Number(match[2]) / 100;
  const lightness = Number(match[3]) / 100;
  if (saturation === 0) return [lightness, lightness, lightness];
  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - lightness * saturation;
  const p = 2 * lightness - q;
  const channel = (offset: number): number => {
    let t = hue + offset;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [channel(1 / 3), channel(0), channel(-1 / 3)];
}

/**
 * Кольори зірок як плаский масив RGB для інстансованого атрибута.
 *
 * Живе тут, а не в компоненті сцени, з однієї причини: у vitest сцена не
 * рендериться взагалі, тож помилка в кольорі в компоненті ловилась би лише
 * знімком. Вада, через яку це винесли, саме так і жила.
 */
export function starTints(
  stars: readonly { core: boolean; level: ConstellationLevel }[],
  palette: JourneyPalette,
): Float32Array {
  const array = new Float32Array(stars.length * 3);
  stars.forEach((star, index) => {
    // Ядро світліше за решту ключових — воно тримає сузір'я на собі.
    const [r, g, b] = hslToRgb(star.core ? palette.keyCore : levelColour(palette, star.level));
    array[index * 3] = r;
    array[index * 3 + 1] = g;
    array[index * 3 + 2] = b;
  });
  return array;
}
