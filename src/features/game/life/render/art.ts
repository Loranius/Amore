// ============================================================
// Стиль малювання гри (ADR-0239, власник 2026-10-06: «варіант два —
// з піксельної до 2d, почни з подвір'я Лєни»). Поки 2D-стиль — тестовий:
// він вмикається адресою `?art=2d` або кнопкою в грі й діє лише в садибі
// в Жилинцях (подвір'я, хата, літня кухня, погріб). Деінде — пікселі.
// ============================================================
import { CELLAR_ID } from '../world/cellar';
import { KITCHEN_ID } from '../world/kitchen';
import { YARD_ID } from '../world/yard';

export type Art = 'pixel' | '2d';

const KEY = 'lifeGame.art';

/** Стиль з адреси (`?art=2d` чи `?art=pixel`), якщо його там задано. */
export function artFromSearch(search: string): Art | null {
  const v = new URLSearchParams(search).get('art');
  return v === '2d' || v === 'pixel' ? v : null;
}

/** Мапи, які вже намальовано у 2D. */
export function hasArt2d(mapId: string): boolean {
  return mapId === YARD_ID || mapId === KITCHEN_ID || mapId === CELLAR_ID || mapId.startsWith('home:hata');
}

/** Яким стилем малювати цю мапу за вибором гравця. */
export function artFor(choice: Art, mapId: string): Art {
  return choice === '2d' && hasArt2d(mapId) ? '2d' : 'pixel';
}

/** Вибір гравця: адреса важить більше за збережене; без сховища — пікселі. */
export function readArt(): Art {
  const fromUrl = typeof location === 'undefined' ? null : artFromSearch(location.search);
  if (fromUrl) {
    saveArt(fromUrl);
    return fromUrl;
  }
  try {
    const v = localStorage.getItem(KEY);
    return v === '2d' ? '2d' : 'pixel';
  } catch {
    return 'pixel';
  }
}

export function saveArt(art: Art): void {
  try {
    localStorage.setItem(KEY, art);
  } catch {
    // Сховище недоступне (приватне вікно) — вибір діє до перезавантаження.
  }
}
