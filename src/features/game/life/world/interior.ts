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
 * Хата в Жилинцях — за ескізом, який власник сам пересунув і зберіг
 * (2026-10-05, «План хати Лєни»). У клітинках ескізу:
 *
 *   мама   x2–7,  y2–10   — над кімнатою Лєни, у лівому верхньому куті
 *   брати  x7–12, y2–6    — праворуч від мами, угорі
 *   коридор x7–12, y6–10  — посередині, зв'язує маму, братів і Лєну
 *   веранда x12–17, y6–10 — праворуч від коридору; вхід у правій стіні
 *   кімната над верандою x12–17, y2–6 (поки — кухня з піччю)
 *   Лєна   x2–12, y10–15  — унизу
 *
 * Межі ескізу переведено в клітинки гри (x: 2→0, 7→7, 12→15, 17→23;
 * y: 2→0, 6→6, 10→12, 15→23), тож пропорції й сусідство ті самі, а
 * кімната Лєни — рівно та рамка 16×12, що й раніше (`ROOM_FLOOR`,
 * `DEFAULT_SPOT`): облаштування й збереження не змінюються.
 */
const ROOM_DX = 0;
const ROOM_DY = 12;

/** Де в хаті стоїть мама — у своїй кімнаті. */
export const HATA_MOM: [number, number] = [4, 7];

function hataInterior(state: LifeState): GameMap {
  const W = 24;
  const H = 24;
  const stage = stageOfWeek(dayInfo(state.day).week).stage;
  const brothersHome = stage === 'sadok' || stage === 'school';
  const m = new MapBuilder(`home:hata:${brothersHome ? 'b' : ''}:${Object.values(state.decor).join(',')}:${JSON.stringify(state.layout)}:${state.owned.includes('laptop') ? 'pc' : ''}`, null, state.homeName, W, H, 'x', true);
  // Кімната — прямокутник ескізу [x0, x1) × [y0, y1): ліва колонка — стіна з
  // сусідом, угорі — задня стіна (W), решта — підлога. Задня стіна нижньої
  // кімнати — це й перегородка з верхньою, тож кімнати стоять впритул.
  const room = (x0: number, x1: number, y0: number, y1: number, wallRows = 2) => {
    m.fill(x0 + 1, y0, x1 - x0 - 1, wallRows, 'W');
    m.fill(x0 + 1, y0 + wallRows, x1 - x0 - 1, y1 - y0 - wallRows, 'f');
  };
  const door = (x: number, y: number, w = 1, h = 1) => m.fill(x, y, w, h, 'f');
  room(0, 7, 0, 12); // мама
  room(7, 15, 0, 6); // брати
  room(15, 23, 0, 6); // кімната над верандою — кухня з піччю
  room(7, 15, 6, 12); // коридорчик
  room(15, 23, 6, 12); // веранда
  room(0, 15, 12, 23, 3); // Лєна
  // Двері — там, де вони на ескізі.
  door(7, 8, 1, 2); // мама ↔ коридор
  door(11, 6, 1, 2); // брати ↔ коридор
  door(13, 12, 1, 3); // коридор ↔ Лєна
  door(15, 8, 1, 2); // коридор ↔ веранда
  door(20, 6, 1, 2); // веранда ↔ кімната над нею
  // Вихід у двір — у правій стіні веранди.
  door(23, 8, 1, 2);
  m.zone('exit', 22, 8, 2, 2, { type: 'exit' }, 'Вийти на подвір\'я');
  m.spawn('door', 21, 9).spawn('default', 21, 9).spawn('wake', 4 + ROOM_DX, 7 + ROOM_DY);

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
  // Задня стіна Лєниної кімнати — спільна з коридорчиком і кімнатою мами,
  // тож вікон на ній немає: годинник, сімейне фото, рушник.
  m.prop('clock', 8 + ROOM_DX, 0.7 + ROOM_DY).prop('photo', 11 + ROOM_DX, 0.6 + ROOM_DY).prop('rushnyk', 2 + ROOM_DX, 0.8 + ROOM_DY);
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
  m.prop('window', 13, 0.4);
  if (brothersHome) {
    m.prop('bed', 8.1, 2.2, { tint: '#6f9ad8' }).prop('bed', 13.9, 2.2, { tint: '#7fb86a' }).prop('poster', 9.6, 0.5, { tint: '#3a6fd8' });
    m.prop('rug', 10.4, 3.4, { tint: '#8a9ab8' });
    m.zone('brothers', 10, 5, 3, 1, { type: 'info', text: 'Кімната братів: тут живуть Діма й Саша. Скрізь їхні машинки, м\'яч під ліжком.' }, 'Кімната братів');
  } else {
    m.prop('bed', 13.9, 2.2, { tint: '#9a9aa8' }).prop('shelf', 8.2, 2.1);
    m.zone('brothers', 10, 5, 3, 1, { type: 'info', text: 'Кімната братів: Діма й Саша вже роз\'їхались, а їхні медалі за футбол досі на полиці.' }, 'Кімната братів');
  }
  // ── Мама ─────────────────────────────────────────────────
  m.prop('bed', 1.1, 2.3, { tint: '#9ab8d9' }).prop('wardrobe', 3.2, 2.1).prop('window', 5, 0.4).prop('rushnyk', 2.4, 0.6).prop('clock', 4.2, 0.5);
  m.prop('rug', 3, 6, { tint: '#c98aa8' }).prop('plant', 1, 10.6);
  // ── Коридорчик і веранда ─────────────────────────────────
  m.prop('rug', 10.4, 9.2, { tint: '#b85a4a' }).prop('shelf', 12, 8.1).prop('plant', 22, 10.6);
  // ── Кімната над верандою: кухня з піччю ──────────────────
  m.prop('stove', 16.1, 2.2).prop('table', 18, 3.6, { tint: '#c49a6c' }).prop('fridge', 22, 2.4).prop('window', 18, 0.4).prop('rushnyk', 21, 0.6);
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
