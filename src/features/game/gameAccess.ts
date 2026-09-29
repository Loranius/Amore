// ============================================================
// Хто бачить «Гру» (ADR-0236).
// ------------------------------------------------------------
// Власник, 2026-09-29: «для інших пар прибери гру з підменю». Гра «Наша
// історія» зроблена про Діму й Лєну — для іншої пари це чужа історія. Тож і
// пункт «Ще → Гра», і сам маршрут `/game` — лише для пари 1.
// ============================================================
import type { NavItem } from '@/app/nav';
import { useCoupleId } from '@/features/_shared/useCoupleId';

/** Пара, для якої зроблено гру: Діма й Лєна. */
export const GAME_COUPLE_ID = 1;
export const GAME_PATH = '/game';

export function canPlayGame(coupleId: number | null | undefined): boolean {
  return coupleId === GAME_COUPLE_ID;
}

/**
 * Пункти меню, які бачить ця пара. Поки номер пари невідомий, гри немає:
 * краще на мить не показати пункт своїй парі, ніж показати чужій.
 */
export function visibleNavItems<T extends Pick<NavItem, 'to'>>(items: readonly T[], coupleId: number | null): T[] {
  return items.filter((item) => item.to !== GAME_PATH || canPlayGame(coupleId));
}

export function useVisibleNavItems<T extends Pick<NavItem, 'to'>>(items: readonly T[]): T[] {
  return visibleNavItems(items, useCoupleId().coupleId);
}
