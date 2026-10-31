// ============================================================
// Лєна й мама в міні-іграх садиби малюнком PixelLab (ADR-0239, власник
// 2026-10-31: «будемо допрацьовувати візуал персонажів» → «Лєна в
// міні-іграх»). Раніше Лєну тут малював код грубими блоками, а на рибалці
// — 16-піксельний спрайт, збільшений учетверо. Тепер — її власні аркуші
// 32×32 (`render/peopleHd.ts`):
//   сад     — обличчям до нас, кошик перед собою, руки на його краях;
//   курник  — профілем, кошик перед собою на рівні грудей чи біля стегон
//             (пози `skeleton-v3`, смуга `lena-*-poses.png`), ліворуч —
//             дзеркало;
//   рибалка — профілем, руки з вудкою перед собою.
// Мама в городі — теж з її аркуша.
//
// Піксель малюнка на екрані — ціла кількість пікселів пристрою
// (`artScale`), тож нічого не розпливається, а кошик малюється тим самим
// пікселем, що й Лєна. Поки аркуш вантажиться, функції кажуть «нема»
// (`null`) і гра малює Лєну по-старому — це мить на початку гри.
// ============================================================
import { drawPersonHd, drawPoseHd, frontHands, hasHdLook, hasHdPoses, poseHand, POSE_FRAME, type PoseName } from '../render/peopleHd';
import type { Look } from '../render/people';
import type { Kit } from './kit';

/**
 * Віртуальних пікселів поля на піксель малюнка PixelLab. На телефоні
 * (`z` = 2) Лєна завбільшки така, як була кодом, на комп'ютері — менша;
 * щоразу піксель малюнка — ціла кількість пікселів пристрою (`kit.s`).
 */
export function artScale(kit: Kit, z: number): number {
  return Math.max(1, Math.round(kit.s * (z > 1 ? 1.34 : 0.5))) / kit.s;
}

/** Точка на сітці пікселів пристрою. */
const snap = (kit: Kit, v: number) => Math.round(v * kit.s) / kit.s;

/** Малювати в пікселях малюнка: (x, y) — точка між стопами, `a` — `artScale`. */
function inArt(kit: Kit, x: number, y: number, a: number, draw: () => void): void {
  const g = kit.g;
  g.save();
  g.translate(snap(kit, x), snap(kit, y));
  g.scale(a, a);
  draw();
  g.restore();
}

/** Рядів плетива в кошику ширини `w`; разом з обідком і дном кошик на 3 ряди вищий. */
export function basketBody(w: number): number {
  return Math.round(w * 0.55);
}

/** Ширина кошика (пікселі малюнка) для зросту людини. */
export function basketWidth(look: Look): number {
  return look.kid ? 18 : 20;
}

/** Де кошик на полі: середина верхнього краю й пів ширини (віртуальні пікселі). */
export interface BasketSpot {
  bx: number;
  by: number;
  half: number;
}

// Плетений кошик піксель за пікселем: обвідка, світлий обідок, плетиво
// «цеглинками», що зсуваються через ряд, і ручка дугою.
const OUTLINE = '#4a2a14';
const RIM = '#e0aa66';
const RIM_DARK = '#b8783c';
const WEAVE = '#b07a40';
const WEAVE_DARK = '#8a5a2c';
const STAKE = '#6a4020';
const HANDLE = '#9a6430';
const HANDLE_LIGHT = '#c89050';

/**
 * Кошик у пікселях малюнка: `cx` — середина, `top` — верхній край обідка,
 * `w` — ширина. `items` — кольори того, що лежить зверху (яйця — білі,
 * фрукти — свої), видно останні дев'ять.
 */
export function drawBasketArt(g: CanvasRenderingContext2D, cx: number, top: number, w: number, items: readonly string[]): void {
  const px = (x: number, y: number, c: string, ww = 1, hh = 1) => { g.fillStyle = c; g.fillRect(x, y, ww, hh); };
  const x0 = Math.round(cx - w / 2);
  const h = basketBody(w);
  // Ручка — дуга над кошиком, позаду вмісту.
  const span = w - 6;
  const peak = Math.round(w * 0.45);
  for (let k = 0; k <= span; k += 1) {
    const t = (k / span) * 2 - 1;
    const y = top - Math.round(Math.sqrt(Math.max(0, 1 - t * t)) * peak);
    px(x0 + 3 + k, y - 1, OUTLINE);
    px(x0 + 3 + k, y, k < span / 2 ? HANDLE_LIGHT : HANDLE);
  }
  // Що лежить у кошику, виглядає з-за обідка.
  items.slice(-9).forEach((c, i) => {
    const ix = x0 + 3 + ((i * 5) % Math.max(1, w - 7));
    const iy = top - 2 - Math.floor(i / 3);
    const egg = c.toLowerCase() === '#fbf3e4';
    if (egg) {
      px(ix, iy - 2, OUTLINE, 3, 1);
      px(ix - 1, iy - 1, OUTLINE, 1, 3);
      px(ix + 3, iy - 1, OUTLINE, 1, 3);
      px(ix, iy - 1, c, 3, 3);
      px(ix, iy - 1, '#ffffff');
      px(ix + 1, iy + 1, '#e2d2b8', 2, 1);
    } else {
      px(ix, iy - 2, OUTLINE, 3, 1);
      px(ix - 1, iy - 1, OUTLINE, 1, 3);
      px(ix + 3, iy - 1, OUTLINE, 1, 3);
      px(ix, iy - 1, c, 3, 3);
      px(ix, iy - 1, '#ffffff99');
    }
  });
  // Тулуб: звужується донизу на піксель із кожного боку, плетиво цеглинками.
  for (let r = 0; r < h; r += 1) {
    const inset = r >= h - 2 ? 1 : 0;
    const a = x0 + inset;
    const b = x0 + w - 1 - inset;
    for (let x = a + 1; x < b; x += 1) {
      const brick = ((x - x0 + (Math.floor(r / 2) % 2) * 2) % 4) < 2;
      px(x, top + 2 + r, (x - x0) % 4 === 0 ? STAKE : brick ? WEAVE : WEAVE_DARK);
    }
    px(a, top + 2 + r, OUTLINE);
    px(b, top + 2 + r, OUTLINE);
  }
  px(x0 + 2, top + 2 + h, OUTLINE, w - 4, 1);
  // Обідок: світлий верх, темніший низ, обвідка довкола.
  px(x0, top - 1, OUTLINE, w, 1);
  px(x0 - 1, top, OUTLINE, 1, 2);
  px(x0 + w, top, OUTLINE, 1, 2);
  px(x0, top, RIM, w, 1);
  px(x0, top + 1, RIM_DARK, w, 1);
}

/**
 * Лєна в саду: обличчям до нас, кошик перед собою на висоті рук — руки
 * лягають на його краї. `moving` — іде (кадри ходи «униз»). Повертає, де
 * кошик, або `null`, поки аркуш не готовий.
 */
export function drawLenaFront(kit: Kit, look: Look, x: number, y: number, moving: boolean, t: number, items: readonly string[], z: number): BasketSpot | null {
  const hands = frontHands(look);
  if (!hands || !hasHdLook(look)) return null;
  const a = artScale(kit, z);
  const w = Math.max(basketWidth(look), hands.r - hands.l + 5);
  inArt(kit, x, y, a, () => {
    kit.g.save();
    kit.g.scale(2, 2);
    // Аркуш малюється у світових пікселях — пів пікселя малюнка.
    drawPersonHd(kit.g, look, 0, 0, 0, moving, t);
    kit.g.restore();
    drawBasketArt(kit.g, Math.round((hands.l + hands.r) / 2), -hands.up - 2, w, items);
  });
  return { bx: snap(kit, x) + ((hands.l + hands.r) / 2) * a, by: snap(kit, y) - (hands.up + 2) * a, half: (w / 2) * a };
}

/** Поза в курнику: кошик перед собою вгорі чи внизу, ліворуч чи праворуч. */
export type CoopPose = 'ul' | 'dl' | 'ur' | 'dr';

const COOP_FRAME: Record<'u' | 'd', PoseName> = { u: 'chest', d: 'low' };

/**
 * Кошик у позі курника в пікселях малюнка від точки між стопами (обличчям
 * праворуч): середина й верхній край обідка (угору — від'ємне). Угорі
 * кошик лежить на долонях, як піднос (руки під дном); унизу висить з
 * долонь за обідок. Так «угорі» й «унизу» далеко одне від одного, як у
 * «Ну, погоди!», хоч руки в позах піднімаються лише на долоню.
 */
function coopArt(look: Look, pose: CoopPose): { cx: number; top: number; w: number } | null {
  const up = pose[0] === 'u';
  const hand = poseHand(look, COOP_FRAME[up ? 'u' : 'd']);
  if (!hand) return null;
  const w = basketWidth(look);
  // Низ долоні — рядок -hand.y - 1; долоня заввишки три пікселі.
  if (up) return { cx: hand.x + w / 2 - 5, top: -hand.y - 3 - basketBody(w) - 2, w };
  return { cx: hand.x + w / 2 - 3, top: -hand.y - 2, w };
}

/**
 * Де кошик у позі курника (віртуальні пікселі): середина верхнього краю й
 * пів ширини. Чиста геометрія за точкою долоні з таблиці аркуша
 * (`poseHand`); `s` — пікселів пристрою на віртуальний, `a` — `artScale`.
 */
export function coopSpot(look: Look, x: number, y: number, pose: CoopPose, a: number, s: number): BasketSpot | null {
  const art = coopArt(look, pose);
  if (!art) return null;
  const side = pose[1] === 'l' ? -1 : 1;
  const sx = Math.round(x * s) / s;
  const sy = Math.round(y * s) / s;
  return { bx: sx + side * art.cx * a, by: sy + art.top * a, half: (art.w / 2) * a };
}

/** Де кошик у позі курника на цьому полі: `null`, поки смуга поз не готова. */
export function coopBasketAt(kit: Kit, look: Look, x: number, y: number, pose: CoopPose, z: number): BasketSpot | null {
  if (!hasHdPoses(look)) return null;
  return coopSpot(look, x, y, pose, artScale(kit, z), kit.s);
}

/** Лєна в курнику з кошиком (`coopBasketAt`); `null`, поки смуга поз не готова. */
export function drawLenaCoop(kit: Kit, look: Look, x: number, y: number, pose: CoopPose, items: readonly string[], z: number): BasketSpot | null {
  const name = COOP_FRAME[pose[0] as 'u' | 'd'];
  const art = coopArt(look, pose);
  if (!art || !hasHdPoses(look)) return null;
  const a = artScale(kit, z);
  const mirror = pose[1] === 'l';
  inArt(kit, x, y, a, () => {
    kit.g.save();
    kit.g.scale(2, 2);
    drawPoseHd(kit.g, look, 0, 0, mirror, POSE_FRAME[name]);
    kit.g.restore();
    kit.g.save();
    if (mirror) kit.g.scale(-1, 1);
    drawBasketArt(kit.g, art.cx, art.top, art.w, items);
    kit.g.restore();
  });
  return coopSpot(look, x, y, pose, a, kit.s);
}

/**
 * Лєна з вудкою: профілем праворуч, руки перед собою. Повертає, де руки
 * (звідти йде вудка), або `null`, поки смуга поз не готова.
 */
export function drawLenaFishing(kit: Kit, look: Look, x: number, y: number, z: number): { hx: number; hy: number; a: number } | null {
  const hand = poseHand(look, 'chest');
  if (!hand || !hasHdPoses(look)) return null;
  const a = artScale(kit, z);
  inArt(kit, x, y, a, () => {
    kit.g.save();
    kit.g.scale(2, 2);
    drawPoseHd(kit.g, look, 0, 0, false, POSE_FRAME.chest);
    kit.g.restore();
  });
  return { hx: snap(kit, x) + hand.x * a, hy: snap(kit, y) - hand.y * a, a };
}

/** Кошик сам по собі (мамин у городі): (x, y) — середина верхнього краю, тим самим пікселем, що й Лєна. */
export function drawBasketFarm(kit: Kit, x: number, y: number, w: number, items: readonly string[], z: number): void {
  inArt(kit, x, y, artScale(kit, z), () => drawBasketArt(kit.g, 0, 0, w, items));
}

/**
 * Людина з аркуша 32×32 (мама в городі): стоїть у (x, y) обличчям `dir`
 * (0 униз, 1 ліворуч, 2 праворуч). `false`, поки аркуш не готовий.
 */
export function drawPersonFarm(kit: Kit, look: Look, x: number, y: number, dir: 0 | 1 | 2, z: number): boolean {
  if (!hasHdLook(look)) return false;
  inArt(kit, x, y, artScale(kit, z), () => {
    kit.g.save();
    kit.g.scale(2, 2);
    drawPersonHd(kit.g, look, 0, 0, dir, false, 0);
    kit.g.restore();
  });
  return true;
}
