// ============================================================
// Міні-ігри садиби (ADR-0239, власник 2026-10-13):
//   1. Сад — з дерев падають яблука, сливи й груші, Лєна ловить їх у кошик.
//   2. Город — зібрати урожай, що виріс, і паралельно гнати кротів та
//      виривати бур'яни.
//   3. Курник — яйця котяться з чотирьох сідал по обидва боки, як у
//      «Ну, погоди!», а Лєна з кошиком ловить.
//   4. Рибалка — закинути, дочекатись клювання, підсікти: карась, окунь,
//      короп.
// Гра лише рахує зібране (`tally`); гроші й тепло з мамою — `sim/farm.ts`.
//
// Розміри полотна різні (телефон стоячи — ~240×450, комп'ютер — ~256×160),
// тож стан ігор — у частках поля, а пікселі рахуються під час малювання.
// Кожен кидок — від костей гри (`ctx.rng`), тож той самий день той самий.
// ============================================================
import { BASKET_MAX, CROPS, EGGS_PER_ROUND, EGG_SPEEDUP_EVERY, FISH, FISH_NAME, FRUIT_PRICE, fishFor, type Crop, type FarmGameId, type Fish, type Fruit } from '../sim/farm';
import { BIRD_PECK_FRAMES, BIRD_WALK_FRAMES, drawBirdSprite } from '../render/birds';
import type { BirdKind } from '../sim/birds';
import { MOM, type Look } from '../render/people';
import { shade } from '../render/pixel';
import { sfx } from '../sound';
import type { GameContext, Kit, MiniGame } from './kit';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v: number) => clamp(v, 0, 1);

/** Верх поля гри: над ним — табличка з назвою (`controller.renderGame`). */
const TOP = 46;

abstract class FarmGame implements MiniGame {
  abstract readonly title: string;
  abstract readonly hint: string;
  done = false;
  score = 0;
  tally: Record<string, number> = {};
  summary: string[] = [];
  protected t = 0;
  update(dt: number): void {
    this.t += dt;
    if (!this.done) this.step(dt);
  }
  protected abstract step(dt: number): void;
  abstract render(kit: Kit): void;
  abstract tap(x: number, y: number, kit: Kit): void;
  protected count(key: string, by = 1): void {
    this.tally[key] = (this.tally[key] ?? 0) + by;
  }
  protected finish(score: number, summary: string[]): void {
    if (this.done) return;
    this.score = clamp01(score);
    this.summary = summary;
    this.done = true;
    if (this.score >= 0.5) sfx.tada();
  }
}

// ------------------------------------------------------------
// Спільне малювання.
// ------------------------------------------------------------

/** Лінія завтовшки `w` піксель за пікселем. */
function line(kit: Kit, x0: number, y0: number, x1: number, y1: number, color: string, w = 1): void {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
  for (let k = 0; k <= n; k += 1) {
    const x = x0 + ((x1 - x0) * k) / n;
    const y = y0 + ((y1 - y0) * k) / n;
    kit.rect(Math.round(x - (w - 1) / 2), Math.round(y - (w - 1) / 2), w, w, color);
  }
}

/**
 * Збільшення сцени: на високому екрані телефона (поле вище за 300
 * віртуальних пікселів) Лєну, кошик, курей і рибу видно лише вдвічі більшими.
 */
export function sceneZoom(kit: Kit): number {
  return kit.H - TOP >= 300 && kit.W >= 200 ? 2 : 1;
}

/** Намалювати `draw` збільшеним у `z` разів довкола точки (px, py) — піксель лишається пікселем. */
function zoomed(kit: Kit, px: number, py: number, z: number, draw: () => void): void {
  if (z === 1) { draw(); return; }
  const g = kit.g;
  g.save();
  g.translate(Math.round(px), Math.round(py));
  g.scale(z, z);
  g.translate(-Math.round(px), -Math.round(py));
  draw();
  g.restore();
}

/** Плетений кошик: (x, y) — середина верхнього краю. `items` — що лежить зверху. */
function basket(kit: Kit, x: number, y: number, items: readonly string[] = [], w = 18): void {
  const h = Math.round(w * 0.6);
  const x0 = Math.round(x - w / 2);
  const y0 = Math.round(y);
  // Ручка — дуга над кошиком.
  for (let k = -6; k <= 6; k += 1) {
    const hy = y0 - Math.round(Math.sqrt(Math.max(0, 36 - k * k)) * 1.1);
    kit.rect(Math.round(x) + k, hy, 1, 2, '#7a4a24');
  }
  // Те, що в кошику, виглядає з-за краю.
  items.slice(-9).forEach((c, i) => {
    const ix = x0 + 3 + ((i * 5) % (w - 6));
    const iy = y0 - 2 - Math.floor(i / 3);
    kit.disc(ix + 1, iy + 1, 2, c);
    kit.rect(ix, iy - 1, 1, 1, shade(c, 0.4));
  });
  kit.rect(x0, y0, w, h, '#8a5a2c');
  for (let r = 0; r < h; r += 2) {
    for (let c = (r / 2) % 2 ? 1 : 0; c < w; c += 2) kit.rect(x0 + c, y0 + r, 1, 1, '#b07a40');
  }
  kit.rect(x0 - 1, y0, w + 2, 2, '#c08a4a');
  kit.rect(x0 - 1, y0 + 2, w + 2, 1, '#6a3e1c');
  kit.rect(x0 + 1, y0 + h, w - 2, 1, '#5a3218');
}

export type BasketPose = 'front' | 'ul' | 'dl' | 'ur' | 'dr';

/**
 * Лєна з кошиком у руках, намальована для ігор садиби (власник: «анімації
 * Лєни в цій грі з кошиком в руках»): `x` — середина, `y` — стопи. Кошик —
 * перед собою (`front`) або вгору чи вниз, ліворуч чи праворуч (курник).
 * Кольори, зачіска й зріст — з її теперішнього вигляду. Повертає, де верх
 * кошика: туди падають фрукти й скочуються яйця.
 */
export function lenaWithBasket(kit: Kit, look: Look, x: number, y: number, pose: BasketPose, t: number, happy: boolean, items: readonly string[] = [], z = 1): { bx: number; by: number; half: number } {
  zoomed(kit, x, y, z, () => drawLena(kit, look, Math.round(x), Math.round(y), pose, t, happy, items));
  return basketAt(look, x, y, pose, z);
}

/** Пів ширини кошика (без збільшення). */
const basketHalf = (look: Look) => (look.kid ? 8 : 9);

/**
 * Де Лєна тримає кошик: середина верхнього краю й пів ширини, зі
 * збільшенням `z` довкола стоп (x, y). Без дихання — ловити не заважає.
 */
export function basketAt(look: Look, x: number, y: number, pose: BasketPose, z = 1): { bx: number; by: number; half: number } {
  const p = lenaPose(look, Math.round(x), Math.round(y), pose, 0);
  return { bx: Math.round(x) + (p.bx - Math.round(x)) * z, by: Math.round(y) + (p.by - Math.round(y)) * z, half: basketHalf(look) * z };
}

/** Скелет пози: стегна, плечі, голова й кошик для стоп у (x, y). */
function lenaPose(look: Look, x: number, y: number, pose: BasketPose, breath: number) {
  const kid = !!look.kid;
  const legH = kid ? 7 : 11;
  const bodyH = kid ? 12 : 16;
  const headR = 7;
  const side = pose === 'ul' || pose === 'dl' ? -1 : pose === 'ur' || pose === 'dr' ? 1 : 0;
  const up = pose === 'ul' || pose === 'ur';
  // Нахил до кошика.
  const lean = side * (up ? 1 : 2);
  const hipY = y - legH;
  const shoulderY = hipY - bodyH + breath;
  const headY = shoulderY - headR - 1;
  const cx = Math.round(x + lean);
  const bx = side === 0 ? cx : cx + side * (kid ? 15 : 17);
  const by = side === 0 ? hipY - 4 : up ? shoulderY - (kid ? 9 : 11) : hipY - 2;
  return { kid, legH, bodyH, headR, side, hipY, shoulderY, headY, cx, bx, by };
}

function drawLena(kit: Kit, look: Look, x: number, y: number, pose: BasketPose, t: number, happy: boolean, items: readonly string[]): void {
  // Легке дихання.
  const { kid, legH, bodyH, headR, side, hipY, shoulderY, headY, cx, bx, by } = lenaPose(look, x, y, pose, Math.round(Math.sin(t * 3) * 0.6));
  // Тінь.
  kit.ellipse(x, y, kid ? 9 : 11, 2, 'rgba(28,20,40,0.28)');
  // Ноги й взуття.
  const legW = kid ? 3 : 4;
  for (const dx of [-3, 2]) {
    kit.rect(Math.round(x) + dx - (dx < 0 ? legW - 3 : 0), hipY, legW - 1, legH - 2, look.dress ? look.skin : look.bottom);
    kit.rect(Math.round(x) + dx - (dx < 0 ? legW - 3 : 0) - (dx < 0 ? 1 : 0), y - 3, legW, 3, look.shoes);
  }
  // Тулуб: сукня розширюється донизу, верх із джинсами — прямий.
  if (look.dress) {
    for (let r = 0; r <= bodyH; r += 1) {
      const half = (kid ? 5 : 6) + Math.floor((r / bodyH) * (kid ? 3 : 4));
      kit.rect(cx - half, shoulderY + r, half * 2, 1, r > bodyH * 0.45 ? look.bottom : look.top);
    }
    kit.rect(cx - (kid ? 5 : 6), shoulderY + Math.round(bodyH * 0.45), (kid ? 5 : 6) * 2, 1, shade(look.top, -0.2));
  } else {
    kit.rect(cx - 6, shoulderY, 12, Math.round(bodyH * 0.6), look.top);
    kit.rect(cx - 6, shoulderY + Math.round(bodyH * 0.6), 12, bodyH - Math.round(bodyH * 0.6) + 1, look.bottom);
    kit.rect(cx - 6, shoulderY + Math.round(bodyH * 0.6), 12, 1, shade(look.bottom, -0.25));
  }
  kit.rect(cx - 6, shoulderY, 12, 1, shade(look.top, 0.25));
  // Кошик і руки до нього.
  for (const hand of [-1, 1]) {
    const sx = cx + hand * 6;
    const sy = shoulderY + 2;
    const hx = bx + hand * 5;
    const hy = by + 2;
    line(kit, sx, sy, hx, hy, look.skin, 2);
    if (!look.dress || kid) line(kit, sx, sy, sx + (hx - sx) * 0.25, sy + (hy - sy) * 0.25, look.top, 3);
  }
  // Голова: волосся позаду, обличчя, волосся спереду.
  if (look.hairStyle === 'long') kit.rect(cx - headR, headY - 1, headR * 2, headR + 8, shade(look.hair, -0.1));
  if (look.hairStyle === 'ponytail') {
    const sway = Math.round(Math.sin(t * 4) * 1.5) - side * 2;
    kit.rect(cx - 2 - side * 6 + sway, headY - headR + 1, 4, 3, look.hair);
    kit.rect(cx - 1 - side * 7 + sway, headY - headR + 4, 3, 9, shade(look.hair, -0.1));
  }
  kit.disc(cx, headY, headR, look.skin);
  kit.rect(cx - headR, headY - headR - 1, headR * 2 + 1, 5, look.hair);
  kit.rect(cx - headR - 1, headY - headR + 2, 3, headR + 2, look.hair);
  kit.rect(cx + headR - 1, headY - headR + 2, 3, headR + 2, look.hair);
  kit.rect(cx - 3 + side, headY - headR + 3, 7, 2, shade(look.hair, 0.15));
  if (look.hairStyle === 'pigtails') {
    for (const s of [-1, 1]) {
      kit.disc(cx + s * (headR + 2), headY + 2, 3, look.hair);
      kit.rect(cx + s * (headR + 1) - 1, headY - 2, 3, 2, look.bow ?? '#ff5d8f');
    }
  }
  // Обличчя дивиться туди, де кошик.
  const ex = cx + side * 2;
  kit.rect(ex - 4, headY, 2, 2, look.eyes);
  kit.rect(ex + 2, headY, 2, 2, look.eyes);
  kit.rect(ex - 4, headY, 1, 1, '#ffffff');
  kit.rect(ex + 2, headY, 1, 1, '#ffffff');
  kit.rect(ex - 5, headY + 3, 2, 1, '#f4a3a0');
  kit.rect(ex + 3, headY + 3, 2, 1, '#f4a3a0');
  if (happy) { kit.rect(ex - 1, headY + 4, 3, 2, '#b8323a'); kit.rect(ex, headY + 5, 1, 1, '#ff8a8a'); }
  else kit.rect(ex - 1, headY + 4, 3, 1, '#b8323a');
  basket(kit, bx, by, items, basketHalf(look) * 2);
}

// ------------------------------------------------------------
// 1. Сад: фрукти падають — лови в кошик.
// ------------------------------------------------------------
const FRUIT_LOOK: Record<Fruit, { body: string; dark: string; light: string }> = {
  apple: { body: '#e0402e', dark: '#9a2418', light: '#ff9a7a' },
  plum: { body: '#5a3a8a', dark: '#36205a', light: '#9a7ad0' },
  pear: { body: '#c8d24a', dark: '#8a9a2a', light: '#f2f0a0' },
};

function drawFruit(kit: Kit, kind: Fruit, x: number, y: number, r = 4): void {
  const c = FRUIT_LOOK[kind];
  const xr = Math.round(x);
  const yr = Math.round(y);
  if (kind === 'pear') {
    kit.disc(xr, yr + 1, r, c.body);
    kit.disc(xr, yr - r + 2, r - 2, c.body);
    kit.rect(xr - r + 1, yr + r - 1, r * 2 - 1, 1, c.dark);
  } else if (kind === 'plum') {
    kit.ellipse(xr, yr, r - 1, r, c.body);
    kit.rect(xr, yr - r + 1, 1, r * 2 - 2, c.dark);
  } else {
    kit.disc(xr, yr, r, c.body);
    kit.rect(xr - r + 1, yr + r - 1, r * 2 - 1, 1, c.dark);
  }
  kit.rect(xr - Math.round(r / 2), yr - Math.round(r / 2), 2, 1, c.light);
  kit.rect(xr, yr - r - (kind === 'pear' ? 3 : 1), 1, 2, '#5a3a24');
  if (kind === 'apple') kit.rect(xr + 1, yr - r - 1, 2, 1, '#5aa04a');
}

interface FallingFruit {
  kind: Fruit;
  /** Частки поля: x — ширини, y — від крони (0) до землі (1). */
  x: number;
  y: number;
  vy: number;
  /** Скільки ще висить і хитається, перш ніж зірватись. */
  hang: number;
  state: 'fall' | 'ground' | 'caught';
  t: number;
}

/** Дерева саду: де стоїть і що родить. Груші — рідше, бо дорожчі. */
const ORCHARD_TREES: readonly { x: number; kind: Fruit; odds: number }[] = [
  { x: 0.2, kind: 'apple', odds: 0.45 },
  { x: 0.5, kind: 'plum', odds: 0.33 },
  { x: 0.8, kind: 'pear', odds: 0.22 },
];

/** Скільки фруктів зривається за гру: вистачає, щоб наповнити кошик, але не з запасом. */
export const ORCHARD_DROPS = 30;

export class OrchardGame extends FarmGame {
  title = 'Сад';
  hint = `Веди Лєну пальцем — лови фрукти в кошик (до ${BASKET_MAX})`;
  /** Де Лєна (частка ширини) і куди йде. */
  lena = 0.5;
  private target = 0.5;
  private keys = new Set<string>();
  fruits: FallingFruit[] = [];
  private spawned = 0;
  private next = 0.6;
  caught: Fruit[] = [];
  private joy = 0;
  /** Де кошик у полі (частки): висота верху й пів ширини разом із фруктом. */
  catchY = 0.84;
  catchHalf = 0.085;
  constructor(private ctx: GameContext) {
    super();
  }

  /** Швидкість падіння росте з кожним зірваним фруктом. */
  private gravity(): number {
    return 0.9 + (this.spawned / ORCHARD_DROPS) * 0.7;
  }

  protected step(dt: number): void {
    this.joy = Math.max(0, this.joy - dt);
    // Лєна йде до пальця, клавіші — повільніше.
    if (this.keys.has('arrowleft') || this.keys.has('a')) this.target = clamp(this.lena - 0.6 * dt * 3, 0.08, 0.92);
    if (this.keys.has('arrowright') || this.keys.has('d')) this.target = clamp(this.lena + 0.6 * dt * 3, 0.08, 0.92);
    const d = this.target - this.lena;
    this.lena += Math.sign(d) * Math.min(Math.abs(d), 0.95 * dt);
    // Нові фрукти.
    this.next -= dt;
    if (this.next <= 0 && this.spawned < ORCHARD_DROPS) {
      const r = this.ctx.rng;
      let roll = r();
      const tree = ORCHARD_TREES.find((tr) => (roll -= tr.odds) < 0) ?? ORCHARD_TREES[0]!;
      this.fruits.push({ kind: tree.kind, x: clamp(tree.x + (r() - 0.5) * 0.24, 0.06, 0.94), y: r() * 0.1, vy: 0, hang: 0.45, state: 'fall', t: 0 });
      this.spawned += 1;
      this.next = Math.max(0.5, 1.05 - this.spawned * 0.018) * (0.75 + r() * 0.5);
    }
    for (const f of this.fruits) {
      f.t += dt;
      if (f.state !== 'fall') continue;
      if (f.hang > 0) { f.hang -= dt; continue; }
      f.vy += this.gravity() * dt;
      const before = f.y;
      f.y += f.vy * dt;
      // Кошик — там, де його намалювано востаннє (`catchY`, `catchHalf`).
      if (before < this.catchY && f.y >= this.catchY && Math.abs(f.x - this.lena) < this.catchHalf && this.caught.length < BASKET_MAX) {
        f.state = 'caught';
        this.caught.push(f.kind);
        this.count(f.kind);
        this.joy = 0.35;
        sfx.good();
        if (this.caught.length >= BASKET_MAX) this.end();
      } else if (f.y >= 1) {
        f.y = 1;
        f.state = 'ground';
        f.t = 0;
        sfx.blip();
      }
    }
    this.fruits = this.fruits.filter((f) => f.state === 'fall' || (f.state === 'ground' && f.t < 1.6));
    if (this.spawned >= ORCHARD_DROPS && this.fruits.every((f) => f.state !== 'fall')) this.end();
  }

  private end(): void {
    const money = this.caught.reduce((s, k) => s + FRUIT_PRICE[k], 0);
    this.finish(this.caught.length / BASKET_MAX, [this.caught.length >= BASKET_MAX ? 'Кошик повний!' : `Зібрано ${this.caught.length} з ${BASKET_MAX}`, `+${money} ₴`]);
  }

  point(x: number, _y: number, kit: Kit): void {
    this.target = clamp(x / kit.W, 0.08, 0.92);
  }
  tap(x: number, y: number, kit: Kit): void {
    this.point(x, y, kit);
  }
  key(key: string, down: boolean): void {
    if (down) this.keys.add(key);
    else this.keys.delete(key);
  }

  render(kit: Kit): void {
    const { W, H } = kit;
    const z = sceneZoom(kit);
    const portrait = H - TOP > W * 1.3;
    const ground = H - 8;
    // Де фрукт зривається (низ крон) — звідти й рахується падіння.
    const crownY = portrait ? this.renderCanopyScene(kit, ground) : this.renderTrees(kit, ground, z);
    const span = ground - crownY;
    // Лєна з кошиком; звідси ж — де кошик ловить.
    const lx = this.lena * W;
    const colors = this.caught.map((k) => FRUIT_LOOK[k].body);
    const fr = 4 * z;
    const spot = lenaWithBasket(kit, this.ctx.lena, lx, ground + 2, 'front', this.t, this.joy > 0, colors, z);
    this.catchY = clamp01((spot.by - crownY) / span);
    this.catchHalf = (spot.half + fr) / W;
    // Фрукти: що висить — хитається, що падає — летить, що впало — лежить.
    for (const f of this.fruits) {
      if (f.state === 'caught') continue;
      const wob = f.hang > 0 ? Math.round(Math.sin(f.t * 30) * z) : 0;
      const fx = Math.round(f.x * W + wob);
      const fy = Math.round(f.state === 'ground' ? ground - 2 * z : crownY + f.y * span);
      zoomed(kit, fx, fy, z, () => drawFruit(kit, f.kind, fx, fy));
    }
    // Лічильник.
    const money = this.caught.reduce((s, k) => s + FRUIT_PRICE[k], 0);
    kit.text(`Кошик ${this.caught.length}/${BASKET_MAX}`, W * 0.28, TOP + 6, { size: 10 });
    kit.text(`+${money} ₴`, W * 0.78, TOP + 6, { size: 10, color: '#ffe48a' });
    kit.region('any', 0, 0, W, H);
  }

  /** Лежачи (комп'ютер): три дерева в повний зріст. Повертає низ крон. */
  private renderTrees(kit: Kit, ground: number, z: number): number {
    const { W, H } = kit;
    const R = Math.round(Math.min(W * 0.17, (H - TOP) * 0.22));
    const crownY = TOP + 6 + Math.round(R * 0.7);
    kit.backdrop('yard');
    kit.rect(0, TOP, W, ground - TOP, '#9ed4ef');
    kit.ellipse(W * 0.3, ground - 4, W * 0.5, 14, '#86c46a');
    kit.ellipse(W * 0.85, ground - 2, W * 0.4, 10, '#7ab85e');
    kit.rect(0, ground - 6, W, H - ground + 6, '#78c25a');
    for (let k = 0; k < 60; k += 1) kit.rect((k * 37) % W, ground - 4 + ((k * 13) % 10), 1, 2, k % 3 ? '#5fa648' : '#94d46a');
    for (const tr of ORCHARD_TREES) {
      const tx = Math.round(tr.x * W);
      const tw = Math.max(5, Math.round(R * 0.16));
      kit.rect(tx - tw / 2, crownY, tw, ground - crownY, '#7a4a2a');
      kit.rect(tx - tw / 2, crownY, 2, ground - crownY, '#9a6a3a');
      kit.rect(tx + tw / 2 - 1, crownY, 1, ground - crownY, '#5a3218');
      line(kit, tx, crownY + R * 0.5, tx - R * 0.5, crownY + R * 0.1, '#7a4a2a', 2);
      line(kit, tx, crownY + R * 0.6, tx + R * 0.55, crownY + R * 0.15, '#7a4a2a', 2);
      crown(kit, tx, crownY, R);
      hangingFruit(kit, tr.kind, tx, crownY, R, 9, z);
    }
    return crownY;
  }

  /**
   * Стоячи (телефон): Лєна стоїть під деревами. Крони — суцільне склепіння
   * вгорі, стовбури крайніх дерев обрамлюють кадр, а між ними — далекий
   * сад, тин і пагорби. Дерево на всю висоту телефона було б тичкою.
   * Повертає низ крон.
   */
  private renderCanopyScene(kit: Kit, ground: number): number {
    const { W, H } = kit;
    const z = sceneZoom(kit);
    const g = kit.g;
    const horizon = ground - Math.round((H - TOP) * 0.24);
    // Небо з хмарками.
    const sky = g.createLinearGradient(0, TOP, 0, horizon);
    sky.addColorStop(0, '#8fd3f4');
    sky.addColorStop(1, '#e2f5fb');
    g.fillStyle = sky;
    g.fillRect(0, TOP - 4, W, horizon - TOP + 4);
    for (let k = 0; k < 3; k += 1) {
      const cx = ((k * 101 + this.t * 3) % (W + 60)) - 30;
      const cy = TOP + 150 + k * 52;
      kit.ellipse(cx, cy, 18, 5, '#ffffff');
      kit.ellipse(cx + 9, cy - 3, 10, 5, '#ffffff');
    }
    // Далекі пагорби й ряд садових дерев.
    kit.ellipse(W * 0.25, horizon + 2, W * 0.45, 22, '#a8d88a');
    kit.ellipse(W * 0.8, horizon + 4, W * 0.4, 16, '#9ccf80');
    for (let x = 6; x < W; x += 23) {
      const h = 9 + ((x * 7) % 5);
      kit.rect(x, horizon - 4, 2, 6, '#8a6a52');
      kit.disc(x + 1, horizon - 4 - h / 2, Math.round(h / 1.6), (x / 23) % 2 ? '#86c46a' : '#7ab85e');
      kit.rect(x - 2, horizon - 6 - h / 2, 1, 1, (x / 23) % 3 ? '#e0402e' : '#c8d24a');
      kit.rect(x + 3, horizon - 3 - h / 2, 1, 1, '#e0402e');
    }
    // Трава й тин.
    kit.rect(0, horizon + 2, W, H - horizon, '#86c46a');
    kit.rect(0, Math.round((horizon + ground) / 2), W, H, '#7cc25e');
    for (let k = 0; k < 90; k += 1) kit.rect((k * 37) % W, horizon + 6 + ((k * 13) % (H - horizon - 6)), 1, 2, k % 3 ? '#5fa648' : '#94d46a');
    for (let x = 2; x < W; x += 16) {
      kit.rect(x, horizon - 2, 3, 14, '#a07850');
      kit.rect(x, horizon - 2, 3, 1, '#c09a6a');
    }
    kit.rect(0, horizon + 1, W, 2, '#b08860');
    kit.rect(0, horizon + 7, W, 2, '#b08860');
    // Стовбури крайніх дерев — по краях кадру, з гілкою під крону.
    const R = Math.round(W * 0.22);
    const cy = TOP + Math.round(R * 0.55);
    for (const side of [-1, 1] as const) {
      const tx = side < 0 ? 8 : W - 8;
      const tw = 11 * z;
      const x0 = Math.round(tx - tw / 2);
      kit.rect(x0, cy, tw, ground - cy + 4, '#7a4a2a');
      kit.rect(x0 + (side < 0 ? tw - 3 : 0), cy, 3, ground - cy + 4, side < 0 ? '#9a6a3a' : '#5a3218');
      for (let y = cy + 14; y < ground - 6; y += 19) kit.rect(x0 + 3 + ((y * 5) % (tw - 8)), y, 3, 6, '#5a3218');
      // Корінь розходиться в траві.
      kit.ellipse(tx, ground + 1, tw * 0.8, 3, '#6a3e1c');
      line(kit, tx, cy + R * 0.9, tx - side * R * 0.9, cy + R * 0.25, '#7a4a2a', 3 * z);
    }
    // Крони: суцільне склепіння, між деревами — ще листя.
    for (const [x, y, rr] of [[0, 0.15, 0.7], [W * 0.35, -0.2, 0.6], [W * 0.65, -0.2, 0.6], [W, 0.15, 0.7]] as const) {
      kit.disc(x, cy + y * R, Math.round(rr * R), '#3f8a34');
    }
    for (const tr of ORCHARD_TREES) crown(kit, Math.round(tr.x * W), cy, R);
    for (const tr of ORCHARD_TREES) hangingFruit(kit, tr.kind, Math.round(tr.x * W), cy, R, 6, z);
    return cy + Math.round(R * 0.3);
  }
}

/** Крона з купок листя довкола (x, y) радіусом `R`. */
function crown(kit: Kit, x: number, y: number, R: number): void {
  for (const [dx, dy, rr, c] of [[-0.6, 0.25, 0.55, '#3f8a34'], [0.6, 0.25, 0.55, '#3f8a34'], [0, 0, 0.75, '#4f9a3c'], [-0.35, -0.3, 0.5, '#5fae48'], [0.4, -0.25, 0.45, '#5fae48'], [-0.1, -0.5, 0.35, '#79c25c'], [0.15, 0.35, 0.4, '#5fae48']] as const) {
    kit.disc(x + dx * R, y + dy * R, Math.round(rr * R), c);
  }
}

/** Фрукти, що висять у кроні: `n` штук, розкидані без костей. */
function hangingFruit(kit: Kit, kind: Fruit, x: number, y: number, R: number, n: number, z: number): void {
  for (let k = 0; k < n; k += 1) {
    const fx = Math.round(x - R * 0.7 + ((k * 23 * z) % Math.round(R * 1.4)));
    const fy = Math.round(y - R * 0.3 + ((k * 13 * z) % Math.round(R * 0.8)));
    zoomed(kit, fx, fy, z, () => drawFruit(kit, kind, fx, fy, 3));
  }

}

// ------------------------------------------------------------
// 2. Город: збирати урожай, гнати кротів, виривати бур'яни.
// ------------------------------------------------------------
interface Plot {
  crop: Crop;
  /** 0 — щойно посаджено, 1 — паросток, 2 — росте, 3 — достигло. */
  stage: number;
  grow: number;
  /** Бур'ян: 0 — нема, 1 — малий, 2 — великий (глушить). */
  weed: number;
  weedT: number;
  /** Кріт вигулькнув: скільки ще сидить. */
  mole: number;
  /** Кроту дали по голові: мить зірочок. */
  bonk: number;
  /** Щойно зібрано: мить відблиску. */
  picked: number;
}

/** Скільки триває город. */
export const GARDEN_S = 45;
/** Скільки урожаю — «чудово». */
const GARDEN_GOAL = 14;

/** Ділянок на городі: п'ять культур по три кущі. */
export const GARDEN_PLOTS = CROPS.length * 3;

/** Колір зібраного в маминому кошику. */
const CROP_COLOR: Record<Crop, string> = { potato: '#c9a46a', cabbage: '#bfe6a0', carrot: '#f08a2a', beet: '#8a1a3a', corn: '#f2c84a' };

/** Що каже мама, коли Лєна збирає (по черзі, без костей). */
const MOM_PRAISE = ['Молодець!', 'Оце врожай!', 'Гарна!', 'Ще трохи!'] as const;

interface GardenLayout {
  x0: number;
  y0: number;
  cw: number;
  ch: number;
  /** Стоячи (телефон): ряд — одна культура, 3×5. Лежачи: стовпець — культура, 5×3. */
  portrait: boolean;
}

export class GardenGame extends FarmGame {
  title = 'Город із мамою';
  hint = 'Торкайся достиглого — збирай. Кротів — по голові, бур\'ян — геть!';
  plots: Plot[];
  private nextWeed = 2.2;
  private nextMole = 2.8;
  /** Що зібрано, по порядку: кольори в маминому кошику. */
  private basketItems: string[] = [];
  private momSays = '';
  private momT = 0;
  /** Де ділянки на екрані (останнє малювання) — для дотиків. */
  private layout: GardenLayout | null = null;
  constructor(private ctx: GameContext) {
    super();
    const r = ctx.rng;
    // Ділянка i родить культуру i % 5: так грядка — одна культура в будь-якій розкладці.
    this.plots = Array.from({ length: GARDEN_PLOTS }, (_, i) => ({
      crop: CROPS[i % CROPS.length]!,
      stage: Math.floor(r() * 3),
      grow: 1 + r() * 2.5,
      weed: 0,
      weedT: 0,
      mole: 0,
      bonk: 0,
      picked: 0,
    }));
  }

  protected step(dt: number): void {
    const r = this.ctx.rng;
    this.momT = Math.max(0, this.momT - dt);
    if (this.t >= GARDEN_S) {
      const crops = CROPS.reduce((s, c) => s + (this.tally[c] ?? 0), 0);
      const extra = (this.tally.moles ?? 0) * 0.5 + (this.tally.weeds ?? 0) * 0.3;
      this.finish((crops + extra) / GARDEN_GOAL, [`Урожаю: ${crops}`, `Кротів: ${this.tally.moles ?? 0} · бур'янів: ${this.tally.weeds ?? 0}`]);
      return;
    }
    // Чим далі, тим частіше кроти й бур'яни.
    const pace = 1 + this.t / GARDEN_S;
    for (const p of this.plots) {
      p.bonk = Math.max(0, p.bonk - dt);
      p.picked = Math.max(0, p.picked - dt);
      if (p.mole > 0) {
        p.mole -= dt;
        // Не прогнала — кріт підгриз: ділянку саджати заново.
        if (p.mole <= 0) { p.stage = 0; p.grow = 2 + r() * 2; }
        continue;
      }
      if (p.weed > 0) {
        p.weedT += dt;
        if (p.weed === 1 && p.weedT > 3) { p.weed = 2; p.weedT = 0; }
        // Великий бур'ян глушить: урожай не росте, а згодом і пропадає.
        if (p.weed === 2 && p.weedT > 4 && p.stage > 0) { p.stage = 0; p.grow = 2.5 + r() * 2; }
        continue;
      }
      if (p.stage < 3) {
        p.grow -= dt;
        if (p.grow <= 0) { p.stage += 1; p.grow = 2.2 + r() * 2.3; }
      }
    }
    this.nextWeed -= dt * pace;
    if (this.nextWeed <= 0) {
      const free = this.plots.filter((p) => p.weed === 0 && p.mole <= 0);
      if (free.length) { const p = free[Math.floor(r() * free.length)]!; p.weed = 1; p.weedT = 0; }
      this.nextWeed = 2.4 + r() * 1.6;
    }
    this.nextMole -= dt * pace;
    if (this.nextMole <= 0) {
      const ripe = this.plots.filter((p) => p.mole <= 0 && p.stage > 0);
      if (ripe.length) {
        const p = ripe[Math.floor(r() * ripe.length)]!;
        p.mole = Math.max(1.1, 1.8 - (this.t / GARDEN_S) * 0.6);
        this.say('Кріт!');
      }
      this.nextMole = 2.6 + r() * 2;
    }
  }

  private say(text: string): void {
    this.momSays = text;
    this.momT = 1.1;
  }

  /** Розкладка ділянок під екран. */
  private layoutFor(kit: Kit): GardenLayout {
    const { W, H } = kit;
    const portrait = H - TOP > W * 1.3;
    const cols = portrait ? 3 : CROPS.length;
    const rows = portrait ? CROPS.length : 3;
    const x0 = 8;
    const y0 = TOP + 16;
    const cw = Math.floor((W - 16) / cols);
    // Стоячи внизу ще стоїть мама з кошиком; ділянки — майже квадратні.
    const room = portrait ? 112 : 8;
    const ch = Math.min(portrait ? cw + 8 : 999, Math.floor((H - y0 - room) / rows));
    return { x0, y0, cw, ch, portrait };
  }

  /** Ділянка в стовпці `c` і ряду `r` розкладки. */
  plotAt(c: number, r: number, portrait: boolean): number {
    return portrait ? c * CROPS.length + r : r * CROPS.length + c;
  }

  /** Що на ділянці під дотиком: кріт, бур'ян, достигле — саме в такому порядку. */
  tap(x: number, y: number, kit: Kit): void {
    if (this.done) return;
    const l = this.layout ?? this.layoutFor(kit);
    const c = Math.floor((x - l.x0) / l.cw);
    const r = Math.floor((y - l.y0) / l.ch);
    const cols = l.portrait ? 3 : CROPS.length;
    const rows = l.portrait ? CROPS.length : 3;
    if (c < 0 || r < 0 || c >= cols || r >= rows) return;
    this.tapPlot(this.plotAt(c, r, l.portrait));
  }

  /** Дотик до ділянки `i`. */
  tapPlot(i: number): void {
    const p = this.plots[i]!;
    if (p.mole > 0) { p.mole = 0; p.bonk = 0.5; this.count('moles'); this.say('Так його!'); sfx.good(); return; }
    if (p.weed > 0) { p.weed = 0; p.weedT = 0; this.count('weeds'); sfx.blip(); return; }
    if (p.stage === 3) {
      this.count(p.crop);
      this.basketItems.push(CROP_COLOR[p.crop]);
      const n = CROPS.reduce((s, c) => s + (this.tally[c] ?? 0), 0);
      if (n % 3 === 1) this.say(MOM_PRAISE[Math.floor(n / 3) % MOM_PRAISE.length]!);
      p.stage = 0;
      p.grow = 2 + this.ctx.rng() * 2;
      p.picked = 0.45;
      sfx.coin();
      return;
    }
    sfx.bad();
  }

  render(kit: Kit): void {
    const { W, H } = kit;
    const z = sceneZoom(kit);
    const l = this.layoutFor(kit);
    this.layout = l;
    const { x0, y0, cw, ch, portrait } = l;
    const cols = portrait ? 3 : CROPS.length;
    const rows = portrait ? CROPS.length : 3;
    // Трава між грядками.
    kit.rect(0, TOP - 4, W, H - TOP + 4, '#78c25a');
    for (let k = 0; k < 90; k += 1) kit.rect((k * 53) % W, TOP + ((k * 37) % (H - TOP)), 1, 2, k % 3 ? '#5fa648' : '#94d46a');
    // Грядки — смуги темної землі з борозенками: стоячи — ряди, лежачи — стовпці.
    for (let b = 0; b < CROPS.length; b += 1) {
      const bx = portrait ? x0 : x0 + b * cw + 3;
      const by = portrait ? y0 + b * ch + Math.round(ch * 0.46) : y0 + 2;
      const bw = portrait ? cols * cw : cw - 6;
      const bh = portrait ? Math.round(ch * 0.44) : rows * ch - 4;
      kit.rect(bx, by, bw, bh, '#6a4428');
      kit.rect(bx, by, bw, 1, '#8a5a34');
      kit.rect(bx, by + bh - 1, bw, 1, '#4a2e18');
      if (portrait) for (let k = 3; k < bh - 2; k += 4) kit.rect(bx + 2, by + k, bw - 4, 1, '#5a3820');
      else for (let k = 4; k < bh - 3; k += 5) kit.rect(bx + 2, by + k, bw - 4, 1, '#5a3820');
    }
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        const i = this.plotAt(c, r, portrait);
        const p = this.plots[i]!;
        const cx = Math.round(x0 + c * cw + cw / 2);
        const base = portrait ? Math.round(y0 + r * ch + ch * 0.74) : y0 + (r + 1) * ch - 5;
        zoomed(kit, cx, base, z, () => {
          if (p.mole <= 0 || p.bonk > 0) drawCrop(kit, p.crop, p.stage, cx, base, this.t + i);
          if (p.weed > 0) drawWeed(kit, cx + 12, base, p.weed);
          if (p.mole > 0) drawMole(kit, cx, base - 2, this.t);
          if (p.bonk > 0) kit.icon('star', cx - 3, base - 12);
          if (p.picked > 0) kit.icon('star', cx - 3 + Math.round(Math.sin(p.picked * 20) * 2), base - 22 + p.picked * 10);
        });
        if (p.bonk > 0) kit.text('Бум!', cx, base - 18 * z, { size: 8, color: '#ffe48a' });
      }
    }
    if (portrait) {
      // Мама з кошиком унизу: що Лєна зібрала, те й у кошику.
      const my = H - 14;
      const mx = 34;
      kit.rect(0, my - 6, W, H - my + 6, '#86c46a');
      kit.person(MOM, mx, my, 3, 2, 0);
      basket(kit, mx + 40, my - 14, this.basketItems.slice(-9), 26);
      if (this.momT > 0) {
        const bw = Math.max(54, this.momSays.length * 5 + 10);
        const bx = mx + 22;
        const byy = my - 76;
        kit.rect(bx, byy, bw, 15, '#fff6e0');
        kit.rect(bx, byy + 15, bw, 1, '#c8a878');
        kit.rect(bx + 4, byy + 15, 4, 3, '#fff6e0');
        kit.text(this.momSays, bx + bw / 2, byy + 8, { size: 8, color: '#4a2a14', shadow: null });
      }
    }
    const crops = CROPS.reduce((s, c) => s + (this.tally[c] ?? 0), 0);
    kit.text(`Урожай ${crops} · кроти ${this.tally.moles ?? 0} · бур'яни ${this.tally.weeds ?? 0}`, W / 2, TOP + 6, { size: 8.5 });
    kit.bar(10, H - 6, W - 20, 3, 1 - this.t / GARDEN_S, '#f2c14e');
  }
}

/** Урожай на грядці: росте від паростка до достиглого (тоді — блиск). */
function drawCrop(kit: Kit, crop: Crop, stage: number, x: number, y: number, t: number): void {
  if (stage === 0) { kit.rect(x - 2, y - 1, 5, 1, '#4a2e18'); kit.rect(x - 1, y - 2, 3, 1, '#5a3820'); return; }
  if (stage === 1) {
    kit.rect(x, y - 4, 1, 4, '#5fa648');
    kit.rect(x - 2, y - 5, 2, 1, '#7ed957');
    kit.rect(x + 1, y - 5, 2, 1, '#7ed957');
    return;
  }
  const ripe = stage === 3;
  switch (crop) {
    case 'potato': {
      kit.disc(x, y - 6, 6, '#4f9a3c');
      kit.disc(x - 3, y - 8, 3, '#62b04a');
      kit.disc(x + 3, y - 9, 2, '#62b04a');
      if (ripe) {
        for (const [dx, c] of [[-5, '#f4f4f7'], [4, '#c9a0e8']] as const) kit.disc(x + dx, y - 11, 1, c);
        kit.ellipse(x - 4, y, 3, 2, '#c9a46a');
        kit.ellipse(x + 3, y + 1, 3, 2, '#b8925a');
      }
      break;
    }
    case 'cabbage': {
      const r = ripe ? 7 : 5;
      kit.disc(x, y - r + 1, r, '#7ab85e');
      kit.disc(x, y - r + 1, r - 2, ripe ? '#bfe6a0' : '#94d46a');
      kit.rect(x - 1, y - r - 1, 2, r * 2 - 2, '#6aa850');
      break;
    }
    case 'carrot': {
      for (let k = -2; k <= 2; k += 1) line(kit, x, y - 2, x + k * 2, y - (ripe ? 12 : 8), k % 2 ? '#62b04a' : '#7ed957');
      if (ripe) { kit.rect(x - 2, y - 2, 4, 4, '#f08a2a'); kit.rect(x - 1, y - 2, 1, 3, '#ffb060'); }
      break;
    }
    case 'beet': {
      for (const dx of [-3, 0, 3]) {
        kit.ellipse(x + dx, y - 7, 2, 4, '#5f9a46');
        kit.rect(x + dx, y - 9, 1, 6, '#b8325a');
      }
      if (ripe) kit.disc(x, y - 1, 4, '#8a1a3a');
      break;
    }
    case 'corn': {
      const h = ripe ? 22 : 14;
      kit.rect(x, y - h, 2, h, '#6aa850');
      for (let k = 0; k < 3; k += 1) line(kit, x + 1, y - h + 5 + k * 5, x + (k % 2 ? -6 : 7), y - h + 9 + k * 5, '#7ec45e');
      if (ripe) { kit.ellipse(x + 4, y - h + 9, 2, 5, '#f2c84a'); kit.rect(x + 4, y - h + 3, 1, 3, '#c8a050'); }
      break;
    }
  }
  if (ripe) {
    // Достигле блищить: зірочка-хрестик спалахує то з одного боку, то з другого.
    const on = Math.floor(t * 2.5) % 3;
    if (on < 2) {
      const sx = x + (on ? 6 : -6);
      const sy = y - 13 - on * 2;
      kit.rect(sx, sy - 1, 1, 3, '#fff6c8');
      kit.rect(sx - 1, sy, 3, 1, '#fff6c8');
    }
  }
}

function drawWeed(kit: Kit, x: number, y: number, size: number): void {
  const h = size === 2 ? 14 : 7;
  for (let i = -2; i <= 2; i += 1) line(kit, x, y, x + i * (size === 2 ? 3 : 2), y - h + Math.abs(i) * 2, i % 2 ? '#5a7a2a' : '#7a9a3a');
  if (size === 2) { kit.disc(x, y - h - 1, 2, '#f2d84a'); kit.rect(x - 1, y - h - 2, 3, 1, '#fff2a0'); }
}

function drawMole(kit: Kit, x: number, y: number, t: number): void {
  const bob = Math.round(Math.sin(t * 12) * 1);
  kit.ellipse(x, y + 2, 8, 3, '#4a2e18');
  kit.disc(x, y - 4 + bob, 5, '#5a4a42');
  kit.disc(x, y - 3 + bob, 3, '#7a6a62');
  kit.rect(x - 1, y - 4 + bob, 3, 2, '#f4a0b0');
  kit.rect(x - 3, y - 7 + bob, 1, 1, '#151015');
  kit.rect(x + 3, y - 7 + bob, 1, 1, '#151015');
  kit.rect(x - 6, y - 1 + bob, 3, 2, '#f4c0c8');
  kit.rect(x + 4, y - 1 + bob, 3, 2, '#f4c0c8');
}

// ------------------------------------------------------------
// 3. Курник: яйця котяться з чотирьох сідал — лови, як вовк у «Ну, погоди!».
// ------------------------------------------------------------
/** Жолоби: ліворуч угорі, ліворуч унизу, праворуч угорі, праворуч унизу. */
export const CHUTES: readonly BasketPose[] = ['ul', 'dl', 'ur', 'dr'];
/** Кроків по жолобу, перш ніж яйце скотиться в кошик (чи на підлогу). */
export const EGG_STEPS = 5;

/**
 * Скільки триває крок яйця по жолобу для `n`-го яйця (з 0). Власник: «які
 * починаються котитись швидше з кожним 5 яйцем».
 */
export function eggStepS(n: number): number {
  return [0.55, 0.45, 0.36, 0.28][Math.min(3, Math.floor(n / EGG_SPEEDUP_EVERY))]!;
}

interface Egg {
  chute: number;
  /** Крок по жолобу 0..EGG_STEPS-1; потім — у кошик чи на підлогу. */
  pos: number;
  t: number;
  state: 'roll' | 'caught' | 'broken';
  /** Скільки секунд у кінцевому стані (анімація). */
  after: number;
  step: number;
}

export class EggsGame extends FarmGame {
  title = 'Курник';
  hint = 'Торкайся кута — Лєна підставить кошик під жолоб';
  pose: BasketPose = 'dl';
  eggs: Egg[] = [];
  /** Скільки яєць уже покотилось (з `EGGS_PER_ROUND`). */
  launched = 0;
  caught = 0;
  broken = 0;
  /** Чим скінчилось кожне яйце, по черзі: лоток унизу. */
  results: ('caught' | 'broken')[] = [];
  private next = 1;
  private joy = 0;
  private laying = [0, 0, 0, 0];
  /** «Швидше!» — щойно яйця покотились швидше (з кожним п'ятим). */
  private faster = 0;
  /** Де що на екрані (останнє малювання) — для дотиків. */
  private scene: EggScene | null = null;
  constructor(private ctx: GameContext) {
    super();
  }

  protected step(dt: number): void {
    const r = this.ctx.rng;
    this.joy = Math.max(0, this.joy - dt);
    this.faster = Math.max(0, this.faster - dt);
    this.laying = this.laying.map((v) => Math.max(0, v - dt));
    this.next -= dt;
    if (this.next <= 0 && this.launched < EGGS_PER_ROUND) {
      // Яйце — з жолоба, де зараз нема свіжого яйця на верху.
      const free = [0, 1, 2, 3].filter((c) => !this.eggs.some((e) => e.state === 'roll' && e.chute === c && e.pos < 2));
      const chute = free.length ? free[Math.floor(r() * free.length)]! : Math.floor(r() * 4);
      const step = eggStepS(this.launched);
      if (this.launched > 0 && step < eggStepS(this.launched - 1)) this.faster = 1.6;
      this.eggs.push({ chute, pos: 0, t: 0, state: 'roll', after: 0, step });
      this.laying[chute] = 0.4;
      this.launched += 1;
      this.next = step * (2.2 + r() * 1.6);
    }
    for (const e of this.eggs) {
      if (e.state !== 'roll') { e.after += dt; continue; }
      e.t += dt;
      if (e.t < e.step) continue;
      e.t -= e.step;
      e.pos += 1;
      if (e.pos < EGG_STEPS) { sfx.step(); continue; }
      if (CHUTES[e.chute] === this.pose) { e.state = 'caught'; this.caught += 1; this.joy = 0.3; sfx.good(); }
      else { e.state = 'broken'; this.broken += 1; sfx.bad(); }
      this.results.push(e.state);
    }
    this.eggs = this.eggs.filter((e) => e.state === 'roll' || e.after < (e.state === 'broken' ? 1.4 : 0.3));
    this.tally = { eggs: this.caught, broken: this.broken };
    if (this.launched >= EGGS_PER_ROUND && this.eggs.every((e) => e.state !== 'roll')) {
      this.finish(this.caught / EGGS_PER_ROUND, [this.caught === EGGS_PER_ROUND ? 'Жодного не розбила!' : `Яєць у кошику: ${this.caught} з ${EGGS_PER_ROUND}`]);
    }
  }

  /** Куток екрана — куди підставити кошик: ліворуч чи праворуч від Лєни, вище чи нижче її пояса. */
  tap(x: number, y: number, kit: Kit): void {
    const sc = this.scene ?? this.sceneFor(kit);
    const left = x < sc.lx;
    const upper = y < sc.split;
    this.pose = left ? (upper ? 'ul' : 'dl') : upper ? 'ur' : 'dr';
  }
  key(key: string, down: boolean): void {
    if (!down) return;
    const left = this.pose === 'ul' || this.pose === 'dl';
    const upper = this.pose === 'ul' || this.pose === 'ur';
    const set = (l: boolean, u: boolean) => { this.pose = l ? (u ? 'ul' : 'dl') : u ? 'ur' : 'dr'; };
    if (key === 'q') set(true, true);
    else if (key === 'a') set(true, false);
    else if (key === 'p') set(false, true);
    else if (key === 'l') set(false, false);
    else if (key === 'arrowleft') set(true, upper);
    else if (key === 'arrowright') set(false, upper);
    else if (key === 'arrowup') set(left, true);
    else if (key === 'arrowdown') set(left, false);
  }

  /**
   * Сцена під екран: де підлога й Лєна, де жолоби. Кінець кожного жолоба —
   * над кошиком у тій позі, що його ловить (`basketAt`), тож яйце падає
   * саме туди, куди Лєна підставила кошик.
   */
  sceneFor(kit: Kit): EggScene {
    const { W, H } = kit;
    const z = sceneZoom(kit);
    const portrait = H - TOP > W * 1.3;
    // Стоячи під підлогою ще лоток для яєць.
    const floor = portrait ? H - 92 : H - 12;
    const lx = Math.round(W / 2);
    const look = this.ctx.lena;
    const slope = portrait ? 0.95 : 0.42;
    const chutes = CHUTES.map((pose) => {
      const b = basketAt(look, lx, floor + 1, pose, z);
      const left = pose === 'ul' || pose === 'dl';
      const x0 = left ? 6 + 8 * z : W - 6 - 8 * z;
      const y1 = b.by - 10 * z;
      return { x0, y0: Math.round(y1 - Math.abs(b.bx - x0) * slope), x1: b.bx, y1 };
    });
    const up = basketAt(look, lx, floor + 1, 'ul', z).by;
    const down = basketAt(look, lx, floor + 1, 'dl', z).by;
    return { z, portrait, floor, lx, chutes, split: Math.round((up + down) / 2) };
  }

  render(kit: Kit): void {
    const { W, H } = kit;
    const sc = this.sceneFor(kit);
    this.scene = sc;
    const { z, portrait, floor, lx } = sc;
    // Курник: стіна з дощок, балка під дахом, віконце зі світлом, солома на підлозі.
    kit.rect(0, TOP - 4, W, H - TOP + 4, '#8a5a34');
    for (let x = 0; x < W; x += 12) {
      kit.rect(x, TOP - 4, 11, floor - TOP + 4, x % 24 ? '#94643a' : '#8a5a34');
      kit.rect(x + 11, TOP - 4, 1, floor - TOP + 4, '#5a3218');
      for (let y = TOP + ((x * 7) % 19); y < floor - 4; y += 23) kit.rect(x + 3, y, 4, 1, '#7a4a28');
    }
    kit.rect(0, TOP - 4, W, 6, '#5a3218');
    kit.rect(0, TOP + 2, W, 1, '#3a1e0e');
    const winW = 28 * z;
    const winH = 16 * z;
    const winX = Math.round(W / 2 - winW / 2);
    // Стоячи віконце з жердиною — посередині стіни над курками на жолобах.
    const henTop = Math.min(...sc.chutes.map((c) => c.y0)) - 18 * z;
    const winY = portrait ? TOP + Math.max(18, Math.round((henTop - TOP - winH - 84) / 2)) : TOP + 6;
    if (portrait) {
      // Сонячна пляма на стіні під віконцем.
      for (let k = 0; k < 40; k += 1) {
        const y = winY + winH + k * 2;
        const spread = winW / 2 + k * 1.2;
        kit.rect(W / 2 - spread, y, spread * 2, 2, `rgba(255,236,170,${(0.13 * (1 - k / 40)).toFixed(3)})`);
      }
    }
    kit.rect(winX - 2, winY - 2, winW + 4, winH + 4, '#5a3218');
    kit.rect(winX, winY, winW, winH, '#bfe3f5');
    kit.disc(winX + winW - 6 * z, winY + 5 * z, 3 * z, '#fff2a0');
    kit.rect(winX + winW / 2 - z, winY, 2 * z, winH, '#5a3218');
    kit.rect(winX, winY + winH / 2 - z, winW, 2 * z, '#5a3218');
    if (portrait) this.renderRoost(kit, winY + winH + 64);
    // Підлога: солома.
    kit.rect(0, floor - 2, W, H - floor + 2, '#d8b860');
    for (let k = 0; k < 70; k += 1) line(kit, (k * 29) % W, floor - 1 + (k % 3) + (k % 7) * 2, (k * 29) % W + 4 - (k % 9), floor + 2 + (k % 4) + (k % 7) * 2, k % 2 ? '#c8a048' : '#f0d478');
    // Жолоби з сідалами й курками.
    const henKinds: BirdKind[] = ['white', 'brown', 'brown', 'white'];
    sc.chutes.forEach((ch, c) => {
      const left = c < 2;
      // Полиця-сідало з гніздом соломи.
      const sx = left ? 0 : ch.x0 - 6 * z;
      const sw = left ? ch.x0 + 6 * z : W - sx;
      kit.rect(sx, ch.y0 + 2 * z, sw, 3 * z, '#6a3e1c');
      kit.rect(sx, ch.y0 + 2 * z, sw, z, '#9a6a3a');
      kit.ellipse(ch.x0, ch.y0 + z, 9 * z, 3 * z, '#e8c860');
      line(kit, ch.x0 - 7 * z, ch.y0, ch.x0 + 7 * z, ch.y0 + z, '#c8a048', z);
      // Жолоб — дві дошки під нахилом.
      line(kit, ch.x0, ch.y0 + 5 * z, ch.x1, ch.y1 + 5 * z, '#5a3218', 2 * z);
      line(kit, ch.x0, ch.y0 + 3 * z, ch.x1, ch.y1 + 3 * z, '#b07a40', 2 * z);
      const lay = this.laying[c]! > 0;
      drawBirdSprite(kit.g, henKinds[c]!, left ? 2 : 1, lay ? 6 : 0, ch.x0 + (left ? -2 : 2) * z, ch.y0 + z - (lay ? z : 0), z);
    });
    // Яйця на жолобах: котяться крок за кроком, обертаючись. Розбиті — під
    // кінцем жолоба на соломі, курчатко тікає геть від Лєни.
    for (const e of this.eggs) {
      const ch = sc.chutes[e.chute]!;
      if (e.state === 'roll') {
        const k = (e.pos + 0.5) / EGG_STEPS;
        const ex = Math.round(ch.x0 + (ch.x1 - ch.x0) * k);
        const ey = Math.round(ch.y0 + (ch.y1 - ch.y0) * k);
        zoomed(kit, ex, ey, z, () => drawEgg(kit, ex, ey, e.pos));
      } else if (e.state === 'broken') {
        const out = e.chute < 2 ? -1 : 1;
        const fall = Math.min(1, e.after / 0.3);
        const ex = ch.x1 + out * 4 * z;
        if (fall < 1) {
          const ey = Math.round(ch.y1 + (floor - ch.y1) * fall);
          zoomed(kit, ex, ey, z, () => drawEgg(kit, ex, ey, e.pos + e.after * 10));
        } else zoomed(kit, ex, floor, z, () => drawBroken(kit, ex, floor, e.after, out));
      }
    }
    // Лєна з кошиком.
    const items = Array.from({ length: Math.min(9, this.caught) }, () => '#fbf3e4');
    lenaWithBasket(kit, this.ctx.lena, lx, floor + 1, this.pose, this.t, this.joy > 0, items, z);
    if (this.faster > 0) {
      const y = portrait ? winY + winH + 20 : TOP + 18;
      kit.text('Швидше!', W / 2, y - (1.6 - this.faster) * 4, { size: portrait ? 12 : 10, color: '#ffe48a' });
    }
    if (portrait) {
      kit.text(`Яєць ${this.caught} · розбито ${this.broken} · ще ${EGGS_PER_ROUND - this.launched}`, W / 2, floor + 12, { size: 8.5 });
      this.renderCarton(kit, floor + 22);
    } else {
      kit.text(`Яєць ${this.caught} · розбито ${this.broken} · ${EGGS_PER_ROUND - this.launched} ще`, W / 2, TOP + 30, { size: 8.5 });
    }
    kit.region('any', 0, 0, W, H);
  }

  /** Жердина під віконцем: кури й півень, що не несуться, а дивляться (лише на високому екрані). */
  private renderRoost(kit: Kit, y: number): void {
    const { W } = kit;
    const z = sceneZoom(kit);
    kit.rect(W * 0.18, y, W * 0.64, 2 * z, '#6a3e1c');
    kit.rect(W * 0.18, y, W * 0.64, z, '#9a6a3a');
    for (const x of [W * 0.2, W * 0.8]) kit.rect(Math.round(x), y, 2 * z, 10 * z, '#5a3218');
    const birds: readonly [BirdKind, 1 | 2, number][] = [['white', 2, 0.3], ['rooster', 1, 0.52], ['brown', 1, 0.72]];
    birds.forEach(([kind, dir, at], i) => {
      // Хтось дзьобне, хтось постоїть — по черзі, від часу гри.
      const phase = (this.t + i * 1.7) % 4;
      const col = phase < 1 ? 1 + BIRD_WALK_FRAMES + Math.min(BIRD_PECK_FRAMES - 1, Math.floor(phase * BIRD_PECK_FRAMES)) : 0;
      drawBirdSprite(kit.g, kind, dir, kind === 'rooster' ? 0 : col, Math.round(W * at), y + z, z);
    });
    // Півень співає, а коли яйця котяться швидше — кричить про це.
    const crow = this.faster > 0 || (this.t > 1.5 && this.t % 7 < 1.2);
    if (crow) {
      const bx = Math.round(W * 0.52);
      const by = y - 24 * z;
      kit.rect(bx - 34, by - 8, 68, 15, '#fff6e0');
      kit.rect(bx - 2, by + 7, 4, 3, '#fff6e0');
      kit.text('Ку-ку-рі-ку!', bx, by, { size: 8, color: '#b8323a', shadow: null });
    }
  }

  /** Лоток на двадцять яєць: що впіймала — яйце, що розбилось — шкаралупа й жовток. */
  private renderCarton(kit: Kit, y: number): void {
    const { W } = kit;
    const cols = EGGS_PER_ROUND / 2;
    const pitch = Math.min(24, Math.floor((W - 20) / cols));
    const x0 = Math.round(W / 2 - (pitch * cols) / 2);
    kit.rect(x0 - 4, y - 3, pitch * cols + 8, pitch * 2 + 6, '#8a7a68');
    kit.rect(x0 - 3, y - 2, pitch * cols + 6, pitch * 2 + 4, '#c8b8a0');
    for (let n = 0; n < EGGS_PER_ROUND; n += 1) {
      const cx = x0 + (n % cols) * pitch + pitch / 2;
      const cy = y + Math.floor(n / cols) * pitch + pitch / 2;
      const r = Math.floor(pitch * 0.4);
      kit.disc(cx, cy, r, '#a89880');
      kit.disc(cx, cy + 1, r - 1, '#988870');
      const got = this.results[n];
      if (got === 'caught') {
        kit.ellipse(cx, cy - 1, Math.round(r * 0.75), r, '#fbf3e4');
        kit.rect(cx - 2, cy - r + 2, 2, 1, '#ffffff');
      } else if (got === 'broken') {
        kit.ellipse(cx, cy + 1, r - 1, Math.round(r * 0.6), '#f8e8b0');
        kit.disc(cx, cy + 1, Math.round(r * 0.35), '#f6b62a');
        kit.rect(cx - r + 1, cy - 2, 3, 2, '#fbf3e4');
        kit.rect(cx + r - 3, cy - 3, 2, 3, '#fbf3e4');
      }
    }
  }
}

interface EggScene {
  z: number;
  portrait: boolean;
  /** Лінія підлоги; Лєна стоїть на ній. */
  floor: number;
  lx: number;
  /** Жолоби в порядку `CHUTES`: від гнізда (x0, y0) до краю над кошиком (x1, y1). */
  chutes: { x0: number; y0: number; x1: number; y1: number }[];
  /** Вище цієї лінії дотик підставляє кошик під верхній жолоб. */
  split: number;
}

function drawEgg(kit: Kit, x: number, y: number, roll: number): void {
  const xr = Math.round(x);
  const yr = Math.round(y);
  kit.ellipse(xr, yr, 3, 4, '#fbf3e4');
  kit.rect(xr - 3, yr + 2, 7, 1, '#e2d2b8');
  const spot = Math.floor(roll) % 4;
  kit.rect(xr - 1 + (spot === 1 ? 1 : spot === 3 ? -1 : 0), yr - 2 + (spot === 2 ? 2 : 0), 1, 1, '#ffffff');
}

/** Розбите яйце на соломі; згодом із нього вибігає курчатко — геть від Лєни (`out`), як у «Ну, погоди!». */
function drawBroken(kit: Kit, x: number, y: number, t: number, out: 1 | -1): void {
  kit.ellipse(x, y, 6, 2, '#f8e8b0');
  kit.disc(x, y - 1, 2, '#f6b62a');
  kit.rect(x - 6, y - 3, 3, 2, '#fbf3e4');
  kit.rect(x + 4, y - 4, 2, 3, '#fbf3e4');
  if (t > 0.4) {
    const cx = Math.round(x + out * (t - 0.4) * 30);
    const hop = Math.floor(t * 10) % 2;
    kit.disc(cx, y - 4 - hop, 2, '#ffe24a');
    kit.rect(cx + out * 2, y - 4 - hop, 1, 1, '#f08a2a');
    kit.rect(cx - 1, y - 2, 1, 2, '#f08a2a');
    kit.rect(cx + 1, y - 2, 1, 2, '#f08a2a');
  }
}

// ------------------------------------------------------------
// 4. Рибалка: закинути, дочекатись, підсікти.
// ------------------------------------------------------------
/** Скільки закидів за рибалку. */
export const CASTS = 5;
/** Скільки триває клювання — стільки є, щоб підсікти. */
export const BITE_S = 0.9;

type FishState = 'ready' | 'cast' | 'wait' | 'bite' | 'reveal' | 'miss';

const FISH_LOOK: Record<Fish, { body: string; dark: string; belly: string; fin: string; len: number }> = {
  karas: { body: '#c8a040', dark: '#8a6a24', belly: '#f0d890', fin: '#b0782a', len: 15 },
  okun: { body: '#8aa83a', dark: '#3a4a1a', belly: '#e0e8a0', fin: '#e0502a', len: 17 },
  korop: { body: '#d0902a', dark: '#8a5a1a', belly: '#f4d090', fin: '#b05a2a', len: 24 },
};

export class FishingGame extends FarmGame {
  title = 'Рибалка';
  hint = 'Торкнись — закинь. Поплавок пірнув — підсікай!';
  state: FishState = 'ready';
  private st = 0;
  /** Куди впав поплавок (частки ставка). */
  private float = { x: 0.6, y: 0.45 };
  private wait = 0;
  casts = 0;
  last: Fish | null = null;
  private message = '';
  constructor(private ctx: GameContext) {
    super();
  }

  protected step(dt: number): void {
    const r = this.ctx.rng;
    this.st += dt;
    if (this.state === 'cast' && this.st > 0.6) { this.state = 'wait'; this.st = 0; this.wait = 1.6 + r() * 3; }
    else if (this.state === 'wait' && this.st > this.wait) { this.state = 'bite'; this.st = 0; sfx.blip(); }
    else if (this.state === 'bite' && this.st > BITE_S) { this.miss('Зірвалась…'); }
    else if ((this.state === 'reveal' || this.state === 'miss') && this.st > 1.4) {
      if (this.casts >= CASTS) {
        const got = (this.tally.karas ?? 0) + (this.tally.okun ?? 0) + (this.tally.korop ?? 0);
        this.finish(got / CASTS, [got ? `Улов: ${got}` : 'Сьогодні не клювало']);
        return;
      }
      this.state = 'ready';
      this.st = 0;
    }
  }

  private miss(text: string): void {
    this.state = 'miss';
    this.st = 0;
    this.message = text;
    this.count('missed');
    sfx.bad();
  }

  tap(): void {
    if (this.done) return;
    const r = this.ctx.rng;
    if (this.state === 'ready') {
      this.casts += 1;
      this.state = 'cast';
      this.st = 0;
      this.float = { x: 0.35 + r() * 0.5, y: 0.3 + r() * 0.4 };
      sfx.blip();
      return;
    }
    // Рано смикнула — риба злякалась.
    if (this.state === 'wait') { this.miss('Рано! Риба злякалась'); return; }
    if (this.state === 'bite') {
      const fish = fishFor(r());
      this.last = fish;
      this.count(fish);
      this.state = 'reveal';
      this.st = 0;
      this.message = FISH_NAME[fish];
      sfx.good();
    }
  }

  render(kit: Kit): void {
    const { W, H } = kit;
    const z = sceneZoom(kit);
    const portrait = H - TOP > W * 1.3;
    const shore = TOP + (portrait ? 64 : 18);
    const bank = H - (portrait ? 118 : 26);
    // Небо, далекий берег з деревами й очеретом.
    kit.rect(0, TOP - 4, W, shore - TOP + 4, '#9ed4ef');
    if (portrait) {
      kit.disc(W - 34, TOP + 16, 9, '#fff2a0');
      for (const [cx, cy] of [[W * 0.22, TOP + 14], [W * 0.62, TOP + 24]] as const) {
        const x = ((cx + this.t * 3) % (W + 40)) - 20;
        kit.ellipse(x, cy, 16, 4, '#ffffff');
        kit.ellipse(x + 7, cy - 3, 9, 4, '#ffffff');
      }
    }
    for (let k = 0; k < Math.ceil(W / 38) + 1; k += 1) kit.disc(10 + k * 38, shore - 4, (10 + (k % 3) * 3) * (portrait ? 1.4 : 1), k % 2 ? '#4f9a3c' : '#5fae48');
    kit.rect(0, shore, W, bank - shore, '#3f8fcf');
    // Глибше — темніше, біля берега — світліше.
    kit.rect(0, shore, W, Math.round((bank - shore) * 0.12), '#4a9ad6');
    for (let y = shore + 4; y < bank; y += 7) {
      for (let k = 0; k < 4; k += 1) kit.rect(((k * 67 + y * 13 + this.t * 8) % (W + 20)) - 10, y, 8, 1, '#6fb0e0');
    }
    for (let x = 0; x < W; x += 5) kit.rect(x, shore - 2 + ((x * 7) % 5), 1, 6 + ((x * 3) % 4), '#5a7a3a');
    if (portrait) {
      // Латаття, одне — з квіткою.
      for (const [px, py, flower] of [[0.14, 0.18, false], [0.86, 0.34, true], [0.1, 0.62, false], [0.9, 0.78, false]] as const) {
        const x = Math.round(W * px);
        const y = Math.round(shore + (bank - shore) * py);
        kit.ellipse(x, y, 9, 4, '#4f9a3c');
        kit.ellipse(x, y - 1, 8, 3, '#62b04a');
        kit.rect(x, y - 3, 6, 2, '#3f8fcf');
        if (flower) { kit.disc(x - 2, y - 3, 2, '#ffb0c8'); kit.rect(x - 2, y - 4, 1, 1, '#fff6e0'); }
      }
    }
    // Ближній берег з травою й очеретом по краях.
    kit.rect(0, bank, W, H - bank, '#78c25a');
    kit.rect(0, bank, W, 2, '#5fa648');
    for (let k = 0; k < 40; k += 1) kit.rect((k * 37) % W, bank + 4 + ((k * 13) % Math.max(4, H - bank - 6)), 1, 2, k % 3 ? '#5fa648' : '#94d46a');
    for (const x0 of [W - 22, W - 14, W - 8]) {
      const h = portrait ? 34 : 18;
      kit.rect(x0, bank - h + 6, 1, h, '#4a7a2a');
      kit.rect(x0 - 1, bank - h + 4, 3, portrait ? 7 : 4, '#7a4a24');
    }
    // Лєна з вудкою на березі, біля неї — відро з уловом.
    const sc = 2 * z;
    const lx = portrait ? 52 : 30;
    const feet = H - (portrait ? 26 : 6);
    this.renderBucket(kit, lx + 15 * sc, feet - 2, z);
    kit.person(this.ctx.lena, lx, feet, sc, 2, 0);
    const handX = lx + 3 * sc;
    const handY = feet - 12 * sc;
    const tipX = handX + 23 * sc;
    const tipY = handY - 17 * sc;
    line(kit, handX, handY, tipX, tipY, '#7a4a24', z);
    // Поплавок і волосінь.
    const fx = this.float.x * W;
    const fy = shore + this.float.y * (bank - shore);
    if (this.state === 'cast') {
      const p = Math.min(1, this.st / 0.6);
      const x = tipX + (fx - tipX) * p;
      const y = tipY + (fy - tipY) * p - Math.sin(p * Math.PI) * 30 * z;
      line(kit, tipX, tipY, x, y, 'rgba(255,255,255,0.7)');
      zoomed(kit, x, y, z, () => drawFloat(kit, x, y, 0));
    } else if (this.state === 'wait' || this.state === 'bite') {
      const dip = this.state === 'bite' ? 3 : Math.round(Math.sin(this.st * 3) * 0.6 + (Math.sin(this.st * 17) > 0.97 ? 1 : 0));
      line(kit, tipX, tipY, fx, fy, 'rgba(255,255,255,0.6)');
      // Плюх: коло від поплавця, щойно впав.
      if (this.state === 'wait' && this.st < 0.5) {
        const rr = (4 + this.st * 16) * z;
        kit.ellipse(fx, fy + z, Math.round(rr), Math.max(1, Math.round(rr / 3)), `rgba(255,255,255,${(0.5 - this.st).toFixed(2)})`);
      }
      zoomed(kit, fx, fy, z, () => drawFloat(kit, fx, fy, dip));
      if (this.state === 'bite') {
        const rr = (4 + (this.st / BITE_S) * 8) * z;
        kit.ellipse(fx, fy + 2 * z, Math.round(rr), Math.round(rr / 3), 'rgba(255,255,255,0.35)');
        kit.text('Клює!', fx, fy - 14 * z, { size: portrait ? 13 : 10, color: '#ffe48a' });
      }
    }
    const mid = shore + (bank - shore) * 0.42;
    if (this.state === 'reveal' && this.last) {
      // Риба вистрибує з води, і видно, яка.
      const k = Math.min(1, this.st / 0.4);
      const fz = portrait ? 3 : 2;
      const x = Math.round(W / 2);
      const y = Math.round(mid + (1 - k) * 20);
      zoomed(kit, x, y, fz, () => drawFish(kit, this.last!, x, y, this.last === 'korop' ? 1.3 : 1));
      kit.text(this.message, W / 2, y - (portrait ? 54 : 26), { size: portrait ? 14 : 12, color: '#fff6e0' });
    }
    if (this.state === 'miss') kit.text(this.message, W / 2, mid, { size: portrait ? 12 : 10, color: '#ffd0c0' });
    if (this.state === 'ready') kit.text(this.casts === 0 ? 'Торкнись, щоб закинути' : 'Закинь ще', W / 2, mid, { size: portrait ? 12 : 10, color: '#fff6e0' });
    // Улов.
    const caught = FISH.map((f) => `${FISH_NAME[f]} ${this.tally[f] ?? 0}`).join(' · ');
    kit.text(`Закид ${Math.min(this.casts, CASTS)}/${CASTS} · ${caught}`, W / 2, TOP + 6, { size: 8.5 });
    kit.region('any', 0, 0, W, H);
  }

  /** Відро з уловом: з нього стирчать хвости спійманих риб. */
  private renderBucket(kit: Kit, x: number, y: number, z: number): void {
    const fish = FISH.flatMap((f) => Array.from({ length: this.tally[f] ?? 0 }, () => f));
    zoomed(kit, x, y, z, () => {
      fish.slice(-4).forEach((f, i) => {
        const c = FISH_LOOK[f];
        const tx = x - 4 + i * 3;
        kit.rect(tx, y - 16 - (i % 2), 2, 4, c.body);
        kit.rect(tx - 1, y - 18 - (i % 2), 4, 2, c.fin);
      });
      for (let r = 0; r < 12; r += 1) {
        const half = 6 - Math.floor(r / 4);
        kit.rect(x - half, y - 12 + r, half * 2, 1, r < 2 ? '#c8d0d8' : r % 4 === 2 ? '#7a8490' : '#a0aab4');
      }
      kit.rect(x - 7, y - 13, 14, 2, '#d8e0e8');
      for (let k = -6; k <= 6; k += 1) kit.rect(x + k, y - 13 - Math.round(Math.sqrt(Math.max(0, 36 - k * k)) * 0.9), 1, 1, '#6a7480');
    });
  }
}

function drawFloat(kit: Kit, x: number, y: number, dip: number): void {
  const xr = Math.round(x);
  const yr = Math.round(y) + dip;
  kit.rect(xr - 1, yr - 5, 2, 3, '#e8402e');
  kit.rect(xr - 1, yr - 2, 2, 2, '#f4f4f7');
  kit.ellipse(xr, Math.round(y) + 1, 3, 1, 'rgba(255,255,255,0.35)');
}

/** Риба збоку: карась круглий бронзовий, окунь смугастий з червоними плавцями, короп великий золотий. */
function drawFish(kit: Kit, fish: Fish, x: number, y: number, k = 1): void {
  const c = FISH_LOOK[fish];
  const len = Math.round(c.len * k);
  const h = Math.round((fish === 'karas' ? 0.55 : fish === 'okun' ? 0.38 : 0.42) * len);
  const xr = Math.round(x);
  const yr = Math.round(y);
  // Хвіст.
  for (let i = 0; i < 5; i += 1) kit.rect(xr - Math.round(len / 2) - i - 1, yr - i, 1, i * 2 + 1, c.fin);
  kit.ellipse(xr, yr, Math.round(len / 2), Math.round(h / 2), c.body);
  kit.ellipse(xr, yr + Math.round(h / 4), Math.round(len / 2) - 2, Math.max(1, Math.round(h / 5)), c.belly);
  if (fish === 'okun') for (let i = -2; i <= 2; i += 1) kit.rect(xr + i * Math.round(len / 7), yr - Math.round(h / 2) + 1, 1, h - 3, c.dark);
  if (fish === 'korop') for (let i = -2; i <= 2; i += 1) kit.rect(xr + i * 3, yr - 2 + (i % 2), 2, 1, shade(c.body, 0.25));
  // Спинний плавець, око, рот.
  kit.rect(xr - 2, yr - Math.round(h / 2) - 2, Math.round(len / 3), 2, c.fin);
  kit.rect(xr + Math.round(len / 2) - 4, yr - 2, 2, 2, '#151015');
  kit.rect(xr + Math.round(len / 2) - 4, yr - 2, 1, 1, '#ffffff');
  kit.rect(xr + Math.round(len / 2), yr, 1, 1, c.dark);
}

// ------------------------------------------------------------

export const FARM_GAME: Record<FarmGameId, (ctx: GameContext) => MiniGame> = {
  orchard: (ctx) => new OrchardGame(ctx),
  garden: (ctx) => new GardenGame(ctx),
  eggs: (ctx) => new EggsGame(ctx),
  fishing: (ctx) => new FishingGame(ctx),
};
