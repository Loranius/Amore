// ============================================================
// Город у Жилинцях (ADR-0239, власник 2026-10-12: «покращення подвір'я»).
// Замість одного поля однакових паростків — ділянки з різними культурами,
// і кожна живе за порою року: навесні сходи, влітку кущі й цвіт, восени
// врожай, узимку — сніг на грядках.
//
// Низькі культури малюються в землі (`groundCanvas`, кешується), високі —
// кукурудза й помідори на кілочках — окремими пропами, щоб Лєна й мама
// ховались за ними, як за справжніми.
// Координати: `x, y` — лівий верхній кут клітинки, як у `tiles.ts`.
// ============================================================
import type { Season } from '../sim/calendar';
import type { CropKind } from '../world/types';
import { cellHash, densityOf, disc, dot, ellipse, px, rect, shade, type Ctx } from './pixel';

const SOIL = '#7a5236';

/** Грядка: борозни через рядок, пагорбки між ними (як була `bedTile`). */
function furrows(g: Ctx, x: number, y: number, soil: string): void {
  rect(g, x, y, 16, 16, soil);
  for (let r = 0; r < 16; r += 8) {
    rect(g, x, y + r + 5, 16, 2, shade(soil, -0.22));
    rect(g, x, y + r + 1, 16, 1, shade(soil, 0.12));
  }
}

const hd = (g: Ctx) => densityOf(g) > 1;
const hh = (i: number, j: number, k: number) => cellHash(i, j, k + 1200);

/** Низька культура на грядці — частина землі. */
export function cropTile(g: Ctx, x: number, y: number, i: number, j: number, kind: CropKind, season: Season): void {
  if (season === 'winter') {
    // Під снігом — лише горбики грядок, а з-під снігу де-не-де стирчить бадилля.
    rect(g, x, y, 16, 16, '#e9eef6');
    for (let r = 2; r < 16; r += 8) rect(g, x, y + r + 3, 16, 1, '#cfd9e6');
    if (hh(i, j, 1) % 3 === 0) { px(g, x + 4 + (hh(i, j, 2) % 8), y + 4, '#8a7a5a'); px(g, x + 5 + (hh(i, j, 2) % 8), y + 3, '#8a7a5a'); }
    return;
  }
  furrows(g, x, y, SOIL);
  switch (kind) {
    case 'potato': potato(g, x, y, i, j, season); break;
    case 'cabbage': cabbage(g, x, y, i, j, season); break;
    case 'beet': beet(g, x, y, i, j, season); break;
    case 'onion': onion(g, x, y, i, j, season); break;
    case 'carrot': carrot(g, x, y, i, j, season); break;
    case 'pumpkin': pumpkin(g, x, y, i, j, season); break;
    case 'cucumber': cucumber(g, x, y, i, j, season); break;
    case 'strawberry': strawberry(g, x, y, i, j, season); break;
    // Високі культури стоять пропами; під ними — голі борозни.
    case 'corn': case 'tomato': break;
  }
}

/** Картопля: удо́вж борозен кущі; влітку цвіте білим і бузковим, восени бадилля жовкне, а викопані бульби лежать на землі. */
function potato(g: Ctx, x: number, y: number, i: number, j: number, s: Season): void {
  for (let r = 0; r < 16; r += 8) {
    for (let c = (j + r / 8) % 2 ? 1 : 4; c < 16; c += 6) {
      const k = hh(i * 4 + c, j * 2 + r, 3);
      if (s === 'spring') {
        rect(g, x + c, y + r + 2, 2, 2, '#6fbf4f');
        px(g, x + c, y + r + 1, '#9ad866');
        continue;
      }
      if (s === 'summer') {
        rect(g, x + c - 1, y + r, 5, 4, '#3f7f32');
        rect(g, x + c, y + r - 1, 3, 2, '#4f9e3c');
        px(g, x + c + 1, y + r - 1, '#73bd4c');
        if (k % 3 === 0) px(g, x + c + (k % 2 ? 0 : 2), y + r - 1, k % 2 ? '#f4f1ff' : '#b9a7f2');
        if (hd(g)) { dot(g, x + c - 0.5, y + r + 1.5, '#5fae48'); dot(g, x + c + 2.5, y + r + 0.5, '#2f6a2a'); }
        continue;
      }
      // Осінь: бадилля жовте й прилягло; де-не-де вже викопано.
      if (k % 4 === 0) {
        ellipse(g, x + c + 1, y + r + 3, 2, 1.2, '#d8b884');
        px(g, x + c, y + r + 3, '#b8945e');
        if (hd(g)) dot(g, x + c + 1.5, y + r + 2.5, '#efd6a8');
      } else {
        rect(g, x + c - 1, y + r + 1, 5, 3, '#a8904a');
        rect(g, x + c, y + r + 1, 3, 1, '#c9b45a');
        px(g, x + c + 3, y + r + 3, '#7a6a34');
        if (hd(g)) dot(g, x + c + 0.5, y + r + 2.5, '#8a7a3a');
      }
    }
  }
}

/** Капуста: два качани на клітинку в шаховому порядку — синьо-зелене розлоге листя й світла тугa головка. */
function cabbage(g: Ctx, x: number, y: number, i: number, j: number, s: Season): void {
  const spots: readonly (readonly [number, number])[] = (i + j) % 2 ? [[4, 4], [12, 12]] : [[12, 4], [4, 12]];
  for (const [cx, cy] of spots) {
    const k = hh(i * 2 + cx, j * 2 + cy, 5);
    const ox = x + cx + ((k % 3) - 1);
    const oy = y + cy;
    if (s === 'spring') {
      ellipse(g, ox, oy, 2.4, 1.6, '#6f9f6a');
      disc(g, ox, oy - 0.5, 1, '#9fcf86');
      continue;
    }
    const big = s === 'autumn';
    const outer = big ? '#6a8f62' : '#4f7f5a';
    // Розлоге листя — нерівна розетка з трьох листків.
    ellipse(g, ox, oy + 0.5, big ? 5 : 4.5, big ? 3.4 : 3, outer);
    ellipse(g, ox - 3, oy - 0.5, 2, 1.4, shade(outer, 0.1));
    ellipse(g, ox + 3, oy, 2, 1.4, shade(outer, 0.06));
    px(g, ox - 4, oy - 1, shade(outer, 0.25));
    px(g, ox + 4, oy - 0.5, shade(outer, 0.25));
    if (big && k % 3 === 0) px(g, ox + 3, oy + 2, '#b8a24a');
    // Головка: світла, з тінню справа знизу й відблиском зліва вгорі.
    const head = big ? '#b0d890' : '#9fcf86';
    disc(g, ox, oy - 0.5, big ? 3 : 2.6, head);
    rect(g, ox + 1, oy + 1, 2, 1, shade(head, -0.2));
    px(g, ox + 2, oy, shade(head, -0.2));
    px(g, ox - 1, oy - 2, shade(head, 0.25));
    px(g, ox, oy - 1, shade(head, -0.08));
    if (hd(g)) {
      dot(g, ox - 1.5, oy - 1.5, '#e2f4cc');
      dot(g, ox + 0.5, oy + 0.5, shade(head, -0.12));
      dot(g, ox - 3.5, oy - 0.5, shade(outer, 0.3));
      dot(g, ox + 3.5, oy + 0.5, shade(outer, -0.2));
    }
  }
}

/** Буряк: темне листя з червоними жилками; восени з землі видно червоні головки. */
function beet(g: Ctx, x: number, y: number, i: number, j: number, s: Season): void {
  for (let r = 0; r < 16; r += 8) {
    for (let c = (i + j + r / 8) % 2 ? 2 : 5; c < 16; c += 5) {
      if (s === 'spring') { px(g, x + c, y + r + 2, '#5fae48'); px(g, x + c + 1, y + r + 1, '#5fae48'); continue; }
      rect(g, x + c - 1, y + r, 2, 3, '#2f6a32');
      rect(g, x + c + 1, y + r - 1, 2, 3, '#3f7f3a');
      px(g, x + c, y + r + 1, '#b8323a');
      px(g, x + c + 1, y + r, '#b8323a');
      if (s === 'autumn') { rect(g, x + c - 1, y + r + 3, 3, 1, '#8a2a3a'); px(g, x + c, y + r + 3, '#a8384a'); }
      if (hd(g)) dot(g, x + c + 1.5, y + r - 0.5, '#d04a5a');
    }
  }
}

/** Цибуля й часник: тонкі пера рядами; восени пера жовтіють і лягають, видно цибулини. */
function onion(g: Ctx, x: number, y: number, i: number, j: number, s: Season): void {
  for (let r = 0; r < 16; r += 8) {
    for (let c = 1 + ((i + j + r / 8) % 2); c < 16; c += 3) {
      if (s === 'autumn') {
        rect(g, x + c, y + r + 2, 2, 1, '#c9b45a');
        px(g, x + c + 1, y + r + 3, '#e0b070');
        if (hd(g)) dot(g, x + c + 1.5, y + r + 2.5, '#f2d08a');
        continue;
      }
      const k = hh(i * 5 + c, j * 2 + r, 7);
      if (k % 5 === 0) continue;
      const tall = (s === 'summer' ? 3 : 1) + (k % 3 === 0 ? 1 : 0) + ((k >>> 4) % 2);
      rect(g, x + c, y + r + 4 - tall, 1, tall, (c + j) % 2 ? '#7fc46a' : '#6aa88a');
      if (s === 'summer' && k % 4 === 1) px(g, x + c + 1, y + r + 4 - tall + 1, '#7fc46a');
      if (hd(g)) dot(g, x + c + 0.5, y + r + 4 - tall, '#b6e6a0');
    }
  }
}

/** Морква: пір'ясте бадилля; восени з-під нього визирають помаранчеві плечики. */
function carrot(g: Ctx, x: number, y: number, i: number, j: number, s: Season): void {
  for (let r = 0; r < 16; r += 8) {
    for (let c = 2 + ((i + j + r / 8) % 2) * 2; c < 16; c += 4) {
      const leaf = s === 'spring' ? '#9ad866' : '#5fbf4a';
      px(g, x + c, y + r + 2, leaf);
      px(g, x + c - 1, y + r + 1, leaf);
      px(g, x + c + 1, y + r + 1, leaf);
      if (s !== 'spring') { px(g, x + c, y + r, leaf); px(g, x + c - 1, y + r - 1, shade(leaf, 0.2)); }
      if (s === 'autumn') px(g, x + c, y + r + 3, '#ef8d3a');
      if (hd(g)) { dot(g, x + c + 1.5, y + r + 0.5, shade(leaf, 0.25)); dot(g, x + c - 1.5, y + r + 1.5, shade(leaf, -0.15)); }
    }
  }
}

/** Гарбузи: велике листя й батоги; влітку жовтий цвіт і зелені зав'язі, восени — великі помаранчеві гарбузи. */
function pumpkin(g: Ctx, x: number, y: number, i: number, j: number, s: Season): void {
  const k = hh(i, j, 9);
  // Батіг через клітинку.
  for (let c = 0; c < 16; c += 2) px(g, x + c, y + 8 + Math.round(Math.sin((c + i * 16) / 4) * 2), s === 'autumn' ? '#8a7a3a' : '#4f8a32');
  if (s === 'spring') { rect(g, x + 6, y + 6, 3, 2, '#6fbf4f'); return; }
  const leaf = s === 'autumn' ? '#8f8a3e' : '#3f7f32';
  for (const [lx, ly] of [[3, 3], [11, 11], [12, 2]] as const) {
    ellipse(g, x + lx, y + ly, 3, 2.2, leaf);
    px(g, x + lx - 1, y + ly - 1, shade(leaf, 0.25));
  }
  if (s === 'summer') {
    if (k % 2 === 0) { px(g, x + 7, y + 4, '#f6d55c'); px(g, x + 8, y + 4, '#f6d55c'); px(g, x + 7, y + 5, '#e8a83a'); }
    if (k % 3 === 0) { ellipse(g, x + 5, y + 12, 2, 1.5, '#6a9a3a'); px(g, x + 4, y + 11, '#8ab84a'); }
    return;
  }
  if (k % 3 !== 2) {
    const ox = x + 4 + (k % 6);
    const oy = y + 9 + ((k >>> 3) % 3);
    ellipse(g, ox, oy, 3.6, 2.6, '#e8862a');
    rect(g, ox - 0.5, oy - 2.5, 1, 5, '#c86a1e');
    rect(g, ox - 2.5, oy - 1.5, 1, 3, '#c86a1e');
    rect(g, ox + 1.5, oy - 1.5, 1, 3, '#c86a1e');
    px(g, ox - 1, oy - 1, '#f6aa5a');
    rect(g, ox, oy - 4, 1, 2, '#6e5a2a');
    if (hd(g)) { dot(g, ox - 1.5, oy - 1.5, '#ffd08a'); dot(g, ox + 2, oy + 1, '#b85a1a'); }
  }
}

/** Огірки: низькі батоги з листям і зеленими огірочками; восени — жовті перерослі «насінники». */
function cucumber(g: Ctx, x: number, y: number, i: number, j: number, s: Season): void {
  const leaf = s === 'autumn' ? '#9a9a42' : s === 'spring' ? '#6fbf4f' : '#4a8f3a';
  for (let r = 0; r < 16; r += 8) {
    for (let c = 1 + ((i + r / 8) % 2) * 3; c < 16; c += 6) {
      rect(g, x + c, y + r + 1, 3, 2, leaf);
      px(g, x + c + 1, y + r, shade(leaf, 0.25));
      if (s === 'spring') continue;
      const k = hh(i * 4 + c, j * 2 + r, 13);
      if (k % 2 === 0) {
        const fruit = s === 'autumn' ? '#d8b84a' : '#3f7a2a';
        rect(g, x + c + 3, y + r + 3, 2, 1, fruit);
        px(g, x + c + 3, y + r + 3, shade(fruit, 0.3));
      }
      if (s === 'summer' && k % 5 === 0) px(g, x + c, y + r, '#f6d55c');
      if (hd(g)) dot(g, x + c + 0.5, y + r + 1.5, shade(leaf, -0.2));
    }
  }
}

/** Полуниці: низькі розетки; навесні й улітку з червоними ягодами, восени листя червоніє. */
function strawberry(g: Ctx, x: number, y: number, i: number, j: number, s: Season): void {
  for (let r = 0; r < 16; r += 8) {
    for (let c = 2 + ((j + r / 8) % 2) * 3; c < 16; c += 6) {
      const leaf = s === 'autumn' ? '#8a5a3a' : '#4f9e3c';
      rect(g, x + c - 1, y + r + 1, 3, 2, leaf);
      px(g, x + c, y + r, shade(leaf, 0.2));
      if (s === 'autumn' && (c + j) % 2) px(g, x + c + 1, y + r + 1, '#c2493a');
      if (s !== 'autumn' && hh(i * 4 + c, j * 2 + r, 17) % 2 === 0) {
        px(g, x + c + 2, y + r + 3, '#e83a4a');
        if (hd(g)) dot(g, x + c + 2, y + r + 3, '#ff8a8a');
      }
      if (s === 'spring' && (c + i) % 3 === 0) px(g, x + c - 1, y + r, '#f8f4ec');
    }
  }
}

/**
 * Кукурудза (проп на клітинку): два стебла, вищі за клітинку. Влітку
 * зелена з волоттям, восени суха, з качанами в обгортках; навесні —
 * паростки, узимку — стерня під снігом.
 */
export function drawCorn(g: Ctx, x: number, y: number, season: Season, seed: number): void {
  for (const [sx, k] of [[3, 0], [8, 1], [13, 2]] as const) {
    const bx = x + sx;
    const vary = (seed >>> (k * 3)) % 4;
    if (season === 'winter') {
      rect(g, bx, y + 9 + (vary % 2), 1, 4, '#a88a5a');
      px(g, bx, y + 8 + (vary % 2), '#ffffff');
      continue;
    }
    if (season === 'spring') {
      rect(g, bx, y + 8 + (vary % 2), 1, 5, '#6fbf4f');
      px(g, bx - 1, y + 9, '#9ad866');
      px(g, bx + 1, y + 10, '#9ad866');
      continue;
    }
    const dry = season === 'autumn';
    const stalk = dry ? '#c8a868' : '#5f9e3c';
    const leaf = dry ? '#b0924e' : '#4f9a3c';
    const top = y - 9 - vary;
    rect(g, bx, top, 1, y + 14 - top, stalk);
    rect(g, bx + 1, top + 8, 1, y + 14 - top - 8, shade(stalk, -0.2));
    // Широке листя врізнобіч: біля стебла — у два пікселі.
    for (const [ly, dir] of [[top + 5, k % 2 ? 1 : -1], [top + 10, k % 2 ? -1 : 1], [top + 15, k % 2 ? 1 : -1], [top + 19, k % 2 ? -1 : 1]] as const) {
      for (let s2 = 1; s2 <= 5; s2 += 1) {
        const lx = bx + (dir > 0 ? s2 : -s2 + 1) + (dir > 0 ? 0 : -1);
        const lyy = ly + Math.floor(s2 / 2);
        px(g, lx, lyy, s2 === 5 ? shade(leaf, -0.18) : leaf);
        if (s2 <= 2) px(g, lx, lyy - 1, shade(leaf, 0.18));
      }
    }
    // Волоть і качан в обгортці.
    px(g, bx, top - 1, dry ? '#a88a4a' : '#d9c06a');
    px(g, bx - 1, top, dry ? '#a88a4a' : '#d9c06a');
    px(g, bx + 1, top, dry ? '#a88a4a' : '#d9c06a');
    if (k !== 1) {
      rect(g, bx + 1, top + 12, 2, 4, dry ? '#d8c07a' : '#7ab84a');
      px(g, bx + 1, top + 11, dry ? '#e8d26a' : '#c9b44a');
    }
    if (hd(g)) {
      dot(g, bx + 0.5, top + 3, shade(stalk, 0.25));
      if (k !== 1) dot(g, bx + 1.5, top + 13, dry ? '#f0dc8a' : '#9ad866');
      dot(g, bx - 0.5, top + 6, shade(leaf, 0.25));
    }
  }
}

/**
 * Помідори на кілочках (проп на клітинку): кущ, підв'язаний до кілка,
 * з червоними й зеленими плодами; восени кущ в'яне, взимку стирчать
 * лише кілки.
 */
export function drawTomatoes(g: Ctx, x: number, y: number, season: Season, seed: number): void {
  for (const [sx, n] of [[5, 0], [12, 1]] as const) {
    const bx = x + sx;
    rect(g, bx, y - 3, 1, 16, '#8a6a44');
    px(g, bx, y - 3, '#a8845e');
    if (season === 'winter') { px(g, bx, y - 4, '#ffffff'); continue; }
    if (season === 'spring') { ellipse(g, bx, y + 10, 2.4, 1.6, '#6fbf4f'); px(g, bx - 1, y + 8, '#9ad866'); continue; }
    const leaf = season === 'autumn' ? '#7a8a3a' : '#3f7f32';
    // Кущ, підв'язаний до кілка: три округлі частини, листки стирчать.
    for (const [dx, dy, rx, ry] of [[1, 1, 2.6, 2.4], [-1, 5, 3.2, 2.8], [1, 9, 3.2, 2.6]] as const) {
      ellipse(g, bx + dx, y + dy, rx, ry, leaf);
      px(g, bx + dx - 1, y + dy - 1, shade(leaf, 0.22));
      px(g, bx + dx + 2, y + dy + 1, shade(leaf, -0.22));
    }
    px(g, bx - 4, y + 4, leaf);
    px(g, bx + 4, y + 8, leaf);
    px(g, bx + 3, y, leaf);
    rect(g, bx - 1, y + 3, 3, 1, '#c8a868');
    const fruits: readonly (readonly [number, number])[] = [[-2, 3], [2, 5], [-2, 8], [2, 10], [0, 12]];
    fruits.forEach(([fx, fy], k) => {
      if (season === 'autumn' && k > 2) return;
      const ripe = season === 'autumn' || (seed + k + n) % 3 !== 0;
      disc(g, bx + fx, y + fy, 1.3, ripe ? '#e0402e' : '#7ab84a');
      px(g, bx + fx, y + fy - 1, shade(leaf, 0.1));
      if (hd(g)) dot(g, bx + fx - 0.5, y + fy - 0.5, ripe ? '#ff9a7a' : '#b6e08a');
    });
  }
}
