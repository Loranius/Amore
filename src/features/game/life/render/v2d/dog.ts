// ============================================================
// 2D-стиль: Бася — чорний коргі Лєни (власник, 2026-10-05) — і кіт.
// Бася збирається з частин: тулуб, голова, великі вуха, короткі лапки, що
// перебирають у бігу, пухнастий задок. Чорна з рудими підпалинами й
// білими грудьми, мордочкою й лапками — як на спрайті з PixelLab.
// ============================================================
import { INK, circle, line, oval, poly, shade, softShadow, type Ctx } from './kit';

const BLACK = '#25202b';
const SHEEN = '#463e52';
const WHITE = '#f6f0e6';
const TAN = '#cf8f4e';
const EAR_IN = '#8a5a6e';

/** Бася: `x, y` — точка між лапами на землі; `dir` 0 до нас, 1 ліворуч, 2 праворуч, 3 від нас. */
export function drawDog2d(g: Ctx, x: number, y: number, dir: 0 | 1 | 2 | 3, moving: boolean, t: number): void {
  const ph = moving ? t * 16 : 0;
  const hop = moving ? Math.abs(Math.sin(ph)) * 1.2 : Math.sin(t * 2.2) * 0.25;
  softShadow(g, x, y, 9, 2.2, 0.3);
  g.save();
  g.translate(x, y - hop);
  if (dir === 1 || dir === 2) side(g, dir === 1 ? -1 : 1, ph, moving, t);
  else if (dir === 0) front(g, ph, moving, t);
  else back(g, ph, moving, t);
  g.restore();
}

function leg(g: Ctx, lx: number, swing: number, color: string, paw = WHITE): void {
  g.beginPath();
  g.moveTo(lx - 1.2, -5);
  g.lineTo(lx + 1.2, -5);
  g.lineTo(lx + 1.1 + swing, -0.6);
  g.lineTo(lx - 1.1 + swing, -0.6);
  g.closePath();
  g.fillStyle = color;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.6;
  g.stroke();
  oval(g, lx + swing, -0.5, 1.5, 0.8, paw, INK, 0.5);
}

function side(g: Ctx, s: 1 | -1, ph: number, moving: boolean, t: number): void {
  g.scale(s, 1);
  const sw = moving ? Math.sin(ph) * 1.6 : 0;
  // Дальні лапки — темніші.
  leg(g, -5.5, -sw, shade(BLACK, -0.2), '#e0d8cc');
  leg(g, 4.6, sw, shade(BLACK, -0.2), '#e0d8cc');
  // Хвостик-пухнастик.
  const wag = Math.sin(t * (moving ? 14 : 6)) * 0.5;
  oval(g, -9.6, -9.4, 2.2, 1.6, BLACK, INK, 0.6, wag);
  // Тулуб.
  oval(g, 0, -7.8, 9, 4.4, BLACK, INK, 0.75);
  oval(g, -1.5, -10, 6, 1.6, SHEEN, null);
  // Біле черевце й груди, руді боки.
  oval(g, 1.8, -5.4, 5.8, 1.8, WHITE, null);
  oval(g, -6.4, -6, 2.4, 2, TAN, null);
  // Ближні лапки.
  leg(g, -5, sw, TAN);
  leg(g, 5.2, -sw, TAN);
  // Голова.
  const hb = moving ? Math.sin(ph * 2) * 0.4 : 0;
  g.save();
  g.translate(7.6, -11.6 + hb);
  poly(g, [[-2.6, -2.6], [-0.4, -9.4], [1.4, -2.8]], BLACK, INK, 0.6);
  poly(g, [[-1.6, -3.2], [-0.5, -7.6], [0.6, -3.2]], EAR_IN, null);
  poly(g, [[0.2, -2.6], [3.2, -8.6], [3.8, -1.8]], BLACK, INK, 0.6);
  circle(g, 0.6, 0, 4, BLACK, INK, 0.7);
  oval(g, 1.4, 1.4, 2.8, 2, TAN, null);
  oval(g, 4, 1.6, 2.8, 1.8, WHITE, INK, 0.55);
  circle(g, 6.4, 1, 0.9, '#0d0b10', null);
  circle(g, 1.8, -0.8, 0.85, '#120e16', null);
  circle(g, 2.1, -1.1, 0.3, '#ffffff', null);
  oval(g, 1.2, -2.2, 0.8, 0.4, TAN, null);
  if (!moving) line(g, 4.6, 3, 5.6, 3.4, '#d96a7a', 0.6);
  g.restore();
}

function front(g: Ctx, ph: number, moving: boolean, t: number): void {
  const sw = moving ? Math.sin(ph) * 0.8 : 0;
  oval(g, 0, -6.6, 6.4, 4.6, BLACK, INK, 0.75);
  oval(g, 0, -6, 3.6, 3.6, WHITE, null);
  leg(g, -3, 0, TAN);
  leg(g, 3, 0, TAN);
  g.save();
  g.translate(0, -12.6 + (moving ? Math.abs(sw) * 0.4 : 0));
  poly(g, [[-4.4, -1.4], [-4.6, -9], [-1, -3]], BLACK, INK, 0.6);
  poly(g, [[4.4, -1.4], [4.6, -9], [1, -3]], BLACK, INK, 0.6);
  poly(g, [[-3.8, -2.4], [-3.9, -7.2], [-1.8, -3.4]], EAR_IN, null);
  poly(g, [[3.8, -2.4], [3.9, -7.2], [1.8, -3.4]], EAR_IN, null);
  oval(g, 0, 0, 4.6, 4, BLACK, INK, 0.7);
  oval(g, -2.4, 1.2, 1.8, 1.6, TAN, null);
  oval(g, 2.4, 1.2, 1.8, 1.6, TAN, null);
  oval(g, 0, 1.8, 2.2, 2, WHITE, null);
  line(g, 0, -3.6, 0, 0.4, WHITE, 0.9);
  circle(g, 0, 1.2, 0.8, '#0d0b10', null);
  for (const ex of [-1.9, 1.9]) {
    circle(g, ex, -0.8, 0.85, '#120e16', null);
    circle(g, ex + 0.3, -1.1, 0.3, '#ffffff', null);
  }
  if (!moving && Math.sin(t * 1.3) > 0.2) oval(g, 0, 3.4, 0.7, 1, '#d96a7a', null);
  g.restore();
}

function back(g: Ctx, ph: number, moving: boolean, t: number): void {
  const sw = moving ? Math.sin(ph) * 0.8 : 0;
  leg(g, -3, sw * 0.5, TAN);
  leg(g, 3, -sw * 0.5, TAN);
  oval(g, 0, -7, 6.6, 4.6, BLACK, INK, 0.75);
  // Знаменитий коргі-задок: біла пухнаста «сердечком».
  oval(g, -1.8, -5.4, 2.6, 2.4, WHITE, null);
  oval(g, 1.8, -5.4, 2.6, 2.4, WHITE, null);
  const wag = Math.sin(t * (moving ? 14 : 6)) * 0.6;
  oval(g, 0, -9, 1.8, 1.4, BLACK, INK, 0.5, wag);
  g.save();
  g.translate(0, -13);
  poly(g, [[-4.2, -1], [-4.4, -8.6], [-0.8, -2.6]], BLACK, INK, 0.6);
  poly(g, [[4.2, -1], [4.4, -8.6], [0.8, -2.6]], BLACK, INK, 0.6);
  oval(g, 0, 0, 4.4, 3.6, BLACK, INK, 0.7);
  oval(g, -1, -1.4, 2, 0.8, SHEEN, null);
  g.restore();
}

/** Кіт спить калачиком; хвіст ворушиться. */
export function drawCat2d(g: Ctx, x: number, y: number, color: string, t: number): void {
  softShadow(g, x + 8, y + 13, 8, 1.8);
  const tail = Math.sin(t * 2) * 1.2;
  g.beginPath();
  g.moveTo(x + 3, y + 11);
  g.quadraticCurveTo(x - 1, y + 10 + tail, x + 1, y + 7 + tail);
  g.strokeStyle = shade(color, -0.2);
  g.lineWidth = 2;
  g.stroke();
  oval(g, x + 8, y + 10.4, 6.4, 3.6, color, INK, 0.7);
  oval(g, x + 7, y + 9.2, 4, 1.4, shade(color, 0.18), null);
  for (let k = 0; k < 3; k += 1) line(g, x + 5 + k * 2.6, y + 8, x + 5.6 + k * 2.6, y + 10.6, shade(color, -0.25), 0.6);
  circle(g, x + 13, y + 8.4, 3.2, color, INK, 0.7);
  poly(g, [[x + 10.6, y + 6.6], [x + 11.4, y + 3.8], [x + 12.8, y + 5.8]], color, INK, 0.5);
  poly(g, [[x + 13.6, y + 5.6], [x + 15.4, y + 3.6], [x + 15.8, y + 6.6]], color, INK, 0.5);
  line(g, x + 11.6, y + 8.6, x + 12.8, y + 8.6, '#4a3020', 0.6);
  line(g, x + 13.8, y + 8.6, x + 15, y + 8.6, '#4a3020', 0.6);
  circle(g, x + 13.4, y + 9.8, 0.4, '#d96a7a', null);
}
