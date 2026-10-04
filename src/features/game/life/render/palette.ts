// ============================================================
// Палітри пір року «Дєвочка в городі» (ADR-0239): теплі, насичені, як у
// Stardew Valley; тіні холодні, світло тепле.
// ============================================================
import type { Season } from '../sim/calendar';

export interface SeasonPalette {
  grass: string;
  grassLight: string;
  grassDark: string;
  blade: string;
  flowers: readonly string[];
  leaf: string;
  leafLight: string;
  leafDark: string;
  /** Чи лежить сніг. */
  snow: boolean;
  dirt: string;
  water: string;
  waterLight: string;
}

export const PALETTES: Record<Season, SeasonPalette> = {
  spring: {
    grass: '#78c25a', grassLight: '#94d46a', grassDark: '#5fa648', blade: '#4f9a3e',
    flowers: ['#f7f1ff', '#ffd7ec', '#f6d55c', '#b9a7f2'],
    leaf: '#6fbf4f', leafLight: '#9ad866', leafDark: '#4a9440', snow: false,
    dirt: '#c99c62', water: '#4c9ad6', waterLight: '#8cc7ef',
  },
  summer: {
    grass: '#64ad45', grassLight: '#7ec453', grassDark: '#4f913a', blade: '#3f7f32',
    flowers: ['#f6d55c', '#e8576c', '#f7f1ff', '#ef8d3a'],
    leaf: '#4f9e3c', leafLight: '#73bd4c', leafDark: '#357a30', snow: false,
    dirt: '#c7975a', water: '#3f8fcf', waterLight: '#7fc0ec',
  },
  autumn: {
    grass: '#9ba84a', grassLight: '#b8b95a', grassDark: '#7e8c3c', blade: '#6c7a34',
    flowers: ['#e88a2e', '#d9532c', '#f2c14e'],
    leaf: '#e08a2e', leafLight: '#f2b44a', leafDark: '#b85a24', snow: false,
    dirt: '#b98b55', water: '#3f80b8', waterLight: '#78aed6',
  },
  winter: {
    grass: '#eef3fb', grassLight: '#ffffff', grassDark: '#cfdcef', blade: '#bccbe3',
    flowers: ['#ffffff'],
    leaf: '#5f7f6a', leafLight: '#7f9c88', leafDark: '#40604c', snow: true,
    dirt: '#b7a58c', water: '#5a8fbf', waterLight: '#a9cbe6',
  },
};

/** Темрява ночі й тепло вечора: колір накладки за хвилиною доби. */
export function ambientAt(minute: number): { color: string; alpha: number } {
  const h = minute / 60;
  if (h < 8) return { color: '#ffb27a', alpha: 0.14 * (8 - h) };
  if (h < 16.5) return { color: '#000000', alpha: 0 };
  if (h < 19) return { color: '#ff8a4a', alpha: ((h - 16.5) / 2.5) * 0.22 };
  if (h < 21) return { color: '#3a3f86', alpha: 0.22 + ((h - 19) / 2) * 0.3 };
  return { color: '#141a44', alpha: Math.min(0.66, 0.52 + (h - 21) * 0.04) };
}

/** Чи світять вікна й ліхтарі. */
export function lightsOn(minute: number): boolean {
  return minute >= 18 * 60 + 30 || minute < 7 * 60 + 30;
}
