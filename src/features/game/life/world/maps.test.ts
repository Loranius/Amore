import { describe, expect, it } from 'vitest';
import { CITY_SHOPS, JOBS, SIGHTS } from '../sim/content';
import { newLife } from '../sim/life';
import { colliderFor, reachableTiles, zoneTiles } from './collide';
import { homeInterior } from './interior';
import { ALL_CITY_IDS, cityMap, homeYard } from './maps';
import { TILE, buildingParts, type GameMap } from './types';

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
    // Хата — одна суцільна Г-подібна споруда (власник: «одна локація»), двері одні.
    const house = yard.buildings.filter((x) => x.label === 'Хата');
    expect(house).toHaveLength(1);
    expect(house[0]!.notch).toBeDefined();
    // Вхід — збоку, у правій стіні; зона «У хату» — одразу праворуч від хати.
    expect(house[0]!.sideDoor).toBe(true);
    const homeZone = yard.zones.find((z) => z.action.type === 'home')!;
    expect(homeZone.x).toBe(house[0]!.x + house[0]!.w);
    expect(homeZone.y + homeZone.h).toBe(house[0]!.y + house[0]!.h);
    const houseTop = house[0]!.y;
    for (const x of back) expect(x.y + x.h).toBeLessThanOrEqual(houseTop);
    // У кутку «Г» можна стати — це двір, а не стіна.
    const n = house[0]!.notch!;
    const nx = n.side === 'right' ? house[0]!.x + house[0]!.w - Math.ceil(n.w / 2) : house[0]!.x + Math.floor(n.w / 2);
    expect(colliderFor(yard).canStand(nx * TILE + 8, (house[0]!.y + 1) * TILE + 8)).toBe(true);
    // Город — над господарськими будівлями (грядки 'v').
    const gardenRows = yard.ground.map((row, j) => (row.includes('v') ? j : -1)).filter((j) => j >= 0);
    expect(Math.max(...gardenRows)).toBeLessThan(Math.min(...back.map((x) => x.y)));
    // Майстерня над літньою кухнею; кухня праворуч від хати; прибудова ліворуч —
    // частина кухні, вхід у кухню з верхнього боку прибудови.
    const shop = b('workshop');
    const kitchen = b('summerKitchen');
    const [kTall, kAnnex] = buildingParts(kitchen);
    expect(kitchen.notch?.side).toBe('left');
    expect(shop.x).toBe(kTall!.x);
    expect(shop.y + shop.h).toBe(kTall!.y);
    expect(kitchen.x).toBeGreaterThan(house[0]!.x + house[0]!.w);
    expect(kAnnex!.x).toBeLessThan(kTall!.x);
    const entry = yard.zones.find((z) => z.id === 'summerKitchen')!;
    expect(entry.y).toBe(kAnnex!.y - 1);
    expect(entry.x).toBeGreaterThanOrEqual(kAnnex!.x);
    expect(entry.x + entry.w).toBeLessThanOrEqual(kAnnex!.x + kAnnex!.w);
    // Сад — праворуч за літньою кухнею.
    const orchard = yard.trees.filter((t) => t.x > kitchen.x + kitchen.w && t.y <= 30);
    expect(orchard.length).toBeGreaterThanOrEqual(8);
    expect(orchard.every((t) => t.kind === 'apple' || t.kind === 'cherry')).toBe(true);
    // Хвіртка — внизу, до села.
    const gate = yard.zones.find((z) => z.action.type === 'village')!;
    expect(gate.y).toBeGreaterThanOrEqual(yard.h - 3);
  });

  it('хата всередині: вхід справа у веранду, кухня над нею; коридорчик зв\'язує братів (угорі), маму (ліворуч), Лєну (внизу); кімнати впритул', () => {
    const s = newLife(1, 'sadok');
    const hata = homeInterior({ ...s, home: 'zhylyntsi' });
    assertReachable(hata);
    const reach = reachableTiles(hata, hata.spawns.door!);
    const rooms = { веранда: [19, 9], кухня: [16, 4], коридор: [9, 9], брати: [9, 4], мама: [3, 12], Лєна: [12, 17] } as const;
    for (const [name, [x, y]] of Object.entries(rooms)) expect(reach.has(`${x},${y}`), name).toBe(true);
    expect(rooms.кухня[1]).toBeLessThan(rooms.веранда[1]);
    expect(rooms.коридор[0]).toBeLessThan(rooms.веранда[0]);
    expect(rooms.брати[1]).toBeLessThan(rooms.коридор[1]);
    expect(rooms.мама[0]).toBeLessThan(rooms.коридор[0]);
    expect(rooms.Лєна[1]).toBeGreaterThan(rooms.коридор[1]);
    // Вихід — у правій стіні веранди, а не знизу.
    const exit = hata.zones.find((z) => z.action.type === 'exit')!;
    expect(exit.x + exit.w).toBe(hata.w);
    expect(exit.y).toBeLessThan(rooms.Лєна[1]);
    // Кімната мами — одразу за лівою стіною Лєниної: між ними одна стіна.
    const g = (x: number, y: number) => hata.ground[y]![x];
    expect([g(6, 15), g(7, 15), g(8, 15)]).toEqual(['f', 'x', 'f']);
    // Коридорчик короткий.
    expect(hata.ground[9]!.slice(8, 14).every((t) => t === 'f')).toBe(true);
    expect(hata.ground[10]![7]).toBe('x');
    const stove = hata.props.find((p) => p.type === 'stove')!;
    expect(stove.x).toBeGreaterThan(14);
    expect(stove.y).toBeLessThan(6);
    // Брати живуть удома, поки Лєна в садочку й школі; у ВДПУ — роз'їхались.
    const brotherBeds = (m: typeof hata) => m.props.filter((p) => p.type === 'bed' && p.x > 7 && p.x < 14 && p.y < 6);
    expect(brotherBeds(hata)).toHaveLength(2);
    expect(brotherBeds(homeInterior({ ...newLife(1, 'uni'), home: 'zhylyntsi' }))).toHaveLength(1);
  });
});
