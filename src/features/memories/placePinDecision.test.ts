import { describe, expect, it } from 'vitest';
import type { MapPinRow } from '@/types';
import { decidePlacePin } from './momentPlace';
import type { PlaceCandidate } from './momentPlace';

// ============================================================
// Правило, через яке карта роками не рахувалась.
// ------------------------------------------------------------
// `adapters/map.ts` починається з `if (!row.visitedAt) continue`, а
// єдиний живий шлях створення мітки цього поля не ставив. Виміряно на
// рушії: три справжні місця БЕЗ дати лишають рік рівно порожнім (0.300),
// одне З датою піднімає 0.480 → 0.566.
//
// Тому три гілки нижче — не формальність. Кожна може зіпсувати щось своє:
// не датувати — сховати рік від рушія; датувати вже датовану — переписати
// минуле; не впізнати наявну — насипати парі других міток на ту саму
// терасу.
// ============================================================

const LVIV = { lat: 49.8397, lng: 24.0297 };

function pin(id: number, at: { lat: number; lng: number }, visited: string | null): MapPinRow {
  return {
    id,
    title: 'Львів',
    note: null,
    category: 'visited',
    lat: at.lat,
    lng: at.lng,
    photo_url: null,
    rating: null,
    review: null,
    city: 'Львів',
    country: 'Україна',
    created_by: 1,
    created_at: '2017-12-09',
    visited_at: visited,
  };
}

const place: PlaceCandidate = {
  title: 'Львів', city: 'Львів', country: 'Україна', ...LVIV,
};

/** Приблизно 1.2 км на північ — поза допуском у 120 м. */
const FAR = { lat: LVIV.lat + 0.011, lng: LVIV.lng };

describe('мітка місця: створити, датувати чи не чіпати', () => {
  it('міток немає — створюємо', () => {
    expect(decidePlacePin([], place)).toEqual({ kind: 'insert' });
  });

  it('мітка є, але без дати — датуємо її', () => {
    /*
     * Найважливіша гілка: саме такими лежать УСІ мітки, створені
     * нотатником спогадів до цієї зміни. Без неї заповнення історії
     * дало б парі другу мітку поруч, а стара так і лишилась би
     * невидимою рушієві.
     */
    expect(decidePlacePin([pin(7, LVIV, null)], place)).toEqual({ kind: 'date', id: 7 });
  });

  it('мітка вже датована — дату НЕ переписуємо', () => {
    /*
     * `PRODUCT.md`: минуле не переписується. Пара може повернутись у те
     * саме місце через п'ять років, і новий спогад не має права
     * забрати рік у старого.
     */
    expect(decidePlacePin([pin(7, LVIV, '2017-12-09')], place))
      .toEqual({ kind: 'keep', id: 7, visitedAt: '2017-12-09' });
  });

  it('далека мітка не рахується тією самою', () => {
    expect(decidePlacePin([pin(7, FAR, '2017-12-09')], place)).toEqual({ kind: 'insert' });
  });

  it('серед кількох близьких береться найближча', () => {
    // 120 м допуску в центрі міста накривають кілька міток; узяти першу
    // за порядком у базі означало б датувати випадкову сусідню.
    const near = { lat: LVIV.lat + 0.0009, lng: LVIV.lng };
    const decision = decidePlacePin([pin(1, near, null), pin(2, LVIV, null)], place);

    expect(decision).toEqual({ kind: 'date', id: 2 });
  });
});
