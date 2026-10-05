// ============================================================
// Оточення діорами на всі 360° (ADR-0224).
// ------------------------------------------------------------
// Власник, знімки з телефона на найдальшому зумі: «фонові структури лише з
// одного боку, треба щоб вони були на 360 градусів». Раніше тло кожного
// виду стояло купкою позаду острова (−z), і варто було повернути острів —
// за ним була порожнеча, а пласкі силуети грота читались дошками.
//
// Тепер оточення — кільце навколо острова, повні тривимірні тіла:
//   * кристал — давній храм у підземеллі: колонада з арками, зламані
//     колони, уламки, що тонуть у повітрі (без стін печери, ADR-0224);
//   * дерево — небо: хмари, море хмар унизу, летючі острівці з деревцями;
//   * риф — глибина: скелі-стовпи з арками, ліс водоростей, дно внизу.
//
// ОДНЕ ПРАВИЛО ГЕОМЕТРІЇ: нічого не стоїть між камерою й островом. Камера
// відходить на `SURROUND_CLEAR` (×5 від кадру, ADR-0193) під кутом ~10°
// згори, тож усе ближче за цей радіус живе лише ВНИЗУ, нижче лінії погляду
// (`SURROUND_BELOW`). Тест тримає це правило для всіх трьох видів.
//
// Модуль чистий: лише масиви, без three. Одиниці — сцени, земля на y = 0.
// Усе — з хешу дати початку; від подій пари не залежить.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';
import { Painter, box, chunk, leaf, polar, type IslandMesh, type Paint, type V3 } from '../crystal3d/v2/crystalIsland';

/**
 * Радіус, ближче за який оточення не підіймається вище `SURROUND_BELOW`.
 * Найдальша камера — 45 одиниць (кадр 9 × ручний зум 5), плюс запас.
 */
export const SURROUND_CLEAR = 52;
/** Висота, нижче якої дозволено все ближче за `SURROUND_CLEAR`. */
export const SURROUND_BELOW = -9;

const TAU = Math.PI * 2;

/**
 * Жмуток листя для далини: кілька листків плюща замість повної купи. Купа
 * (`ivy`) — це 10–16 листків, і на відстані в сотню одиниць вона коштувала
 * б тисячі трикутників, яких ніхто не розгледить.
 */
function clump(p: Painter, seed: string, key: string, c: V3, size: number, n = 4) {
  for (let k = 0; k < n; k += 1) {
    const a = (k / n) * TAU + unit(seed, `${key}:${k}:a`);
    leaf(p, seed, `${key}:${k}`, [c[0] + Math.cos(a) * size * 0.35, c[1] + (unit(seed, `${key}:${k}:y`) - 0.5) * size * 0.4, c[2] + Math.sin(a) * size * 0.35], size * 0.55);
  }
}

/** Восьмигранна призма від `a` до `b` (вертикальна), радіуси r0 → r1. */
function prism(p: Painter, a: V3, b: V3, r0: number, r1: number, paint: Paint, tone: number, sides = 8, turn = 0, caps = true) {
  const ring = (c: V3, r: number) => Array.from({ length: sides }, (_, i): V3 => {
    const t = turn + (i / sides) * TAU;
    return [c[0] + Math.cos(t) * r, c[1], c[2] + Math.sin(t) * r];
  });
  p.band(ring(a, r0), ring(b, r1), paint, (i) => tone * (0.86 + 0.08 * (i % 3)), caps, caps);
}

// ── Кристал: давній храм у підземеллі ─────────────────────
/** Фарба кристала: 2 — камінь храму (плющ бере свою). */
/** Глибина, з якої ростуть колони: далеко в серпанку. */
export const TEMPLE_DEPTH = -190;
const STONE = 2 as Paint;

/** Колона ордера: плінт, фуст, капітель. `broken` — фуст обламаний. */
function column(p: Painter, seed: string, key: string, base: V3, top: number, r: number, broken: boolean) {
  const plinth = base[1] + r * 0.9;
  box(p, [base[0], base[1], base[2]], [base[0], plinth, base[2]], r * 2.8, r * 2.8, STONE, 0.9);
  // Злам — на висоті острова або вище, а не в безодні, де його не видно.
  const end = broken ? -8 + (top + 8) * (0.2 + 0.5 * unit(seed, `${key}:break`)) : top;
  // Фуст — з барабанів: ледь різний тон, як кладка. Колони йдуть глибоко
  // вниз, тож барабани довгі: інакше самі фусти коштували б 12 тисяч граней.
  const drums = Math.max(2, Math.round((end - plinth) / (r * 10)));
  for (let d = 0; d < drums; d += 1) {
    const y0 = plinth + ((end - plinth) * d) / drums;
    const y1 = plinth + ((end - plinth) * (d + 1)) / drums;
    prism(p, [base[0], y0, base[2]], [base[0], y1, base[2]], r * (1 - 0.04 * (d / drums)), r * (1 - 0.04 * ((d + 1) / drums)), STONE, 0.92 + 0.12 * unit(seed, `${key}:d${d}`), 8, 0, d === drums - 1);
  }
  if (broken) {
    // Злам: косий уламок зверху.
    chunk(p, seed, `${key}:jag`, [base[0], end + r * 0.3, base[2]], r * 1.05, STONE, 0, 0.7);
    return end;
  }
  box(p, [base[0], top, base[2]], [base[0], top + r * 0.7, base[2]], r * 2.5, r * 2.5, STONE, 1.02);
  box(p, [base[0], top + r * 0.7, base[2]], [base[0], top + r * 1.2, base[2]], r * 3, r * 3, STONE, 1.06);
  return top + r * 1.2;
}

/** Арка між двома точками: півколо клинчастих каменів у вертикальній площині. */
function arch(p: Painter, seed: string, key: string, a: V3, b: V3, thick: number, keep = 1) {
  const c: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const half = Math.hypot(b[0] - a[0], b[2] - a[2]) / 2;
  const dir: V3 = [(b[0] - a[0]) / (2 * half), 0, (b[2] - a[2]) / (2 * half)];
  const segs = 9;
  const last = Math.max(1, Math.round(segs * keep));
  const at = (t: number): V3 => [c[0] - dir[0] * Math.cos(t) * half, c[1] + Math.sin(t) * half * 0.8, c[2] - dir[2] * Math.cos(t) * half];
  for (let s = 0; s < last; s += 1) {
    box(p, at((s / segs) * Math.PI), at(((s + 1) / segs) * Math.PI), thick, thick * 1.2, STONE, 0.9 + 0.14 * unit(seed, `${key}:v${s}`));
  }
}

export function buildCrystalSurround(seed: string): IslandMesh {
  const p = new Painter();
  // Колонада: два кільця, внутрішнє нижче й ближче, зовнішнє — аркада.
  // Колони йдуть глибоко вниз і тонуть у серпанку: дна в храму немає, і
  // власник попросив, щоб колони його ховали, а не стояли на порожнечі.
  const rings = [
    { n: 16, r: 84, top: 30, rad: 2.2, arches: 0.55, broken: 0.35 },
    { n: 22, r: 122, top: 52, rad: 3.2, arches: 0.8, broken: 0.2 },
  ];
  rings.forEach((ring, ri) => {
    const turn = unit(seed, `temple${ri}:turn`) * TAU;
    const tops: { at: V3; top: number; whole: boolean }[] = [];
    for (let k = 0; k < ring.n; k += 1) {
      const key = `temple${ri}:col${k}`;
      const a = turn + (k / ring.n) * TAU + (unit(seed, `${key}:a`) - 0.5) * 0.04;
      const base = polar(ring.r, a, TEMPLE_DEPTH);
      const broken = unit(seed, `${key}:broken`) < ring.broken;
      const top = column(p, seed, key, base, ring.top + 6 * (unit(seed, `${key}:h`) - 0.5), ring.rad, broken);
      tops.push({ at: [base[0], top, base[2]], top, whole: !broken });
      // Плющ звисає з капітелі цілих колон.
      if (!broken && unit(seed, `${key}:ivy`) < 0.6) {
        for (let d = 0; d < 5; d += 1) clump(p, seed, `${key}:ivy${d}`, [base[0] + ring.rad * 1.3, top - d * ring.rad * 1.4, base[2]], ring.rad * (1.6 - d * 0.15));
      }
    }
    for (let k = 0; k < ring.n; k += 1) {
      const a = tops[k]!;
      const b = tops[(k + 1) % ring.n]!;
      if (unit(seed, `temple${ri}:arch${k}`) > ring.arches) continue;
      const y = Math.min(a.top, b.top);
      // Над зламаною колоною лишається половина арки.
      const keep = a.whole && b.whole ? 1 : 0.45;
      arch(p, seed, `temple${ri}:arch${k}`, [a.at[0], y, a.at[2]], [b.at[0], y, b.at[2]], ring.rad * 1.2, keep);
    }
  });

  // Стіни печери й сталактитів більше немає: власник попросив лишити самі
  // структури храму — колони, арки й уламки, що тонуть у повітрі.
  // Унизу, під островом, пливуть уламки храму: барабани й капітелі.
  for (let k = 0; k < 10; k += 1) {
    const a = unit(seed, `drum${k}:a`) * TAU;
    const r = 14 + 34 * unit(seed, `drum${k}:r`);
    const y = SURROUND_BELOW - 4 - 22 * unit(seed, `drum${k}:y`);
    const w = 0.5 + 0.8 * unit(seed, `drum${k}:w`);
    const tilt = unit(seed, `drum${k}:t`) * TAU;
    const c = polar(r, a, y);
    const d: V3 = [Math.cos(tilt) * w * 1.6, Math.sin(tilt) * w * 1.2, Math.sin(tilt) * w * 0.8];
    if (k % 3 === 0) chunk(p, seed, `drum${k}`, c, w * 1.2, STONE);
    else box(p, [c[0] - d[0], c[1] - d[1], c[2] - d[2]], [c[0] + d[0], c[1] + d[1], c[2] + d[2]], w * 2, w * 2, STONE, 0.9);
  }
  return p.build();
}

// ── Дерево: небо з хмарами й острівцями ───────────────────
const T_GRASS = 0 as Paint;
const T_ROCK = 1 as Paint;
const T_LEAF = 3 as Paint;
const T_WOOD = 5 as Paint;
const T_CLOUD = 6 as Paint;
const T_FAR = 7 as Paint;

/** Пухка хмара з кавалків; наполовину світиться сама, щоб не сіріла. */
export function cloudPuff(p: Painter, seed: string, key: string, c: V3, size: number, flat = 0.6) {
  const n = 3 + Math.floor(unit(seed, `${key}:n`) * 4);
  for (let k = 0; k < n; k += 1) {
    const t = n === 1 ? 0 : k / (n - 1) - 0.5;
    const s = size * (0.55 + 0.45 * Math.cos(t * Math.PI) + 0.2 * unit(seed, `${key}:${k}:s`));
    chunk(p, seed, `${key}:${k}`, [c[0] + t * size * 2.6, c[1] + s * 0.15, c[2] + (unit(seed, `${key}:${k}:z`) - 0.5) * size * 0.8], s, T_CLOUD, 0.55, flat);
  }
}

/** Летючий острівець: трав'яна шапка, скеля конусом, часом деревце. */
export function floatingIslet(p: Painter, seed: string, key: string, c: V3, size: number, rock: Paint = T_FAR) {
  const n = 7;
  const turn = unit(seed, `${key}:turn`) * Math.PI;
  const top = Array.from({ length: n }, (_, i): V3 => {
    const a = turn + (i / n) * TAU;
    const r = size * (0.85 + 0.3 * unit(seed, `${key}:r${i}`));
    return [c[0] + Math.cos(a) * r, c[1], c[2] + Math.sin(a) * r];
  });
  const cap: V3 = [c[0], c[1] + size * 0.15, c[2]];
  for (let i = 0; i < n; i += 1) p.tri(top[i]!, cap, top[(i + 1) % n]!, T_GRASS, 0.9 + 0.15 * unit(seed, `${key}:g${i}`));
  const tip: V3 = [c[0], c[1] - size * (0.9 + 0.5 * unit(seed, `${key}:tip`)), c[2]];
  for (let i = 0; i < n; i += 1) p.tri(top[(i + 1) % n]!, top[i]!, tip, rock, 0.8 + 0.3 * unit(seed, `${key}:c${i}`));
  if (unit(seed, `${key}:tree`) < 0.6 && size > 1.5) {
    const trunkTop: V3 = [c[0], c[1] + size * 0.9, c[2]];
    box(p, [c[0], c[1], c[2]], trunkTop, size * 0.12, size * 0.12, T_WOOD, 1);
    for (let k = 0; k < 4; k += 1) {
      const a = (k / 4) * TAU + turn;
      chunk(p, seed, `${key}:crown${k}`, [trunkTop[0] + Math.cos(a) * size * 0.3, trunkTop[1] + size * 0.1 * k, trunkTop[2] + Math.sin(a) * size * 0.3], size * 0.38, T_LEAF);
    }
  }
}

export function buildTreeSurround(seed: string): IslandMesh {
  const p = new Painter();
  // Хмари кільцем на різних висотах.
  for (let k = 0; k < 34; k += 1) {
    const key = `sky:cloud${k}`;
    const a = (k / 34) * TAU + unit(seed, `${key}:a`) * 0.3;
    // Хмара розкидана вшир на ~1.3 свого розміру: відступ, щоб її край не
    // зайшов у коло, де ходить камера.
    const r = 82 + 60 * unit(seed, `${key}:r`);
    cloudPuff(p, seed, key, polar(r, a, -18 + 55 * unit(seed, `${key}:y`)), 4 + 6 * unit(seed, `${key}:s`));
  }
  // Море хмар унизу — видно, коли відвести камеру.
  for (let k = 0; k < 44; k += 1) {
    const key = `sky:sea${k}`;
    const a = unit(seed, `${key}:a`) * TAU;
    const r = 14 + 130 * Math.sqrt(unit(seed, `${key}:r`));
    cloudPuff(p, seed, key, polar(r, a, -36 - 8 * unit(seed, `${key}:y`)), 3 + 4 * unit(seed, `${key}:s`), 0.4);
  }
  // Летючі острівці: далекі — великі, з деревцями; ближчі — лише внизу.
  for (let k = 0; k < 16; k += 1) {
    const key = `sky:islet${k}`;
    const a = (k / 16) * TAU + unit(seed, `${key}:a`) * 0.3;
    const r = 80 + 50 * unit(seed, `${key}:r`);
    floatingIslet(p, seed, key, polar(r, a, -12 + 34 * unit(seed, `${key}:y`)), 3 + 6 * unit(seed, `${key}:s`), k % 3 === 0 ? T_ROCK : T_FAR);
  }
  // Ближніх дрібних острівців під островом більше немає: згори вони лягали
  // поруч з островом зеленими латками й читались сміттям (власник, як і
  // брили печери в кристала). Небо — хмари й далекі острівці.
  return p.build();
}

// ── Риф: скелі, водорості, дно ────────────────────────────
const R_ROCK = 1 as Paint;
const R_BOULDER = 2 as Paint;
const R_ALGAE = 3 as Paint;
const R_ORANGE = 5 as Paint;
const R_PINK = 6 as Paint;
const R_FAR = 7 as Paint;
/** Дев'ятий слот палітри рифу — пісок дна (`REEF_ISLAND_PAINTS`). */
const R_SAND = 8 as Paint;
/** Висота піщаного дна під рифом. */
export const REEF_FLOOR = -48;
/** Радіус чистого піску під рифом: камера ходить до 45 одиниць від осі. */
export const REEF_FLOOR_CLEAR = 60;

/** Скеля-стовп: стос кавалків, що звужується догори, з шапкою водоростей. */
function rockPillar(p: Painter, seed: string, key: string, base: V3, top: number, w: number) {
  let y = base[1];
  let s = 0;
  while (y < top) {
    const size = w * (1 - 0.35 * ((y - base[1]) / Math.max(1, top - base[1])));
    chunk(p, seed, `${key}:${s}`, [base[0] + (unit(seed, `${key}:${s}:dx`) - 0.5) * w * 0.5, y, base[2] + (unit(seed, `${key}:${s}:dz`) - 0.5) * w * 0.5], size, s % 4 === 3 ? R_BOULDER : R_FAR);
    y += size * 1.6;
    s += 1;
  }
  clump(p, seed, `${key}:cap`, [base[0], y, base[2]], w * 1.2, 5);
  // Корали на верхівці скелі — яскраві плями в глибині.
  if (unit(seed, `${key}:coral`) < 0.7) {
    chunk(p, seed, `${key}:coralA`, [base[0] + w * 0.4, y + w * 0.2, base[2]], w * 0.45, R_ORANGE, 0, 0.8);
    chunk(p, seed, `${key}:coralB`, [base[0] - w * 0.4, y + w * 0.1, base[2] + w * 0.3], w * 0.35, R_PINK, 0, 0.9);
  }
  return y;
}

/** Стрічка водорості: зигзаг вузьких коробок угору, листя по боках. */
function kelp(p: Painter, seed: string, key: string, base: V3, height: number, w: number) {
  const segs = Math.max(3, Math.round(height / (w * 10)));
  let prev = base;
  for (let s = 1; s <= segs; s += 1) {
    const sway = Math.sin(s * 0.9 + unit(seed, `${key}:ph`) * TAU) * w * 1.5;
    const next: V3 = [base[0] + sway, base[1] + (height * s) / segs, base[2] + sway * 0.5];
    box(p, prev, next, w, w * 0.4, R_ALGAE, 0.85 + 0.2 * unit(seed, `${key}:${s}`));
    if (s % 2 === 0) clump(p, seed, `${key}:leaf${s}`, next, w * 3, 2);
    prev = next;
  }
}

/**
 * @param calm спокійне тло для вулкана (ADR-0235): стовпи нижчі за лінію
 *   острова, водорості коротші. Стовп із квіткою за конусом тягнув увагу з
 *   героя — у референсі власника тло порожнє.
 */
export function buildReefSurround(seed: string, calm = false): IslandMesh {
  const p = new Painter();
  const lower = calm ? 26 : 0;
  const kelpScale = calm ? 0.45 : 1;
  // Скелі-стовпи кільцем. Арки між ними в стандартному кадрі лягали
  // якраз під шапку головної — тож стовпи стоять самі й нижчі за неї.
  const N = 26;
  const turn = unit(seed, 'deep:turn') * TAU;
  // Вулкан (calm) — без стовпів: їхні верхівки з коралами читались
  // другорядними героями обабіч (власник, 2026-10-06).
  for (let k = 0; k < (calm ? 0 : N); k += 1) {
    const key = `deep:pillar${k}`;
    const a = turn + (k / N) * TAU + (unit(seed, `${key}:a`) - 0.5) * 0.15;
    const r = 88 + 45 * unit(seed, `${key}:r`);
    const w = 1.6 + 1.6 * unit(seed, `${key}:w`);
    rockPillar(p, seed, key, polar(r, a, -52), -14 - lower + 26 * unit(seed, `${key}:h`), w);
  }
  // Ліс водоростей між стовпами.
  for (let k = 0; k < 20; k += 1) {
    const key = `deep:kelp${k}`;
    const a = unit(seed, `${key}:a`) * TAU;
    const r = 72 + 40 * unit(seed, `${key}:r`);
    kelp(p, seed, key, polar(r, a, -55), (35 + 40 * unit(seed, `${key}:h`)) * kelpScale, 0.5 + 0.5 * unit(seed, `${key}:w`));
  }
  // Піщане дно далеко внизу (власник: «пісчане дно, яке видніється
  // далеко»): диск із пологими дюнами під усім рифом, край тоне в товщі.
  const RINGS = 10;
  const SEGS = 36;
  const dune = (r: number, a: number) => REEF_FLOOR + 2.2 * Math.sin(a * 5 + r * 0.08) * Math.sin(r * 0.11 + unit(seed, 'deep:dune') * 6) + 1.2 * (unit(seed, `deep:sand${Math.round(r)}:${Math.round(a * 10)}`) - 0.5);
  const sandRing = (i: number) => Array.from({ length: SEGS }, (_, j): V3 => {
    const r = (i / RINGS) * 190;
    const a = ((j + (i % 2) * 0.5) / SEGS) * TAU;
    return polar(r, a, i === 0 ? REEF_FLOOR : dune(r, a));
  });
  const sand = Array.from({ length: RINGS + 1 }, (_, i) => sandRing(i));
  for (let i = 0; i < RINGS; i += 1) {
    for (let j = 0; j < SEGS; j += 1) {
      const k = (j + 1) % SEGS;
      const t = 0.9 + 0.2 * unit(seed, `deep:sandt${i}:${j}`);
      p.tri(sand[i]![j]!, sand[i + 1]![k]!, sand[i + 1]![j]!, R_SAND, t);
      if (i > 0) p.tri(sand[i]![j]!, sand[i]![k]!, sand[i + 1]![k]!, R_SAND, t * 0.96);
    }
  }
  // На піску — брили, корали й зірки, але лише ДАЛІ за коло, де ходить
  // камера: згори брили під самою камерою лягали на кадр плямами (власник).
  // Під островом і камерою — чистий пісок.
  for (let k = 0; k < 34; k += 1) {
    const key = `deep:floor${k}`;
    const a = unit(seed, `${key}:a`) * TAU;
    const r = REEF_FLOOR_CLEAR + (180 - REEF_FLOOR_CLEAR) * Math.sqrt(unit(seed, `${key}:r`));
    const c = polar(r, a, REEF_FLOOR + 1 - 2 * unit(seed, `${key}:y`));
    // Дрібні: згори ближні брили дна лягали на кадр важкими плямами.
    const size = 1.8 + 2.4 * unit(seed, `${key}:s`);
    chunk(p, seed, key, c, size, k % 3 === 0 ? R_BOULDER : R_ROCK, 0, 0.6);
    if (unit(seed, `${key}:coral`) < 0.4) chunk(p, seed, `${key}:coral`, [c[0], c[1] + size * 0.8, c[2]], size * 0.4, k % 2 === 0 ? R_ORANGE : R_PINK, 0, 0.8);
  }
  return p.build();
}
