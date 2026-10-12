import { describe, expect, it } from 'vitest';
import { newLife } from '../sim/life';
import { cellarMap } from '../world/cellar';
import { homeInterior } from '../world/interior';
import { summerKitchenMap } from '../world/kitchen';
import { ALL_CITY_IDS, cityMap, homeYard } from '../world/maps';
import { TILE, type GameMap, type ZoneAction } from '../world/types';
import { bitmapSize, ICONS } from './icons';
import { MARKER_ICON, markerAlpha, markerAnchor, markerKind, markersFor } from './markers';

// Маркери взаємодій (ADR-0239, власник 2026-10-12: «щоб було видно, де є
// якісь події, як-от увійти в приміщення чи збирати фрукти»).

const MAPS: GameMap[] = [homeYard(), summerKitchenMap(), cellarMap(), homeInterior(newLife(1)), ...ALL_CITY_IDS.map(cityMap)];

describe('маркери взаємодій', () => {
  it('кожна зона кожної мапи має значок, і піктограма вміщається в плашку', () => {
    for (const map of MAPS) {
      for (const z of map.zones) {
        const icon = MARKER_ICON[markerKind(z.action)];
        expect(ICONS[icon], `${map.id}: ${z.id}`).toBeDefined();
        const [w, h] = bitmapSize(icon);
        expect(w, `${map.id}: ${z.id} — ${icon}`).toBeLessThanOrEqual(11);
        expect(h, `${map.id}: ${z.id} — ${icon}`).toBeLessThanOrEqual(10);
      }
    }
  });

  it('приклади власника: увійти в приміщення — двері, зібрати фрукти — яблуко', () => {
    const yard = homeYard();
    const kind = (id: string) => markerKind(yard.zones.find((z) => z.id === id)!.action);
    for (const id of ['home', 'summerKitchen', 'cellar', 'village']) expect(kind(id), id).toBe('door');
    expect(kind('orchard')).toBe('fruit');
    expect(MARKER_ICON.fruit).toBe('apple');
    expect(kind('garden')).toBe('garden');
    expect(kind('workshop')).toBe('tool');
    const village = cityMap('zhylyntsi');
    const at = (id: string) => markerKind(village.zones.find((z) => z.id === id)!.action);
    expect(at('shop')).toBe('shop');
    expect(at('bus')).toBe('bus');
    expect(at('fishing')).toBe('fish');
    // Різні дії — різні значки: двері не плутаються з магазином чи оглядинами.
    const actions: ZoneAction[] = [{ type: 'home' }, { type: 'shop', shop: 'atb' as never }, { type: 'sight', sight: 'x' }, { type: 'station' }, { type: 'bed' }, { type: 'activity', id: 'orchard' }];
    expect(new Set(actions.map((a) => MARKER_ICON[markerKind(a)])).size).toBe(actions.length);
  });

  it('над дверима будинку значок висить над дверима, над іншою зоною — просто над нею', () => {
    const village = cityMap('zhylyntsi');
    const home = village.zones.find((z) => z.id === 'home')!;
    expect(village.buildings.some((b) => b.id === 'home')).toBe(true);
    expect(markerAnchor(village, home)).toEqual({ x: (home.x + home.w / 2) * TILE, y: home.y * TILE - 30 });
    const bus = village.zones.find((z) => z.id === 'bus')!;
    expect(markerAnchor(village, bus)).toEqual({ x: (bus.x + bus.w / 2) * TILE, y: bus.y * TILE - 18 });
  });

  it('дві дії на одній клітинці — значки поруч на одній висоті, а не стовпчиком (січкарня й майстерня)', () => {
    const yard = homeYard();
    const shared = yard.zones.filter((z) => z.x === 27 && z.y === 15).map((z) => z.id).sort();
    expect(shared).toEqual(['sichkarnia', 'workshop']);
    const ms = markersFor(yard, { lena: null, near: null, target: null, people: [] }).filter((m) => m.kind === 'look' || m.kind === 'tool').filter((m) => Math.abs(m.x - 27.5 * TILE) < TILE);
    expect(ms).toHaveLength(2);
    expect(ms[0]!.y).toBe(ms[1]!.y);
    expect(Math.abs(ms[0]!.x - ms[1]!.x)).toBeGreaterThanOrEqual(13);
    // Значки кожної мапи не налазять один на одного (плашка 13×12).
    for (const map of MAPS) {
      const all = markersFor(map, { lena: null, near: null, target: null, people: [] });
      for (let i = 0; i < all.length; i += 1) {
        for (let j = i + 1; j < all.length; j += 1) {
          const a = all[i]!;
          const b = all[j]!;
          expect(Math.abs(a.x - b.x) >= 13 || Math.abs(a.y - b.y) >= 12, `${map.id}: ${a.kind} ${a.x},${a.y} і ${b.kind} ${b.x},${b.y}`).toBe(true);
        }
      }
    }
  });

  it('поруч значок яскравий, далі блідне, але не зникає', () => {
    expect(markerAlpha(0)).toBe(1);
    expect(markerAlpha(3 * TILE)).toBe(1);
    let was = 1;
    for (let d = 0; d <= 40 * TILE; d += 4) {
      const a = markerAlpha(d);
      expect(a).toBeLessThanOrEqual(was);
      expect(a).toBeGreaterThanOrEqual(0.4);
      was = a;
    }
    expect(markerAlpha(40 * TILE)).toBe(0.4);
  });

  it('над зоною, де Лєна стоїть, і над метою дня значка нема — там уже підпис і стрілка', () => {
    const yard = homeYard();
    const near = yard.zones.find((z) => z.id === 'orchard')!;
    const target = yard.zones.find((z) => z.id === 'garden')!;
    const all = markersFor(yard, { lena: null, near: null, target: null, people: [] });
    expect(all).toHaveLength(yard.zones.length);
    const some = markersFor(yard, { lena: null, near, target, people: [] });
    expect(some).toHaveLength(yard.zones.length - 2);
    const spot = (id: string) => markerAnchor(yard, yard.zones.find((z) => z.id === id)!);
    expect(some.some((m) => m.x === spot('orchard').x && m.y === spot('orchard').y)).toBe(false);
    expect(some.some((m) => m.x === spot('garden').x && m.y === spot('garden').y)).toBe(false);
    // Від дальніх до ближчих: значок нижче на екрані малюється пізніше.
    expect(all.map((m) => m.y)).toEqual([...all.map((m) => m.y)].sort((a, b) => a - b));
  });

  it('над людьми поруч — хмарка розмови над головою, над Басею — серце; далеко — нічого', () => {
    const map = cityMap('zhylyntsi');
    const lena = { x: 200, y: 200 };
    const people = [
      { id: 'mom', x: 220, y: 200, kind: 'talk' as const },
      { id: 'basia', x: 180, y: 210, kind: 'pet' as const },
      { id: 'res:far', x: 200 + 7 * TILE, y: 200, kind: 'talk' as const },
    ];
    const ms = markersFor({ ...map, zones: [] }, { lena, near: null, target: null, people });
    expect(ms).toHaveLength(2);
    // Бася весь час бігає: її серце — лише зовсім поруч, а людина на 5 клітинках ще має хмарку.
    const away = markersFor({ ...map, zones: [] }, { lena, near: null, target: null, people: [{ id: 'basia', x: 200 + 4 * TILE, y: 200, kind: 'pet' }, { id: 'mom', x: 200 + 5 * TILE, y: 200, kind: 'talk' }] });
    expect(away.map((m) => m.kind)).toEqual(['talk']);
    expect(ms.find((m) => m.kind === 'talk')).toMatchObject({ x: 220, y: 200 - 38, alpha: 1 });
    expect(ms.find((m) => m.kind === 'pet')).toMatchObject({ x: 180, y: 210 - 24, alpha: 1 });
    // Розмова, яку Лєна вже може почати (стоїть у зоні розмови), — без значка.
    const talking = markersFor({ ...map, zones: [] }, { lena, near: { id: 'talk:mom', x: 0, y: 0, w: 1, h: 1, action: { type: 'mom' }, label: '' }, target: null, people });
    expect(talking.map((m) => m.kind)).toEqual(['pet']);
  });
});
