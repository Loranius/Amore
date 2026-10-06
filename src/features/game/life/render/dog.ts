// ============================================================
// Бася — чорний триколірний коргі (власник, 2026-10-05). Великі стоячі
// вуха, коротенькі лапи, біла грудка й мордочка, руді брови й щоки.
// ------------------------------------------------------------
// Основний малюнок — аркуш із PixelLab (`assets/basia.png`, персонаж
// «Бася (мала)», шаблон dog, вигляд «low top-down»): клітинки 36×36,
// рядки — напрям (вниз, ліворуч, праворуч, угору; «ліворуч» — дзеркало
// «праворуч»), стовпці — стоїть, далі 6 кадрів бігу. Поки аркуш вантажиться,
// малюється піксельний коргі нижче, намальований кодом.
// ============================================================
import basiaUrl from './assets/basia.png';
import basiaHdUrl from './assets/hd/basia.png';
import { canvas, ctx2d, densityOf, flipX, outline, px, rect, type Ctx } from './pixel';

const CELL = 36;
/** Де в клітинці лапи: низ спрайта на рядку 27, середина — 18. */
const FOOT_X = 18;
const FOOT_Y = 27;
const RUN_FRAMES = 6;

let art: HTMLImageElement | null = null;
let artReady = false;

function loadArt(): void {
  if (art || typeof Image === 'undefined') return;
  art = new Image();
  art.onload = () => { artReady = true; };
  art.onerror = () => console.error(`Бася: не вдалося завантажити аркуш ${basiaUrl}`);
  art.src = basiaUrl;
}

// 32×32 (власник, 2026-10-06): аркуш персонажа PixelLab «Бася HD»
// (ee1aa312-…, шаблон dog, size 48): клітинки 68×68, ті самі рядки
// напрямів, стовпці — стоїть, далі кадри бігу. Піксель аркуша — пів
// світового, тож Бася малюється вдвічі меншою за аркуш.
const HD_CELL = 68;
const HD_FOOT_X = 34;
const HD_FOOT_Y = 50;
const HD_RUN_FRAMES = 0;

let hdArt: HTMLImageElement | null = null;
let hdReady = false;

function loadHd(): void {
  if (hdArt || typeof Image === 'undefined') return;
  hdArt = new Image();
  hdArt.onload = () => { hdReady = true; };
  hdArt.onerror = () => console.error(`Бася 32×32: не вдалося завантажити аркуш ${basiaHdUrl}`);
  hdArt.src = basiaHdUrl;
}

/** Намалювати Басю лапами в точці (x, y). */
export function drawDog(g: CanvasRenderingContext2D, x: number, y: number, dir: 0 | 1 | 2 | 3, moving: boolean, t: number): void {
  if (densityOf(g) > 1) {
    loadHd();
    if (hdArt && hdReady) {
      const col = moving && HD_RUN_FRAMES > 0 ? 1 + (Math.floor(t * 12) % HD_RUN_FRAMES) : 0;
      const dx = Math.round((x - HD_FOOT_X / 2) * 2) / 2;
      const dy = Math.round((y - HD_FOOT_Y / 2) * 2) / 2;
      g.drawImage(hdArt, col * HD_CELL, dir * HD_CELL, HD_CELL, HD_CELL, dx, dy, HD_CELL / 2, HD_CELL / 2);
      return;
    }
  }
  loadArt();
  if (art && artReady) {
    const col = moving ? 1 + (Math.floor(t * 12) % RUN_FRAMES) : 0;
    g.drawImage(art, col * CELL, dir * CELL, CELL, CELL, Math.round(x - FOOT_X), Math.round(y - FOOT_Y), CELL, CELL);
    return;
  }
  const img = dogSheet()[dir]![dogFrame(moving, t)]!;
  g.drawImage(img, Math.round(x - img.width / 2), Math.round(y - img.height + 1));
}

const BLACK = '#1f1b24';
const SHEEN = '#3d3646';
const WHITE = '#f4eee4';
const TAN = '#c98a4a';
const EAR = '#7a4a5e';
const NOSE = '#0d0b10';

const W = 22;
const H = 15;

/** Кадр бігу: зсув лап і підскок тіла. */
function gait(f: number): { a: number; b: number; hop: number } {
  return [{ a: 0, b: 0, hop: 0 }, { a: 1, b: -1, hop: -1 }, { a: 0, b: 0, hop: 0 }, { a: -1, b: 1, hop: -1 }][f % 4]!;
}

function side(g: Ctx, f: number): void {
  const { a, b, hop } = gait(f);
  const y = 1 + hop;
  // Лапи — коротенькі, з білими «шкарпетками».
  for (const [lx, d] of [[4, a], [7, b], [12, a], [15, b]] as const) {
    rect(g, lx + d, y + 10, 2, 3, BLACK);
    rect(g, lx + d, y + 12, 2, 1, WHITE);
    px(g, lx + d, y + 10, TAN);
  }
  // Тулуб.
  rect(g, 3, y + 5, 14, 6, BLACK);
  rect(g, 4, y + 4, 12, 1, BLACK);
  rect(g, 4, y + 5, 11, 1, SHEEN);
  // Пухнастий задок.
  rect(g, 2, y + 6, 2, 4, BLACK);
  px(g, 2, y + 9, WHITE);
  // Грудка.
  rect(g, 15, y + 8, 3, 3, WHITE);
  // Голова.
  rect(g, 14, y + 2, 6, 6, BLACK);
  rect(g, 15, y + 1, 4, 1, BLACK);
  rect(g, 19, y + 5, 2, 3, WHITE);
  px(g, 21, y + 5, NOSE);
  px(g, 20, y + 5, NOSE);
  px(g, 18, y + 4, '#ffffff');
  px(g, 17, y + 3, TAN);
  px(g, 17, y + 6, TAN);
  px(g, 18, y + 7, TAN);
  // Вуха — великі, стоячі.
  rect(g, 14, y - 1, 2, 3, BLACK);
  rect(g, 17, y - 1, 2, 3, BLACK);
  px(g, 14, y, EAR);
  px(g, 17, y, EAR);
}

function front(g: Ctx, f: number): void {
  const { a, b, hop } = gait(f);
  const y = 1 + hop;
  rect(g, 7, y + 7, 8, 5, BLACK);
  for (const [lx, d] of [[8, a], [12, b]] as const) {
    rect(g, lx, y + 11 + Math.max(0, d), 2, 2, BLACK);
    rect(g, lx, y + 12 + Math.max(0, d), 2, 1, WHITE);
  }
  rect(g, 8, y + 8, 6, 3, WHITE);
  // Голова.
  rect(g, 6, y + 1, 10, 7, BLACK);
  rect(g, 7, y, 8, 1, BLACK);
  rect(g, 10, y + 2, 2, 4, WHITE);
  rect(g, 8, y + 5, 6, 3, WHITE);
  rect(g, 10, y + 5, 2, 1, NOSE);
  px(g, 8, y + 3, '#ffffff');
  px(g, 13, y + 3, '#ffffff');
  px(g, 8, y + 2, TAN);
  px(g, 13, y + 2, TAN);
  px(g, 7, y + 5, TAN);
  px(g, 14, y + 5, TAN);
  rect(g, 5, y - 2, 2, 3, BLACK);
  rect(g, 15, y - 2, 2, 3, BLACK);
  px(g, 5, y - 1, EAR);
  px(g, 16, y - 1, EAR);
}

function back(g: Ctx, f: number): void {
  const { a, b, hop } = gait(f);
  const y = 1 + hop;
  for (const [lx, d] of [[7, a], [13, b]] as const) {
    rect(g, lx, y + 11 + Math.max(0, d), 2, 2, BLACK);
    rect(g, lx, y + 12 + Math.max(0, d), 2, 1, WHITE);
  }
  rect(g, 6, y + 4, 10, 8, BLACK);
  rect(g, 7, y + 4, 8, 1, SHEEN);
  // Пухнастий «серцеподібний» задок.
  rect(g, 8, y + 8, 2, 3, WHITE);
  rect(g, 12, y + 8, 2, 3, WHITE);
  rect(g, 10, y + 9, 2, 2, WHITE);
  rect(g, 7, y, 8, 4, BLACK);
  rect(g, 6, y - 2, 2, 3, BLACK);
  rect(g, 14, y - 2, 2, 3, BLACK);
}

type DogSheet = HTMLCanvasElement[][];
let sheet: DogSheet | null = null;

/** Аркуш [напрям][кадр]: 0 вниз, 1 ліворуч, 2 праворуч, 3 угору. */
export function dogSheet(): DogSheet {
  if (sheet) return sheet;
  const make = (draw: (g: Ctx, f: number) => void, f: number) => {
    const c = canvas(W, H);
    draw(ctx2d(c), f);
    return outline(c);
  };
  const right = [0, 1, 2, 3].map((f) => make(side, f));
  sheet = [[0, 1, 2, 3].map((f) => make(front, f)), right.map(flipX), right, [0, 1, 2, 3].map((f) => make(back, f))];
  return sheet;
}

/** Кадр бігу: Бася перебирає лапами швидше за людей. */
export function dogFrame(moving: boolean, t: number): number {
  return moving ? Math.floor(t * 14) % 4 : 0;
}
