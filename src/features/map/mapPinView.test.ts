// ============================================================
// Картка місця й синхронізація маркерів.
// ------------------------------------------------------------
// Два інваріанти, обидва — регресії на знайдені баги:
//   1. Жоден написаний текст не лишається невидимим (`note` показувався
//      ніде, хоч у базі знайшлось 10 міток із власною нотаткою).
//   2. Незмінена мітка не перемальовується. Раніше будь-яка мутація
//      знищувала й створювала всі маркери, бо після invalidate масив
//      `pins` приходив новим об'єктом.
// ============================================================
import { describe, expect, it } from 'vitest';
import {
  clusterPins, clusterSignature, markerSignature,
  pinHasSecondText, pinPrimaryText, planSync,
} from './mapPinView';
import type { MapPinRow } from '@/types';

const pin = (over: Partial<MapPinRow> & { id: number }): MapPinRow => ({
  title: 'Місце',
  note: null,
  category: 'visited',
  lat: 50.45,
  lng: 30.52,
  photo_url: null,
  rating: null,
  review: null,
  city: 'Київ',
  country: 'Україна',
  created_by: 1,
  created_at: '2026-07-14T10:00:00Z',
  visited_at: '2026-07-14',
  ...over,
});

describe('pinPrimaryText', () => {
  it('враження головніше за нотатку', () => {
    expect(pinPrimaryText({ review: 'Було смачно', note: 'Столик біля вікна' })).toBe('Було смачно');
  });

  it('без враження показує нотатку, а не порожнечу', () => {
    // Саме той випадок, через який текст був невидимий.
    expect(pinPrimaryText({ review: null, note: 'Столик біля вікна' })).toBe('Столик біля вікна');
  });

  it('порожні рядки й пробіли — це відсутність тексту', () => {
    expect(pinPrimaryText({ review: '   ', note: '' })).toBeNull();
    expect(pinPrimaryText({ review: null, note: null })).toBeNull();
    expect(pinPrimaryText({ review: '  ', note: 'нотатка' })).toBe('нотатка');
  });
});

describe('pinHasSecondText', () => {
  it('бачить, що під карткою сховано ще один текст', () => {
    expect(pinHasSecondText({ review: 'Смачно', note: 'Біля вікна' })).toBe(true);
  });

  it('один текст другим не рахується', () => {
    expect(pinHasSecondText({ review: 'Смачно', note: null })).toBe(false);
    expect(pinHasSecondText({ review: null, note: 'Біля вікна' })).toBe(false);
  });
});

describe('planSync', () => {
  /** Те, що робить MapPage: мітка без скупчення — маркер із власним ключем. */
  const drawn = (...pins: MapPinRow[]) =>
    new Map(pins.map((p) => [String(p.id), markerSignature(p)]));

  it('незмінені мітки лишаються на місці', () => {
    // Головний інваріант: після invalidate масив новий, а маркери — ті самі.
    const pins = [pin({ id: 1 }), pin({ id: 2, lat: 49.8 })];
    const plan = planSync(drawn(...pins), drawn(...pins));
    expect(plan).toEqual({ add: [], remove: [], keep: ['1', '2'] });
  });

  it('нова мітка додається, зникла прибирається', () => {
    const before = [pin({ id: 1 }), pin({ id: 2, lat: 49.8 })];
    const after = [pin({ id: 1 }), pin({ id: 3, lat: 48.5 })];
    const plan = planSync(drawn(...before), drawn(...after));
    expect(plan.add).toEqual(['3']);
    expect(plan.remove).toEqual(['2']);
    expect(plan.keep).toEqual(['1']);
  });

  it('переїзд мітки перестворює саме її', () => {
    const before = [pin({ id: 1 }), pin({ id: 2, lat: 49.8 })];
    const after = [pin({ id: 1, lat: 51.1 }), pin({ id: 2, lat: 49.8 })];
    const plan = planSync(drawn(...before), drawn(...after));
    expect(plan.remove).toEqual(['1']);
    expect(plan.add).toEqual(['1']);
    expect(plan.keep).toEqual(['2']);
  });

  it('зміна категорії перестворює маркер, бо міняє колір і емодзі', () => {
    const plan = planSync(
      drawn(pin({ id: 1, category: 'visited' })),
      drawn(pin({ id: 1, category: 'restaurant' })),
    );
    expect(plan.add).toEqual(['1']);
    expect(plan.remove).toEqual(['1']);
  });

  it('зміна назви чи оцінки маркера не чіпає', () => {
    // Вигляд маркера від них не залежить — перемальовувати нема чого.
    const before = drawn(pin({ id: 1, title: 'Було', rating: null }));
    const after = drawn(pin({ id: 1, title: 'Стало', rating: 5, review: 'клас' }));
    expect(planSync(before, after).keep).toEqual(['1']);
  });

  it('порожній список прибирає все', () => {
    const plan = planSync(drawn(pin({ id: 1 }), pin({ id: 2 })), new Map());
    expect(plan.remove.sort()).toEqual(['1', '2']);
    expect(plan.add).toEqual([]);
  });

  it('перше малювання додає всі мітки', () => {
    const plan = planSync(new Map(), drawn(pin({ id: 1 }), pin({ id: 2 })));
    expect(plan.add).toEqual(['1', '2']);
    expect(plan.remove).toEqual([]);
  });
});

describe('clusterPins', () => {
  const at = (id: number, x: number, y: number) => ({ pin: pin({ id }), x, y });

  it('злиплі мітки стають одним скупченням', () => {
    const groups = clusterPins([at(1, 100, 100), at(2, 110, 105), at(3, 400, 400)], 40);
    expect(groups).toHaveLength(2);
    expect(groups[0]!.pins.map((p) => p.id)).toEqual([1, 2]);
    expect(groups[1]!.pins.map((p) => p.id)).toEqual([3]);
  });

  it('значок стає в центр скупчення, а не на першу мітку', () => {
    const groups = clusterPins([at(1, 100, 100), at(2, 120, 140)], 60);
    expect(groups[0]!.x).toBe(110);
    expect(groups[0]!.y).toBe(120);
  });

  it('рознесені мітки лишаються самі собою', () => {
    const groups = clusterPins([at(1, 0, 0), at(2, 200, 0), at(3, 0, 200)], 40);
    expect(groups).toHaveLength(3);
    expect(groups.every((g) => g.pins.length === 1)).toBe(true);
  });

  it('радіус вимірюється по колу, а не по осях', () => {
    // (30,30) далі за 40px по діагоналі (≈42.4), хоч по кожній осі ближче.
    expect(clusterPins([at(1, 0, 0), at(2, 30, 30)], 40)).toHaveLength(2);
    expect(clusterPins([at(1, 0, 0), at(2, 20, 20)], 40)).toHaveLength(1);
  });

  it('жодна мітка не губиться й не дублюється', () => {
    const points = [at(1, 0, 0), at(2, 10, 10), at(3, 15, 5), at(4, 300, 300), at(5, 305, 295)];
    const ids = clusterPins(points, 50).flatMap((g) => g.pins.map((p) => p.id));
    expect(ids.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it('ключ не залежить від порядку, в якому мітки прийшли', () => {
    // Інакше при кожному перемальовуванні ключ стрибав би, і planSync
    // вважав би скупчення новим — маркери блимали б на кожен рух карти.
    const a = clusterPins([at(1, 0, 0), at(2, 10, 10)], 50)[0]!.key;
    const b = clusterPins([at(2, 10, 10), at(1, 0, 0)], 50)[0]!.key;
    expect(a).toBe(b);
  });

  it('порожній вхід дає порожній результат', () => {
    expect(clusterPins([], 40)).toEqual([]);
  });
});

describe('clusterSignature', () => {
  it('одиночна мітка підписується як звичайний маркер', () => {
    const one = pin({ id: 1, category: 'restaurant' });
    const group = clusterPins([{ pin: one, x: 0, y: 0 }], 40)[0]!;
    expect(clusterSignature(group)).toBe(markerSignature(one));
  });

  it('скупчення міняє підпис, коли міняється склад', () => {
    const a = clusterPins([{ pin: pin({ id: 1 }), x: 0, y: 0 }, { pin: pin({ id: 2 }), x: 5, y: 5 }], 40)[0]!;
    const b = clusterPins([
      { pin: pin({ id: 1 }), x: 0, y: 0 },
      { pin: pin({ id: 2 }), x: 5, y: 5 },
      { pin: pin({ id: 3 }), x: 6, y: 6 },
    ], 40)[0]!;
    expect(clusterSignature(a)).not.toBe(clusterSignature(b));
  });

  it('зсув менший за піксель не вважається зміною', () => {
    // Інакше найдрібніша інерція карти перемальовувала б усі скупчення.
    const mk = (dy: number) => clusterPins([
      { pin: pin({ id: 1 }), x: 0, y: 0 },
      { pin: pin({ id: 2 }), x: 5, y: 5 + dy },
    ], 40)[0]!;
    expect(clusterSignature(mk(0))).toBe(clusterSignature(mk(0.2)));
  });
});
