import { describe, expect, it } from 'vitest';
import { boundsOf, openingView, SINGLE_PLACE_ZOOM, WORLD_VIEW } from './mapView';

const vinnytsia = { lat: 49.2331, lng: 28.4682 };
const lviv = { lat: 49.8397, lng: 24.0297 };
const odesa = { lat: 46.4825, lng: 30.7233 };

describe('межі для набору місць', () => {
  it('вміщають усі точки', () => {
    const b = boundsOf([vinnytsia, lviv, odesa])!;
    const [[west, south], [east, north]] = b;
    expect(west).toBeCloseTo(24.0297, 4);
    expect(east).toBeCloseTo(30.7233, 4);
    expect(south).toBeCloseTo(46.4825, 4);
    expect(north).toBeCloseTo(49.8397, 4);
  });

  it('порядок кутів такий, якого чекає карта', () => {
    // [[захід, південь], [схід, північ]]. Переставлені місцями кути дають
    // від'ємну рамку, і карта або кидає виняток, або летить у нікуди.
    const [[west, south], [east, north]] = boundsOf([lviv, odesa])!;
    expect(west).toBeLessThan(east);
    expect(south).toBeLessThan(north);
  });

  it('одна точка НЕ дає меж', () => {
    /*
     * Найтонше місце модуля. Межі з однієї точки вироджені — нульові
     * ширина й висота, — і будь-яка бібліотека карт на них дає або
     * нескінченне наближення, або NaN у масштабі. Для одного місця є
     * окремий шлях із власним зумом.
     */
    expect(boundsOf([vinnytsia])).toBeNull();
  });

  it('кілька точок в одному місці — теж вироджена рамка', () => {
    // Та сама кав'ярня, збережена тричі. Точок три, а прямокутник той
    // самий нульовий, що й від однієї.
    expect(boundsOf([vinnytsia, { ...vinnytsia }, { ...vinnytsia }])).toBeNull();
  });

  it('порожній список не дає меж', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('пошкоджена координата не розтягує рамку на глобус', () => {
    /*
     * Одна мітка з NaN чи з широтою 999 розсунула б межі так, що всі
     * справжні місця злилися б в одну точку. Такі відкидаються мовчки —
     * карта не місце для повідомлень про биті дані.
     */
    const b = boundsOf([vinnytsia, lviv, { lat: Number.NaN, lng: 0 }, { lat: 999, lng: 0 }])!;
    expect(b[0][1]).toBeCloseTo(49.2331, 4);
    expect(b[1][1]).toBeCloseTo(49.8397, 4);
  });

  it('після відкидання битих лишається одна точка — меж немає', () => {
    expect(boundsOf([vinnytsia, { lat: 999, lng: 999 }])).toBeNull();
  });
});

describe('початковий вигляд', () => {
  it('кілька місць — вміщаємо всі', () => {
    const view = openingView([vinnytsia, lviv]);
    expect(view.kind).toBe('fit');
  });

  it('одне місце — летимо до нього з масштабом кварталу', () => {
    const view = openingView([vinnytsia]);
    expect(view).toEqual({
      kind: 'point',
      lng: vinnytsia.lng,
      lat: vinnytsia.lat,
      zoom: SINGLE_PLACE_ZOOM,
    });
  });

  it('жодного місця — материк, а не нульовий меридіан', () => {
    /*
     * Точка (0, 0) — це Гвінейська затока. Карта, що відкривається сірим
     * океаном, читається як зламана; пара має побачити сушу й зрозуміти,
     * що карту просто треба посунути.
     */
    const view = openingView([]);
    expect(view).toEqual({
      kind: 'point',
      lng: WORLD_VIEW.lng,
      lat: WORLD_VIEW.lat,
      zoom: WORLD_VIEW.zoom,
    });
  });

  it('єдина вціліла точка серед битих — летимо до неї', () => {
    const view = openingView([{ lat: Number.NaN, lng: 5 }, vinnytsia]);
    expect(view.kind).toBe('point');
    if (view.kind === 'point') expect(view.lat).toBeCloseTo(49.2331, 4);
  });
});
