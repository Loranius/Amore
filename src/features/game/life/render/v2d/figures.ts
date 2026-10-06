// ============================================================
// 2D-стиль: варіанти людей на вибір власника (2026-10-06: «вигляд людей
// щось мені не дуже подобається, є інші варіанти?»). Один скелет —
// ноги, тулуб, руки, голова, зачіска — і різні пропорції та манера:
//
//   storybook — «книжкова ілюстрація»: справжніші пропорції (голова —
//               чверть зросту), шия, лікті, брови й носик;
//   round     — «кругленькі»: велика кругла голова, тулуб-дзвіночок,
//               лапки-рукавички, очі-крапки, м'яка обвідка в тон;
//   paper     — «паперова аплікація»: без обвідки, пласкі кольори з
//               однією тінню, кожна частина відкидає тінь, як вирізана.
//
// Зріст той самий, що в піксельному стилі (доросла — 31 px, дитина —
// 26 px), тож людина стоїть так само відносно дверей і меблів.
// ============================================================
import type { Dir, Look } from '../people';
import { INK, mix, shade, softShadow, type Ctx } from './kit';

export type FigureId = 'chibi' | 'storybook' | 'round' | 'paper';

export const FIGURE_NAMES: Record<FigureId, string> = {
  chibi: 'А · Теперішні',
  storybook: 'Б · Книжкова ілюстрація',
  round: 'В · Кругленькі',
  paper: 'Г · Паперова аплікація',
};

interface Rig {
  headR: number;
  headY: number;
  neck: number;
  torsoTop: number;
  hip: number;
  shoulderW: number;
  hipW: number;
  legW: number;
  armW: number;
  armLen: number;
  body: 'trapezoid' | 'bell';
  limbs: 'stick' | 'mitten';
  eyes: 'lash' | 'dot' | 'dash';
  line: 'ink' | 'tone' | 'none';
  nose: boolean;
  brows: boolean;
  paper: boolean;
}

function rigOf(id: Exclude<FigureId, 'chibi'>, kid: boolean): Rig {
  if (id === 'storybook') {
    return kid
      ? { headR: 4.9, headY: -20.6, neck: 1.2, torsoTop: -14.6, hip: -6.6, shoulderW: 3.2, hipW: 2.9, legW: 1.4, armW: 1.3, armLen: 7.6, body: 'trapezoid', limbs: 'stick', eyes: 'lash', line: 'ink', nose: true, brows: true, paper: false }
      : { headR: 4.5, headY: -26.4, neck: 1.8, torsoTop: -20.2, hip: -9.2, shoulderW: 3.8, hipW: 3.2, legW: 1.5, armW: 1.4, armLen: 10, body: 'trapezoid', limbs: 'stick', eyes: 'lash', line: 'ink', nose: true, brows: true, paper: false };
  }
  if (id === 'round') {
    return kid
      ? { headR: 7.2, headY: -17.6, neck: 0, torsoTop: -10.8, hip: -3.6, shoulderW: 3.4, hipW: 4.6, legW: 2.2, armW: 2.2, armLen: 4.2, body: 'bell', limbs: 'mitten', eyes: 'dot', line: 'tone', nose: false, brows: false, paper: false }
      : { headR: 7.6, headY: -22.2, neck: 0, torsoTop: -14.8, hip: -4.6, shoulderW: 3.8, hipW: 5.2, legW: 2.4, armW: 2.4, armLen: 5.4, body: 'bell', limbs: 'mitten', eyes: 'dot', line: 'tone', nose: false, brows: false, paper: false };
  }
  return kid
    ? { headR: 5.8, headY: -19.4, neck: 0.8, torsoTop: -13, hip: -5, shoulderW: 3.4, hipW: 3.4, legW: 1.8, armW: 1.8, armLen: 6.4, body: 'trapezoid', limbs: 'stick', eyes: 'dash', line: 'none', nose: false, brows: false, paper: true }
    : { headR: 5.8, headY: -24.6, neck: 1.2, torsoTop: -17.6, hip: -7, shoulderW: 4, hipW: 3.6, legW: 1.9, armW: 1.9, armLen: 8.2, body: 'trapezoid', limbs: 'stick', eyes: 'dash', line: 'none', nose: false, brows: false, paper: true };
}

/** Людина у варіанті `id`: `x, y` — точка між стопами. */
export function drawFigure(g: Ctx, id: Exclude<FigureId, 'chibi'>, l: Look, x: number, y: number, dir: Dir, moving: boolean, t: number, shadowOn = true): void {
  const R = rigOf(id, !!l.kid);
  if (shadowOn) softShadow(g, x, y, l.kid ? 5.5 : 6.5, 1.8, 0.3);
  const ph = moving ? t * 9.5 : 0;
  const bob = moving ? Math.abs(Math.sin(ph)) * 0.8 : Math.sin(t * 2) * 0.16;
  g.save();
  g.translate(x, y);
  if (dir === 1) g.scale(-1, 1);
  // Круглі з'єднання: гострий кут контуру інакше дає шип.
  g.lineJoin = 'round';
  if (R.paper) {
    const k = Math.abs(g.getTransform().a) || 1;
    g.shadowColor = 'rgba(40,24,40,0.3)';
    g.shadowOffsetX = 0.5 * k;
    g.shadowOffsetY = 0.5 * k;
    g.shadowBlur = 0;
  }
  const P = new Painter(g, R);
  if (dir === 0 || dir === 3) P.frontBack(l, dir === 3, ph, moving, bob, t);
  else P.side(l, ph, moving, bob, t);
  g.restore();
}

class Painter {
  constructor(private g: Ctx, private R: Rig) {}

  /** Обвідка для заливки за манерою варіанта. */
  private ol(fill: string): string | null {
    return this.R.line === 'ink' ? INK : this.R.line === 'tone' ? mix(shade(fill, -0.3), INK, 0.55) : null;
  }

  private lw(): number {
    return this.R.line === 'ink' ? 0.6 : 0.75;
  }

  private fill(fill: string | CanvasGradient, strokeFor: string): void {
    const g = this.g;
    g.fillStyle = fill;
    g.fill();
    const s = this.ol(strokeFor);
    if (s) {
      const sh = g.shadowColor;
      g.shadowColor = 'rgba(0,0,0,0)';
      g.strokeStyle = s;
      g.lineWidth = this.lw();
      g.stroke();
      g.shadowColor = sh;
    }
  }

  /** Заливка з тінню на правому боці — пласка манера «аплікації». */
  private tone(base: string, x0: number, x1: number): string | CanvasGradient {
    if (!this.R.paper) {
      const gr = this.g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, shade(base, 0.1));
      gr.addColorStop(1, shade(base, -0.1));
      return gr;
    }
    const gr = this.g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, base);
    gr.addColorStop(0.62, base);
    gr.addColorStop(0.62, shade(base, -0.14));
    gr.addColorStop(1, shade(base, -0.14));
    return gr;
  }

  private circle(x: number, y: number, r: number, fill: string, plain = false): void {
    this.g.beginPath();
    this.g.arc(x, y, r, 0, Math.PI * 2);
    if (plain) { this.g.fillStyle = fill; this.g.fill(); } else this.fill(fill, fill);
  }

  private oval(x: number, y: number, rx: number, ry: number, fill: string, rot = 0, plain = false): void {
    this.g.beginPath();
    this.g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    if (plain) { this.g.fillStyle = fill; this.g.fill(); } else this.fill(fill, fill);
  }

  private capsule(x: number, y0: number, y1: number, w: number, fill: string | CanvasGradient, strokeFor: string): void {
    const g = this.g;
    g.beginPath();
    g.roundRect(x - w / 2, Math.min(y0, y1), w, Math.abs(y1 - y0), w / 2);
    this.fill(fill, strokeFor);
  }

  private stroke(x0: number, y0: number, x1: number, y1: number, color: string, w: number): void {
    const g = this.g;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.stroke();
  }

  // ── Спереду й ззаду ──────────────────────────────────
  frontBack(l: Look, back: boolean, ph: number, moving: boolean, bob: number, t: number): void {
    const R = this.R;
    for (const s of [-1, 1] as const) {
      const lift = moving ? Math.max(0, Math.sin(ph + (s > 0 ? Math.PI : 0))) * 1.5 : 0;
      const lx = s * (R.body === 'bell' ? 2.4 : 1.8);
      const col = l.dress ? l.skin : l.bottom;
      if (R.limbs === 'mitten') this.oval(lx, -1.8 - lift, R.legW, 2.2, col);
      else this.capsule(lx, R.hip, -0.8 - lift, R.legW, col, col);
      this.oval(lx + s * 0.2, -0.8 - lift, R.legW * 0.95 + 0.2, 1.05, l.shoes);
    }
    const g = this.g;
    g.save();
    g.translate(0, -bob);
    if (!back && l.hairStyle === 'long') this.longBack(l);
    this.arms(l, ph, moving, true);
    this.torso(l, back);
    if (R.neck > 0) this.capsule(0, R.torsoTop + 0.6, R.torsoTop - R.neck - 0.6, 1.9, shade(l.skin, -0.06), l.skin);
    this.head(l, back, t);
    this.arms(l, ph, moving, false);
    g.restore();
  }

  private arms(l: Look, ph: number, moving: boolean, behind: boolean): void {
    // Спереду руки — обабіч тулуба; малюються після тулуба, щоб не ховались.
    if (behind) return;
    const R = this.R;
    for (const s of [-1, 1] as const) {
      const sw = moving ? Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.9 : 0;
      const sx = s * (R.shoulderW + (R.body === 'bell' ? -0.2 : 0.3));
      const sy = R.torsoTop + 1.3;
      if (R.limbs === 'mitten') {
        this.oval(sx + s * 1.2, sy + R.armLen * 0.6 + sw * 0.6, R.armW * 0.8, R.armLen * 0.55, l.top, s * 0.35);
        this.circle(sx + s * 1.6, sy + R.armLen + sw * 0.6, R.armW * 0.55, l.skin);
      } else {
        const ex = sx + s * 0.6;
        const ey = sy + R.armLen * 0.5 + sw * 0.4;
        const hx = sx + s * 0.4;
        const hy = sy + R.armLen + sw;
        const o = this.ol(l.top);
        if (o) { this.stroke(sx, sy, ex, ey, o, R.armW + 1); this.stroke(ex, ey, hx, hy, o, R.armW + 1); }
        this.stroke(sx, sy, ex, ey, l.top, R.armW);
        this.stroke(ex, ey, hx, hy, R.nose ? l.skin : l.top, R.armW * 0.9);
        this.circle(hx, hy + 0.3, R.armW * 0.55, l.skin);
      }
    }
  }

  private torso(l: Look, back: boolean): void {
    const R = this.R;
    const g = this.g;
    const top = R.torsoTop;
    if (R.body === 'bell') {
      const hem = R.hip + 0.6;
      g.beginPath();
      g.moveTo(-R.shoulderW, top + 1.6);
      g.quadraticCurveTo(-R.shoulderW, top, 0, top);
      g.quadraticCurveTo(R.shoulderW, top, R.shoulderW, top + 1.6);
      g.quadraticCurveTo(R.hipW + 0.6, hem - 2, R.hipW, hem);
      g.quadraticCurveTo(0, hem + 1.2, -R.hipW, hem);
      g.quadraticCurveTo(-R.hipW - 0.6, hem - 2, -R.shoulderW, top + 1.6);
      g.closePath();
      this.fill(this.tone(l.dress ? l.top : l.top, -R.hipW, R.hipW), l.top);
      if (!l.dress) {
        g.beginPath();
        g.moveTo(-R.hipW + 0.3, hem - 2.2);
        g.quadraticCurveTo(0, hem - 1.4, R.hipW - 0.3, hem - 2.2);
        g.lineTo(R.hipW, hem);
        g.quadraticCurveTo(0, hem + 1.2, -R.hipW, hem);
        g.closePath();
        this.fill(l.bottom, l.bottom);
      }
      if (l.accent && !back) this.circle(0, top + 2.2, 0.8, l.accent);
    } else if (l.dress) {
      const hem = R.hip + (R.nose ? 3.4 : 2.4);
      g.beginPath();
      g.moveTo(-R.shoulderW + 0.5, top);
      g.lineTo(R.shoulderW - 0.5, top);
      g.quadraticCurveTo(R.shoulderW, top + 0.4, R.shoulderW - 0.3, top + 2.6);
      g.lineTo(R.hipW * 0.75, R.hip - 3);
      g.lineTo(R.hipW + 2, hem);
      g.quadraticCurveTo(0, hem + 1.2, -R.hipW - 2, hem);
      g.lineTo(-R.hipW * 0.75, R.hip - 3);
      g.lineTo(-R.shoulderW + 0.3, top + 2.6);
      g.quadraticCurveTo(-R.shoulderW, top + 0.4, -R.shoulderW + 0.5, top);
      g.closePath();
      this.fill(this.tone(l.top, -R.hipW - 2, R.hipW + 2), l.top);
      this.stroke(-R.hipW * 0.75, R.hip - 3, R.hipW * 0.75, R.hip - 3, l.accent ?? shade(l.top, -0.25), 0.8);
      if (R.nose && !back) {
        // Комірець.
        g.beginPath();
        g.moveTo(-1.6, top);
        g.lineTo(0, top + 1.6);
        g.lineTo(1.6, top);
        g.strokeStyle = shade(l.top, 0.35);
        g.lineWidth = 0.6;
        g.stroke();
      }
    } else {
      // Штани й кофта.
      g.beginPath();
      g.roundRect(-R.hipW, R.hip - 2.4, R.hipW * 2, 3, 0.8);
      this.fill(l.bottom, l.bottom);
      g.beginPath();
      g.moveTo(-R.shoulderW + 0.5, top);
      g.lineTo(R.shoulderW - 0.5, top);
      g.quadraticCurveTo(R.shoulderW, top + 0.4, R.shoulderW - 0.2, top + 2.4);
      g.lineTo(R.hipW + 0.2, R.hip - 1.2);
      g.lineTo(-R.hipW - 0.2, R.hip - 1.2);
      g.lineTo(-R.shoulderW + 0.2, top + 2.4);
      g.quadraticCurveTo(-R.shoulderW, top + 0.4, -R.shoulderW + 0.5, top);
      g.closePath();
      this.fill(this.tone(l.top, -R.hipW, R.hipW), l.top);
      if (l.accent && !back) this.stroke(0, top + 0.8, 0, R.hip - 1.6, l.accent, 0.7);
    }
    if (l.hoodie) this.oval(0, top + (back ? 1 : 0), R.shoulderW - 0.6, 1.4, shade(l.top, -0.15));
    if (l.scarf) { g.beginPath(); g.roundRect(-R.shoulderW + 0.6, top - 0.6, (R.shoulderW - 0.6) * 2, 1.8, 0.9); this.fill(l.scarf, l.scarf); }
  }

  private longBack(l: Look): void {
    const R = this.R;
    const g = this.g;
    const r = R.headR;
    g.beginPath();
    g.moveTo(-r - 0.3, R.headY);
    g.quadraticCurveTo(-r - 1.4, R.headY + r + 3, -r + 0.4, R.torsoTop + (R.nose ? 7 : 4.5));
    g.lineTo(r - 0.4, R.torsoTop + (R.nose ? 7 : 4.5));
    g.quadraticCurveTo(r + 1.4, R.headY + r + 3, r + 0.3, R.headY);
    g.closePath();
    this.fill(shade(l.hair, -0.22), l.hair);
  }

  private head(l: Look, back: boolean, t: number): void {
    const R = this.R;
    const g = this.g;
    const r = R.headR;
    const cy = R.headY;
    const H = l.hair;
    const HL = shade(l.hair, 0.22);
    if (l.hairStyle === 'bun') this.circle(0, cy - r + 0.1, r * 0.4, H);
    if (l.hairStyle === 'ponytail' && back) {
      g.beginPath();
      g.moveTo(-1.4, cy - 1);
      g.quadraticCurveTo(-2.2, cy + r, 0, cy + r + 2.6);
      g.quadraticCurveTo(2.2, cy + r, 1.4, cy - 1);
      g.closePath();
      this.fill(H, H);
    }
    if (l.hairStyle === 'pigtails') {
      for (const s of [-1, 1]) {
        this.oval(s * (r + r * 0.18), cy + r * 0.3, r * 0.32, r * 0.55, H, s * 0.3);
        if (l.bow) this.oval(s * (r * 0.95), cy - r * 0.2, r * 0.3, r * 0.2, l.bow, s * 0.5);
      }
    }
    if (back) {
      this.circle(0, cy, r, H);
      this.oval(-r * 0.25, cy - r * 0.45, r * 0.45, r * 0.25, HL, -0.4, true);
      if (l.hairStyle === 'long') { g.beginPath(); g.roundRect(-r + 0.2, cy, (r - 0.2) * 2, r + 3, [0, 0, 3, 3]); this.fill(H, H); }
      return;
    }
    // Обличчя.
    this.circle(0, cy, r, l.skin);
    const ey = cy + r * 0.16;
    const ex = r * (R.eyes === 'dot' ? 0.42 : 0.38);
    const blink = Math.sin(t * 0.9) > 0.985;
    for (const s of [-1, 1]) {
      const x = s * ex;
      if (blink || R.eyes === 'dash') {
        g.beginPath();
        if (R.eyes === 'dash' && !blink) g.arc(x, ey + 0.2, r * 0.13, Math.PI * 1.1, Math.PI * 1.9);
        else { g.moveTo(x - r * 0.12, ey); g.lineTo(x + r * 0.12, ey); }
        g.strokeStyle = shade(l.eyes, -0.45);
        g.lineWidth = 0.6;
        g.lineCap = 'round';
        g.stroke();
      } else if (R.eyes === 'dot') {
        this.oval(x, ey, r * 0.1, r * 0.13, '#2a2026', 0, true);
        this.circle(x - r * 0.03, ey - r * 0.05, r * 0.04, '#ffffff', true);
      } else {
        this.oval(x, ey, r * 0.13, r * 0.17, shade(l.eyes, -0.35), 0, true);
        this.circle(x - r * 0.04, ey - r * 0.06, r * 0.05, '#ffffff', true);
        // Вії.
        this.stroke(x + s * r * 0.12, ey - r * 0.12, x + s * r * 0.22, ey - r * 0.2, '#2a2026', 0.4);
      }
      if (R.brows) this.stroke(x - r * 0.12, ey - r * 0.36, x + r * 0.12, ey - r * 0.38, shade(l.hair, -0.25), 0.45);
    }
    this.oval(-r * 0.55, ey + r * 0.3, r * 0.17, r * 0.09, 'rgba(240,130,130,0.55)', 0, true);
    this.oval(r * 0.55, ey + r * 0.3, r * 0.17, r * 0.09, 'rgba(240,130,130,0.55)', 0, true);
    if (R.nose) this.stroke(0, ey + r * 0.12, -r * 0.06, ey + r * 0.26, shade(l.skin, -0.3), 0.45);
    g.beginPath();
    g.arc(0, ey + r * 0.34, r * (R.eyes === 'dot' ? 0.1 : 0.13), 0.25, Math.PI - 0.25);
    g.strokeStyle = '#a8504e';
    g.lineWidth = 0.45;
    g.stroke();
    if (l.beard) { g.beginPath(); g.arc(0, cy + r * 0.2, r * 0.9, 0.25, Math.PI - 0.25); g.closePath(); g.fillStyle = shade(l.hair, -0.2); g.fill(); }
    if (l.glasses) for (const s of [-1, 1]) { g.beginPath(); g.arc(s * ex, ey, r * 0.24, 0, Math.PI * 2); g.strokeStyle = '#3a2a2a'; g.lineWidth = 0.4; g.stroke(); }
    // Волосся спереду: шапочка з чубчиком.
    g.beginPath();
    g.arc(0, cy, r + 0.25, Math.PI * 1.02, Math.PI * 1.98);
    if (l.hairStyle === 'short' || l.hairStyle === 'spiky') {
      g.quadraticCurveTo(r * 0.3, cy - r * 0.35, -r * 0.2, cy - r * 0.25);
      g.quadraticCurveTo(-r * 0.7, cy - r * 0.2, -r - 0.25, cy - 0.3);
    } else {
      g.quadraticCurveTo(r * 0.55, cy - r * 0.12, r * 0.22, cy - r * 0.36);
      g.quadraticCurveTo(0, cy - r * 0.08, -r * 0.28, cy - r * 0.38);
      g.quadraticCurveTo(-r * 0.7, cy - r * 0.08, -r - 0.25, cy - 0.3);
    }
    g.closePath();
    this.fill(H, H);
    this.oval(-r * 0.3, cy - r * 0.62, r * 0.4, r * 0.18, HL, -0.25, true);
    if (l.hairStyle === 'long' || l.hairStyle === 'bob') {
      const len = l.hairStyle === 'long' ? r * 1.35 : r * 0.85;
      for (const s of [-1, 1]) {
        g.beginPath();
        g.moveTo(s * (r + 0.25), cy - 0.5);
        g.quadraticCurveTo(s * (r + r * 0.18), cy + len * 0.6, s * (r - r * 0.1), cy + len);
        g.lineTo(s * (r - r * 0.3), cy + len * 0.6);
        g.quadraticCurveTo(s * (r - r * 0.25), cy + 1, s * (r - r * 0.22), cy - 1);
        g.closePath();
        this.fill(H, H);
      }
    }
    if (l.hairStyle === 'ponytail') this.oval(r + 0.4, cy + 0.8, r * 0.18, r * 0.4, H, 0.3);
    if (l.hairStyle === 'spiky') for (const sx of [-0.45, 0, 0.45]) { g.beginPath(); g.moveTo(sx * r - r * 0.22, cy - r + 0.8); g.lineTo(sx * r + r * 0.06, cy - r - r * 0.3); g.lineTo(sx * r + r * 0.22, cy - r + 0.8); g.closePath(); this.fill(H, H); }
  }

  // ── Збоку ────────────────────────────────────────────
  side(l: Look, ph: number, moving: boolean, bob: number, t: number): void {
    const R = this.R;
    const g = this.g;
    const swing = moving ? Math.sin(ph) * 0.55 : 0;
    const legCol = l.dress ? l.skin : l.bottom;
    const leg = (a: number, far: boolean) => {
      g.save();
      g.translate(0, R.hip);
      g.rotate(a);
      const len = -R.hip;
      if (R.limbs === 'mitten') this.oval(0, len * 0.55, R.legW, len * 0.55, far ? shade(legCol, -0.15) : legCol);
      else this.capsule(0, -0.4, len - 0.6, R.legW, far ? shade(legCol, -0.15) : legCol, legCol);
      this.oval(0.8, len - 0.7, R.legW * 0.95 + 0.4, 1.05, far ? shade(l.shoes, -0.2) : l.shoes);
      g.restore();
    };
    const arm = (a: number, far: boolean) => {
      g.save();
      g.translate(0.2, R.torsoTop + 1.4);
      g.rotate(a);
      const c = far ? shade(l.top, -0.15) : l.top;
      if (R.limbs === 'mitten') {
        this.oval(0, R.armLen * 0.55, R.armW * 0.8, R.armLen * 0.6, c);
        this.circle(0, R.armLen + 0.4, R.armW * 0.55, l.skin);
      } else {
        const o = this.ol(c);
        if (o) this.stroke(0, 0, 0.3, R.armLen, o, R.armW + 1);
        this.stroke(0, 0, 0.3, R.armLen * 0.55, c, R.armW);
        this.stroke(0.3, R.armLen * 0.5, 0.3, R.armLen, R.nose ? l.skin : c, R.armW * 0.9);
        this.circle(0.3, R.armLen + 0.4, R.armW * 0.55, l.skin);
      }
      g.restore();
    };
    leg(-swing, true);
    g.save();
    g.translate(0, -bob);
    arm(swing * 0.9, true);
    if (l.hairStyle === 'long') {
      g.beginPath();
      g.moveTo(-0.8, R.headY);
      g.quadraticCurveTo(-R.headR - 2, R.headY + 4, -2.4, R.torsoTop + (R.nose ? 7 : 4.5));
      g.lineTo(1, R.torsoTop + 2);
      g.closePath();
      this.fill(shade(l.hair, -0.22), l.hair);
    }
    g.restore();
    leg(swing, false);
    g.save();
    g.translate(0, -bob);
    const top = R.torsoTop;
    const half = R.body === 'bell' ? R.hipW * 0.85 : R.shoulderW * 0.72;
    if (R.body === 'bell') {
      g.beginPath();
      g.moveTo(-half * 0.7, top + 0.4);
      g.quadraticCurveTo(0, top - 0.6, half * 0.7, top + 0.4);
      g.quadraticCurveTo(half + 0.6, R.hip, half, R.hip + 0.6);
      g.lineTo(-half, R.hip + 0.6);
      g.quadraticCurveTo(-half - 0.6, R.hip, -half * 0.7, top + 0.4);
      g.closePath();
      this.fill(this.tone(l.top, -half, half), l.top);
    } else if (l.dress) {
      const hem = R.hip + (R.nose ? 3.4 : 2.4);
      g.beginPath();
      g.moveTo(-half, top);
      g.lineTo(half, top);
      g.lineTo(half + 1.6, hem);
      g.quadraticCurveTo(0, hem + 0.8, -half - 1.4, hem);
      g.closePath();
      this.fill(this.tone(l.top, -half, half), l.top);
      this.stroke(-half, R.hip - 3, half + 0.2, R.hip - 3, l.accent ?? shade(l.top, -0.25), 0.8);
    } else {
      g.beginPath();
      g.roundRect(-half, R.hip - 2.4, half * 2, 3, 0.8);
      this.fill(l.bottom, l.bottom);
      g.beginPath();
      g.roundRect(-half, top, half * 2.05, R.hip - top - 1.2, [2, 2, 0.8, 0.8]);
      this.fill(this.tone(l.top, -half, half), l.top);
    }
    if (R.neck > 0) this.capsule(0, top + 0.6, top - R.neck - 0.6, 1.9, shade(l.skin, -0.06), l.skin);
    this.headSide(l, t);
    arm(-swing * 0.9, false);
    g.restore();
  }

  private headSide(l: Look, t: number): void {
    const R = this.R;
    const g = this.g;
    const r = R.headR;
    const cy = R.headY;
    const H = l.hair;
    if (l.hairStyle === 'bun') this.circle(-r * 0.4, cy - r * 0.8, r * 0.4, H);
    if (l.hairStyle === 'ponytail') {
      g.beginPath();
      g.moveTo(-r + 1, cy - r * 0.3);
      g.quadraticCurveTo(-r - r * 0.6, cy + r * 0.2, -r - r * 0.25, cy + r * 1.1);
      g.quadraticCurveTo(-r + 0.4, cy + r * 0.4, -r + 2, cy);
      g.closePath();
      this.fill(H, H);
    }
    if (l.hairStyle === 'pigtails') {
      this.oval(-r * 1.08, cy + r * 0.3, r * 0.32, r * 0.55, H, 0.3);
      if (l.bow) this.oval(-r * 0.95, cy - r * 0.2, r * 0.3, r * 0.2, l.bow, 0.5);
    }
    this.circle(0, cy, r, l.skin);
    if (R.nose) this.circle(r - 0.1, cy + r * 0.22, r * 0.12, l.skin);
    this.oval(r * 0.42, cy + r * 0.38, r * 0.18, r * 0.09, 'rgba(240,130,130,0.55)', 0, true);
    const ex = r * 0.48;
    const ey = cy + r * 0.12;
    const blink = Math.sin(t * 0.9) > 0.985;
    if (blink || R.eyes === 'dash') {
      g.beginPath();
      if (R.eyes === 'dash' && !blink) g.arc(ex, ey + 0.2, r * 0.13, Math.PI * 1.1, Math.PI * 1.9);
      else { g.moveTo(ex - r * 0.12, ey); g.lineTo(ex + r * 0.12, ey); }
      g.strokeStyle = shade(l.eyes, -0.45);
      g.lineWidth = 0.6;
      g.stroke();
    } else if (R.eyes === 'dot') {
      this.oval(ex, ey, r * 0.1, r * 0.13, '#2a2026', 0, true);
    } else {
      this.oval(ex, ey, r * 0.12, r * 0.17, shade(l.eyes, -0.35), 0, true);
      this.circle(ex - r * 0.03, ey - r * 0.06, r * 0.05, '#ffffff', true);
      this.stroke(ex + r * 0.1, ey - r * 0.14, ex + r * 0.2, ey - r * 0.22, '#2a2026', 0.4);
    }
    if (R.brows) this.stroke(ex - r * 0.12, ey - r * 0.36, ex + r * 0.12, ey - r * 0.38, shade(l.hair, -0.25), 0.45);
    g.beginPath();
    g.arc(r * 0.62, cy + r * 0.5, r * 0.11, 0.3, Math.PI * 0.8);
    g.strokeStyle = '#a8504e';
    g.lineWidth = 0.4;
    g.stroke();
    if (l.beard) { g.beginPath(); g.arc(r * 0.1, cy + r * 0.25, r * 0.85, 0.05, Math.PI * 0.75); g.fillStyle = shade(l.hair, -0.2); g.fill(); }
    g.beginPath();
    g.arc(0, cy, r + 0.25, Math.PI * 0.62, Math.PI * 1.92);
    g.quadraticCurveTo(r * 0.5, cy - r * 0.2, r * 0.05, cy - r * 0.34);
    g.quadraticCurveTo(-r * 0.4, cy - 0.2, -r * 0.5, cy + r * 0.62);
    g.closePath();
    this.fill(H, H);
    this.oval(-r * 0.2, cy - r * 0.6, r * 0.4, r * 0.18, shade(H, 0.22), -0.2, true);
    if (l.hairStyle === 'spiky') for (const sx of [-0.45, 0]) { g.beginPath(); g.moveTo(sx * r - r * 0.22, cy - r + 0.8); g.lineTo(sx * r, cy - r - r * 0.3); g.lineTo(sx * r + r * 0.22, cy - r + 0.8); g.closePath(); this.fill(H, H); }
  }
}
