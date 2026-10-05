import { describe, expect, it } from 'vitest';
import { CITY_SHOPS, JOBS, SIGHTS } from '../sim/content';
import { ROOM_FLOOR } from '../sim/economy';
import { newLife } from '../sim/life';
import { propSolid } from '../render/props';
import { colliderFor, reachableTiles, tileFeet, zoneTiles } from './collide';
import { HATA_DOORS, HATA_ROOMS, homeInterior } from './interior';
import { cellarMap } from './cellar';
import { summerKitchenMap } from './kitchen';
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

  it('хата всередині — за розмірами, які власник підігнав (2026-10-05): мама над Лєною зліва, брати праворуч від мами, коридорчик між ними й Лєною, веранда справа зі входом, кімната над верандою', () => {
    const hata = homeInterior({ ...newLife(1, 'sadok'), home: 'zhylyntsi' });
    assertReachable(hata);
    const reach = reachableTiles(hata, hata.spawns.door!);
    const g = (x: number, y: number) => hata.ground[y]![x];
    // Кожна кімната — рівно того розміру, що на збереженому плані.
    const saved = { mom: [5, 10, 2], bro: [7, 5, 2], up: [6, 5, 2], hall: [7, 5, 2], ver: [6, 5, 2], lena: [12, 7, 3] } as const;
    for (const [id, [w, h, wall]] of Object.entries(saved)) {
      const r = HATA_ROOMS[id as keyof typeof HATA_ROOMS];
      expect([r.w, r.h, r.wall], id).toEqual([w, h, wall]);
      for (let y = r.y; y < r.y + r.h; y += 1) {
        for (let x = r.x + 1; x < r.x + r.w; x += 1) {
          const isDoor = Object.values(HATA_DOORS).some((d) => x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h);
          expect(g(x, y), `${id} ${x},${y}`).toBe(y < r.y + r.wall && !isDoor ? 'W' : 'f');
        }
      }
      expect(reach.has(`${r.x + 2},${r.y + r.h - 1}`), id).toBe(true);
    }
    // Мама — над Лєною зліва; брати праворуч від мами; коридорчик під братами й над Лєною.
    const R = HATA_ROOMS;
    expect(R.mom.y + R.mom.h).toBe(R.lena.y);
    expect(R.bro.x).toBe(R.mom.x + R.mom.w);
    expect(R.hall.y).toBe(R.bro.y + R.bro.h);
    expect(R.hall.y + R.hall.h).toBe(R.lena.y);
    expect(R.up.y + R.up.h).toBe(R.ver.y);
    // Коридорчик зв'язує всі три кімнати: двері до мами, братів і Лєни виходять у нього.
    for (const d of [HATA_DOORS.momHall, HATA_DOORS.broHall, HATA_DOORS.hallLena, HATA_DOORS.hallVer, HATA_DOORS.verUp]) expect(g(d.x, d.y + d.h - 1)).toBe('f');
    const exit = hata.zones.find((z) => z.action.type === 'exit')!;
    expect(exit.x + exit.w).toBe(hata.w);
    expect(exit.y).toBeGreaterThanOrEqual(R.ver.y);
    expect(exit.y).toBeLessThan(R.ver.y + R.ver.h);
    expect(hata.spawns.wake!.y).toBeGreaterThan(R.lena.y + R.lena.wall - 1);
    // Вікна — лише на зовнішніх стінах: задня стіна Лєниної кімнати внутрішня.
    expect(hata.props.filter((p) => p.type === 'window' && p.y >= R.lena.y)).toHaveLength(0);
    const stove = hata.props.find((p) => p.type === 'stove')!;
    expect(stove.x).toBeGreaterThan(R.up.x);
    expect(stove.y).toBeLessThan(R.up.y + R.up.h);
    // Брати живуть удома, поки Лєна в садочку й школі; у ВДПУ — роз'їхались.
    const brotherBeds = (m: typeof hata) => m.props.filter((p) => p.type === 'bed' && p.x > R.bro.x && p.x < R.up.x && p.y < R.bro.h);
    expect(brotherBeds(hata)).toHaveLength(2);
    expect(brotherBeds(homeInterior({ ...newLife(1, 'uni'), home: 'zhylyntsi' }))).toHaveLength(1);
  });

  it('кімната Лєни (власник, 2026-10-05): шафа праворуч від ліжка, стіл унизу посередині, двері на клітинку лівіше', () => {
    const hata = homeInterior({ ...newLife(1, 'sadok'), home: 'zhylyntsi' });
    const R = HATA_ROOMS.lena;
    const inLena = (t: string) => hata.props.find((p) => p.type === t && p.y >= R.y && p.y < R.y + R.h)!;
    const bed = inLena('bed');
    const wardrobe = inLena('wardrobe');
    expect(wardrobe.x).toBeGreaterThan(bed.x + 1.25);
    expect(wardrobe.x - (bed.x + 1.25)).toBeLessThan(1);
    const table = inLena('table');
    expect(table.y).toBeGreaterThan(R.y + R.h - 2);
    expect(Math.abs(table.x + 0.95 - (R.x + R.w / 2))).toBeLessThanOrEqual(0.5);
    expect(HATA_DOORS.hallLena.x).toBe(8);
  });

  it('у хаті будь-яке облаштування з рамки 16×12 лягає на підлогу Лєниної кімнати й не перекриває дверей', () => {
    const s = newLife(1, 'adult');
    const all = { rug: 'rugPink', plant: 'plant', lamp: 'lamp', shelf: 'shelf', tv: 'tv', desk: 'desk', sofa: 'sofa', poster: 'poster', pet: 'kitten' };
    const corners: [number, number][] = [[ROOM_FLOOR.x0, ROOM_FLOOR.y0], [ROOM_FLOOR.x1, ROOM_FLOOR.y1], [ROOM_FLOOR.x1, ROOM_FLOOR.y0], [ROOM_FLOOR.x0, ROOM_FLOOR.y1]];
    const R = HATA_ROOMS.lena;
    for (const c of corners) {
      const hata = homeInterior({ ...s, home: 'zhylyntsi', owned: [...s.owned, 'laptop'], decor: { ...s.decor, ...all } as typeof s.decor, layout: { bed: c, desk: c, sofa: c } });
      assertReachable(hata);
      for (const p of hata.props.filter((q) => q.y >= R.y + R.wall && q.type !== 'wardrobe')) {
        expect(p.x, p.type).toBeGreaterThanOrEqual(R.x + 1);
      }
      // Двері з коридорчика не заставлені: від них можна пройти вглиб кімнати.
      const col = colliderFor(hata);
      for (let y = R.y + R.wall; y < R.y + R.h - 1; y += 1) {
        const f = tileFeet(HATA_DOORS.hallLena.x, y);
        expect(col.canStand(f.x, f.y), `двері, ряд ${y}`).toBe(true);
      }
      // Меблі не налазять одна на одну.
      const solids = hata.props.filter((q) => q.y >= R.y + R.wall).map((q) => [q.type, propSolid(q)] as const).filter(([, r]) => r);
      for (const [i, [ta, a]] of solids.entries()) {
        for (const [tb, b] of solids.slice(i + 1)) {
          const hit = a!.x < b!.x + b!.w && b!.x < a!.x + a!.w && a!.y < b!.y + b!.h && b!.y < a!.y + a!.h;
          expect(hit, `${ta} × ${tb}`).toBe(false);
        }
      }
    }
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

  it('літня кухня — за планом власника: вхід згори прибудови, піч унизу посередині, плита в лівому куті, холодильник праворуч, ящики в сінях', () => {
    const k = summerKitchenMap();
    assertReachable(k);
    const p = (t: string) => k.props.find((x) => x.type === t)!;
    const exit = k.zones.find((z) => z.action.type === 'exit')!;
    const crates = p('crates');
    // Вхід — у задній (верхній) стіні сіней; ящики — у сінях, лівіше за кухню.
    expect(exit.x).toBeLessThan(6);
    expect(k.ground[exit.y - 1]![exit.x]).not.toBe('f');
    expect(crates.x).toBeLessThan(6);
    const oven = p('clayOven');
    expect(oven.y).toBeGreaterThan(6);
    expect(oven.x).toBeGreaterThan(9);
    expect(oven.x).toBeLessThan(13);
    expect(p('stove').x).toBeLessThan(8);
    expect(p('stove').y).toBeLessThan(4);
    expect(p('fridge').x).toBeGreaterThan(16);
    expect(k.props.filter((x) => x.type === 'chair')).toHaveLength(4);
    // Готувати з мамою — біля печі.
    expect(k.zones.some((z) => z.action.type === 'activity' && z.action.id === 'summerKitchen')).toBe(true);
    // На подвір'ї вхід у кухню веде всередину, а не в одразу заняття.
    expect(homeYard().zones.find((z) => z.id === 'summerKitchen')!.action.type).toBe('kitchen');
  });

  it('погріб — за планом власника: перегородки з обох боків, прямо стелаж із банками, засіки за перегородками, вхід знизу сходами', () => {
    const c = cellarMap();
    assertReachable(c);
    const all = (t: string) => c.props.filter((x) => x.type === t);
    const [pl, pr] = all('partition').sort((a, b) => a.x - b.x);
    const shelf = all('jarShelf')[0]!;
    // Стелаж — прямо, між перегородками, біля задньої (кам'яної) стіни.
    expect(shelf.x).toBeGreaterThan(pl!.x);
    expect(shelf.x + 9).toBeLessThan(pr!.x);
    expect(c.ground[Math.floor(shelf.y) - 1]![Math.floor(shelf.x) + 1]).toBe('S');
    // Засіки — за перегородками: картопля ліворуч, буряк і морква праворуч.
    const bins = all('zasik').sort((a, b) => a.x - b.x);
    expect(bins.map((b) => b.variant)).toEqual([0, 1]);
    expect(bins[0]!.x).toBeLessThan(pl!.x);
    expect(bins[1]!.x).toBeGreaterThan(pr!.x);
    // Перегородки — на всю глибину погреба.
    for (const p of [pl!, pr!]) expect(propSolid(p)!.h).toBeGreaterThan(9 * TILE);
    // Вихід — знизу, по сходах, на подвір'я біля лядки.
    const exit = c.zones.find((z) => z.action.type === 'exit')!;
    const stairs = all('cellarStairs')[0]!;
    expect(exit.y).toBeGreaterThan(c.h - 3);
    expect(exit.x).toBeGreaterThanOrEqual(Math.floor(stairs.x));
    const yard = homeYard();
    expect(yard.zones.find((z) => z.id === 'cellar')!.action.type).toBe('cellar');
    assertReachable(yard);
    expect(yard.spawns.cellar).toBeDefined();
  });
});
