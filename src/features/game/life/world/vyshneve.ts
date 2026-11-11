// ============================================================
// Вишневе — місто Діми (ADR-0239, власник 2026-11-03: «додати гру за
// Діму»). План — з Godot-порту гри (`game-1/tools/build_vyshneve.py`), тут
// стиснутий до клітинок цієї гри й намальований її будинками:
//   північний бік вулиці — магазин, пошта, три різні п'ятиповерхівки (у
//   першій живе Діма, п'ятий поверх) і поліклініка;
//   площа з кіоском навпроти, стадіон із біговою доріжкою під нею;
//   дев'ятиповерхівки з гаражами за проїздом;
//   котлован «річка Вонючка», луг із майданчиком, садочок «Чебурашка» і
//   школа.
// Квартира Діми — коридор, кухня, ванна, лоджія, кімната з балконом;
// хто з родини вдома, залежить від години й дня (`familyAt`).
// ============================================================
import { DAY_START_MIN, type DayInfo } from '../sim/calendar';
import { DIMA_LAST_GRADE, today, type LifeState } from '../sim/life';
import { MapBuilder } from './build';
import type { GameMap } from './types';

const info = (text: string) => ({ type: 'info', text }) as const;

/** Двері під'їзду Діми (клітинка під п'ятиповерхівкою). */
export const DIMA_DOOR = { x: 16, y: 8 } as const;

export function vyshnevePlan(): GameMap {
  const m = new MapBuilder('vyshneve', 'vyshneve', 'м. Вишневе', 50, 42);
  m.folk = 6;
  // Вулиця: тротуари з обох боків, асфальт із розміткою посередині.
  m.fill(0, 8, 50, 2, 'p').fill(0, 10, 50, 3, 'a').fill(0, 11, 50, 1, 'm').fill(0, 13, 50, 1, 'p');
  m.fill(20, 11, 2, 1, 'z');

  // Північний бік: магазин, пошта, три різні п'ятиповерхівки, поліклініка.
  m.building({ id: 'grocery', x: 1, y: 4, w: 5, h: 4, style: 'shop', label: 'Продукти', sign: 'bread', doorX: 3, action: { type: 'shop', shop: 'grocery' } });
  m.building({ id: 'post', x: 7, y: 4, w: 5, h: 4, style: 'post', label: 'Пошта', sign: 'letter', doorX: 9, action: info('Пошта. Велика будівля, у черзі можна простояти півдня.') });
  m.building({ id: 'home', x: 13, y: 2, w: 7, h: 6, style: 'block', label: 'Наш під\'їзд', wall: '#d8cfc0', doorX: DIMA_DOOR.x, action: { type: 'home' }, zoneLabel: 'Наш під\'їзд · додому' });
  m.building({ id: 'house2', x: 21, y: 2, w: 7, h: 6, style: 'block', label: 'П\'ятиповерхівка', wall: '#b8704e', doorX: 24, action: info('Сусідня п\'ятиповерхівка. Тут живуть інші люди.') });
  m.building({ id: 'house3', x: 29, y: 2, w: 7, h: 6, style: 'block', label: 'П\'ятиповерхівка', wall: '#e3c978', doorX: 32, action: info('Сусідня п\'ятиповерхівка. Тут живуть інші люди.') });
  m.building({ id: 'clinic', x: 37, y: 3, w: 8, h: 5, style: 'office', label: 'Поліклініка', wall: '#e8eef2', roof: '#5a8fb5', doorX: 41, action: info('Поліклініка. Сюди мама водить на щеплення.') });
  m.prop('busStop', 47, 13.6, { solid: false });
  m.zone('busStop', 46, 13, 3, 1, info('Зупинка. Маршрутка до Києва ходить, коли хоче.'), 'Зупинка');
  for (const x of [4, 12, 28, 36, 46]) m.prop('lamp', x, 9.6, { solid: false });
  for (const x of [0, 6, 12, 20, 28, 36, 45, 49]) m.tree(x, 1, 'poplar');
  m.prop('bush', 0.6, 7.4).prop('bush', 20.4, 7.4).prop('bush', 36.4, 7.4).prop('flowerBed', 46, 6.5);
  m.spawn('home', DIMA_DOOR.x, 9).spawn('default', DIMA_DOOR.x, 9);

  // Площа навпроти: плитка, кіоск, лави, клумби.
  m.fill(1, 14, 15, 7, 'p');
  m.building({ id: 'kiosk', x: 12, y: 15, w: 3, h: 3, style: 'kiosk', label: 'Кіоск', sign: 'star', doorX: 13, action: info('Кіоск: газети, жуйки й морозиво «Лакомка».') });
  m.prop('bench', 3, 17).prop('bench', 8, 17).prop('flowerBed', 2, 19.5).prop('flowerBed', 6, 19.5).prop('flowerBed', 10, 19.5);
  m.prop('statue', 5.5, 15.4);
  m.zone('square', 3, 18, 6, 1, info('Площа. На День міста тут концерти.'), 'Площа');

  // Стадіон: бігова доріжка навколо поля, лави вболівальників згори.
  m.fill(1, 22, 15, 10, 'd').fill(3, 24, 11, 6, 'g');
  m.prop('goal', 3.6, 26.5).prop('goal', 13.4, 26.5).prop('bench', 4, 21.3).prop('bench', 8, 21.3).prop('bench', 12, 21.3);
  m.zone('stadium', 6, 26, 5, 2, info('Стадіон. Тут ганяють м\'яч старші хлопці.'), 'Великий стадіон');

  // Проїзд у двір дев'ятиповерхівок; вони навпроти дому Діми, за ними гаражі.
  m.fill(17, 14, 2, 26, 'a').fill(19, 25, 31, 2, 'a').fill(19, 24, 31, 1, 'p');
  m.building({ id: 'nine1', x: 20, y: 15, w: 8, h: 9, style: 'block', label: 'Дев\'ятиповерхівка', wall: '#c9cdd2', doorX: 24, action: info('Дев\'ятиповерхівка. Тут живуть інші люди.') });
  m.building({ id: 'nine2', x: 30, y: 15, w: 8, h: 9, style: 'block', label: 'Дев\'ятиповерхівка', wall: '#d8d2c6', doorX: 34, action: info('Дев\'ятиповерхівка. Тут живуть інші люди.') });
  m.building({ id: 'garages', x: 40, y: 18, w: 8, h: 3, style: 'shed', label: 'Гаражі', door: false });
  m.prop('car', 23, 25.6, { tint: '#c2494f' }).prop('car', 36, 25.7, { tint: '#e3e0d8' });
  m.prop('bin', 39, 23.4).prop('bin', 39.8, 23.4).prop('laundry', 44, 22.6).prop('board', 47, 23);
  m.zone('garages', 42, 21, 4, 1, info('Гаражі. Дядько Вітя знову лагодить свій «жигуль».'), 'Гаражі');

  // Котлован під стадіоном — «річка» Вонючка.
  m.fill(2, 34, 12, 4, 'w').fill(4, 33, 8, 1, 'w').fill(5, 38, 7, 1, 'w');
  m.zone('river', 4, 39, 7, 1, info('Річка Вонючка: котлован вирили під забудову, а будівництва так і не було. Вода стоїть і смердить.'), 'Річка Вонючка');

  // Луг із майданчиком між котлованом, садочком і школою.
  m.fill(19, 28, 9, 7, 'G');
  m.prop('swing', 20, 29.5).prop('slide', 23.5, 29).prop('sandbox', 21, 32.5).prop('bench', 26, 33);
  m.zone('play', 19, 30, 8, 4, { type: 'friends' }, 'Погратися з друзями');

  m.building({ id: 'sadok', x: 30, y: 28, w: 8, h: 4, style: 'sadok', label: 'Садочок «Чебурашка»', doorX: 34, action: { type: 'duty', building: 'sadok' } });
  m.fill(34, 27, 1, 1, 'p').fill(34, 32, 1, 2, 'd');
  m.building({ id: 'school', x: 38, y: 34, w: 10, h: 5, style: 'school', label: 'Школа №1', doorX: 43, action: { type: 'duty', building: 'school' } });
  m.fill(28, 34, 10, 1, 'd').fill(43, 39, 1, 2, 'd').fill(19, 40, 31, 1, 'd').fill(28, 35, 1, 5, 'd');
  m.prop('flagpole', 37, 37);

  // Зелень двору.
  m.tree(19, 22, 'chestnut').tree(29, 22, 'birch').tree(39, 16, 'chestnut').tree(48, 16, 'poplar');
  m.tree(16, 35, 'birch').tree(15, 39, 'cherry').tree(26, 37, 'chestnut').tree(48, 30, 'birch').tree(0, 39, 'cherry');
  m.scatterTrees(29, 36, 8, 3, ['birch', 'cherry'], 0.3, 11);
  m.prop('bush', 39.5, 30).prop('bush', 47, 33).prop('flowerBed', 32, 33.4);
  return m.build();
}

// ------------------------------------------------------------
// Квартира на п'ятому поверсі.
// ------------------------------------------------------------

export type FamilyId = 'mom' | 'dad' | 'vlad';

/** Хто з родини вдома (`spot` — клітинка) і що робить; `spot: null` — не вдома. */
export interface FamilyMember {
  spot: readonly [number, number] | null;
  task: string;
}

/** Місця в квартирі: кухня, лоджія, телевізор, іграшки, ліжко. */
const SPOT = {
  kitchen: [4, 6],
  loggia: [10, 5],
  tv: [19, 11],
  toys: [22, 14],
  bed: [16, 12],
} as const;

const FAMILY_NAME: Record<FamilyId, string> = { mom: 'Мама', dad: 'Тато', vlad: 'Владік' };

/**
 * Розклад родини (з порту): у будні батьки на роботі, Владік у садочку; уночі
 * всі сплять. У рік розлучення (3 клас) увечері вже інакше: мама мовчки миє
 * посуд, тато стоїть на лоджії сам.
 */
export function familyAt(minute: number, day: DayInfo): Record<FamilyId, FamilyMember> {
  const night = minute < DAY_START_MIN || minute >= 22 * 60;
  const workday = !day.weekend && minute >= 8 * 60 + 30 && minute < 17 * 60 + 30;
  const late = day.stage === 'school' && day.level >= DIMA_LAST_GRADE && minute >= 18 * 60;
  const asleep = { spot: SPOT.bed, task: 'спить' } as const;
  if (night) return { mom: asleep, dad: asleep, vlad: asleep };
  return {
    mom: workday ? { spot: null, task: 'на роботі' }
      : late ? { spot: SPOT.kitchen, task: 'мовчки миє посуд' }
        : { spot: SPOT.kitchen, task: minute < 12 * 60 ? 'готує сніданок' : 'готує їсти' },
    dad: workday ? { spot: null, task: 'на роботі' }
      : late ? { spot: SPOT.loggia, task: 'стоїть на лоджії сам' }
        : { spot: SPOT.tv, task: 'дивиться телевізор' },
    vlad: workday ? { spot: null, task: 'у садочку' } : { spot: SPOT.toys, task: 'будує вежу з кубиків' },
  };
}

/** Квартира Діми з родиною, яка зараз удома (по зоні «поговорити» біля кожного). */
export function dimaFlat(state: LifeState): GameMap {
  const family = familyAt(state.minute, today(state));
  const key = (Object.keys(family) as FamilyId[]).map((id) => `${id}:${family[id].spot?.join('.') ?? '-'}`).join(',');
  const m = new MapBuilder(`home:dima-flat:${key}`, null, state.homeName, 28, 18, 'x', true);
  // Кімнати (задня стіна — два ряди `W`) і проходи між ними.
  m.fill(1, 1, 7, 2, 'W').fill(1, 3, 7, 5, 't');
  m.fill(9, 1, 4, 2, 'W').fill(9, 3, 4, 4, 'p');
  m.fill(16, 1, 9, 2, 'W').fill(16, 3, 9, 2, 'p');
  m.fill(14, 6, 13, 2, 'W').fill(14, 8, 13, 9, 'k');
  m.fill(1, 12, 7, 2, 'W').fill(1, 14, 7, 3, 't');
  m.fill(1, 9, 12, 2, 'f').fill(9, 11, 4, 5, 'f').fill(10, 16, 2, 2, 'f');
  m.fill(4, 8, 2, 1, 'f').fill(10, 7, 2, 2, 'f').fill(5, 11, 2, 3, 'f').fill(13, 11, 1, 2, 'f').fill(20, 5, 2, 3, 'f');

  m.prop('fridge', 1.5, 3.4).prop('stove', 3, 3.4).prop('table', 5, 5.6);
  m.prop('wardrobe', 9.4, 3.2);
  m.prop('bed', 14.6, 9, { tint: '#8a6a9a' }).prop('tv', 18.5, 8.6).prop('shelf', 22.5, 8.4).prop('rug', 18, 12);
  m.prop('bed', 24.5, 13.6, { tint: '#5aa7e0' });
  m.prop('window', 17, 0.6).prop('window', 22, 0.6).prop('window', 3, 0.6);

  m.zone('exit', 10, 16, 2, 2, { type: 'exit' }, 'Вийти з квартири');
  m.zone('bed', 24, 15, 2, 2, { type: 'bed' }, 'Двоповерхове ліжко · лягти спати');
  m.zone('tvInfo', 18, 10, 2, 1, info('Етажерка з телевізором. Увечері тут мультики.'), 'Етажерка з телевізором');
  m.zone('sideboard', 22, 10, 2, 1, info('Сервант. Кришталь чіпати не можна.'), 'Сервант');
  m.zone('wardrobeInfo', 9, 5, 2, 1, info('Шафа з одягом на лоджії.'), 'Шафа з одягом');
  m.zone('fridgeInfo', 1, 5, 2, 1, info('У холодильнику борщ і кефір.'), 'Холодильник');
  m.zone('bath', 2, 15, 3, 1, info('Ванна. Вода сьогодні є.'), 'Ванна');
  m.zone('balcony', 16, 3, 9, 1, info('З балкона п\'ятого поверху видно майже все Вишневе.'), 'Балкон');
  for (const id of Object.keys(family) as FamilyId[]) {
    const f = family[id];
    if (!f.spot) continue;
    m.zone(`family:${id}`, f.spot[0], f.spot[1], 1, 1, info(`${FAMILY_NAME[id]} ${f.task}.`), FAMILY_NAME[id]);
  }
  m.spawn('door', 10, 15).spawn('default', 10, 15).spawn('wake', 22, 15);
  return m.build();
}
