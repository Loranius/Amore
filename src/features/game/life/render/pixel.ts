// ============================================================
// Піксельні примітиви «Дєвочка в городі» (ADR-0239).
// ------------------------------------------------------------
// Уся графіка гри намальована кодом: жодного файлу-спрайта. Тут —
// полотна, кольори й обведення силуету, з яких складаються персонажі,
// будинки й дерева.
// ============================================================

export type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

export function ctx2d(c: HTMLCanvasElement): Ctx {
  const g = c.getContext('2d');
  if (!g) throw new Error('Canvas 2D недоступний');
  g.imageSmoothingEnabled = false;
  return g;
}

export function rect(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function px(g: Ctx, x: number, y: number, color: string): void {
  g.fillStyle = color;
  g.fillRect(Math.round(x), Math.round(y), 1, 1);
}

/** Піксельне коло (заповнене) — без згладжування. */
export function disc(g: Ctx, cx: number, cy: number, r: number, color: string): void {
  g.fillStyle = color;
  for (let y = -r; y <= r; y += 1) {
    const half = Math.floor(Math.sqrt(Math.max(0, r * r - y * y)) + 0.35);
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

/** Піксельний еліпс. */
export function ellipse(g: Ctx, cx: number, cy: number, rx: number, ry: number, color: string): void {
  g.fillStyle = color;
  for (let y = -ry; y <= ry; y += 1) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.35);
    g.fillRect(Math.round(cx - half), Math.round(cy + y), half * 2 + 1, 1);
  }
}

// ------------------------------------------------------------
// Колір.
// ------------------------------------------------------------
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Світліше (k > 0) або темніше (k < 0), з легким зсувом відтінку, як фарба. */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  if (k >= 0) return rgbToHex(r + (255 - r) * k, g + (255 - g) * k * 0.96, b + (255 - b) * k * 0.88);
  const d = 1 + k;
  // Тінь трохи холодніша: темне тягнеться до фіолетового, а не до сірого.
  return rgbToHex(r * d * 0.94, g * d * 0.92, b * d + (1 - d) * 26);
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * Обвести силует темною лінією: кожен прозорий піксель, що торкається
 * непрозорого, стає обведенням. Так малюють спрайти в Stardew Valley.
 */
export function outline(src: HTMLCanvasElement, color = '#2a1d24'): HTMLCanvasElement {
  const out = canvas(src.width + 2, src.height + 2);
  const g = ctx2d(out);
  g.drawImage(src, 1, 1);
  const data = g.getImageData(0, 0, out.width, out.height);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= out.width || y >= out.height ? 0 : data.data[(y * out.width + x) * 4 + 3]!);
  const [r, gg, b] = hexToRgb(color);
  const copy = new Uint8ClampedArray(data.data);
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < out.width; x += 1) {
      if (a(x, y) > 0) continue;
      if (a(x - 1, y) > 0 || a(x + 1, y) > 0 || a(x, y - 1) > 0 || a(x, y + 1) > 0) {
        const i = (y * out.width + x) * 4;
        copy[i] = r; copy[i + 1] = gg; copy[i + 2] = b; copy[i + 3] = 255;
      }
    }
  }
  data.data.set(copy);
  g.putImageData(data, 0, 0);
  return out;
}

export function flipX(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = canvas(src.width, src.height);
  const g = ctx2d(out);
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return out;
}

export { cellHash } from '../world/hash';
