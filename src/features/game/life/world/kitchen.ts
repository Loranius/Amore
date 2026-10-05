// ============================================================
// Літня кухня Лєни зсередини — за планом, який власник сам намалював і
// зберіг (2026-10-05, «План літньої кухні»). У клітинках плану:
//
//   прибудова (сіни)  x2–5,  y6–10  — вхід згори; ящики з фруктами й
//                                      овочами в кутку (x2–4, y9)
//   кухня             x5–14, y4–10  — двері з сіней (x5, y8)
//     газова плита    x5,    y4–6   — лівий верхній кут
//     стіл            x9–12, y4     — біля задньої стіни, 4 стільці
//     велика глиняна піч x8–12, y7–10 — унизу посередині
//     холодильник     x13,   y7–9
//     вікно           x14,   y6–8   — у правій стіні
//
// Клітинка плану — півтори клітинки гри (x → 1 + 1.5·(x − 2),
// y → 2 + 1.5·(y − 4)): у грі кухня стає 12×9 клітинок підлоги, а над
// кожною кімнатою — її задня стіна. Вікно з правої стіни перенесено на
// задню, біля правого кута: бічних стін у ракурсі «три чверті» не видно.
// ============================================================
import { MapBuilder } from './build';
import type { GameMap } from './types';

export const KITCHEN_ID = 'zhylyntsi:kitchen';

/** Де мама порається в кухні (клітинки): плита, стіл, піч. */
export const KITCHEN_MOM_SPOTS: readonly [number, number][] = [[8, 4.8], [12.5, 6.2], [14.6, 4.9], [10, 7.2]];

let cached: GameMap | null = null;

export function summerKitchenMap(): GameMap {
  if (cached) return cached;
  const W = 20;
  const H = 12;
  const m = new MapBuilder(KITCHEN_ID, null, 'Літня кухня', W, H, 'x', true);
  const room = (x0: number, x1: number, wallTop: number, floorTop: number, floorBottom: number) => {
    m.fill(x0, wallTop, x1 - x0 + 1, floorTop - wallTop, 'W');
    m.fill(x0, floorTop, x1 - x0 + 1, floorBottom - floorTop + 1, 'f');
  };
  room(7, 18, 0, 2, 10); // кухня
  room(1, 5, 3, 5, 10); // прибудова — сіни
  m.fill(6, 8, 1, 2, 'f'); // сіни ↔ кухня
  // Вхід — у задній (верхній) стіні сіней, як на плані.
  m.fill(3, 3, 2, 2, 'f');
  m.prop('door', 3.5, 3.1, { solid: false });
  m.zone('exit', 3, 3, 2, 2, { type: 'exit' }, 'Вийти на подвір\'я');
  m.spawn('door', 4, 6).spawn('default', 4, 6);

  // Сіни: ящики з фруктами й городиною в кутку.
  m.prop('crates', 1.2, 9.2).prop('rushnyk', 2, 3.6);
  // Кухня.
  m.prop('stove', 7.1, 2.2);
  m.prop('table', 11.6, 2.5, { tint: '#c49a6c' }).prop('table', 13.4, 2.5, { tint: '#c49a6c' });
  m.prop('chair', 10.2, 2.4).prop('chair', 16.3, 2.4).prop('chair', 12.2, 3.9).prop('chair', 14.6, 3.9);
  m.prop('clayOven', 10.6, 7.6);
  m.prop('fridge', 17.9, 6.6);
  m.prop('window', 16.6, 0.4).prop('window', 9, 0.4).prop('clock', 13.2, 0.5);
  m.prop('plant', 18, 2.2);
  m.zone('cook', 11, 6, 4, 1, { type: 'activity', id: 'summerKitchen' }, 'Готувати з мамою');
  cached = m.build();
  return cached;
}
