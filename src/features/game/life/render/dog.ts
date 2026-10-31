// ============================================================
// Бася — чорний триколірний коргі (власник, 2026-10-05). Великі стоячі
// вуха, коротенькі лапи, біла грудка й мордочка, руді брови й щоки.
// ------------------------------------------------------------
// Малюнок — аркуш персонажа PixelLab «Бася HD» (ee1aa312-…, шаблон dog,
// size 48; власник 2026-10-06, а з 2026-10-31 — єдиний: «повністю
// відмовляємось від 16×16»). Клітинки 68×68, рядки — напрям (вниз,
// ліворуч, праворуч, угору; «ліворуч» — дзеркало «праворуч»), стовпці —
// стоїть, далі 6 кадрів бігу. Піксель аркуша — пів світового, тож Бася
// малюється вдвічі меншою за аркуш. Поки аркуш вантажиться (мить на
// початку гри), Басі ще немає: малювати її нічим іншим не можна.
// ============================================================
import basiaHdUrl from './assets/hd/basia.png';

const HD_CELL = 68;
const HD_FOOT_X = 34;
const HD_FOOT_Y = 50;
const HD_RUN_FRAMES = 6;

let hdArt: HTMLImageElement | null = null;
let hdReady = false;

function loadHd(): void {
  if (hdArt || typeof Image === 'undefined') return;
  hdArt = new Image();
  hdArt.onload = () => { hdReady = true; };
  hdArt.onerror = () => console.error(`Бася: не вдалося завантажити аркуш ${basiaHdUrl}`);
  hdArt.src = basiaHdUrl;
}

/** Намалювати Басю лапами в точці (x, y) світу (32×32 на клітинку). */
export function drawDog(g: CanvasRenderingContext2D, x: number, y: number, dir: 0 | 1 | 2 | 3, moving: boolean, t: number): void {
  loadHd();
  if (!hdArt || !hdReady) return;
  const col = moving ? 1 + (Math.floor(t * 12) % HD_RUN_FRAMES) : 0;
  const dx = Math.round((x - HD_FOOT_X / 2) * 2) / 2;
  const dy = Math.round((y - HD_FOOT_Y / 2) * 2) / 2;
  g.drawImage(hdArt, col * HD_CELL, dir * HD_CELL, HD_CELL, HD_CELL, dx, dy, HD_CELL / 2, HD_CELL / 2);
}
