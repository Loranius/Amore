import { describe, expect, it } from 'vitest';
import { directionsUrl, featureFromPlace, resultFromPlace, type NominatimPlace } from './geo';

const place = (over: Partial<NominatimPlace> = {}): NominatimPlace => ({
  lat: '49.2331',
  lon: '28.4682',
  name: 'BeeCoffe',
  display_name: 'BeeCoffe, вулиця Соборна, Вінниця, Україна',
  address: { road: 'вулиця Соборна', city: 'Вінниця', country: 'Україна' },
  ...over,
});

describe('місце Nominatim → фіча', () => {
  it('координати лягають у порядку GeoJSON: [довгота, широта]', () => {
    /*
     * Найдорожча помилка всього модуля, і жоден тип її не спіймає: обидва
     * числа — `number`. Переставлені місцями, вони ставлять вінницьку
     * кав'ярню посеред Індійського океану.
     *
     * Nominatim віддає їх РЯДКАМИ і в іншому порядку (`lat`, `lon`), тож
     * перетворення тут не формальне.
     */
    const f = featureFromPlace(place());
    expect(f?.center[0]).toBeCloseTo(28.4682, 4); // довгота
    expect(f?.center[1]).toBeCloseTo(49.2331, 4); // широта
  });

  it('контекст іде з тими префіксами, які чекає розбір місця', () => {
    // `momentPlace.placeFromFeature` шукає місто за `place.` і країну за
    // `country.`. Інші префікси дали б спогад без міста.
    const f = featureFromPlace(place());
    expect(f?.context?.find((c) => c.id.startsWith('place'))?.text).toBe('Вінниця');
    expect(f?.context?.find((c) => c.id.startsWith('country'))?.text).toBe('Україна');
  });

  it('населений пункт береться з того поля, яке заповнене', () => {
    /*
     * Nominatim кладе його за розміром: місто в `city`, містечко в `town`,
     * село в `village`, хутір у `hamlet`. Читати саме `city` означало б
     * порожнє місто на всю сільську місцевість.
     */
    const village = featureFromPlace(place({ address: { village: 'Погребище' } }));
    expect(village?.context?.[0]?.text).toBe('Погребище');
    const town = featureFromPlace(place({ address: { town: 'Гайсин' } }));
    expect(town?.context?.[0]?.text).toBe('Гайсин');
  });

  it('без власної назви бере вулицю, потім місто', () => {
    // У житлового будинку `name` немає взагалі — це найчастіший результат
    // зворотного геокоду по тапу на карті.
    const road = featureFromPlace(place({
      name: '',
      address: { road: 'вулиця Академіка Янгеля', house_number: '12', city: 'Вінниця' },
    }));
    expect(road?.text).toBe('вулиця Академіка Янгеля, 12');

    const town = featureFromPlace(place({ name: '', address: { city: 'Вінниця' } }));
    expect(town?.text).toBe('Вінниця');
  });

  it('порожнє місце відкидається, а не лягає безіменною міткою', () => {
    expect(featureFromPlace(place({ name: '', display_name: '', address: {} }))).toBeNull();
  });

  it('нечислові чи позаглобусні координати відкидаються', () => {
    // Рядок «—» замість числа Nominatim не віддає, але віддає порожній
    // об'єкт на помилці; NaN у центрі означав би мітку, яку карта не
    // покаже й не зможе прибрати.
    expect(featureFromPlace(place({ lat: 'нема' }))).toBeNull();
    expect(featureFromPlace(place({ lat: '120' }))).toBeNull();
    expect(featureFromPlace(place({ lon: '-999' }))).toBeNull();
  });
});

describe('зворотний геокод → результат', () => {
  it('адреса — вулиця з будинком', () => {
    const r = resultFromPlace(place({
      address: { road: 'вулиця Соборна', house_number: '7', city: 'Вінниця', country: 'Україна' },
    }));
    expect(r).toEqual({ address: 'вулиця Соборна, 7', city: 'Вінниця', country: 'Україна' });
  });

  it('без вулиці адресою стає власна назва', () => {
    const r = resultFromPlace(place({ address: { city: 'Львів', country: 'Україна' } }));
    expect(r.address).toBe('BeeCoffe');
    expect(r.city).toBe('Львів');
  });

  it('порожня відповідь дає порожні поля, а не «undefined» у підписі', () => {
    // Саме цей рядок пара побачила б у спогаді, якби Nominatim не
    // відповів: підпис місця будується з цих трьох полів напряму.
    expect(resultFromPlace(null)).toEqual({ address: '', city: '', country: '' });
  });
});

describe('маршрут до точки', () => {
  it('веде в застосунок карт телефона, а не всередину порталу', () => {
    // Портал пішов на OpenStreetMap, але «прокласти маршрут» лишається
    // передачею точки в те, чим людина вже користується.
    const url = directionsUrl(49.2331, 28.4682);
    expect(url).toContain('49.2331,28.4682');
    expect(url).toContain('destination=');
  });
});
