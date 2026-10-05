// ============================================================
// Уроки й пари «Дєвочка в городі» (ADR-0239). Предмет — це механіка, а не
// лише інший текст: математика — швидкий вибір, мова — скласти речення
// й знайти букву, природознавство — розкласти по кошиках, географія —
// знайти місто на мапі України, історія — стрічка часу, малювання —
// перемалювати візерунок, інформатика — програма для робота,
// фізкультура — забіг і стрибок, музика — мелодія.
// ============================================================
import { intIn, pickOne, sample, shuffled } from '../sim/rng';
import { townsfolkLook, type Look } from '../render/people';
import { sfx } from '../sound';
import {
  EVENTS,
  UNI_EVENTS,
  PASSAGES,
  SORT_SETS,
  UA_CITIES,
  UA_OUTLINE,
  englishQuestion,
  factQuestion,
  mathQuestion,
  sentenceTask,
  spellingQuestion,
  type Question,
} from './banks';
import { Flash, answerGrid, type Backdrop, type GameContext, type Kit, type MiniGame } from './kit';
import { Simon } from './playground';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

abstract class Lesson implements MiniGame {
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

/** Учитель біля дошки й однокласники за партами. */
function classroom(kit: Kit, backdrop: Backdrop, board: string[], boardTop = 40): number {
  kit.backdrop(backdrop);
  const bw = Math.min(kit.W - 24, 220);
  const bx = (kit.W - bw) / 2;
  const lines = board.flatMap((l) => kit.wrap(l, bw - 16, 11));
  const bh = Math.max(46, 18 + lines.length * 16);
  kit.panel(bx, boardTop, bw, bh, 'chalk');
  lines.forEach((l, i) => kit.text(l, kit.W / 2, boardTop + 16 + i * 16, { size: 11, color: '#eef4ea', shadow: null }));
  return boardTop + bh + 8;
}

// ------------------------------------------------------------
// Вікторина: питання з банку, 4 кнопки, таймер на бонус.
// ------------------------------------------------------------
class Quiz extends Lesson {
  private n = 0;
  private right = 0;
  private q: Question;
  private picked = -1;
  private wait = 0;
  private timer = 0;
  constructor(readonly title: string, readonly hint: string, _ctx: GameContext, private source: () => Question, private count: number, private backdrop: Backdrop = 'classroom', private limit = 9) {
    super();
    this.q = source();
    this.timer = limit;
  }
  protected override step(dt: number): void {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.n += 1;
        if (this.n >= this.count) { this.finish(this.right / this.count); return; }
        this.q = this.source();
        this.picked = -1;
        this.timer = this.limit;
      }
      return;
    }
    this.timer = Math.max(0, this.timer - dt);
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.wait > 0 || this.done) return;
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('a')) return;
    this.picked = Number(id.slice(1));
    const ok = this.picked === this.q.correct;
    // Швидка правильна відповідь — повний бал; повільна — трохи менше.
    if (ok) { this.right += this.timer > 0 ? 1 : 0.7; sfx.good(); } else sfx.bad();
    this.flash.set(ok);
    this.wait = ok ? 0.45 : 0.9;
  }
  render(kit: Kit): void {
    let y = classroom(kit, this.backdrop, [this.q.q]);
    if (this.q.picture) {
      const { icon, count } = this.q.picture;
      const iconName = icon === 'apple' ? 'heart' : icon === 'ball' ? 'sun' : icon;
      const per = 5;
      for (let k = 0; k < count; k += 1) kit.icon(iconName, kit.W / 2 - per * 10 + (k % per) * 20 + 2, y + Math.floor(k / per) * 18, 2);
      y += Math.ceil(count / per) * 18 + 8;
    }
    kit.bar(kit.W / 2 - 60, y, 120, 4, this.timer / this.limit, this.timer > 2 ? '#7ed957' : '#e8776a');
    const answersY = Math.min(y + 36, kit.H - 80);
    answerGrid(kit, this.q.answers, answersY, this.picked, this.picked === this.q.correct);
    if (this.picked >= 0 && this.picked !== this.q.correct) kit.text(`Правильно: ${this.q.answers[this.q.correct]}`, kit.W / 2, answersY - 12, { size: 10, color: '#ffe0a0' });
    kit.text(`${Math.min(this.n + 1, this.count)}/${this.count}`, kit.W - 18, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
// Читання: текст на аркуші, одне питання — але уважне.
// ------------------------------------------------------------
class Reading extends Lesson {
  title = 'Читання';
  hint = 'Прочитай і дай відповідь';
  private passages: typeof PASSAGES[number][];
  private k = 0;
  private right = 0;
  private picked = -1;
  private wait = 0;
  constructor(ctx: GameContext) {
    super();
    const pool = PASSAGES.filter((p) => p.minLevel <= Math.max(1, ctx.level));
    this.passages = sample(ctx.rng, pool, 2);
  }
  protected override step(dt: number): void {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.k += 1;
        this.picked = -1;
        if (this.k >= this.passages.length) this.finish(this.right / this.passages.length);
      }
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.wait > 0 || this.done) return;
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('a')) return;
    const p = this.passages[this.k]!;
    this.picked = Number(id.slice(1));
    const ok = this.picked === p.correct;
    if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
    this.flash.set(ok);
    this.wait = 1;
  }
  render(kit: Kit): void {
    kit.backdrop('classroom');
    const p = this.passages[Math.min(this.k, this.passages.length - 1)]!;
    const lines = kit.wrap(p.text, kit.W - 44, 10);
    const h = lines.length * 14 + 20;
    kit.panel(14, 66, kit.W - 28, h, 'paper');
    lines.forEach((l, i) => kit.text(l, 24, 80 + i * 14, { size: 10, color: '#4a2a14', align: 'left', shadow: null, weight: 700 }));
    kit.text(p.q, kit.W / 2, 66 + h + 16, { size: 11, color: '#f6c14e' });
    const answers = p.answers;
    answers.forEach((a, i) => kit.button(`a${i}`, 20, 66 + h + 32 + i * 32, kit.W - 40, 26, a, { tone: this.picked === i ? (i === p.correct ? 'green' : 'red') : 'paper' }));
  }
}

// ------------------------------------------------------------
// Українська: склади речення зі слів.
// ------------------------------------------------------------
class Sentence extends Lesson {
  title = 'Українська мова';
  hint = 'Торкайся слів по порядку, щоб скласти речення';
  private task: { words: string[]; order: number[] };
  private built: number[] = [];
  private mistakes = 0;
  private round = 0;
  private spelling: Question | null = null;
  private spellPicked = -1;
  private spellRight = 0;
  private wait = 0;
  constructor(private ctx: GameContext) {
    super();
    this.task = sentenceTask(ctx.rng, ctx.level);
  }
  protected override step(dt: number): void {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) this.advance();
    }
  }
  private advance(): void {
    this.round += 1;
    if (this.round >= 4) { this.finish((3 - Math.min(3, this.mistakes * 0.5) + this.spellRight) / 4); return; }
    if (this.round === 2 || this.round === 3) {
      this.spelling = spellingQuestion(this.ctx.rng);
      this.spellPicked = -1;
    } else {
      this.spelling = null;
      this.task = sentenceTask(this.ctx.rng, this.ctx.level);
      this.built = [];
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.wait > 0 || this.done) return;
    const id = kit.hitAt(x, y);
    if (!id) return;
    if (this.spelling) {
      if (!id.startsWith('a')) return;
      this.spellPicked = Number(id.slice(1));
      const ok = this.spellPicked === this.spelling.correct;
      if (ok) { this.spellRight += 1; sfx.good(); } else sfx.bad();
      this.flash.set(ok);
      this.wait = 0.8;
      return;
    }
    if (!id.startsWith('w')) return;
    const wi = Number(id.slice(1));
    if (this.built.includes(wi)) return;
    // Слово правильне, якщо воно — наступне за змістом (дублікати рахуються однаково).
    const expected = this.task.words[this.built.length];
    if (this.task.words[wi] === expected) {
      this.built.push(wi);
      sfx.blip();
      if (this.built.length === this.task.words.length) { this.flash.set(true); sfx.good(); this.wait = 0.8; }
    } else {
      this.mistakes += 1;
      this.flash.set(false);
      sfx.bad();
    }
  }
  render(kit: Kit): void {
    if (this.spelling) {
      const y = classroom(kit, 'classroom', [this.spelling.q]);
      answerGrid(kit, this.spelling.answers, Math.max(y + 30, kit.H - 90), this.spellPicked, this.spellPicked === this.spelling.correct, 14);
      return;
    }
    const sentence = this.built.map((i) => this.task.words[i]).join(' ');
    const y = classroom(kit, 'classroom', [sentence ? `${sentence}${this.built.length === this.task.words.length ? '.' : ' …'}` : '…']);
    // Слова — картками, що лежать на парті.
    let cx = 14;
    let cy = Math.max(y + 24, kit.H * 0.55);
    this.task.order.forEach((wi) => {
      const w = this.task.words[wi]!;
      const width = Math.max(30, w.length * 7 + 14);
      if (cx + width > kit.W - 12) { cx = 14; cy += 34; }
      if (!this.built.includes(wi)) kit.button(`w${wi}`, cx, cy, width, 26, w, { tone: 'paper', size: 10 });
      cx += width + 6;
    });
    kit.text(`Речення ${this.round < 2 ? this.round + 1 : 2}/2 · потім букви`, kit.W / 2, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
// Сортування у два кошики.
// ------------------------------------------------------------
class Sort extends Lesson {
  readonly title: string;
  hint = 'Торкнись кошика, куди належить слово';
  private items: [string, 'L' | 'R'][];
  private k = 0;
  private right = 0;
  private set: typeof SORT_SETS[number];
  private last: 'L' | 'R' | null = null;
  constructor(private ctx: GameContext, title: string, minLevel: number, onlyLevel?: number) {
    super();
    const pool = SORT_SETS.filter((s) => (onlyLevel !== undefined ? s.minLevel === onlyLevel : s.minLevel <= minLevel));
    this.set = pickOne(ctx.rng, pool.length ? pool : SORT_SETS);
    this.items = shuffled(ctx.rng, this.set.items).slice(0, 8);
    this.title = title;
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (id !== 'L' && id !== 'R') return;
    const ok = this.items[this.k]![1] === id;
    this.last = id;
    if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
    this.flash.set(ok);
    this.k += 1;
    if (this.k >= this.items.length) this.finish(this.right / this.items.length);
  }
  render(kit: Kit): void {
    kit.backdrop(this.ctx.level >= 12 ? 'lecture' : 'classroom');
    kit.text(this.set.title, kit.W / 2, 70, { size: 13, color: '#f6c14e' });
    const item = this.items[Math.min(this.k, this.items.length - 1)]!;
    const drop = this.flash.on ? (this.last === 'L' ? -1 : 1) * (0.35 - 0) * 60 : 0;
    kit.panel(kit.W / 2 - 64 + drop, 92, 128, 40, 'paper');
    kit.text(item[0], kit.W / 2 + drop, 112, { size: 12, color: '#4a2a14', shadow: null });
    const by = Math.max(170, kit.H - 120);
    for (const side of ['L', 'R'] as const) {
      const x = side === 'L' ? 14 : kit.W / 2 + 6;
      const w = kit.W / 2 - 20;
      // Кошик.
      kit.rect(x, by + 20, w, 60, '#a8784a');
      for (let k = 0; k < w; k += 6) kit.rect(x + k, by + 20, 2, 60, '#8a5a34');
      kit.rect(x - 2, by + 16, w + 4, 6, '#c08a52');
      kit.text(side === 'L' ? this.set.left : this.set.right, x + w / 2, by + 50, { size: 11 });
      kit.region(side, x, by, w, 84);
    }
    kit.text(`${Math.min(this.k + 1, this.items.length)}/${this.items.length}`, kit.W - 18, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
// Географія: де це місто?
// ------------------------------------------------------------
class MapQuiz extends Lesson {
  title = 'Географія';
  hint = 'Торкнись мапи там, де це місто';
  private cities: typeof UA_CITIES[number][];
  private k = 0;
  private points = 0;
  private lastTap: [number, number] | null = null;
  private wait = 0;
  constructor(ctx: GameContext) {
    super();
    const pool = ctx.level < 7 ? UA_CITIES.slice(0, 10) : UA_CITIES;
    this.cities = sample(ctx.rng, pool, 5);
  }
  private box(kit: Kit) {
    const w = kit.W - 20;
    const h = Math.round(w * 0.66);
    return { x: 10, y: Math.max(80, (kit.H - h) / 2 + 10), w, h };
  }
  protected override step(dt: number): void {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.k += 1;
        this.lastTap = null;
        if (this.k >= this.cities.length) this.finish(this.points / this.cities.length);
      }
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.wait > 0 || this.done) return;
    const b = this.box(kit);
    if (x < b.x || y < b.y || x > b.x + b.w || y > b.y + b.h) return;
    const [, cx, cy] = this.cities[this.k]!;
    const d = Math.hypot((x - b.x) / b.w - cx, ((y - b.y) / b.h - cy) * 0.66);
    const pts = d < 0.05 ? 1 : d < 0.1 ? 0.7 : d < 0.18 ? 0.35 : 0;
    this.points += pts;
    this.lastTap = [x, y];
    pts >= 0.7 ? sfx.good() : pts > 0 ? sfx.blip() : sfx.bad();
    this.flash.set(pts >= 0.7);
    this.wait = 1.1;
  }
  render(kit: Kit): void {
    kit.backdrop('classroom');
    const b = this.box(kit);
    const g = kit.g;
    kit.panel(b.x - 4, b.y - 4, b.w + 8, b.h + 8, 'paper');
    g.fillStyle = '#9fd0a0';
    g.beginPath();
    UA_OUTLINE.forEach(([px, py], i) => (i ? g.lineTo(b.x + px * b.w, b.y + py * b.h) : g.moveTo(b.x + px * b.w, b.y + py * b.h)));
    g.closePath();
    g.fill();
    g.strokeStyle = '#4f8a5a';
    g.lineWidth = 1;
    g.stroke();
    // Дніпро — для орієнтиру.
    g.strokeStyle = '#5a9ad8';
    g.lineWidth = 1.5;
    g.beginPath();
    [[0.5, 0.05], [0.49, 0.2], [0.55, 0.38], [0.66, 0.45], [0.7, 0.55], [0.62, 0.68], [0.58, 0.72]].forEach(([px, py], i) => (i ? g.lineTo(b.x + px! * b.w, b.y + py! * b.h) : g.moveTo(b.x + px! * b.w, b.y + py! * b.h)));
    g.stroke();
    const [name, cx, cy] = this.cities[Math.min(this.k, this.cities.length - 1)]!;
    kit.text(`Де ${name}?`, kit.W / 2, b.y - 16, { size: 13, color: '#f6c14e' });
    if (this.lastTap) {
      kit.disc(this.lastTap[0], this.lastTap[1], 3, '#e8576c');
      kit.disc(b.x + cx * b.w, b.y + cy * b.h, 3, '#3a6fd8');
      kit.text(name, b.x + cx * b.w, b.y + cy * b.h - 10, { size: 9 });
    }
    kit.text(`${Math.min(this.k + 1, this.cities.length)}/${this.cities.length}`, kit.W - 18, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
// Історія: розстав події від найдавнішої.
// ------------------------------------------------------------
class Timeline extends Lesson {
  readonly title: string;
  hint = 'Торкайся подій від найдавнішої до найновішої';
  private events: typeof EVENTS[number][];
  private order: number[] = [];
  private mistakes = 0;
  private round = 0;
  constructor(private ctx: GameContext, title = 'Історія', private pool: typeof EVENTS = EVENTS, private room: 'classroom' | 'lecture' = 'classroom') {
    super();
    this.title = title;
    this.events = this.pick();
  }
  private pick() {
    const n = this.ctx.level >= 8 ? 5 : 4;
    return sample(this.ctx.rng, this.pool, n);
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('e')) return;
    const i = Number(id.slice(1));
    if (this.order.includes(i)) return;
    const remaining = this.events.map((e, k) => [e, k] as const).filter(([, k]) => !this.order.includes(k));
    const earliest = Math.min(...remaining.map(([e]) => e[1]));
    if (this.events[i]![1] === earliest) {
      this.order.push(i);
      sfx.good();
      if (this.order.length === this.events.length) {
        this.round += 1;
        this.flash.set(true);
        if (this.round >= 2) this.finish(1 - this.mistakes * 0.12);
        else { this.events = this.pick(); this.order = []; }
      }
    } else {
      this.mistakes += 1;
      this.flash.set(false);
      sfx.bad();
    }
  }
  render(kit: Kit): void {
    kit.backdrop(this.room);
    const top = 74;
    // Стрічка часу.
    kit.rect(18, top, 3, kit.H - top - 30, '#8a5a34');
    this.order.forEach((i, k) => {
      const [name, year] = this.events[i]!;
      kit.disc(19, top + 12 + k * 22, 4, '#f6c14e');
      kit.text(`${year} — ${name}`, 30, top + 12 + k * 22, { size: 9, align: 'left' });
    });
    const y0 = top + 12 + this.events.length * 22 + 10;
    this.events.forEach(([name], i) => {
      if (this.order.includes(i)) return;
      kit.button(`e${i}`, 30, y0 + i * 30, kit.W - 44, 25, name, { tone: 'paper', size: 9 });
    });
    kit.text(`Стрічка ${this.round + 1}/2`, kit.W - 30, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
// Малювання (і дизайн на роботі): перемалюй візерунок.
// ------------------------------------------------------------
export class PixelCopy extends Lesson {
  readonly title: string;
  readonly hint: string;
  private size: number;
  private palette: string[];
  private target: number[];
  private grid: number[];
  private brush = 1;
  private checked = false;
  constructor(ctx: GameContext, opts: { title?: string; size?: number; colors?: number } = {}) {
    super();
    this.title = opts.title ?? 'Малювання';
    this.hint = 'Обери фарбу й перемалюй картинку зліва';
    this.size = opts.size ?? (ctx.level <= 3 ? 4 : 5);
    const all = ['#f8f4ec', '#e8576c', '#f6c14e', '#5aa7e0', '#7ed957', '#b088d6'];
    this.palette = all.slice(0, Math.min(all.length, (opts.colors ?? (ctx.level <= 3 ? 3 : 4)) + 1));
    // Симетричний візерунок — гарний, а не шум.
    const n = this.size;
    this.target = Array<number>(n * n).fill(0);
    for (let y = 0; y < n; y += 1) for (let x = 0; x < Math.ceil(n / 2); x += 1) {
      const c = ctx.rng() < 0.6 ? intIn(ctx.rng, 1, this.palette.length - 1) : 0;
      this.target[y * n + x] = c;
      this.target[y * n + (n - 1 - x)] = c;
    }
    this.grid = Array<number>(n * n).fill(0);
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (!id) return;
    if (id.startsWith('p')) { this.brush = Number(id.slice(1)); sfx.blip(); return; }
    if (id.startsWith('g')) { const i = Number(id.slice(1)); this.grid[i] = this.grid[i] === this.brush ? 0 : this.brush; sfx.blip(); return; }
    if (id === 'done') {
      const same = this.grid.filter((c, i) => c === this.target[i]).length / this.grid.length;
      this.checked = true;
      this.flash.set(same > 0.85);
      this.finish((same - 0.4) / 0.6);
    }
  }
  render(kit: Kit): void {
    kit.backdrop(this.title === 'Малювання' ? 'classroom' : 'studio');
    const n = this.size;
    const small = Math.floor((kit.W / 2 - 24) / n);
    const big = Math.floor((kit.W - 40) / n);
    const draw = (cells: number[], x0: number, y0: number, cs: number, prefix: string | null) => {
      kit.rect(x0 - 2, y0 - 2, cs * n + 4, cs * n + 4, '#5a3218');
      cells.forEach((c, i) => {
        const x = x0 + (i % n) * cs;
        const y = y0 + Math.floor(i / n) * cs;
        kit.rect(x, y, cs - 1, cs - 1, this.palette[c]!);
        if (prefix) kit.region(`${prefix}${i}`, x, y, cs, cs);
      });
    };
    kit.text('Зразок', kit.W / 4, 66, { size: 10 });
    draw(this.target, kit.W / 4 - (small * n) / 2, 76, small, null);
    const gy = 86 + small * n;
    draw(this.grid, kit.W / 2 - (Math.min(big, 40) * n) / 2, gy, Math.min(big, 40), 'g');
    const py = gy + Math.min(big, 40) * n + 10;
    this.palette.forEach((c, i) => {
      const x = 16 + i * 30;
      kit.rect(x, py, 24, 22, '#5a3218');
      kit.rect(x + 2, py + 2, 20, 18, c);
      if (i === this.brush) kit.rect(x, py + 24, 24, 3, '#f6c14e');
      kit.region(`p${i}`, x, py, 24, 26);
    });
    kit.button('done', kit.W - 70, py, 56, 24, this.checked ? 'Здано' : 'Готово', { tone: 'gold' });
  }
}

// ------------------------------------------------------------
// Інформатика: програма для робота.
// ------------------------------------------------------------
type Cmd = 'U' | 'D' | 'L' | 'R';
class Robot extends Lesson {
  title = 'Інформатика';
  hint = 'Склади програму: стрілки ведуть робота до зірки';
  private n = 5;
  private walls = new Set<number>();
  private start = 0;
  private goal = 0;
  private prog: Cmd[] = [];
  private running = -1;
  private pos = 0;
  private stepT = 0;
  private round = 0;
  private wins = 0;
  private optimal = 0;
  constructor(private ctx: GameContext) {
    super();
    this.newLevel();
  }
  private newLevel(): void {
    const r = this.ctx.rng;
    for (let tries = 0; tries < 40; tries += 1) {
      this.walls = new Set<number>();
      for (let k = 0; k < 6; k += 1) this.walls.add(intIn(r, 0, this.n * this.n - 1));
      this.start = intIn(r, 0, this.n * this.n - 1);
      this.goal = intIn(r, 0, this.n * this.n - 1);
      this.walls.delete(this.start);
      this.walls.delete(this.goal);
      const d = this.bfs();
      if (d >= 3 && d <= 7) { this.optimal = d; break; }
    }
    this.prog = [];
    this.pos = this.start;
    this.running = -1;
  }
  private bfs(): number {
    const seen = new Map<number, number>([[this.start, 0]]);
    const q = [this.start];
    while (q.length) {
      const c = q.shift()!;
      if (c === this.goal) return seen.get(c)!;
      for (const nb of this.neighbours(c)) if (!seen.has(nb)) { seen.set(nb, seen.get(c)! + 1); q.push(nb); }
    }
    return -1;
  }
  private neighbours(c: number): number[] {
    const x = c % this.n;
    const y = Math.floor(c / this.n);
    return ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const)
      .map(([dx, dy]) => [x + dx, y + dy] as const)
      .filter(([a, b]) => a >= 0 && b >= 0 && a < this.n && b < this.n && !this.walls.has(b * this.n + a))
      .map(([a, b]) => b * this.n + a);
  }
  protected override step(dt: number): void {
    if (this.running < 0) return;
    this.stepT -= dt;
    if (this.stepT > 0) return;
    this.stepT = 0.32;
    if (this.running >= this.prog.length) { this.endRun(this.pos === this.goal); return; }
    const c = this.prog[this.running]!;
    const x = this.pos % this.n;
    const y = Math.floor(this.pos / this.n);
    const [nx, ny] = c === 'U' ? [x, y - 1] : c === 'D' ? [x, y + 1] : c === 'L' ? [x - 1, y] : [x + 1, y];
    const next = ny * this.n + nx;
    if (nx < 0 || ny < 0 || nx >= this.n || ny >= this.n || this.walls.has(next)) { this.endRun(false); return; }
    this.pos = next;
    sfx.step();
    this.running += 1;
    if (this.pos === this.goal) this.endRun(true);
  }
  private endRun(win: boolean): void {
    this.running = -1;
    this.flash.set(win);
    if (win) {
      sfx.good();
      this.wins += this.prog.length <= this.optimal + 1 ? 1 : 0.75;
      this.round += 1;
      if (this.round >= 3) this.finish(this.wins / 3);
      else this.newLevel();
    } else {
      sfx.bad();
      this.wins -= 0.15;
      this.pos = this.start;
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.running >= 0 || this.done) return;
    const id = kit.hitAt(x, y);
    if (!id) return;
    if (['U', 'D', 'L', 'R'].includes(id) && this.prog.length < 10) { this.prog.push(id as Cmd); sfx.blip(); }
    if (id === 'undo') this.prog.pop();
    if (id === 'run' && this.prog.length) { this.running = 0; this.stepT = 0.2; this.pos = this.start; }
  }
  render(kit: Kit): void {
    kit.backdrop('classroom');
    const cs = Math.floor(Math.min(kit.W - 40, 180) / this.n);
    const x0 = (kit.W - cs * this.n) / 2;
    const y0 = 70;
    kit.rect(x0 - 3, y0 - 3, cs * this.n + 6, cs * this.n + 6, '#23232c');
    for (let i = 0; i < this.n * this.n; i += 1) {
      const x = x0 + (i % this.n) * cs;
      const y = y0 + Math.floor(i / this.n) * cs;
      kit.rect(x, y, cs - 1, cs - 1, this.walls.has(i) ? '#5a5a64' : (i + Math.floor(i / this.n)) % 2 ? '#2f4a6a' : '#34557a');
      if (i === this.goal) kit.icon('star', x + cs / 2 - 4, y + cs / 2 - 3);
    }
    const rx = x0 + (this.pos % this.n) * cs + cs / 2;
    const ry = y0 + Math.floor(this.pos / this.n) * cs + cs / 2;
    kit.rect(rx - 7, ry - 7, 14, 12, '#c9d6e3');
    kit.rect(rx - 4, ry - 4, 3, 3, '#5aa7e0');
    kit.rect(rx + 1, ry - 4, 3, 3, '#5aa7e0');
    kit.rect(rx - 1, ry - 11, 2, 4, '#c9d6e3');
    const py = y0 + cs * this.n + 12;
    const arrows: [Cmd, string][] = [['L', '←'], ['U', '↑'], ['D', '↓'], ['R', '→']];
    kit.panel(10, py, kit.W - 20, 26, 'paper');
    kit.text(this.prog.map((c) => ({ U: '↑', D: '↓', L: '←', R: '→' })[c]).join(' ') || 'програма порожня', kit.W / 2, py + 13, { size: 11, color: '#4a2a14', shadow: null });
    arrows.forEach(([c, label], i) => kit.button(c, 14 + i * 40, py + 36, 34, 28, label, { tone: 'blue', size: 14 }));
    kit.button('undo', kit.W - 104, py + 36, 40, 28, '⌫', { tone: 'paper', size: 12 });
    kit.button('run', kit.W - 58, py + 36, 46, 28, 'Пуск', { tone: 'green' });
    kit.text(`Рівень ${this.round + 1}/3`, kit.W - 30, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
// Фізкультура: забіг (тапай по черзі ліва-права) і стрибок у довжину.
// ------------------------------------------------------------
class Race extends Lesson {
  title = 'Фізкультура: забіг';
  hint = 'Торкайся по черзі лівої й правої ноги!';
  private me = 0;
  private rival = 0;
  private lastFoot: 'L' | 'R' | null = null;
  private rivalSpeed: number;
  private rivals: Look[];
  private go = 1.5;
  constructor(private ctx: GameContext) {
    super();
    this.rivalSpeed = 0.085 + ctx.level * 0.003 + ctx.rng() * 0.02;
    this.rivals = [{ ...townsfolkLook(ctx.rng), kid: ctx.level < 9 }];
  }
  protected override step(dt: number): void {
    if (this.done) return;
    if (this.go > 0) { this.go -= dt; return; }
    this.rival += this.rivalSpeed * dt;
    if (this.rival >= 1 || this.me >= 1) this.finish(this.me >= 1 ? 1 : this.me * 0.8);
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.go > 0 || this.done) return;
    const id = kit.hitAt(x, y);
    if (id !== 'L' && id !== 'R') return;
    if (id !== this.lastFoot) { this.me += 0.036; sfx.step(); } else { this.me = Math.max(0, this.me - 0.01); }
    this.lastFoot = id;
  }
  render(kit: Kit): void {
    kit.backdrop('gym');
    const lanes = [kit.H * 0.45, kit.H * 0.58];
    for (const y of lanes) kit.rect(0, y + 4, kit.W, 2, '#f4f4f7');
    kit.rect(kit.W - 24, lanes[0]! - 30, 3, 70, '#e8576c');
    const lenaKid = { ...this.ctx.lena, kid: this.ctx.level < 9 };
    kit.person(lenaKid, 16 + this.me * (kit.W - 44), lanes[0]!, 2, 2, Math.floor(this.me * 60) % 4);
    kit.person(this.rivals[0]!, 16 + this.rival * (kit.W - 44), lanes[1]!, 2, 2, Math.floor(this.rival * 60) % 4);
    if (this.go > 0) kit.text(this.go > 1 ? 'На старт!' : this.go > 0.5 ? 'Увага!' : 'Руш!', kit.W / 2, kit.H * 0.3, { size: 16, color: '#f6c14e' });
    const by = kit.H - 70;
    kit.button('L', 14, by, kit.W / 2 - 20, 50, 'Ліва', { tone: this.lastFoot === 'L' ? 'gold' : 'paper', size: 12 });
    kit.button('R', kit.W / 2 + 6, by, kit.W / 2 - 20, 50, 'Права', { tone: this.lastFoot === 'R' ? 'gold' : 'paper', size: 12 });
  }
}

class LongJump extends Lesson {
  title = 'Фізкультура: стрибок';
  hint = 'Розбіг — і стрибни якомога ближче до планки';
  private x = 0;
  private jumps: number[] = [];
  private state: 'run' | 'fly' | 'land' = 'run';
  private fly = 0;
  private dist = 0;
  private wait = 0;
  constructor(private ctx: GameContext) { super(); }
  protected override step(dt: number): void {
    if (this.done) return;
    if (this.state === 'run') {
      this.x += dt * (0.42 + this.ctx.level * 0.01);
      if (this.x > 0.62) { this.jump(); }
    } else if (this.state === 'fly') {
      this.fly += dt * 1.6;
      if (this.fly >= 1) { this.state = 'land'; this.wait = 0.9; }
    } else {
      this.wait -= dt;
      if (this.wait <= 0) {
        if (this.jumps.length >= 3) { this.finish(Math.max(...this.jumps)); return; }
        this.state = 'run';
        this.x = 0;
        this.fly = 0;
      }
    }
  }
  private jump(): void {
    // Планка на 0.55; ближче — далі стрибок; заступ — нуль.
    const gap = 0.55 - this.x;
    this.dist = gap < 0 ? 0 : Math.max(0, 1 - gap * 6);
    this.jumps.push(this.dist);
    this.dist > 0.6 ? sfx.good() : sfx.bad();
    this.flash.set(this.dist > 0.6);
    this.state = 'fly';
  }
  tap(): void {
    if (this.state === 'run') this.jump();
  }
  render(kit: Kit): void {
    kit.backdrop('yard');
    const y = kit.H * 0.7;
    kit.rect(0, y, kit.W, 4, '#c96a3f');
    const bar = 0.55 * kit.W;
    kit.rect(bar, y - 2, 3, 8, '#f4f4f7');
    kit.rect(bar + 4, y - 2, kit.W - bar, 10, '#ecd69a');
    let px = this.x * kit.W;
    let py = y;
    if (this.state !== 'run') {
      const p = Math.min(1, this.fly);
      px = this.x * kit.W + p * this.dist * (kit.W - bar - 10) * 0.9 + 10 * p;
      py = y - Math.sin(p * Math.PI) * 40;
    }
    const lenaKid = { ...this.ctx.lena, kid: this.ctx.level < 9 };
    kit.person(lenaKid, px, py, 2, 2, this.state === 'run' ? Math.floor(this.t * 10) % 4 : 1);
    kit.text(`Спроби: ${this.jumps.map((j) => (j * 4.5).toFixed(1) + ' м').join(' · ') || '—'}`, kit.W / 2, 70, { size: 10 });
    if (this.state === 'land') kit.text(this.dist === 0 ? 'Заступ!' : `${(this.dist * 4.5).toFixed(1)} м`, kit.W / 2, y - 60, { size: 14, color: '#f6c14e' });
    kit.region('any', 0, 0, kit.W, kit.H);
  }
}

// ------------------------------------------------------------
// Реєстр уроків.
// ------------------------------------------------------------
export type Subject = 'math' | 'ukr' | 'reading' | 'nature' | 'english' | 'geo' | 'history' | 'art' | 'music' | 'pe' | 'it' | 'physics' | 'chemistry' | 'biology'
  | 'pedagogy' | 'psychology' | 'histUa' | 'histWorld' | 'methods' | 'exam';

export const SUBJECT_NAME: Record<Subject, string> = {
  math: 'Математика', ukr: 'Українська мова', reading: 'Читання', nature: 'Я досліджую світ', english: 'Англійська', geo: 'Географія',
  history: 'Історія', art: 'Малювання', music: 'Музика', pe: 'Фізкультура', it: 'Інформатика', physics: 'Фізика', chemistry: 'Хімія',
  biology: 'Біологія', pedagogy: 'Педагогіка', psychology: 'Вікова психологія', histUa: 'Історія України', histWorld: 'Всесвітня історія',
  methods: 'Методика викладання історії', exam: 'Сесія',
};

export function lessonGame(subject: Subject, ctx: GameContext): MiniGame {
  const L = ctx.level;
  switch (subject) {
    case 'math': return new Quiz(SUBJECT_NAME.math, 'Обери правильну відповідь — швидко!', ctx, () => mathQuestion(ctx.rng, L), 4 + Math.min(3, Math.floor(L / 3)), 'classroom', L <= 2 ? 10 : 8);
    case 'ukr': return new Sentence(ctx);
    case 'reading': return new Reading(ctx);
    case 'nature': return new Sort(ctx, SUBJECT_NAME.nature, Math.min(L, 4));
    case 'biology': return L % 2 ? new Sort(ctx, SUBJECT_NAME.biology, 4, 4) : new Quiz(SUBJECT_NAME.biology, 'Обери правильну відповідь', ctx, () => factQuestion(ctx.rng, 'biology', L), 4);
    case 'chemistry': return L % 2 ? new Sort(ctx, SUBJECT_NAME.chemistry, 7, 7) : new Quiz(SUBJECT_NAME.chemistry, 'Обери правильну відповідь', ctx, () => factQuestion(ctx.rng, 'chemistry', L), 4);
    case 'physics': return new Quiz(SUBJECT_NAME.physics, 'Обери правильну відповідь', ctx, () => factQuestion(ctx.rng, 'physics', L), 4);
    case 'english': return new Quiz(SUBJECT_NAME.english, 'Як це українською?', ctx, () => englishQuestion(ctx.rng, L), 5, L >= 12 ? 'lecture' : 'classroom');
    case 'geo': return new MapQuiz(ctx);
    case 'history': return new Timeline(ctx);
    case 'art': return new PixelCopy(ctx);
    case 'music': return new Simon(ctx, true);
    case 'pe': return ctx.rng() < 0.5 ? new Race(ctx) : new LongJump(ctx);
    case 'it': return new Robot(ctx);
    // ВДПУ, історичний факультет (власник, 2026-10-05: «Лєна саме історик за профілем»).
    case 'pedagogy': return new Quiz(SUBJECT_NAME.pedagogy, 'Обери правильну відповідь', ctx, () => factQuestion(ctx.rng, 'pedagogy', L), 5, 'lecture');
    case 'psychology': return new Quiz(SUBJECT_NAME.psychology, 'Обери правильну відповідь', ctx, () => factQuestion(ctx.rng, 'psychology', L), 4, 'lecture');
    case 'histUa': return new Timeline(ctx, SUBJECT_NAME.histUa, UNI_EVENTS, 'lecture');
    case 'histWorld': return new Quiz(SUBJECT_NAME.histWorld, 'Обери правильну відповідь', ctx, () => factQuestion(ctx.rng, 'worldHistory', L), 5, 'lecture');
    case 'methods': return new Sort(ctx, SUBJECT_NAME.methods, 12, 12);
    case 'exam': return new Quiz('Сесія', 'Іспит: усе, що вчила за семестр', ctx, () => pickOne(ctx.rng, [
      () => factQuestion(ctx.rng, 'pedagogy', L), () => factQuestion(ctx.rng, 'psychology', L), () => factQuestion(ctx.rng, 'worldHistory', L), () => englishQuestion(ctx.rng, L),
    ])(), 6, 'lecture', 10);
  }
}

/** Розклад: які предмети є в якому класі. */
export function subjectsFor(level: number): Subject[] {
  if (level <= 1) return ['math', 'ukr', 'reading', 'nature', 'art', 'music', 'pe'];
  if (level <= 4) return ['math', 'ukr', 'reading', 'nature', 'english', 'art', 'music', 'pe', 'it'];
  if (level <= 6) return ['math', 'ukr', 'english', 'geo', 'history', 'biology', 'art', 'pe', 'it', 'music'];
  if (level <= 11) return ['math', 'ukr', 'english', 'geo', 'history', 'biology', 'physics', 'chemistry', 'pe', 'it'];
  return ['pedagogy', 'psychology', 'histUa', 'histWorld', 'methods', 'english'];
}

