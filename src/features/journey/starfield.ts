// ============================================================
// Далекі зірки «Нашого шляху».
// ------------------------------------------------------------
// Це фон, а не дані: жодна з цих крапок не означає події пари. Події —
// тільки сузір'я, і плутати їх не можна, тому фонові зірки дрібніші, тьмяніші
// й ніколи не приймають дотик.
//
// Поле детерміноване: виводиться зі `stableHash32` і насіння пари. Дві
// причини, і жодна не формальна. Перша — `Math.random()` заборонений
// (CLAUDE.md), і тут це не буква: випадкове поле пересіювалось би на кожному
// перемальовуванні, тобто небо мерехтіло б цілком, а не окремими зірками.
// Друга — небо стає їхнім: та сама пара бачить те саме розташування завжди.
//
// Поле ділиться на дві частини навмисно:
//  - `steady` — щільне тло, малюється одним елементом через довгий `box-shadow`
//    і не анімується взагалі;
//  - `twinkling` — меншість, кожна крапка окремим елементом і анімує лише
//    `opacity`.
// У справжньому небі мерехтить теж меншість, а компонувальнику від зміни
// прозорості не треба перераховувати розкладку.
// ============================================================
import { stableHash32 } from '@/engine/evolution/seed';
import type { WorldQuality } from '@/features/world/worldDim';

export interface FieldStar {
  /** Частка ширини кадру, 0…1. */
  x: number;
  /** Частка висоти кадру, 0…1. */
  y: number;
  /** Діаметр у пікселях. */
  size: number;
  /** Базова непрозорість. */
  alpha: number;
}

export interface TwinklingStar extends FieldStar {
  /** Тривалість циклу мерехтіння, с. */
  period: number;
  /** Зсув фази, с — щоб поле не блимало в такт. */
  delay: number;
}

export interface Starfield {
  steady: FieldStar[];
  twinkling: TwinklingStar[];
}

/**
 * Скільки крапок дає профіль пристрою.
 *
 * Списано з того самого гейта, що вже стереже розмиття світу
 * (`worldDim.css`): на слабкому профілі анімований шар перераховується
 * щокадру, і платити за нього нічим. `fallback` не мерехтить зовсім — там
 * немає навіть WebGL, і зайвий цикл анімації буде останнім, чого бракувало.
 */
const BUDGET: Record<WorldQuality, { steady: number; twinkling: number }> = {
  high: { steady: 150, twinkling: 50 },
  balanced: { steady: 110, twinkling: 34 },
  low: { steady: 70, twinkling: 18 },
  fallback: { steady: 50, twinkling: 0 },
};

export function starfieldBudget(quality: WorldQuality): { steady: number; twinkling: number } {
  return BUDGET[quality] ?? BUDGET.low;
}

/** Дробове число з хешу в [0, 1). */
function unit(seed: string, salt: string): number {
  let value = stableHash32(`${salt}${seed}${salt}`);
  // FNV-1a слабко розмиває ОСТАННІЙ байт, а солі `s0x` і `s0y` різняться саме
  // ним: сусідні координати виходили пов'язаними, і на живому екрані фоновий
  // пил ліг рівними діагональними смугами замість розсипу. Мультиплікативний
  // фіналізатор (як у murmur3) розводить сусідні входи по всьому діапазону.
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97) >>> 0;
  value ^= value >>> 15;
  return (value >>> 0) / 4294967296;
}

function ranged(seed: string, salt: string, minimum: number, maximum: number): number {
  return minimum + unit(seed, salt) * (maximum - minimum);
}

export function buildStarfield(seed: string, quality: WorldQuality): Starfield {
  const budget = starfieldBudget(quality);

  const steady: FieldStar[] = Array.from({ length: budget.steady }, (_value, index) => ({
    x: unit(seed, `s${index}x`),
    y: unit(seed, `s${index}y`),
    // Тло має лишатись тлом: найбільша фонова крапка вдвічі дрібніша за
    // найменшу зірку сузір'я, інакше пара шукатиме подію там, де її немає.
    size: ranged(seed, `s${index}d`, 0.7, 1.6),
    alpha: ranged(seed, `s${index}a`, 0.18, 0.55),
  }));

  const twinkling: TwinklingStar[] = Array.from({ length: budget.twinkling }, (_value, index) => ({
    x: unit(seed, `t${index}x`),
    y: unit(seed, `t${index}y`),
    size: ranged(seed, `t${index}d`, 1.1, 2.2),
    alpha: ranged(seed, `t${index}a`, 0.35, 0.8),
    period: ranged(seed, `t${index}p`, 3, 7),
    delay: ranged(seed, `t${index}f`, 0, 7),
  }));

  return { steady, twinkling };
}

/**
 * Щільне тло одним рядком `box-shadow`.
 *
 * Сто п'ятдесят окремих вузлів заради нерухомих крапок — марна робота для
 * дерева й для стилю; один елемент із довгою тінню малюється так само, а живе
 * як один.
 */
export function steadyShadow(stars: readonly FieldStar[]): string {
  return stars
    .map((star) => {
      const x = (star.x * 100).toFixed(3);
      const y = (star.y * 100).toFixed(3);
      return `${x}vw ${y}vh 0 ${(star.size / 2).toFixed(2)}px rgba(255, 255, 255, ${star.alpha.toFixed(3)})`;
    })
    .join(', ');
}
