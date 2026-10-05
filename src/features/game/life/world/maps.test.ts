import { describe, expect, it } from 'vitest';
import { CITY_SHOPS, JOBS, SIGHTS } from '../sim/content';
import { newLife } from '../sim/life';
import { reachableTiles, zoneTiles } from './collide';
import { homeInterior } from './interior';
import { ALL_CITY_IDS, cityMap, homeYard } from './maps';
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

describe('садиба Лєни в Жилинцях (власник, 2026-10-06, план від руки)', () => {
  it('подвір\'я: усе досяжне від хвіртки; у селі «Рідна хата» веде на подвір\'я', () => {
    const yard = homeYard();
    assertReachable(yard);
    expect(cityMap('zhylyntsi').zones.find((z) => z.id === 'home')?.action.type).toBe('yard');
    expect(yard.zones.some((z) => z.action.type === 'village')).toBe(true);
    expect(yard.zones.some((z) => z.action.type === 'home')).toBe(true);
  });

  it('розташування за планом: хлів, хлів, курник позаду хати; город за ними; майстерня над кухнею; сад за кухнею', () => {
    const yard = homeYard();
    const b = (id: string) => yard.buildings.find((x) => x.id === id)!;
    const back = ['barn1', 'barn2', 'coop'].map(b);
    // Зліва направо: хлів → хлів → курник.
    expect(back.map((x) => x.style)).toEqual(['barn', 'barn', 'coop']);
    for (let i = 1; i < back.length; i += 1) expect(back[i]!.x).toBeGreaterThan(back[i - 1]!.x);
    // Хата — Г-подібна з кількох об'ємів, двері — одні; позаду неї господарські будівлі.
    const house = yard.buildings.filter((x) => x.id.startsWith('house-'));
    expect(house.length).toBeGreaterThanOrEqual(4);
    expect(house.filter((x) => x.door !== false)).toHaveLength(1);
    const houseTop = Math.min(...house.map((x) => x.y));
    for (const x of back) expect(x.y + x.h).toBeLessThanOrEqual(houseTop);
    // Город — над господарськими будівлями (грядки 'v').
    const gardenRows = yard.ground.map((row, j) => (row.includes('v') ? j : -1)).filter((j) => j >= 0);
    expect(Math.max(...gardenRows)).toBeLessThan(Math.min(...back.map((x) => x.y)));
    // Майстерня над літньою кухнею, одна будівля; праворуч від хати; вхід кухні знизу.
    const shop = b('workshop');
    const kitchen = b('summerKitchen');
    expect(shop.x).toBe(kitchen.x);
    expect(shop.y + shop.h).toBe(kitchen.y);
    expect(kitchen.x).toBeGreaterThan(Math.max(...house.map((x) => x.x + x.w)));
    expect(yard.zones.some((z) => z.y === kitchen.y + kitchen.h && z.action.type === 'activity')).toBe(true);
    // Сад — праворуч за літньою кухнею.
    const orchard = yard.trees.filter((t) => t.x > kitchen.x + kitchen.w && t.y <= 30);
    expect(orchard.length).toBeGreaterThanOrEqual(8);
    expect(orchard.every((t) => t.kind === 'apple' || t.kind === 'cherry')).toBe(true);
    // Хвіртка — внизу, до села.
    const gate = yard.zones.find((z) => z.action.type === 'village')!;
    expect(gate.y).toBeGreaterThanOrEqual(yard.h - 3);
  });

  it('хата всередині: кімнати за планом, зʼєднані дверима; кухня з піччю внизу ліворуч', () => {
    const s = newLife(1, 'sadok');
    const hata = homeInterior({ ...s, home: 'zhylyntsi' });
    assertReachable(hata);
    // Від ліжка Лєни досяжні всі кімнати: їхні точки підлоги.
    const reach = reachableTiles(hata, hata.spawns.wake!);
    for (const [name, x, y] of [['ліве крило', 3, 10], ['над коридором', 10, 6], ['коридор', 11, 13], ['сіни', 20, 13], ['кухня', 6, 19], ['Лєнина кімната', 22, 8]] as const) {
      expect(reach.has(`${x},${y}`), name).toBe(true);
    }
    const stove = hata.props.find((p) => p.type === 'stove')!;
    expect(stove.x).toBeLessThan(4);
    expect(stove.y).toBeGreaterThan(15);
  });
});
