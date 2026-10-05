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
    // Хата — два крила впритул (план власника, 16:44): ліве виступає вперед,
    // праве з котельнею — позаду. Частини прилягають без краю (`join`), димар один.
    const house = yard.buildings.filter((x) => x.label === 'Хата').sort((a, b) => a.x - b.x);
    expect(house).toHaveLength(2);
    const [left, right] = house as [(typeof house)[number], (typeof house)[number]];
    expect(left.x + left.w).toBe(right.x);
    expect([left.join, right.join]).toEqual(['right', 'left']);
    expect(house.filter((x) => x.chimney !== false)).toHaveLength(1);
    expect(left.y + left.h).toBeGreaterThan(right.y + right.h);
    // Вхід — збоку, у правій стіні правого крила; дверей у фасаді немає.
    expect(right.sideDoor).toBe(true);
    expect(house.every((x) => x.door === false)).toBe(true);
    const homeZone = yard.zones.find((z) => z.action.type === 'home')!;
    expect(homeZone.x).toBe(right.x + right.w);
    expect(homeZone.y).toBeGreaterThanOrEqual(right.y);
    expect(homeZone.y + homeZone.h).toBeLessThanOrEqual(right.y + right.h);
    const houseTop = Math.min(left.y, right.y);
    for (const x of back) expect(x.y + x.h).toBeLessThanOrEqual(houseTop);
    // Перед заглибленим правим крилом — двір, а не стіна.
    expect(colliderFor(yard).canStand((right.x + 3) * TILE + 8, (right.y + right.h) * TILE + 8)).toBe(true);
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
    expect(kitchen.x).toBeGreaterThan(right.x + right.w);
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

  it('подвір\'я за планом власника: туалет, січкарня, літній душ, котельня з окремим входом, курник відчиняється у вигул', () => {
    const yard = homeYard();
    const b = (id: string) => yard.buildings.find((x) => x.id === id)!;
    for (const id of ['toilet', 'sichkarnia', 'shower']) expect(b(id), id).toBeDefined();
    // Туалет — лівіше за хліви, січкарня — правіше за курник; душ — у саду.
    expect(b('toilet').x).toBeLessThan(b('barn1').x);
    expect(b('sichkarnia').x).toBeGreaterThan(b('coop').x);
    const orchard = yard.zones.find((z) => z.id === 'orchard')!;
    expect(b('shower').x).toBeGreaterThan(orchard.x);
    // Курник — двері збоку, у вигул.
    expect(b('coop').sideDoor).toBe(true);
    expect(b('coop').door).toBe(false);
    // Котельня — окремий вхід праворуч від хати, вище за головний.
    const house = b('house-right');
    const boiler = yard.zones.find((z) => z.id === 'boiler')!;
    const home = yard.zones.find((z) => z.action.type === 'home')!;
    expect(boiler.x).toBe(house.x + house.w);
    expect(boiler.y).toBeLessThan(home.y);
    // Майстерня — вхід згори; погріб — знизу, під кухнею.
    const shop = b('workshop');
    expect(yard.zones.find((z) => z.id === 'workshop')!.y).toBe(shop.y - 1);
    const kitchen = b('summerKitchen');
    expect(yard.zones.find((z) => z.id === 'cellar')!.y).toBeGreaterThan(kitchen.y + kitchen.h);
    // Дерева саду не стоять на верстаку й душі.
    const blocked = [{ x: 30, y: 16, w: 2, h: 3 }, b('shower')];
    for (const t of yard.trees) for (const r of blocked) expect(t.x >= r.x && t.x < r.x + r.w && t.y >= r.y && t.y < r.y + r.h, `${t.x},${t.y}`).toBe(false);
  });

  it('хата всередині — за ескізом власника: мама над Лєною зліва, брати праворуч від мами, коридорчик між ними й Лєною, веранда справа зі входом, кімната над верандою', () => {
    const hata = homeInterior({ ...newLife(1, 'sadok'), home: 'zhylyntsi' });
    assertReachable(hata);
    const reach = reachableTiles(hata, hata.spawns.door!);
    const rooms = { веранда: [19, 10], надВерандою: [17, 4], коридор: [9, 10], брати: [9, 4], мама: [3, 6], Лєна: [5, 19] } as const;
    for (const [name, [x, y]] of Object.entries(rooms)) expect(reach.has(`${x},${y}`), name).toBe(true);
    const g = (x: number, y: number) => hata.ground[y]![x];
    // Мама — над кімнатою Лєни, у лівому верхньому куті: між ними лише стіна Лєниної кімнати.
    expect([g(3, 11), g(3, 12), g(3, 15)]).toEqual(['f', 'W', 'f']);
    // Брати — праворуч від мами, угорі; коридорчик — під братами й над Лєною.
    expect(rooms.брати[0]).toBeGreaterThan(rooms.мама[0]);
    expect(rooms.коридор[1]).toBeGreaterThan(rooms.брати[1]);
    expect(rooms.коридор[1]).toBeLessThan(rooms.Лєна[1]);
    // Коридорчик зв'язує всі три кімнати: двері до мами, братів і Лєни виходять у нього.
    expect([g(7, 8), g(11, 7), g(13, 12)]).toEqual(['f', 'f', 'f']);
    // Веранда праворуч від коридорчика, кімната — над верандою; вхід — у правій стіні веранди.
    expect(g(15, 8)).toBe('f');
    expect(g(20, 6)).toBe('f');
    const exit = hata.zones.find((z) => z.action.type === 'exit')!;
    expect(exit.x + exit.w).toBe(hata.w);
    expect(exit.y).toBeGreaterThanOrEqual(6);
    expect(exit.y).toBeLessThan(12);
    // Кімната Лєни — та сама рамка 16×12: облаштування переноситься без змін.
    expect(hata.spawns.wake!.y).toBeGreaterThan(14);
    // Вікна — лише на зовнішніх стінах: задня стіна Лєниної кімнати внутрішня.
    const lenaWall = hata.props.filter((p) => p.type === 'window' && p.y >= 12 && p.y < 15);
    expect(lenaWall).toHaveLength(0);
    const stove = hata.props.find((p) => p.type === 'stove')!;
    expect(stove.x).toBeGreaterThan(15);
    expect(stove.y).toBeLessThan(6);
    // Брати живуть удома, поки Лєна в садочку й школі; у ВДПУ — роз'їхались.
    const brotherBeds = (m: typeof hata) => m.props.filter((p) => p.type === 'bed' && p.x > 7 && p.x < 15 && p.y < 6);
    expect(brotherBeds(hata)).toHaveLength(2);
    expect(brotherBeds(homeInterior({ ...newLife(1, 'uni'), home: 'zhylyntsi' }))).toHaveLength(1);
  });

  it('меблі в домі — у масштабі людей, як надворі (власник, 2026-10-05: «у будинку все занадто дрібне»)', () => {
    const hata = homeInterior({ ...newLife(1, 'sadok'), home: 'zhylyntsi' });
    const bed = hata.props.find((p) => p.type === 'bed')!;
    expect(bed.scale).toBe(1.25);
    // Стінне (вікна, фото) й надвірне не збільшується.
    expect(hata.props.filter((p) => p.type === 'window' || p.type === 'photo').every((p) => p.scale === undefined)).toBe(true);
    expect(homeYard().props.every((p) => p.scale === undefined)).toBe(true);
  });

  it('у хаті будь-які куплені меблі на типових місцях не перекривають дверей до кімнати Лєни', () => {
    const s = newLife(1, 'adult');
    const all = { rug: 'rugPink', plant: 'plant', lamp: 'lamp', shelf: 'shelf', tv: 'tv', desk: 'desk', sofa: 'sofa', poster: 'poster', pet: 'kitten' };
    const hata = homeInterior({ ...s, home: 'zhylyntsi', decor: { ...s.decor, ...all } as typeof s.decor });
    assertReachable(hata);
  });
});
