// ============================================================
// Дім Лєни зсередини (ADR-0239): хата в Жилинцях із піччю й рушником,
// гуртожиток ВДПУ, орендовані квартири. Усе куплене в «Дім і затишок»
// стоїть на своєму місці — кімната росте разом із життям.
// ============================================================
import { itemById, type DecorSlot } from '../sim/content';
import { spotOf } from '../sim/economy';
import type { LifeState } from '../sim/life';
import { MapBuilder } from './build';
import type { GameMap } from './types';

export type HomeKind = 'hata' | 'dorm' | 'flat';

export function homeKind(state: LifeState): HomeKind {
  if (state.home === 'zhylyntsi') return 'hata';
  if (state.homeName.includes('Гуртожиток')) return 'dorm';
  return 'flat';
}

/**
 * Хата в Жилинцях — за планом власника (2026-10-06), не одна кімната.
 *
 *   ┌──────┐┌─────┐┌──────────────┐
 *   │ліве  ││над  ││  Лєнина      │   праворуч — найбільша кімната,
 *   │крило ││кори-││  кімната     │   саме в неї стають усі покупки
 *   │(зала)││дором│└────┬─────────┘
 *   │      │└──┬──┘     │
 *   │      ├ коридор ─ сіни → вихід у двір
 *   └──┬───┘   │
 *   ┌──┴───────┴──────┐
 *   │піч  кухня       │                нижня кімната з піччю
 *   └─────────────────┘
 *
 * Лєнина кімната — та сама рамка 16×12, що й раніше (`ROOM_FLOOR`,
 * `DEFAULT_SPOT`), лише зсунута на `ROOM_DX` праворуч, тож облаштування й
 * збереження не змінюються.
 */
const ROOM_DX = 15;

function hataInterior(state: LifeState): GameMap {
  const W = 31;
  const H = 23;
  const m = new MapBuilder(`home:hata:${Object.values(state.decor).join(',')}:${JSON.stringify(state.layout)}:${state.owned.includes('laptop') ? 'pc' : ''}`, null, state.homeName, W, H, 'x', true);
  // Кімната: задня стіна (W) над підлогою (f), решта — товщина стін (x).
  const room = (x0: number, x1: number, wallTop: number, floorTop: number, floorBottom: number) => {
    m.fill(x0, wallTop, x1 - x0 + 1, floorTop - wallTop, 'W');
    m.fill(x0, floorTop, x1 - x0 + 1, floorBottom - floorTop + 1, 'f');
  };
  const door = (x: number, y: number, w = 1, h = 1) => m.fill(x, y, w, h, 'f');
  room(16, 29, 0, 3, 10); // праворуч: Лєнина кімната (висока)
  room(8, 13, 2, 4, 9); // над коридором
  room(1, 6, 3, 5, 14); // ліве довге крило — зала
  room(8, 14, 10, 12, 14); // коридор
  room(16, 25, 11, 12, 14); // сіни (вхід)
  room(1, 14, 15, 17, 21); // нижня: кухня з піччю
  // Двері між кімнатами — проходи в стінах.
  door(10, 10, 1, 2); // над коридором ↔ коридор
  door(7, 13); // зала ↔ коридор
  door(15, 13); // коридор ↔ сіни
  door(22, 11); // Лєнина ↔ сіни
  door(11, 15, 1, 2); // коридор ↔ кухня
  door(3, 15, 1, 2); // зала ↔ кухня
  // Вихід у двір — праворуч у сінях.
  door(26, 12, 1, 3);
  m.zone('exit', 25, 12, 2, 3, { type: 'exit' }, 'Вийти на подвір\'я');
  m.prop('door', 26, 11.2);
  m.spawn('door', 24, 13).spawn('default', 24, 13).spawn('wake', 4 + ROOM_DX, 7);

  const tint = (slot: keyof LifeState['decor']) => {
    const id = state.decor[slot];
    return id ? itemById(id).tint : undefined;
  };
  const at = (slot: DecorSlot): [number, number] => {
    const [x, y] = spotOf(state, slot);
    return [x + ROOM_DX, y];
  };

  // ── Лєнина кімната ───────────────────────────────────────
  const [bx, by] = at('bed');
  m.prop('bed', bx, by, { tint: tint('bed') ?? '#e98fb0' });
  m.zone('bed', Math.round(bx) + 1, Math.round(by) + 2, 2, 2, { type: 'bed' }, 'Лягти спати');
  m.prop('wardrobe', 5 + ROOM_DX, 3.2);
  m.zone('wardrobe', 5 + ROOM_DX, 4, 1, 2, { type: 'wardrobe' }, 'Шафа · перевдягнутись');
  m.prop('window', 9 + ROOM_DX, 0.6).prop('window', 12 + ROOM_DX, 0.6).prop('rushnyk', 7 + ROOM_DX, 0.8);
  m.prop('table', 9 + ROOM_DX, 6, { tint: '#c49a6c' });
  let laptopAt: [number, number] = [9 + ROOM_DX, 7];
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
    const [x, y] = at('desk');
    laptopAt = [Math.round(x), Math.round(y) + 1];
  }
  if (state.owned.includes('laptop')) m.zone('laptop', laptopAt[0], laptopAt[1], 2, 1, { type: 'laptop' }, 'Ноутбук · робота й справи');
  m.zone('decorate', 17, 9, 2, 1, { type: 'decorate' }, 'Облаштувати кімнату');

  // ── Над коридором: кімната мами ──────────────────────────
  m.prop('bed', 12, 4.2, { tint: '#9ab8d9' }).prop('window', 9, 2.4).prop('rug', 9, 7, { tint: '#c98aa8' });
  // ── Зала: диван, полиця, рушник, квіти ───────────────────
  m.prop('sofa', 2, 5.4, { tint: '#8a6aa8' }).prop('shelf', 5, 5.2).prop('rushnyk', 3, 3.6).prop('plant', 1, 12.6).prop('clock', 5, 3.5);
  // ── Коридор і сіни ───────────────────────────────────────
  m.prop('rug', 9, 12.6, { tint: '#b85a4a' }).prop('plant', 24, 12);
  // ── Кухня з піччю: піч у лівому верхньому куті, як на плані ──
  m.prop('stove', 1, 17.6).prop('table', 7, 18.6, { tint: '#c49a6c' }).prop('fridge', 13, 17.8).prop('window', 5, 15.6).prop('rushnyk', 9, 15.8);
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
