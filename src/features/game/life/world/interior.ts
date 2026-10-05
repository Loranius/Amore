// ============================================================
// Дім Лєни зсередини (ADR-0239): хата в Жилинцях із піччю й рушником,
// гуртожиток ВДПУ, орендовані квартири. Усе куплене в «Дім і затишок»
// стоїть на своєму місці — кімната росте разом із життям.
// ============================================================
import { itemById, type DecorSlot } from '../sim/content';
import { spotOf } from '../sim/economy';
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
 * Хата в Жилинцях — одна суцільна споруда, а всередині кімнати так, як
 * описав власник (2026-10-06): заходиш — маленькі сіни; угору з них —
 * кухня з піччю; ліворуч — коридор. З коридору три шляхи: угору —
 * маленька кімната братів (Діма й Саша, поки Лєна вчиться в школі),
 * ліворуч — кімната мами, вниз — кімната Лєни.
 *
 *              ┌────────┐       ┌──────────┐
 *              │ брати  │       │  кухня   │
 *   ┌───────┐  └───┬────┘       │  з піччю │
 *   │ мама  │      │            └────┬─────┘
 *   │       ├── коридор ───────┬─ сіни ┐
 *   └───────┘ └───┬────────────┘└──┬───┘
 *          ┌──────┴─────────┐      вихід у двір
 *          │  кімната Лєни  │
 *          └────────────────┘
 *
 * Лєнина кімната — та сама рамка 16×12, що й раніше (`ROOM_FLOOR`,
 * `DEFAULT_SPOT`), лише зсунута на (`ROOM_DX`, `ROOM_DY`), тож облаштування
 * й збереження не змінюються.
 */
const ROOM_DX = 7;
const ROOM_DY = 14;

/** Де в хаті стоїть мама — у своїй кімнаті. */
export const HATA_MOM: [number, number] = [4, 9];

function hataInterior(state: LifeState): GameMap {
  const W = 33;
  const H = 26;
  const brothersHome = stageOfWeek(dayInfo(state.day).week).stage !== 'uni' && stageOfWeek(dayInfo(state.day).week).stage !== 'adult';
  const m = new MapBuilder(`home:hata:${brothersHome ? 'b' : ''}:${Object.values(state.decor).join(',')}:${JSON.stringify(state.layout)}:${state.owned.includes('laptop') ? 'pc' : ''}`, null, state.homeName, W, H, 'x', true);
  // Кімната: задня стіна (W) над підлогою (f), решта — товщина стін (x).
  const room = (x0: number, x1: number, wallTop: number, floorTop: number, floorBottom: number) => {
    m.fill(x0, wallTop, x1 - x0 + 1, floorTop - wallTop, 'W');
    m.fill(x0, floorTop, x1 - x0 + 1, floorBottom - floorTop + 1, 'f');
  };
  const door = (x: number, y: number, w = 1, h = 1) => m.fill(x, y, w, h, 'f');
  room(23, 31, 0, 2, 7); // кухня з піччю — угору із сіней
  room(11, 16, 0, 2, 6); // брати — угору з коридору
  room(1, 7, 3, 5, 12); // мама — ліворуч від коридору
  room(9, 21, 8, 10, 12); // коридор
  room(23, 27, 8, 10, 13); // сіни — сюди заходиш із двору
  room(ROOM_DX + 1, ROOM_DX + 14, ROOM_DY, ROOM_DY + 3, ROOM_DY + 10); // Лєна — вниз із коридору
  // Двері — проходи в стінах.
  door(25, 8, 1, 2); // сіни ↔ кухня
  door(22, 11, 1, 2); // сіни ↔ коридор
  door(13, 7, 1, 3); // коридор ↔ брати
  door(8, 11, 1, 2); // коридор ↔ мама
  door(15, 13, 1, 4); // коридор ↔ Лєна
  // Вихід у двір — унизу сіней.
  door(24, 14, 2, 1);
  m.zone('exit', 24, 13, 2, 2, { type: 'exit' }, 'Вийти на подвір\'я');
  m.spawn('door', 25, 12).spawn('default', 25, 12).spawn('wake', 4 + ROOM_DX, 7 + ROOM_DY);

  const tint = (slot: keyof LifeState['decor']) => {
    const id = state.decor[slot];
    return id ? itemById(id).tint : undefined;
  };
  const at = (slot: DecorSlot): [number, number] => {
    const [x, y] = spotOf(state, slot);
    return [x + ROOM_DX, y + ROOM_DY];
  };

  // ── Кімната Лєни ─────────────────────────────────────────
  const [bx, by] = at('bed');
  m.prop('bed', bx, by, { tint: tint('bed') ?? '#e98fb0' });
  m.zone('bed', Math.round(bx) + 1, Math.round(by) + 2, 2, 2, { type: 'bed' }, 'Лягти спати');
  m.prop('wardrobe', 5 + ROOM_DX, 3.2 + ROOM_DY);
  m.zone('wardrobe', 5 + ROOM_DX, 4 + ROOM_DY, 1, 2, { type: 'wardrobe' }, 'Шафа · перевдягнутись');
  m.prop('window', 9 + ROOM_DX, 0.6 + ROOM_DY).prop('window', 12 + ROOM_DX, 0.6 + ROOM_DY).prop('rushnyk', 3 + ROOM_DX, 0.8 + ROOM_DY);
  m.prop('table', 9 + ROOM_DX, 6 + ROOM_DY, { tint: '#c49a6c' });
  let laptopAt: [number, number] = [9 + ROOM_DX, 7 + ROOM_DY];
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
  m.zone('decorate', 2 + ROOM_DX, 9 + ROOM_DY, 2, 1, { type: 'decorate' }, 'Облаштувати кімнату');

  // ── Брати: Діма й Саша — поки Лєна в садочку й школі ──────
  m.prop('window', 13.5, 0.4);
  if (brothersHome) {
    m.prop('bed', 11.1, 2.3, { tint: '#6f9ad8' }).prop('bed', 15.9, 2.3, { tint: '#7fb86a' }).prop('poster', 12.6, 0.5, { tint: '#3a6fd8' });
    m.prop('rug', 12.6, 4.6, { tint: '#8a9ab8' });
    m.zone('brothers', 12, 5, 3, 1, { type: 'info', text: 'Кімната братів: тут живуть Діма й Саша. Скрізь їхні машинки, м\'яч під ліжком.' }, 'Кімната братів');
  } else {
    m.prop('bed', 15.9, 2.3, { tint: '#9a9aa8' }).prop('shelf', 11.2, 2.2);
    m.zone('brothers', 12, 5, 3, 1, { type: 'info', text: 'Кімната братів: Діма й Саша вже роз\'їхались, а їхні медалі за футбол досі на полиці.' }, 'Кімната братів');
  }
  // ── Мама ─────────────────────────────────────────────────
  m.prop('bed', 1.2, 5.3, { tint: '#9ab8d9' }).prop('window', 3.5, 3.4).prop('rushnyk', 5.5, 3.6).prop('wardrobe', 6.2, 5.2).prop('clock', 2, 3.5);
  m.prop('rug', 3.5, 9, { tint: '#c98aa8' }).prop('plant', 1, 11.6);
  // ── Коридор і сіни ───────────────────────────────────────
  m.prop('rug', 16.5, 10.6, { tint: '#b85a4a' }).prop('shelf', 19.5, 10.1).prop('plant', 26.6, 10.2);
  // ── Кухня з піччю ────────────────────────────────────────
  m.prop('stove', 23.1, 2.2).prop('table', 27, 3.6, { tint: '#c49a6c' }).prop('fridge', 30.8, 2.4).prop('window', 27, 0.4).prop('rushnyk', 29.2, 0.6);
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
