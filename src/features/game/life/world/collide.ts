// ============================================================
// Хто де може стати (ADR-0239): земля, сліди будинків, стовбури дерев,
// тверді пропи. Чисте — тестується без браузера.
// ============================================================
import { propSolid } from '../render/props';
import { SOLID_GROUND, TILE, buildingParts, type BirdHome, type GameMap, type Rect, type Zone } from './types';

export interface Collider {
  blocked(px: number, py: number): boolean;
  /** Чи стопи 10×6 з центром (x, y) стоять вільно. */
  canStand(x: number, y: number): boolean;
}

const colliders = new WeakMap<GameMap, Collider>();

export function colliderFor(map: GameMap): Collider {
  const hit = colliders.get(map);
  if (hit) return hit;
  const rects: Rect[] = [];
  for (const b of map.buildings) for (const r of buildingParts(b)) rects.push({ x: r.x * TILE, y: r.y * TILE + 4, w: r.w * TILE, h: r.h * TILE - 4 });
  for (const t of map.trees) rects.push({ x: t.x * TILE + 4, y: t.y * TILE + 9, w: 9, h: 6 });
  for (const p of map.props) {
    const r = propSolid(p);
    if (r) rects.push(r);
  }
  const W = map.w * TILE;
  const H = map.h * TILE;
  const blocked = (px: number, py: number): boolean => {
    if (px < 0 || py < 0 || px >= W || py >= H) return true;
    const g = map.ground[Math.floor(py / TILE)]![Math.floor(px / TILE)]!;
    if (SOLID_GROUND.has(g)) return true;
    for (const r of rects) if (px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h) return true;
    return false;
  };
  const c: Collider = {
    blocked,
    canStand: (x, y) => !blocked(x - 5, y - 5) && !blocked(x + 4, y - 5) && !blocked(x - 5, y) && !blocked(x + 4, y),
  };
  colliders.set(map, c);
  return c;
}

/** Лапи птахи на її місці: внизу посередині клітинки, як стояла курка-проп. */
export function birdFeet(h: BirdHome): { x: number; y: number } {
  return { x: h.x * TILE + 8, y: h.y * TILE + 14 };
}

/**
 * Де може стати курка: лапи 6×3 — вужчі за людські, тож вона пролазить
 * упритул до тину. Будівля для неї — уся, до самого верху стіни: Лєна
 * підходить до стіни на 4 px (`colliderFor`), а курка в цю щілину між
 * курником і тином вигулу пролізла б геть із вигулу. На грядки не
 * заходить — звідти її мама виганяє.
 */
export function birdCanStand(map: GameMap): (x: number, y: number) => boolean {
  const c = colliderFor(map);
  const walls = map.buildings.flatMap((b) => buildingParts(b).map((r) => ({ x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE })));
  const bad = (px: number, py: number): boolean =>
    c.blocked(px, py)
    || map.ground[Math.floor(py / TILE)]![Math.floor(px / TILE)] === 'v'
    || walls.some((r) => px >= r.x && px < r.x + r.w && py >= r.y && py < r.y + r.h);
  return (x, y) => !bad(x - 3, y - 2) && !bad(x + 2, y - 2) && !bad(x - 3, y) && !bad(x + 2, y);
}

/** Точка, куди ставити Лєну в клітинці (стопи внизу клітинки). */
export function tileFeet(i: number, j: number): { x: number; y: number } {
  return { x: i * TILE + 8, y: j * TILE + 12 };
}

/** Клітинки, досяжні пішки від клітинки старту (BFS по центрах клітинок). */
export function reachableTiles(map: GameMap, from: { x: number; y: number }): Set<string> {
  const c = colliderFor(map);
  const seen = new Set<string>();
  const queue: [number, number][] = [[from.x, from.y]];
  const ok = (i: number, j: number) => {
    const f = tileFeet(i, j);
    return c.canStand(f.x, f.y);
  };
  if (!ok(from.x, from.y)) return seen;
  seen.add(`${from.x},${from.y}`);
  while (queue.length > 0) {
    const [i, j] = queue.shift()!;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di;
      const nj = j + dj;
      const k = `${ni},${nj}`;
      if (seen.has(k) || ni < 0 || nj < 0 || ni >= map.w || nj >= map.h || !ok(ni, nj)) continue;
      seen.add(k);
      queue.push([ni, nj]);
    }
  }
  return seen;
}

export function zoneTiles(z: Zone): string[] {
  const out: string[] = [];
  for (let j = z.y; j < z.y + z.h; j += 1) for (let i = z.x; i < z.x + z.w; i += 1) out.push(`${i},${j}`);
  return out;
}

/** Зона, в якій стоять стопи. */
export function zoneAt(map: GameMap, x: number, y: number): Zone | null {
  for (const z of map.zones) {
    if (x >= z.x * TILE - 2 && x < (z.x + z.w) * TILE + 2 && y >= z.y * TILE && y < (z.y + z.h) * TILE + 4) return z;
  }
  return null;
}
