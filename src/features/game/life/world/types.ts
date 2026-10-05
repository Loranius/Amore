// ============================================================
// Мапи «Дєвочка в городі» (ADR-0239): дані, які малює `render/scene.ts`.
// ============================================================
import type { CityId, ShopId } from '../sim/content';

export const TILE = 16;

/**
 * Земля, один символ на клітинку:
 *   g трава · G трава з квітами · d стежка · c бруківка · p плитка ·
 *   a асфальт · m асфальт із розміткою · z зебра · s пісок · b мокрий пісок ·
 *   w вода · r колія · h живопліт · F паркан · f дерев'яна підлога ·
 *   t кахель · k килимова підлога · W стіна кімнати · x порожнеча ·
 *   v грядки городу
 */
export type Ground = 'g' | 'G' | 'd' | 'c' | 'p' | 'a' | 'm' | 'z' | 's' | 'b' | 'w' | 'r' | 'h' | 'F' | 'f' | 't' | 'k' | 'W' | 'x' | 'v';

export const SOLID_GROUND: ReadonlySet<Ground> = new Set<Ground>(['w', 'h', 'F', 'W', 'x', 'r']);

export type BuildingStyle =
  | 'cottage' | 'house' | 'sadok' | 'school' | 'shop' | 'cafe' | 'block' | 'office'
  | 'station' | 'busStation' | 'uni' | 'lavra' | 'ratusha' | 'post' | 'lyceum' | 'kiosk' | 'church'
  // Садиба Лєни (2026-10-06): хлів, курник, дерев'яна майстерня/прибудова.
  | 'barn' | 'coop' | 'shed';

export type ZoneAction =
  | { type: 'duty'; building: string }
  | { type: 'workplace'; job: string }
  | { type: 'home' }
  | { type: 'bed' }
  | { type: 'exit' }
  | { type: 'station' }
  | { type: 'shop'; shop: ShopId }
  | { type: 'sight'; sight: string }
  | { type: 'jobs' }
  | { type: 'realtor' }
  | { type: 'friends' }
  | { type: 'date' }
  | { type: 'lyceum' }
  | { type: 'stone' }
  | { type: 'mom' }
  | { type: 'walk'; to: CityId }
  /** Із села — на подвір'я Лєниної садиби; з подвір'я — назад у село. */
  | { type: 'yard' }
  | { type: 'village' }
  | { type: 'wardrobe' }
  | { type: 'talk'; who?: string }
  | { type: 'laptop' }
  | { type: 'activity'; id: string }
  | { type: 'decorate' }
  | { type: 'info'; text: string };

export interface Building {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: BuildingStyle;
  label: string;
  /** Колонка дверей (у клітинках). */
  doorX: number;
  wall?: string | undefined;
  roof?: string | undefined;
  /** Піктограма на вивісці. */
  sign?: SignIcon | undefined;
  /** `false` — без дверей: глуха частина складного будинку (Г-подібна хата). */
  door?: boolean | undefined;
  /**
   * Вирізаний верхній кут (у клітинках): будинок стає Г-подібним, але
   * лишається однією спорудою — один фасад, одна лінія звису, одні двері.
   */
  notch?: Notch | undefined;
  action?: ZoneAction | undefined;
}

export interface Notch {
  w: number;
  h: number;
  side: 'left' | 'right';
}

/** Прямокутники, які будинок займає на землі (Г-подібний — два). */
export function buildingParts(b: Pick<Building, 'x' | 'y' | 'w' | 'h' | 'notch'>): { x: number; y: number; w: number; h: number }[] {
  const n = b.notch;
  if (!n) return [{ x: b.x, y: b.y, w: b.w, h: b.h }];
  const tall = n.side === 'right' ? { x: b.x, y: b.y, w: b.w - n.w, h: b.h } : { x: b.x + n.w, y: b.y, w: b.w - n.w, h: b.h };
  const low = n.side === 'right' ? { x: b.x + b.w - n.w, y: b.y + n.h, w: n.w, h: b.h - n.h } : { x: b.x, y: b.y + n.h, w: n.w, h: b.h - n.h };
  return [tall, low];
}

export type SignIcon = 'bread' | 'shirt' | 'book' | 'cup' | 'flower' | 'tv' | 'sofa' | 'gift' | 'letter' | 'briefcase' | 'key' | 'bus' | 'train' | 'cake' | 'pencil' | 'star';

export type TreeKind = 'oak' | 'pine' | 'cherry' | 'birch' | 'apple' | 'chestnut' | 'willow' | 'poplar';

export interface Tree {
  x: number;
  y: number;
  kind: TreeKind;
}

export type PropType =
  | 'bench' | 'lamp' | 'well' | 'mailbox' | 'busStop' | 'fountain' | 'bigFountain' | 'stall' | 'car' | 'bike'
  | 'bin' | 'planter' | 'pot' | 'sunflowers' | 'haystack' | 'swing' | 'slide' | 'sandbox' | 'goal' | 'flagpole'
  | 'umbrella' | 'lounger' | 'yellowStone' | 'boat' | 'lighthouse' | 'cafeTable' | 'signpost' | 'board' | 'bush'
  | 'flowerBed' | 'rock' | 'chicken' | 'cat' | 'duck' | 'gull' | 'pier' | 'stairs' | 'statue' | 'tram' | 'clock'
  // кімната
  | 'bed' | 'rug' | 'plant' | 'floorLamp' | 'poster' | 'shelf' | 'tv' | 'pet' | 'table' | 'stove' | 'window' | 'wardrobe'
  | 'desk' | 'sofa' | 'fridge' | 'rushnyk' | 'door'
  // садиба
  | 'woodpile' | 'workbench' | 'cellar' | 'planks';

export interface Prop {
  type: PropType;
  /** Клітинка (може бути дробовою). */
  x: number;
  y: number;
  /** Колір чи варіант, якщо пропу він потрібен. */
  tint?: string | undefined;
  variant?: number | undefined;
  solid?: boolean | undefined;
}

export interface Zone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  action: ZoneAction;
  label: string;
}

export interface GameMap {
  id: string;
  city: CityId | null;
  name: string;
  w: number;
  h: number;
  ground: Ground[][];
  buildings: Building[];
  trees: Tree[];
  props: Prop[];
  zones: Zone[];
  /** Де з'являється Лєна, коли приходить (зі станції, з дому, з дороги). */
  spawns: Record<string, { x: number; y: number }>;
  interior: boolean;
  /** Скільки перехожих гуляє. */
  folk: number;
  /** Чи замерзає ставок узимку (село). */
  pondFreezes?: boolean;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
