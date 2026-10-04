// ============================================================
// Дім Лєни зсередини (ADR-0239): хата в Жилинцях із піччю й рушником,
// гуртожиток ВТЕІ, орендовані квартири. Усе куплене в «Дім і затишок»
// стоїть на своєму місці — кімната росте разом із життям.
// ============================================================
import { itemById } from '../sim/content';
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
  const m = new MapBuilder(`home:${kind}:${Object.values(state.decor).join(',')}`, null, state.homeName, W, H, kind === 'dorm' ? 't' : 'f', true);
  m.fill(0, 0, W, 3, 'W');
  m.fill(0, 0, 1, H, 'x').fill(W - 1, 0, 1, H, 'x').fill(0, H - 1, W, 1, 'x');
  m.fill(7, H - 1, 2, 1, kind === 'dorm' ? 't' : 'f');
  m.zone('exit', 7, H - 2, 2, 2, { type: 'exit' }, 'Вийти надвір');
  m.spawn('door', 8, H - 2).spawn('default', 8, H - 2).spawn('wake', 4, 7);

  const tint = (slot: keyof LifeState['decor']) => {
    const id = state.decor[slot];
    return id ? itemById(id).tint : undefined;
  };

  // Ліжко — завжди; куплене велике ліжко — своїм кольором.
  m.prop('bed', 2, 3, { tint: tint('bed') ?? (kind === 'hata' ? '#e98fb0' : kind === 'dorm' ? '#8ab0d9' : '#f2a5c0') });
  m.zone('bed', 3, 5, 2, 2, { type: 'bed' }, 'Лягти спати');
  m.prop('wardrobe', 5, 3.2);
  m.zone('wardrobe', 5, 4, 1, 2, { type: 'wardrobe' }, 'Шафа · перевдягнутись');
  m.prop('window', 9, 0.6).prop('window', 12, 0.6);

  if (kind === 'hata') {
    m.prop('stove', 13, 3.6).prop('rushnyk', 7, 0.8).prop('clock', 3, 0.5);
    m.prop('table', 9, 6, { tint: '#c49a6c' });
  } else if (kind === 'dorm') {
    m.prop('bed', 13, 3, { tint: '#c4a0b8' }).prop('desk', 8, 3.6).prop('poster', 4, 0.6, { tint: '#b8323a' });
  } else {
    m.prop('sofa', 9, 3.6).prop('fridge', 14, 3.8).prop('clock', 6, 0.5);
  }

  if (state.decor.rug) m.prop('rug', 6, 7, { tint: tint('rug') });
  if (state.decor.plant) m.prop('plant', 1, 8, { tint: tint('plant') });
  if (state.decor.lamp) m.prop('floorLamp', 14, 8, { tint: tint('lamp') });
  if (state.decor.poster) m.prop('poster', 7, 0.6, { tint: tint('poster') });
  if (state.decor.shelf) m.prop('shelf', 11, 3.6, { tint: tint('shelf') });
  if (state.decor.tv) m.prop('tv', 12, 7, { tint: tint('tv') });
  if (state.decor.table && kind !== 'hata') m.prop('table', 2, 8, { tint: tint('table') });
  if (state.decor.pet) m.prop('pet', 9, 8.6, { tint: tint('pet'), solid: false });
  return m.build();
}
