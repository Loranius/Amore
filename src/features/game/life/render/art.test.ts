import { describe, expect, it } from 'vitest';
import { cellarMap } from '../world/cellar';
import { homeInterior } from '../world/interior';
import { summerKitchenMap } from '../world/kitchen';
import { cityMap, homeYard } from '../world/maps';
import { newLife } from '../sim/life';
import { artFor, artFromSearch, hasHd } from './art';

describe('32×32 — тестовий, лише в садибі (власник, 2026-10-06: «більш деталізований піксельний варіант гри 32х32»)', () => {
  const estate = [homeYard(), homeInterior({ ...newLife(1, 'sadok'), home: 'zhylyntsi' }), summerKitchenMap(), cellarMap()];

  it('вмикається адресою ?art=hd і вимикається ?art=pixel; інші значення не зчитуються', () => {
    expect(artFromSearch('?art=hd')).toBe('hd');
    expect(artFromSearch('?art=pixel')).toBe('pixel');
    expect(artFromSearch('?art=2d')).toBeNull();
    expect(artFromSearch('')).toBeNull();
  });

  it('діє на подвір\'ї, в хаті, літній кухні й погребі — і ніде більше', () => {
    for (const m of estate) {
      expect(hasHd(m.id), m.id).toBe(true);
      expect(artFor('hd', m.id)).toBe('hd');
      expect(artFor('pixel', m.id)).toBe('pixel');
    }
    expect(artFor('hd', cityMap('zhylyntsi').id)).toBe('pixel');
    expect(artFor('hd', cityMap('vinnytsia').id)).toBe('pixel');
  });
});
