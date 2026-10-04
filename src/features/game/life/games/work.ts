// ============================================================
// Зміни на роботі «Дєвочка в городі» (ADR-0239): кожна професія — своя гра.
//   бариста — напій за рецептом, поки клієнт чекає;
//   продавчиня — порахувати решту монетами;
//   флористка — букет за замовленням;
//   вчителька — перевірити зошити: правильно чи ні;
//   кондитерка — торт шар за шаром за ескізом;
//   гідеса — провести групу маршрутом по Одесі з пам'яті;
//   пошта — рознести листи по скриньках;
//   бухгалтерка — розкласти проводки й звести суму;
//   дизайнерка — перемалювати макет.
// Ранг робить зміну довшою й вимогливішою.
// ============================================================
import { intIn, pickOne, sample, shuffled } from '../sim/rng';
import { townsfolkLook, type Look } from '../render/people';
import { shade } from '../render/pixel';
import { sfx } from '../sound';
import { COFFEE_STEPS, DRINKS, FLOWERS, MARKET_GOODS, ODESA_STOPS, SORT_SETS, mathQuestion } from './banks';
import { Flash, answerGrid, type GameContext, type Kit, type MiniGame } from './kit';
import { PixelCopy } from './lessons';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

abstract class Shift implements MiniGame {
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
    if (this.score >= 0.5) sfx.coin();
  }
}

function customer(kit: Kit, look: Look, x: number, y: number, patience: number): void {
  kit.person(look, x, y, 3, 0, 0);
  kit.bar(x - 16, y - 70, 32, 3, patience, patience > 0.4 ? '#7ed957' : '#e8776a');
}

// ------------------------------------------------------------
class Barista extends Shift {
  title = 'Зміна в кав\'ярні';
  hint = 'Готуй напій за рецептом, поки клієнт не пішов';
  private orders: typeof DRINKS[number][];
  private k = 0;
  private made: string[] = [];
  private served = 0;
  private patience = 1;
  private look: Look;
  private drain: number;
  constructor(private ctx: GameContext) {
    super();
    this.orders = Array.from({ length: 5 + ctx.level }, () => pickOne(ctx.rng, DRINKS));
    this.look = townsfolkLook(ctx.rng);
    this.drain = 0.075 + ctx.level * 0.02;
  }
  protected override step(dt: number): void {
    if (this.done) return;
    this.patience -= this.drain * dt;
    if (this.patience <= 0) this.next(false);
  }
  private next(ok: boolean): void {
    if (ok) { this.served += 1; sfx.coin(); } else sfx.bad();
    this.flash.set(ok);
    this.k += 1;
    this.made = [];
    this.patience = 1;
    this.look = townsfolkLook(this.ctx.rng);
    if (this.k >= this.orders.length) this.finish(this.served / this.orders.length);
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (!id) return;
    const order = this.orders[this.k]!;
    if (id === 'trash') { this.made = []; sfx.blip(); return; }
    if (id.startsWith('i')) {
      const step = COFFEE_STEPS[Number(id.slice(1))]!;
      if (step !== order.steps[this.made.length]) { this.made = []; this.flash.set(false); sfx.bad(); return; }
      this.made.push(step);
      sfx.blip();
      if (this.made.length === order.steps.length) this.next(true);
    }
  }
  render(kit: Kit): void {
    kit.backdrop('cafe');
    const order = this.orders[Math.min(this.k, this.orders.length - 1)]!;
    customer(kit, this.look, kit.W * 0.25, kit.H * 0.4, this.patience);
    kit.panel(kit.W * 0.45, 60, kit.W * 0.5, 64, 'paper');
    kit.text(order.name, kit.W * 0.7, 74, { size: 12, color: '#4a2a14', shadow: null });
    kit.text(order.steps.join(' → '), kit.W * 0.7, 94, { size: 7, color: '#7a5a3a', shadow: null, maxWidth: kit.W * 0.46 });
    kit.text(`${this.made.length}/${order.steps.length}`, kit.W * 0.7, 112, { size: 9, color: '#4a2a14', shadow: null });
    // Стійка.
    const cy = kit.H * 0.46;
    kit.rect(0, cy, kit.W, 10, '#5a3a24');
    kit.rect(0, cy, kit.W, 2, '#8a5a34');
    // Чашка, що наповнюється.
    const fill = this.made.length / order.steps.length;
    kit.rect(kit.W / 2 - 10, cy - 18, 20, 16, '#f4f4f7');
    kit.rect(kit.W / 2 - 8, cy - 16 + (1 - fill) * 12, 16, fill * 12, '#8a5a34');
    kit.rect(kit.W / 2 + 10, cy - 14, 4, 6, '#f4f4f7');
    const bx = 10;
    const by = cy + 20;
    const bw = (kit.W - 20 - 3 * 6) / 4;
    COFFEE_STEPS.forEach((s, i) => kit.button(`i${i}`, bx + (i % 4) * (bw + 6), by + Math.floor(i / 4) * 34, bw, 28, s, { tone: 'wood', size: 8, color: '#fff6e0' }));
    kit.button('trash', kit.W / 2 - 36, by + 74, 72, 24, 'Вилити', { tone: 'red', size: 9 });
    kit.text(`Гостей: ${this.served}/${this.orders.length}`, kit.W / 2, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
class Cashier extends Shift {
  title = 'Зміна на ринку';
  hint = 'Набери решту монетами — ні більше, ні менше';
  private n = 0;
  private right = 0;
  private change = 0;
  private given = 0;
  private items: [string, number][] = [];
  private paid = 0;
  private readonly total: number;
  private look: Look;
  constructor(private ctx: GameContext) {
    super();
    this.total = 5 + ctx.level;
    this.look = townsfolkLook(ctx.rng);
    this.newCustomer();
  }
  private newCustomer(): void {
    const r = this.ctx.rng;
    this.items = sample(r, MARKET_GOODS, intIn(r, 1, 2 + this.ctx.level));
    const sum = this.items.reduce((a, [, p]) => a + p, 0);
    this.paid = [50, 100, 200, 500].find((b) => b > sum + 4) ?? 1000;
    this.change = this.paid - sum;
    this.given = 0;
    this.look = townsfolkLook(r);
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (!id) return;
    if (id.startsWith('c')) { this.given += Number(id.slice(1)); sfx.coin(); }
    if (id === 'reset') { this.given = 0; sfx.blip(); }
    if (id === 'give') {
      const ok = this.given === this.change;
      if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
      this.flash.set(ok);
      this.n += 1;
      if (this.n >= this.total) this.finish(this.right / this.total);
      else this.newCustomer();
    }
  }
  render(kit: Kit): void {
    kit.backdrop('shop');
    kit.person(this.look, kit.W * 0.2, kit.H * 0.36, 3);
    kit.panel(kit.W * 0.38, 60, kit.W * 0.58, 22 + this.items.length * 13, 'paper');
    this.items.forEach(([name, price], i) => kit.text(`${name} — ${price} ₴`, kit.W * 0.67, 72 + i * 13, { size: 9, color: '#4a2a14', shadow: null }));
    const sum = this.items.reduce((a, [, p]) => a + p, 0);
    const y = 86 + this.items.length * 13;
    kit.text(`Разом ${sum} ₴ · дали ${this.paid} ₴`, kit.W / 2, y + 6, { size: 10, color: '#f6c14e' });
    kit.text(`Решта: ${this.given} ₴`, kit.W / 2, y + 24, { size: 14, color: this.given > this.change ? '#ffb3b3' : '#fff6e0' });
    const coins = [1, 2, 5, 10, 20, 50, 100, 200];
    const cy = Math.max(y + 44, kit.H - 132);
    coins.forEach((c, i) => {
      const x = 14 + (i % 4) * ((kit.W - 28) / 4);
      const yy = cy + Math.floor(i / 4) * 38;
      const paper = c >= 20;
      kit.button(`c${c}`, x, yy, (kit.W - 28) / 4 - 6, 30, `${c}`, { tone: paper ? 'green' : 'gold', size: 11 });
    });
    kit.button('reset', 14, kit.H - 50, kit.W / 2 - 20, 30, 'Скинути', { tone: 'paper' });
    kit.button('give', kit.W / 2 + 6, kit.H - 50, kit.W / 2 - 20, 30, 'Віддати', { tone: 'blue' });
    kit.text(`Покупців: ${this.n}/${this.total}`, kit.W / 2, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
class Florist extends Shift {
  title = 'Зміна у квітах';
  hint = 'Збери букет точно за замовленням';
  private order: [number, number][] = [];
  private bouquet: number[] = [];
  private n = 0;
  private right = 0;
  private readonly total: number;
  constructor(private ctx: GameContext) {
    super();
    this.total = 4 + ctx.level;
    this.newOrder();
  }
  private newOrder(): void {
    const kinds = sample(this.ctx.rng, FLOWERS.map((_, i) => i), intIn(this.ctx.rng, 2, 3));
    this.order = kinds.map((k) => [k, intIn(this.ctx.rng, 1, 3 + this.ctx.level)] as [number, number]);
    this.bouquet = [];
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (!id) return;
    if (id.startsWith('f')) { this.bouquet.push(Number(id.slice(1))); sfx.blip(); }
    if (id === 'undo') this.bouquet.pop();
    if (id === 'wrap') {
      const counts = new Map<number, number>();
      for (const b of this.bouquet) counts.set(b, (counts.get(b) ?? 0) + 1);
      const ok = this.order.every(([k, c]) => counts.get(k) === c) && counts.size === this.order.length;
      if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
      this.flash.set(ok);
      this.n += 1;
      if (this.n >= this.total) this.finish(this.right / this.total);
      else this.newOrder();
    }
  }
  render(kit: Kit): void {
    kit.backdrop('flowers');
    kit.panel(12, 58, kit.W - 24, 22 + this.order.length * 13, 'paper');
    this.order.forEach(([k, c], i) => kit.text(`${FLOWERS[k]!.name} × ${c}`, kit.W / 2, 70 + i * 13, { size: 10, color: '#4a2a14', shadow: null }));
    // Букет у папері.
    const bx = kit.W / 2;
    const by = 110 + this.order.length * 13 + 40;
    this.bouquet.forEach((k, i) => {
      const a = -Math.PI / 2 + ((i % 7) - 3) * 0.28;
      const r = 14 + Math.floor(i / 7) * 10;
      kit.rect(bx + Math.cos(a) * r * 0.4, by - 4 + Math.sin(a) * r * 0.4, 1, 18, '#4f9a3e');
      kit.disc(bx + Math.cos(a) * r, by + Math.sin(a) * r, 4, FLOWERS[k]!.color);
    });
    kit.g.fillStyle = '#f4e2bc';
    kit.g.beginPath();
    kit.g.moveTo(bx - 18, by);
    kit.g.lineTo(bx + 18, by);
    kit.g.lineTo(bx + 4, by + 34);
    kit.g.lineTo(bx - 4, by + 34);
    kit.g.closePath();
    kit.g.fill();
    const fy = Math.max(by + 44, kit.H - 120);
    FLOWERS.forEach((f, i) => {
      const x = 12 + (i % 3) * ((kit.W - 24) / 3);
      const y = fy + Math.floor(i / 3) * 36;
      kit.button(`f${i}`, x, y, (kit.W - 24) / 3 - 6, 30, '', { tone: 'paper' });
      kit.disc(x + 12, y + 14, 5, f.color);
      kit.text(f.name, x + 22 + ((kit.W - 24) / 3 - 30) / 2, y + 15, { size: 8, color: '#4a2a14', shadow: null });
    });
    kit.button('undo', 12, kit.H - 44, 60, 28, 'Мінус', { tone: 'paper', size: 9 });
    kit.button('wrap', kit.W - 112, kit.H - 44, 100, 28, 'Загорнути', { tone: 'green' });
    kit.text(`Букетів: ${this.n}/${this.total}`, kit.W / 2, 50, { size: 10 });
  }
}

// ------------------------------------------------------------
class Teacher extends Shift {
  title = 'Перевірка зошитів';
  hint = 'Правильно чи помилка? Швидко, поки дзвоник не продзвенів';
  private items: { text: string; ok: boolean }[] = [];
  private k = 0;
  private right = 0;
  private left: number;
  constructor(ctx: GameContext) {
    super();
    const n = 12 + ctx.level * 3;
    for (let i = 0; i < n; i += 1) {
      const q = mathQuestion(ctx.rng, intIn(ctx.rng, 3, 7));
      const ok = ctx.rng() < 0.55;
      const shown = ok ? q.answers[q.correct]! : q.answers[(q.correct + 1) % q.answers.length]!;
      this.items.push({ text: q.q.replace('?', shown).replace('= ?', `= ${shown}`), ok });
    }
    this.left = 30;
  }
  protected override step(dt: number): void {
    if (this.done) return;
    this.left -= dt;
    if (this.left <= 0) this.finish(this.right / Math.max(10, this.items.length * 0.7));
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (id !== 'yes' && id !== 'no') return;
    const ok = (id === 'yes') === this.items[this.k]!.ok;
    if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
    this.flash.set(ok);
    this.k += 1;
    if (this.k >= this.items.length) this.finish(this.right / this.items.length);
  }
  render(kit: Kit): void {
    kit.backdrop('classroom');
    const it = this.items[Math.min(this.k, this.items.length - 1)]!;
    // Зошит у клітинку.
    kit.rect(20, 80, kit.W - 40, 110, '#f8f8ff');
    for (let y = 84; y < 188; y += 6) kit.rect(20, y, kit.W - 40, 1, '#d8e0f4');
    for (let x = 24; x < kit.W - 20; x += 6) kit.rect(x, 80, 1, 110, '#d8e0f4');
    kit.rect(36, 80, 1, 110, '#f29a9a');
    kit.text(it.text, kit.W / 2 + 6, 134, { size: 12, color: '#2b3a8a', shadow: null, weight: 700, maxWidth: kit.W - 70 });
    kit.bar(kit.W / 2 - 60, 206, 120, 5, this.left / 30, this.left > 8 ? '#7ed957' : '#e8776a');
    kit.button('yes', 14, kit.H - 70, kit.W / 2 - 20, 46, 'Правильно', { tone: 'green', size: 11 });
    kit.button('no', kit.W / 2 + 6, kit.H - 70, kit.W / 2 - 20, 46, 'Помилка', { tone: 'red', size: 11 });
    kit.text(`Перевірено: ${this.k}/${this.items.length}`, kit.W / 2, 56, { size: 10 });
  }
}

// ------------------------------------------------------------
class Baker extends Shift {
  title = 'Зміна в пекарні';
  hint = 'Збери торт знизу догори, як на ескізі';
  private readonly layers = [['Корж', '#e3a85a'], ['Крем', '#fff4e6'], ['Вишні', '#c2283a'], ['Шоколад', '#6e4a2a'], ['Ягоди', '#b088d6'], ['Карамель', '#f2b44a']] as const;
  private sketch: number[] = [];
  private built: number[] = [];
  private n = 0;
  private right = 0;
  private readonly total: number;
  constructor(private ctx: GameContext) {
    super();
    this.total = 4 + ctx.level;
    this.newCake();
  }
  private newCake(): void {
    const len = intIn(this.ctx.rng, 3, 4 + this.ctx.level);
    this.sketch = [0, ...Array.from({ length: len - 1 }, () => intIn(this.ctx.rng, 0, this.layers.length - 1))];
    this.built = [];
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('l')) return;
    const l = Number(id.slice(1));
    if (l !== this.sketch[this.built.length]) {
      this.flash.set(false);
      sfx.bad();
      this.n += 1;
      if (this.n >= this.total) this.finish(this.right / this.total); else this.newCake();
      return;
    }
    this.built.push(l);
    sfx.blip();
    if (this.built.length === this.sketch.length) {
      this.right += 1;
      this.n += 1;
      this.flash.set(true);
      sfx.good();
      if (this.n >= this.total) this.finish(this.right / this.total); else this.newCake();
    }
  }
  private cake(kit: Kit, layers: number[], x: number, y: number, w: number): void {
    layers.forEach((l, i) => {
      const c = this.layers[l]![1];
      kit.rect(x - w / 2 + i, y - (i + 1) * 9, w - i * 2, 8, c);
      kit.rect(x - w / 2 + i, y - (i + 1) * 9, w - i * 2, 2, shade(c, 0.25));
    });
    kit.rect(x - w / 2 - 6, y, w + 12, 3, '#d8d0c2');
  }
  render(kit: Kit): void {
    kit.backdrop('bakery');
    kit.panel(10, 60, kit.W / 2 - 16, 100, 'paper');
    kit.text('Ескіз', kit.W / 4, 72, { size: 9, color: '#4a2a14', shadow: null });
    this.cake(kit, this.sketch, kit.W / 4, 150, 60);
    this.cake(kit, this.built, (kit.W * 3) / 4, 150, 70);
    const by = Math.max(180, kit.H - 120);
    this.layers.forEach(([name, c], i) => {
      const x = 12 + (i % 3) * ((kit.W - 24) / 3);
      const yy = by + Math.floor(i / 3) * 40;
      kit.button(`l${i}`, x, yy, (kit.W - 24) / 3 - 6, 32, '', { tone: 'paper' });
      kit.rect(x + 6, yy + 10, 12, 10, c);
      kit.text(name, x + 20 + ((kit.W - 24) / 3 - 30) / 2, yy + 16, { size: 8, color: '#4a2a14', shadow: null });
    });
    kit.text(`Тортів: ${this.n}/${this.total}`, kit.W / 2, 50, { size: 10 });
  }
}

// ------------------------------------------------------------
class Guide extends Shift {
  title = 'Екскурсія Одесою';
  hint = 'Запам\'ятай маршрут і проведи групу тим самим шляхом';
  private route: number[] = [];
  private input: number[] = [];
  private show = 0;
  private showT = 0;
  private n = 0;
  private right = 0;
  private readonly total = 3;
  constructor(private ctx: GameContext) {
    super();
    this.newRoute();
  }
  private newRoute(): void {
    this.route = sample(this.ctx.rng, ODESA_STOPS.map((_, i) => i), 3 + this.ctx.level + this.n);
    this.input = [];
    this.show = 1;
    this.showT = 0.7;
  }
  protected override step(dt: number): void {
    if (this.show <= 0) return;
    this.showT -= dt;
    if (this.showT <= 0) {
      this.show += 1;
      this.showT = 0.75;
      if (this.show > this.route.length + 1) this.show = 0;
      else sfx.note(this.show);
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.show > 0 || this.done) return;
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('s')) return;
    const s = Number(id.slice(1));
    if (s !== this.route[this.input.length]) {
      sfx.bad();
      this.flash.set(false);
      this.n += 1;
      this.right += this.input.length / this.route.length / 2;
      if (this.n >= this.total) this.finish(this.right / this.total); else this.newRoute();
      return;
    }
    this.input.push(s);
    sfx.good();
    if (this.input.length === this.route.length) {
      this.right += 1;
      this.n += 1;
      this.flash.set(true);
      if (this.n >= this.total) this.finish(this.right / this.total); else this.newRoute();
    }
  }
  render(kit: Kit): void {
    kit.backdrop('sea');
    const mx = 10;
    const my = 66;
    const mw = kit.W - 20;
    const mh = Math.min(kit.H - 120, 280);
    kit.panel(mx - 4, my - 4, mw + 8, mh + 8, 'paper');
    kit.rect(mx, my, mw, mh, '#e8dcc0');
    kit.rect(mx + mw * 0.75, my, mw * 0.25, mh, '#7fc0ec');
    const visible = this.show > 0 ? this.route.slice(0, Math.max(0, this.show - 1)) : this.input;
    ODESA_STOPS.forEach(([name, px, py], i) => {
      const x = mx + px * mw;
      const y = my + py * mh;
      const order = visible.indexOf(i);
      kit.disc(x, y, 7, order >= 0 ? '#f6c14e' : '#c96a4c');
      if (order >= 0) kit.text(String(order + 1), x, y, { size: 8, color: '#3a2414', shadow: null });
      kit.text(name, x, y + 13, { size: 7, color: '#4a2a14', shadow: null });
      kit.region(`s${i}`, x - 16, y - 12, 32, 30);
    });
    for (let k = 1; k < visible.length; k += 1) {
      const [, ax, ay] = ODESA_STOPS[visible[k - 1]!]!;
      const [, bx, by] = ODESA_STOPS[visible[k]!]!;
      kit.g.strokeStyle = '#3a6fd8';
      kit.g.lineWidth = 1.5;
      kit.g.beginPath();
      kit.g.moveTo(mx + ax * mw, my + ay * mh);
      kit.g.lineTo(mx + bx * mw, my + by * mh);
      kit.g.stroke();
    }
    kit.text(this.show > 0 ? 'Запам\'ятовуй маршрут…' : 'Веди групу!', kit.W / 2, my + mh + 18, { size: 12, color: '#f6c14e' });
    kit.text(`Групи: ${this.n}/${this.total}`, kit.W / 2, 50, { size: 10 });
  }
}

// ------------------------------------------------------------
class Post extends Shift {
  title = 'Пошта';
  hint = 'Поклади лист у скриньку з тим самим номером і кольором';
  private letters: { num: number; color: number }[] = [];
  private k = 0;
  private right = 0;
  private boxes: { num: number; color: number }[] = [];
  private readonly colors = ['#3a6fd8', '#e8576c', '#7ed957', '#f6c14e'];
  constructor(ctx: GameContext) {
    super();
    for (let c = 0; c < 4; c += 1) for (const num of sample(ctx.rng, [1, 3, 5, 7, 9, 11, 13], 2)) this.boxes.push({ num, color: c });
    this.boxes = shuffled(ctx.rng, this.boxes);
    this.letters = Array.from({ length: 10 }, () => pickOne(ctx.rng, this.boxes));
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const id = kit.hitAt(x, y);
    if (!id?.startsWith('b')) return;
    const box = this.boxes[Number(id.slice(1))]!;
    const letter = this.letters[this.k]!;
    const ok = box.num === letter.num && box.color === letter.color;
    if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
    this.flash.set(ok);
    this.k += 1;
    if (this.k >= this.letters.length) this.finish(this.right / this.letters.length);
  }
  render(kit: Kit): void {
    kit.backdrop('post');
    const l = this.letters[Math.min(this.k, this.letters.length - 1)]!;
    kit.panel(kit.W / 2 - 50, 64, 100, 54, 'paper');
    kit.rect(kit.W / 2 + 28, 70, 12, 14, this.colors[l.color]!);
    kit.text(`Садова, ${l.num}`, kit.W / 2 - 8, 96, { size: 11, color: '#4a2a14', shadow: null });
    const cols = 4;
    const bw = (kit.W - 24) / cols;
    const top = Math.max(140, kit.H - 170);
    this.boxes.forEach((b, i) => {
      const x = 12 + (i % cols) * bw;
      const y = top + Math.floor(i / cols) * 70;
      kit.rect(x + 4, y, bw - 8, 44, this.colors[b.color]!);
      kit.rect(x + 4, y, bw - 8, 3, shade(this.colors[b.color]!, 0.3));
      kit.rect(x + 10, y + 12, bw - 20, 3, '#1b2b4a');
      kit.rect(x + bw / 2 - 1, y + 44, 3, 20, '#5a5a64');
      kit.text(String(b.num), x + bw / 2, y + 30, { size: 12 });
      kit.region(`b${i}`, x, y, bw, 66);
    });
    kit.text(`Листів: ${this.k}/${this.letters.length}`, kit.W / 2, 50, { size: 10 });
  }
}

// ------------------------------------------------------------
class Accountant extends Shift {
  title = 'Звітний день';
  hint = 'Розклади проводки, потім зведи підсумок';
  private phase: 'sort' | 'sum' = 'sort';
  private items: [string, 'L' | 'R'][];
  private set: typeof SORT_SETS[number];
  private k = 0;
  private right = 0;
  private sums: { q: string; answers: string[]; correct: number }[];
  private s = 0;
  private picked = -1;
  private wait = 0;
  constructor(ctx: GameContext) {
    super();
    this.set = pickOne(ctx.rng, SORT_SETS.filter((s) => s.minLevel === 12));
    this.items = shuffled(ctx.rng, this.set.items).slice(0, 6 + ctx.level);
    this.sums = Array.from({ length: 3 }, () => mathQuestion(ctx.rng, 13));
  }
  protected override step(dt: number): void {
    if (this.wait > 0) {
      this.wait -= dt;
      if (this.wait <= 0) {
        this.s += 1;
        this.picked = -1;
        if (this.s >= this.sums.length) this.finish(this.right / (this.items.length + this.sums.length));
      }
    }
  }
  tap(x: number, y: number, kit: Kit): void {
    if (this.done || this.wait > 0) return;
    const id = kit.hitAt(x, y);
    if (!id) return;
    if (this.phase === 'sort' && (id === 'L' || id === 'R')) {
      const ok = this.items[this.k]![1] === id;
      if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
      this.flash.set(ok);
      this.k += 1;
      if (this.k >= this.items.length) this.phase = 'sum';
      return;
    }
    if (this.phase === 'sum' && id.startsWith('a')) {
      this.picked = Number(id.slice(1));
      const ok = this.picked === this.sums[this.s]!.correct;
      if (ok) { this.right += 1; sfx.good(); } else sfx.bad();
      this.wait = 0.7;
    }
  }
  render(kit: Kit): void {
    kit.backdrop('office');
    if (this.phase === 'sort') {
      kit.text(this.set.title, kit.W / 2, 70, { size: 12, color: '#3a4a5a', shadow: null });
      const it = this.items[Math.min(this.k, this.items.length - 1)]!;
      kit.panel(20, 90, kit.W - 40, 40, 'paper');
      kit.text(it[0], kit.W / 2, 110, { size: 11, color: '#4a2a14', shadow: null });
      kit.button('L', 14, kit.H - 90, kit.W / 2 - 20, 60, this.set.left, { tone: 'blue', size: 12 });
      kit.button('R', kit.W / 2 + 6, kit.H - 90, kit.W / 2 - 20, 60, this.set.right, { tone: 'gold', size: 12 });
      kit.text(`Проводок: ${this.k}/${this.items.length}`, kit.W / 2, 50, { size: 10 });
    } else {
      const q = this.sums[Math.min(this.s, this.sums.length - 1)]!;
      kit.panel(14, 70, kit.W - 28, 60, 'paper');
      kit.wrap(q.q, kit.W - 48, 10).forEach((l, i) => kit.text(l, kit.W / 2, 86 + i * 14, { size: 10, color: '#4a2a14', shadow: null }));
      answerGrid(kit, q.answers, kit.H - 110, this.picked, this.picked === q.correct);
      kit.text(`Підсумки: ${this.s + 1}/${this.sums.length}`, kit.W / 2, 50, { size: 10 });
    }
  }
}

export function shiftGame(game: string, ctx: GameContext): MiniGame {
  switch (game) {
    case 'barista': return new Barista(ctx);
    case 'cashier': return new Cashier(ctx);
    case 'florist': return new Florist(ctx);
    case 'teacher': return new Teacher(ctx);
    case 'baker': return new Baker(ctx);
    case 'guide': return new Guide(ctx);
    case 'post': return new Post(ctx);
    case 'accountant': return new Accountant(ctx);
    case 'designer': return new PixelCopy(ctx, { title: 'Макет для клієнта', size: 6 + ctx.level, colors: 5 });
    default: throw new Error(`Невідома зміна: ${game}`);
  }
}

