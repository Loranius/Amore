// ============================================================
// Конструктор мап «Дєвочка в городі» (ADR-0239): дороги, будинки з
// дверима-зонами, дерева й пропи. Мапа — чисті дані, тож її можна
// перевірити тестом (усі двері досяжні, жодна зона не в стіні).
// ============================================================
import type { CityId } from '../sim/content';
import { cellHash } from './hash';
import { buildingParts, type Building, type BuildingStyle, type GameMap, type Ground, type Notch, type Prop, type PropType, type SignIcon, type Tree, type TreeKind, type Zone, type ZoneAction } from './types';

/** Меблі, що в домі малюються більшими (`Prop.scale`). */
export const INTERIOR_FURNITURE: ReadonlySet<PropType> = new Set<PropType>([
  'bed', 'wardrobe', 'table', 'desk', 'sofa', 'shelf', 'tv', 'fridge', 'stove', 'floorLamp', 'plant', 'rug', 'chair', 'crates',
]);
export const INTERIOR_FURNITURE_SCALE = 1.25;

export interface BuildingSpec {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: BuildingStyle;
  label: string;
  /** Колонка дверей; за замовчуванням — посередині. */
  doorX?: number;
  sign?: SignIcon;
  wall?: string;
  roof?: string;
  action?: ZoneAction;
  /** Підпис дії біля дверей (за замовчуванням — назва будинку). */
  zoneLabel?: string;
  /** `false` — без дверей (глуха частина складного будинку). */
  door?: boolean;
  /** Вирізаний верхній кут — Г-подібна споруда (див. `Notch`). */
  notch?: Notch;
  /** Двері в правій стіні, а не у фасаді. */
  sideDoor?: boolean;
  /** Бік, яким частина прилягає до іншої частини тієї ж споруди. */
  join?: 'left' | 'right';
  joinTo?: { x: number; y: number; w: number; h: number };
  chimney?: boolean;
  /** Фронтон із горищем до глядача. */
  gable?: boolean;
}

export class MapBuilder {
  readonly ground: Ground[][];
  readonly buildings: Building[] = [];
  readonly trees: Tree[] = [];
  readonly props: Prop[] = [];
  readonly zones: Zone[] = [];
  readonly spawns: Record<string, { x: number; y: number }> = {};
  folk = 0;
  pondFreezes = false;

  constructor(readonly id: string, readonly city: CityId | null, readonly name: string, readonly w: number, readonly h: number, base: Ground = 'g', readonly interior = false) {
    this.ground = Array.from({ length: h }, () => Array<Ground>(w).fill(base));
  }

  fill(x: number, y: number, w: number, h: number, t: Ground): this {
    for (let j = y; j < y + h; j += 1) for (let i = x; i < x + w; i += 1) if (this.ground[j]?.[i] !== undefined) this.ground[j]![i] = t;
    return this;
  }

  at(i: number, j: number): Ground | undefined {
    return this.ground[j]?.[i];
  }

  building(spec: BuildingSpec): this {
    const doorX = spec.doorX ?? spec.x + Math.floor(spec.w / 2);
    this.buildings.push({ id: spec.id, x: spec.x, y: spec.y, w: spec.w, h: spec.h, style: spec.style, label: spec.label, doorX, sign: spec.sign, wall: spec.wall, roof: spec.roof, action: spec.action, door: spec.door, notch: spec.notch, sideDoor: spec.sideDoor, join: spec.join, joinTo: spec.joinTo, chimney: spec.chimney, gable: spec.gable });
    if (spec.door === false) return this;
    // Ґанок під дверима — завжди прохідний.
    const below = this.at(doorX, spec.y + spec.h);
    if (below === undefined || ['w', 'h', 'F', 'x', 'W', 'r', 'S'].includes(below)) this.fill(doorX, spec.y + spec.h, 1, 1, 'd');
    if (spec.action) this.zones.push({ id: spec.id, x: doorX, y: spec.y + spec.h, w: 1, h: 1, action: spec.action, label: spec.zoneLabel ?? spec.label });
    return this;
  }

  tree(x: number, y: number, kind: TreeKind): this {
    this.trees.push({ x, y, kind });
    return this;
  }

  prop(type: PropType, x: number, y: number, extra: Partial<Prop> = {}): this {
    // У домі меблі трохи більші, ніж намальовані: поруч із людьми в
    // масштабі вулиці вони виглядали іграшковими (власник, 2026-10-05).
    const scale = this.interior && INTERIOR_FURNITURE.has(type) ? INTERIOR_FURNITURE_SCALE : undefined;
    this.props.push({ type, x, y, ...(scale ? { scale } : {}), ...extra });
    return this;
  }

  zone(id: string, x: number, y: number, w: number, h: number, action: ZoneAction, label: string): this {
    this.zones.push({ id, x, y, w, h, action, label });
    return this;
  }

  spawn(name: string, x: number, y: number): this {
    this.spawns[name] = { x, y };
    return this;
  }

  /** Чи клітинка зайнята будинком. */
  private built(i: number, j: number): boolean {
    return this.buildings.some((b) => buildingParts(b).some((r) => i >= r.x - 1 && i < r.x + r.w + 1 && j >= r.y - 1 && j < r.y + r.h + 1));
  }

  /** Розсипати дерева на траві в прямокутнику — детерміновано, оминаючи все зайняте. */
  scatterTrees(x: number, y: number, w: number, h: number, kinds: readonly TreeKind[], density: number, salt = 0): this {
    for (let j = y; j < y + h; j += 2) {
      for (let i = x; i < x + w; i += 2) {
        const hh = cellHash(i, j, salt + 101);
        if ((hh % 1000) / 1000 > density) continue;
        const tx = i + ((hh >> 10) % 2);
        const ty = j + ((hh >> 12) % 2);
        const t = this.at(tx, ty);
        if (t !== 'g' && t !== 'G') continue;
        if (this.built(tx, ty)) continue;
        if (this.trees.some((tr) => Math.abs(tr.x - tx) < 2 && Math.abs(tr.y - ty) < 2)) continue;
        if (this.zones.some((z) => tx >= z.x - 1 && tx < z.x + z.w + 1 && ty >= z.y - 1 && ty < z.y + z.h + 1)) continue;
        this.trees.push({ x: tx, y: ty, kind: kinds[(hh >> 14) % kinds.length]! });
      }
    }
    return this;
  }

  build(): GameMap {
    return {
      id: this.id,
      city: this.city,
      name: this.name,
      w: this.w,
      h: this.h,
      ground: this.ground,
      buildings: this.buildings,
      trees: this.trees,
      props: this.props,
      zones: this.zones,
      spawns: this.spawns,
      interior: this.interior,
      folk: this.folk,
      pondFreezes: this.pondFreezes,
    };
  }
}
