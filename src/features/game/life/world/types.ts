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
 *   t кахель · k килимова підлога · W стіна кімнати · x порожнеча
 */
export type Ground = 'g' | 'G' | 'd' | 'c' | 'p' | 'a' | 'm' | 'z' | 's' | 'b' | 'w' | 'r' | 'h' | 'F' | 'f' | 't' | 'k' | 'W' | 'x';

export const SOLID_GROUND: ReadonlySet<Ground> = new Set<Ground>(['w', 'h', 'F', 'W', 'x', 'r']);

export type BuildingStyle =
  | 'cottage' | 'house' | 'sadok' | 'school' | 'shop' | 'cafe' | 'block' | 'office'
  | 'station' | 'busStation' | 'uni' | 'lavra' | 'ratusha' | 'post' | 'lyceum' | 'kiosk' | 'church';

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
  | { type: 'wardrobe' }
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
  action?: ZoneAction | undefined;
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
  | 'desk' | 'sofa' | 'fridge' | 'rushnyk' | 'door';

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
