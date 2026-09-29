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
import type { GiftChannel } from '../crystalV2/model';
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
    reach: (H, tier) => (0.51 * H) / (1 + 0.12 * tier),
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

/** Вузол на осі стовбура на висоті `y` (стовбур трохи похилений). */
function trunkAt(dir: V3, y: number): V3 {
  return mul(dir, y / dir[1]);
}

export function treeV2Skeleton(model: TreeV2Model, form: TreeForm = 'oak'): { branches: TreeV2Branch[]; clusters: TreeV2Cluster[] } {
  const rules = FORMS[form];
  const seed = model.startDate;
  const H = model.height;
  const { leafiness } = model;
  const lean = rad(model.lean * rules.lean);
  const leanAz = rad(model.leanAzimuth);
  const trunkDir: V3 = [Math.sin(lean) * Math.cos(leanAz), Math.cos(lean), Math.sin(lean) * Math.sin(leanAz)];
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
    grow(end, cont, length * 0.74, order + 1, last, `${key}.c`, r1 * 0.85, thin);
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
    const limb = form === 'spruce' ? 0.1 : form === 'sakura' ? 0.34 : 0.28;
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
  blossoms: { position: V3; channel: GiftChannel }[];
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
  // Квітка бажання сідає на гілку СВОГО року (ADR-0237), якщо та вже має листя.
  const blossoms = model.blossoms.map((b) => {
    const own = clusters.filter((c) => c.key === `y${b.year}` || c.key.startsWith(`y${b.year}.`));
    return { position: onCluster(`blossom${b.id}`, true, 0.98, own.length > 0 ? own : clusters), channel: b.channel };
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
 * Найменша відстань від центру до площини грані — наскільки кругла сфера
 * з ICO насправді. Вузол має накрити кільце радіуса r, тож його радіус
 * рахується від цієї величини, а не від радіуса вершин.
 */
export const ICO_INRADIUS = Math.min(...ICO.faces.map(([a, b, c]) => {
  const pa = ICO.verts[a]!;
  const n = norm(cross(
    [ICO.verts[b]![0] - pa[0], ICO.verts[b]![1] - pa[1], ICO.verts[b]![2] - pa[2]],
    [ICO.verts[c]![0] - pa[0], ICO.verts[c]![1] - pa[1], ICO.verts[c]![2] - pa[2]],
  ));
  return Math.abs(n[0] * pa[0] + n[1] * pa[1] + n[2] * pa[2]);
}));

/**
 * Вузли деревини — там, де з кінця гілки виходять дочірні.
 *
 * Кожна гілка — окрема відкрита призма. Дочірня тонша (0.85 чи 0.65 від
 * кінця батьківської), дивиться деінде й має власний поворот граней, тож на
 * розвилці лишалась щілина й видно було нутро стовбура: «розходяться шви»
 * (скрін власника, тестова пара 13 років, 2026-09-29). Вузол — гранчаста
 * куля трохи ширша за кінець гілки — закриває стик, як потовщення на справжній
 * розвилці. Модель і скелет не змінюються: лише те, як стик намальовано.
 */
export const KNUCKLE_MARGIN = 1.06;

export function treeV2Knuckles(branches: readonly TreeV2Branch[]): { centre: V3; radius: number; key: string }[] {
  const out: { centre: V3; radius: number; key: string }[] = [];
  for (const b of branches) {
    const children = branches.filter((c) => c !== b && c.start[0] === b.end[0] && c.start[1] === b.end[1] && c.start[2] === b.end[2]);
    if (children.length === 0) continue;
    const widest = Math.max(b.r1, ...children.map((c) => c.r0));
    out.push({ centre: b.end, radius: (widest * KNUCKLE_MARGIN) / ICO_INRADIUS, key: `${b.key}:knot` });
  }
  return out;
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

const CHANNEL_INDEX: Record<GiftChannel, number> = { red: 0, blue: 1, green: 2 };

export interface TreeV2Geometry {
  /** Стовбур, гілки й коріння: позиції та тон кожної грані. */
  wood: { positions: Float32Array; tone: Float32Array };
  /** Крона: позиції, тон грані й чи осіння вона (0/1). */
  leaves: { positions: Float32Array; tone: Float32Array; autumn: Float32Array };
  /** Квіти бажань: крихітні октаедри, канал кольору на вершину (0 червоний, 1 блакитний, 2 зелений). */
  blossoms: { positions: Float32Array; channel: Float32Array };
  fruits: Float32Array;
  fireflies: Float32Array;
  flowers: { positions: Float32Array; tint: Float32Array };
  height: number;
  crownRadius: number;
  meadowRadius: number;
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
  for (const b of branches) {
    // Тонкі гілки — п'ять граней, стовбур і скелетні — шість: той самий вигляд, менше трикутників.
    pushTris(prism(b.start, b.end, b.r0, b.r1, b.order < 2 ? 6 : 5), wood, woodTone,
      (face) => 0.82 + 0.36 * unit(seed, `${b.key}:w${face}`));
  }
  for (const k of treeV2Knuckles(branches)) {
    const tris = ICO.faces.map(([a, b, c]) => [a, b, c].map((i) => add(k.centre, mul(ICO.verts[i]!, k.radius))));
    tris.forEach((tri, f) => {
      const value = 0.82 + 0.36 * unit(seed, `${k.key}:w${f}`);
      for (const p of tri) {
        wood.push(p[0], p[1], p[2]);
        woodTone.push(value);
      }
    });
  }
  for (const r of treeV2Roots(model)) {
    pushTris(prism(r.start, r.end, r.r0, r.r1, 5), wood, woodTone, (face) => 0.75 + 0.3 * unit(seed, `${r.key}:w${face}`));
  }

  const leaves: number[] = [];
  const leafTone: number[] = [];
  const leafAutumn: number[] = [];
  for (const c of clusters) {
    const pts = ICO.verts.map((v, i): V3 => {
      const k = c.radius * 1.14 * (0.82 + 0.3 * unit(seed, `${c.key}:v${i}`));
      return [c.centre[0] + v[0] * k, c.centre[1] + v[1] * k * (c.squash ?? 0.82), c.centre[2] + v[2] * k];
    });
    // Ялина вічнозелена: осені в неї немає.
    const autumn = form !== 'spruce' && unit(seed, `${c.key}:autumn`) < model.autumn ? 1 : 0;
    ICO.faces.forEach(([a, b, cc], k) => {
      const tone = 0.85 + 0.3 * unit(seed, `${c.key}:f${k}`);
      for (const p of [pts[a]!, pts[b]!, pts[cc]!]) {
        leaves.push(p[0], p[1], p[2]);
        leafTone.push(tone);
        leafAutumn.push(autumn);
      }
    });
  }

  const blossom: number[] = [];
  const blossomChannel: number[] = [];
  // Квітку видно з відстані камери: 0.02 висоти на першому кадрі губилось у кроні.
  const size = Math.max(0.06, model.height * 0.035);
  const octa: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const octaFaces = [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [4, 3, 0], [1, 3, 4], [5, 3, 1], [0, 3, 5]];
  for (const b of orn.blossoms) {
    for (const face of octaFaces) {
      for (const i of face) {
        const v = octa[i]!;
        blossom.push(b.position[0] + v[0] * size, b.position[1] + v[1] * size * 0.6, b.position[2] + v[2] * size);
        blossomChannel.push(CHANNEL_INDEX[b.channel]);
      }
    }
  }

  return {
    wood: { positions: new Float32Array(wood), tone: new Float32Array(woodTone) },
    leaves: { positions: new Float32Array(leaves), tone: new Float32Array(leafTone), autumn: new Float32Array(leafAutumn) },
    blossoms: { positions: new Float32Array(blossom), channel: new Float32Array(blossomChannel) },
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
