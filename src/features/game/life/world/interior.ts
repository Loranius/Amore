// ============================================================
// Дім Лєни зсередини (ADR-0239): хата в Жилинцях із піччю й рушником,
// гуртожиток ВДПУ, орендовані квартири. Усе куплене в «Дім і затишок»
// стоїть на своєму місці — кімната росте разом із життям.
// ============================================================
import { itemById, type DecorSlot } from '../sim/content';
import { ROOM_FLOOR, spotOf } from '../sim/economy';
import type { LifeState } from '../sim/life';
import { dayInfo, stageOfWeek } from '../sim/calendar';
import { MapBuilder } from './build';
import type { GameMap } from './types';

export type HomeKind = 'hata' | 'dorm' | 'flat';

export function homeKind(state: LifeState): HomeKind {
  if (state.home === 'zhylyntsi') return 'hata';
  if (state.homeName.includes('Гуртожиток')) return 'dorm';
  return 'flat';
}

/**
 * Хата в Жилинцях — розміри кімнат, які власник сам підігнав і зберіг
 * (2026-10-05, «Розміри кімнат хати»), уже в клітинках гри. Кімната —
 * прямокутник [x, x + w) × [y, y + h): ліва колонка — стіна з сусідом,
 * верхні `wall` рядів — задня стіна, решта — підлога.
 *
 *   мама    5×10 — над кімнатою Лєни, у лівому верхньому куті
 *   брати   7×5  — праворуч від мами, угорі
 *   коридор 7×5  — посередині, зв'язує маму, братів і Лєну
 *   над верандою (кухня) 6×5, веранда 6×5 — праворуч; вхід у правій стіні
 *   Лєна   12×7  — унизу, задня стіна 3 ряди: підлоги 11×4; праворуч
 *                 від ліжка — шафа, внизу посередині — стіл
 */
export const HATA_ROOMS = {
  mom: { x: 0, y: 0, w: 5, h: 10, wall: 2 },
  bro: { x: 5, y: 0, w: 7, h: 5, wall: 2 },
  up: { x: 12, y: 0, w: 6, h: 5, wall: 2 },
  hall: { x: 5, y: 5, w: 7, h: 5, wall: 2 },
  ver: { x: 12, y: 5, w: 6, h: 5, wall: 2 },
  lena: { x: 0, y: 10, w: 12, h: 7, wall: 3 },
} as const;

/** Прорізи дверей (клітинки підлоги в стіні) — там, де вони на плані. */
export const HATA_DOORS = {
  momHall: { x: 5, y: 7, w: 1, h: 2 },
  broHall: { x: 8, y: 5, w: 1, h: 2 },
  hallLena: { x: 8, y: 10, w: 1, h: 3 },
  hallVer: { x: 12, y: 7, w: 1, h: 2 },
  verUp: { x: 17, y: 5, w: 1, h: 2 },
  entry: { x: 18, y: 7, w: 1, h: 2 },
} as const;

/** Мамине ліжко (клітинки) — там вона відпочиває й спить (`sim/mom.ts`). */
export const HATA_MOM_BED = { x: 1.1, y: 2.3, tint: '#9ab8d9' } as const;

/**
 * Облаштування кімнати Лєни зберігається в рамці 16×12 (`ROOM_FLOOR`,
 * `DEFAULT_SPOT`) — спільній із гуртожитком і квартирами. У хаті її
 * підлога 11×3, тож місце з рамки стискається в цю підлогу: порядок
 * речей зліва направо той самий, сейв не міняється (`hataSpots`).
 */
function hataSpots(state: LifeState): Partial<Record<DecorSlot, [number, number]>> {
  const r = HATA_ROOMS.lena;
  const t = (slot: DecorSlot) => (spotOf(state, slot)[0] - ROOM_FLOOR.x0) / (ROOM_FLOOR.x1 - ROOM_FLOOR.x0);
  const floorY = r.y + r.wall;
  const out: Partial<Record<DecorSlot, [number, number]>> = {};
  // Ліжко (2.2 клітинки завдовжки) — біля лівої стіни, на всю глибину.
  out.bed = [Math.round((1 + t('bed') * 0.8) * 10) / 10, floorY];
  // Постер — на задній стіні; килим і улюбленець не заважають ходити.
  out.poster = [Math.round((1 + t('poster') * 6) * 10) / 10, r.y + 0.6];
  out.rug = [Math.round((3.4 + t('rug') * 3) * 10) / 10, floorY + 0.8];
  out.pet = [Math.round((3.6 + t('pet') * 4) * 10) / 10, floorY + 1.6];
  // Решта — у порядку з рамки, впритул одна до одної: уздовж задньої стіни
  // (ліворуч від дверей, за шафою, і праворуч від дверей), що не влізло —
  // другим рядом. Колонка дверей і передній ряд перед столом — прохід.
  const door = HATA_DOORS.hallLena.x;
  const lanes: [number, number, number][] = [];
  for (const y of [floorY, floorY + 1.2]) lanes.push([HATA_WARDROBE.x + 1.5, door - 0.1, y], [door + 1.1, r.x + r.w - 0.1, y]);
  let lane = 0;
  let cursor = lanes[0]![0];
  const solid = (['plant', 'lamp', 'shelf', 'tv', 'desk', 'sofa'] as const).filter((slot) => state.decor[slot]).sort((a, b) => t(a) - t(b));
  for (const slot of solid) {
    const span = HATA_SPAN[slot];
    while (cursor + span > lanes[lane]![1] && lane + 1 < lanes.length) { lane += 1; cursor = lanes[lane]![0]; }
    const [, end, y] = lanes[lane]!;
    out[slot] = [Math.round(Math.min(cursor, end - span) * 10) / 10, y];
    cursor += span + 0.1;
  }
  return out;
}

/** Шафа Лєни — праворуч від ліжка; стіл — унизу посередині (власник, 2026-10-05). */
const HATA_WARDROBE = { x: 2.9 } as const;
const HATA_TABLE_CX = 6.5;

/** Ширина речі в кімнаті (клітинки, з масштабом меблів 1.25). */
const HATA_SPAN = { plant: 1, lamp: 1, shelf: 1.25, tv: 1.25, desk: 1.9, sofa: 2.4 } as const;

function hataInterior(state: LifeState): GameMap {
  const W = 19;
  const H = 18;
  const stage = stageOfWeek(dayInfo(state.day).week).stage;
  const brothersHome = stage === 'sadok' || stage === 'school';
  const m = new MapBuilder(`home:hata:${brothersHome ? 'b' : ''}:${Object.values(state.decor).join(',')}:${JSON.stringify(state.layout)}:${state.owned.includes('laptop') ? 'pc' : ''}`, null, state.homeName, W, H, 'x', true);
  for (const r of Object.values(HATA_ROOMS)) {
    m.fill(r.x + 1, r.y, r.w - 1, r.wall, 'W');
    m.fill(r.x + 1, r.y + r.wall, r.w - 1, r.h - r.wall, 'f');
  }
  for (const d of Object.values(HATA_DOORS)) m.fill(d.x, d.y, d.w, d.h, 'f');
  const e = HATA_DOORS.entry;
  m.zone('exit', e.x - 1, e.y, 2, 2, { type: 'exit' }, 'Вийти на подвір\'я');
  const L = HATA_ROOMS.lena;
  m.spawn('door', e.x - 2, e.y + 1).spawn('default', e.x - 2, e.y + 1).spawn('wake', 4, L.y + L.h - 2);

  const tint = (slot: keyof LifeState['decor']) => {
    const id = state.decor[slot];
    return id ? itemById(id).tint : undefined;
  };
  const spots = hataSpots(state);
  const at = (slot: DecorSlot): [number, number] => spots[slot]!;

  // ── Кімната Лєни ─────────────────────────────────────────
  const [bx, by] = at('bed');
  m.prop('bed', bx, by, { tint: tint('bed') ?? '#e98fb0' });
  m.zone('bed', 1, L.y + L.h - 1, 2, 1, { type: 'bed' }, 'Лягти спати');
  m.prop('wardrobe', HATA_WARDROBE.x, L.y + 2.1);
  m.zone('wardrobe', 3, L.y + L.wall + 1, 2, 1, { type: 'wardrobe' }, 'Шафа · перевдягнутись');
  // Задня стіна Лєниної кімнати — спільна з коридорчиком і кімнатою мами,
  // тож вікон на ній немає: годинник, сімейне фото, рушник.
  m.prop('clock', 6.4, L.y + 0.7).prop('photo', 10.2, L.y + 0.6).prop('rushnyk', 4.8, L.y + 0.8);
  m.prop('table', HATA_TABLE_CX - 0.95, L.y + L.h - 1.1, { tint: '#c49a6c' });
  let laptopAt: [number, number] = [6, L.y + L.h - 2];
  const place = (slot: DecorSlot, prop: Parameters<MapBuilder['prop']>[0], extra: { solid?: boolean } = {}) => {
    if (!state.decor[slot]) return;
    const [x, y] = at(slot);
    m.prop(prop, x, y, { tint: tint(slot), ...extra });
  };
  place('rug', 'rug');
  place('plant', 'plant');
  place('lamp', 'floorLamp');
  place('poster', 'poster');
  place('shelf', 'shelf');
  place('tv', 'tv');
  place('desk', 'desk');
  place('sofa', 'sofa');
  place('pet', 'pet', { solid: false });
  if (state.decor.desk) {
    const [x] = at('desk');
    laptopAt = [Math.round(x), L.y + L.h - 2];
  }
  if (state.owned.includes('laptop')) m.zone('laptop', laptopAt[0], laptopAt[1], 2, 1, { type: 'laptop' }, 'Ноутбук · робота й справи');
  m.zone('decorate', 9, L.y + L.h - 2, 2, 1, { type: 'decorate' }, 'Облаштувати кімнату');

  // ── Брати: Діма й Саша — поки Лєна в садочку й школі ──────
  m.prop('window', 9.6, 0.4);
  if (brothersHome) {
    m.prop('bed', 6.1, 2.1, { tint: '#6f9ad8' }).prop('bed', 10.3, 2.1, { tint: '#7fb86a' }).prop('poster', 7.4, 0.5, { tint: '#3a6fd8' });
    m.zone('brothers', 7, 4, 3, 1, { type: 'info', text: 'Кімната братів: тут живуть Діма й Саша. Скрізь їхні машинки, м\'яч під ліжком.' }, 'Кімната братів');
  } else {
    m.prop('bed', 10.3, 2.1, { tint: '#9a9aa8' }).prop('shelf', 6.2, 2.1);
    m.zone('brothers', 7, 4, 3, 1, { type: 'info', text: 'Кімната братів: Діма й Саша вже роз\'їхались, а їхні медалі за футбол досі на полиці.' }, 'Кімната братів');
  }
  // ── Мама ─────────────────────────────────────────────────
  m.prop('bed', HATA_MOM_BED.x, HATA_MOM_BED.y, { tint: HATA_MOM_BED.tint }).prop('wardrobe', 3.2, 2.1).prop('window', 2.6, 0.4).prop('rushnyk', 1.3, 0.6);
  m.prop('rug', 2, 6, { tint: '#c98aa8' }).prop('plant', 1, 8.6);
  // ── Коридорчик і веранда ─────────────────────────────────
  m.prop('rug', 8, 8.2, { tint: '#b85a4a' }).prop('shelf', 9.8, 7).prop('clock', 7, 5.5).prop('plant', 13.1, 9);
  // ── Кімната над верандою: кухня з піччю ──────────────────
  m.prop('stove', 13.1, 2.1).prop('table', 14.7, 3.1, { tint: '#c49a6c' }).prop('fridge', 16.6, 2.2).prop('window', 15.2, 0.4).prop('rushnyk', 13.6, 0.6);
  return m.build();
}

export function homeInterior(state: LifeState): GameMap {
  const kind = homeKind(state);
  if (kind === 'hata') return hataInterior(state);
  const W = 16;
  const H = 12;
  const m = new MapBuilder(`home:${kind}:${Object.values(state.decor).join(',')}:${JSON.stringify(state.layout)}:${state.owned.includes('laptop') ? 'pc' : ''}`, null, state.homeName, W, H, kind === 'dorm' ? 't' : 'f', true);
  m.fill(0, 0, W, 3, 'W');
  m.fill(0, 0, 1, H, 'x').fill(W - 1, 0, 1, H, 'x').fill(0, H - 1, W, 1, 'x');
  m.fill(7, H - 1, 2, 1, kind === 'dorm' ? 't' : 'f');
  m.zone('exit', 7, H - 2, 2, 2, { type: 'exit' }, 'Вийти надвір');
  m.spawn('door', 8, H - 2).spawn('default', 8, H - 2).spawn('wake', 4, 7);

  const tint = (slot: keyof LifeState['decor']) => {
    const id = state.decor[slot];
    return id ? itemById(id).tint : undefined;
  };

  // Ліжко — завжди; куплене велике ліжко — своїм кольором. Меблі стоять там,
  // куди їх поставила Лєна (`layout`), інакше — на типовому місці.
  const [bx, by] = spotOf(state, 'bed');
  m.prop('bed', bx, by, { tint: tint('bed') ?? (kind === 'dorm' ? '#8ab0d9' : '#f2a5c0') });
  m.zone('bed', Math.round(bx) + 1, Math.round(by) + 2, 2, 2, { type: 'bed' }, 'Лягти спати');
  m.prop('wardrobe', 5, 3.2);
  m.zone('wardrobe', 5, 4, 1, 2, { type: 'wardrobe' }, 'Шафа · перевдягнутись');
  m.prop('window', 9, 0.6).prop('window', 12, 0.6);

  // Де стоїть ноутбук: на купленому столі, інакше — на столі/дивані кімнати.
  let laptopAt: [number, number];
  if (kind === 'dorm') {
    m.prop('bed', 13, 3, { tint: '#c4a0b8' }).prop('desk', 8, 3.6).prop('poster', 4, 0.6, { tint: '#b8323a' });
    laptopAt = [8, 5];
  } else {
    if (!state.decor.sofa) m.prop('sofa', 9, 3.6);
    m.prop('fridge', 14, 3.8).prop('clock', 6, 0.5);
    laptopAt = [10, 5];
  }

  const place = (slot: DecorSlot, prop: Parameters<MapBuilder['prop']>[0], extra: { solid?: boolean } = {}) => {
    if (!state.decor[slot]) return;
    const [x, y] = spotOf(state, slot);
    m.prop(prop, x, y, { tint: tint(slot), ...extra });
  };
  place('rug', 'rug');
  place('plant', 'plant');
  place('lamp', 'floorLamp');
  place('poster', 'poster');
  place('shelf', 'shelf');
  place('tv', 'tv');
  place('table', 'table');
  place('desk', 'desk');
  place('sofa', 'sofa');
  place('pet', 'pet', { solid: false });
  if (state.decor.desk) {
    const [x, y] = spotOf(state, 'desk');
    laptopAt = [Math.round(x), Math.round(y) + 1];
  }
  if (state.owned.includes('laptop')) m.zone('laptop', laptopAt[0], laptopAt[1], 2, 1, { type: 'laptop' }, 'Ноутбук · робота й справи');
  m.zone('decorate', 1, H - 2, 2, 1, { type: 'decorate' }, 'Облаштувати кімнату');
  return m.build();
}
