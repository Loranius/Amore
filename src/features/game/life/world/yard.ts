// ============================================================
// Подвір'я Лєниної садиби в Жилинцях — стартовий дім (власник, 2026-10-06,
// план від руки й ТЗ).
// ------------------------------------------------------------
// Витягнута ділянка; нижня сторона — до села (хвіртка). Від села вглиб:
//   • основний двір: ґрунт, стежки, трава, криниця;
//   • головний будинок ліворуч — Г-подібний, з кількох об'ємів (ліве довге
//     крило, кімната над коридором, висока права кімната, коридор, нижня
//     кімната з піччю); вхід — з ґанку праворуч, у двір;
//   • праворуч, через проміжок, — одна будівля: майстерня зверху, літня
//     кухня знизу (вхід знизу, від двору), невелика прибудова ліворуч,
//     погріб біля кухні;
//   • позаду будинку — хлів, хлів і курник із вигулом;
//   • за ними — великий город;
//   • за літньою кухнею — фруктовий сад.
// Усе — старе, сільське, функціональне: дерев'яні хліви під шифером,
// дрова, дошки й верстак біля майстерні, кури й сліди біля курника.
// ============================================================
import { MapBuilder } from './build';
import type { GameMap, TreeKind } from './types';
import { cellHash } from './hash';

export const YARD_ID = 'zhylyntsi:yard';

/** Тайли садиби, на які посилаються контролер і тести. */
/** Хата: Г-подібна, двері в правому крилі. */
const HOUSE = { x: 5, y: 17, w: 10, h: 7, notchW: 5, notchH: 3 } as const;
/** Літня кухня з прибудовою ліворуч (прибудова — нижче, у ній вхід). */
const KITCHEN = { x: 23, y: 19, w: 7, h: 4, annexW: 2 } as const;

export const YARD = {
  /** Де стоїть мама: біля входу в літню кухню. */
  mom: [21, 21] as [number, number],
  /** Вхід у хату — збоку, біля правої стіни (де власник показав на знімку). */
  porch: { x: HOUSE.x + HOUSE.w, y: HOUSE.y + HOUSE.h - 3, w: 2, h: 3 },
  gate: { x: 20, y: 32 },
} as const;

export function yardMap(): GameMap {
  const W = 40;
  const H = 34;
  const m = new MapBuilder(YARD_ID, 'zhylyntsi', 'Жилинці · подвір\'я', W, H);
  m.folk = 0;

  // ── Межі ділянки: тин довкола, хвіртка внизу до села ──────────
  m.fill(0, 0, W, 1, 'F').fill(0, 0, 1, H - 1, 'F').fill(W - 1, 0, 1, H - 1, 'F').fill(0, H - 2, W, 1, 'F');
  m.fill(0, H - 1, W, 1, 'd');
  m.fill(YARD.gate.x, H - 2, 2, 1, 'd');
  m.zone('village', YARD.gate.x, H - 2, 2, 2, { type: 'village' }, 'Хвіртка · у село');

  // ── Великий город за хлівами й курником ─────────────────────
  m.fill(1, 1, 30, 8, 'v');
  // Межа між грядками й двором; стежка вглиб городу.
  m.fill(1, 9, 30, 1, 'd').fill(15, 1, 1, 8, 'd');
  m.zone('garden', 2, 9, 12, 1, { type: 'activity', id: 'garden' }, 'Город · допомогти мамі');
  for (const [x, y] of [[31, 2], [31, 4], [31, 6], [31.6, 8]] as const) m.prop('sunflowers', x, y);
  m.prop('haystack', 33, 2).prop('haystack', 35.5, 3);

  // ── Хлів, хлів, курник — у лінію, але не по лінійці ─────────
  m.building({ id: 'barn1', x: 3, y: 10, w: 5, h: 3, style: 'barn', label: 'Хлів', doorX: 5 });
  m.building({ id: 'barn2', x: 10, y: 11, w: 5, h: 3, style: 'barn', label: 'Хлів', doorX: 12, roof: '#6e6a62' });
  m.building({ id: 'coop', x: 18, y: 11, w: 4, h: 2, style: 'coop', label: 'Курник', doorX: 19 });
  // Вигул курника: тин навколо, ґрунт усередині, кури й сліди.
  m.fill(23, 10, 6, 4, 'd');
  m.fill(23, 10, 6, 1, 'F').fill(28, 10, 1, 4, 'F').fill(23, 13, 5, 1, 'F');
  for (const [x, y] of [[24.2, 11.2], [25.8, 11.6], [27, 11], [20.2, 13.4], [21.6, 14.2], [17.2, 14.4]] as const) m.prop('chicken', x, y, { solid: false });
  // Стежка вздовж господарських будівель.
  m.fill(2, 14, 29, 1, 'd');

  // ── Головний будинок: одна Г-подібна споруда ─────────────
  // Власник: «будинок має бути суцільним, це одна локація; можна зменшити
  // візуально». Ліве крило довше вглиб, праве нижче; фасад і звис — одна
  // лінія. Вхід — один, збоку, у правій стіні: всередині він веде у веранду.
  m.building({
    id: 'house', x: HOUSE.x, y: HOUSE.y, w: HOUSE.w, h: HOUSE.h, style: 'cottage', wall: '#f4eee0', roof: '#b8954e',
    label: 'Хата', door: false, sideDoor: true, notch: { w: HOUSE.notchW, h: HOUSE.notchH, side: 'right' },
  });
  // Біля входу — кам'яний приступок і витоптана стежка до двору.
  m.fill(YARD.porch.x, YARD.porch.y, 4, YARD.porch.h, 'd');
  m.fill(YARD.porch.x, YARD.porch.y + 1, 1, 2, 'c');
  m.prop('bench', 6.6, HOUSE.y + HOUSE.h + 0.4).prop('pot', YARD.porch.x + 0.7, YARD.porch.y - 0.2, { solid: false });
  m.zone('home', YARD.porch.x, YARD.porch.y, YARD.porch.w, YARD.porch.h, { type: 'home' }, 'У хату');
  // За правим крилом, у кутку «Г», — квітник і кущ.
  m.fill(HOUSE.x + HOUSE.w - HOUSE.notchW, HOUSE.y, HOUSE.notchW, 2, 'G');
  m.prop('flowerBed', HOUSE.x + HOUSE.w - 4, HOUSE.y + 0.6).prop('bush', HOUSE.x + HOUSE.w - 1.2, HOUSE.y + 0.3);

  // ── Літня кухня з прибудовою, над нею майстерня ─────────────
  // Прибудова ліворуч — частина літньої кухні й вхід до неї: двері з
  // верхнього боку прибудови. Тому кухня й прибудова — одна Г-подібна
  // будівля, а вхід — зона над прибудовою.
  m.building({ id: 'workshop', x: 25, y: 16, w: 5, h: 3, style: 'shed', label: 'Майстерня', door: false });
  m.building({
    id: 'summerKitchen', x: KITCHEN.x, y: KITCHEN.y, w: KITCHEN.w, h: KITCHEN.h, style: 'house', label: 'Літня кухня',
    wall: '#efe4c8', roof: '#8a5a44', door: false, notch: { w: KITCHEN.annexW, h: 1, side: 'left' },
  });
  // Вхід: стежка обходить прибудову зверху, біля дверей — приступок.
  m.fill(KITCHEN.x - 1, KITCHEN.y - 1, KITCHEN.annexW + 1, 1, 'd').fill(KITCHEN.x - 1, KITCHEN.y, 1, KITCHEN.h, 'd');
  m.fill(KITCHEN.x, KITCHEN.y, KITCHEN.annexW, 1, 'c');
  m.zone('summerKitchen', KITCHEN.x, KITCHEN.y, KITCHEN.annexW, 1, { type: 'activity', id: 'summerKitchen' }, 'Літня кухня · з мамою');
  m.prop('cellar', 27.6, 24.2);
  m.zone('cellar', 28, 24, 2, 1, { type: 'info', text: 'Погріб: картопля, банки з огірками й мамине вишневе варення' }, 'Погріб');
  // Біля майстерні — робоче: верстак, дошки, дрова.
  m.prop('workbench', 30.2, 16.6).prop('planks', 30.1, 18.8);
  m.zone('workshop', 30, 18, 2, 1, { type: 'activity', id: 'workshop' }, 'Майстерня · змайструвати');
  m.prop('woodpile', 17, 16);
  m.zone('mom', YARD.mom[0] - 1, YARD.mom[1], 2, 2, { type: 'mom' }, 'Поговорити з мамою');

  // ── Фруктовий сад за літньою кухнею ────────────────────────
  const fruit: readonly TreeKind[] = ['apple', 'cherry', 'apple', 'cherry'];
  for (let j = 11; j <= 29; j += 3) {
    for (let i = 33; i <= 37; i += 3) {
      const h = cellHash(i, j, 61);
      m.tree(i + (h % 2), j + ((h >>> 3) % 2), fruit[(h >>> 5) % fruit.length]!);
    }
  }
  m.zone('orchard', 31, 20, 1, 4, { type: 'activity', id: 'orchard' }, 'Сад · збирати фрукти');

  // ── Двір: ґрунтові стежки, трава, криниця, нерівності ───────
  // Від хвіртки — пунктир плану: угору до кухні, гілка до ґанку.
  m.fill(20, 24, 2, H - 26, 'd');
  m.fill(22, 23, 5, 2, 'd');
  // Між будинком і майстернею — прохід до хлівів.
  m.fill(19, 15, 2, 9, 'd');
  // Витоптані плями ґрунту й трава з квітами.
  for (const [x, y, w, h] of [[16, 27, 3, 2], [23, 27, 3, 1], [9, 28, 4, 2]] as const) m.fill(x, y, w, h, 'd');
  for (const [x, y, w, h] of [[1, 28, 6, 3], [30, 26, 3, 3], [12, 29, 4, 2]] as const) m.fill(x, y, w, h, 'G');
  m.prop('well', 23, 26);
  m.prop('bush', 2, 15.5).prop('bush', 1.4, 26).prop('flowerBed', 3, 27.4).prop('cat', 13.4, 27.6);
  m.prop('bike', 18.4, 26.4, { solid: false });
  m.tree(36, 31, 'oak').tree(2, 31, 'willow');

  m.spawn('gate', YARD.gate.x, H - 3).spawn('default', YARD.gate.x, H - 3);
  m.spawn('house', YARD.porch.x + 1, YARD.porch.y + 2);
  return m.build();
}
