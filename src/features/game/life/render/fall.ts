// ============================================================
// Падіння Лєни від Басі (ADR-0239, власник 2026-10-13: «створи анімацію
// падіння від Басі для Лєни»). Бася врізається в Лєну — та падає навзнак,
// секунду лежить, над головою кружляють зірочки, з-під неї здіймається
// пил, і Лєна підводиться. Тривалості — `sim/dog.ts` (`fallPhase`).
//
// Кадри — смуги PixelLab (`peopleHd.ts`: шаблони `falling-back-death` і
// `getting-up`). Пози 16×16 з бокового спрайта гра більше не має (власник
// 2026-10-31: «повністю відмовляємось від 16×16»).
// ============================================================
import { fallPhase } from '../sim/dog';
import { ICONS } from './icons';
import { FALL_DOWN_FRAMES, FALL_UP_FRAMES, drawFallHd, drawPersonHd, hasHdFall, hdCell } from './peopleHd';
import type { Look } from './people';
import { ART_DENSITY, ellipse } from './pixel';

/** Кадр смуги 32×32 через `t` секунд падіння: 0–6 — падає (6 — лежить), 7–11 — підводиться. */
export function fallFrameHd(t: number): number {
  const { phase, k } = fallPhase(t);
  if (phase === 'down') return Math.min(FALL_DOWN_FRAMES - 1, Math.floor(k * FALL_DOWN_FRAMES));
  if (phase === 'lie') return FALL_DOWN_FRAMES - 1;
  return FALL_DOWN_FRAMES + Math.min(FALL_UP_FRAMES - 1, Math.floor(k * FALL_UP_FRAMES));
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

/** Зірочка з центром у (x, y): піксель зірочки — піксель малюнка (пів світового). */
function drawStar(g: CanvasRenderingContext2D, x: number, y: number): void {
  const bm = ICONS.star;
  const d = ART_DENSITY;
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

/**
 * Намалювати Лєну, що падає: `x, y` — де вона стояла (між стопами), `side` —
 * куди падає (1 праворуч, -1 ліворуч), `t` — секунд від удару, `time` — час
 * сцени (для зірочок).
 */
export function drawLenaFall(g: CanvasRenderingContext2D, look: Look, x: number, y: number, side: 1 | -1, t: number, time: number): void {
  const lie = lyingness(t);
  // Тінь розтягується, поки Лєна лягає.
  ellipse(g, x, y, (look.kid ? 4.5 : 5.5) + lie * 7, 1.5 + lie * 0.5, 'rgba(28,20,40,0.28)');
  if (hasHdFall(look)) drawFallHd(g, look, x, y, side === 1, fallFrameHd(t));
  // Смуга падіння вантажиться разом з аркушем ходи; якщо вона ще не готова
  // (мить на початку гри), Лєна стоїть обличчям до Басі — падає геть від неї.
  else drawPersonHd(g, look, x, y, side === 1 ? 1 : 2, false, 0);
  // Голова лежачої — на 0,15 клітинки аркуша вбік падіння, на 0,125 вище стоп.
  const cell = hdCell(look);
  const head = { x: x + side * cell * 0.15, y: y - cell * 0.125 - 4 };
  const half = cell * 0.27;
  if (dizzy(t)) {
    // Зірочки кружляють над головою.
    for (let k = 0; k < 3; k += 1) {
      const s = time * 7 + (k * Math.PI * 2) / 3;
      drawStar(g, head.x + Math.cos(s) * 6, head.y + Math.sin(s) * 2.5);
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
