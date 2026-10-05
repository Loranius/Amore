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

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
  return [h * 60, s, l];
}

function hslToHex(h: number, s: number, l: number): string {
  const hh = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return rgbToHex(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    const tt = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return rgbToHex(f(hh + 1 / 3) * 255, f(hh) * 255, f(hh - 1 / 3) * 255);
}

/** Повернути відтінок `h` до `target` найкоротшим шляхом, не більше ніж на `deg`. */
function hueToward(h: number, target: number, deg: number): number {
  const diff = ((target - h + 540) % 360) - 180;
  return h + Math.sign(diff) * Math.min(Math.abs(diff), deg);
}

/** Куди тягнуться тіні й світла (за палітрами PixelLab, див. нижче). */
const SHADOW_HUE = 300;
const LIGHT_HUE = 50;

/**
 * Світліше (k > 0) або темніше (k < 0) — зі зсувом відтінку, як у
 * спрайтах PixelLab (2026-10-05, виміряно на Басі): тінь не просто
 * темніє, а повертає відтінок до пурпурового (руде 24° → 9°, чорне —
 * сливове 300–330°) і трохи насичується; світло тягнеться до теплого
 * жовтого й трохи сіріє. Сірі кольори лише ледь підфарбовуються.
 */
export function shade(hex: string, k: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  const grey = s < 0.06;
  if (k >= 0) {
    const nh = grey ? LIGHT_HUE : hueToward(h, LIGHT_HUE, 14 * k);
    const ns = grey ? Math.min(0.12, s + 0.06 * k) : s * (1 - 0.22 * k);
    return hslToHex(nh, ns, l + (1 - l) * k);
  }
  const a = -k;
  const nh = grey ? SHADOW_HUE : hueToward(h, SHADOW_HUE, 26 * a);
  const ns = grey ? Math.min(0.16, s + 0.1 * a) : Math.min(1, s + 0.14 * a);
  return hslToHex(nh, ns, l * (1 - a));
}

export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
}

/**
 * Обвести силует — за правилом PixelLab «selout» (вибірковий контур).
 * Однаковий темний контур довкола всього силуету — «наліпка»: лінт
 * PixelLab ловить його як `outline_uniform` / `pillow`. Світло падає
 * зліва згори, тож:
 *   • з освітленого боку (контур над спрайтом або ліворуч від нього)
 *     контур — це глибока тінь сусіднього кольору, і він «тане» в
 *     спрайт;
 *   • з тіньового боку (праворуч і знизу) — темний підфарбований
 *     майже-чорний, як `#161013` у PixelLab.
 */
export function outline(src: HTMLCanvasElement, color = '#1c1419'): HTMLCanvasElement {
  const out = canvas(src.width + 2, src.height + 2);
  const g = ctx2d(out);
  g.drawImage(src, 1, 1);
  const data = g.getImageData(0, 0, out.width, out.height);
  const d = data.data;
  const W = out.width;
  const palette = mergeNearDuplicates(d);
  const a = (x: number, y: number) => (x < 0 || y < 0 || x >= W || y >= out.height ? 0 : d[(y * W + x) * 4 + 3]!);
  const rgbAt = (x: number, y: number): [number, number, number] => { const i = (y * W + x) * 4; return [d[i]!, d[i + 1]!, d[i + 2]!]; };
  const [r, gg, b] = hexToRgb(color);
  const copy = new Uint8ClampedArray(d);
  const cache = new Map<number, [number, number, number]>();
  for (let y = 0; y < out.height; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (a(x, y) > 0) continue;
      const below = a(x, y + 1) > 0;
      const right = a(x + 1, y) > 0;
      const left = a(x - 1, y) > 0;
      const above = a(x, y - 1) > 0;
      if (!below && !right && !left && !above) continue;
      const i = (y * W + x) * 4;
      // Освітлений бік: спрайт праворуч або знизу від цього пікселя, а
      // ліворуч і згори — нічого.
      const lit = (below || right) && !left && !above;
      let rgb: [number, number, number] = [r, gg, b];
      if (lit) {
        const s0 = below ? rgbAt(x, y + 1) : rgbAt(x + 1, y);
        const key = (s0[0] << 16) | (s0[1] << 8) | s0[2];
        let c = cache.get(key);
        if (!c) { c = rampDark(s0, palette); cache.set(key, c); }
        rgb = c;
      }
      copy[i] = rgb[0]; copy[i + 1] = rgb[1]; copy[i + 2] = rgb[2]; copy[i + 3] = 255;
    }
  }
  data.data.set(copy);
  g.putImageData(data, 0, 0);
  return out;
}

const luma = (c: readonly number[]) => 0.299 * c[0]! + 0.587 * c[1]! + 0.114 * c[2]!;
const dist2 = (p: readonly number[], q: readonly number[]) => (p[0]! - q[0]!) ** 2 + (p[1]! - q[1]!) ** 2 + (p[2]! - q[2]!) ** 2;

/**
 * Палітра без майже-однакових кольорів — головне правило дисципліни
 * PixelLab (`near_duplicates`): два тони, що різняться на кілька одиниць,
 * читаються як один, тільки шумлять. Рідший зливається з частішим.
 * Змінює пікселі на місці; повертає підсумкову палітру.
 */
function mergeNearDuplicates(d: Uint8ClampedArray): [number, number, number][] {
  const counts = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3]! === 0) continue;
    const k = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  // Частіші — першими; за рівності — за значенням, щоб результат був сталим.
  const order = [...counts.entries()].sort((p, q) => q[1] - p[1] || p[0] - q[0]).map(([k]) => [(k >> 16) & 255, (k >> 8) & 255, k & 255] as [number, number, number]);
  const keep: [number, number, number][] = [];
  const map = new Map<number, [number, number, number]>();
  for (const c of order) {
    const twin = keep.find((k) => dist2(k, c) < NEAR_DUPLICATE * NEAR_DUPLICATE);
    if (twin) map.set((c[0] << 16) | (c[1] << 8) | c[2], twin);
    else keep.push(c);
  }
  if (map.size) {
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3]! === 0) continue;
      const t = map.get((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
      if (t) { d[i] = t[0]; d[i + 1] = t[1]; d[i + 2] = t[2]; }
    }
  }
  return keep;
}

/**
 * Палітрова дисципліна PixelLab для готового спрайта без контуру (будівлі):
 * злити майже-однакові кольори. Повертає те саме полотно.
 */
export function disciplinePalette(c: HTMLCanvasElement): HTMLCanvasElement {
  const g = ctx2d(c);
  const data = g.getImageData(0, 0, c.width, c.height);
  mergeNearDuplicates(data.data);
  g.putImageData(data, 0, 0);
  return c;
}

/** Відстань (RGB), ближче за яку два кольори вважаються одним. */
const NEAR_DUPLICATE = 14;

/**
 * Темний тон тієї ж рампи для контуру з освітленого боку: найближчий до
 * зсунутої тіні колір, що вже є у спрайті й темніший за сусіда; якщо
 * такого немає — сама зсунута тінь. Так контур не додає нових кольорів.
 */
function rampDark(c: [number, number, number], palette: [number, number, number][]): [number, number, number] {
  const want = hexToRgb(shade(rgbToHex(c[0], c[1], c[2]), -0.45));
  let best: [number, number, number] | null = null;
  let bestD = 40 * 40;
  for (const p of palette) {
    if (luma(p) >= luma(c) - 12) continue;
    const dd = dist2(p, want);
    if (dd < bestD) { bestD = dd; best = p; }
  }
  return best ?? want;
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
