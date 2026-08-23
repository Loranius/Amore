import { describe, expect, it } from 'vitest';
import {
  cityFromPlace,
  dedupeCities,
  directionsUrl,
  featureFromPlace,
  matchesQuery,
  regionFromState,
  resultFromPlace,
  type NominatimPlace,
} from './geo';

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

// ============================================================
// Місто для «Куди піти».
// ------------------------------------------------------------
// Ці три функції існують заради однієї вади: область і місто в модалці
// вибору були двома незалежними полями, і зберегти «Львів» у
// «Вінницькій області» можна було без жодного заперечення. Тепер
// область приїжджає з відповіді геокодера — а отже, розбір цієї
// відповіді має бути перевірений, бо помилка тут не падає, а мовчки
// ставить пару в чужу область.
// ============================================================

describe('область Nominatim → область словника порталу', () => {
  it('скорочує «Вінницька область» до форми зі списку OBLASTS', () => {
    /*
     * Це і є вся суть функції. `OBLASTS` тримає «Вінницька», Nominatim
     * віддає «Вінницька область» — і якби різниця лишилась, `<select>`
     * не показував би нічого обраного, а events-finder отримував би
     * рядок, якого не чекає.
     */
    expect(regionFromState('Вінницька область')).toBe('Вінницька');
    expect(regionFromState('Львівська область')).toBe('Львівська');
  });

  it('розуміє скорочення «обл.» і зайві пробіли', () => {
    expect(regionFromState('  Одеська обл. ')).toBe('Одеська');
    expect(regionFromState('Київська обл')).toBe('Київська');
  });

  it('три міста зі спеціальним статусом приходять без слова «область»', () => {
    // Nominatim віддає просто «Київ», а список порталу знає «м. Київ».
    // Без цих трьох рядків столиця зберігалась би областю на ім'я «Київ».
    expect(regionFromState('Київ')).toBe('м. Київ');
    expect(regionFromState('Севастополь')).toBe('м. Севастополь');
    expect(regionFromState('Автономна Республіка Крим')).toBe('АР Крим');
  });

  it('порожнє лишається порожнім, а не перетворюється на першу область', () => {
    // Саме цим і був старий дефолт `OBLASTS[0]`: «Вінницька» стояла у
    // формі як відповідь, якої пара не давала.
    expect(regionFromState(undefined)).toBe('');
    expect(regionFromState('   ')).toBe('');
  });
});

describe('місце Nominatim → населений пункт', () => {
  it('бере місто з адреси разом зі скороченою областю', () => {
    expect(cityFromPlace(place({
      address: { city: 'Вінниця', state: 'Вінницька область', country: 'Україна' },
    }))).toEqual({ city: 'Вінниця', region: 'Вінницька' });
  });

  it('село й містечко теж є містом: Nominatim кладе їх в інші поля', () => {
    expect(cityFromPlace({
      lat: '49.32', lon: '28.45',
      address: { village: 'Стрижавка', state: 'Вінницька область' },
    })).toEqual({ city: 'Стрижавка', region: 'Вінницька' });
  });

  it('без назви населеного пункту повертає null, а не порожній рядок', () => {
    // Порожній рядок став би в списку підказкою, яка нікуди не веде.
    expect(cityFromPlace({ lat: '49.32', lon: '28.45', address: { country: 'Україна' } })).toBeNull();
  });

  it('відсутня область не заважає зберегти місто', () => {
    expect(cityFromPlace(place({ address: { city: 'Вінниця' } })))
      .toEqual({ city: 'Вінниця', region: '' });
  });
});

describe('повтори в списку підказок', () => {
  it('та сама пара «місто + область» лишається одна', () => {
    /*
     * Nominatim на запит «Вінниця» легко віддає її містом, громадою й
     * районом. У списку це три однакові рядки, з яких пара обирає
     * навмання, і це саме та підказка, що не підказує.
     */
    const found = dedupeCities([
      { city: 'Вінниця', region: 'Вінницька' },
      { city: 'Вінниця', region: 'Вінницька' },
      { city: 'Вінниця', region: 'Хмельницька' },
    ]);
    expect(found).toEqual([
      { city: 'Вінниця', region: 'Вінницька' },
      { city: 'Вінниця', region: 'Хмельницька' },
    ]);
  });

  it('порядок відповіді зберігається: перший збіг Nominatim — найточніший', () => {
    const found = dedupeCities([
      { city: 'Київ', region: 'м. Київ' },
      { city: 'Львів', region: 'Львівська' },
    ]);
    expect(found.map((c) => c.city)).toEqual(['Київ', 'Львів']);
  });
});

describe('підказка мусить стосуватись набраного', () => {
  it('відкидає збіг, у назві якого набраного немає', () => {
    /*
     * Виміряно живим запитом «Львів» до Nominatim: серед чотирьох
     * відповідей була «Семисотське сільське поселення» (АР Крим) — там
     * усередині є хутір із такою назвою. Такий рядок у списку питає про
     * місто, якого пара не писала.
     */
    expect(matchesQuery({ city: 'Семисотське сільське поселення', region: 'АР Крим' }, 'Львів')).toBe(false);
    expect(matchesQuery({ city: 'Львів', region: 'Миколаївська' }, 'Львів')).toBe(true);
  });

  it('часткова назва теж збіг: «Кам» лишає «Кам’янець-Подільський»', () => {
    expect(matchesQuery({ city: 'Кам’янець-Подільський', region: 'Хмельницька' }, 'кам')).toBe(true);
  });

  it('порожній запит нічого не відкидає', () => {
    expect(matchesQuery({ city: 'Вінниця', region: 'Вінницька' }, '  ')).toBe(true);
  });
});
