// ============================================================
// Підсумок подорожей і два порядки міток.
// ------------------------------------------------------------
// Головні інваріанти:
//   • середня оцінка рахується лише по ОЦІНЕНИХ — інакше кожна
//     неоцінена мітка тягла б середню вниз як нуль;
//   • дата створення мітки ніколи не підміняє дату відвідання. Мітку про
//     давню подорож часто ставлять через місяці, і мовчазна підміна
//     поставила б поїздку 2024-го в поточний місяць.
// ============================================================
import { describe, expect, it } from 'vitest';
import { cityStats, groupPinsByMonth, travelSummary } from './mapStats';
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

describe('travelSummary', () => {
  it('рахує місця, міста й країни без повторів', () => {
    const s = travelSummary([
      pin({ id: 1, city: 'Київ' }),
      pin({ id: 2, city: 'Київ' }),
      pin({ id: 3, city: 'Одеса' }),
      pin({ id: 4, city: 'Батумі', country: 'Грузія' }),
    ]);
    expect(s.places).toBe(4);
    expect(s.cities).toBe(3);
    expect(s.countries).toBe(2);
  });

  it('середня рахується лише по оцінених', () => {
    // Дві п'ятірки й дві неоцінені — це 5.0, а не 2.5.
    const s = travelSummary([
      pin({ id: 1, rating: 5 }), pin({ id: 2, rating: 5 }),
      pin({ id: 3 }), pin({ id: 4 }),
    ]);
    expect(s.avgRating).toBe(5);
    expect(s.rated).toBe(2);
  });

  it('середня округлюється до десятої', () => {
    const s = travelSummary([pin({ id: 1, rating: 5 }), pin({ id: 2, rating: 4 }), pin({ id: 3, rating: 4 })]);
    expect(s.avgRating).toBe(4.3);
  });

  it('без жодної оцінки середньої немає, а не нуль', () => {
    expect(travelSummary([pin({ id: 1 })]).avgRating).toBeNull();
  });

  it('перше й останнє відвідання — за датою, а не за порядком у масиві', () => {
    const s = travelSummary([
      pin({ id: 1, visited_at: '2026-07-14' }),
      pin({ id: 2, visited_at: '2024-03-02' }),
      pin({ id: 3, visited_at: '2026-01-30' }),
    ]);
    expect(s.firstVisit).toBe('2024-03-02');
    expect(s.lastVisit).toBe('2026-07-14');
  });

  it('мітки без дати не стають межами діапазону', () => {
    const s = travelSummary([pin({ id: 1, visited_at: null }), pin({ id: 2, visited_at: '2026-07-14' })]);
    expect(s.firstVisit).toBe('2026-07-14');
    expect(s.lastVisit).toBe('2026-07-14');
  });

  it('порожній архів не падає', () => {
    expect(travelSummary([])).toEqual({
      places: 0, cities: 0, countries: 0, avgRating: null, rated: 0,
      firstVisit: null, lastVisit: null,
    });
  });
});

describe('groupPinsByMonth', () => {
  it('групує місяцями, від найновішого', () => {
    const groups = groupPinsByMonth([
      pin({ id: 1, visited_at: '2026-06-17' }),
      pin({ id: 2, visited_at: '2026-07-14' }),
      pin({ id: 3, visited_at: '2026-06-30' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-07', '2026-06']);
    expect(groups[1]!.pins).toHaveLength(2);
  });

  it('підписує місяць називним відмінком', () => {
    expect(groupPinsByMonth([pin({ id: 1, visited_at: '2026-07-14' })])[0]!.label).toBe('Липень 2026');
  });

  it('усередині місяця — від найновішого', () => {
    const groups = groupPinsByMonth([
      pin({ id: 1, visited_at: '2026-07-02' }),
      pin({ id: 2, visited_at: '2026-07-28' }),
    ]);
    expect(groups[0]!.pins.map((p) => p.id)).toEqual([2, 1]);
  });

  it('за однакової дати порядок сталий, а не залежить від входу', () => {
    const a = groupPinsByMonth([pin({ id: 3 }), pin({ id: 9 })])[0]!.pins.map((p) => p.id);
    const b = groupPinsByMonth([pin({ id: 9 }), pin({ id: 3 })])[0]!.pins.map((p) => p.id);
    expect(a).toEqual(b);
  });

  it('мітки без дати відвідання йдуть окремою групою в кінець', () => {
    // І НЕ отримують дату створення: мітку про давню подорож часто
    // ставлять через місяці після неї.
    const groups = groupPinsByMonth([
      pin({ id: 1, visited_at: null, created_at: '2026-07-27T10:00:00Z' }),
      pin({ id: 2, visited_at: '2026-07-14' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-07', '']);
    expect(groups[1]!.label).toBe('Без дати');
  });

  it('коли всі з датами, купки «Без дати» не існує', () => {
    expect(groupPinsByMonth([pin({ id: 1 })]).every((g) => g.key !== '')).toBe(true);
  });

  it('порожній список дає порожній результат', () => {
    expect(groupPinsByMonth([])).toEqual([]);
  });

  it('грудень і січень сусідніх років не змішуються', () => {
    const groups = groupPinsByMonth([
      pin({ id: 1, visited_at: '2025-12-31' }),
      pin({ id: 2, visited_at: '2026-01-01' }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(['2026-01', '2025-12']);
  });
});

describe('cityStats', () => {
  it('міста від найчастішого', () => {
    const stats = cityStats([
      pin({ id: 1, city: 'Одеса' }), pin({ id: 2, city: 'Одеса' }), pin({ id: 3, city: 'Одеса' }),
      pin({ id: 4, city: 'Київ' }), pin({ id: 5, city: 'Київ' }),
      pin({ id: 6, city: 'Львів' }),
    ]);
    expect(stats.map((s) => s.city)).toEqual(['Одеса', 'Київ', 'Львів']);
  });

  it('за рівної кількості вирішує абетка', () => {
    const stats = cityStats([pin({ id: 1, city: 'Ялта' }), pin({ id: 2, city: 'Батумі' })]);
    expect(stats.map((s) => s.city)).toEqual(['Батумі', 'Ялта']);
  });

  it('мітки без міста збираються під «Інші місця» в кінці', () => {
    const stats = cityStats([
      pin({ id: 1, city: null }),
      pin({ id: 2, city: 'Київ' }),
      pin({ id: 3, city: null }),
    ]);
    expect(stats[stats.length - 1]!.city).toBe('Інші місця');
    expect(stats[stats.length - 1]!.pins).toHaveLength(2);
  });

  it('оцінка й останнє відвідання рахуються в межах міста', () => {
    const stats = cityStats([
      pin({ id: 1, city: 'Одеса', rating: 5, visited_at: '2026-07-14' }),
      pin({ id: 2, city: 'Одеса', rating: 3, visited_at: '2026-06-01' }),
      pin({ id: 3, city: 'Київ', rating: 1, visited_at: '2020-01-01' }),
    ]);
    const odesa = stats.find((s) => s.city === 'Одеса')!;
    expect(odesa.avgRating).toBe(4);
    expect(odesa.lastVisit).toBe('2026-07-14');
  });
});
