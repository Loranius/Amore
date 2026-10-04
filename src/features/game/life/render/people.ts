// ============================================================
// Персонажі «Дєвочка в городі»: Лєна в різному віці й одязі, Діма, мама,
// перехожі (ADR-0239).
// ------------------------------------------------------------
// Спрайт — 14×22 пікселі (дитина 12×17), чотири напрямки по чотири кадри
// ходи, з тінню на одязі й темним обведенням силуету. Вигляд — набір
// кольорів і зачіска, тож новий одяг з крамниці одразу видно на Лєні.
// ============================================================
import { canvas, ctx2d, flipX, outline, px, rect, shade, type Ctx } from './pixel';

export type HairStyle = 'long' | 'pigtails' | 'short' | 'bun' | 'ponytail' | 'bob';

export interface Look {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  bottom: string;
  dress?: boolean;
  accent?: string;
  shoes: string;
  eyes: string;
  kid?: boolean;
  beard?: boolean;
  bow?: string;
}

/** 0 — до нас (вниз), 1 — вліво, 2 — вправо, 3 — від нас (вгору). */
export type Dir = 0 | 1 | 2 | 3;
export type Sheet = HTMLCanvasElement[][];

const SKIN = '#f2c9a0';

export const LENA_KID: Look = { skin: SKIN, hair: '#9c7a45', hairStyle: 'pigtails', top: '#f2a5c0', bottom: '#f2a5c0', dress: true, shoes: '#c2494f', eyes: '#3a2a22', kid: true, bow: '#ff5d8f' };
export const LENA_TEEN: Look = { skin: SKIN, hair: '#9c7a45', hairStyle: 'ponytail', top: '#f4f4f7', bottom: '#3d4a6e', shoes: '#3a2f28', eyes: '#3a2a22', accent: '#5aa7e0' };
export const LENA_ADULT: Look = { skin: SKIN, hair: '#9c7a45', hairStyle: 'long', top: '#5aa7e0', bottom: '#f4f4f7', dress: true, shoes: '#f4f4f7', eyes: '#3a2a22' };
export const DIMA: Look = { skin: SKIN, hair: '#8f6d3e', hairStyle: 'short', top: '#6e4a2a', bottom: '#3f7a3a', shoes: '#3a2f28', eyes: '#4a90d9' };
export const MOM: Look = { skin: SKIN, hair: '#6e4a2a', hairStyle: 'bun', top: '#b8323a', bottom: '#3a3550', dress: true, shoes: '#3a2f28', eyes: '#3a2a22', accent: '#f6f1e6' };
export const OLYA: Look = { skin: SKIN, hair: '#3a2b1a', hairStyle: 'bob', top: '#7fd9c4', bottom: '#3d5a8c', shoes: '#f4f4f7', eyes: '#3a2a22' };

// ------------------------------------------------------------
// Малювання одного кадру.
// ------------------------------------------------------------
function hairBack(g: Ctx, l: Look, w: number, top: number, kid: boolean): void {
  const H = l.hair;
  const D = shade(H, -0.25);
  if (l.hairStyle === 'long') {
    rect(g, 3, top + 2, w - 6, kid ? 8 : 11, D);
  }
  if (l.hairStyle === 'ponytail') {
    rect(g, w / 2 - 1, top + 6, 3, 7, D);
  }
}

function drawFront(g: Ctx, l: Look, frame: number): void {
  const kid = !!l.kid;
  const w = kid ? 12 : 14;
  const bob = frame % 2 === 1 ? 1 : 0;
  const top = bob;
  const headW = kid ? 8 : 8;
  const hx = (w - headW) / 2;
  const headH = kid ? 7 : 8;
  const torsoY = top + headH + 1;
  const torsoH = kid ? 5 : 7;
  const legY = torsoY + torsoH;
  const legH = kid ? 3 : 4;
  const S = l.skin;
  const SD = shade(S, -0.14);
  const H = l.hair;
  const HL = shade(H, 0.22);
  const T = l.top;
  const TL = shade(T, 0.18);
  const TD = shade(T, -0.22);
  const B = l.bottom;

  hairBack(g, l, w, top, kid);
  // Голова.
  rect(g, hx, top + 1, headW, headH, S);
  rect(g, hx + headW - 1, top + 2, 1, headH - 2, SD);
  // Волосся спереду: чубчик і боки.
  rect(g, hx - 1, top, headW + 2, 3, H);
  rect(g, hx + 1, top, headW - 3, 1, HL);
  if (l.hairStyle === 'long' || l.hairStyle === 'bob') {
    rect(g, hx - 1, top + 2, 2, l.hairStyle === 'long' ? (kid ? 7 : 10) : 6, H);
    rect(g, hx + headW - 1, top + 2, 2, l.hairStyle === 'long' ? (kid ? 7 : 10) : 6, H);
  } else if (l.hairStyle !== 'short') {
    rect(g, hx - 1, top + 2, 1, 3, H);
    rect(g, hx + headW, top + 2, 1, 3, H);
  }
  if (l.hairStyle === 'pigtails') {
    rect(g, hx - 3, top + 3, 2, 4, H);
    rect(g, hx + headW + 1, top + 3, 2, 4, H);
    if (l.bow) { px(g, hx - 2, top + 2, l.bow); px(g, hx + headW + 1, top + 2, l.bow); }
  }
  if (l.hairStyle === 'bun') rect(g, w / 2 - 2, top - 1, 4, 2, H);
  // Обличчя.
  const ey = top + (kid ? 4 : 5);
  rect(g, hx + 2, ey, 1, 2, l.eyes);
  rect(g, hx + headW - 3, ey, 1, 2, l.eyes);
  px(g, hx + 2, ey, '#ffffff');
  px(g, hx + headW - 3, ey, '#ffffff');
  px(g, hx + 1, ey + 2, '#f29a9a');
  px(g, hx + headW - 2, ey + 2, '#f29a9a');
  rect(g, w / 2 - 1, ey + 3, 2, 1, shade(S, -0.32));
  if (l.beard) rect(g, hx + 1, ey + 3, headW - 2, 2, shade(H, -0.1));

  // Тулуб і руки.
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  rect(g, 2, torsoY, w - 4, torsoH, T);
  rect(g, 2, torsoY, 2, torsoH, TL);
  rect(g, w - 4, torsoY, 2, torsoH, TD);
  if (l.accent) rect(g, w / 2 - 1, torsoY, 2, Math.min(3, torsoH), l.accent);
  rect(g, 1, torsoY + 1 + swing, 1, torsoH - 1, T);
  rect(g, w - 2, torsoY + 1 - swing, 1, torsoH - 1, TD);
  px(g, 1, torsoY + torsoH + swing, S);
  px(g, w - 2, torsoY + torsoH - swing, S);

  // Низ: спідниця/сукня або штани.
  const legL = frame === 1 ? -1 : 0;
  const legR = frame === 3 ? -1 : 0;
  if (l.dress) {
    rect(g, 2, legY - 1, w - 4, 3, B);
    rect(g, 1, legY + 1, w - 2, 1, shade(B, -0.15));
    rect(g, 4, legY + 2, 2, legH - 1 + legL, S);
    rect(g, w - 6, legY + 2, 2, legH - 1 + legR, S);
  } else {
    rect(g, 3, legY, w - 6, 1, shade(B, -0.1));
    rect(g, 3, legY, 3, legH + legL, B);
    rect(g, w - 6, legY, 3, legH + legR, shade(B, -0.12));
  }
  rect(g, 3, legY + legH + legL, 3, 1, l.shoes);
  rect(g, w - 6, legY + legH + legR, 3, 1, l.shoes);
}

function drawBack(g: Ctx, l: Look, frame: number): void {
  const kid = !!l.kid;
  const w = kid ? 12 : 14;
  const bob = frame % 2 === 1 ? 1 : 0;
  const top = bob;
  const headW = 8;
  const hx = (w - headW) / 2;
  const headH = kid ? 7 : 8;
  const torsoY = top + headH + 1;
  const torsoH = kid ? 5 : 7;
  const legY = torsoY + torsoH;
  const legH = kid ? 3 : 4;
  const H = l.hair;
  const T = l.top;
  const B = l.bottom;
  rect(g, hx, top + 1, headW, headH, l.skin);
  rect(g, hx - 1, top, headW + 2, headH - 1, H);
  rect(g, hx, top, headW - 2, 1, shade(H, 0.22));
  if (l.hairStyle === 'long') rect(g, hx - 1, top + 2, headW + 2, kid ? 9 : 12, H);
  if (l.hairStyle === 'bob') rect(g, hx - 1, top + 2, headW + 2, 7, H);
  if (l.hairStyle === 'ponytail') rect(g, w / 2 - 1, top + 5, 2, 8, shade(H, -0.1));
  if (l.hairStyle === 'pigtails') {
    rect(g, hx - 3, top + 3, 2, 4, H);
    rect(g, hx + headW + 1, top + 3, 2, 4, H);
  }
  if (l.hairStyle === 'bun') rect(g, w / 2 - 2, top - 1, 4, 3, shade(H, -0.1));
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  rect(g, 2, torsoY, w - 4, torsoH, shade(T, -0.08));
  if (l.hairStyle === 'long') rect(g, hx, torsoY, headW, 3, H);
  rect(g, 1, torsoY + 1 - swing, 1, torsoH - 1, shade(T, -0.2));
  rect(g, w - 2, torsoY + 1 + swing, 1, torsoH - 1, shade(T, -0.2));
  const legL = frame === 3 ? -1 : 0;
  const legR = frame === 1 ? -1 : 0;
  if (l.dress) {
    rect(g, 2, legY - 1, w - 4, 3, shade(B, -0.08));
    rect(g, 1, legY + 1, w - 2, 1, shade(B, -0.2));
    rect(g, 4, legY + 2, 2, legH - 1 + legL, l.skin);
    rect(g, w - 6, legY + 2, 2, legH - 1 + legR, l.skin);
  } else {
    rect(g, 3, legY, 3, legH + legL, shade(B, -0.08));
    rect(g, w - 6, legY, 3, legH + legR, shade(B, -0.18));
  }
  rect(g, 3, legY + legH + legL, 3, 1, l.shoes);
  rect(g, w - 6, legY + legH + legR, 3, 1, l.shoes);
}

/** Профіль праворуч; ліворуч — дзеркально. */
function drawSide(g: Ctx, l: Look, frame: number): void {
  const kid = !!l.kid;
  const w = kid ? 12 : 14;
  const bob = frame % 2 === 1 ? 1 : 0;
  const top = bob;
  const headW = 8;
  const hx = (w - headW) / 2;
  const headH = kid ? 7 : 8;
  const torsoY = top + headH + 1;
  const torsoH = kid ? 5 : 7;
  const legY = torsoY + torsoH;
  const legH = kid ? 3 : 4;
  const H = l.hair;
  const T = l.top;
  const B = l.bottom;
  if (l.hairStyle === 'long') rect(g, hx - 1, top + 2, 4, kid ? 9 : 12, shade(H, -0.12));
  if (l.hairStyle === 'ponytail') rect(g, hx - 2, top + 3, 2, 7, shade(H, -0.12));
  rect(g, hx, top + 1, headW, headH, l.skin);
  rect(g, hx + headW, top + 4, 1, 2, l.skin);
  rect(g, hx - 1, top, headW + 1, 3, H);
  rect(g, hx - 1, top + 2, 4, headH - 3, H);
  rect(g, hx + 1, top, headW - 3, 1, shade(H, 0.22));
  if (l.hairStyle === 'pigtails') rect(g, hx - 3, top + 3, 2, 4, H);
  if (l.hairStyle === 'bun') rect(g, hx, top - 1, 4, 2, H);
  if (l.hairStyle === 'bob') rect(g, hx - 1, top + 2, 4, 6, H);
  const ey = top + (kid ? 4 : 5);
  rect(g, hx + headW - 2, ey, 1, 2, l.eyes);
  px(g, hx + headW - 3, ey + 2, '#f29a9a');
  if (l.beard) rect(g, hx + 3, ey + 3, headW - 3, 2, shade(H, -0.1));
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  rect(g, 3, torsoY, w - 6, torsoH, T);
  rect(g, 3, torsoY, 2, torsoH, shade(T, -0.2));
  if (l.accent) rect(g, w - 5, torsoY, 1, Math.min(3, torsoH), l.accent);
  // Рука спереду махає.
  rect(g, w / 2 - 1 + step, torsoY + 1, 2, torsoH - 1, shade(T, 0.12));
  px(g, w / 2 - 1 + step * 2, torsoY + torsoH, l.skin);
  if (l.dress) {
    rect(g, 2, legY - 1, w - 4, 3, B);
    rect(g, 2, legY + 1, w - 4, 1, shade(B, -0.15));
    rect(g, w / 2 - 2 - step, legY + 2, 2, legH - 1, l.skin);
    rect(g, w / 2 + step, legY + 2, 2, legH - 1, shade(l.skin, -0.1));
  } else {
    rect(g, w / 2 - 2 - step, legY, 2, legH, shade(B, -0.15));
    rect(g, w / 2 + step, legY, 2, legH, B);
  }
  rect(g, w / 2 - 2 - step, legY + legH, 3, 1, l.shoes);
  rect(g, w / 2 + step, legY + legH, 3, 1, l.shoes);
}

const cache = new Map<string, Sheet>();

/** Аркуш спрайтів [напрям][кадр] з обведенням. Кешується за виглядом. */
export function sheetFor(look: Look): Sheet {
  const key = JSON.stringify(look);
  const hit = cache.get(key);
  if (hit) return hit;
  const w = look.kid ? 12 : 14;
  const h = look.kid ? 18 : 22;
  const make = (draw: (g: Ctx, l: Look, f: number) => void, f: number) => {
    const c = canvas(w, h + 1);
    draw(ctx2d(c), look, f);
    return outline(c);
  };
  const down = [0, 1, 2, 3].map((f) => make(drawFront, f));
  const up = [0, 1, 2, 3].map((f) => make(drawBack, f));
  const right = [0, 1, 2, 3].map((f) => make(drawSide, f));
  const left = right.map(flipX);
  const sheet: Sheet = [down, left, right, up];
  cache.set(key, sheet);
  return sheet;
}

/** Кадр ходи: 0 стоїть, 1–3 крок. */
export function walkFrame(moving: boolean, t: number): number {
  return moving ? [1, 0, 3, 0][Math.floor(t * 8) % 4]! : 0;
}

// ------------------------------------------------------------
// Перехожі: вигляд із костей міста.
// ------------------------------------------------------------
const HAIRS = ['#2b1d16', '#4a3020', '#6e4a2a', '#9c7a45', '#c9a46a', '#8a8a8a', '#b5651d'];
const TOPS = ['#c2494f', '#4a7fb5', '#67a05c', '#e0a43c', '#8a5ab5', '#3a8f8f', '#d9739a', '#5d6b7a', '#f4f4f7'];
const BOTTOMS = ['#2e3550', '#4a3a2a', '#3d5a8c', '#5a5a64', '#7a4a6a'];
const STYLES: HairStyle[] = ['short', 'bob', 'long', 'bun', 'ponytail', 'short'];
const SKINS = ['#f2c9a0', '#e8b48a', '#f6d5b5', '#d9a27a'];

export function townsfolkLook(r: () => number): Look {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const kid = r() < 0.2;
  const style = pick(STYLES);
  return {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: kid && style === 'bun' ? 'pigtails' : style,
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    dress: style !== 'short' && r() < 0.35,
    shoes: '#3a2f28',
    eyes: '#2b1d16',
    kid,
    beard: style === 'short' && !kid && r() < 0.25,
  };
}
