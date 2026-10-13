// ============================================================
// Падіння Лєни від Басі (ADR-0239, власник 2026-10-13: «створи анімацію
// падіння від Басі для Лєни»). Бася врізається в Лєну — та падає навзнак,
// секунду лежить, над головою кружляють зірочки, з-під неї здіймається
// пил, і Лєна підводиться. Тривалості — `sim/dog.ts` (`fallPhase`).
//
// 32×32 — кадри PixelLab (`peopleHd.ts`: шаблони `falling-back-death` і
// `getting-up`). 16×16 — пози з бокового спрайта людини: нахил назад
// (рядки зсунуто, жоден піксель не губиться) і лежання — поворот рівно на
// чверть оберту, теж без втрат. Довільний кут повороту, як було раніше,
// ламав пікселі на сходинки.
// ============================================================
import { fallPhase } from '../sim/dog';
import { ICONS } from './icons';
import { FALL_DOWN_FRAMES, FALL_UP_FRAMES, drawFallHd, hasHdFall, hdCell } from './peopleHd';
import { sheetFor, type Look } from './people';
import { canvas, ctx2d, densityOf, ellipse } from './pixel';

/** Кадр смуги 32×32 через `t` секунд падіння: 0–6 — падає (6 — лежить), 7–11 — підводиться. */
export function fallFrameHd(t: number): number {
  const { phase, k } = fallPhase(t);
  if (phase === 'down') return Math.min(FALL_DOWN_FRAMES - 1, Math.floor(k * FALL_DOWN_FRAMES));
  if (phase === 'lie') return FALL_DOWN_FRAMES - 1;
  return FALL_DOWN_FRAMES + Math.min(FALL_UP_FRAMES - 1, Math.floor(k * FALL_UP_FRAMES));
}

/** Поза 16×16: 0 — стоїть, 1 — відхилилась назад, 2 — падає навзнак, 3 — лежить. */
export function fallPosePixel(t: number): 0 | 1 | 2 | 3 {
  const { phase, k } = fallPhase(t);
  if (phase === 'down') return k < 0.3 ? 1 : k < 0.6 ? 2 : 3;
  if (phase === 'lie') return 3;
  return k < 0.4 ? 3 : k < 0.6 ? 2 : k < 0.85 ? 1 : 0;
}

/** Наскільки Лєна лежить: 0 — стоїть, 1 — лежить. Від цього — тінь. */
export function lyingness(t: number): number {
  const { phase, k } = fallPhase(t);
  if (phase === 'down') return k;
  if (phase === 'lie') return 1;
  return 1 - k;
}

/** Чи кружляють над головою зірочки: поки лежить і поки сідає. */
export function dizzy(t: number): boolean {
  const { phase, k } = fallPhase(t);
  return phase === 'lie' || (phase === 'up' && k < 0.35);
}

/** Пил з-під Лєни: від удару об землю, 0…1, або `null`, коли вже осів. */
export function dustAt(t: number): number | null {
  const { phase, k } = fallPhase(t);
  if (phase !== 'lie' || k >= 0.35) return null;
  return k / 0.35;
}

/** Зірочка з центром у (x, y): піксель зірочки — піксель малюнка (`d` на світовий). */
function drawStar(g: CanvasRenderingContext2D, x: number, y: number, d: number): void {
  const bm = ICONS.star;
  const p = 1 / d;
  const x0 = Math.round((x - (bm.rows[0]!.length * p) / 2) * d) / d;
  const y0 = Math.round((y - (bm.rows.length * p) / 2) * d) / d;
  bm.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i += 1) {
      const c = bm.palette[row[i]!];
      if (!c) continue;
      g.fillStyle = c;
      g.fillRect(x0 + i * p, y0 + j * p, p, p);
    }
  });
  // Іскра в серцевині.
  g.fillStyle = '#fff6c8';
  g.fillRect(x0 + 3 * p, y0 + 2 * p, p, p);
}

/** Пози 16×16 [стоїть, нахил, сильний нахил, лежить] — обличчям до Басі, падає геть від неї. */
const poses = new Map<string, HTMLCanvasElement[]>();

/** Нахил назад: кожен рядок зсунуто тим більше, що вище він від стоп. */
const LEANS = [0.22, 0.5] as const;
const LEAN_ROOM = 16;

function posesFor(look: Look, side: 1 | -1): HTMLCanvasElement[] {
  const key = `${JSON.stringify(look)}|${side}`;
  const hit = poses.get(key);
  if (hit) return hit;
  // Падає ліворуч — отже, дивиться праворуч (на Басю), і навпаки.
  const stand = sheetFor(look)[side === -1 ? 2 : 1]![0]!;
  const W = stand.width;
  const H = stand.height;
  const leans = LEANS.map((lean) => {
    const c = canvas(W + LEAN_ROOM, H);
    const lg = ctx2d(c);
    for (let y = 0; y < H; y += 1) {
      const off = Math.round((H - 1 - y) * lean);
      lg.drawImage(stand, 0, y, W, 1, side === -1 ? LEAN_ROOM - off : off, y, W, 1);
    }
    return c;
  });
  const lie = canvas(H, W);
  const g = ctx2d(lie);
  if (side === -1) {
    // Дивилась праворуч: поворот проти годинникової — голова ліворуч, спина внизу.
    g.translate(0, W);
    g.rotate(-Math.PI / 2);
  } else {
    g.translate(H, 0);
    g.rotate(Math.PI / 2);
  }
  g.drawImage(stand, 0, 0);
  const out = [stand, ...leans, lie];
  poses.set(key, out);
  return out;
}

/**
 * Намалювати Лєну, що падає: `x, y` — де вона стояла (між стопами), `side` —
 * куди падає (1 праворуч, -1 ліворуч), `t` — секунд від удару, `time` — час
 * сцени (для зірочок).
 */
export function drawLenaFall(g: CanvasRenderingContext2D, look: Look, x: number, y: number, side: 1 | -1, t: number, time: number): void {
  const lie = lyingness(t);
  const hd = densityOf(g) > 1 && hasHdFall(look);
  // Тінь розтягується, поки Лєна лягає.
  ellipse(g, x, y, (look.kid ? 4.5 : 5.5) + lie * 7, 1.5 + lie * 0.5, 'rgba(28,20,40,0.28)');
  let head: { x: number; y: number };
  let half: number;
  if (hd) {
    drawFallHd(g, look, x, y, side === 1, fallFrameHd(t));
    // Голова лежачої — на 0,15 клітинки аркуша вбік падіння, на 0,125 вище стоп.
    const cell = hdCell(look);
    head = { x: x + side * cell * 0.15, y: y - cell * 0.125 - 4 };
    half = cell * 0.27;
  } else {
    const all = posesFor(look, side);
    const stand = all[0]!;
    const lying = all[3]!;
    const pose = fallPosePixel(t);
    // Мить удару об землю — на піксель угору, і лягає.
    const { phase, k } = fallPhase(t);
    const bounce = phase === 'down' && pose === 3 && k < 0.75 ? 1 : 0;
    if (pose === 0) g.drawImage(stand, Math.round(x - stand.width / 2), Math.round(y - stand.height + 2));
    else if (pose === 3) g.drawImage(lying, Math.round(side === -1 ? x + 4 - lying.width : x - 4), Math.round(y + 2 - lying.height - bounce));
    else {
      // Що більший нахил, то нижче голова: тіло падає, а не лише хилиться.
      const lean = all[pose]!;
      g.drawImage(lean, Math.round(x - stand.width / 2 - (side === -1 ? LEAN_ROOM : 0)), Math.round(y - lean.height + 2 + pose * 2));
    }
    head = { x: x + side * (lying.width - 8), y: y - 6 };
    half = lying.width / 2;
  }
  if (dizzy(t)) {
    // Зірочки кружляють над головою; у 32×32 — дрібніші, піксель малюнка — пів світового.
    const d = densityOf(g);
    const rx = d > 1 ? 6 : 8;
    const ry = d > 1 ? 2.5 : 3;
    for (let k = 0; k < 3; k += 1) {
      const s = time * 7 + (k * Math.PI * 2) / 3;
      drawStar(g, head.x + Math.cos(s) * rx, head.y + Math.sin(s) * ry, d);
    }
  }
  const dust = dustAt(t);
  if (dust != null) {
    // Пилок з обох боків тіла: розлітається й осідає.
    g.globalAlpha = 0.55 * (1 - dust);
    for (const dir of [-1, 1]) {
      const cx = x + side * half * 0.4 + dir * (half * 0.6 + dust * 6);
      ellipse(g, cx, y - 1 - dust * 2, 1.5 + dust * 2, 1 + dust, '#d9c9a7');
    }
    g.globalAlpha = 1;
  }
}
