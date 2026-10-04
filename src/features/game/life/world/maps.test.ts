import { describe, expect, it } from 'vitest';
import { CITY_SHOPS, JOBS, SIGHTS } from '../sim/content';
import { newLife } from '../sim/life';
import { reachableTiles, zoneTiles } from './collide';
import { homeInterior } from './interior';
import { ALL_CITY_IDS, cityMap } from './maps';
import type { GameMap } from './types';

// ============================================================
// Мапи «Дєвочка в городі» (ADR-0239 §3): усе, що можна зробити в місті,
// досяжне пішки, і кожна річ із правил має своє місце на мапі.
// ============================================================

function assertReachable(map: GameMap) {
  const start = map.spawns.default!;
  const reach = reachableTiles(map, start);
  expect(reach.size, `${map.id}: старт у стіні`).toBeGreaterThan(0);
  for (const [name, s] of Object.entries(map.spawns)) {
    expect(reach.has(`${s.x},${s.y}`), `${map.id}: точка появи «${name}» недосяжна`).toBe(true);
  }
  for (const z of map.zones) {
    expect(zoneTiles(z).some((t) => reach.has(t)), `${map.id}: зона «${z.label}» недосяжна`).toBe(true);
  }
}

describe('міста', () => {
  it.each(ALL_CITY_IDS)('%s: кожна точка появи й кожна зона досяжні від станції', (city) => {
    assertReachable(cityMap(city));
  });

  it.each(ALL_CITY_IDS)('%s: кожна крамниця міста з правил має двері на мапі', (city) => {
    const shops = new Set(cityMap(city).zones.flatMap((z) => (z.action.type === 'shop' ? [z.action.shop] : [])));
    for (const shop of CITY_SHOPS[city]) expect(shops.has(shop), `${city}: немає крамниці ${shop}`).toBe(true);
  });

  it('кожна робота й кожна пам\'ятка має місце у своєму місті; у кожному місті є дорога', () => {
    for (const job of JOBS) {
      expect(cityMap(job.city).zones.some((z) => z.action.type === 'workplace' && z.action.job === job.id), job.id).toBe(true);
    }
    for (const sight of SIGHTS) {
      expect(cityMap(sight.city).zones.some((z) => (z.action.type === 'sight' && z.action.sight === sight.id) || (sight.id === 'yellowStone' && z.action.type === 'stone')), sight.id).toBe(true);
    }
    for (const city of ALL_CITY_IDS) {
      expect(cityMap(city).zones.some((z) => z.action.type === 'station' || z.action.type === 'walk'), city).toBe(true);
    }
  });

  it('усі мапи прямокутні й заповнені', () => {
    for (const city of ALL_CITY_IDS) {
      const m = cityMap(city);
      expect(m.ground).toHaveLength(m.h);
      for (const row of m.ground) expect(row).toHaveLength(m.w);
    }
  });
});

describe('дім', () => {
  it.each(['sadok', 'uni', 'adult'] as const)('%s: ліжко, шафа й двері досяжні, навіть із усіма покупками', (chapter) => {
    const s = newLife(1, chapter);
    const full = { ...s, decor: { rug: 'rugPink', plant: 'plant', lamp: 'lamp', poster: 'poster', shelf: 'shelf', tv: 'tv', pet: 'kitten', table: 'table', bed: 'bedQueen' } };
    assertReachable(homeInterior(full));
    assertReachable(homeInterior(s));
  });
});
