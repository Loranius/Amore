/**
 * Дотик проти обертання.
 *
 * Поки сцена була картинкою в рамці, орбіту крутили полем навколо
 * кристала, а клік по самому кристалу означав рівно одне — «покажи
 * спогад». Тепер сцена займає весь екран, і жест обертання починається
 * прямо на артефакті: без порогу кожне обертання закінчувалось би
 * відкритим модальним вікном.
 */
export interface CrystalPointerSample {
  x: number;
  y: number;
  /** Мітка часу в мілісекундах з того ж джерела, що й обидві проби. */
  at: number;
}

/** Скільки пікселів ще вважається дотиком, а не протягуванням. */
export const TAP_SLOP_PX = 9;
/** Довше утримання — це вже не дотик; користувач передумав або крутив. */
export const TAP_MAX_MS = 500;

export function isCrystalTap(
  down: CrystalPointerSample | null,
  up: CrystalPointerSample,
): boolean {
  if (down === null) return false;
  if (up.at - down.at > TAP_MAX_MS) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) <= TAP_SLOP_PX;
}
