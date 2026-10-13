// ============================================================
// Маркери взаємодій (власник 2026-10-12: «щоб було видно, де є якісь
// події, як-от увійти в приміщення чи збирати фрукти», ADR-0239). Над
// кожним місцем, де Лєна може щось зробити, висить значок на пергаментній
// плашці зі стрілочкою вниз: двері, яблуко, паросток, рибка, молоток,
// хмарка розмови, око, автобус... Над людьми, з якими можна поговорити, —
// хмарка, над Басею — серце.
//
// Здалеку значки бліді, а ближче — яскраві й підстрибують, тож видно, де
// події, але мапа не рябіє. Над зоною, де Лєна стоїть (там уже підпис), і
// над метою дня (там уже стрілка) значка нема. Малюються поверх темряви,
// у пікселях екрана: уночі місця теж видно.
// ============================================================
import { TILE, type GameMap, type Zone, type ZoneAction } from '../world/types';
import { bitmapSize, ICONS } from './icons';
import { densityOf, ellipse } from './pixel';

export type MarkerKind =
  | 'door' | 'shop' | 'fruit' | 'garden' | 'fish' | 'tool' | 'cook' | 'talk' | 'look' | 'bus' | 'walk' | 'bed'
  | 'pet' | 'sale' | 'friends' | 'date' | 'wardrobe' | 'laptop' | 'decor' | 'task';

/** Заняття з власним значком; решта — зірочка «тут можна чимось зайнятися». */
const ACTIVITY: Record<string, MarkerKind> = { orchard: 'fruit', garden: 'garden', workshop: 'tool', fishing: 'fish', summerKitchen: 'cook', museum: 'look' };

/** Що можна зробити в цій зоні — яким значком її позначити. */
export function markerKind(a: ZoneAction): MarkerKind {
  switch (a.type) {
    case 'home': case 'yard': case 'village': case 'kitchen': case 'cellar': case 'exit':
    case 'duty': case 'workplace': case 'lyceum': case 'jobs': return 'door';
    case 'shop': return 'shop';
    case 'station': return 'bus';
    case 'walk': return 'walk';
    case 'bed': return 'bed';
    case 'sight': case 'stone': case 'info': return 'look';
    case 'realtor': return 'sale';
    case 'friends': return 'friends';
    case 'date': return 'date';
    case 'mom': case 'talk': return 'talk';
    case 'dog': return 'pet';
    case 'wardrobe': return 'wardrobe';
    case 'laptop': return 'laptop';
    case 'decorate': return 'decor';
    case 'activity': return ACTIVITY[a.id] ?? 'task';
  }
}

/** Піктограма кожного значка (`icons.ts`). */
export const MARKER_ICON: Record<MarkerKind, keyof typeof ICONS> = {
  door: 'door', shop: 'bag', fruit: 'apple', garden: 'sprout', fish: 'fish', tool: 'hammer', cook: 'cake', talk: 'bubble',
  look: 'eye', bus: 'bus', walk: 'map', bed: 'sleep', pet: 'heart', sale: 'key', friends: 'smile', date: 'heart',
  wardrobe: 'shirt', laptop: 'tv', decor: 'sofa', task: 'star',
};

/** Висота дверей (`buildings.ts`, DOOR_H) з лутками: значок над дверима — вище. */
const OVER_DOOR = 30;
/** Над іншою зоною значок висить трохи вище за предмети на ній (дошка, навіс). */
const OVER_ZONE = 18;

/** Кінчик стрілочки значка (світові пікселі): над дверима будинку — над дверима, інакше — над зоною. */
export function markerAnchor(map: GameMap, z: Zone): { x: number; y: number } {
  const door = map.buildings.some((b) => b.id === z.id && b.action);
  return { x: (z.x + z.w / 2) * TILE, y: z.y * TILE - (door ? OVER_DOOR : OVER_ZONE) };
}

/** Яскравість значка за відстанню до Лєни (світові пікселі): поруч — повна, далі блідне, але не зникає. */
export function markerAlpha(dist: number): number {
  const t = dist / TILE;
  return t <= 3 ? 1 : Math.max(0.4, 1 - (t - 3) * 0.06);
}

/** Люди ближче за стільки клітинок мають значок розмови (далі він лише рябив би). */
const PEOPLE_RANGE = 6;
/** Бася весь час бігає — її серце лише зовсім поруч, інакше воно гасало б за нею мапою. */
const PET_RANGE = 3;
/** Дві дії на одній клітинці (двері січкарні й майстерні виходять в один прохід) — значки поруч, а не стовпчиком. */
const SIDE_BY_SIDE = 15;

export interface Marker {
  kind: MarkerKind;
  /** Кінчик стрілочки (світові пікселі). */
  x: number;
  y: number;
  alpha: number;
}

export interface MarkerInput {
  lena: { x: number; y: number } | null;
  near: Zone | null;
  target: Zone | null;
  /** Люди, з якими зараз можна поговорити, і Бася: де стоять (ноги) і хто. */
  people: readonly { id: string; x: number; y: number; kind: 'talk' | 'pet' }[];
}

/** Усі значки, які видно зараз, — від дальніх до ближчих до глядача (за `y`). */
export function markersFor(map: GameMap, input: MarkerInput): Marker[] {
  const out: Marker[] = [];
  const dist = (x: number, y: number) => (input.lena ? Math.hypot(x - input.lena.x, y - input.lena.y) : 0);
  const spots = new Map<string, Marker[]>();
  for (const z of map.zones) {
    if (z.id === input.near?.id || z.id === input.target?.id) continue;
    const a = markerAnchor(map, z);
    const m: Marker = { kind: markerKind(z.action), x: a.x, y: a.y, alpha: markerAlpha(dist((z.x + z.w / 2) * TILE, (z.y + z.h / 2) * TILE)) };
    const key = `${z.x + z.w / 2},${z.y + z.h / 2}`;
    spots.set(key, [...(spots.get(key) ?? []), m]);
    out.push(m);
  }
  for (const same of spots.values()) {
    if (same.length < 2) continue;
    const y = Math.min(...same.map((m) => m.y));
    same.forEach((m, k) => { m.x += (k - (same.length - 1) / 2) * SIDE_BY_SIDE; m.y = y; });
  }
  for (const p of input.people) {
    if (input.near?.id === `talk:${p.id}` || input.near?.id === `talk:${p.id.replace(/^res:/, '')}`) continue;
    const d = dist(p.x, p.y);
    if (d > (p.kind === 'pet' ? PET_RANGE : PEOPLE_RANGE) * TILE) continue;
    out.push({ kind: p.kind, x: p.x, y: p.y - (p.kind === 'pet' ? 24 : 38), alpha: markerAlpha(d) });
  }
  return out.sort((a, b) => a.y - b.y);
}

/** Плашка значка — однакова для всіх піктограм (найбільша — 9×8). */
const BADGE_W = 13;
const BADGE_H = 12;
const EDGE = '#4a2c1a';
const PAPER = '#fff2cf';

export interface MarkerView {
  scale: number;
  camX: number;
  camY: number;
}

/** Намалювати значки поверх сцени — у пікселях екрана, тож темрява ночі їх не ховає. */
export function drawMarkers(g: CanvasRenderingContext2D, markers: readonly Marker[], view: MarkerView, time: number): void {
  const S = view.scale;
  const cx0 = Math.round(view.camX);
  const cy0 = Math.round(view.camY);
  const R = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect((x - cx0) * S, (y - cy0) * S, w * S, h * S);
  };
  for (const m of markers) {
    const icon = MARKER_ICON[m.kind];
    const [w, h] = bitmapSize(icon);
    const bob = m.alpha >= 1 ? Math.round(Math.sin(time * 3 + m.x * 0.13) * 1) : 0;
    const x0 = Math.round(m.x - BADGE_W / 2);
    const y0 = Math.round(m.y - BADGE_H - 2) + bob;
    const mid = x0 + Math.floor(BADGE_W / 2);
    g.globalAlpha = m.alpha;
    R(x0 + 1, y0 + 1, BADGE_W, BADGE_H, 'rgba(30,20,10,0.28)');
    R(x0 + 1, y0, BADGE_W - 2, BADGE_H, EDGE);
    R(x0, y0 + 1, BADGE_W, BADGE_H - 2, EDGE);
    R(x0 + 1, y0 + 1, BADGE_W - 2, BADGE_H - 2, PAPER);
    R(mid - 1, y0 + BADGE_H, 3, 1, EDGE);
    R(mid, y0 + BADGE_H + 1, 1, 1, EDGE);
    const bm = ICONS[icon];
    const ix = x0 + Math.floor((BADGE_W - w) / 2);
    const iy = y0 + Math.floor((BADGE_H - h) / 2);
    bm.rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i += 1) {
        const c = bm.palette[row[i]!];
        if (c) R(ix + i, iy + j, 1, 1, c);
      }
    });
  }
  g.globalAlpha = 1;
}

// ============================================================
// Кільце на землі (власник 2026-10-13: «на землі виділений маркер, типу
// світла область, прибери на підлозі ці маркери і заміни їх на менші з
// якоюсь легкою анімацією, наприклад жовті кільця які на землі сяють»).
// Замість світлої плями на всю зону — невелике жовте кільце там, де Лєна
// стоїть у зоні: тонкий обідок, що тихо дихає, і хвиля, що раз на півтори
// секунди розходиться від нього й гасне. Розмова — кільце під людиною.
// ============================================================

/** Обідок кільця (світові пікселі): ширше, ніж глибше, — земля в ракурсі «три чверті». */
export const RING_RX = 7.5;
export const RING_RY = 3.5;
/** Хвиля: розходиться від 4 до 10 px за `RIPPLE_S` секунд. */
const RIPPLE_S = 1.4;

/**
 * Де світиться кільце зони, в якій стоїть Лєна: посередині клітинки зони,
 * найближчої до її стоп (кільце стоїть на місці, поки Лєна в клітинці, а
 * вздовж довгої зони переходить за нею). Розмова (`talk:…`) — кільце під
 * тим, з ким говорити; якщо його вже нема на мапі — кільця нема.
 */
export function ringSpot(near: Zone, lena: { x: number; y: number } | null, who: readonly { id: string; x: number; y: number }[]): { x: number; y: number } | null {
  if (near.id.startsWith('talk:')) {
    const id = near.id.slice(5);
    const p = who.find((a) => a.id === id || a.id === `res:${id}`);
    return p ? { x: p.x, y: p.y } : null;
  }
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const i = lena ? clamp(Math.floor(lena.x / TILE), near.x, near.x + near.w - 1) : Math.floor(near.x + near.w / 2);
  const j = lena ? clamp(Math.floor(lena.y / TILE), near.y, near.y + near.h - 1) : Math.floor(near.y + near.h / 2);
  return { x: i * TILE + 8, y: j * TILE + 12 };
}

/**
 * Пікселі обідка еліпса завтовшки в один піксель малюнка: зсуви від центру
 * в пікселях малюнка (щільність `d`). Піксель — на обідку, якщо він усередині
 * еліпса, а хоч один його сусід — уже ні.
 */
export function ringPixels(rx: number, ry: number, d: number): [number, number][] {
  const inside = (i: number, j: number) => ((i / d) / rx) ** 2 + ((j / d) / ry) ** 2 <= 1;
  const out: [number, number][] = [];
  const X = Math.ceil(rx * d);
  const Y = Math.ceil(ry * d);
  for (let j = -Y; j <= Y; j += 1) {
    for (let i = -X; i <= X; i += 1) {
      if (!inside(i, j)) continue;
      if (!inside(i + 1, j) || !inside(i - 1, j) || !inside(i, j + 1) || !inside(i, j - 1)) out.push([i, j]);
    }
  }
  return out;
}

/** Намалювати кільце на землі довкола точки (x, y) — центр під стопами. */
export function drawGroundRing(g: CanvasRenderingContext2D, x: number, y: number, time: number): void {
  const d = densityOf(g);
  const cx = Math.round(x * d) / d;
  const cy = Math.round(y * d) / d;
  const breath = 0.5 + Math.sin(time * 4) * 0.5;
  const dots = (px: readonly [number, number][], back: string, front: string, alpha: number) => {
    g.globalAlpha = alpha;
    for (const [i, j] of px) {
      // Передній край ближче до глядача — світліший, як відблиск.
      g.fillStyle = j > 0 ? front : back;
      g.fillRect(cx + i / d, cy + j / d, 1 / d, 1 / d);
    }
  };
  // Ореол довкола й тепле сяйво всередині — дихають разом з обідком.
  g.globalAlpha = 0.1 + breath * 0.1;
  ellipse(g, cx, cy, RING_RX + 1.5, RING_RY + 1, '#ffd84a');
  g.globalAlpha = 0.2 + breath * 0.16;
  ellipse(g, cx, cy, RING_RX - 1, RING_RY - 0.8, '#fff0a0');
  // Хвиля, що розходиться й гасне.
  const ph = (time % RIPPLE_S) / RIPPLE_S;
  const rr = 4 + ph * 7;
  dots(ringPixels(rr, rr * (RING_RY / RING_RX), d), '#ffe680', '#fff4b8', 0.7 * (1 - ph));
  // Сам обідок — завтовшки у світовий піксель: у 32×32 це два кільця по пів пікселя.
  const rim = d > 1 ? [...ringPixels(RING_RX, RING_RY, d), ...ringPixels(RING_RX - 1 / d, RING_RY - 1 / d, d)] : ringPixels(RING_RX, RING_RY, d);
  dots(rim, '#f0ac1c', '#ffdf4a', 0.8 + breath * 0.2);
  g.globalAlpha = 1;
}
