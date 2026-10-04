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

export function homeInterior(state: LifeState): GameMap {
  const kind = homeKind(state);
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
  m.prop('bed', bx, by, { tint: tint('bed') ?? (kind === 'hata' ? '#e98fb0' : kind === 'dorm' ? '#8ab0d9' : '#f2a5c0') });
  m.zone('bed', Math.round(bx) + 1, Math.round(by) + 2, 2, 2, { type: 'bed' }, 'Лягти спати');
  m.prop('wardrobe', 5, 3.2);
  m.zone('wardrobe', 5, 4, 1, 2, { type: 'wardrobe' }, 'Шафа · перевдягнутись');
  m.prop('window', 9, 0.6).prop('window', 12, 0.6);

  // Де стоїть ноутбук: на купленому столі, інакше — на столі/дивані кімнати.
  let laptopAt: [number, number];
  if (kind === 'hata') {
    m.prop('stove', 13, 3.6).prop('rushnyk', 7, 0.8).prop('clock', 3, 0.5);
    m.prop('table', 9, 6, { tint: '#c49a6c' });
    laptopAt = [9, 7];
  } else if (kind === 'dorm') {
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
  if (kind !== 'hata') place('table', 'table');
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
