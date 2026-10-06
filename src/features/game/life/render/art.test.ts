import { describe, expect, it } from 'vitest';
import { cellarMap } from '../world/cellar';
import { homeInterior } from '../world/interior';
import { summerKitchenMap } from '../world/kitchen';
import { cityMap, homeYard } from '../world/maps';
import { newLife } from '../sim/life';
import { artFor, artFromSearch, hasArt2d } from './art';
import { drawProp2d } from './v2d/props';

/** Полотно-заглушка: приймає будь-який виклик, градієнти теж. */
function fakeCtx(): CanvasRenderingContext2D {
  const grad = { addColorStop: () => undefined };
  return new Proxy({}, {
    get: (_t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => grad : () => undefined),
    set: () => true,
  }) as unknown as CanvasRenderingContext2D;
}

describe('2D-стиль — тестовий, лише в садибі (власник, 2026-10-06: «почни з подвір\'я Лєни… створи спочатку тестовий варіант»)', () => {
  const estate = [homeYard(), homeInterior({ ...newLife(1, 'sadok'), home: 'zhylyntsi' }), summerKitchenMap(), cellarMap()];

  it('вмикається адресою ?art=2d і вимикається ?art=pixel; інші значення не зчитуються', () => {
    expect(artFromSearch('?art=2d')).toBe('2d');
    expect(artFromSearch('?art=pixel')).toBe('pixel');
    expect(artFromSearch('?art=3d')).toBeNull();
    expect(artFromSearch('')).toBeNull();
  });

  it('діє на подвір\'ї, в хаті, літній кухні й погребі — і ніде більше', () => {
    for (const m of estate) {
      expect(hasArt2d(m.id), m.id).toBe(true);
      expect(artFor('2d', m.id)).toBe('2d');
      expect(artFor('pixel', m.id)).toBe('pixel');
    }
    expect(artFor('2d', cityMap('zhylyntsi').id)).toBe('pixel');
    expect(artFor('2d', cityMap('vinnytsia').id)).toBe('pixel');
  });

  it('кожен предмет садиби намальовано у 2D — без піксельних латок', () => {
    const s = newLife(1, 'adult');
    const full = homeInterior({ ...s, home: 'zhylyntsi', owned: [...s.owned, 'laptop'], decor: { ...s.decor, rug: 'rugPink', plant: 'plant', lamp: 'lamp', shelf: 'shelf', tv: 'tv', desk: 'desk', sofa: 'sofa', poster: 'poster', pet: 'kitten' } as typeof s.decor });
    const g = fakeCtx();
    for (const m of [...estate, full]) {
      for (const p of m.props) expect(drawProp2d(g, p, 'summer', 0), `${m.id}: ${p.type}`).toBe(true);
    }
  });
});
