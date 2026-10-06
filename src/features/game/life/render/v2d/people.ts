// ============================================================
// 2D-стиль: люди (ADR-0239). Людина збирається з частин — ноги, тулуб
// (сукня чи кофта зі штанами), руки, голова, волосся за зачіскою — і
// анімується поворотом частин, а не кадрами: хода плавна на будь-якій
// швидкості. Пропорції ті самі, що в піксельному стилі (доросла — 31 px,
// дитина — 26 px), тож Лєна стоїть там само відносно дверей і меблів.
// ============================================================
import type { Dir, Look } from '../people';
import { INK, box, circle, line, oval, poly, shade, softShadow, type Ctx } from './kit';

interface Body { headR: number; headY: number; torsoTop: number; hip: number; shoulderW: number; hipW: number; legW: number }

function bodyOf(l: Look): Body {
  return l.kid
    ? { headR: 6.1, headY: -18.6, torsoTop: -12.6, hip: -4.6, shoulderW: 3.6, hipW: 3.2, legW: 1.5 }
    : { headR: 6.6, headY: -23.4, torsoTop: -16.2, hip: -6, shoulderW: 4.2, hipW: 3.6, legW: 1.7 };
}

/** Людина: `x, y` — точка між стопами. */
export function drawPerson2d(g: Ctx, l: Look, x: number, y: number, dir: Dir, moving: boolean, t: number, shadowOn = true): void {
  if (shadowOn) softShadow(g, x, y, l.kid ? 5.5 : 6.5, 1.8, 0.3);
  const ph = moving ? t * 9.5 : 0;
  const bob = moving ? Math.abs(Math.sin(ph)) * 0.9 : Math.sin(t * 2) * 0.18;
  g.save();
  g.translate(x, y);
  if (dir === 1) g.scale(-1, 1);
  const b = bodyOf(l);
  if (dir === 0 || dir === 3) frontBack(g, l, b, dir === 3, ph, moving, bob, t);
  else side(g, l, b, ph, moving, bob, t);
  g.restore();
}

function legsFB(g: Ctx, l: Look, b: Body, ph: number, moving: boolean): void {
  for (const s of [-1, 1] as const) {
    const lift = moving ? Math.max(0, Math.sin(ph + (s > 0 ? Math.PI : 0))) * 1.6 : 0;
    const lx = s * 1.9;
    const legCol = l.dress ? l.skin : l.bottom;
    box(g, lx - b.legW / 2 - 0.2, b.hip - 0.5, b.legW + 0.4, -b.hip - 0.6 - lift, 0.8, legCol, INK, 0.55);
    oval(g, lx, -0.9 - lift, 1.7, 1.1, l.shoes, INK, 0.55);
  }
}

function torsoFB(g: Ctx, l: Look, b: Body, back: boolean): void {
  const top = b.torsoTop;
  if (l.dress) {
    // Сукня: ліф і розкльошена спідниця.
    const hem = b.hip + (l.kid ? 1.6 : 2.4);
    g.beginPath();
    g.moveTo(-b.shoulderW + 0.6, top + 0.6);
    g.quadraticCurveTo(-b.shoulderW, top, -b.shoulderW + 0.2, top + 2.6);
    g.lineTo(-b.hipW - 2.2, hem);
    g.quadraticCurveTo(0, hem + 1.4, b.hipW + 2.2, hem);
    g.lineTo(b.shoulderW - 0.2, top + 2.6);
    g.quadraticCurveTo(b.shoulderW, top, b.shoulderW - 0.6, top + 0.6);
    g.closePath();
    const gr = g.createLinearGradient(-b.hipW, top, b.hipW, hem);
    gr.addColorStop(0, shade(l.top, 0.14));
    gr.addColorStop(1, shade(l.top, -0.12));
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.6;
    g.stroke();
    // Пояс і подол.
    line(g, -b.hipW + 0.2, b.hip - 3, b.hipW - 0.2, b.hip - 3, l.accent ?? shade(l.top, -0.25), 0.9);
    g.beginPath();
    g.moveTo(-b.hipW - 1.8, hem - 0.6);
    g.quadraticCurveTo(0, hem + 0.8, b.hipW + 1.8, hem - 0.6);
    g.strokeStyle = shade(l.top, 0.3);
    g.lineWidth = 0.5;
    g.stroke();
  } else {
    // Штани (на ногах) — тут лише кофта.
    box(g, -b.hipW, b.hip - 2.4, b.hipW * 2, 2.8, 1, l.bottom, INK, 0.55);
    g.beginPath();
    g.moveTo(-b.shoulderW + 0.6, top + 0.4);
    g.quadraticCurveTo(-b.shoulderW, top, -b.shoulderW + 0.1, top + 2.4);
    g.lineTo(-b.hipW - 0.2, b.hip - 1.4);
    g.lineTo(b.hipW + 0.2, b.hip - 1.4);
    g.lineTo(b.shoulderW - 0.1, top + 2.4);
    g.quadraticCurveTo(b.shoulderW, top, b.shoulderW - 0.6, top + 0.4);
    g.closePath();
    const gr = g.createLinearGradient(-b.hipW, top, b.hipW, b.hip);
    gr.addColorStop(0, shade(l.top, 0.12));
    gr.addColorStop(1, shade(l.top, -0.12));
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.6;
    g.stroke();
    if (l.accent && !back) line(g, 0, top + 1, 0, b.hip - 1.6, l.accent, 0.8);
    if (l.hoodie && !back) {
      line(g, -0.9, top + 1, -1.1, top + 4, '#f4f4f7', 0.4);
      line(g, 0.9, top + 1, 1.1, top + 4, '#f4f4f7', 0.4);
    }
  }
  if (l.hoodie) oval(g, 0, top + (back ? 1.2 : 0.2), b.shoulderW - 0.6, 1.6, shade(l.top, -0.15), INK, 0.5);
  if (l.scarf) box(g, -b.shoulderW + 0.8, top - 0.6, (b.shoulderW - 0.8) * 2, 2, 1, l.scarf, INK, 0.5);
}

function armsFB(g: Ctx, l: Look, b: Body, ph: number, moving: boolean): void {
  for (const s of [-1, 1] as const) {
    const sw = moving ? Math.sin(ph + (s > 0 ? 0 : Math.PI)) * 0.9 : 0;
    const sx = s * (b.shoulderW + 0.4);
    const len = l.kid ? 6 : 7.4;
    g.beginPath();
    g.moveTo(sx, b.torsoTop + 1.4);
    g.lineTo(sx + s * 0.7, b.torsoTop + 1.4 + len + sw);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.stroke();
    g.strokeStyle = l.dress || l.hoodie ? l.top : l.top;
    g.lineWidth = 1.5;
    g.stroke();
    circle(g, sx + s * 0.7, b.torsoTop + 1.8 + len + sw, 1, l.skin, INK, 0.5);
  }
}

function frontBack(g: Ctx, l: Look, b: Body, back: boolean, ph: number, moving: boolean, bob: number, t: number): void {
  legsFB(g, l, b, ph, moving);
  g.save();
  g.translate(0, -bob);
  if (!back) hairBehind(g, l, b);
  armsFB(g, l, b, ph, moving);
  torsoFB(g, l, b, back);
  // Шия.
  box(g, -1, b.torsoTop - 1.4, 2, 2, 0.6, shade(l.skin, -0.1), null);
  head(g, l, b, back, t);
  g.restore();
}

function hairTones(l: Look): [string, string, string] {
  return [shade(l.hair, -0.25), l.hair, shade(l.hair, 0.22)];
}

/** Довге волосся й коси позаду тулуба. */
function hairBehind(g: Ctx, l: Look, b: Body): void {
  const [HD] = hairTones(l);
  const r = b.headR;
  if (l.hairStyle === 'long') {
    g.beginPath();
    g.moveTo(-r - 0.4, b.headY);
    g.quadraticCurveTo(-r - 1.4, b.headY + r + 4, -r + 0.6, b.torsoTop + (l.kid ? 4 : 6.5));
    g.lineTo(r - 0.6, b.torsoTop + (l.kid ? 4 : 6.5));
    g.quadraticCurveTo(r + 1.4, b.headY + r + 4, r + 0.4, b.headY);
    g.closePath();
    g.fillStyle = HD;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.6;
    g.stroke();
  }
}

function head(g: Ctx, l: Look, b: Body, back: boolean, t: number): void {
  const [HD, H, HL] = hairTones(l);
  const r = b.headR;
  const cy = b.headY;
  // Пучок і хвостик — позаду голови.
  if (l.hairStyle === 'bun') circle(g, 0, cy - r + 0.2, 2.6, H, INK, 0.6);
  if (l.hairStyle === 'ponytail' && back) {
    g.beginPath();
    g.moveTo(-1.6, cy - 1);
    g.quadraticCurveTo(-2.4, cy + 6, 0, cy + 9);
    g.quadraticCurveTo(2.4, cy + 6, 1.6, cy - 1);
    g.closePath();
    g.fillStyle = H;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.6;
    g.stroke();
  }
  if (l.hairStyle === 'pigtails') {
    for (const s of [-1, 1]) {
      oval(g, s * (r + 1.2), cy + 2, 2, 3.4, H, INK, 0.6, s * 0.3);
      if (l.bow) {
        poly(g, [[s * (r + 0.2), cy - 1.4], [s * (r + 2.6), cy - 3], [s * (r + 2.6), cy + 0.2]], l.bow, INK, 0.45);
        poly(g, [[s * (r + 0.2), cy - 1.4], [s * (r - 2), cy - 3], [s * (r - 2), cy + 0.2]], l.bow, INK, 0.45);
      }
    }
  }
  if (back) {
    // Потилиця — волосся.
    circle(g, 0, cy, r, H, INK, 0.7);
    oval(g, -1.6, cy - r * 0.45, r * 0.5, r * 0.28, HL, null, 0, -0.4);
    if (l.hairStyle === 'long') {
      box(g, -r + 0.2, cy, (r - 0.2) * 2, r + 4, [0, 0, 3, 3], H, INK, 0.6);
      for (const x of [-2.4, 0, 2.4]) line(g, x, cy + 2, x * 0.9, cy + r + 2.6, HD, 0.4);
    }
    if (l.hairStyle === 'bob') box(g, -r - 0.4, cy - 0.5, (r + 0.4) * 2, r * 0.9, [0, 0, 2, 2], H, INK, 0.6);
    if (l.hat) hat(g, l, r, cy);
    return;
  }
  // Обличчя.
  circle(g, 0, cy, r, l.skin, INK, 0.7);
  oval(g, 0, cy + r * 0.55, r * 0.75, r * 0.32, shade(l.skin, -0.06), null);
  // Очі: великі, з відблиском; моргають.
  const blink = Math.sin(t * 0.9) > 0.985;
  const ey = cy + 1;
  for (const ex of [-2.5, 2.5]) {
    if (blink) line(g, ex - 0.9, ey, ex + 0.9, ey, shade(l.eyes, -0.4), 0.6);
    else {
      oval(g, ex, ey, 1.05, 1.4, shade(l.eyes, -0.3), null);
      oval(g, ex, ey + 0.3, 0.7, 0.9, l.eyes, null);
      circle(g, ex - 0.35, ey - 0.5, 0.42, '#ffffff', null);
    }
  }
  // Рум'янець, ніс, усмішка.
  oval(g, -3.8, ey + 2.1, 1.2, 0.6, 'rgba(240,130,130,0.55)', null);
  oval(g, 3.8, ey + 2.1, 1.2, 0.6, 'rgba(240,130,130,0.55)', null);
  g.beginPath();
  g.arc(0, ey + 2.4, 1, 0.2, Math.PI - 0.2);
  g.strokeStyle = '#a8504e';
  g.lineWidth = 0.5;
  g.stroke();
  if (l.beard) {
    g.beginPath();
    g.arc(0, cy + 1.4, r - 0.6, 0.25, Math.PI - 0.25);
    g.lineTo(-r * 0.75, cy + 2);
    g.fillStyle = HD;
    g.fill();
  }
  if (l.glasses) {
    for (const ex of [-2.5, 2.5]) {
      g.beginPath();
      g.arc(ex, ey, 1.7, 0, Math.PI * 2);
      g.strokeStyle = '#3a2a2a';
      g.lineWidth = 0.45;
      g.stroke();
    }
    line(g, -0.8, ey, 0.8, ey, '#3a2a2a', 0.4);
  }
  // Волосся спереду: шапочка з чубчиком.
  g.beginPath();
  g.arc(0, cy, r + 0.3, Math.PI * 1.02, Math.PI * 1.98);
  if (l.hairStyle === 'short' || l.hairStyle === 'spiky') {
    g.quadraticCurveTo(r * 0.3, cy - r * 0.35, -r * 0.2, cy - r * 0.25);
    g.quadraticCurveTo(-r * 0.7, cy - r * 0.2, -r - 0.3, cy - 0.4);
  } else {
    // Чубчик хвилями.
    g.quadraticCurveTo(r * 0.6, cy - r * 0.1, r * 0.25, cy - r * 0.32);
    g.quadraticCurveTo(0, cy - r * 0.05, -r * 0.3, cy - r * 0.34);
    g.quadraticCurveTo(-r * 0.7, cy - r * 0.05, -r - 0.3, cy - 0.4);
  }
  g.closePath();
  g.fillStyle = H;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.6;
  g.stroke();
  oval(g, -1.8, cy - r * 0.62, r * 0.42, r * 0.2, HL, null, 0, -0.25);
  if (l.hairStyle === 'spiky') for (const sx of [-3, 0, 3]) poly(g, [[sx - 1.4, cy - r + 0.8], [sx + 0.4, cy - r - 2], [sx + 1.4, cy - r + 0.8]], H, INK, 0.5);
  if (l.hairStyle === 'long' || l.hairStyle === 'bob') {
    // Пасма обабіч обличчя.
    const len = l.hairStyle === 'long' ? r + 2.6 : r * 0.9;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(s * (r + 0.3), cy - 0.6);
      g.quadraticCurveTo(s * (r + 1.2), cy + len * 0.6, s * (r - 0.6), cy + len);
      g.lineTo(s * (r - 2), cy + len * 0.6);
      g.quadraticCurveTo(s * (r - 1.6), cy + 1, s * (r - 1.4), cy - 1);
      g.closePath();
      g.fillStyle = H;
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 0.55;
      g.stroke();
    }
  }
  if (l.hairStyle === 'ponytail') oval(g, r + 0.6, cy + 1, 1.2, 2.6, H, INK, 0.5, 0.3);
  if (l.hat) hat(g, l, r, cy);
}

function hat(g: Ctx, l: Look, r: number, cy: number): void {
  g.beginPath();
  g.arc(0, cy - 0.6, r + 0.5, Math.PI, 0);
  g.closePath();
  g.fillStyle = l.hat!;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.6;
  g.stroke();
  box(g, -r - 0.6, cy - 1.6, (r + 0.6) * 2, 2, 1, shade(l.hat!, -0.15), INK, 0.5);
  circle(g, 0, cy - r - 1, 1.3, shade(l.hat!, 0.25), INK, 0.5);
}

function side(g: Ctx, l: Look, b: Body, ph: number, moving: boolean, bob: number, t: number): void {
  const swing = moving ? Math.sin(ph) * 0.55 : 0;
  const legLen = -b.hip;
  const legCol = l.dress ? l.skin : l.bottom;
  const leg = (a: number, far: boolean) => {
    g.save();
    g.translate(0, b.hip);
    g.rotate(a);
    box(g, -b.legW / 2 - 0.2, -0.6, b.legW + 0.4, legLen - 0.4, 0.8, far ? shade(legCol, -0.15) : legCol, INK, 0.55);
    oval(g, 0.8, legLen - 0.6, 1.9, 1.05, far ? shade(l.shoes, -0.2) : l.shoes, INK, 0.55);
    g.restore();
  };
  const arm = (a: number, far: boolean) => {
    g.save();
    g.translate(0, b.torsoTop + 1.6);
    g.rotate(a);
    const len = l.kid ? 6 : 7.4;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, len);
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.stroke();
    g.strokeStyle = far ? shade(l.top, -0.15) : l.top;
    g.lineWidth = 1.5;
    g.stroke();
    circle(g, 0, len + 0.4, 1, l.skin, INK, 0.5);
    g.restore();
  };
  leg(-swing, true);
  g.save();
  g.translate(0, -bob);
  arm(swing * 0.9, true);
  if (l.hairStyle === 'long') {
    g.beginPath();
    g.moveTo(-1, b.headY);
    g.quadraticCurveTo(-b.headR - 2.2, b.headY + 4, -2.6, b.torsoTop + (l.kid ? 4 : 6.5));
    g.lineTo(1, b.torsoTop + 2);
    g.closePath();
    g.fillStyle = shade(l.hair, -0.22);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.6;
    g.stroke();
  }
  g.restore();
  leg(swing, false);
  g.save();
  g.translate(0, -bob);
  // Тулуб у профіль.
  const top = b.torsoTop;
  if (l.dress) {
    const hem = b.hip + (l.kid ? 1.6 : 2.4);
    poly(g, [[-2.6, top + 0.8], [2.8, top + 0.8], [3.2 + 1.4, hem], [-3.4 - 1, hem]], l.top);
    line(g, -2.6, b.hip - 3, 2.8, b.hip - 3, l.accent ?? shade(l.top, -0.25), 0.9);
  } else {
    box(g, -2.8, b.hip - 2.4, 5.6, 2.8, 1, l.bottom, INK, 0.55);
    box(g, -2.8, top + 0.4, 5.8, b.hip - top - 1.6, [2.2, 2.2, 0.8, 0.8], l.top, INK, 0.6);
  }
  if (l.hoodie) oval(g, -2.2, top + 0.6, 1.8, 2, shade(l.top, -0.15), INK, 0.5);
  if (l.scarf) box(g, -2.4, top - 0.6, 5, 2, 1, l.scarf, INK, 0.5);
  box(g, -1, top - 1.4, 2, 2, 0.6, shade(l.skin, -0.1), null);
  headSide(g, l, b, t);
  arm(-swing * 0.9, false);
  g.restore();
}

function headSide(g: Ctx, l: Look, b: Body, t: number): void {
  const [HD, H, HL] = hairTones(l);
  const r = b.headR;
  const cy = b.headY;
  if (l.hairStyle === 'bun') circle(g, -2.6, cy - r + 1.2, 2.5, H, INK, 0.6);
  if (l.hairStyle === 'ponytail') {
    g.beginPath();
    g.moveTo(-r + 1, cy - 1.8);
    g.quadraticCurveTo(-r - 4, cy + 1, -r - 1.6, cy + 7);
    g.quadraticCurveTo(-r + 0.4, cy + 2.4, -r + 2, cy + 0.4);
    g.closePath();
    g.fillStyle = H;
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.6;
    g.stroke();
  }
  if (l.hairStyle === 'pigtails') {
    oval(g, -r - 0.6, cy + 2, 2, 3.4, H, INK, 0.6, 0.3);
    if (l.bow) poly(g, [[-r + 0.6, cy - 1], [-r - 2, cy - 3], [-r - 2, cy + 0.6]], l.bow, INK, 0.45);
  }
  circle(g, 0, cy, r, l.skin, INK, 0.7);
  // Ніс і щока.
  circle(g, r - 0.2, cy + 1.6, 0.9, l.skin, INK, 0.45);
  oval(g, 2.6, cy + 2.4, 1.3, 0.6, 'rgba(240,130,130,0.55)', null);
  const blink = Math.sin(t * 0.9) > 0.985;
  if (blink) line(g, 2.2, cy + 0.8, 3.8, cy + 0.8, shade(l.eyes, -0.4), 0.6);
  else {
    oval(g, 3, cy + 0.8, 0.9, 1.35, shade(l.eyes, -0.3), null);
    circle(g, 2.8, cy + 0.2, 0.38, '#ffffff', null);
  }
  g.beginPath();
  g.arc(r - 2.2, cy + 3.2, 0.8, 0.3, Math.PI * 0.8);
  g.strokeStyle = '#a8504e';
  g.lineWidth = 0.45;
  g.stroke();
  if (l.beard) {
    g.beginPath();
    g.arc(0.5, cy + 1.8, r - 1, 0.05, Math.PI * 0.75);
    g.fillStyle = HD;
    g.fill();
  }
  if (l.glasses) {
    g.beginPath();
    g.arc(3, cy + 0.8, 1.7, 0, Math.PI * 2);
    g.strokeStyle = '#3a2a2a';
    g.lineWidth = 0.45;
    g.stroke();
    line(g, 1.3, cy + 0.6, -2, cy, '#3a2a2a', 0.4);
  }
  // Волосся: потилиця й тім'я, чубчик над оком.
  g.beginPath();
  g.arc(0, cy, r + 0.3, Math.PI * 0.62, Math.PI * 1.92);
  g.quadraticCurveTo(r * 0.5, cy - r * 0.2, r * 0.05, cy - r * 0.34);
  g.quadraticCurveTo(-r * 0.4, cy - 0.2, -r * 0.5, cy + r * 0.62);
  g.closePath();
  g.fillStyle = H;
  g.fill();
  g.strokeStyle = INK;
  g.lineWidth = 0.6;
  g.stroke();
  oval(g, -1.2, cy - r * 0.6, r * 0.42, r * 0.2, HL, null, 0, -0.2);
  if (l.hairStyle === 'spiky') for (const sx of [-3, 0]) poly(g, [[sx - 1.4, cy - r + 0.8], [sx, cy - r - 2], [sx + 1.4, cy - r + 0.8]], H, INK, 0.5);
  if (l.hat) hat(g, l, r, cy);
}

/** Емоція над головою: серце, зірка, «Z». */
export function drawEmote2d(g: Ctx, kind: 'heart' | 'star' | 'sleep', cx: number, cy: number): void {
  if (kind === 'heart') {
    g.beginPath();
    g.moveTo(cx, cy + 2.6);
    g.bezierCurveTo(cx - 4.4, cy - 0.4, cx - 2.2, cy - 3.8, cx, cy - 1.4);
    g.bezierCurveTo(cx + 2.2, cy - 3.8, cx + 4.4, cy - 0.4, cx, cy + 2.6);
    g.fillStyle = '#ff5d8f';
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 0.55;
    g.stroke();
    circle(g, cx - 1.4, cy - 1.2, 0.5, 'rgba(255,255,255,0.8)', null);
  } else if (kind === 'star') {
    const pts: [number, number][] = [];
    for (let k = 0; k < 10; k += 1) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? 1.2 : 2.8;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    poly(g, pts, '#ffd447', INK, 0.5);
  } else {
    g.font = '700 6px Nunito, system-ui, sans-serif';
    g.textAlign = 'center';
    g.lineWidth = 1.4;
    g.strokeStyle = INK;
    g.strokeText('z', cx, cy + 2);
    g.fillStyle = '#ffffff';
    g.fillText('z', cx, cy + 2);
  }
}
