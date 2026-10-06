// ============================================================
// 2D-стиль: предмети й меблі (ADR-0239). Кожен — на тому самому місці й
// того самого розміру, що в піксельному стилі (`../props.ts`), тож
// тверді сліди й сортування за глибиною не міняються. Те, чого тут ще
// немає, малює піксельний стиль — `drawProp2d` тоді повертає `false`.
// ============================================================
import type { Season } from '../../sim/calendar';
import { TILE, type Prop } from '../../world/types';
import { PALETTES } from '../palette';
import { INK, box, circle, hash01, line, lit, oval, poly, shade, softShadow, vgrad, type Ctx } from './kit';
import { drawCat2d } from './dog';

const ZASIK_H = 146;
const PARTITION_H = 154;

export function drawProp2d(g: Ctx, p: Prop, season: Season, t: number): boolean {
  if (p.scale && p.scale !== 1) {
    const ax = p.x * TILE + 8;
    const ay = p.y * TILE + 14;
    g.save();
    g.translate(ax, ay);
    g.scale(p.scale, p.scale);
    g.translate(-ax, -ay);
    const ok = drawProp2d(g, { ...p, scale: undefined }, season, t);
    g.restore();
    return ok;
  }
  const x = p.x * TILE;
  const y = p.y * TILE;
  const P = PALETTES[season];
  const snow = P.snow;
  const seed = hash01(Math.round(p.x * 5), Math.round(p.y * 5), 1);
  const tint = p.tint;
  switch (p.type) {
    // ── Подвір'я ─────────────────────────────────────────
    case 'bench': {
      softShadow(g, x + 9, y + 14, 10, 2.5);
      for (const lx of [x + 2.5, x + 13.5]) box(g, lx, y + 9, 2, 5.5, 0.6, '#4a3f44');
      box(g, x + 1, y + 3.5, 16, 3.4, 1.2, lit(g, x, y + 3, 16, 3, '#b07a46'));
      box(g, x + 1, y + 8, 16, 3.4, 1.2, lit(g, x, y + 8, 16, 3, '#c08a52'));
      if (snow) box(g, x + 1, y + 7.4, 16, 1.4, 0.7, '#ffffff', null);
      return true;
    }
    case 'well': {
      softShadow(g, x + 11, y + 15, 12, 3);
      // Зруб.
      box(g, x + 2, y + 5, 16, 10.5, 2, lit(g, x + 2, y + 5, 16, 10, '#9a948a'));
      for (let k = 0; k < 3; k += 1) line(g, x + 2.5, y + 8 + k * 2.6, x + 17.5, y + 8 + k * 2.6, 'rgba(60,50,40,0.35)', 0.45);
      oval(g, x + 10, y + 6, 7, 1.8, '#2e3e52', INK, 0.6);
      // Стовпи, вал, дашок.
      box(g, x + 2.6, y - 6, 2.2, 13, 0.8, '#7a4a2a');
      box(g, x + 15.2, y - 6, 2.2, 13, 0.8, '#7a4a2a');
      box(g, x + 4, y - 2.6, 12, 2.2, 1, '#9a6a42');
      line(g, x + 10, y - 1, x + 10, y + 3, '#6a5a4a', 0.5);
      box(g, x + 8.6, y + 2.4, 2.8, 2.6, 0.6, '#8a6040');
      poly(g, [[x - 1, y - 6.5], [x + 10, y - 13], [x + 21, y - 6.5]], snow ? '#ffffff' : lit(g, x, y - 13, 22, 7, '#b85a3c'));
      return true;
    }
    case 'bike': {
      for (const cx of [x + 4, x + 13]) {
        g.beginPath();
        g.arc(cx, y + 11, 3.2, 0, Math.PI * 2);
        g.strokeStyle = '#2b2b33';
        g.lineWidth = 0.9;
        g.stroke();
        circle(g, cx, y + 11, 0.6, '#8a8f96', null);
      }
      const fr = tint ?? '#d9534f';
      g.strokeStyle = fr;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x + 4, y + 11);
      g.lineTo(x + 8, y + 7);
      g.lineTo(x + 13, y + 11);
      g.moveTo(x + 8, y + 7);
      g.lineTo(x + 8.6, y + 11);
      g.lineTo(x + 4, y + 11);
      g.moveTo(x + 8, y + 7);
      g.lineTo(x + 12, y + 7);
      g.lineTo(x + 13, y + 11);
      g.stroke();
      box(g, x + 6, y + 5, 4, 1.2, 0.6, '#3a2f28', null);
      line(g, x + 12, y + 7, x + 12.6, y + 4.6, '#5a5a64', 0.8);
      line(g, x + 11.4, y + 4.6, x + 14, y + 4.6, '#5a5a64', 0.8);
      return true;
    }
    case 'bush': {
      softShadow(g, x + 9, y + 14, 9, 2.4);
      const leaf = snow ? '#5f7f6a' : P.leafDark;
      circle(g, x + 8, y + 9, 7, leaf, INK, 0.7);
      circle(g, x + 6.5, y + 7.5, 4.6, snow ? '#ffffff' : P.leaf, null);
      circle(g, x + 5.5, y + 6, 2.2, snow ? '#ffffff' : P.leafLight, null);
      if (season === 'summer') { circle(g, x + 4, y + 10, 0.9, '#e8402e', null); circle(g, x + 12, y + 11, 0.9, '#e8402e', null); }
      return true;
    }
    case 'pot': case 'plant': {
      softShadow(g, x + 8, y + 15, 6, 1.8);
      poly(g, [[x + 3.6, y + 9], [x + 12.4, y + 9], [x + 11.2, y + 15], [x + 4.8, y + 15]], lit(g, x + 4, y + 9, 8, 6, '#c96a4c'));
      box(g, x + 3, y + 8.4, 10, 2, 0.8, '#d8806a');
      const leaf = tint ?? '#3f8a43';
      for (const [dx, dy, a] of [[-3.5, -2, -0.7], [3.5, -2.5, 0.7], [-1.5, -5.5, -0.3], [2, -6, 0.3], [0, -3, 0]] as const) {
        oval(g, x + 8 + dx, y + 7 + dy, 2.2, 4, dx < 0 ? shade(leaf, 0.12) : leaf, INK, 0.5, a);
      }
      return true;
    }
    case 'flowerBed': {
      box(g, x, y + 4, 16, 10, 3, vgrad(g, y + 4, y + 14, '#7a5a3a', '#5e4430'));
      if (snow) { box(g, x + 1, y + 3.5, 14, 4, 2, '#ffffff', null); return true; }
      for (let k = 0; k < 6; k += 1) {
        const fx = x + 2.5 + ((k * 5 + Math.floor(seed * 7)) % 11);
        const fy = y + 4 + ((k * 3) % 5);
        line(g, fx, fy + 1, fx, fy + 4, '#3f8a43', 0.6);
        const col = P.flowers[(k + Math.floor(seed * 7)) % P.flowers.length]!;
        for (let q = 0; q < 5; q += 1) circle(g, fx + Math.cos(q * 1.26) * 1, fy + Math.sin(q * 1.26) * 1, 0.8, col, null);
        circle(g, fx, fy, 0.5, '#f6c14e', null);
      }
      return true;
    }
    case 'sunflowers': {
      for (let k = 0; k < 4; k += 1) {
        const sx = x + 2 + k * 4;
        const sy = y - 4 + (k % 2) * 3;
        const sway = Math.sin(t * 1.5 + k) * 0.6;
        line(g, sx, sy + 3, sx + sway * 0.5, sy + 19 - (k % 2) * 3, '#4f8a3a', 0.9);
        oval(g, sx + 1.6, sy + 9, 1.8, 0.8, '#5aa14a', null, 0, 0.5);
        if (season === 'summer' || season === 'autumn') {
          const petal = season === 'autumn' ? '#c9a024' : '#f6c14e';
          for (let q = 0; q < 8; q += 1) oval(g, sx + sway + Math.cos(q * 0.785) * 1.8, sy + Math.sin(q * 0.785) * 1.8, 1.1, 0.6, petal, null, 0, q * 0.785);
          circle(g, sx + sway, sy, 1.2, '#6e4a2a', null);
        }
      }
      return true;
    }
    case 'haystack': {
      softShadow(g, x + 11, y + 15, 12, 3);
      g.beginPath();
      g.moveTo(x, y + 15);
      g.quadraticCurveTo(x + 1, y - 2, x + 10, y - 2);
      g.quadraticCurveTo(x + 19, y - 2, x + 20, y + 15);
      g.closePath();
      g.fillStyle = snow ? '#ffffff' : lit(g, x, y - 2, 20, 17, '#e0bc62');
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 0.7;
      g.stroke();
      if (!snow) for (let k = 0; k < 12; k += 1) line(g, x + 3 + hash01(k, 1, 3) * 14, y + 2 + hash01(k, 2, 3) * 11, x + 4 + hash01(k, 1, 3) * 14, y + 4.5 + hash01(k, 2, 3) * 11, '#b8943a', 0.5);
      return true;
    }
    case 'chicken': {
      const walk = Math.sin(t * 1.3 + seed * 20) * 10;
      const peck = Math.floor(t * 3 + seed * 20) % 5 === 0 ? 1 : 0;
      const cx = x + 8 + walk;
      softShadow(g, cx, y + 14, 4.5, 1.2);
      line(g, cx - 1, y + 12, cx - 1, y + 14.5, '#e8a83a', 0.6);
      line(g, cx + 1, y + 12, cx + 1, y + 14.5, '#e8a83a', 0.6);
      oval(g, cx, y + 10, 4.4, 3.2, '#fbf7ee');
      oval(g, cx - 3.6, y + 8.6, 1.6, 2.2, '#efe8da', null, 0, -0.5);
      circle(g, cx + 3.2, y + 6.8 + peck, 2.2, '#fbf7ee');
      oval(g, cx + 3.2, y + 4.6 + peck, 1, 0.8, '#d9534f', null);
      poly(g, [[cx + 5.2, y + 6.8 + peck], [cx + 6.8, y + 7.4 + peck], [cx + 5.2, y + 7.9 + peck]], '#f6b23a', null);
      circle(g, cx + 3.8, y + 6.6 + peck, 0.45, '#2b2b33', null);
      return true;
    }
    case 'cat': case 'pet': {
      drawCat2d(g, x, y, tint ?? '#e8a25a', t);
      return true;
    }
    case 'woodpile': {
      softShadow(g, x + 14, y + 15, 15, 2.6);
      box(g, x, y - 2, 28, 16, 1.5, '#6e4a2a');
      for (let r = 0; r < 4; r += 1) {
        for (let k = 0; k < 7; k += 1) {
          const cx = x + 2.4 + k * 4 + (r % 2) * 2;
          if (cx > x + 25.6) continue;
          circle(g, cx, y + 1.4 + r * 3.2, 1.7, '#d4a46c', shade('#d4a46c', -0.5), 0.35);
          circle(g, cx, y + 1.4 + r * 3.2, 0.7, '#b8864e', null);
        }
      }
      box(g, x - 1.5, y - 5, 31, 3.2, 1.2, snow ? '#ffffff' : lit(g, x, y - 5, 31, 3, '#7d7a72'));
      return true;
    }
    case 'workbench': {
      softShadow(g, x + 11, y + 15, 12, 2.4);
      box(g, x + 1, y + 7, 2.2, 8, 0.6, '#7a5230');
      box(g, x + 18.8, y + 7, 2.2, 8, 0.6, '#7a5230');
      box(g, x, y + 3, 22, 4.4, 1.2, lit(g, x, y + 3, 22, 4, '#b8864e'));
      box(g, x + 3, y + 0.8, 4, 2.4, 0.6, '#5a6068');
      line(g, x + 10, y + 1.6, x + 17.5, y + 1.6, '#8a8f96', 1);
      box(g, x + 15, y - 0.4, 2.4, 2.4, 0.8, '#b04a3a');
      if (snow) box(g, x, y + 2.4, 22, 1.2, 0.6, '#ffffff', null);
      return true;
    }
    case 'planks': {
      for (let k = 0; k < 4; k += 1) box(g, x + (k % 2) * 0.8, y + 4 + k * 2.2, 26, 2.2, 0.8, k % 2 ? '#d0a26a' : '#b88a52', shade('#b88a52', -0.5), 0.35);
      box(g, x + 3, y + 12.4, 3, 2, 0.5, '#7a5230', null);
      box(g, x + 20, y + 12.4, 3, 2, 0.5, '#7a5230', null);
      return true;
    }
    case 'cellar': {
      oval(g, x + 10, y + 10, 11.5, 6.4, snow ? '#ffffff' : P.grassDark, shade(P.grassDark, -0.4), 0.6);
      box(g, x + 4, y + 5.6, 12.4, 8.4, 1.2, lit(g, x + 4, y + 6, 12, 8, '#8a6038'));
      for (let k = 1; k < 4; k += 1) line(g, x + 4 + k * 3.1, y + 6, x + 4 + k * 3.1, y + 13.6, '#5a3a24', 0.45);
      box(g, x + 8.6, y + 8.8, 3.4, 1.8, 0.6, '#4a4a52', null);
      return true;
    }
    // ── Хата ─────────────────────────────────────────────
    case 'bed': {
      const c = tint ?? '#e98fb0';
      softShadow(g, x + 9, y + 28, 11, 2.6);
      box(g, x, y, 16, 28, 2.2, lit(g, x, y, 16, 28, '#9a6a3e'));
      box(g, x - 0.4, y - 1.6, 16.8, 4, 2, lit(g, x, y - 2, 16, 4, '#a87444'));
      box(g, x + 1.6, y + 1.8, 12.8, 5.6, 2.4, vgrad(g, y + 2, y + 7, '#ffffff', '#e8e2d8'));
      // Ковдра з відгорнутим краєм.
      box(g, x + 1, y + 8, 14, 18.5, [1.4, 1.4, 2, 2], vgrad(g, y + 8, y + 26, shade(c, 0.1), shade(c, -0.08)));
      box(g, x + 1, y + 8, 14, 3, 1.4, shade(c, 0.24), null);
      for (let k = 0; k < 4; k += 1) circle(g, x + 4 + (k % 2) * 8, y + 15 + Math.floor(k / 2) * 6, 1, shade(c, -0.18), null);
      return true;
    }
    case 'rug': {
      const c = tint ?? '#e98fb0';
      oval(g, x + 16, y + 8, 16, 7, shade(c, -0.12), shade(c, -0.4), 0.5);
      oval(g, x + 16, y + 8, 13, 5.4, c, null);
      oval(g, x + 16, y + 8, 7.5, 2.8, shade(c, 0.2), null);
      for (let k = 0; k < 8; k += 1) {
        const a = (k / 8) * Math.PI * 2;
        circle(g, x + 16 + Math.cos(a) * 10.2, y + 8 + Math.sin(a) * 4.2, 0.6, shade(c, 0.3), null);
      }
      return true;
    }
    case 'floorLamp': {
      softShadow(g, x + 8, y + 15, 5, 1.4);
      oval(g, x + 8, y + 14, 4, 1.2, '#3a3a40');
      line(g, x + 8, y + 14, x + 8, y - 3, '#3a3a40', 1.2);
      poly(g, [[x + 4.5, y - 9], [x + 11.5, y - 9], [x + 13, y - 3], [x + 3, y - 3]], vgrad(g, y - 9, y - 3, shade(tint ?? '#ffd27a', 0.25), tint ?? '#ffd27a'));
      return true;
    }
    case 'poster': {
      box(g, x + 1, y + 1.6, 14, 10.6, 0.8, '#fbf6ee');
      box(g, x + 2, y + 2.6, 12, 8.4, 0.4, tint ?? '#3f7fc1', null);
      poly(g, [[x + 2, y + 11], [x + 7, y + 6], [x + 10, y + 9], [x + 14, y + 5.5], [x + 14, y + 11]], '#ecd69a', null);
      circle(g, x + 11, y + 4.6, 1.2, '#f6c14e', null);
      return true;
    }
    case 'shelf': {
      const wood = tint ?? '#8a5a34';
      softShadow(g, x + 8, y + 14, 9, 1.6);
      box(g, x, y - 10, 16, 24, 1.2, lit(g, x, y - 10, 16, 24, wood));
      const books = ['#c2494f', '#4a7fb5', '#f2c14e', '#67a05c', '#8a5ab5'];
      for (let r = 0; r < 3; r += 1) {
        box(g, x + 1.2, y - 8.8 + r * 7.6, 13.6, 6.2, 0.6, shade(wood, -0.35), null);
        for (let k = 0; k < 5; k += 1) {
          const bh = 4.4 + ((k + r) % 3) * 0.5;
          box(g, x + 1.8 + k * 2.6, y - 2.8 + r * 7.6 - bh, 2.2, bh, 0.4, books[(k + r) % 5]!, shade(books[(k + r) % 5]!, -0.45), 0.3);
        }
      }
      return true;
    }
    case 'tv': {
      softShadow(g, x + 8, y + 14, 9, 1.6);
      box(g, x, y + 6, 16, 8, 1.2, lit(g, x, y + 6, 16, 8, '#7a5236'));
      box(g, x + 1, y - 6, 14, 11, 1.6, '#2a2a33');
      const glow = ['#6fc3e8', '#8ad6a0', '#e8a2c0'][Math.floor(t / 2) % 3]!;
      box(g, x + 2.2, y - 4.8, 11.6, 8.4, 1, vgrad(g, y - 5, y + 4, shade(glow, 0.3), glow), null);
      return true;
    }
    case 'table': {
      const c = tint ?? '#c49a6c';
      softShadow(g, x + 12, y + 15, 13, 2.2);
      box(g, x + 2, y + 9, 2, 6, 0.6, shade(c, -0.4));
      box(g, x + 20, y + 9, 2, 6, 0.6, shade(c, -0.4));
      box(g, x, y + 2, 24, 8, 2, lit(g, x, y + 2, 24, 8, c));
      box(g, x, y + 8.4, 24, 1.8, [0, 0, 2, 2], shade(c, -0.22), null);
      // Глечик із квіткою.
      box(g, x + 10, y - 0.6, 4, 3.6, 1.4, '#f4eee2');
      circle(g, x + 12, y - 1.6, 1.1, '#ff7aa8', null);
      return true;
    }
    case 'stove': {
      // Українська піч — біла, з розписом.
      softShadow(g, x + 8, y + 14, 9, 1.8);
      box(g, x, y - 12, 16, 26, 2.4, lit(g, x, y - 12, 16, 26, '#f6f1e6'));
      box(g, x + 3.6, y + 1.6, 8.8, 7.6, [4, 4, 0.6, 0.6], '#3a2a24');
      const f = 0.7 + Math.sin(t * 6) * 0.15;
      oval(g, x + 8, y + 7, 3.2, 1.6 * f + 0.6, '#f39a35', null);
      oval(g, x + 8, y + 7.4, 1.8, 0.9, '#f6d14e', null);
      for (const [dx, dy] of [[3, -8], [11, -6], [6, -3]] as const) {
        circle(g, x + dx, y + dy, 1.1, '#5aa7e0', null);
        oval(g, x + dx + 1.4, y + dy + 0.4, 1, 0.5, '#5aa14a', null, 0, 0.5);
      }
      return true;
    }
    case 'window': {
      box(g, x + 0.6, y + 0.6, 14.8, 12.8, 1.4, '#8a5a34');
      box(g, x + 1.8, y + 1.8, 12.4, 10.4, 0.8, vgrad(g, y + 2, y + 12, '#cdeaf8', '#86b6dc'), null);
      line(g, x + 8, y + 2, x + 8, y + 12, '#8a5a34', 0.9);
      line(g, x + 2, y + 6.2, x + 14, y + 6.2, '#8a5a34', 0.9);
      line(g, x + 3, y + 4, x + 5, y + 2.6, 'rgba(255,255,255,0.75)', 0.6);
      for (const s of [1, -1]) {
        g.beginPath();
        const sx = s > 0 ? x + 1.8 : x + 14.2;
        g.moveTo(sx, y + 1.8);
        g.quadraticCurveTo(sx + s * 4.2, y + 5, sx + s * 1.4, y + 12.2);
        g.lineTo(sx, y + 12.2);
        g.closePath();
        g.fillStyle = '#f2a8c0';
        g.fill();
      }
      return true;
    }
    case 'rushnyk': {
      line(g, x + 1, y + 2.6, x + 15, y + 2.6, '#8a5a34', 1.6);
      for (const sx of [x + 2, x + 11]) {
        box(g, sx, y + 3.2, 3, 10.4, [0, 0, 0.8, 0.8], '#fbf6ee', shade('#fbf6ee', -0.3), 0.35);
        for (let k = 0; k < 4; k += 1) poly(g, [[sx + 1.5, y + 5 + k * 2.2], [sx + 2.4, y + 5.9 + k * 2.2], [sx + 1.5, y + 6.8 + k * 2.2], [sx + 0.6, y + 5.9 + k * 2.2]], '#c2283a', null);
      }
      return true;
    }
    case 'wardrobe': {
      softShadow(g, x + 8, y + 14, 9, 1.8);
      box(g, x, y - 12, 16, 26, 1.6, lit(g, x, y - 12, 16, 26, '#b08050'));
      box(g, x - 0.6, y - 13.4, 17.2, 2.6, 1, '#c89a6a');
      line(g, x + 8, y - 10, x + 8, y + 12.5, '#6e4a2a', 0.6);
      for (const dx of [1.6, 9.4]) box(g, x + dx, y - 9, 5, 9, 1, 'rgba(255,255,255,0.08)', 'rgba(90,50,20,0.4)', 0.4);
      circle(g, x + 6.6, y + 1, 0.7, '#f2c14e', null);
      circle(g, x + 9.4, y + 1, 0.7, '#f2c14e', null);
      return true;
    }
    case 'desk': {
      softShadow(g, x + 12, y + 14, 13, 2);
      box(g, x + 1, y + 8.4, 2, 6, 0.6, '#6e4a2a');
      box(g, x + 21, y + 8.4, 2, 6, 0.6, '#6e4a2a');
      box(g, x, y + 2, 24, 7, 1.6, lit(g, x, y + 2, 24, 7, '#b08050'));
      box(g, x + 3.6, y - 2.4, 8.6, 5.4, 0.6, '#fbf6ee');
      box(g, x + 15, y - 4.6, 5.4, 6.4, 0.8, '#3a3a44');
      box(g, x + 15.8, y - 3.8, 3.8, 4.2, 0.4, '#7fb8e0', null);
      return true;
    }
    case 'sofa': {
      const c = tint ?? '#8a5ab5';
      softShadow(g, x + 15, y + 13, 16, 2);
      box(g, x, y - 1, 30, 7, 3, lit(g, x, y - 1, 30, 7, shade(c, 0.12)));
      box(g, x + 1.6, y + 4, 26.8, 8, 2, lit(g, x, y + 4, 30, 8, c));
      line(g, x + 15, y + 4.6, x + 15, y + 11.4, shade(c, -0.3), 0.5);
      box(g, x - 1.4, y + 2.4, 4.6, 10.6, 2.2, lit(g, x - 1, y + 2, 5, 10, shade(c, -0.1)));
      box(g, x + 26.8, y + 2.4, 4.6, 10.6, 2.2, lit(g, x + 27, y + 2, 5, 10, shade(c, -0.1)));
      box(g, x + 5.4, y + 1.6, 6.4, 4.2, 1.8, '#f6d55c');
      return true;
    }
    case 'fridge': {
      softShadow(g, x + 8, y + 14, 8, 1.6);
      box(g, x + 1, y - 14, 14, 28, 2.4, lit(g, x + 1, y - 14, 14, 28, '#eef2f7'));
      line(g, x + 1.4, y - 3.6, x + 14.6, y - 3.6, '#b9c4d0', 0.7);
      line(g, x + 12, y - 10, x + 12, y - 6, '#9aa4b0', 1);
      line(g, x + 12, y - 1.5, x + 12, y + 3, '#9aa4b0', 1);
      for (let k = 0; k < 3; k += 1) box(g, x + 3 + k * 3.4, y - 12.4, 2.6, 2.6, 0.6, ['#f6c14e', '#5aa7e0', '#ff7aa8'][k]!, null);
      return true;
    }
    case 'clock': {
      circle(g, x + 8, y + 6, 5.2, '#6e4a2a');
      circle(g, x + 8, y + 6, 4.1, '#fbf6ee', null);
      for (let k = 0; k < 12; k += 3) circle(g, x + 8 + Math.cos((k / 12) * Math.PI * 2) * 3.2, y + 6 + Math.sin((k / 12) * Math.PI * 2) * 3.2, 0.35, '#6e4a2a', null);
      const a = t * 0.2;
      line(g, x + 8, y + 6, x + 8 + Math.cos(a) * 2.8, y + 6 + Math.sin(a) * 2.8, '#2b2b33', 0.6);
      line(g, x + 8, y + 6, x + 8, y + 3.6, '#2b2b33', 0.8);
      return true;
    }
    case 'photo': {
      box(g, x + 2, y + 1, 12, 11, 0.8, '#8a5a34');
      box(g, x + 3.2, y + 2.2, 9.6, 8.6, 0.4, vgrad(g, y + 2, y + 11, '#cfe4f2', '#9fc8e0'), null);
      box(g, x + 3.2, y + 8, 9.6, 2.8, 0.4, '#8fbf6a', null);
      for (const [dx, hair, body] of [[6, '#6e4a2a', '#e98fb0'], [10, '#2b1d16', '#3a6fd8']] as const) {
        circle(g, x + dx, y + 5.6, 1.2, '#f2c9a0', null);
        oval(g, x + dx, y + 4.8, 1.3, 0.7, hair, null);
        box(g, x + dx - 1.2, y + 6.8, 2.4, 2.6, 1, body, null);
      }
      return true;
    }
    case 'door': {
      box(g, x + 2, y - 8, 12, 22, [6, 6, 0.6, 0.6], lit(g, x + 2, y - 8, 12, 22, '#a8723e'));
      for (let k = 5; k < 14; k += 3) line(g, x + k, y - 5, x + k, y + 13.5, 'rgba(60,30,10,0.35)', 0.45);
      circle(g, x + 11.2, y + 3, 0.8, '#f2c14e', null);
      return true;
    }
    // ── Літня кухня ──────────────────────────────────────
    case 'chair': {
      box(g, x + 4, y - 3, 8, 2.6, 1, '#8a5a34');
      line(g, x + 4.6, y - 1, x + 4.6, y + 6.5, '#7a4a2a', 1);
      line(g, x + 11.4, y - 1, x + 11.4, y + 6.5, '#7a4a2a', 1);
      line(g, x + 4.4, y + 9, x + 4.4, y + 14, '#6e4a2a', 1);
      line(g, x + 11.6, y + 9, x + 11.6, y + 14, '#6e4a2a', 1);
      box(g, x + 3, y + 6, 10, 3.4, 1, lit(g, x + 3, y + 6, 10, 3, '#b08050'));
      return true;
    }
    case 'crates': {
      for (const [cx, fruit] of [[0, '#d9473a'], [15, '#b88a4a']] as const) {
        box(g, x + cx, y + 4, 13, 11, 1, lit(g, x + cx, y + 4, 13, 11, '#b08050'));
        line(g, x + cx + 0.5, y + 8.4, x + cx + 12.5, y + 8.4, '#7a4a2a', 0.6);
        line(g, x + cx + 0.5, y + 12, x + cx + 12.5, y + 12, '#7a4a2a', 0.6);
        for (let k = 0; k < 6; k += 1) circle(g, x + cx + 2.4 + (k % 3) * 4, y + 3.2 + Math.floor(k / 3) * 1.8, 1.5, fruit, shade(fruit, -0.45), 0.35);
      }
      return true;
    }
    case 'clayOven': {
      // Велика глиняна піч: побілена, з челом, вогнем і горщиком.
      softShadow(g, x + 32, y + 52, 34, 3);
      box(g, x + 44, y - 6, 12, 18, [2, 2, 0, 0], lit(g, x + 44, y - 6, 12, 18, '#ebe3d2'));
      box(g, x + 42, y - 8.4, 16, 3.4, 1.2, '#d6ccb8');
      g.beginPath();
      g.moveTo(x, y + 52);
      g.lineTo(x, y + 14);
      g.quadraticCurveTo(x, y + 4, x + 10, y + 4);
      g.lineTo(x + 54, y + 4);
      g.quadraticCurveTo(x + 64, y + 4, x + 64, y + 14);
      g.lineTo(x + 64, y + 52);
      g.closePath();
      g.fillStyle = lit(g, x, y + 4, 64, 48, '#f2ebdd');
      g.fill();
      g.strokeStyle = INK;
      g.lineWidth = 0.8;
      g.stroke();
      box(g, x + 2, y + 47.6, 60, 4.4, 1, '#c9bea8', null);
      // Розпис.
      for (const [dx, dy] of [[8, 18], [54, 20], [10, 34], [52, 36]] as const) {
        circle(g, x + dx, y + dy, 2, '#5a8ad0', null);
        circle(g, x + dx, y + dy, 0.8, '#f6dd8a', null);
        oval(g, x + dx + 3, y + dy + 1, 1.8, 0.8, '#5aa14a', null, 0, 0.6);
        oval(g, x + dx - 3, y + dy + 1, 1.8, 0.8, '#5aa14a', null, 0, -0.6);
      }
      // Чело з вогнем.
      box(g, x + 18, y + 22, 22, 21, [11, 11, 1, 1], '#2a1c1a');
      const fl = Math.sin(t * 6);
      oval(g, x + 29, y + 39, 8.6, 3.4, '#c4521f', null);
      oval(g, x + 26 + fl, y + 35, 3, 5, '#f39a35', null);
      oval(g, x + 32 - fl, y + 36, 2.6, 4, '#f6c14e', null);
      box(g, x + 14, y + 42.4, 30, 3.4, 1, '#ddd3c0');
      circle(g, x + 48, y + 40, 4.4, lit(g, x + 44, y + 36, 9, 9, '#a8603a'));
      box(g, x + 45, y + 35, 6, 1.8, 0.8, '#8a4a2a');
      return true;
    }
    // ── Погріб ───────────────────────────────────────────
    case 'jarShelf': {
      const W = 144;
      const top = y - 34;
      for (const sx of [x, x + W - 4, x + W / 2 - 2]) box(g, sx, top, 4, 50, 0.8, lit(g, sx, top, 4, 50, '#6a4a30'));
      const jars = ['#6f8f3a', '#c8432e', '#d9842a', '#8c2a3e', '#a8402e', '#7a9a4a', '#e0b04a', '#5a1e2e'];
      for (let shelf = 0; shelf < 3; shelf += 1) {
        const sy = top + 14 + shelf * 16;
        for (let k = 0; k < 11; k += 1) {
          const h = Math.floor(hash01(k, shelf, 47) * 1e6);
          if (h % 9 === 0) continue;
          const jx = x + 6 + k * 12 + (h % 3);
          const jh = 7 + ((h >>> 3) % 4);
          const fill = jars[(h >>> 5) % jars.length]!;
          box(g, jx, sy - jh, 8, jh, 2, vgrad(g, sy - jh, sy, shade(fill, 0.12), shade(fill, -0.15)));
          box(g, jx + 1.2, sy - jh + 1.6, 1.6, jh - 3.4, 0.8, 'rgba(255,255,255,0.4)', null);
          box(g, jx - 0.3, sy - jh - 2, 8.6, 2.4, 1, h % 4 === 0 ? '#ece0c4' : '#cfcabe', shade('#cfcabe', -0.4), 0.35);
        }
        box(g, x + 1, sy, W - 2, 3.2, 0.8, lit(g, x, sy, W, 3, '#9a6a40'));
      }
      g.fillStyle = vgrad(g, y + 14, y + 17, 'rgba(20,12,10,0.35)', 'rgba(20,12,10,0)');
      g.fillRect(x, y + 14, W, 3);
      return true;
    }
    case 'zasik': {
      const H = ZASIK_H;
      box(g, x, y, 48, H, 2, '#4a3222');
      box(g, x + 2, y + 2, 44, H - 4, 1.4, '#2e2018', null);
      const veg = p.variant === 1 ? ['#8c2a4a', '#a8344e', '#e07a2a', '#c8601e'] : ['#b08a52', '#9a7444', '#c49a62', '#86663c'];
      for (let k = 0; k < 150; k += 1) {
        const h1 = hash01(k, p.variant ?? 0, 53);
        const h2 = hash01(k, p.variant ?? 0, 54);
        const h3 = hash01(k, p.variant ?? 0, 55);
        const vx = x + 5 + h1 * 38;
        const vy = y + 5 + h2 * (H - 10);
        const ci = Math.floor(h3 * veg.length);
        const c = veg[ci]!;
        if (p.variant === 1 && ci >= 2) {
          poly(g, [[vx - 1, vy], [vx + 1, vy], [vx, vy + 5]], c, shade(c, -0.4), 0.3);
          oval(g, vx, vy - 1, 0.8, 1.2, '#5a8a3a', null);
        } else {
          oval(g, vx, vy, 2.6, 2, c, shade(c, -0.45), 0.35);
          oval(g, vx - 0.8, vy - 0.7, 0.9, 0.6, shade(c, 0.25), null);
        }
      }
      for (let k = 0; k < H; k += 24) box(g, x, y + k, 48, 2, 0.6, '#5a3a24', null);
      return true;
    }
    case 'partition': {
      const H = PARTITION_H;
      g.fillStyle = vgrad(g, y, y + H, 'rgba(20,12,10,0.25)', 'rgba(20,12,10,0.3)');
      g.fillRect(x + 8, y - 6, 3, H);
      box(g, x + 1, y - 10, 6, H, 1, lit(g, x + 1, y - 10, 6, H, '#8a5a36'));
      for (let k = 0; k < H; k += 22) line(g, x + 1.5, y - 10 + k, x + 6.5, y - 10 + k, '#4a3222', 0.5);
      box(g, x, y + H - 10, 8, 14, 1, lit(g, x, y + H - 10, 8, 14, '#6a4628'));
      return true;
    }
    case 'cellarStairs': {
      for (let k = 0; k < 7; k += 1) {
        const tone = shade('#6a4a30', k * 0.07);
        box(g, x, y + k * 6, 48, 5.4, 1, lit(g, x, y + k * 6, 48, 5, tone), shade(tone, -0.5), 0.4);
      }
      box(g, x - 2.4, y - 2, 2.4, 46, 0.8, '#4a3222', null);
      box(g, x + 48, y - 2, 2.4, 46, 0.8, '#4a3222', null);
      const gr = g.createLinearGradient(0, y + 20, 0, y + 44);
      gr.addColorStop(0, 'rgba(255,236,180,0)');
      gr.addColorStop(1, 'rgba(255,236,180,0.28)');
      g.fillStyle = gr;
      g.fillRect(x + 2, y + 20, 44, 24);
      return true;
    }
    default:
      return false;
  }
}

