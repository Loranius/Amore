import { describe, expect, it } from 'vitest';
import {
  metresBetween,
  nearestPin,
  placeFromFeature,
  placeLabel,
  SAME_PLACE_METRES,
} from './momentPlace';
import type { GeoFeature } from '@/types';

describe('підпис місця', () => {
  it('назва й місто через кому — так, як просив власник', () => {
    // «📍 Тераса, Хмельницький» — рядок із концепту, дослівно.
    expect(placeLabel({ title: 'Тераса', city: 'Хмельницький' })).toBe('Тераса, Хмельницький');
  });

  it('не подвоює місто, коли мітка й названа містом', () => {
    // Геокодер часто віддає назву міста як назву місця, і без цієї гілки
    // пара читала б «Хмельницький, Хмельницький».
    expect(placeLabel({ title: 'Хмельницький', city: 'Хмельницький' })).toBe('Хмельницький');
  });

  it('без міста бере країну', () => {
    expect(placeLabel({ title: 'Карпати', city: null, country: 'Україна' }))
      .toBe('Карпати, Україна');
  });

  it('порожнє місце дає порожній рядок, а не «null»', () => {
    expect(placeLabel({ title: null, city: null, country: null })).toBe('');
    expect(placeLabel({ title: '   ' })).toBe('');
  });
});

describe('відстань між точками', () => {
  it('градус широти — приблизно 111 км', () => {
    const d = metresBetween({ lat: 49, lng: 27 }, { lat: 50, lng: 27 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });

  it('градус довготи в Україні коротший за градус широти', () => {
    /*
     * Регресія на косинус широти. Без нього довгота рахувалась би тими
     * самими 111 км, і дві мітки за 80 км одна від одної читались би як
     * одне місце в жодному разі — але, що гірше, допуск 120 м розтягувався
     * б у 1.5 раза по горизонталі.
     */
    const lng = metresBetween({ lat: 49, lng: 27 }, { lat: 49, lng: 28 });
    const lat = metresBetween({ lat: 49, lng: 27 }, { lat: 50, lng: 27 });
    expect(lng).toBeLessThan(lat * 0.7);
  });

  it('точка сама з собою — нуль', () => {
    expect(metresBetween({ lat: 49.42, lng: 26.98 }, { lat: 49.42, lng: 26.98 })).toBe(0);
  });
});

describe('пошук наявної мітки', () => {
  const pins = [
    { id: 1, title: 'Тераса', city: 'Хмельницький', country: 'Україна', lat: 49.4200, lng: 26.9800 },
    { id: 2, title: 'Парк', city: 'Хмельницький', country: 'Україна', lat: 49.4210, lng: 26.9805 },
    { id: 3, title: 'Львів', city: 'Львів', country: 'Україна', lat: 49.8397, lng: 24.0297 },
  ];

  it('та сама точка знаходить свою мітку', () => {
    expect(nearestPin(pins, { lat: 49.42, lng: 26.98 })?.id).toBe(1);
  });

  it('бере НАЙБЛИЖЧУ, а не першу в радіусі', () => {
    /*
     * У центрі міста в коло 120 м потрапляє кілька міток. Якби бралась
     * перша за порядком у базі, спогад прив'язувався б до випадкової
     * сусідньої — і пара побачила б «Тераса» там, де був парк.
     */
    expect(nearestPin(pins, { lat: 49.4209, lng: 26.9805 })?.id).toBe(2);
  });

  it('далеке місце не склеюється з наявним', () => {
    expect(nearestPin(pins, { lat: 50.45, lng: 30.52 })).toBeNull();
  });

  it('допуск справді 120 метрів, а не «десь близько»', () => {
    // Півкілометра на північ — це вже інше місце.
    const far = { lat: 49.42 + 500 / 111_320, lng: 26.98 };
    expect(nearestPin(pins, far)).toBeNull();
    const near = { lat: 49.42 + 60 / 111_320, lng: 26.98 };
    expect(nearestPin(pins, near)?.id).toBe(1);
    expect(SAME_PLACE_METRES).toBe(120);
  });

  it('мітка з пошкодженими координатами не валить пошук', () => {
    const broken = [{ id: 9, title: 'x', city: null, country: null, lat: NaN, lng: 0 }];
    expect(nearestPin(broken, { lat: 49, lng: 27 })).toBeNull();
  });

  it('порожній список — не виняток', () => {
    expect(nearestPin([], { lat: 49, lng: 27 })).toBeNull();
  });
});

describe('розбір відповіді геокодера', () => {
  const feature = (over: Partial<GeoFeature> = {}): GeoFeature => ({
    text: 'Тераса',
    center: [26.98, 49.42],
    context: [
      { id: 'place.123', text: 'Хмельницький' },
      { id: 'country.5', text: 'Україна' },
    ],
    ...over,
  });

  it('координати читаються в порядку GeoJSON: [довгота, широта]', () => {
    /*
     * Найчастіша помилка при роботі з GeoJSON, і найдорожча тут: переплутані
     * місцями числа поставили б хмельницьку терасу в Судан.
     */
    const place = placeFromFeature(feature());
    expect(place?.lat).toBeCloseTo(49.42, 5);
    expect(place?.lng).toBeCloseTo(26.98, 5);
  });

  it('місто й країна беруться з контексту', () => {
    const place = placeFromFeature(feature());
    expect(place?.city).toBe('Хмельницький');
    expect(place?.country).toBe('Україна');
  });

  it('місто, що дублює назву, не зберігається вдруге', () => {
    const place = placeFromFeature(feature({ text: 'Хмельницький' }));
    expect(place?.city).toBeNull();
    // Місто випало — хвостом стає країна, і повтору немає.
    expect(placeLabel(place!)).toBe('Хмельницький, Україна');
  });

  it('без назви бере перший сегмент повного підпису', () => {
    const place = placeFromFeature(feature({ text: '', place_name: 'Кав’ярня, Хмельницький' }));
    expect(place?.title).toBe('Кав’ярня');
  });

  it('фіча без координат відкидається, а не дає NaN у базі', () => {
    expect(placeFromFeature({ center: [NaN, 49] } as unknown as GeoFeature)).toBeNull();
    expect(placeFromFeature({ text: 'x' } as unknown as GeoFeature)).toBeNull();
  });

  it('координати поза глобусом відкидаються', () => {
    expect(placeFromFeature(feature({ center: [26.98, 120] }))).toBeNull();
  });
});
