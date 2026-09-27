import { describe, expect, it } from 'vitest';
import { MAP_VEIL_FILL, mapVeilChanges } from './mapVeil';

// ВИМОГА ВЛАСНИКА (ADR-0216): мапа спогадів просвічується світом, як модулі.

describe('карта-вуаль', () => {
  const layers = [
    { id: 'background', type: 'background' },
    { id: 'water', type: 'fill' },
    { id: 'residential', type: 'fill', paint: { 'fill-opacity': 0.4 } },
    { id: 'wood', type: 'fill', paint: { 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0, 13, 0.4] } },
    { id: 'road', type: 'line' },
    { id: 'place-label', type: 'symbol' },
  ];
  const changes = mapVeilChanges(layers);
  const byId = new Map(changes.map((change) => [change.id, change]));

  it('тло зникає зовсім: суша без заливки — вікно у світ', () => {
    expect(byId.get('background')).toEqual({ id: 'background', property: 'background-opacity', value: 0 });
  });

  it('заливки напівпрозорі, але не прозоріші, ніж були', () => {
    expect(byId.get('water')?.value).toBe(MAP_VEIL_FILL);
    expect(byId.get('residential')?.value).toBe(0.4);
  });

  it('вираз масштабу лишається як є — MapLibre не дозволяє його множити', () => {
    expect(byId.has('wood')).toBe(false);
  });

  it('дороги й підписи не чіпаються: за ними пара шукає місце', () => {
    expect(byId.has('road')).toBe(false);
    expect(byId.has('place-label')).toBe(false);
  });
});
