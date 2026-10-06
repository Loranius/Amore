// ============================================================
// Люди у 32×32 (ADR-0239, власник 2026-10-06: «люди з PixelLab, решта
// кодом»). Аркуші зібрано з персонажів PixelLab (`scripts/pixellab/
// build_sheet.py`): рядки — напрям (вниз, ліворуч, праворуч, угору),
// стовпці — стоїть, далі кадри ходи. Піксель аркуша — піксель малюнка,
// тобто пів світового: людина малюється вдвічі меншою за аркуш, і на
// парному масштабі сцени жоден піксель не розпливається.
//
// Поки аркуш вантажиться (чи для когось аркуша ще немає), людину малює
// піксельний стиль — `hasHdLook` тоді каже «ні».
// ============================================================
import lenaKidUrl from './assets/hd/lena-kid.png';
import momUrl from './assets/hd/mom.png';
import { LENA_KID, MOM, type Dir, type Look } from './people';

interface HdSheet {
  url: string;
  cell: number;
  /** Кадрів ходи (0 — лише «стоїть»). */
  frames: number;
  /** Точка між стопами в клітинці аркуша. */
  footX: number;
  footY: number;
  /** Чий це аркуш. */
  match(look: Look): boolean;
  img?: HTMLImageElement;
  ready?: boolean;
}

const SHEETS: HdSheet[] = [
  // Персонаж PixelLab «Лєна мала HD (48)» (a046bd5b-…).
  { url: lenaKidUrl, cell: 68, frames: 4, footX: 34, footY: 56, match: (l) => !!l.kid && l.bow === LENA_KID.bow && l.hairStyle === LENA_KID.hairStyle },
  // Персонаж PixelLab «Мама Лєни HD» (0a699035-…).
  { url: momUrl, cell: 92, frames: 0, footX: 46, footY: 78, match: (l) => l.hairStyle === MOM.hairStyle && l.top === MOM.top && l.accent === MOM.accent },
];

function sheetOf(look: Look): HdSheet | null {
  const s = SHEETS.find((x) => x.match(look));
  if (!s) return null;
  if (!s.img && typeof Image !== 'undefined') {
    s.img = new Image();
    s.img.onload = () => { s.ready = true; };
    s.img.onerror = () => console.error(`Люди 32×32: не вдалося завантажити аркуш ${s.url}`);
    s.img.src = s.url;
  }
  return s;
}

/** Чи є для цієї людини готовий аркуш 32×32. */
export function hasHdLook(look: Look): boolean {
  const s = sheetOf(look);
  return !!s?.ready;
}

/** Людина з аркуша: `x, y` — точка між стопами (світові пікселі). */
export function drawPersonHd(g: CanvasRenderingContext2D, look: Look, x: number, y: number, dir: Dir, moving: boolean, t: number): void {
  const s = sheetOf(look);
  if (!s?.img || !s.ready) return;
  const col = moving && s.frames > 0 ? 1 + (Math.floor(t * 8) % s.frames) : 0;
  const half = s.cell / 2;
  // Точка опори — на сітці пікселів малюнка (пів світового).
  const dx = Math.round((x - s.footX / 2) * 2) / 2;
  const dy = Math.round((y - s.footY / 2) * 2) / 2;
  g.drawImage(s.img, col * s.cell, dir * s.cell, s.cell, s.cell, dx, dy, half, half);
}
