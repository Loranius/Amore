// ============================================================
// Дерево v2 — геометрія з моделі (ADR-0218).
// ------------------------------------------------------------
// Той самий алгоритм, що в Python-двійнику
// (`tools/crystal_twin/crystal_twin/tree_geometry.py`); `summary` звіряється
// з `golden/tree/*.json`.
//
// Скелет (ADR-0237): стовбур сегментами до кожного ярусу; з ярусу виходять
// гілки років (3 або 4), кожна розгалужується з віком; на верхівці — гілки
// планів. Кут, азимут і довжина кожної гілки — з хешу її шляху. Крона — гранчасті кластери на
// кінцях гілок: пласкі грані, жодного шуму.
//
// Модуль чистий: лише масиви, без three, без React.
// ============================================================
import { unit } from '../crystalV2/hash';
import { yearBoost } from '../grammar/grammar';
import { treeHeightAt, type TreeV2Model } from './model';

type V3 = [number, number, number];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const length = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  return [a[0] / length, a[1] / length, a[2] / length];
};
const rad = (deg: number) => (deg * Math.PI) / 180;

function basis(d: V3): [V3, V3] {
  const ref: V3 = Math.abs(d[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  const a = norm(cross(d, ref));
  return [a, cross(d, a)];
}

/** Відхилити напрям на `angle` у площині, повернутій на `turn` навколо нього. */
function deviate(d: V3, angleDeg: number, turnDeg: number): V3 {
  const [a, b] = basis(d);
  const side = add(mul(a, Math.cos(rad(turnDeg))), mul(b, Math.sin(rad(turnDeg))));
  const out = add(mul(d, Math.cos(rad(angleDeg))), mul(side, Math.sin(rad(angleDeg))));
  // Гілки тягнуться до світла: легкий ухил угору.
  return norm(add(out, [0, 0.15, 0]));
}

export interface TreeV2Branch { start: V3; end: V3; r0: number; r1: number; order: number; key: string }
/**
 * Товщина деревини відносно моделі (ADR-0222): референс власника — кремезний
 * стовбур під круглою кроною. Модель росту (`trunkRadius`) лишається як є,
 * змінюється лише те, як її зображено; зведення двійника радіусів не містить.
 */
export const TREE_GIRTH = 1.5;

export interface TreeV2Cluster {
  centre: V3;
  radius: number;
  key: string;
  /** Сплющення крони по висоті: дуб 0.82, ялина пласка лапа, сакура хмаринка. */
  squash?: number;
}

/**
 * Форма дерева (ADR-0237 §4.3): ТОЙ САМИЙ ріст — яруси, гілки років,
 * плани, спогади — інший малюнок. Модель і таблиця модулів однакові.
 */
export type TreeForm = 'oak' | 'spruce' | 'sakura';
export const TREE_FORMS: readonly TreeForm[] = ['oak', 'spruce', 'sakura'];

interface FormRules {
  /** Верх провідника — частка висоти моделі. */
  top: number;
  /** Кут гілки року над горизонтом: тихий рік, і на скільки нижче — повний. */
  rise: number;
  fall: number;
  /** Досяжність гілки ярусу `tier` на висоті `y` (у частках H). */
  reach: (H: number, tier: number, y: number, topY: number) => number;
  /** Скільки порядків розгалуження на вік гілки. */
  depth: (age: number) => number;
  squash: number;
  leaf: number;
  lean: number;
  /** Де ярус виходить зі стовбура: частка висоти дерева наприкінці року відкриття. */
  tierAt: number;
}

const FORMS: Record<TreeForm, FormRules> = {
  oak: {
    top: 0.86, rise: 50, fall: 30,
    // 0.5 → 0.4 (власник, 2026-09-29: «гілки дерев занадто довгі»).
    reach: (H, tier) => (0.4 * H) / (1 + 0.18 * tier),
    depth: (age) => 1 + Math.min(2, Math.floor(age / 2)),
    squash: 0.82, leaf: 1, lean: 1, tierAt: 0.62,
  },
  // Ялина: стовбур до самої верхівки, гілки майже горизонтальні й коротшають
  // догори — крона конусом; лапи пласкі.
  spruce: {
    top: 0.98, rise: 14, fall: 16,
    reach: (H, _tier, y, topY) => 0.37 * H * Math.max(0.12, 1 - y / topY),
    depth: (age) => 1 + Math.min(1, Math.floor(age / 3)),
    squash: 0.42, leaf: 1.15, lean: 0.3,
    // Кільце гілок ялини — там, де того року була верхівка.
    tierAt: 0.9,
  },
  // Сакура: низький нахилений стовбур, довгі розлогі гілки, плоска
  // хмаринка крони.
  sakura: {
    top: 0.58, rise: 32, fall: 26,
    // 0.51 → 0.36 (власник, 2026-10-04: «у сакури дуже довгі гілки»).
    reach: (H, tier) => (0.36 * H) / (1 + 0.12 * tier),
    depth: (age) => 1 + Math.min(2, Math.floor(age / 2)),
    squash: 0.6, leaf: 1.12, lean: 2.2, tierAt: 0.62,
  },
};

/** Висота, на якій ярус `tier` виходить зі стовбура (ADR-0237). */
export function treeV2TierHeight(model: TreeV2Model, tier: number, form: TreeForm = 'oak'): number {
  const first = model.yearBranches.find((b) => b.tier === tier);
  const opened = first ? first.year : 0;
  // Ярус стоїть на висоті, яку дерево мало, коли його рік прожито; далі
  // стовбур росте вище, а ярус лишається де був — як справжня гілка.
  return FORMS[form].tierAt * Math.min(treeHeightAt(opened + 1), model.height);
}

/** Напрям осі стовбура: нахил моделі, помножений на нахил форми. */
function treeTrunkDir(model: TreeV2Model, form: TreeForm): V3 {
  const lean = rad(model.lean * FORMS[form].lean);
  const leanAz = rad(model.leanAzimuth);
  return [Math.sin(lean) * Math.cos(leanAz), Math.cos(lean), Math.sin(lean) * Math.sin(leanAz)];
}

/** Вузол на осі стовбура на висоті `y` (стовбур трохи похилений). */
function trunkAt(dir: V3, y: number): V3 {
  return mul(dir, y / dir[1]);
}

export function treeV2Skeleton(model: TreeV2Model, form: TreeForm = 'oak'): { branches: TreeV2Branch[]; clusters: TreeV2Cluster[] } {
  const rules = FORMS[form];
  const seed = model.startDate;
  const H = model.height;
  const { leafiness } = model;
  const trunkDir = treeTrunkDir(model, form);
  const branches: TreeV2Branch[] = [];
  const clusters: TreeV2Cluster[] = [];
  // Радіуси — у частках стовбура біля землі; у кінці множаться на товщину.
  const trunkRel = (y: number) => 1 - 0.55 * Math.min(1, y / H);

  const grow = (start: V3, direction: V3, length: number, order: number, last: number, key: string, radius: number, thinning: number): void => {
    const end = add(start, mul(direction, length));
    const r1 = Math.max(radius * thinning, 0.004);
    branches.push({ start, end, r0: radius, r1, order, key });
    if (order >= last - 1 && order > 0) {
      // Кінчик і передостанній порядок несуть листя.
      const size = (0.08 + 0.34 * length) * leafiness * (order === last ? 0.9 : 0.7) * rules.leaf;
      clusters.push({ centre: end, radius: size, key, squash: rules.squash });
    }
    if (order === last) return;
    const turn = 137.5 * order + 360 * unit(seed, `${key}:turn`);
    const cont = deviate(direction, 18 + 16 * unit(seed, `${key}:ca`) - 8, turn);
    const side = deviate(direction, 42 + 24 * unit(seed, `${key}:sa`) - 12, turn + 180);
    const thin = order + 1 < last ? 0.7 : 0.5;
    // Продовження — тієї ж товщини, що й кінець батьківської: без сходинки.
    grow(end, cont, length * 0.74, order + 1, last, `${key}.c`, r1, thin);
    grow(end, side, length * 0.62, order + 1, last, `${key}.s`, r1 * 0.65, thin);
  };

  // Стовбур: сегмент до кожного ярусу, далі провідник до верхівки. Кожен
  // сегмент починається там, де скінчився попередній: вузли закривають стик.
  const stops = Array.from({ length: model.tiers }, (_, t) => treeV2TierHeight(model, t, form));
  const topY = rules.top * H;
  const heights = [...stops.filter((y) => y < topY - 1e-9), topY];
  let from: V3 = [0, 0, 0];
  let fromY = 0;
  heights.forEach((y, i) => {
    const to = trunkAt(trunkDir, y);
    branches.push({ start: from, end: to, r0: trunkRel(fromY), r1: trunkRel(y), order: 0, key: `t${i}` });
    from = to;
    fromY = y;
  });

  // Гілки років: ярусами по 3 або 4 довкола стовбура.
  for (const yb of model.yearBranches) {
    const key = `y${yb.year}`;
    const y = stops[yb.tier]!;
    const az = (yb.slot * 360) / yb.size + yb.tier * 137.5 + (unit(seed, `${key}:az`) - 0.5) * 24;
    // Тиха гілка дивиться вгору (~50°), насичена майже горизонтальна (~20°).
    const el = rules.rise - rules.fall * yb.fertility + (unit(seed, `${key}:el`) - 0.5) * 8;
    const d: V3 = [Math.cos(rad(el)) * Math.cos(rad(az)), Math.sin(rad(el)), Math.cos(rad(el)) * Math.sin(rad(az))];
    const grown = 1 - Math.exp(-(yb.age + 0.25) / 2);
    const reach = rules.reach(H, yb.tier, y, topY);
    const length = reach * (0.35 + 0.65 * grown) * yearBoost(yb.activity) * (0.9 + 0.2 * unit(seed, `${key}:len`));
    // Молода гілка — один пагін; з роками розгалужується, до трьох порядків.
    const last = rules.depth(yb.age);
    const start = trunkAt(trunkDir, y);
    grow(start, d, length, 1, last, key, trunkRel(y) * 0.55 * (0.6 + 0.4 * grown), 0.6);
    // Ялина: лапа хвої вздовж усієї гілки, а не лише на кінчику.
    if (form === 'spruce') clusters.push({ centre: add(start, mul(d, length * 0.55)), radius: length * 0.42 * leafiness, key: `${key}:paw`, squash: rules.squash });
  }

  // Ялина: між кільцями — короткі проміжні лапи, як у справжньої ялини між
  // мутовками. Це малюнок форми, а не елемент року: число й довжина — лише
  // від висоти, тож таблиця модулів не змінюється.
  if (form === 'spruce') {
    const marks = [0, ...heights];
    for (let i = 1; i < marks.length; i += 1) {
      for (const f of [1 / 3, 2 / 3]) {
        const y = marks[i - 1]! + (marks[i]! - marks[i - 1]!) * f;
        if (y < H * 0.18) continue;
        const key = `m${i}:${f < 0.5 ? 'a' : 'b'}`;
        const az = 360 * unit(seed, `${key}:az`);
        const el = 10 + 8 * unit(seed, `${key}:el`);
        const d: V3 = [Math.cos(rad(el)) * Math.cos(rad(az)), Math.sin(rad(el)), Math.cos(rad(el)) * Math.sin(rad(az))];
        const length = rules.reach(H, 0, y, topY) * 0.6;
        const start = trunkAt(trunkDir, y);
        branches.push({ start, end: add(start, mul(d, length)), r0: trunkRel(y) * 0.25, r1: trunkRel(y) * 0.1, order: 2, key });
        clusters.push({ centre: add(start, mul(d, length * 0.6)), radius: length * 0.45 * leafiness, key: `${key}:paw`, squash: rules.squash });
      }
    }
  }

  // Верхівка: гілки планів розходяться від провідника вгору й убік.
  const top = trunkAt(trunkDir, topY);
  // Ялина закінчується шпилем: гостра верхівка над гілками планів.
  if (form === 'spruce') clusters.push({ centre: top, radius: 0.1 * H * leafiness, key: 'spire', squash: 1.7 });
  for (let i = 0; i < model.crownLimbs; i += 1) {
    const key = `c${i}`;
    const az = (i * 360) / model.crownLimbs + (unit(seed, `${key}:az`) - 0.5) * 40;
    const el = 55 + 15 * unit(seed, `${key}:el`);
    const d: V3 = [Math.cos(rad(el)) * Math.cos(rad(az)), Math.sin(rad(el)), Math.cos(rad(el)) * Math.sin(rad(az))];
    const limb = form === 'spruce' ? 0.1 : form === 'sakura' ? 0.24 : 0.28;
    grow(top, d, limb * H * (0.85 + 0.3 * unit(seed, `${key}:len`)), 1, 2, key, trunkRel(topY) * 0.6, 0.6);
  }

  const girth = model.trunkRadius * TREE_GIRTH;
  for (const b of branches) {
    b.r0 *= girth;
    b.r1 *= girth;
  }
  return { branches, clusters };
}

export function treeV2Roots(model: TreeV2Model): Omit<TreeV2Branch, 'order'>[] {
  const seed = model.startDate;
  const n = model.roots;
  const r = model.trunkRadius * TREE_GIRTH;
  const out: Omit<TreeV2Branch, 'order'>[] = [];
  for (let i = 0; i < n; i += 1) {
    const phi = rad((i * 360) / n + (unit(seed, `root${i}:az`) - 0.5) * 40);
    const length = model.rootReach * (0.7 + 0.5 * unit(seed, `root${i}:len`));
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const a: V3 = [c * r * 0.3, r * 0.6, s * r * 0.3];
    const mid: V3 = [c * length * 0.4, length * 0.08, s * length * 0.4];
    const end: V3 = [c * length, -length * 0.05, s * length];
    out.push({ start: a, end: mid, r0: r * 0.75, r1: r * 0.4, key: `root${i}a` });
    out.push({ start: mid, end, r0: r * 0.4, r1: r * 0.08, key: `root${i}b` });
  }
  return out;
}

export interface TreeV2Ornaments {
  /** Стрічки бажань: де стрічку зав'язано (низ крони гілки свого року). */
  blossoms: { position: V3 }[];
  fruits: V3[];
  fireflies: V3[];
  flowers: { position: V3; tint: number }[];
  crownRadius: number;
  meadowRadius: number;
}

export function treeV2Ornaments(model: TreeV2Model, clusters: readonly TreeV2Cluster[]): TreeV2Ornaments {
  const seed = model.startDate;
  const n = clusters.length;
  const onCluster = (tag: string, upward: boolean, depth: number, pool: readonly TreeV2Cluster[] = clusters): V3 => {
    const c = pool[Math.min(pool.length - 1, Math.floor(unit(seed, `${tag}:c`) * pool.length))]!;
    const y = upward ? 0.2 + 0.8 * unit(seed, `${tag}:y`) : -(0.3 + 0.5 * unit(seed, `${tag}:y`));
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = 2 * Math.PI * unit(seed, `${tag}:phi`);
    return add(c.centre, mul([ring * Math.cos(phi), y, ring * Math.sin(phi)], c.radius * depth));
  };
  // Стрічка бажання зав'язана знизу на кроні гілки СВОГО року (ADR-0237,
  // поправка 2026-10-04): звисає з-під листя, а не лежить на ньому.
  const blossoms = model.blossoms.map((b) => {
    const own = clusters.filter((c) => c.key === `y${b.year}` || c.key.startsWith(`y${b.year}.`));
    return { position: onCluster(`blossom${b.id}`, false, 1.0, own.length > 0 ? own : clusters) };
  });
  const fruits = Array.from({ length: model.fruits }, (_, k) => onCluster(`fruit${k}`, false, 0.92));

  const crownMid = clusters.reduce((sum, c) => sum + c.centre[1], 0) / n;
  const crownRadius = Math.max(...clusters.map((c) => Math.hypot(c.centre[0], c.centre[2]) + c.radius));
  const fireflies = Array.from({ length: model.fireflies }, (_, k): V3 => {
    const phi = 2 * Math.PI * unit(seed, `fly${k}:phi`);
    const rr = crownRadius * (0.6 + 0.7 * unit(seed, `fly${k}:r`));
    const y = crownMid + (unit(seed, `fly${k}:y`) - 0.5) * model.height * 0.8;
    return [Math.cos(phi) * rr, Math.max(0.15, y), Math.sin(phi) * rr];
  });

  const inner = Math.max(0.35, model.rootReach * 1.1);
  const outer = inner + 1.2 + crownRadius * 0.8;
  const flowers = Array.from({ length: model.flowers }, (_, k) => {
    const phi = 2 * Math.PI * unit(seed, `flower${k}:phi`);
    const rr = Math.sqrt(inner * inner + (outer * outer - inner * inner) * unit(seed, `flower${k}:r`));
    return { position: [Math.cos(phi) * rr, 0, Math.sin(phi) * rr] as V3, tint: Math.floor(unit(seed, `flower${k}:tint`) * 4) };
  });
  return { blossoms, fruits, fireflies, flowers, crownRadius, meadowRadius: outer + 0.6 };
}

const q = (x: number) => Math.floor(x * 1e4 + 0.5) / 1e4;

/** Що звіряється з двійником: скільки чого й де межі дерева (до 10⁻⁴). */
export function treeV2Summary(model: TreeV2Model) {
  const { branches, clusters } = treeV2Skeleton(model);
  const orn = treeV2Ornaments(model, clusters);
  return {
    branches: branches.length,
    clusters: clusters.length,
    top: q(Math.max(...clusters.map((c) => c.centre[1] + c.radius))),
    reach: q(Math.max(...branches.map((b) => Math.max(Math.abs(b.end[0]), Math.abs(b.end[2]))))),
    crownRadius: q(orn.crownRadius),
    meadowRadius: q(orn.meadowRadius),
    firstBlossom: orn.blossoms[0] ? orn.blossoms[0].position.map(q) : null,
  };
}

// ── Меш ─────────────────────────────────────────────────────
function icosphere(): { verts: V3[]; faces: [number, number, number][] } {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts: V3[] = ([
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ] as V3[]).map(norm);
  const base: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
    [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5],
    [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  const cache = new Map<string, number>();
  const mid = (i: number, j: number): number => {
    const k = `${Math.min(i, j)}:${Math.max(i, j)}`;
    const hit = cache.get(k);
    if (hit !== undefined) return hit;
    const a = verts[i]!;
    const b = verts[j]!;
    verts.push(norm([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]));
    cache.set(k, verts.length - 1);
    return verts.length - 1;
  };
  const faces: [number, number, number][] = [];
  for (const [a, b, c] of base) {
    const ab = mid(a, b);
    const bc = mid(b, c);
    const ca = mid(c, a);
    faces.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
  }
  return { verts, faces };
}

const ICO = icosphere();

/**
 * Стик гілок без наростів (власник, 2026-10-04: «на місцях швів ти додав
 * нарости … зробити весь стовбур монолітним, шви непомітними»).
 *
 * Раніше щілину на розвилці закривала гранчаста куля-«вузол», і вона
 * читалась як наріст. Тепер щілину закриває сама гілка: кожна, крім
 * стовбура, починається трохи ВСЕРЕДИНІ батьківської — подовжена назад
 * уздовж власного напрямку на `JOINT_OVERLAP` свого радіуса. Продовження
 * гілки не тоншає стрибком (`r0` = `r1` батьківської), а грані всієї
 * деревини мають один тон за номером грані, тож стик не видно й за кольором.
 */
export const JOINT_OVERLAP = 1.3;

export function treeV2WoodSegment(b: TreeV2Branch): { start: V3; end: V3 } {
  if (b.order === 0) return { start: b.start, end: b.end };
  const d = norm([b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2]]);
  return { start: add(b.start, mul(d, -b.r0 * JOINT_OVERLAP)), end: b.end };
}

/** Пласкі трикутники призми, закручені НАЗОВНІ (перевіряє тест). */
function prism(start: V3, end: V3, r0: number, r1: number, sides: number): V3[][] {
  const d = norm([end[0] - start[0], end[1] - start[1], end[2] - start[2]]);
  const [a, b] = basis(d);
  const ring0: V3[] = [];
  const ring1: V3[] = [];
  for (let i = 0; i < sides; i += 1) {
    const ang = (2 * Math.PI * i) / sides;
    const o = add(mul(a, Math.cos(ang)), mul(b, Math.sin(ang)));
    ring0.push(add(start, mul(o, r0)));
    ring1.push(add(end, mul(o, r1)));
  }
  const tris: V3[][] = [];
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    tris.push([ring0[i]!, ring0[j]!, ring1[j]!], [ring0[i]!, ring1[j]!, ring1[i]!]);
  }
  return tris;
}


export interface TreeV2Geometry {
  /** Стовбур, гілки й коріння: позиції та тон кожної грані. */
  wood: { positions: Float32Array; tone: Float32Array };
  /** Крона: позиції, тон грані й чи осіння вона (0/1). */
  leaves: { positions: Float32Array; tone: Float32Array; autumn: Float32Array };
  /** Квіти бажань: крихітні октаедри, канал кольору на вершину (0 червоний, 1 блакитний, 2 зелений). */
  /**
   * Плоди й квіти бажань — за формою дерева (власник, 2026-10-04): дуб —
   * яблука, сакура — квітки, ялина — шишки. Колір на вершину (`colour`,
   * RGB 0..1); `sway` — 0 там, де прикраса тримається, … 1 на кінчику, для
   * вітру в шейдері. Каналу «хто виконав» немає: це мова кристала.
   */
  wishes: { positions: Float32Array; colour: Float32Array; sway: Float32Array };
  fruits: Float32Array;
  fireflies: Float32Array;
  flowers: { positions: Float32Array; tint: Float32Array };
  height: number;
  crownRadius: number;
  meadowRadius: number;
}

/**
 * Крона ялини (власник, 2026-10-04, референс — класична low-poly ялина):
 * ярусні «спіднички» — гранчасті конуси з опущеним, складчастим краєм, що
 * меншають догори до гострої верхівки. Яруси стоять там, де кільця гілок
 * років (і посередині між ними, як проміжні мутовки), тож дерево, як і
 * раніше, додає «спідничку» з кожним новим ярусом. Гілка року не губиться
 * під хвоєю: край «спіднички» в її бік витягнутий до її кінчика, тож
 * насичений рік читається довшою лапою.
 */
export function treeV2SpruceSkirts(model: TreeV2Model, clusters: readonly TreeV2Cluster[]): { tris: V3[][]; tone: number[] } {
  const seed = model.startDate;
  const rules = FORMS.spruce;
  const H = model.height;
  const topY = rules.top * H;
  const dir = treeTrunkDir(model, 'spruce');
  const stops = Array.from({ length: model.tiers }, (_, t) => treeV2TierHeight(model, t, 'spruce')).filter((y) => y < topY - 1e-9);

  // Рівні: кільця ярусів і середина між сусідніми, якщо проміжок великий.
  const marks = [0, ...stops, topY];
  const levels: { y: number; tier: number }[] = [];
  for (let i = 1; i < marks.length; i += 1) {
    const lo = marks[i - 1]!;
    const hi = marks[i]!;
    if (hi - lo > 0.16 * H) levels.push({ y: (lo + hi) / 2, tier: -1 });
    if (i < marks.length - 1) levels.push({ y: hi, tier: i - 1 });
  }
  // Кільце року малюється завжди; проміжна — лише вище за низ стовбура.
  // Кільця під самим шпилем віддають свої лапи йому.
  const tipY = topY - 0.08 * H;
  const kept = levels.filter((l) => (l.tier >= 0 || l.y >= 0.2 * H) && l.y <= tipY - 0.04 * H);
  const spireTiers = levels.filter((l) => l.tier >= 0 && l.y > tipY - 0.04 * H).map((l) => l.tier);

  // Лапи гілок років: азимут і горизонтальна досяжність кінчика.
  const lobes = model.yearBranches.map((yb) => {
    const paw = clusters.find((c) => c.key === `y${yb.year}:paw`);
    const axis = trunkAt(dir, stops[yb.tier] ?? 0);
    const dx = paw ? paw.centre[0] - axis[0] : 0;
    const dz = paw ? paw.centre[2] - axis[2] : 0;
    // Лапа стоїть на 0.55 довжини гілки.
    return { tier: yb.tier, az: Math.atan2(dz, dx), reach: Math.hypot(dx, dz) / 0.55 };
  });

  const tris: V3[][] = [];
  const tone: number[] = [];
  const N = 12;
  const skirt = (key: string, y: number, base: number, rise: number, lobesHere: typeof lobes, light: number) => {
    const phase = (2 * Math.PI * unit(seed, `${key}:phase`)) / N;
    const centre = trunkAt(dir, y);
    const apex = trunkAt(dir, y + rise);
    const rim: V3[] = [];
    for (let i = 0; i < N; i += 1) {
      const a = phase + (2 * Math.PI * i) / N;
      let r = base;
      for (const l of lobesHere) {
        const c = Math.max(0, Math.cos(a - l.az));
        r = Math.max(r, base + (l.reach * 1.04 - base) * c ** 6);
      }
      // Складки: кінчик лапи довший і нижчий, западина між ними — коротша й вища.
      const tip = i % 2 === 0;
      const rr = r * (tip ? 1 : 0.8) * (0.95 + 0.1 * unit(seed, `${key}:r${i}`));
      // Довга лапа року провисає трохи більше, але не лягає на землю.
      const drop = base * (tip ? 0.24 : 0.1) + (r - base) * 0.12;
      rim.push([centre[0] + Math.cos(a) * rr, y - drop, centre[2] + Math.sin(a) * rr]);
    }
    const under = trunkAt(dir, y - base * 0.08);
    for (let i = 0; i < N; i += 1) {
      const p = rim[i]!;
      const q = rim[(i + 1) % N]!;
      // Верх: грань, що дивиться на світло, світліша; складки чергуються.
      tris.push([apex, q, p]);
      tone.push(light * ((i % 2 === 0 ? 1.08 : 0.9) + 0.1 * unit(seed, `${key}:f${i}`)));
      // Низ: темний, замикає «спідничку» до стовбура.
      tris.push([under, p, q]);
      tone.push(light * 0.58);
    }
  };

  kept.forEach((l, i) => {
    const f = l.y / topY;
    const base = rules.reach(H, 0, l.y, topY) * 1.05;
    const here = l.tier >= 0 ? lobes.filter((b) => b.tier === l.tier) : [];
    skirt(`skirt${i}`, l.y, base, base * 0.85, here, 0.88 + 0.22 * f);
  });
  // Верхівка: вузький гострий конус.
  skirt('spire', tipY, 0.075 * H, 0.2 * H, lobes.filter((b) => spireTiers.includes(b.tier)), 1.12);
  return { tris, tone };
}

/**
 * Де висить прикраса кожного бажання (у порядку `model.blossoms`): дуб —
 * яблуко з-під крони гілки свого року (`treeV2Ornaments`, звіряє двійник);
 * сакура — квітка на верхньому боці крони, де її видно; ялина — шишка на
 * кінчику гілки свого року, на краю «спіднички», а не під хвоєю.
 */
export function treeV2WishPoints(model: TreeV2Model, form: TreeForm, skeleton?: { branches: readonly TreeV2Branch[]; clusters: readonly TreeV2Cluster[] }): V3[] {
  const seed = model.startDate;
  const { branches, clusters } = skeleton ?? treeV2Skeleton(model, form);
  const orn = treeV2Ornaments(model, clusters);
  return model.blossoms.map((b, k) => {
    if (form === 'oak') return orn.blossoms[k]!.position;
    if (form === 'spruce') {
      const own = branches.find((x) => x.key === `y${b.year}`);
      const top = trunkAt(treeTrunkDir(model, form), FORMS[form].top * model.height);
      return own ? own.end : top;
    }
    const own = clusters.filter((c) => c.key === `y${b.year}` || c.key.startsWith(`y${b.year}.`));
    const pool = own.length > 0 ? own : clusters;
    const c = pool[Math.min(pool.length - 1, Math.floor(unit(seed, `wish${b.id}:c`) * pool.length))]!;
    const y = 0.25 + 0.6 * unit(seed, `wish${b.id}:y`);
    const ring = Math.sqrt(1 - y * y);
    const a = 2 * Math.PI * unit(seed, `wish${b.id}:a`);
    const sq = c.squash ?? 0.82;
    // Крона сакури гранчаста й нерівна (вершини до 1.28 радіуса): квітка
    // сидить зовні неї, а не тоне в листі.
    return add(c.centre, [ring * Math.cos(a) * c.radius * 1.32, y * c.radius * sq * 1.32, ring * Math.sin(a) * c.radius * 1.32]);
  });
}

export function buildTreeV2Geometry(model: TreeV2Model, form: TreeForm = 'oak'): TreeV2Geometry {
  const seed = model.startDate;
  const { branches, clusters } = treeV2Skeleton(model, form);
  const orn = treeV2Ornaments(model, clusters);

  const wood: number[] = [];
  const woodTone: number[] = [];
  const pushTris = (tris: V3[][], out: number[], tones: number[], tone: (face: number) => number) => {
    tris.forEach((tri, k) => {
      const value = tone(Math.floor(k / 2));
      for (const p of tri) {
        out.push(p[0], p[1], p[2]);
        tones.push(value);
      }
    });
  };
  // Ялина: гілки сховані під «спідничками» хвої — видно лише стовбур.
  const spruce = form === 'spruce';
  for (const b of spruce ? branches.filter((x) => x.order === 0) : branches) {
    const seg = treeV2WoodSegment(b);
    pushTris(prism(seg.start, seg.end, b.r0, b.r1, 6), wood, woodTone, (face) => 0.86 + 0.28 * unit(seed, `bark:${face}`));
  }
  for (const r of treeV2Roots(model)) {
    pushTris(prism(r.start, r.end, r.r0, r.r1, 5), wood, woodTone, (face) => 0.75 + 0.3 * unit(seed, `${r.key}:w${face}`));
  }

  const leaves: number[] = [];
  const leafTone: number[] = [];
  const leafAutumn: number[] = [];
  if (spruce) {
    // Ялина вічнозелена: осені в неї немає.
    const { tris, tone } = treeV2SpruceSkirts(model, clusters);
    tris.forEach((tri, k) => {
      for (const p of tri) {
        leaves.push(p[0], p[1], p[2]);
        leafTone.push(tone[k]!);
        leafAutumn.push(0);
      }
    });
  }
  for (const c of spruce ? [] : clusters) {
    const pts = ICO.verts.map((v, i): V3 => {
      const k = c.radius * 1.14 * (0.82 + 0.3 * unit(seed, `${c.key}:v${i}`));
      return [c.centre[0] + v[0] * k, c.centre[1] + v[1] * k * (c.squash ?? 0.82), c.centre[2] + v[2] * k];
    });
    const autumn = unit(seed, `${c.key}:autumn`) < model.autumn ? 1 : 0;
    ICO.faces.forEach(([a, b, cc], k) => {
      const tone = 0.85 + 0.3 * unit(seed, `${c.key}:f${k}`);
      for (const p of [pts[a]!, pts[b]!, pts[cc]!]) {
        leaves.push(p[0], p[1], p[2]);
        leafTone.push(tone);
        leafAutumn.push(autumn);
      }
    });
  }

  const wishPos: number[] = [];
  const wishCol: number[] = [];
  const wishSway: number[] = [];
  const rgb = (hex: string): V3 => {
    const n = parseInt(hex.slice(1), 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  };
  const tri = (a: V3, b: V3, c: V3, col: V3, sa = 0, sb = 0, sc = 0) => {
    for (const [p, s] of [[a, sa], [b, sb], [c, sc]] as const) {
      wishPos.push(p[0], p[1], p[2]);
      wishCol.push(col[0], col[1], col[2]);
      wishSway.push(s);
    }
  };
  // Прикрасу видно з відстані камери: яблуко завбільшки з кулачок листя.
  const size = Math.max(0.08, model.height * 0.045);
  treeV2WishPoints(model, form, { branches, clusters }).forEach((p, k) => {
    const phi = 2 * Math.PI * unit(seed, `wish${k}:phi`);
    const out: V3 = [Math.cos(phi), 0, Math.sin(phi)];
    if (form === 'oak') {
      // Яблуко: гранчаста куля з рум'янцем, хвостик і листочок.
      const r = size * 0.72;
      const c: V3 = [p[0], p[1] - size * 0.35 - r, p[2]];
      const red = rgb('#d8323e');
      const blush = rgb('#f2734a');
      const dark = rgb('#a8202e');
      ICO.faces.forEach(([i, j, l], f) => {
        const v = [ICO.verts[i]!, ICO.verts[j]!, ICO.verts[l]!].map((q): V3 => [c[0] + q[0] * r, c[1] + q[1] * r * 0.9, c[2] + q[2] * r]);
        const up = (v[0]![1] + v[1]![1] + v[2]![1]) / 3 > c[1];
        const col = unit(seed, `wish${k}:f${f}`) < 0.25 ? blush : up ? red : dark;
        tri(v[0]!, v[1]!, v[2]!, col, 0.6, 0.6, 0.6);
      });
      const side: V3 = [-out[2], 0, out[0]];
      const top: V3 = [c[0], c[1] + r * 0.9, c[2]];
      const brown = rgb('#6e4426');
      tri(p, add(top, mul(side, size * 0.05)), add(top, mul(side, -size * 0.05)), brown, 0, 0.5, 0.5);
      const leafTip = add(add(p, mul(out, size * 0.55)), [0, -size * 0.1, 0]);
      const green = rgb('#4f9e3c');
      tri(p, add(add(p, mul(out, size * 0.28)), [0, size * 0.12, 0]), leafTip, green, 0, 0.3, 0.5);
      tri(p, leafTip, add(add(p, mul(out, size * 0.28)), [0, -size * 0.14, 0]), rgb('#3f8a32'), 0, 0.5, 0.3);
    } else if (form === 'sakura') {
      // Квітка: п'ять пелюсток і жовта серединка, дивиться назовні й угору.
      const n = norm([out[0], 0.9, out[2]]);
      const [u, v] = basis(n);
      // Крона сакури блідо-рожева: квітка бажання — насичено-рожева зі
      // світлими кінчиками й жовтою серединкою, інакше її не видно.
      const R = size * 1.3;
      const centre: V3 = add(p, mul(n, size * 0.05));
      const petal = rgb('#ff5d8f');
      const tip = rgb('#ffc2d6');
      for (let q = 0; q < 5; q += 1) {
        const a0 = phi + (q / 5) * Math.PI * 2;
        const dir = (a: number) => add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
        const mid = add(centre, mul(dir(a0), R));
        const l = add(centre, mul(dir(a0 - 0.5), R * 0.62));
        const rr = add(centre, mul(dir(a0 + 0.5), R * 0.62));
        tri(centre, l, mid, petal, 0, 0.6, 1);
        tri(centre, mid, rr, tip, 0, 1, 0.6);
      }
      const yellow = rgb('#f6c14e');
      for (let q = 0; q < 5; q += 1) {
        const a0 = (q / 5) * Math.PI * 2;
        const a1 = ((q + 1) / 5) * Math.PI * 2;
        const raised = add(centre, mul(n, size * 0.06));
        tri(raised, add(raised, add(mul(u, Math.cos(a0) * R * 0.22), mul(v, Math.sin(a0) * R * 0.22))), add(raised, add(mul(u, Math.cos(a1) * R * 0.22), mul(v, Math.sin(a1) * R * 0.22))), yellow);
      }
    } else {
      // Шишка: витягнутий лускатий конус, що звисає кінчиком донизу.
      const len = size * 1.8;
      const rad = size * 0.5;
      const top: V3 = [p[0], p[1] - size * 0.12, p[2]];
      const rings = [0, 0.25, 0.55, 0.82].map((t, li) => {
        const r = rad * Math.sin(Math.min(1, (t + 0.18)) * Math.PI) * (li === 0 ? 0.55 : 1);
        return Array.from({ length: 6 }, (_, i): V3 => {
          const a = phi + ((i + (li % 2) * 0.5) / 6) * Math.PI * 2;
          return [top[0] + Math.cos(a) * r, top[1] - t * len, top[2] + Math.sin(a) * r];
        });
      });
      const tipPt: V3 = [top[0], top[1] - len, top[2]];
      const scale = [rgb('#8a5a34'), rgb('#6e4426'), rgb('#a8784a')];
      for (let li = 0; li + 1 < rings.length; li += 1) {
        for (let i = 0; i < 6; i += 1) {
          const j = (i + 1) % 6;
          const col = scale[(i + li) % 3]!;
          tri(rings[li]![i]!, rings[li + 1]![i]!, rings[li + 1]![j]!, col, li / 3, (li + 1) / 3, (li + 1) / 3);
          tri(rings[li]![i]!, rings[li + 1]![j]!, rings[li]![j]!, col, li / 3, (li + 1) / 3, li / 3);
        }
      }
      for (let i = 0; i < 6; i += 1) {
        const j = (i + 1) % 6;
        tri(rings[3]![i]!, tipPt, rings[3]![j]!, scale[i % 3]!, 1, 1, 1);
        tri(top, rings[0]![i]!, rings[0]![j]!, scale[1]!, 0, 0, 0);
      }
    }
  });

  return {
    wood: { positions: new Float32Array(wood), tone: new Float32Array(woodTone) },
    leaves: { positions: new Float32Array(leaves), tone: new Float32Array(leafTone), autumn: new Float32Array(leafAutumn) },
    wishes: { positions: new Float32Array(wishPos), colour: new Float32Array(wishCol), sway: new Float32Array(wishSway) },
    fruits: new Float32Array(orn.fruits.flat()),
    fireflies: new Float32Array(orn.fireflies.flat()),
    flowers: {
      positions: new Float32Array(orn.flowers.flatMap((f) => f.position)),
      tint: new Float32Array(orn.flowers.map((f) => f.tint)),
    },
    height: model.height,
    crownRadius: orn.crownRadius,
    meadowRadius: orn.meadowRadius,
  };
}
