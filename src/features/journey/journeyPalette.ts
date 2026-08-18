// ============================================================
// Барва «Нашого шляху» — те, що належить ПАРІ, а не події.
// ------------------------------------------------------------
// Тут лишився один колір: неон пари, яким світиться шлях між подіями. Він
// виводиться з ДНК пари, тобто небо в кожних своє, але в межах палітри
// порталу.
//
// **Кольори самих зірок сюди більше не належать.** Раніше рівень події мав
// рівно один колір, і всі три жили тут. Тепер у кожного рівня родина з шести
// відтінків, а пара може обрати свій — це `starPalette.ts`. Розділено не
// заради охайності: перелік відтінків повторюється в `CHECK` бази, і тримати
// його поряд із відтінком, що залежить від ДНК і в базі не існує, означало б
// два різні життєві цикли в одному файлі.
//
// `hslToRgb` лишився тут, бо ним користуються обидва: це переклад, а не
// палітра.
// ============================================================
import { generateArtifactDNA } from '@/features/home/artifact/artifactDNA';

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
  /** Неон пари — колір шляху між подіями. */
  path: string;
}

export function journeyHue(seed: string | null): number {
  const rotation = seed ? generateArtifactDNA(seed).hueRotation : 0;
  const shift = (rotation / 360) * (JOURNEY_HUE_SPREAD * 2) - JOURNEY_HUE_SPREAD;
  return (CRYSTAL_CORE_BASE_HUE + shift + 360) % 360;
}

export function journeyPalette(seed: string | null): JourneyPalette {
  return { path: `hsl(${journeyHue(seed).toFixed(1)} 88% 72%)` };
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
