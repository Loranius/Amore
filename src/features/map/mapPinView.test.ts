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
import { markerSignature, pinHasSecondText, pinPrimaryText, planMarkerSync } from './mapPinView';
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

describe('planMarkerSync', () => {
  const drawn = (...pins: MapPinRow[]) =>
    new Map(pins.map((p) => [p.id, markerSignature(p)]));

  it('незмінені мітки лишаються на місці', () => {
    // Головний інваріант: після invalidate масив новий, а маркери — ті самі.
    const pins = [pin({ id: 1 }), pin({ id: 2, lat: 49.8 })];
    const plan = planMarkerSync(drawn(...pins), pins);
    expect(plan).toEqual({ add: [], remove: [], keep: [1, 2] });
  });

  it('нова мітка додається, зникла прибирається', () => {
    const before = [pin({ id: 1 }), pin({ id: 2, lat: 49.8 })];
    const after = [pin({ id: 1 }), pin({ id: 3, lat: 48.5 })];
    const plan = planMarkerSync(drawn(...before), after);
    expect(plan.add).toEqual([3]);
    expect(plan.remove).toEqual([2]);
    expect(plan.keep).toEqual([1]);
  });

  it('переїзд мітки перестворює саме її', () => {
    const before = [pin({ id: 1 }), pin({ id: 2, lat: 49.8 })];
    const after = [pin({ id: 1, lat: 51.1 }), pin({ id: 2, lat: 49.8 })];
    const plan = planMarkerSync(drawn(...before), after);
    expect(plan.remove).toEqual([1]);
    expect(plan.add).toEqual([1]);
    expect(plan.keep).toEqual([2]);
  });

  it('зміна категорії перестворює маркер, бо міняє колір і емодзі', () => {
    const before = [pin({ id: 1, category: 'visited' })];
    const after = [pin({ id: 1, category: 'restaurant' })];
    const plan = planMarkerSync(drawn(...before), after);
    expect(plan.add).toEqual([1]);
    expect(plan.remove).toEqual([1]);
  });

  it('зміна назви чи оцінки маркера не чіпає', () => {
    // Вигляд маркера від них не залежить — перемальовувати нема чого.
    const before = [pin({ id: 1, title: 'Було', rating: null })];
    const after = [pin({ id: 1, title: 'Стало', rating: 5, review: 'клас' })];
    expect(planMarkerSync(drawn(...before), after).keep).toEqual([1]);
  });

  it('порожній список прибирає все', () => {
    const plan = planMarkerSync(drawn(pin({ id: 1 }), pin({ id: 2 })), []);
    expect(plan.remove.sort()).toEqual([1, 2]);
    expect(plan.add).toEqual([]);
  });

  it('перше малювання додає всі мітки', () => {
    const plan = planMarkerSync(new Map(), [pin({ id: 1 }), pin({ id: 2 })]);
    expect(plan.add).toEqual([1, 2]);
    expect(plan.remove).toEqual([]);
  });
});
