// ============================================================
// 2D-стиль «Дєвочка в городі» (ADR-0239, власник 2026-10-06: «з піксельної
// до 2d»): плоска векторна графіка, намальована кодом. Ті самі мапи,
// зіткнення й логіка — інше лише малювання.
// ------------------------------------------------------------
// Мова стилю:
//   • гладкі фігури з м'якими кутами, тонка тепла обвідка (`INK`);
//   • три тони на форму — світло зверху-зліва, основа, тінь знизу-справа;
//   • тіні на землі — м'які, з градієнтом, а не плями;
//   • ніяких текстур поверх граней: фактура — лише рідкі штрихи.
// Усе малюється у світових пікселях (клітинка = 16) під масштабом сцени,
// тож на будь-якому екрані різке. Нерухоме (земля, будинки, дерева)
// кешується в полотна з роздільністю `res` пікселів на світовий піксель.
// ============================================================
import { cellHash, mix, shade } from '../pixel';

export type Ctx = CanvasRenderingContext2D;

/** Колір обвідки: теплий темний, не чорний. */
export const INK = '#3b2a2e';
/** Товщина обвідки у світових пікселях. */
export const LINE = 0.75;

/** Роздільність кешованих полотен: не більше 4 на світовий піксель (пам'ять телефона). */
export function resFor(scale: number): number {
  return Math.max(1, Math.min(4, Math.round(scale)));
}

/** Полотно `w×h` світових пікселів у роздільності `res`; контекст уже масштабований. */
export function hires(w: number, h: number, res: number): { c: HTMLCanvasElement; g: Ctx } {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * res));
  c.height = Math.max(1, Math.ceil(h * res));
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = true;
  g.scale(res, res);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  return { c, g };
}

/** Шлях прямокутника з заокругленими кутами (`r` — один радіус чи [лв, пв, пн, лн]). */
export function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]): void {
  const [a, b, c, d] = typeof r === 'number' ? [r, r, r, r] : r;
  const k = (v: number) => Math.max(0, Math.min(v, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + k(a), y);
  g.lineTo(x + w - k(b), y);
  g.quadraticCurveTo(x + w, y, x + w, y + k(b));
  g.lineTo(x + w, y + h - k(c));
  g.quadraticCurveTo(x + w, y + h, x + w - k(c), y + h);
  g.lineTo(x + k(d), y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - k(d));
  g.lineTo(x, y + k(a));
  g.quadraticCurveTo(x, y, x + k(a), y);
  g.closePath();
}

/** Залити поточний шлях і, якщо треба, обвести. */
export function paint(g: Ctx, fill: string | CanvasGradient, stroke: string | null = INK, width = LINE): void {
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = width;
    g.stroke();
  }
}

/** Прямокутник із м'якими кутами: заливка + обвідка. */
export function box(g: Ctx, x: number, y: number, w: number, h: number, r: number | [number, number, number, number], fill: string | CanvasGradient, stroke: string | null = INK, width = LINE): void {
  rr(g, x, y, w, h, r);
  paint(g, fill, stroke, width);
}

export function circle(g: Ctx, cx: number, cy: number, r: number, fill: string | CanvasGradient, stroke: string | null = INK, width = LINE): void {
  g.beginPath();
  g.arc(cx, cy, Math.max(0.01, r), 0, Math.PI * 2);
  paint(g, fill, stroke, width);
}

export function oval(g: Ctx, cx: number, cy: number, rx: number, ry: number, fill: string | CanvasGradient, stroke: string | null = INK, width = LINE, rot = 0): void {
  g.beginPath();
  g.ellipse(cx, cy, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, Math.PI * 2);
  paint(g, fill, stroke, width);
}

/** Многокутник за точками. */
export function poly(g: Ctx, pts: readonly (readonly [number, number])[], fill: string | CanvasGradient, stroke: string | null = INK, width = LINE): void {
  g.beginPath();
  pts.forEach(([x, y], k) => (k === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  paint(g, fill, stroke, width);
}

/** Лінія (штрих фактури чи контур). */
export function line(g: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, width = LINE): void {
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokeStyle = color;
  g.lineWidth = width;
  g.stroke();
}

/** Вертикальний градієнт: світліше вгорі, темніше внизу. */
export function vgrad(g: Ctx, y0: number, y1: number, top: string, bottom: string): CanvasGradient {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, top);
  gr.addColorStop(1, bottom);
  return gr;
}

/** Форма в три тони: світло зверху-зліва, основа, тінь знизу-справа. */
export function lit(g: Ctx, x: number, y: number, w: number, h: number, base: string): CanvasGradient {
  const gr = g.createLinearGradient(x, y, x + w * 0.6, y + h);
  gr.addColorStop(0, shade(base, 0.16));
  gr.addColorStop(0.55, base);
  gr.addColorStop(1, shade(base, -0.16));
  return gr;
}

/** М'яка тінь на землі під предметом. */
export function softShadow(g: Ctx, cx: number, cy: number, rx: number, ry: number, alpha = 0.26): void {
  const gr = g.createRadialGradient(cx, cy, 0, cx, cy, rx);
  gr.addColorStop(0, `rgba(40,26,46,${alpha})`);
  gr.addColorStop(0.65, `rgba(40,26,46,${alpha * 0.6})`);
  gr.addColorStop(1, 'rgba(40,26,46,0)');
  g.save();
  g.translate(cx, cy);
  g.scale(1, ry / rx);
  g.translate(-cx, -cy);
  g.fillStyle = gr;
  g.beginPath();
  g.arc(cx, cy, rx, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Детермінований «випадковий» дріб 0…1 для клітинки й номера. */
export function hash01(i: number, j: number, k = 0): number {
  return cellHash(i, j, k) / 4294967296;
}

export { mix, shade };
