// ============================================================
// Набір для міні-ігор «Дєвочка в городі» (ADR-0239).
// ------------------------------------------------------------
// Кожна гра малює піксельну сцену у «віртуальних» пікселях (ширина
// ~240, ціле збільшення — без розмиття), а текст — окремо, у пікселях
// екрана, щоб літери були чіткі. Кнопки — дерев'яні дощечки; дотик
// повертає id кнопки, тож ігри не рахують координат самі.
// ============================================================
import type { Rng } from '../sim/rng';
import { drawBitmap, ICONS } from '../render/icons';
import { sheetFor, type Dir, type Look } from '../render/people';
import { disc, ellipse, rect, shade, type Ctx } from '../render/pixel';

export interface MiniGame {
  /** Назва — на табличці вгорі. */
  readonly title: string;
  /** Що робити — під назвою. */
  readonly hint: string;
  update(dt: number): void;
  render(kit: Kit): void;
  /** Дотик у віртуальних пікселях. */
  tap(x: number, y: number, kit: Kit): void;
  readonly done: boolean;
  /** Підсумок 0..1 (відомий, коли `done`). */
  readonly score: number;
}

export interface GameContext {
  rng: Rng;
  /** Клас 1..11, курс ВДПУ 12..15, садочок 0; для роботи — ранг 0..2. */
  level: number;
  lena: Look;
}

export type GameFactory = (ctx: GameContext) => MiniGame;

export interface Hit {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TextOpts = {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  weight?: number;
  shadow?: string | null;
  maxWidth?: number;
};

/** Тло сцени. */
export type Backdrop = 'yard' | 'classroom' | 'gym' | 'cafe' | 'office' | 'shop' | 'flowers' | 'bakery' | 'studio' | 'post' | 'sea' | 'room' | 'lecture';

export class Kit {
  g!: Ctx;
  /** Пікселів пристрою на віртуальний піксель. */
  s = 3;
  W = 240;
  H = 400;
  dpr = 1;
  time = 0;
  private hits: Hit[] = [];

  begin(g: Ctx, deviceW: number, deviceH: number, dpr: number, time: number): void {
    this.g = g;
    this.dpr = dpr;
    this.time = time;
    this.s = Math.max(2, Math.floor(deviceW / 240));
    this.W = Math.floor(deviceW / this.s);
    this.H = Math.floor(deviceH / this.s);
    this.hits = [];
    g.setTransform(this.s, 0, 0, this.s, 0, 0);
    g.imageSmoothingEnabled = false;
  }

  /** Дотик екранними пікселями → id кнопки. */
  hitAt(x: number, y: number): string | null {
    for (let k = this.hits.length - 1; k >= 0; k -= 1) {
      const h = this.hits[k]!;
      if (x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h) return h.id;
    }
    return null;
  }

  region(id: string, x: number, y: number, w: number, h: number): void {
    this.hits.push({ id, x, y, w, h });
  }

  rect(x: number, y: number, w: number, h: number, c: string): void {
    rect(this.g, x, y, w, h, c);
  }

  disc(x: number, y: number, r: number, c: string): void {
    disc(this.g, x, y, r, c);
  }

  ellipse(x: number, y: number, rx: number, ry: number, c: string): void {
    ellipse(this.g, x, y, rx, ry, c);
  }

  icon(name: keyof typeof ICONS, x: number, y: number, scale = 1): void {
    if (scale === 1) { drawBitmap(this.g, name, Math.round(x), Math.round(y)); return; }
    this.g.save();
    this.g.translate(Math.round(x), Math.round(y));
    this.g.scale(scale, scale);
    drawBitmap(this.g, name, 0, 0);
    this.g.restore();
  }

  /** Персонаж зі спрайта. */
  person(look: Look, x: number, y: number, scale = 2, dir: Dir = 0, frame = 0): void {
    const img = sheetFor(look)[dir]![frame]!;
    ellipse(this.g, x, y, (look.kid ? 4 : 5) * scale, 2 * scale, 'rgba(28,20,40,0.25)');
    this.g.drawImage(img, Math.round(x - (img.width * scale) / 2), Math.round(y - img.height * scale + 2 * scale), img.width * scale, img.height * scale);
  }

  /** Текст у пікселях екрана, але координати — віртуальні. */
  text(str: string, x: number, y: number, o: TextOpts = {}): void {
    const g = this.g;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    const px = Math.round((o.size ?? 9) * this.s);
    g.font = `${o.weight ?? 800} ${px}px Nunito, system-ui, sans-serif`;
    g.textAlign = o.align ?? 'center';
    g.textBaseline = 'middle';
    const sx = x * this.s;
    const sy = y * this.s;
    const max = o.maxWidth ? o.maxWidth * this.s : undefined;
    if (o.shadow !== null) {
      g.fillStyle = o.shadow ?? 'rgba(40,24,16,0.55)';
      g.fillText(str, sx + this.s * 0.6, sy + this.s * 0.6, max);
    }
    g.fillStyle = o.color ?? '#fff6e0';
    g.fillText(str, sx, sy, max);
    g.restore();
  }

  /** Перенесення тексту в рядки за шириною (віртуальні пікселі). */
  wrap(str: string, width: number, size = 9): string[] {
    const g = this.g;
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.font = `800 ${Math.round(size * this.s)}px Nunito, system-ui, sans-serif`;
    const lines: string[] = [];
    let line = '';
    for (const word of str.split(' ')) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > width * this.s && line) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    g.restore();
    return lines;
  }

  /** Дерев'яна табличка (як меню Stardew). */
  panel(x: number, y: number, w: number, h: number, kind: 'wood' | 'paper' | 'chalk' = 'paper'): void {
    if (kind === 'chalk') {
      rect(this.g, x - 3, y - 3, w + 6, h + 6, '#7a4a2a');
      rect(this.g, x - 2, y - 2, w + 4, 1, '#a8784a');
      rect(this.g, x, y, w, h, '#2f5240');
      rect(this.g, x, y, w, 2, '#3a6450');
      for (let k = 0; k < 6; k += 1) rect(this.g, x + ((k * 37) % w), y + ((k * 23) % h), 6, 1, 'rgba(255,255,255,0.06)');
      return;
    }
    rect(this.g, x, y, w, h, '#5a3218');
    rect(this.g, x + 1, y + 1, w - 2, h - 2, kind === 'wood' ? '#b8703a' : '#e9b866');
    rect(this.g, x + 3, y + 3, w - 6, h - 6, kind === 'wood' ? '#d0894a' : '#fbe7b8');
    rect(this.g, x + 3, y + 3, w - 6, 1, kind === 'wood' ? '#e8a868' : '#fff6dc');
    rect(this.g, x + 1, y + h - 2, w - 2, 1, '#3a1e0e');
  }

  /** Кнопка-дощечка з підписом; реєструє зону дотику. */
  button(id: string, x: number, y: number, w: number, h: number, label: string, o: { tone?: 'wood' | 'green' | 'red' | 'blue' | 'gold' | 'paper'; pressed?: boolean; size?: number; color?: string } = {}): void {
    const tone = o.tone ?? 'paper';
    const base = { wood: '#c98a4a', green: '#7cc46a', red: '#e8776a', blue: '#7fb8e8', gold: '#f2c14e', paper: '#fbe7b8' }[tone];
    const dy = o.pressed ? 1 : 0;
    rect(this.g, x, y + 2, w, h, '#3a1e0e');
    rect(this.g, x, y + dy, w, h, '#5a3218');
    rect(this.g, x + 1, y + 1 + dy, w - 2, h - 2, base);
    rect(this.g, x + 1, y + 1 + dy, w - 2, 1, shade(base, 0.3));
    rect(this.g, x + 1, y + h - 2 + dy, w - 2, 1, shade(base, -0.2));
    if (label) this.text(label, x + w / 2, y + h / 2 + dy, { size: o.size ?? 9, color: o.color ?? '#4a2a14', shadow: null });
    this.region(id, x, y, w, h + 2);
  }

  /** Смужка часу/прогресу. */
  bar(x: number, y: number, w: number, h: number, t: number, color = '#7ed957'): void {
    rect(this.g, x - 1, y - 1, w + 2, h + 2, '#3a1e0e');
    rect(this.g, x, y, w, h, '#5a3a2a');
    rect(this.g, x, y, Math.max(0, Math.min(1, t)) * w, h, color);
    rect(this.g, x, y, Math.max(0, Math.min(1, t)) * w, 1, shade(color, 0.3));
  }

  /** Тло для гри. */
  backdrop(kind: Backdrop): void {
    const { W, H } = this;
    const g = this.g;
    const sky = (top: string, bottom: string, horizon: number) => {
      const grd = g.createLinearGradient(0, 0, 0, horizon);
      grd.addColorStop(0, top);
      grd.addColorStop(1, bottom);
      g.fillStyle = grd;
      g.fillRect(0, 0, W, horizon);
    };
    const floor = (y: number, a: string, b: string) => {
      for (let r = y; r < H; r += 6) rect(g, 0, r, W, 6, (Math.floor(r / 6) % 2 ? a : b));
      for (let r = y; r < H; r += 6) for (let x = ((r / 6) % 2) * 20; x < W; x += 40) rect(g, x, r, 1, 6, shade(a, -0.15));
    };
    const wallpaper = (h: number, c: string, dot: string) => {
      rect(g, 0, 0, W, h, c);
      for (let y = 6; y < h; y += 12) for (let x = (y % 24 ? 6 : 0); x < W; x += 12) rect(g, x, y, 1, 1, dot);
      rect(g, 0, h - 4, W, 4, '#7a4a2a');
      rect(g, 0, h - 4, W, 1, '#a8784a');
    };
    switch (kind) {
      case 'yard': {
        sky('#8fd3f4', '#d9f2fb', H * 0.42);
        // Хмарки.
        for (let k = 0; k < 3; k += 1) {
          const cx = ((k * 97 + this.time * 4) % (W + 60)) - 30;
          ellipse(g, cx, 30 + k * 18, 16, 5, '#ffffff');
          ellipse(g, cx + 8, 27 + k * 18, 9, 5, '#ffffff');
        }
        rect(g, 0, H * 0.42, W, H, '#78c25a');
        for (let k = 0; k < 160; k += 1) rect(g, (k * 53) % W, H * 0.42 + ((k * 37) % Math.round(H * 0.58)), 1, 2, k % 3 ? '#5fa648' : '#94d46a');
        rect(g, 0, H * 0.42, W, 3, '#5fa648');
        for (let x = 0; x < W; x += 14) { rect(g, x, H * 0.42 - 10, 2, 12, '#c08a52'); }
        rect(g, 0, H * 0.42 - 8, W, 2, '#c08a52');
        rect(g, 0, H * 0.42 - 3, W, 2, '#c08a52');
        break;
      }
      case 'classroom': case 'lecture': {
        wallpaper(H * 0.44, kind === 'lecture' ? '#e8dcc8' : '#e3ecd8', kind === 'lecture' ? '#d6c8b0' : '#cbd8bc');
        floor(H * 0.44, '#c9925a', '#c08850');
        // Вікно збоку.
        rect(g, W - 30, 20, 24, 30, '#7a4a2a');
        rect(g, W - 28, 22, 20, 26, '#bfe3f5');
        rect(g, W - 19, 22, 1, 26, '#7a4a2a');
        break;
      }
      case 'gym': {
        wallpaper(H * 0.36, '#d8e0ea', '#c4ceda');
        floor(H * 0.36, '#d9a46a', '#d09a60');
        rect(g, 0, H * 0.7, W, 2, '#f4f4f7');
        break;
      }
      case 'cafe': case 'bakery': {
        wallpaper(H * 0.4, kind === 'cafe' ? '#5a3a2a' : '#f4e2c8', kind === 'cafe' ? '#6e4a34' : '#e8cfa8');
        floor(H * 0.4, '#a8784a', '#9a6a3a');
        // Полиці з чашками/булками.
        for (let x = 10; x < W - 10; x += 30) {
          rect(g, x, 30, 24, 2, '#3a2a1e');
          ellipse(g, x + 6, 27, 3, 2, kind === 'cafe' ? '#f4f4f7' : '#e3a85a');
          ellipse(g, x + 16, 27, 3, 2, kind === 'cafe' ? '#f4f4f7' : '#c97a3a');
        }
        break;
      }
      case 'office': case 'studio': {
        wallpaper(H * 0.42, kind === 'office' ? '#dfe6ee' : '#f4f0ea', '#c9d2dc');
        floor(H * 0.42, '#9aa4b0', '#909aa6');
        rect(g, 12, 18, 40, 26, '#7a8a9a');
        rect(g, 14, 20, 36, 22, '#bfe3f5');
        break;
      }
      case 'shop': case 'post': {
        wallpaper(H * 0.4, kind === 'post' ? '#d8e4f4' : '#f2e2c4', kind === 'post' ? '#c4d4ea' : '#e2cfa8');
        floor(H * 0.4, '#c9b08a', '#bfa680');
        break;
      }
      case 'flowers': {
        wallpaper(H * 0.4, '#f4dce6', '#e8c4d4');
        floor(H * 0.4, '#b8c8a8', '#aebf9e');
        for (let x = 6; x < W; x += 22) {
          rect(g, x, 34, 14, 10, '#c96a4c');
          disc(g, x + 7, 30, 6, '#5fa648');
          disc(g, x + 4, 27, 2, ['#ff7aa8', '#f6d55c', '#f4f4f7'][x % 3]!);
          disc(g, x + 10, 28, 2, ['#e8576c', '#b9a7f2', '#ff7aa8'][x % 3]!);
        }
        break;
      }
      case 'sea': {
        sky('#7fc8f0', '#d4f0fb', H * 0.36);
        rect(g, 0, H * 0.36, W, H * 0.16, '#3f8fcf');
        for (let k = 0; k < 30; k += 1) rect(g, (k * 41 + this.time * 10) % W, H * 0.38 + (k * 13) % Math.round(H * 0.12), 5, 1, '#8cc7ef');
        rect(g, 0, H * 0.52, W, H, '#ecd69a');
        break;
      }
      case 'room': {
        wallpaper(H * 0.42, '#e8d9b8', '#ddc9a2');
        floor(H * 0.42, '#c9925a', '#c08850');
        break;
      }
    }
  }
}

/** Тон дотику: правильно — зелений, хибно — червоний (на 0.35 с). */
export class Flash {
  private t = 0;
  ok = true;
  set(ok: boolean): void { this.ok = ok; this.t = 0.35; }
  update(dt: number): void { this.t = Math.max(0, this.t - dt); }
  get on(): boolean { return this.t > 0; }
}

/** Сітка кнопок відповідей: 2×2 або 1×n. */
export function answerGrid(kit: Kit, answers: readonly string[], y: number, flashIndex: number, flashOk: boolean, size = 10): void {
  const cols = answers.length === 4 ? 2 : answers.length;
  const gap = 6;
  const w = Math.min(104, Math.floor((kit.W - 20 - gap * (cols - 1)) / cols));
  const h = 26;
  const x0 = Math.floor((kit.W - (w * cols + gap * (cols - 1))) / 2);
  answers.forEach((a, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const tone = flashIndex === i ? (flashOk ? 'green' : 'red') : 'paper';
    kit.button(`a${i}`, x0 + c * (w + gap), y + r * (h + gap), w, h, a, { tone, size, pressed: flashIndex === i });
  });
}
