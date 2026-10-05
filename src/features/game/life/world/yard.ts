// ============================================================
// Подвір'я Лєниної садиби в Жилинцях — стартовий дім.
// ------------------------------------------------------------
// Розставлено за планом, який власник сам пересунув і зберіг у редакторі
// «Подвір'я Лєни» (2026-10-05). Клітинки редактора — це клітинки гри, тож
// кожне число нижче взято з того плану без перерахунку:
//   • угорі — великий город (x1–31, y1–9), соняшники й копиці праворуч;
//   • під ним стежка, далі в ряд: туалет, хлів, хлів, курник (двері вбік,
//     у вигул), вигул курей, січкарня;
//   • хата — ліве крило 7×8 виступає вперед, праве 7×5 і котельня позаду
//     нього (окремий вхід); головний вхід — у правій стіні правого крила;
//   • праворуч — майстерня (вхід згори), під нею літня кухня з прибудовою
//     ліворуч (вхід згори в прибудову), погріб під кухнею (вхід знизу);
//   • увесь правий край — фруктовий сад, у ньому верстак із дошками й
//     літній душ;
//   • перед хатою й перед кухнею — квітники; криниця — у квітнику біля
//     стежки до хвіртки; хвіртка внизу, до села.
// ============================================================
import { MapBuilder } from './build';
import type { GameMap, TreeKind } from './types';
import { cellHash } from './hash';

export const YARD_ID = 'zhylyntsi:yard';

/**
 * Хата з двох крил, що стоять упритул, але з різною глибиною (план власника,
 * 2026-10-05, 16:44): ліве x3–10, y18–26 виступає вперед; праве з котельнею
 * позаду — x10–17, y16–24.
 */
const LEFT_WING = { x: 3, y: 18, w: 7, h: 8 } as const;
const RIGHT_WING = { x: 10, y: 16, w: 7, h: 8 } as const;
/** Літня кухня (x25–30) з прибудовою ліворуч (x22–25, y20–23) — у прибудові вхід. */
const KITCHEN = { x: 22, y: 19, w: 8, h: 4, annexW: 3 } as const;

/** Тайли садиби, на які посилаються контролер і тести. */
export const YARD = {
  /** Де стоїть мама: біля входу в літню кухню. */
  mom: [21, 21] as [number, number],
  /**
   * Вхід у хату — у правій стіні правого крила (на плані власника — x17, y22).
   * Праве крило закінчується на y24, тож вхід (y21–24) — біля його фасаду,
   * де в ракурсі «три чверті» намальовано бічні двері.
   */
  porch: { x: RIGHT_WING.x + RIGHT_WING.w, y: 21, w: 3, h: 3 },
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

  // ── Квітники: перед хатою й перед кухнею ─────────────────────
  m.fill(1, 26, 19, 6, 'G').fill(22, 26, 8, 6, 'G');
  for (const [x, y] of [[2, 27], [6, 28.4], [10, 27.2], [4, 30], [12, 30.2], [23, 27], [26.4, 28.6], [24, 30.2], [28, 27.4]] as const) m.prop('flowerBed', x, y);

  // ── Стежки — як на плані ─────────────────────────────────────
  m.fill(1, 9, 30, 1, 'd'); // уздовж городу
  m.fill(15, 1, 1, 8, 'd'); // у город
  m.fill(2, 15, 29, 1, 'd'); // уздовж господарських будівель
  m.fill(20, 16, 2, 16, 'd'); // від хвіртки вгору, між хатою й кухнею
  m.fill(17, 21, 3, 4, 'd'); // до входу в хату
  m.fill(22, 18, 3, 1, 'd'); // до входу в літню кухню
  m.fill(22, 23, 5, 2, 'd'); // під кухнею, до погреба

  // ── Великий город ────────────────────────────────────────────
  m.fill(1, 1, 30, 8, 'v');
  m.fill(15, 1, 1, 8, 'd');
  m.zone('garden', 2, 9, 12, 1, { type: 'activity', id: 'garden' }, 'Город · допомогти мамі');
  for (const [x, y] of [[31, 2], [31.6, 3.8], [33, 1.6]] as const) m.prop('sunflowers', x, y);
  m.prop('haystack', 34.6, 2).prop('haystack', 36, 3.4);

  // ── Ряд за городом: туалет, хлів, хлів, курник, вигул, січкарня ─
  m.building({ id: 'toilet', x: 1, y: 11, w: 2, h: 2, style: 'shed', label: 'Туалет', doorX: 2, action: { type: 'info', text: 'Туалет надворі: дерев\'яний, з сердечком на дверях.' }, zoneLabel: 'Туалет' });
  m.building({ id: 'barn1', x: 5, y: 11, w: 5, h: 3, style: 'barn', label: 'Хлів', doorX: 7 });
  m.building({ id: 'barn2', x: 10, y: 11, w: 5, h: 3, style: 'barn', label: 'Хлів', doorX: 12, roof: '#6e6a62' });
  // Курник — двері збоку, просто у вигул.
  m.building({ id: 'coop', x: 15, y: 11, w: 4, h: 3, style: 'coop', label: 'Курник', door: false, sideDoor: true });
  // Вигул: тин довкола, ґрунт усередині, кури.
  m.fill(19, 10, 6, 4, 'd');
  m.fill(19, 10, 6, 1, 'F').fill(24, 10, 1, 4, 'F').fill(19, 13, 5, 1, 'F');
  for (const [x, y] of [[20.2, 11.2], [21.8, 11.6], [23, 11]] as const) m.prop('chicken', x, y, { solid: false });
  for (const [x, y] of [[16.6, 14.6], [18.4, 15.2], [3.4, 14.2]] as const) m.prop('chicken', x, y, { solid: false });
  m.building({ id: 'sichkarnia', x: 26, y: 10, w: 4, h: 5, style: 'shed', label: 'Січкарня', doorX: 27, action: { type: 'info', text: 'Січкарня: тут рубають солому й буряк на корм худобі.' }, zoneLabel: 'Січкарня' });

  // ── Хата: два крила впритул, один дах ─────────────────────────
  // Крила мають різну глибину, тому це дві частини, що прилягають одна до
  // одної без краю даху й стіни (`join`); димар один. Головний вхід — у
  // правій стіні правого крила; всередині він веде у веранду.
  const hata = { style: 'cottage' as const, wall: '#f4eee0', roof: '#b8954e', label: 'Хата', door: false };
  m.building({ id: 'house', ...LEFT_WING, ...hata, join: 'right', chimney: false });
  m.building({ id: 'house-right', ...RIGHT_WING, ...hata, join: 'left', sideDoor: true });
  m.fill(YARD.porch.x, YARD.porch.y + 1, 1, 2, 'c');
  m.prop('pot', YARD.porch.x + 0.6, YARD.porch.y - 0.3, { solid: false });
  m.zone('home', YARD.porch.x, YARD.porch.y, YARD.porch.w, YARD.porch.h, { type: 'home' }, 'У хату');
  // Котельня — окремий вхід праворуч, у задній частині правого крила.
  m.fill(RIGHT_WING.x + RIGHT_WING.w, 17, 1, 1, 'c');
  m.zone('boiler', RIGHT_WING.x + RIGHT_WING.w, 17, 1, 1, { type: 'info', text: 'Котельня: котел, вугілля й дрова на зиму. Вхід окремий, з подвір\'я.' }, 'Котельня');
  m.prop('bench', 5, 26.2).prop('bush', 1.2, 16.4).prop('cat', 13.4, 27.6);
  m.prop('bike', 19.2, 25.2, { solid: false });
  m.tree(2, 22, 'cherry');

  // ── Майстерня, літня кухня з прибудовою, погріб ──────────────
  // Майстерня — вхід згори, зі стежки.
  m.building({ id: 'workshop', x: 25, y: 16, w: 5, h: 3, style: 'shed', label: 'Майстерня', door: false });
  m.zone('workshop', 27, 15, 1, 1, { type: 'activity', id: 'workshop' }, 'Майстерня · змайструвати');
  // Кухня з прибудовою — одна будівля; вхід — з верхнього боку прибудови.
  m.building({
    id: 'summerKitchen', x: KITCHEN.x, y: KITCHEN.y, w: KITCHEN.w, h: KITCHEN.h, style: 'house', label: 'Літня кухня',
    wall: '#efe4c8', roof: '#8a5a44', door: false, notch: { w: KITCHEN.annexW, h: 1, side: 'left' },
  });
  m.fill(KITCHEN.x, KITCHEN.y, KITCHEN.annexW, 1, 'c');
  m.zone('summerKitchen', KITCHEN.x, KITCHEN.y, KITCHEN.annexW, 1, { type: 'activity', id: 'summerKitchen' }, 'Літня кухня · з мамою');
  m.zone('mom', YARD.mom[0] - 1, YARD.mom[1], 2, 2, { type: 'mom' }, 'Поговорити з мамою');
  // Погріб під кухнею — вхід знизу.
  m.prop('cellar', 27.6, 23.1);
  m.zone('cellar', 28, 24, 1, 1, { type: 'info', text: 'Погріб: картопля, банки з огірками й мамине вишневе варення' }, 'Погріб');

  // ── Фруктовий сад: увесь правий край ─────────────────────────
  // Верстак і дошки й літній душ стоять у саду; дерева їх оминають.
  m.prop('workbench', 30.2, 16.6).prop('planks', 30.1, 18.8);
  m.building({ id: 'shower', x: 33, y: 19, w: 2, h: 2, style: 'shed', label: 'Літній душ', doorX: 33, action: { type: 'info', text: 'Літній душ: бочка на даху, вода гріється від сонця.' }, zoneLabel: 'Літній душ' });
  const busy = [{ x: 29, y: 15, w: 4, h: 5 }, { x: 32, y: 18, w: 4, h: 4 }, { x: 29, y: 22, w: 3, h: 6 }];
  const fruit: readonly TreeKind[] = ['apple', 'cherry', 'apple', 'cherry'];
  for (let j = 11; j <= 29; j += 3) {
    for (let i = 31; i <= 37; i += 3) {
      const h = cellHash(i, j, 61);
      const x = Math.min(37, i + (h % 2));
      const y = j + ((h >>> 3) % 2);
      if (busy.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) continue;
      m.tree(x, y, fruit[(h >>> 5) % fruit.length]!);
    }
  }
  m.zone('orchard', 30, 24, 1, 3, { type: 'activity', id: 'orchard' }, 'Сад · збирати фрукти');

  // ── Криниця — у квітнику біля стежки до хвіртки ──────────────
  m.prop('well', 17, 29.4);
  m.tree(15, 29, 'apple').tree(36, 31, 'oak').tree(2, 31, 'willow');

  m.spawn('gate', YARD.gate.x, H - 3).spawn('default', YARD.gate.x, H - 3);
  m.spawn('house', YARD.porch.x + 1, YARD.porch.y + 1);
  return m.build();
}
