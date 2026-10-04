// ============================================================
// Персонажі «Дєвочка в городі»: Лєна в різному віці й одязі, Діма, мама,
// перехожі (ADR-0239).
// ------------------------------------------------------------
// Власник, 2026-10-04: «покращ аватари персонажів, зроби їх більш
// деталізованими» — референси Stardew Valley. Звідти взято пропорції й
// прийоми:
//   * велика голова (12×12 з 30 пікселів зросту), бо обличчя — це персонаж;
//   * очі з віями й білим відблиском, брови, рум'янець, губи;
//   * волосся в три тони з пасмами й чубчиком, а не суцільна шапка;
//   * одяг зі світлом і тінню, комірцем, рукавами й руками;
//   * аксесуари, якими персонажі референсу різняться: шапка-біні, шарф,
//     окуляри, худі з капюшоном і шнурками.
// Спрайт — 16×30 (дитина 14×23), чотири напрямки по чотири кадри, з темним
// обведенням силуету. Вигляд — набір кольорів, тож новий одяг з крамниці
// одразу видно на Лєні.
// ============================================================
import { canvas, ctx2d, flipX, outline, px, rect, shade, type Ctx } from './pixel';

export type HairStyle = 'long' | 'pigtails' | 'short' | 'bun' | 'ponytail' | 'bob' | 'spiky';

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
  /** Шапка-біні (колір). */
  hat?: string;
  /** Шарф (колір). */
  scarf?: string;
  glasses?: boolean;
  /** Худі: капюшон за шиєю й шнурки. */
  hoodie?: boolean;
}

/** 0 — до нас (вниз), 1 — вліво, 2 — вправо, 3 — від нас (вгору). */
export type Dir = 0 | 1 | 2 | 3;
export type Sheet = HTMLCanvasElement[][];

const SKIN = '#f2c9a0';
const LIPS = '#d2706f';
const BLUSH = '#f4a3a0';
const WHITE = '#ffffff';

export const LENA_KID: Look = { skin: SKIN, hair: '#9c7a45', hairStyle: 'pigtails', top: '#f2a5c0', bottom: '#f2a5c0', dress: true, shoes: '#c2494f', eyes: '#5a3a26', kid: true, bow: '#ff5d8f' };
export const LENA_TEEN: Look = { skin: SKIN, hair: '#9c7a45', hairStyle: 'ponytail', top: '#f4f4f7', bottom: '#3d4a6e', shoes: '#3a2f28', eyes: '#5a3a26', accent: '#5aa7e0' };
export const LENA_ADULT: Look = { skin: SKIN, hair: '#a5804a', hairStyle: 'long', top: '#5aa7e0', bottom: '#f4f4f7', dress: true, shoes: '#f4f4f7', eyes: '#5a3a26' };
export const DIMA: Look = { skin: SKIN, hair: '#8f6d3e', hairStyle: 'spiky', top: '#c0503a', bottom: '#3a4560', shoes: '#3a2f28', eyes: '#4a90d9', hoodie: true };
export const MOM: Look = { skin: SKIN, hair: '#6e4a2a', hairStyle: 'bun', top: '#b8323a', bottom: '#3a3550', dress: true, shoes: '#3a2f28', eyes: '#3a2a22', accent: '#f6f1e6' };
export const OLYA: Look = { skin: SKIN, hair: '#3a2b1a', hairStyle: 'bob', top: '#7fd9c4', bottom: '#3d5a8c', shoes: '#f4f4f7', eyes: '#3a2a22' };

/** Розміри тіла: дитина й дорослий. */
interface Body {
  w: number;
  headW: number;
  headH: number;
  torsoH: number;
  skirtH: number;
  legH: number;
}

function bodyOf(l: Look): Body {
  return l.kid
    ? { w: 14, headW: 10, headH: 10, torsoH: 6, skirtH: 3, legH: 3 }
    : { w: 16, headW: 12, headH: 12, torsoH: 8, skirtH: 4, legH: 4 };
}

/** Три тони волосся: тінь, основа, відблиск. */
function hairTones(l: Look): [string, string, string] {
  return [shade(l.hair, -0.28), l.hair, shade(l.hair, 0.26)];
}

// ------------------------------------------------------------
// Волосся ПОЗАДУ тіла: малюється першим, тож плечі й тулуб лягають зверху,
// а з-за них визирають лише пасма по боках.
// ------------------------------------------------------------
function hairBehindFront(g: Ctx, l: Look, b: Body, top: number): void {
  const { w, headW, headH } = b;
  const hx = (w - headW) / 2;
  const [HD, H] = hairTones(l);
  if (l.hairStyle === 'long') {
    rect(g, hx - 1, top + 3, headW + 2, headH + (l.kid ? 3 : 6), HD);
    rect(g, hx - 1, top + 4, 1, headH + (l.kid ? 2 : 5), H);
    rect(g, hx + headW, top + 4, 1, headH + (l.kid ? 2 : 5), H);
  }
  if (l.hairStyle === 'bob') rect(g, hx - 1, top + 3, headW + 2, headH - 2, HD);
  if (l.hairStyle === 'ponytail') rect(g, hx + headW, top + 4, 2, 6, HD);
}

// ------------------------------------------------------------
// Голова спереду.
// ------------------------------------------------------------
function headFront(g: Ctx, l: Look, b: Body, top: number): void {
  const { w, headW, headH } = b;
  const hx = (w - headW) / 2;
  const [HD, H, HL] = hairTones(l);
  const S = l.skin;
  const SD = shade(S, -0.12);

  // Обличчя: заокруглені кути, тінь під щелепою праворуч.
  rect(g, hx, top + 2, headW, headH - 2, S);
  rect(g, hx + 1, top + 1, headW - 2, 1, S);
  rect(g, hx + 1, top + headH, headW - 2, 1, S);
  rect(g, hx + headW - 1, top + 3, 1, headH - 4, SD);
  rect(g, hx + 2, top + headH, headW - 4, 1, SD);

  // Очі: вії згори, райдужка 2×2 з білим відблиском.
  const ey = top + Math.round(headH * 0.52);
  const lx = hx + (l.kid ? 2 : 2);
  const rx = hx + headW - (l.kid ? 4 : 4);
  for (const x of [lx, rx]) {
    rect(g, x, ey - 1, 2, 1, shade(l.eyes, -0.45));
    rect(g, x, ey, 2, 2, l.eyes);
    px(g, x, ey, WHITE);
    px(g, x + 1, ey + 1, shade(l.eyes, -0.3));
  }
  // Брови.
  rect(g, lx, ey - 3, 2, 1, HD);
  rect(g, rx, ey - 3, 2, 1, HD);
  // Рум'янець, ніс і губи.
  px(g, lx - 1, ey + 2, BLUSH);
  px(g, rx + 2, ey + 2, BLUSH);
  px(g, w / 2, ey + 2, SD);
  rect(g, w / 2 - 1, ey + 4, 2, 1, l.beard ? shade(l.hair, -0.1) : LIPS);
  if (l.beard) {
    rect(g, hx + 1, ey + 3, headW - 2, 3, HD);
    rect(g, w / 2 - 1, ey + 4, 2, 1, LIPS);
  }

  // Окуляри: оправа навколо очей і перемичка.
  if (l.glasses) {
    const F = '#3a2a2a';
    for (const x of [lx, rx]) {
      rect(g, x - 1, ey - 1, 4, 1, F);
      rect(g, x - 1, ey + 2, 4, 1, F);
      px(g, x - 1, ey, F); px(g, x - 1, ey + 1, F);
      px(g, x + 2, ey, F); px(g, x + 2, ey + 1, F);
    }
    rect(g, lx + 3, ey, rx - lx - 3, 1, F);
  }

  // Шапка-біні: замість верху волосся, з відворотом.
  if (l.hat) {
    const T = l.hat;
    rect(g, hx - 1, top, headW + 2, 4, T);
    rect(g, hx, top - 1, headW, 1, T);
    rect(g, hx + 1, top - 1, 3, 1, shade(T, 0.25));
    rect(g, hx - 1, top + 3, headW + 2, 2, shade(T, -0.18));
    for (let x = hx; x < hx + headW; x += 2) px(g, x, top + 4, shade(T, -0.32));
    // Пасма з-під шапки.
    rect(g, hx - 1, top + 5, 1, 3, H);
    rect(g, hx + headW, top + 5, 1, 3, H);
    return;
  }

  // Шапочка волосся з відблиском і чубчиком пасмами.
  rect(g, hx - 1, top + 1, headW + 2, 3, H);
  rect(g, hx, top, headW, 1, H);
  rect(g, hx + 2, top + 1, headW - 5, 1, HL);
  px(g, hx + 1, top + 2, HL);
  const fringe = top + 4;
  if (l.hairStyle === 'spiky') {
    // Скуйовджений чуб: зубці вгору й навскіс.
    for (let i = 0; i < headW; i += 3) {
      px(g, hx + i, top - 1, H);
      px(g, hx + i + 1, top - 2, HL);
    }
    rect(g, hx - 1, fringe, 3, 2, H);
    rect(g, hx + 3, fringe, 2, 1, H);
    rect(g, hx + 6, fringe, 3, 2, H);
    px(g, hx + headW - 1, fringe, H);
  } else if (l.hairStyle === 'short') {
    rect(g, hx - 1, fringe, headW + 2, 1, H);
    for (let i = 1; i < headW; i += 3) px(g, hx + i, fringe + 1, HD);
  } else {
    // Жіночий чубчик: нерівний край пасмами.
    rect(g, hx - 1, fringe, headW + 2, 1, H);
    for (let i = 0; i < headW; i += 2) px(g, hx + i, fringe + 1, i % 4 === 0 ? H : HD);
    px(g, hx + 3, fringe, HL);
  }
  // Боки.
  if (l.hairStyle === 'long' || l.hairStyle === 'bob') {
    const len = l.hairStyle === 'long' ? headH + (l.kid ? 2 : 4) : headH - 3;
    rect(g, hx - 1, top + 3, 2, len, H);
    rect(g, hx + headW - 1, top + 3, 2, len, H);
    rect(g, hx - 1, top + 4, 1, len - 2, HL);
    rect(g, hx + headW, top + 4, 1, len - 1, HD);
  } else if (l.hairStyle !== 'short' && l.hairStyle !== 'spiky') {
    rect(g, hx - 1, top + 3, 1, 4, H);
    rect(g, hx + headW, top + 3, 1, 4, H);
  } else {
    px(g, hx - 1, top + 4, H);
    px(g, hx + headW, top + 4, H);
  }
  if (l.hairStyle === 'pigtails') {
    rect(g, hx - 3, top + 4, 2, 5, H);
    rect(g, hx + headW + 1, top + 4, 2, 5, H);
    px(g, hx - 3, top + 5, HL);
    px(g, hx + headW + 2, top + 8, HD);
    if (l.bow) { rect(g, hx - 3, top + 3, 2, 1, l.bow); rect(g, hx + headW + 1, top + 3, 2, 1, l.bow); }
  }
  if (l.hairStyle === 'bun') {
    rect(g, w / 2 - 2, top - 2, 4, 3, H);
    px(g, w / 2 - 1, top - 2, HL);
  }
  if (l.bow && l.hairStyle !== 'pigtails') rect(g, hx + headW - 3, top, 3, 2, l.bow);
}

// ------------------------------------------------------------
// Тулуб, руки й ноги спереду (і ззаду, дзеркально за кольором).
// ------------------------------------------------------------
function bodyFront(g: Ctx, l: Look, b: Body, top: number, frame: number, back: boolean): void {
  const { w, headH, torsoH, skirtH, legH } = b;
  const S = l.skin;
  const T = back ? shade(l.top, -0.06) : l.top;
  const TL = shade(T, 0.18);
  const TD = shade(T, -0.22);
  const B = back ? shade(l.bottom, -0.06) : l.bottom;
  const BD = shade(B, -0.18);
  const torsoY = top + headH + 1;
  const tx = 3;
  const tw = w - 6;

  // Шия.
  rect(g, w / 2 - 1, torsoY - 1, 2, 1, shade(S, -0.16));
  // Тулуб зі світлом зліва й тінню справа.
  rect(g, tx, torsoY, tw, torsoH, T);
  rect(g, tx, torsoY, 1, torsoH, TL);
  rect(g, tx + tw - 2, torsoY, 2, torsoH, TD);
  rect(g, tx, torsoY + torsoH - 1, tw, 1, TD);
  if (!back) {
    // Виріз/комір.
    if (l.hoodie) {
      rect(g, tx, torsoY, tw, 1, TD);
      px(g, w / 2 - 2, torsoY + 1, '#f4f4f7');
      px(g, w / 2 + 1, torsoY + 1, '#f4f4f7');
      px(g, w / 2 - 2, torsoY + 2, '#f4f4f7');
      px(g, w / 2 + 1, torsoY + 2, '#f4f4f7');
      rect(g, tx + 2, torsoY + torsoH - 3, tw - 4, 2, TD);
    } else if (l.accent) {
      rect(g, w / 2 - 1, torsoY, 2, Math.min(3, torsoH), l.accent);
    } else {
      rect(g, w / 2 - 1, torsoY, 2, 1, shade(S, -0.05));
      px(g, w / 2 - 1, torsoY + 1, TD);
      px(g, w / 2, torsoY + 1, TD);
    }
  } else if (l.hoodie) {
    rect(g, w / 2 - 3, torsoY, 6, 3, TD);
  }
  // Шарф.
  if (l.scarf) {
    rect(g, tx, torsoY, tw, 2, l.scarf);
    rect(g, tx + 1, torsoY, tw - 3, 1, shade(l.scarf, 0.2));
    if (!back) rect(g, tx + 1, torsoY + 2, 2, 4, shade(l.scarf, -0.12));
    for (let x = tx; x < tx + tw; x += 2) px(g, x, torsoY + 1, shade(l.scarf, -0.25));
  }
  // Руки: рукав і долоня, махають у ході.
  const swing = frame === 1 ? 1 : frame === 3 ? -1 : 0;
  const armH = torsoH - 1;
  rect(g, tx - 2, torsoY + 1 + swing, 2, armH, back ? TD : TL);
  rect(g, tx + tw, torsoY + 1 - swing, 2, armH, TD);
  rect(g, tx - 2, torsoY + 1 + armH + swing, 2, 1, S);
  rect(g, tx + tw, torsoY + 1 + armH - swing, 2, 1, shade(S, -0.1));

  // Низ.
  const legY = torsoY + torsoH;
  const lift = (f: number) => (frame === f ? -1 : 0);
  const leftUp = back ? lift(3) : lift(1);
  const rightUp = back ? lift(1) : lift(3);
  if (l.dress) {
    rect(g, tx - 1, legY - 1, tw + 2, skirtH, B);
    rect(g, tx - 1, legY + skirtH - 2, tw + 2, 1, BD);
    rect(g, tx, legY - 1, 1, skirtH - 1, shade(B, 0.12));
    for (let x = tx + 1; x < tx + tw; x += 3) px(g, x, legY + 1, BD);
    const ly = legY + skirtH - 1;
    rect(g, w / 2 - 3, ly, 2, legH - 1 + leftUp, S);
    rect(g, w / 2 + 1, ly, 2, legH - 1 + rightUp, shade(S, -0.08));
    rect(g, w / 2 - 4, ly + legH - 1 + leftUp, 3, 1, l.shoes);
    rect(g, w / 2 + 1, ly + legH - 1 + rightUp, 3, 1, l.shoes);
  } else {
    const ph = legH + 2;
    rect(g, tx + 1, legY, tw - 2, 1, BD);
    rect(g, tx + 1, legY, 3, ph + leftUp, B);
    rect(g, tx + tw - 4, legY, 3, ph + rightUp, BD);
    px(g, tx + 1, legY + 1, shade(B, 0.12));
    rect(g, tx, legY + ph + leftUp, 4, 1, l.shoes);
    rect(g, tx + tw - 4, legY + ph + rightUp, 4, 1, l.shoes);
    px(g, tx + 1, legY + ph + leftUp, shade(l.shoes, 0.3));
  }
}

function drawFront(g: Ctx, l: Look, frame: number): void {
  const b = bodyOf(l);
  const top = 2 + (frame % 2 === 1 ? 1 : 0);
  hairBehindFront(g, l, b, top);
  bodyFront(g, l, b, top, frame, false);
  headFront(g, l, b, top);
}

function drawBack(g: Ctx, l: Look, frame: number): void {
  const b = bodyOf(l);
  const top = 2 + (frame % 2 === 1 ? 1 : 0);
  const { w, headW, headH } = b;
  const hx = (w - headW) / 2;
  const [HD, H, HL] = hairTones(l);
  bodyFront(g, l, b, top, frame, true);
  // Потилиця: усе волосся, з пасмами.
  rect(g, hx, top + 1, headW, headH - 1, l.skin);
  if (l.hat) {
    rect(g, hx - 1, top, headW + 2, 5, l.hat);
    rect(g, hx - 1, top + 4, headW + 2, 1, shade(l.hat, -0.2));
    rect(g, hx, top + 5, headW, 4, H);
  } else {
    rect(g, hx - 1, top, headW + 2, headH - 1, H);
    rect(g, hx + 1, top, headW - 4, 1, HL);
    for (let i = 1; i < headW; i += 3) rect(g, hx + i, top + 3, 1, headH - 5, HD);
  }
  if (l.hairStyle === 'long') {
    rect(g, hx - 1, top + headH - 2, headW + 2, l.kid ? 4 : 7, H);
    for (let i = 0; i < headW + 2; i += 3) rect(g, hx - 1 + i, top + headH - 1, 1, l.kid ? 3 : 6, HD);
  }
  if (l.hairStyle === 'bob') rect(g, hx - 1, top + headH - 3, headW + 2, 2, HD);
  if (l.hairStyle === 'ponytail') { rect(g, w / 2 - 1, top + 6, 2, 9, H); px(g, w / 2 - 1, top + 7, HL); }
  if (l.hairStyle === 'pigtails') {
    rect(g, hx - 3, top + 4, 2, 5, H);
    rect(g, hx + headW + 1, top + 4, 2, 5, H);
  }
  if (l.hairStyle === 'bun') rect(g, w / 2 - 2, top - 2, 4, 4, H);
  if (l.hairStyle === 'spiky') for (let i = 0; i < headW; i += 3) px(g, hx + i, top - 1, H);
  // Вуха.
  px(g, hx - 1, top + Math.round(headH * 0.55), shade(l.skin, -0.1));
  px(g, hx + headW, top + Math.round(headH * 0.55), shade(l.skin, -0.1));
}

/** Профіль праворуч; ліворуч — дзеркально. */
function drawSide(g: Ctx, l: Look, frame: number): void {
  const b = bodyOf(l);
  const top = 2 + (frame % 2 === 1 ? 1 : 0);
  const { w, headW, headH, torsoH, skirtH, legH } = b;
  const hx = (w - headW) / 2;
  const [HD, H, HL] = hairTones(l);
  const S = l.skin;
  const T = l.top;
  const B = l.bottom;
  const torsoY = top + headH + 1;
  const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;

  // Волосся за спиною — під тілом.
  if (l.hairStyle === 'long') rect(g, hx - 1, top + 3, 5, headH + (l.kid ? 3 : 6), HD);
  if (l.hairStyle === 'ponytail') { rect(g, hx - 3, top + 4, 3, 7, H); px(g, hx - 3, top + 5, HL); }
  // Задня рука й нога — темніші.
  rect(g, w / 2 - 1 - step, torsoY + 1, 2, torsoH - 1, shade(T, -0.3));
  // Тулуб.
  rect(g, 4, torsoY, w - 8, torsoH, T);
  rect(g, 4, torsoY, 2, torsoH, shade(T, -0.2));
  rect(g, w - 5, torsoY, 1, torsoH, shade(T, 0.15));
  if (l.hoodie) rect(g, 4, torsoY, 3, 3, shade(T, -0.3));
  if (l.scarf) { rect(g, 4, torsoY, w - 8, 2, l.scarf); rect(g, w - 5, torsoY + 2, 2, 3, shade(l.scarf, -0.12)); }
  if (l.accent && !l.hoodie) rect(g, w - 6, torsoY, 1, Math.min(3, torsoH), l.accent);
  // Низ.
  const legY = torsoY + torsoH;
  if (l.dress) {
    rect(g, 3, legY - 1, w - 6, skirtH, B);
    rect(g, 3, legY + skirtH - 2, w - 6, 1, shade(B, -0.18));
    const ly = legY + skirtH - 1;
    rect(g, w / 2 - 2 - step, ly, 2, legH - 1, shade(S, -0.1));
    rect(g, w / 2 + step, ly, 2, legH - 1, S);
    rect(g, w / 2 - 2 - step, ly + legH - 1, 3, 1, l.shoes);
    rect(g, w / 2 + step, ly + legH - 1, 3, 1, l.shoes);
  } else {
    const ph = legH + 2;
    rect(g, w / 2 - 2 - step, legY, 3, ph, shade(B, -0.18));
    rect(g, w / 2 + step, legY, 3, ph, B);
    rect(g, w / 2 - 2 - step, legY + ph, 4, 1, shade(l.shoes, -0.1));
    rect(g, w / 2 + step, legY + ph, 4, 1, l.shoes);
  }
  // Передня рука.
  rect(g, w / 2 - 1 + step, torsoY + 1, 2, torsoH - 1, shade(T, 0.1));
  rect(g, w / 2 - 1 + step * 2, torsoY + torsoH, 2, 1, S);

  // Голова в профіль: обличчя праворуч, потилиця з волоссям ліворуч.
  rect(g, hx, top + 2, headW, headH - 2, S);
  rect(g, hx + 1, top + 1, headW - 2, 1, S);
  rect(g, hx + 1, top + headH, headW - 3, 1, S);
  px(g, hx + headW, top + Math.round(headH * 0.62), S);
  rect(g, hx + 2, top + headH, headW - 5, 1, shade(S, -0.12));
  const ey = top + Math.round(headH * 0.52);
  const ex = hx + headW - 3;
  rect(g, ex, ey - 1, 2, 1, shade(l.eyes, -0.45));
  rect(g, ex, ey, 1, 2, l.eyes);
  px(g, ex + 1, ey, WHITE);
  rect(g, ex, ey - 3, 2, 1, HD);
  px(g, ex - 1, ey + 2, BLUSH);
  px(g, hx + headW - 1, ey + 4, l.beard ? HD : LIPS);
  if (l.beard) rect(g, hx + 4, ey + 3, headW - 5, 3, HD);
  if (l.glasses) {
    rect(g, ex - 1, ey - 1, 3, 1, '#3a2a2a');
    rect(g, ex - 1, ey + 2, 3, 1, '#3a2a2a');
    rect(g, hx + 2, ey, ex - hx - 3, 1, '#3a2a2a');
  }
  // Вухо.
  rect(g, hx + 4, ey, 1, 2, shade(S, -0.15));
  if (l.hat) {
    rect(g, hx - 1, top, headW + 1, 4, l.hat);
    rect(g, hx, top - 1, headW - 2, 1, l.hat);
    rect(g, hx - 1, top + 3, headW + 1, 2, shade(l.hat, -0.18));
    rect(g, hx - 1, top + 5, 3, 3, H);
  } else {
    rect(g, hx - 1, top + 1, headW, 3, H);
    rect(g, hx, top, headW - 2, 1, H);
    rect(g, hx + 2, top + 1, headW - 6, 1, HL);
    rect(g, hx - 1, top + 3, 4, headH - 4, H);
    rect(g, hx, top + 4, 1, headH - 6, HD);
    rect(g, hx + headW - 3, top + 4, 3, 1, H);
    if (l.hairStyle === 'spiky') for (let i = 0; i < headW - 1; i += 3) px(g, hx + i + 1, top - 1, H);
    if (l.hairStyle === 'bob') rect(g, hx - 1, top + 3, 5, headH - 3, H);
    if (l.hairStyle === 'pigtails') rect(g, hx - 3, top + 4, 2, 5, H);
    if (l.hairStyle === 'bun') rect(g, hx - 1, top - 2, 4, 3, H);
  }
  if (l.bow) rect(g, hx, top, 2, 2, l.bow);
}

const cache = new Map<string, Sheet>();

/** Розмір полотна спрайта без обведення. */
export function spriteSize(look: Look): { w: number; h: number } {
  return look.kid ? { w: 14, h: 26 } : { w: 16, h: 31 };
}

/** Аркуш спрайтів [напрям][кадр] з обведенням. Кешується за виглядом. */
export function sheetFor(look: Look): Sheet {
  const key = JSON.stringify(look);
  const hit = cache.get(key);
  if (hit) return hit;
  const { w, h } = spriteSize(look);
  const make = (draw: (g: Ctx, l: Look, f: number) => void, f: number) => {
    const c = canvas(w, h);
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
const HAIRS = ['#2b1d16', '#4a3020', '#6e4a2a', '#9c7a45', '#c9a46a', '#8a8a8a', '#b5651d', '#e8c26a', '#3a2a4a'];
const TOPS = ['#c2494f', '#4a7fb5', '#67a05c', '#e0a43c', '#8a5ab5', '#3a8f8f', '#d9739a', '#5d6b7a', '#f4f4f7', '#3a5ab5', '#7a4a2a'];
const BOTTOMS = ['#2e3550', '#4a3a2a', '#3d5a8c', '#5a5a64', '#7a4a6a', '#6a3a2a'];
const STYLES: HairStyle[] = ['short', 'bob', 'long', 'bun', 'ponytail', 'short', 'spiky'];
const SKINS = ['#f2c9a0', '#e8b48a', '#f6d5b5', '#d9a27a', '#c08a62'];
const EYES = ['#2b1d16', '#4a90d9', '#5a3a26', '#3a7a4a'];
const ACCENTS = ['#c2494f', '#4a7fb5', '#67a05c', '#e0a43c', '#f4f4f7', '#8a5ab5'];

export function townsfolkLook(r: () => number): Look {
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)]!;
  const kid = r() < 0.2;
  const style = pick(STYLES);
  const male = style === 'short' || style === 'spiky';
  const look: Look = {
    skin: pick(SKINS),
    hair: pick(HAIRS),
    hairStyle: kid && style === 'bun' ? 'pigtails' : style,
    top: pick(TOPS),
    bottom: pick(BOTTOMS),
    dress: !male && r() < 0.35,
    shoes: pick(['#3a2f28', '#5a3a26', '#f4f4f7', '#2e3550']),
    eyes: pick(EYES),
    kid,
    beard: male && !kid && r() < 0.25,
  };
  // Аксесуари, як у референсах: шапка, шарф, окуляри, худі.
  if (!kid && r() < 0.18) look.hat = pick(ACCENTS);
  if (r() < 0.16) look.scarf = pick(ACCENTS);
  if (!kid && r() < 0.15) look.glasses = true;
  if (male && r() < 0.3) look.hoodie = true;
  return look;
}
