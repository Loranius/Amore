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
 * Хата в Жилинцях — одна суцільна споруда, кімнати впритул, стіна до стіни
 * (власник, 2026-10-06). Вхід — справа, з подвір'я, у маленьку веранду
 * (сіни); угору з неї — кухня з піччю; ліворуч — короткий коридорчик, що
 * зв'язує три кімнати: угору — братів (Діма й Саша, поки Лєна вчиться в
 * школі), ліворуч — мами, вниз — Лєни. Кімната мами — одразу за лівою
 * стіною Лєниної.
 *
 *          ┌──────┬──────┐
 *          │брати │кухня │
 *   ┌────┬─┴─┬────┼─┬────┤
 *   │мама│ коридор│ сіни ◄── вхід із двору
 *   │    ├───┴────┴─┴────┘
 *   │    │  кімната Лєни │
 *   └────┤               │
 *        └───────────────┘
 *
 * Лєнина кімната — та сама рамка 16×12, що й раніше (`ROOM_FLOOR`,
 * `DEFAULT_SPOT`), лише зсунута на (`ROOM_DX`, `ROOM_DY`), тож облаштування
 * й збереження не змінюються.
 */
const ROOM_DX = 7;
const ROOM_DY = 10;

/** Де в хаті стоїть мама — у своїй кімнаті. */
export const HATA_MOM: [number, number] = [3, 12];

function hataInterior(state: LifeState): GameMap {
  const W = 23;
  const H = 22;
  const stage = stageOfWeek(dayInfo(state.day).week).stage;
  const brothersHome = stage === 'sadok' || stage === 'school';
  const m = new MapBuilder(`home:hata:${brothersHome ? 'b' : ''}:${Object.values(state.decor).join(',')}:${JSON.stringify(state.layout)}:${state.owned.includes('laptop') ? 'pc' : ''}`, null, state.homeName, W, H, 'x', true);
  // Кімната: задня стіна (W) над підлогою (f). Задня стіна нижньої кімнати —
  // це й перегородка з верхньою, тож кімнати стоять впритул.
  const room = (x0: number, x1: number, wallTop: number, floorTop: number, floorBottom: number) => {
    m.fill(x0, wallTop, x1 - x0 + 1, floorTop - wallTop, 'W');
    m.fill(x0, floorTop, x1 - x0 + 1, floorBottom - floorTop + 1, 'f');
  };
  const door = (x: number, y: number, w = 1, h = 1) => m.fill(x, y, w, h, 'f');
  room(8, 13, 0, 2, 5); // брати — угору з коридору
  room(15, 21, 0, 2, 5); // кухня з піччю — угору з веранди
  room(1, 6, 6, 8, 17); // мама — ліворуч від коридору й Лєниної кімнати
  room(8, 13, 6, 8, 9); // коридорчик
  room(15, 20, 6, 8, 9); // веранда (сіни) — сюди заходиш із двору
  room(ROOM_DX + 1, ROOM_DX + 14, ROOM_DY, ROOM_DY + 3, ROOM_DY + 10); // Лєна — вниз із коридору
  // Двері — проходи в стінах.
  door(14, 8, 1, 2); // веранда ↔ коридор
  door(17, 6, 1, 2); // веранда ↔ кухня
  door(10, 6, 1, 2); // коридор ↔ брати
  door(7, 8, 1, 2); // коридор ↔ мама
  door(11, 10, 1, 3); // коридор ↔ Лєна
  // Вихід у двір — у правій стіні веранди.
  door(21, 8, 2, 2);
  m.zone('exit', 20, 8, 3, 2, { type: 'exit' }, 'Вийти на подвір\'я');
  m.spawn('door', 19, 9).spawn('default', 19, 9).spawn('wake', 4 + ROOM_DX, 7 + ROOM_DY);

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
  m.prop('window', 9 + ROOM_DX, 0.6 + ROOM_DY).prop('window', 12 + ROOM_DX, 0.6 + ROOM_DY).prop('rushnyk', 2 + ROOM_DX, 0.8 + ROOM_DY);
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
  m.prop('window', 11.6, 0.4);
  if (brothersHome) {
    m.prop('bed', 8.1, 2.2, { tint: '#6f9ad8' }).prop('bed', 12.9, 2.2, { tint: '#7fb86a' }).prop('poster', 9.4, 0.5, { tint: '#3a6fd8' });
    m.prop('rug', 9.6, 3.6, { tint: '#8a9ab8' });
    m.zone('brothers', 9, 5, 3, 1, { type: 'info', text: 'Кімната братів: тут живуть Діма й Саша. Скрізь їхні машинки, м\'яч під ліжком.' }, 'Кімната братів');
  } else {
    m.prop('bed', 12.9, 2.2, { tint: '#9a9aa8' }).prop('shelf', 8.2, 2.1);
    m.zone('brothers', 9, 5, 3, 1, { type: 'info', text: 'Кімната братів: Діма й Саша вже роз\'їхались, а їхні медалі за футбол досі на полиці.' }, 'Кімната братів');
  }
  // ── Мама ─────────────────────────────────────────────────
  m.prop('bed', 1.1, 8.3, { tint: '#9ab8d9' }).prop('wardrobe', 3.2, 8.1).prop('window', 5, 6.4).prop('rushnyk', 2.4, 6.6).prop('clock', 4.2, 6.5);
  m.prop('rug', 3, 12, { tint: '#c98aa8' }).prop('plant', 1, 16.6);
  // ── Коридорчик і веранда ─────────────────────────────────
  m.prop('rug', 10.4, 8.6, { tint: '#b85a4a' }).prop('plant', 16.1, 8);
  // ── Кухня з піччю ────────────────────────────────────────
  m.prop('stove', 15.1, 2.2).prop('table', 18, 3.6, { tint: '#c49a6c' }).prop('fridge', 20.8, 2.4).prop('window', 18, 0.4).prop('rushnyk', 20, 0.6);
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
