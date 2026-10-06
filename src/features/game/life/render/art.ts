// ============================================================
// Деталізація гри (ADR-0239, власник 2026-10-06: «більш деталізований
// піксельний варіант гри, 32×32»). Поки 32×32 — тестовий: вмикається
// адресою `?art=hd` або кнопкою «HD» у грі й діє лише в садибі в
// Жилинцях (подвір'я, хата, літня кухня, погріб). Деінде — 16×16.
// ============================================================
import { CELLAR_ID } from '../world/cellar';
import { KITCHEN_ID } from '../world/kitchen';
import { YARD_ID } from '../world/yard';

export type Art = 'pixel' | 'hd';

const KEY = 'lifeGame.art';

/** Стиль з адреси (`?art=hd` чи `?art=pixel`), якщо його там задано. */
export function artFromSearch(search: string): Art | null {
  const v = new URLSearchParams(search).get('art');
  return v === 'hd' || v === 'pixel' ? v : null;
}

/** Мапи, які вже намальовано у 32×32. */
export function hasHd(mapId: string): boolean {
  return mapId === YARD_ID || mapId === KITCHEN_ID || mapId === CELLAR_ID || mapId.startsWith('home:hata');
}

/** Яким стилем малювати цю мапу за вибором гравця. */
export function artFor(choice: Art, mapId: string): Art {
  return choice === 'hd' && hasHd(mapId) ? 'hd' : 'pixel';
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
    return v === 'hd' ? 'hd' : 'pixel';
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
