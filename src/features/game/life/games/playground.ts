// ============================================================
// Ігри садочка й перерв (ADR-0239). Було чотири однакові «тапни
// вчасно»; тепер дев'ять різних за суттю: ритм, точність, пам'ять,
// реакція, рівновага, послідовність. Кожен день кості міняють ціль,
// швидкість і розклад — гра не повторюється слово в слово.
// ============================================================
import { intIn, pickOne, shuffled, type Rng } from '../sim/rng';
import { LENA_KID, OLYA, townsfolkLook, type Look } from '../render/people';
import { shade } from '../render/pixel';
import { sfx } from '../sound';
import { Flash, type GameContext, type Kit, type MiniGame } from './kit';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

abstract class Base implements MiniGame {
  abstract readonly title: string;
  abstract readonly hint: string;
  done = false;
  score = 0;
  protected t = 0;
  protected flash = new Flash();
  update(dt: number): void {
    this.t += dt;
    this.flash.update(dt);
    this.step(dt);
  }
  protected step(_dt: number): void {}
  abstract render(kit: Kit): void;
  abstract tap(x: number, y: number, kit: Kit): void;
  protected finish(score: number): void {
    if (this.done) return;
    this.score = clamp01(score);
    this.done = true;
    if (this.score >= 0.5) sfx.tada();
  }
}

function friendLooks(rng: Rng, n: number): Look[] {
  return Array.from({ length: n }, () => ({ ...townsfolkLook(rng), kid: true }));
}

// ------------------------------------------------------------
// 1. Скакалка: ритм, що прискорюється.
// ------------------------------------------------------------
class Rope extends Base {
  title = 'Скакалка';
  hint = 'Стрибай, коли мотузка внизу';
  private period: number;
  private jumps = 0;
  private misses = 0;
  private hop = 0;
  private readonly target: number;
  private readonly friends: Look[];
  constructor(private ctx: GameContext) {
    super();
    this.period = 1.25 - ctx.rng() * 0.15;
    this.target = 8 + intIn(ctx.rng, 0, 3);
    this.friends = friendLooks(ctx.rng, 2);
  }
  private phase(): number { return (this.t % this.period) / this.period; }
  protected override step(dt: number): void { this.hop = Math.max(0, this.hop - dt); }
  tap(): void {
    if (this.done) return;
    const p = this.phase();
    if (p < 0.13 || p > 0.86) {
      this.jumps += 1;
      this.hop = 0.32;
      this.period *= 0.965;
      this.flash.set(true);
      sfx.good();
    } else {
      this.misses += 1;
      this.flash.set(false);
      sfx.bad();
    }
    if (this.jumps >= this.target) this.finish(1 - this.misses * 0.06);
    else if (this.misses >= 6) this.finish(this.jumps / this.target);
  }
  render(kit: Kit): void {
    kit.backdrop('yard');
    const cx = kit.W / 2;
    const ground = Math.round(kit.H * 0.72);
    kit.person(this.friends[0]!, cx - 54, ground, 3, 2, 0);
    kit.person(this.friends[1]!, cx + 54, ground, 3, 1, 0);
    const p = this.phase();
    const ropeY = ground - 30 - Math.cos(p * Math.PI * 2) * 38;
    const behind = Math.sin(p * Math.PI * 2) < 0;
    const drawRope = () => {
      const g = kit.g;
      g.strokeStyle = '#f2c14e';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx - 46, ground - 30);
      g.quadraticCurveTo(cx, ropeY + (ropeY - (ground - 30)), cx + 46, ground - 30);
      g.stroke();
    };
    if (behind) drawRope();
    const hop = this.hop > 0 ? Math.sin((this.hop / 0.32) * Math.PI) * 18 : 0;
    kit.person(this.ctx.lena, cx, ground - hop, 3, 0, this.hop > 0 ? 1 : 0);
    if (!behind) drawRope();
    kit.text(`${this.jumps} / ${this.target}`, cx, ground + 28, { size: 14, color: this.flash.on ? (this.flash.ok ? '#bff2c9' : '#ffb3b3') : '#fff6e0' });
    kit.region('any', 0, 0, kit.W, kit.H);
  }
}

// ------------------------------------------------------------
// 2. Класики: влучити биткою й пройти клітинки по порядку.
// ------------------------------------------------------------
class Classics extends Base {
  title = 'Класики';
  hint = 'Кинь битку в потрібну клітинку, потім стрибай 1→8, оминаючи її';
  private phaseName: 'throw' | 'hop' = 'throw';
  private round = 0;
  private target: number;
  private stone = 0;
  private next = 1;
  private mistakes = 0;
  private throwsOk = 0;
  private marker = 0;
  private speed: number;
  constructor(private ctx: GameContext) {
    super();
    this.target = intIn(ctx.rng, 2, 7);
    this.speed = 1.4 + ctx.rng() * 0.8;
  }
  private cells(kit: Kit): { n: number; x: number; y: number; w: number; h: number }[] {
    const rows: number[][] = [[1], [2], [3], [4, 5], [6], [7, 8]];
    const cw = 36;
    const ch = 26;
    const base = kit.H - 40;
    const out: { n: number; x: number; y: number; w: number; h: number }[] = [];
    rows.forEach((row, r) => {
      const y = base - (r + 1) * (ch + 2);
      if (row.length === 1) out.push({ n: row[0]!, x: kit.W / 2 - cw / 2, y, w: cw, h: ch });
      else row.forEach((n, k) => out.push({ n, x: kit.W / 2 - cw + k * (cw + 2) - 1, y, w: cw, h: ch }));
    });
    return out;
  }
  protected override step(): void {
    if (this.phaseName === 'throw') this.marker = (Math.sin(this.t * this.speed) + 1) / 2;
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const cells = this.cells(kit);
    if (this.phaseName === 'throw') {
      // Маркер біжить по клітинках 1..8.
      this.stone = Math.min(8, Math.max(1, Math.round(1 + this.marker * 7)));
      const ok = this.stone === this.target;
      if (ok) { this.throwsOk += 1; sfx.good(); } else sfx.blip();
      this.flash.set(ok);
      this.phaseName = 'hop';
      this.next = this.stone === 1 ? 2 : 1;
      return;
    }
    const id = kit.hitAt(x, y);
    const cell = cells.find((c) => `c${c.n}` === id);
    if (!cell) return;
    if (cell.n === this.next) {
      sfx.good();
      this.next += 1;
      if (this.next === this.stone) this.next += 1;
      if (this.next > 8) {
        this.round += 1;
        if (this.round >= 2) {
          this.finish(0.25 * this.throwsOk + 0.5 - this.mistakes * 0.08);
          return;
        }
        this.phaseName = 'throw';
        this.target = intIn(this.ctx.rng, 2, 7);
        this.speed *= 1.25;
      }
    } else {
      this.mistakes += 1;
      this.flash.set(false);
      sfx.bad();
    }
  }
  render(kit: Kit): void {
    kit.backdrop('yard');
    const g = kit.g;
    kit.rect(kit.W / 2 - 50, 70, 100, kit.H - 100, '#a8a294');
    for (const c of this.cells(kit)) {
      const lit = this.phaseName === 'hop' && c.n === this.next;
      kit.rect(c.x, c.y, c.w, c.h, lit ? '#d8d0b8' : '#8a8478');
      g.strokeStyle = '#f8f4ec';
      g.lineWidth = 1;
      g.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      kit.text(String(c.n), c.x + c.w / 2, c.y + c.h / 2, { size: 11, color: c.n === this.target && this.phaseName === 'throw' ? '#f6c14e' : '#fff6e0' });
      if (this.phaseName === 'hop' && c.n === this.stone) kit.disc(c.x + c.w / 2 + 9, c.y + c.h / 2 + 5, 3, '#5a4a34');
      kit.region(`c${c.n}`, c.x, c.y, c.w, c.h);
    }
    const sky = this.cells(kit).at(-1)!;
    kit.text('Небо', kit.W / 2, sky.y - 12, { size: 10, color: '#d9f0fb' });
    if (this.phaseName === 'throw') {
      const cells = this.cells(kit);
      const n = Math.min(8, Math.max(1, Math.round(1 + this.marker * 7)));
      const c = cells.find((q) => q.n === n)!;
      kit.disc(c.x + c.w / 2, c.y + c.h / 2, 5, 'rgba(246,193,78,0.85)');
      kit.text(`Влуч у ${this.target}`, kit.W / 2, 56, { size: 12, color: '#f6c14e' });
      kit.region('any', 0, 0, kit.W, kit.H);
    } else {
      kit.text(`Стрибай на ${this.next}`, kit.W / 2, 56, { size: 12 });
    }
    kit.person(this.ctx.lena, kit.W / 2 - 64, kit.H - 30, 3, 2, Math.floor(this.t * 4) % 2);
  }
}

// ------------------------------------------------------------
// 3. Хованки: знайди друзів, кота не чіпай.
// ------------------------------------------------------------
class Hide extends Base {
  title = 'Хованки';
  hint = 'Торкнись друга, що визирнув. Кота не лякай!';
  private spots: { up: number; who: 'friend' | 'cat'; look: Look }[];
  private found = 0;
  private catHits = 0;
  private spawn = 0.8;
  private left = 20;
  constructor(private ctx: GameContext) {
    super();
    const looks = friendLooks(ctx.rng, 9);
    this.spots = looks.map((look) => ({ up: 0, who: 'friend' as const, look }));
  }
  protected override step(dt: number): void {
    if (this.done) return;
    this.left -= dt;
    if (this.left <= 0) { this.finish(this.found / 10 - this.catHits * 0.1); return; }
    this.spawn -= dt;
    for (const s of this.spots) s.up = Math.max(0, s.up - dt);
    if (this.spawn <= 0) {
      const free = this.spots.filter((s) => s.up <= 0);
      if (free.length) {
        const s = pickOne(this.ctx.rng, free);
        s.up = 0.8 + this.ctx.rng() * 0.5 - Math.min(0.3, this.found * 0.02);
        s.who = this.ctx.rng() < 0.27 ? 'cat' : 'friend';
      }
      this.spawn = 0.45 + this.ctx.rng() * 0.45;
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('b')) return;
    const s = this.spots[Number(id.slice(1))]!;
    if (s.up <= 0) { sfx.blip(); return; }
    s.up = 0;
    if (s.who === 'friend') { this.found += 1; this.flash.set(true); sfx.good(); } else { this.catHits += 1; this.flash.set(false); sfx.bad(); }
    if (this.found >= 10) this.finish(1 - this.catHits * 0.1);
  }
  render(kit: Kit): void {
    kit.backdrop('yard');
    const top = Math.round(kit.H * 0.42) + 20;
    const gw = (kit.W - 20) / 3;
    const gh = (kit.H - top - 20) / 3;
    this.spots.forEach((s, i) => {
      const cx = 10 + gw * (i % 3) + gw / 2;
      const cy = top + gh * Math.floor(i / 3) + gh / 2 + 10;
      if (s.up > 0) {
        const rise = Math.min(1, s.up * 4) * 12;
        if (s.who === 'friend') kit.person(s.look, cx, cy - rise + 10, 2);
        else {
          kit.disc(cx, cy - rise, 7, '#e8a25a');
          kit.rect(cx - 6, cy - rise - 9, 3, 4, '#e8a25a');
          kit.rect(cx + 3, cy - rise - 9, 3, 4, '#e8a25a');
          kit.rect(cx - 3, cy - rise - 2, 2, 2, '#2b2b33');
          kit.rect(cx + 2, cy - rise - 2, 2, 2, '#2b2b33');
        }
      }
      kit.disc(cx, cy + 6, 16, '#3f7a3a');
      kit.disc(cx - 7, cy + 2, 10, '#5fa648');
      kit.disc(cx + 8, cy + 4, 9, '#4f9a3e');
      kit.region(`b${i}`, cx - 20, cy - 24, 40, 44);
    });
    kit.text(`Знайдено: ${this.found}/10`, kit.W * 0.3, top - 12, { size: 11 });
    kit.text(`${Math.ceil(Math.max(0, this.left))} с`, kit.W * 0.78, top - 12, { size: 11, color: this.left < 5 ? '#ffb3b3' : '#fff6e0' });
  }
}

// ------------------------------------------------------------
// 4. М'яч у кошик: спершу кут, потім сила.
// ------------------------------------------------------------
class Ball extends Base {
  title = 'М\'яч у кошик';
  hint = 'Торкнись — зафіксуй кут; ще раз — силу';
  private stage: 'angle' | 'power' | 'fly' = 'angle';
  private angle = 45;
  private power = 0.5;
  private throws = 0;
  private hits = 0;
  private fly = 0;
  private hit = false;
  private dist: number;
  constructor(private ctx: GameContext) {
    super();
    this.dist = 0.55 + ctx.rng() * 0.3;
  }
  protected override step(dt: number): void {
    if (this.stage === 'angle') this.angle = 25 + (Math.sin(this.t * 2.2) + 1) * 25;
    if (this.stage === 'power') this.power = (Math.sin(this.t * 3.1) + 1) / 2;
    if (this.stage === 'fly') {
      this.fly += dt * 1.4;
      if (this.fly >= 1) {
        this.throws += 1;
        if (this.throws >= 5) { this.finish(this.hits / 5 + 0.1); return; }
        this.stage = 'angle';
        this.dist = 0.5 + this.ctx.rng() * 0.38;
      }
    }
  }
  /** Куди впаде м'яч, частка ширини поля. */
  private landing(): number {
    return Math.sin((2 * this.angle * Math.PI) / 180) * (0.3 + this.power * 0.75);
  }
  tap(): void {
    if (this.done) return;
    if (this.stage === 'angle') { this.stage = 'power'; sfx.blip(); return; }
    if (this.stage === 'power') {
      this.hit = Math.abs(this.landing() - this.dist) < 0.07;
      if (this.hit) { this.hits += 1; this.flash.set(true); sfx.good(); } else { this.flash.set(false); sfx.bad(); }
      this.stage = 'fly';
      this.fly = 0;
    }
  }
  render(kit: Kit): void {
    kit.backdrop('yard');
    const ground = Math.round(kit.H * 0.8);
    const x0 = 34;
    const span = kit.W - 60;
    const bx = x0 + this.dist * span;
    kit.rect(bx - 1, ground - 52, 3, 52, '#8a6a4a');
    kit.rect(bx - 14, ground - 54, 28, 4, '#e5471f');
    for (let k = 0; k < 6; k += 1) kit.rect(bx - 12 + k * 5, ground - 50, 1, 12, '#f4f4f7');
    kit.person(this.ctx.lena, x0, ground, 3, 2, 0);
    if (this.stage !== 'fly') {
      const a = (this.angle * Math.PI) / 180;
      for (let k = 0; k < 6; k += 1) kit.rect(x0 + 8 + Math.cos(a) * k * 6, ground - 30 - Math.sin(a) * k * 6, 2, 2, '#fff6e0');
    }
    if (this.stage === 'power') kit.bar(kit.W / 2 - 50, kit.H - 26, 100, 8, this.power, this.power > 0.4 && this.power < 0.8 ? '#7ed957' : '#f2c14e');
    if (this.stage === 'fly') {
      const target = x0 + this.landing() * span;
      const p = this.fly;
      const x = x0 + 8 + (target - x0 - 8) * p;
      const peak = 30 + this.power * 70;
      const y = ground - 30 - Math.sin(p * Math.PI) * peak + p * (this.hit ? -24 : 26);
      kit.disc(x, y, 4, '#e8763a');
      kit.rect(x - 4, y, 8, 1, '#a8501a');
    }
    kit.text(`Кидків ${this.throws}/5 · влучань ${this.hits}`, kit.W / 2, 56, { size: 11 });
    kit.region('any', 0, 0, kit.W, kit.H);
  }
}

// ------------------------------------------------------------
// 5. Пам'ять: пари іграшок.
// ------------------------------------------------------------
const MEMORY_ICONS = ['heart', 'star', 'sun', 'moon', 'cake', 'gift', 'bus', 'flower'] as const;

class Memory extends Base {
  title = 'Пам\'ять';
  hint = 'Знайди всі пари однакових картинок';
  private cards: { icon: (typeof MEMORY_ICONS)[number]; open: boolean; gone: boolean }[];
  private picked: number[] = [];
  private moves = 0;
  private wait = 0;
  constructor(ctx: GameContext) {
    super();
    const icons = shuffled(ctx.rng, MEMORY_ICONS).slice(0, ctx.level >= 3 ? 8 : 6);
    this.cards = shuffled(ctx.rng, [...icons, ...icons]).map((icon) => ({ icon, open: false, gone: false }));
  }
  protected override step(dt: number): void {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        const [a, b] = this.picked.map((i) => this.cards[i]!);
        if (a!.icon === b!.icon) { a!.gone = true; b!.gone = true; } else { a!.open = false; b!.open = false; }
        this.picked = [];
        if (this.cards.every((c) => c.gone)) this.finish(1 - Math.max(0, this.moves - this.cards.length / 2) / (this.cards.length * 1.2));
      }
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.wait > 0 || this.done) return;
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('m')) return;
    const i = Number(id.slice(1));
    const c = this.cards[i]!;
    if (c.open || c.gone) return;
    c.open = true;
    sfx.blip();
    this.picked.push(i);
    if (this.picked.length === 2) {
      this.moves += 1;
      const [a, b] = this.picked.map((k) => this.cards[k]!);
      if (a!.icon === b!.icon) { sfx.good(); this.flash.set(true); } else this.flash.set(false);
      this.wait = 0.6;
    }
  }
  render(kit: Kit): void {
    kit.backdrop('room');
    const cols = 4;
    const rows = Math.ceil(this.cards.length / cols);
    const cw = 40;
    const ch = 48;
    const x0 = (kit.W - cols * (cw + 6)) / 2 + 3;
    const y0 = Math.max(70, (kit.H - rows * (ch + 6)) / 2 + 10);
    this.cards.forEach((c, i) => {
      const x = x0 + (i % cols) * (cw + 6);
      const y = y0 + Math.floor(i / cols) * (ch + 6);
      if (c.gone) { kit.rect(x, y, cw, ch, 'rgba(0,0,0,0.08)'); return; }
      if (c.open) {
        kit.panel(x, y, cw, ch, 'paper');
        kit.icon(c.icon, x + cw / 2 - 8, y + ch / 2 - 7, 2);
      } else {
        kit.panel(x, y, cw, ch, 'wood');
        kit.icon('star', x + cw / 2 - 4, y + ch / 2 - 3);
      }
      kit.region(`m${i}`, x, y, cw, ch);
    });
    kit.text(`Ходів: ${this.moves}`, kit.W / 2, y0 - 14, { size: 11 });
  }
}

// ------------------------------------------------------------
// 6. Башта з кубиків.
// ------------------------------------------------------------
class Tower extends Base {
  title = 'Башта з кубиків';
  hint = 'Опускай кубик точно на попередній';
  private stack: { x: number; w: number; c: string }[] = [];
  private cur = { x: 0, w: 70, dir: 1 };
  private speed: number;
  private fallen = false;
  private readonly target = 10;
  private readonly colors = ['#e8576c', '#f6c14e', '#7ed957', '#5aa7e0', '#b088d6', '#f39c6b'];
  constructor(ctx: GameContext) {
    super();
    this.speed = 55 + ctx.rng() * 20;
    this.stack.push({ x: 85, w: 70, c: '#c98a4a' });
  }
  protected override step(dt: number): void {
    if (this.done) return;
    this.cur.x += this.cur.dir * this.speed * dt;
    if (this.cur.x < 10) { this.cur.x = 10; this.cur.dir = 1; }
    if (this.cur.x + this.cur.w > 230) { this.cur.x = 230 - this.cur.w; this.cur.dir = -1; }
  }
  tap(): void {
    if (this.done) return;
    const top = this.stack.at(-1)!;
    const left = Math.max(top.x, this.cur.x);
    const right = Math.min(top.x + top.w, this.cur.x + this.cur.w);
    if (right - left < 4) {
      this.fallen = true;
      sfx.bad();
      this.finish((this.stack.length - 1) / this.target);
      return;
    }
    const perfect = Math.abs(this.cur.x - top.x) < 3;
    const x = perfect ? top.x : left;
    const w = perfect ? top.w : right - left;
    this.stack.push({ x, w, c: this.colors[this.stack.length % this.colors.length]! });
    perfect ? sfx.good() : sfx.blip();
    this.flash.set(perfect);
    this.cur = { x: 10, w, dir: 1 };
    this.speed *= 1.06;
    if (this.stack.length - 1 >= this.target) this.finish(1);
  }
  render(kit: Kit): void {
    kit.backdrop('room');
    const scale = kit.W / 240;
    const base = kit.H - 30;
    const bh = 14;
    const view = Math.max(0, this.stack.length - 12) * bh;
    this.stack.forEach((b, i) => {
      const y = base - (i + 1) * bh + view;
      kit.rect(b.x * scale, y, b.w * scale, bh - 1, b.c);
      kit.rect(b.x * scale, y, b.w * scale, 2, shade(b.c, 0.3));
      kit.rect(b.x * scale, y + bh - 3, b.w * scale, 2, shade(b.c, -0.25));
      if (i > 0 && b.w > 14) kit.text('АБВГҐДЕЄЖЗ'[i % 10]!, (b.x + b.w / 2) * scale, y + bh / 2, { size: 8, color: '#ffffff', shadow: null });
    });
    if (!this.done) {
      const y = base - (this.stack.length + 1) * bh + view - 10;
      const c = this.colors[this.stack.length % this.colors.length]!;
      kit.rect(this.cur.x * scale, y, this.cur.w * scale, bh - 1, c);
      kit.rect(this.cur.x * scale, y, this.cur.w * scale, 2, shade(c, 0.3));
    }
    kit.text(this.fallen ? 'Ой, впала!' : `Поверхів: ${this.stack.length - 1}/${this.target}`, kit.W / 2, 56, { size: 12 });
    kit.region('any', 0, 0, kit.W, kit.H);
  }
}

// ------------------------------------------------------------
// 7. Метелики: лови метеликів, бджіл обходь.
// ------------------------------------------------------------
class Butterflies extends Base {
  title = 'Метелики';
  hint = 'Лови метеликів сачком. Бджілок не чіпай!';
  private bugs: { x: number; y: number; ph: number; sp: number; bee: boolean; c: string; caught: number }[] = [];
  private caught = 0;
  private stings = 0;
  private left = 20;
  constructor(private ctx: GameContext) {
    super();
    for (let k = 0; k < 7; k += 1) this.bugs.push(this.make());
  }
  private make() {
    const r = this.ctx.rng;
    return { x: 20 + r() * 200, y: 120 + r() * 200, ph: r() * 6, sp: 0.6 + r() * 0.8, bee: r() < 0.28, c: pickOne(r, ['#ff7aa8', '#f6c14e', '#7fb8e8', '#b088d6', '#f39c6b']), caught: 0 };
  }
  protected override step(dt: number): void {
    if (this.done) return;
    this.left -= dt;
    if (this.left <= 0) { this.finish(this.caught / 8 - this.stings * 0.12); return; }
    this.bugs.forEach((b, i) => {
      if (b.caught > 0) { b.caught -= dt; if (b.caught <= 0) this.bugs[i] = this.make(); return; }
      b.ph += dt * b.sp;
      b.x += Math.cos(b.ph * 1.7) * 30 * dt * b.sp;
      b.y += Math.sin(b.ph * 2.3) * 22 * dt * b.sp;
      b.x = Math.max(10, Math.min(230, b.x));
      b.y = Math.max(90, Math.min(360, b.y));
    });
  }
  tap(x: number, y: number, kit: Kit): void {
    const s = kit.W / 240;
    for (const b of this.bugs) {
      if (b.caught > 0) continue;
      if (Math.hypot(x - b.x * s, y - b.y * s * (kit.H / 400)) < 16) {
        b.caught = 0.4;
        if (b.bee) { this.stings += 1; this.flash.set(false); sfx.bad(); } else { this.caught += 1; this.flash.set(true); sfx.good(); }
        if (this.caught >= 8) this.finish(1 - this.stings * 0.12);
        return;
      }
    }
  }
  render(kit: Kit): void {
    kit.backdrop('yard');
    const s = kit.W / 240;
    const sy = kit.H / 400;
    for (let k = 0; k < 12; k += 1) {
      const fx = (k * 41) % kit.W;
      const fy = kit.H * 0.5 + ((k * 67) % (kit.H * 0.45));
      kit.disc(fx, fy, 2, ['#ff7aa8', '#f6d55c', '#f4f4f7'][k % 3]!);
    }
    for (const b of this.bugs) {
      const x = b.x * s;
      const y = b.y * s * sy;
      if (b.caught > 0) { if (b.bee) kit.text('Ай!', x, y - 6, { size: 9, color: '#ffb3b3' }); else kit.icon('heart', x - 3, y - 10); continue; }
      const flap = Math.floor(this.t * 10 + b.ph) % 2;
      if (b.bee) {
        kit.ellipse(x, y, 4, 3, '#f6c14e');
        kit.rect(x - 1, y - 3, 1, 6, '#2b2b33');
        kit.rect(x + 2, y - 3, 1, 6, '#2b2b33');
        kit.ellipse(x - 1, y - 4 - flap, 3, 2, 'rgba(255,255,255,0.8)');
      } else {
        kit.ellipse(x - 3, y - flap, 3, 4 - flap, b.c);
        kit.ellipse(x + 3, y - flap, 3, 4 - flap, b.c);
        kit.rect(x, y - 3, 1, 6, '#3a2a2a');
      }
    }
    kit.text(`Метеликів: ${this.caught}/8`, kit.W * 0.3, 56, { size: 11 });
    kit.text(`${Math.ceil(Math.max(0, this.left))} с`, kit.W * 0.8, 56, { size: 11 });
  }
}

// ------------------------------------------------------------
// 8. Сортер фігур: швидко знайти отвір.
// ------------------------------------------------------------
type Shape = 'circle' | 'square' | 'triangle' | 'star' | 'heart';
const SHAPE_NAME: Record<Shape, string> = { circle: 'круг', square: 'квадрат', triangle: 'трикутник', star: 'зірка', heart: 'серце' };

function drawShape(kit: Kit, shape: Shape, x: number, y: number, r: number, c: string): void {
  const g = kit.g;
  g.fillStyle = c;
  g.beginPath();
  if (shape === 'circle') g.arc(x, y, r, 0, Math.PI * 2);
  else if (shape === 'square') g.rect(x - r, y - r, r * 2, r * 2);
  else if (shape === 'triangle') { g.moveTo(x, y - r); g.lineTo(x + r, y + r); g.lineTo(x - r, y + r); }
  else if (shape === 'star') {
    for (let k = 0; k < 10; k += 1) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      k === 0 ? g.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr) : g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
  } else {
    g.moveTo(x, y + r);
    g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.4, x, y - r * 0.4);
    g.bezierCurveTo(x + r * 0.6, y - r * 1.4, x + r * 1.6, y - r * 0.2, x, y + r);
  }
  g.closePath();
  g.fill();
}

class Shapes extends Base {
  title = 'Фігури';
  hint = 'Знайди отвір для фігури';
  private round = 0;
  private right = 0;
  private shape: Shape = 'circle';
  private color = '#e8576c';
  private holes: Shape[] = [];
  private timer = 0;
  private limit: number;
  constructor(private ctx: GameContext) {
    super();
    this.limit = 3.4;
    this.next();
  }
  private next(): void {
    const all: Shape[] = ['circle', 'square', 'triangle', 'star', 'heart'];
    this.holes = shuffled(this.ctx.rng, all).slice(0, 4);
    this.shape = pickOne(this.ctx.rng, this.holes);
    this.color = pickOne(this.ctx.rng, ['#e8576c', '#f6c14e', '#7ed957', '#5aa7e0', '#b088d6']);
    this.timer = this.limit;
  }
  protected override step(dt: number): void {
    if (this.done) return;
    this.timer -= dt;
    if (this.timer <= 0) this.answer(false);
  }
  private answer(ok: boolean): void {
    if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
    this.flash.set(ok);
    this.round += 1;
    this.limit = Math.max(1.6, this.limit * 0.92);
    if (this.round >= 10) this.finish(this.right / 10);
    else this.next();
  }
  tap(x: number, y: number, kit: Kit): void {
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('h')) return;
    this.answer(this.holes[Number(id.slice(1))] === this.shape);
  }
  render(kit: Kit): void {
    kit.backdrop('room');
    kit.panel(kit.W / 2 - 40, 70, 80, 80, 'paper');
    drawShape(kit, this.shape, kit.W / 2, 110, 24, this.color);
    kit.text(SHAPE_NAME[this.shape], kit.W / 2, 162, { size: 11 });
    kit.bar(kit.W / 2 - 50, 176, 100, 6, this.timer / this.limit, this.timer < 1 ? '#e8776a' : '#7ed957');
    const top = Math.max(200, kit.H - 150);
    kit.panel(14, top - 6, kit.W - 28, 120, 'wood');
    this.holes.forEach((h, i) => {
      const x = 30 + (i % 2) * ((kit.W - 60) / 2) + (kit.W - 60) / 4 - 16;
      const y = top + 26 + Math.floor(i / 2) * 54;
      drawShape(kit, h, x, y, 16, '#3a2414');
      kit.region(`h${i}`, x - 26, y - 24, 52, 48);
    });
    kit.text(`${this.round}/10`, kit.W / 2, 56, { size: 11 });
  }
}

// ------------------------------------------------------------
// 9. Хоровод / музика: повтори мелодію квіточок.
// ------------------------------------------------------------
export class Simon extends Base {
  title = 'Хоровод';
  hint = 'Запам\'ятай, які квіточки заспівали, і повтори';
  private seq: number[] = [];
  private input = 0;
  private showing = 0;
  private showT = 0;
  private best = 0;
  private readonly max: number;
  private lit = -1;
  private litT = 0;
  constructor(private ctx: GameContext, music = false) {
    super();
    this.max = music ? Math.min(8, 4 + Math.floor(ctx.level / 2)) : 5;
    if (music) { this.title = 'Музика'; this.hint = 'Послухай мелодію і повтори її нотами'; }
    this.seq = [intIn(ctx.rng, 0, 3), intIn(ctx.rng, 0, 3)];
    this.showing = 1;
    this.showT = 0.6;
  }
  protected override step(dt: number): void {
    this.litT = Math.max(0, this.litT - dt);
    if (this.litT <= 0) this.lit = -1;
    if (this.showing > 0) {
      this.showT -= dt;
      if (this.showT <= 0) {
        const i = this.showing - 1;
        if (i < this.seq.length) {
          this.lit = this.seq[i]!;
          this.litT = 0.42;
          sfx.note(this.lit);
          this.showing += 1;
          this.showT = 0.62;
        } else {
          this.showing = 0;
          this.input = 0;
        }
      }
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.showing > 0 || this.done) return;
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('f')) return;
    const k = Number(id.slice(1));
    this.lit = k;
    this.litT = 0.25;
    sfx.note(k);
    if (k !== this.seq[this.input]) {
      this.flash.set(false);
      sfx.bad();
      this.finish(this.best / this.max);
      return;
    }
    this.input += 1;
    if (this.input >= this.seq.length) {
      this.best = this.seq.length;
      this.flash.set(true);
      if (this.seq.length >= this.max) { this.finish(1); return; }
      this.seq.push(intIn(this.ctx.rng, 0, 3));
      this.showing = 1;
      this.showT = 0.9;
    }
  }
  render(kit: Kit): void {
    kit.backdrop('yard');
    const colors = ['#e8576c', '#f6c14e', '#5aa7e0', '#b088d6'];
    const cy = kit.H * 0.62;
    colors.forEach((c, k) => {
      const x = kit.W * (0.2 + 0.2 * k);
      const on = this.lit === k;
      const r = on ? 17 : 14;
      for (let p = 0; p < 6; p += 1) {
        const a = (p * Math.PI) / 3;
        kit.disc(x + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, Math.round(r * 0.5), on ? shade(c, 0.35) : c);
      }
      kit.disc(x, cy, Math.round(r * 0.45), '#fff4b0');
      kit.rect(x - 1, cy + r, 2, 26, '#4f9a3e');
      kit.region(`f${k}`, x - 22, cy - 26, 44, 60);
    });
    kit.person(this.ctx.lena, kit.W / 2, cy - 40, 2, 0, this.showing ? 0 : Math.floor(this.t * 4) % 2);
    kit.text(this.showing ? 'Слухай…' : 'Тепер ти!', kit.W / 2, kit.H * 0.33, { size: 13, color: this.showing ? '#d9f0fb' : '#f6c14e' });
    kit.text(`Мелодія: ${this.seq.length}/${this.max}`, kit.W / 2, 56, { size: 11 });
  }
}

export const PLAYGROUND: Record<string, (ctx: GameContext) => MiniGame> = {
  rope: (c) => new Rope(c),
  classics: (c) => new Classics(c),
  hide: (c) => new Hide(c),
  ball: (c) => new Ball(c),
  memory: (c) => new Memory(c),
  tower: (c) => new Tower(c),
  butterflies: (c) => new Butterflies(c),
  shapes: (c) => new Shapes(c),
  simon: (c) => new Simon(c),
};

export const LENA_FOR_GAMES = { kid: LENA_KID, friend: OLYA };
