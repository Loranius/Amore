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

/**
 * Живий стовбур (власник, 2026-10-05: «стовбур занадто прямий… легка
 * природна кривизна»): до нахилу додано м'який S-вигин — дуга в один бік
 * унизу й ледь назад угорі. Ялина лишається прямою: так росте хвойне.
 */
export function treeV2TrunkPoint(model: TreeV2Model, form: TreeForm, y: number): V3 {
  const base = trunkAt(treeTrunkDir(model, form), y);
  if (form === 'spruce') return base;
  const H = model.height;
  const t = Math.max(0, Math.min(1, y / (FORMS[form].top * H)));
  const az = 2 * Math.PI * unit(model.startDate, 'bend:a');
  const amp = 0.045 * H;
  const bow = Math.sin(Math.PI * t) * amp;
  const back = Math.sin(2 * Math.PI * t) * amp * 0.35;
  return [base[0] + Math.cos(az) * bow - Math.sin(az) * back, base[1], base[2] + Math.sin(az) * bow + Math.cos(az) * back];
}

/** Напрям стовбура на висоті `y` (дотична до вигину). */
function trunkTangent(model: TreeV2Model, form: TreeForm, y: number): V3 {
  const a = treeV2TrunkPoint(model, form, Math.max(0, y - 0.02));
  const b = treeV2TrunkPoint(model, form, y + 0.02);
  return norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
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
  // Біля землі стовбур розширюється напливом (власник, 2026-10-05: «стовбур
  // трохи товстіший біля основи»); у ялини — скромніше.
  const flare = form === 'spruce' ? 0.2 : 0.5;
  const trunkRel = (y: number) => (1 - 0.55 * Math.min(1, y / H)) * (1 + flare * Math.exp(-y / (0.06 * H)));
  const trunkPos = (y: number) => treeV2TrunkPoint(model, form, y);

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
  // Вузли стовбура: яруси, верх, а також проміжні — щоб вигин і наплив біля
  // землі були плавні, а не ламаною з двох прямих.
  const nodes: number[] = [...heights];
  if (form !== 'spruce') {
    const extras = [0.03 * H, 0.08 * H, ...Array.from({ length: 6 }, (_, k) => ((k + 1) / 7) * topY)];
    for (const e of extras) if (e < topY && nodes.every((n) => Math.abs(n - e) > 0.01 * H)) nodes.push(e);
    nodes.sort((a, b) => a - b);
  }
  let from: V3 = [0, 0, 0];
  let fromY = 0;
  nodes.forEach((y, i) => {
    const to = form === 'spruce' ? trunkAt(trunkDir, y) : trunkPos(y);
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
    const start = form === 'spruce' ? trunkAt(trunkDir, y) : trunkPos(y);
    // Гілка біля стовбура — 0.42 його товщини, не 0.55: товща читалась
    // прямою балкою-«брусочком» там, де її не прикриває листя (власник,
    // 2026-10-04: «прибери і ці брусочки біля основи гілок»). Різна
    // товщина й довжина (2026-10-05): гілки не однакові, як прикручені.
    const r0 = trunkRel(y) * 0.34 * (0.6 + 0.4 * grown) * (0.75 + 0.45 * unit(seed, `${key}:girth`));
    if (form === 'spruce') {
      grow(start, d, length, 1, last, key, r0, 0.6);
    } else {
      // Гілка виходить зі стовбура плавно: спершу майже вздовж нього, далі
      // відхиляється назовні (власник: «гілки виглядають як прикручені»).
      const along = trunkTangent(model, form, y);
      const exit = norm(add(mul(d, 0.5), mul(along, 0.5)));
      const first = length * 0.24;
      const mid = add(start, mul(exit, first));
      branches.push({ start, end: mid, r0: r0 * 1.06, r1: r0, order: 1, key: `${key}~` });
      grow(mid, d, length * 0.86, 1, last, key, r0, 0.6);
    }
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
  const top = form === 'spruce' ? trunkAt(trunkDir, topY) : trunkPos(topY);
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
  /** `cluster` — центр кластера, до якого зав'язано: від нього яблуко виходить з листя. */
  blossoms: { position: V3; cluster: V3 }[];
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
    const pool = own.length > 0 ? own : clusters;
    const tag = `blossom${b.id}`;
    const c = pool[Math.min(pool.length - 1, Math.floor(unit(seed, `${tag}:c`) * pool.length))]!;
    return { position: onCluster(tag, false, 1.0, pool), cluster: c.centre };
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
 * Крона — одна асиметрична маса, а не кульки на кінчиках (власник,
 * 2026-10-05: «переробити крону … 6–9 великих кластерів; кожен кластер із
 * 4–7 фасетних мас листя; без ідеальних сфер; більше вертикальної
 * структури; верхівка трохи ширша, але не кругла»).
 *
 * Кластери скелета (кінчики гілок) лишаються даними росту — їх бачить
 * двійник і голдени. Малюнок крони з них виводиться: кластери групуються
 * найвіддаленішими точками (від найвищого) у групи — по групі на ~4
 * кластери, не більше дев'яти, тож молоде дерево має 1–2 купки, а старе —
 * складну крону. Кожна група — 4–7 гранчастих мас: витягнуті вгору, з
 * пласкішим низом, кожна повернута по-своєму, підтягнуті до центру групи,
 * щоб купка читалась одним цілим. Маса накриває кожен свій кластер, тож
 * кінчик гілки не стирчить голим.
 */
export interface TreeV2CrownMass {
  centre: V3;
  /** Піввісі еліпсоїда маси (до тремтіння вершин). */
  scale: V3;
  /** Поворот навколо вертикалі, рад. */
  turn: number;
  key: string;
  group: number;
}

const dist3 = (a: V3, b: V3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Найвіддаленіші одна від одної точки, жадібно від `first`. */
function farthestPoints(pts: readonly V3[], count: number, first: number): number[] {
  const picked = [first];
  const gap = pts.map((p) => dist3(p, pts[first]!));
  while (picked.length < Math.min(count, pts.length)) {
    let far = 0;
    gap.forEach((g, i) => {
      if (g > gap[far]!) far = i;
    });
    if (gap[far]! <= 1e-9) break;
    picked.push(far);
    pts.forEach((p, i) => {
      gap[i] = Math.min(gap[i]!, dist3(p, pts[far]!));
    });
  }
  return picked;
}

/** Глибина точки в масі: 1 — на поверхні еліпсоїда, менше — всередині. */
function massDepth(p: V3, m: TreeV2CrownMass): number {
  const c = Math.cos(m.turn);
  const s = Math.sin(m.turn);
  const dx = p[0] - m.centre[0];
  const dz = p[2] - m.centre[2];
  const ly = p[1] - m.centre[1];
  const sy = m.scale[1] * (ly < 0 ? 0.8 : 1);
  return Math.hypot((dx * c + dz * s) / m.scale[0], ly / sy, (-dx * s + dz * c) / m.scale[2]);
}

export function treeV2CrownMasses(model: TreeV2Model, clusters: readonly TreeV2Cluster[]): TreeV2CrownMass[] {
  if (clusters.length === 0) return [];
  const seed = model.startDate;
  const centres = clusters.map((c) => c.centre);
  const highest = (pts: readonly V3[]) => pts.reduce((b, p, i) => (p[1] > pts[b]![1] ? i : b), 0);
  const groups = Math.max(1, Math.min(9, Math.round(clusters.length / 4)));
  const seeds = farthestPoints(centres, groups, highest(centres));
  const members: number[][] = seeds.map(() => []);
  centres.forEach((p, i) => {
    let best = 0;
    seeds.forEach((sd, g) => {
      if (dist3(p, centres[sd]!) < dist3(p, centres[seeds[best]!]!)) best = g;
    });
    members[best]!.push(i);
  });
  const crownMid = centres.reduce((sum, p) => sum + p[1], 0) / centres.length;
  const out: TreeV2CrownMass[] = [];
  members.forEach((list, g) => {
    if (list.length === 0) return;
    const gk = `crown${g}`;
    const weight = list.reduce((sum, i) => sum + clusters[i]!.radius, 0);
    const gc = list.reduce<V3>((sum, i) => add(sum, mul(centres[i]!, clusters[i]!.radius / weight)), [0, 0, 0]);
    const meanR = weight / list.length;
    const squash = clusters[list[0]!]!.squash ?? 0.82;
    const count = Math.max(4, Math.min(7, list.length + 2));
    // Кандидати — центри кластерів групи; бракує — довкола центру групи,
    // з нахилом угору (вертикальна структура).
    const pts: V3[] = list.map((i) => centres[i]!);
    for (let k = 0; pts.length < count; k += 1) {
      const phi = 2 * Math.PI * unit(seed, `${gk}:x${k}:phi`);
      const up = 0.2 + 0.6 * unit(seed, `${gk}:x${k}:up`);
      pts.push(add(gc, mul([Math.cos(phi) * (1 - up), up, Math.sin(phi) * (1 - up)], meanR * 0.75)));
    }
    // Маси — як k-середні: старт із найвіддаленіших точок, кожен кластер —
    // до найближчої маси, центр маси — середнє її кластерів, підтягнуте до
    // центру купки. Два кроки досить: точність тут — не мета, мета — щоб
    // кожна маса накривала свої кінчики гілок і не роздувалась.
    let centresOf = farthestPoints(pts, count - 1, highest(pts)).map((pi) => pts[pi]!);
    let owned: number[][] = [];
    for (let iter = 0; iter < 2; iter += 1) {
      owned = centresOf.map(() => []);
      for (const i of list) {
        let best = 0;
        centresOf.forEach((c, m) => {
          if (dist3(centres[i]!, c) < dist3(centres[i]!, centresOf[best]!)) best = m;
        });
        owned[best]!.push(i);
      }
      centresOf = centresOf.map((c, m) => {
        const mine = owned[m]!;
        if (mine.length === 0) return c;
        return mul(mine.reduce<V3>((sum, i) => add(sum, centres[i]!), [0, 0, 0]), 1 / mine.length);
      });
    }
    const placed = centresOf.map((c) => add(mul(c, 0.75), mul(gc, 0.25)));
    // Маса над центром купки — купка росте вгору, а не розпливається.
    placed.push(add(gc, [0, meanR * (0.7 + 0.3 * unit(seed, `${gk}:upper`)), 0]));
    owned.push([]);
    placed.forEach((centre, m) => {
      const key = `${gk}.${m}`;
      // Над серединою крони маси ширші: верхівка ширша, але не куля.
      const wide = centre[1] > crownMid ? 1.12 : 1;
      const shape: V3 = [
        (0.85 + 0.25 * unit(seed, `${key}:sx`)) * wide,
        squash * (1.1 + 0.25 * unit(seed, `${key}:sy`)),
        (0.85 + 0.25 * unit(seed, `${key}:sz`)) * wide,
      ];
      const mass: TreeV2CrownMass = { centre, scale: shape, turn: 2 * Math.PI * unit(seed, `${key}:turn`), key, group: g };
      // Розмір: не менший за свій, і такий, щоб кожен свій кінчик гілки
      // лежав не мілкіше 0.8 поверхні — гілка не стирчить голою.
      const need = Math.max(0, ...owned[m]!.map((i) => massDepth(centres[i]!, mass) / 0.8));
      const r = Math.max(meanR * (1.2 + 0.35 * unit(seed, `${key}:r`)), need);
      mass.scale = mul(shape, r);
      out.push(mass);
    });
  });
  return out;
}

/** Вершини маси крони: еліпсоїд із тремтінням, пласкіший знизу. */
function massBlob(seed: string, m: TreeV2CrownMass): V3[] {
  const c = Math.cos(m.turn);
  const s = Math.sin(m.turn);
  return ICO.verts.map((v, i): V3 => {
    const k = 0.84 + 0.28 * unit(seed, `${m.key}:v${i}`);
    const x = v[0] * m.scale[0] * k;
    const y = v[1] * m.scale[1] * k * (v[1] < 0 ? 0.8 : 1);
    const z = v[2] * m.scale[2] * k;
    return [m.centre[0] + x * c - z * s, m.centre[1] + y, m.centre[2] + x * s + z * c];
  });
}

/** Чи лежить точка в масі (у частках її еліпсоїда; `shrink` < 1 — глибше). */
function inMass(p: V3, m: TreeV2CrownMass, shrink: number): boolean {
  return massDepth(p, m) < shrink;
}

/**
 * Точка прикраси — на поверхні найближчої маси крони, у напрямку від її
 * центру: яблуко й ягода висять на листі, а не сховані всередині купки.
 */
export function treeV2OnCrown(masses: readonly TreeV2CrownMass[], p: V3, depth = 0.96, from?: V3): V3 {
  if (masses.length === 0) return p;
  if (from) {
    // Від своєї гілки — тим самим променем назовні, доки не вийде з листя:
    // яблуко лишається під гілкою свого року, а не стрибає на сусідню купку.
    const ray: V3 = [p[0] - from[0], p[1] - from[1], p[2] - from[2]];
    // Перший вихід із листя від центру кластера: яблуко на поверхні, не
    // глибоко в купці й не в повітрі під нею.
    for (let t = 0.05; t < 8; t += 0.05) {
      const q = add(from, mul(ray, t));
      if (masses.every((m) => massDepth(q, m) >= depth)) return q;
    }
    return p;
  }
  let q = p;
  // Винесена на поверхню однієї маси точка може лягти в сусідню — тоді
  // виносимо й з неї (кілька кроків вистачає: маси опуклі й їх мало поруч).
  for (let step = 0; step < 6; step += 1) {
    const m = masses.reduce((best, x) => (massDepth(q, x) < massDepth(q, best) ? x : best));
    const r = massDepth(q, m);
    if (step > 0 && r >= depth - 1e-9) break;
    if (r < 1e-9) {
      q = [m.centre[0], m.centre[1] - m.scale[1] * 0.8 * depth, m.centre[2]];
      continue;
    }
    const k = depth / r;
    q = [m.centre[0] + (q[0] - m.centre[0]) * k, m.centre[1] + (q[1] - m.centre[1]) * k, m.centre[2] + (q[2] - m.centre[2]) * k];
  }
  return q;
}

/**
 * Де сидять квітки бажань на сакурі (власник, 2026-10-04: «квіти неначе
 * літають у повітрі — прикріпи їх на листя і розподіли по дереву рівномірно»).
 *
 * Квітка лежить на самій грані листя (центр грані, площина грані), а не на
 * сфері 1.32 радіуса кластера, яка у западинах гранчастого листя висіла над
 * ним. Кандидати — грані, що дивляться назовні й хоч трохи вгору (бічну квітку
 * з камери видно рискою) і не сховані в сусідньому
 * кластері; з них беремо найвіддаленіші одна від одної (жадібно, від
 * найвищої), тож квітки розходяться по всій кроні, а не купчаться на гілці
 * свого року.
 */
/** Скільки квіток-прикрас між листям дуба: від шести років (етап «6+»). */
export function treeV2CrownFlowerCount(model: TreeV2Model): number {
  return model.years < 6 ? 0 : Math.min(14, 3 + Math.floor((model.years - 6) * 1.5));
}

export function treeV2SakuraFlowerSpots(model: TreeV2Model, clusters: readonly TreeV2Cluster[], count: number): { point: V3; normal: V3 }[] {
  if (count <= 0) return [];
  const seed = model.startDate;
  const masses = treeV2CrownMasses(model, clusters);
  const spots: { point: V3; normal: V3 }[] = [];
  for (const m of masses) {
    const pts = massBlob(seed, m);
    for (const [a, b, cc] of ICO.faces) {
      const A = pts[a]!;
      const B = pts[b]!;
      const C = pts[cc]!;
      const point: V3 = [(A[0] + B[0] + C[0]) / 3, (A[1] + B[1] + C[1]) / 3, (A[2] + B[2] + C[2]) / 3];
      const e1: V3 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
      const e2: V3 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
      let normal = norm([e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]);
      const outward: V3 = [point[0] - m.centre[0], point[1] - m.centre[1], point[2] - m.centre[2]];
      if (normal[0] * outward[0] + normal[1] * outward[1] + normal[2] * outward[2] < 0) normal = [-normal[0], -normal[1], -normal[2]];
      // Не в сусідній масі: квітка, схована в листі, — не квітка.
      if (normal[1] < 0.1 || masses.some((o) => o !== m && inMass(point, o, 0.84 * 0.95))) continue;
      spots.push({ point, normal });
    }
  }
  if (spots.length === 0) return [];
  const chosen: { point: V3; normal: V3 }[] = [];
  const gap = spots.map(() => Infinity);
  let next = spots.reduce((best, s, i) => (s.point[1] > spots[best]!.point[1] ? i : best), 0);
  for (let k = 0; k < count; k += 1) {
    const pick = spots[next]!;
    chosen.push(pick);
    let far = 0;
    spots.forEach((s, i) => {
      const d = Math.hypot(s.point[0] - pick.point[0], s.point[1] - pick.point[1], s.point[2] - pick.point[2]);
      if (d < gap[i]!) gap[i] = d;
      if (gap[i]! > gap[far]!) far = i;
    });
    next = far;
  }
  return chosen;
}

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

/**
 * Граней у перерізі деревини. Шість давали пласку світлу грань згори й темну
 * знизу — гілка читалась брусом; вісім уже кругла, але ще гранчаста.
 */
export const WOOD_SIDES = 8;

export function treeV2WoodSegment(b: TreeV2Branch): { start: V3; end: V3 } {
  if (b.order === 0) return { start: b.start, end: b.end };
  const d = norm([b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2]]);
  return { start: add(b.start, mul(d, -b.r0 * JOINT_OVERLAP)), end: b.end };
}

/** Пласкі трикутники призми, закручені НАЗОВНІ (перевіряє тест). */
/**
 * Призма деревини й нормалі її вершин. Нормалі — радіальні (з поправкою на
 * звуження), а не грані: гілка світиться як кругла, і плаский світлий верх із
 * темним низом більше не читається балкою-«брусочком» (власник, 2026-10-04).
 * Силует лишається гранчастим, як у всього світу.
 */
function prism(start: V3, end: V3, r0: number, r1: number, sides: number, frame?: V3, cap = false): { tris: V3[][]; normals: V3[][] } {
  const d = norm([end[0] - start[0], end[1] - start[1], end[2] - start[2]]);
  const [a, b] = frame ? [frame, cross(d, frame)] : basis(d);
  const ring0: V3[] = [];
  const ring1: V3[] = [];
  const radial: V3[] = [];
  const length = Math.max(1e-9, Math.hypot(end[0] - start[0], end[1] - start[1], end[2] - start[2]));
  for (let i = 0; i < sides; i += 1) {
    const ang = (2 * Math.PI * i) / sides;
    const o = add(mul(a, Math.cos(ang)), mul(b, Math.sin(ang)));
    ring0.push(add(start, mul(o, r0)));
    ring1.push(add(end, mul(o, r1)));
    radial.push(norm(add(o, mul(d, (r0 - r1) / length))));
  }
  const tris: V3[][] = [];
  const normals: V3[][] = [];
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    tris.push([ring0[i]!, ring0[j]!, ring1[j]!], [ring0[i]!, ring1[j]!, ring1[i]!]);
    normals.push([radial[i]!, radial[j]!, radial[j]!], [radial[i]!, radial[j]!, radial[i]!]);
  }
  // Кінчик закритий низьким конусом: відкрита труба знизу читається як
  // зрізаний короб (власник, 2026-10-04: «проблема у верхній частині дерева»).
  if (cap) {
    const tip = add(end, mul(d, r1 * 1.1));
    for (let i = 0; i < sides; i += 1) {
      const j = (i + 1) % sides;
      tris.push([ring1[i]!, ring1[j]!, tip]);
      normals.push([norm(add(radial[i]!, d)), norm(add(radial[j]!, d)), d]);
    }
  }
  return { tris, normals };
}

/**
 * Грані деревини йдуть одна в одну через стик (власник, 2026-10-04).
 *
 * Шестигранна призма кожної гілки досі брала довільний базис зі свого
 * напрямку, тож грань №k гілки дивилась кудись інакше, ніж грань №k її
 * батьківської: на стику ребра не сходились, світло стрибало, і продовження
 * читалось окремим коробом. Тепер базис ПЕРЕНОСИТЬСЯ від батьківської гілки
 * (паралельне перенесення: її вісь «a» проєктується на площину, перпендикулярну
 * до нової осі). Батько — гілка, з кінця якої росте ця; для гілок року й
 * верхівки — сегмент стовбура на тій висоті.
 */
export function treeV2WoodFrames(branches: readonly TreeV2Branch[]): Map<string, V3> {
  const frames = new Map<string, V3>();
  const trunk = branches.filter((b) => b.order === 0);
  const keys = new Set(branches.map((b) => b.key));
  const parentOf = (b: TreeV2Branch): string | null => {
    const dot = b.key.lastIndexOf('.');
    if (dot > 0) return b.key.slice(0, dot);
    // Гілка, що виходить зі стовбура плавним вигином: її батько — вигин.
    if (keys.has(`${b.key}~`)) return `${b.key}~`;
    if (b.order === 0) {
      const i = trunk.indexOf(b);
      return i > 0 ? trunk[i - 1]!.key : null;
    }
    // Гілка від стовбура: сегмент, що закінчується найближче до її початку.
    let best: TreeV2Branch | null = null;
    for (const t of trunk) if (!best || Math.abs(t.end[1] - b.start[1]) < Math.abs(best.end[1] - b.start[1])) best = t;
    return best?.key ?? null;
  };
  for (const b of branches) {
    const d = norm([b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2]]);
    const parent = parentOf(b);
    const up = parent === null ? undefined : frames.get(parent);
    let a: V3 | null = null;
    if (up) {
      const k = up[0] * d[0] + up[1] * d[1] + up[2] * d[2];
      const p: V3 = [up[0] - k * d[0], up[1] - k * d[1], up[2] - k * d[2]];
      if (Math.hypot(p[0], p[1], p[2]) > 1e-3) a = norm(p);
    }
    frames.set(b.key, a ?? basis(d)[0]);
  }
  return frames;
}


export interface TreeV2Geometry {
  /** Стовбур, гілки й коріння: позиції та тон кожної грані. */
  wood: { positions: Float32Array; tone: Float32Array; normal: Float32Array };
  /** Крона: позиції, тон грані й чи осіння вона (0/1). */
  leaves: { positions: Float32Array; tone: Float32Array; autumn: Float32Array };
  /** Квіти бажань: крихітні октаедри, канал кольору на вершину (0 червоний, 1 блакитний, 2 зелений). */
  /**
   * Плоди й квіти бажань — за формою дерева (власник, 2026-10-04): дуб —
   * яблука, сакура — квітки, ялина — шишки. Колір на вершину (`colour`,
   * RGB 0..1); `sway` — 0 там, де прикраса тримається, … 1 на кінчику, для
   * вітру в шейдері. Каналу «хто виконав» немає: це мова кристала.
   */
  /**
   * `anchor` — точка, якою прикраса тримається за крону (однакова для всіх
   * вершин однієї прикраси). Шейдер зсуває прикрасу тим самим вітром, що й
   * листя в цій точці, тож квітка не ховається під кроною, коли та гойдається.
   */
  wishes: { positions: Float32Array; colour: Float32Array; sway: Float32Array; anchor: Float32Array };
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
  const tipY = topY - 0.1 * H;

  // Рівні «спідничок» (власник, 2026-10-04: «ялинка виглядає як обрубок,
  // зроби пишніше»): не лише на кільцях гілок, а рівномірно від низу до
  // шпиля, щільніше догори — 4…9 залежно від віку. Молода ялина теж повна.
  const count = Math.max(4, Math.min(9, Math.round(3 + model.tiers * 1.2)));
  const y0 = 0.18 * H;
  const y1 = tipY - 0.05 * H;
  const levels = Array.from({ length: count }, (_, i) => {
    const t = count === 1 ? 0 : i / (count - 1);
    return y0 + (y1 - y0) * (1 - (1 - t) ** 1.25);
  });
  const nearest = (y: number) => levels.reduce((best, l, i) => (Math.abs(l - y) < Math.abs(levels[best]! - y) ? i : best), 0);

  // Лапи гілок років: азимут і горизонтальна досяжність кінчика, на рівні,
  // найближчому до кільця свого ярусу.
  const lobes = model.yearBranches.map((yb) => {
    const paw = clusters.find((c) => c.key === `y${yb.year}:paw`);
    const ty = stops[yb.tier] ?? y0;
    const axis = trunkAt(dir, ty);
    const dx = paw ? paw.centre[0] - axis[0] : 0;
    const dz = paw ? paw.centre[2] - axis[2] : 0;
    // Лапа стоїть на 0.55 довжини гілки.
    return { level: ty > y1 ? -1 : nearest(ty), az: Math.atan2(dz, dx), reach: Math.hypot(dx, dz) / 0.55 };
  });

  const tris: V3[][] = [];
  const tone: number[] = [];
  const N = 14;
  const skirt = (key: string, y: number, base: number, rise: number, lobesHere: typeof lobes, light: number, turn: number) => {
    const phase = turn + (2 * Math.PI * unit(seed, `${key}:phase`)) / N;
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
      const rr = r * (tip ? 1 : 0.82) * (0.94 + 0.12 * unit(seed, `${key}:r${i}`));
      // Довга лапа року провисає трохи більше, але не лягає на землю.
      const drop = base * (tip ? 0.26 : 0.1) + (r - base) * 0.12;
      rim.push([centre[0] + Math.cos(a) * rr, y - drop, centre[2] + Math.sin(a) * rr]);
    }
    const under = trunkAt(dir, y - base * 0.06);
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

  levels.forEach((y, i) => {
    const f = y / topY;
    const base = rules.reach(H, 0, y, topY) * 1.2;
    const gap = (levels[i + 1] ?? tipY) - y;
    // Кожна «спідничка» накриває проміжок до наступної: стовбура між ними не видно.
    const rise = Math.max(base * 0.85, gap * 1.35);
    const here = lobes.filter((l) => l.level === i);
    const light = 0.86 + 0.24 * f;
    skirt(`skirt${i}`, y, base, rise, here, light, 0);
    // Другий, вищий і вужчий шар, повернутий на пів складки, — пишність.
    skirt(`skirt${i}:in`, y + gap * 0.42, base * 0.74, rise * 0.9, [], light * 1.04, Math.PI / N);
  });
  // Верхівка: гострий конус, завжди ширший за стовбур під ним.
  const trunkTop = model.trunkRadius * TREE_GIRTH * (1 - 0.55 * Math.min(1, tipY / H));
  skirt('spire', tipY, Math.max(0.09 * H, trunkTop * 2.6), 0.22 * H, lobes.filter((l) => l.level === -1), 1.12, 0);
  return { tris, tone };
}

/**
 * Де висить прикраса кожного бажання (у порядку `model.blossoms`): дуб —
 * яблуко з-під крони гілки свого року (`treeV2Ornaments`, звіряє двійник);
 * сакура — квітка на грані листя, рівномірно по всій кроні
 * (`treeV2SakuraFlowerSpots`); ялина — шишка на краю лапи «спіднички» біля
 * кінчика гілки свого року.
 */
export function treeV2WishPoints(model: TreeV2Model, form: TreeForm, skeleton?: { branches: readonly TreeV2Branch[]; clusters: readonly TreeV2Cluster[] }): V3[] {
  const { branches, clusters } = skeleton ?? treeV2Skeleton(model, form);
  const orn = treeV2Ornaments(model, clusters);
  // Ялина: «спіднички» йдуть рівнями, а не кільцями гілок, тож кінчик гілки
  // буває поза хвоєю — шишка тоді висіла б у повітрі. Її місце — найближча
  // за азимутом і висотою вершина краю «спіднички», трохи під лапою.
  const rim = form === 'spruce' ? treeV2SpruceSkirts(model, clusters).tris.flat() : [];
  const flowers = form === 'sakura' ? treeV2SakuraFlowerSpots(model, clusters, model.blossoms.length) : [];
  const masses = form === 'oak' ? treeV2CrownMasses(model, clusters) : [];
  const H = model.height;
  return model.blossoms.map((b, k) => {
    if (form === 'oak') return treeV2OnCrown(masses, orn.blossoms[k]!.position, 0.96, orn.blossoms[k]!.cluster);
    if (form === 'spruce') {
      const own = branches.find((x) => x.key === `y${b.year}`);
      const end = own ? own.end : trunkAt(treeTrunkDir(model, form), FORMS[form].top * H);
      const az = Math.atan2(end[2], end[0]);
      // Серед вершин поруч (за азимутом і висотою) — найдальша від стовбура:
      // це край лапи, а не її корінь біля стовбура.
      const near = (spread: number) => rim.filter((v) => Math.abs(((Math.atan2(v[2], v[0]) - az + 3 * Math.PI) % (2 * Math.PI)) - Math.PI) < spread && Math.abs(v[1] - end[1]) < spread * 0.2 * H);
      const pool = [0.35, 0.7, 1.4, 4].map(near).find((x) => x.length > 0) ?? [end];
      const best = pool.reduce((a, v) => (Math.hypot(v[0], v[2]) > Math.hypot(a[0], a[2]) ? v : a));
      return [best[0] * 0.94, best[1] - 0.015 * H, best[2] * 0.94];
    }
    return flowers[k]?.point ?? orn.blossoms[k]!.position;
  });
}

export function buildTreeV2Geometry(model: TreeV2Model, form: TreeForm = 'oak'): TreeV2Geometry {
  const seed = model.startDate;
  const { branches, clusters } = treeV2Skeleton(model, form);
  const orn = treeV2Ornaments(model, clusters);

  const wood: number[] = [];
  const woodTone: number[] = [];
  const woodNormal: number[] = [];
  const pushTris = ({ tris, normals }: { tris: V3[][]; normals: V3[][] }, out: number[], tones: number[], tone: (face: number) => number) => {
    for (const tri of normals) for (const n of tri) woodNormal.push(n[0], n[1], n[2]);
    tris.forEach((tri, k) => {
      // Дві трикутники на грань призми, далі — по одному на грань ковпачка;
      // ковпачок бере тон своєї грані, тож кінчик не плямистий.
      const value = tone(k < 2 * WOOD_SIDES ? Math.floor(k / 2) : k - 2 * WOOD_SIDES);
      for (const p of tri) {
        out.push(p[0], p[1], p[2]);
        tones.push(value);
      }
    });
  };
  // Ялина: гілки сховані під «спідничками» хвої — видно лише стовбур.
  const spruce = form === 'spruce';
  // Ялина: стовбур звужується догори й закінчується всередині шпиля —
  // верх не стирчить «обрубком» товщим за крону.
  const spruceTop = FORMS.spruce.top * model.height - 0.04 * model.height;
  const taper = (y: number) => Math.max(0.3, 1.12 - y / Math.max(1e-6, spruceTop));
  const frames = treeV2WoodFrames(branches);
  const topTrunk = branches.filter((x) => x.order === 0).at(-1);
  // Ковпачок — лише на справжньому кінчику. На лікті, де гілка йде далі під
  // кутом, він стирчав тупим кінцем, і сегмент читався окремим брусочком.
  const continued = new Set(branches.filter((x) => x.order > 0).map((x) => x.key.slice(0, Math.max(0, x.key.lastIndexOf('.')))).filter((k) => k !== ''));
  branches.forEach((x, i) => { if (x.order === 0 && branches[i + 1]?.order === 0) continued.add(x.key); });
  for (const x of branches) if (x.key.endsWith('~')) continued.add(x.key);
  for (const b of spruce ? branches.filter((x) => x.order === 0 && x.start[1] < spruceTop) : branches) {
    const seg = treeV2WoodSegment(b);
    if (spruce) {
      const end: V3 = b.end[1] > spruceTop ? trunkAt(norm([b.end[0] - b.start[0], b.end[1] - b.start[1], b.end[2] - b.start[2]]), spruceTop) : b.end;
      pushTris(prism(seg.start, end, b.r0 * taper(b.start[1]), b.r1 * taper(end[1]), WOOD_SIDES, frames.get(b.key), !continued.has(b.key)), wood, woodTone, (face) => 0.94 + 0.12 * unit(seed, `bark:${face}`));
      continue;
    }
    // Верхній сегмент стовбура звужується до товщини гілок верхівки (0.6):
    // інакше над розвилкою стирчало широке «плече» стовбура.
    const r1 = b === topTrunk ? b.r1 * 0.6 : b.r1;
    pushTris(prism(seg.start, seg.end, b.r0, r1, WOOD_SIDES, frames.get(b.key), !continued.has(b.key)), wood, woodTone, (face) => 0.94 + 0.12 * unit(seed, `bark:${face}`));
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
  // Крона з мас (див. `treeV2CrownMasses`). Осінь — цілими купками й лише
  // половина сезонної частки, і не до кінця: «зелений + золотистий, але
  // золотого менше» (власник, 2026-10-05).
  const crownMasses = spruce ? [] : treeV2CrownMasses(model, clusters);
  for (const m of crownMasses) {
    const pts = massBlob(seed, m);
    const gk = `crown${m.group}`;
    const autumn = unit(seed, `${gk}:autumn`) < model.autumn * 0.5 ? 0.8 : 0;
    const groupTone = 0.92 + 0.16 * unit(seed, `${gk}:tone`);
    ICO.faces.forEach(([a, b, cc], k) => {
      // Нижні грані маси — у власній тіні: купка має об'єм, а не лише контур.
      const low = (pts[a]![1] + pts[b]![1] + pts[cc]![1]) / 3 < m.centre[1] - m.scale[1] * 0.3 ? 0.88 : 1;
      const tone = (0.88 + 0.24 * unit(seed, `${m.key}:f${k}`)) * groupTone * low;
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
  const wishAnchor: number[] = [];
  let anchor: V3 = [0, 0, 0];
  const vert = (p: V3, col: V3, sway: number) => {
    wishPos.push(p[0], p[1], p[2]);
    wishCol.push(col[0], col[1], col[2]);
    wishSway.push(sway);
    wishAnchor.push(anchor[0], anchor[1], anchor[2]);
  };
  const tri = (a: V3, b: V3, c: V3, col: V3, sa = 0, sb = 0, sc = 0) => {
    vert(a, col, sa);
    vert(b, col, sb);
    vert(c, col, sc);
  };
  const mix = (x: V3, y: V3, t: number): V3 => [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
  // Прикрасу видно з відстані камери: яблуко завбільшки з кулачок листя.
  const size = Math.max(0.08, model.height * 0.045);
  const flowerSpots = form === 'sakura' ? treeV2SakuraFlowerSpots(model, clusters, model.blossoms.length) : [];
  treeV2WishPoints(model, form, { branches, clusters }).forEach((p, k) => {
    anchor = p;
    const phi = 2 * Math.PI * unit(seed, `wish${k}:phi`);
    const out: V3 = [Math.cos(phi), 0, Math.sin(phi)];
    if (form === 'oak') {
      // Плід-серце (власник, 2026-10-05: «маленькі червоні/рожеві
      // плоди-серця … замість випадкових червоних куль»). Пухке серце з
      // гранчастої кулі: кожна вершина лягає на криву серця за своїм кутом
      // у площині, що дивиться від стовбура, і сплющена в глибину. Колір —
      // на вершину, плавно: темніше донизу, рожевий відблиск до світла.
      const r = size * 0.62;
      const side: V3 = [-out[2], 0, out[0]];
      const c: V3 = [p[0], p[1] - size * 0.3 - r * 0.35, p[2]];
      const red = rgb('#e0344f');
      const pink = rgb('#ff8fb3');
      const dark = rgb('#a81e3c');
      const heart = (q: V3): V3 => {
        // q — одинична вершина: x — убік, y — угору, z — у глибину.
        const t = Math.atan2(q[0], q[1]);
        const rho = Math.hypot(q[0], q[1]);
        const hx = (16 * Math.sin(t) ** 3) / 17;
        const hy = (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 17;
        return [hx * rho, hy * rho, q[2] * 0.7 * Math.sqrt(Math.max(0, 1 - 0.3 * hy * hy))];
      };
      const shade = (h: V3): V3 => {
        const lit = Math.max(0, h[0] * -0.5 + h[1] * 0.55 + h[2] * 0.9);
        return mix(mix(dark, red, Math.min(1, (h[1] + 1) / 1.4)), pink, Math.min(1, lit * lit * 0.9));
      };
      const place = (h: V3): V3 => add(add(add(c, mul(side, h[0] * r)), [0, h[1] * r, 0]), mul(out, h[2] * r));
      for (const [i, j, l] of ICO.faces) {
        for (const q of [ICO.verts[i]!, ICO.verts[j]!, ICO.verts[l]!]) {
          const h = heart(q);
          vert(place(h), shade(h), 0.6);
        }
      }
      // Хвостик — до западинки серця; листочок біля гілки.
      const notch = place([0, 5 / 17, 0]);
      const brown = rgb('#6e4426');
      tri(p, add(notch, mul(side, size * 0.04)), add(notch, mul(side, -size * 0.04)), brown, 0, 0.5, 0.5);
      const leafTip = add(add(p, mul(out, size * 0.5)), [0, -size * 0.08, 0]);
      const green = rgb('#4f9e3c');
      tri(p, add(add(p, mul(out, size * 0.26)), [0, size * 0.11, 0]), leafTip, green, 0, 0.3, 0.5);
      tri(p, leafTip, add(add(p, mul(out, size * 0.26)), [0, -size * 0.13, 0]), rgb('#3f8a32'), 0, 0.5, 0.3);
    } else if (form === 'sakura') {
      // Квітка сакури (власник, 2026-10-04: «перемалювати на ніжніші й
      // кругліші, як квіти сакури»): п'ять круглих пелюсток із виїмкою на
      // кінчику, блідо-рожеві, темніші до серця; трохи чашею. Серце —
      // рожеве, з тичинками з жовтими кінчиками. Лежить на грані листя.
      const n = flowerSpots[k]?.normal ?? norm([out[0], 0.9, out[2]]);
      const [u, v] = basis(n);
      const R = size * 1.05;
      const centre: V3 = add(p, mul(n, size * 0.03));
      const dir = (a: number) => add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
      const at = (a: number, f: number): V3 => add(add(centre, mul(dir(a), R * f)), mul(n, R * 0.2 * f * f));
      const base = rgb('#f48fb1');
      const blush = rgb('#ffd3e2');
      const edge = rgb('#fff3f7');
      const shade = (f: number) => (f < 0.6 ? mix(base, blush, f / 0.6) : mix(blush, edge, (f - 0.6) / 0.4));
      // Обрис пелюстки: [кут від осі, частка радіуса]; посередині — виїмка.
      const outline: [number, number][] = [[-0.46, 0.3], [-0.55, 0.56], [-0.5, 0.8], [-0.34, 0.96], [-0.15, 1], [0, 0.87], [0.15, 1], [0.34, 0.96], [0.5, 0.8], [0.55, 0.56], [0.46, 0.3]];
      for (let q = 0; q < 5; q += 1) {
        const a0 = phi + (q / 5) * Math.PI * 2;
        for (let i = 0; i + 1 < outline.length; i += 1) {
          const [oa, fa] = outline[i]!;
          const [ob, fb] = outline[i + 1]!;
          vert(centre, base, 0);
          vert(at(a0 + oa, fa), shade(fa), 0);
          vert(at(a0 + ob, fb), shade(fb), 0);
        }
      }
      const heart = rgb('#e8668f');
      const raised = add(centre, mul(n, R * 0.06));
      for (let q = 0; q < 6; q += 1) {
        const a0 = phi + (q / 6) * Math.PI * 2;
        const a1 = phi + ((q + 1) / 6) * Math.PI * 2;
        tri(raised, add(raised, mul(dir(a0), R * 0.15)), add(raised, mul(dir(a1), R * 0.15)), heart);
      }
      const stamen = rgb('#e05a86');
      const pollen = rgb('#ffd36b');
      for (let q = 0; q < 8; q += 1) {
        const a0 = phi + 0.2 + (q / 8) * Math.PI * 2;
        const tip = add(add(raised, mul(dir(a0), R * 0.38)), mul(n, R * 0.12));
        vert(add(raised, mul(dir(a0 - 0.12), R * 0.1)), stamen, 0);
        vert(add(raised, mul(dir(a0 + 0.12), R * 0.1)), stamen, 0);
        vert(tip, pollen, 0);
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

  // Кілька квіток між листям дорослого дуба (власник, 2026-10-05: «кілька
  // квітів між листям», «6+ років — велике дерево … з квітами й плодами»).
  // Це не бажання — прикраса віку: від шести років по 3, і по півтори
  // за кожен рік далі, не більше 14. Сидять на гранях мас крони, що
  // дивляться вгору, і хитаються з листям (той самий матеріал, що й бажання).
  for (const spot of form === 'oak' ? treeV2SakuraFlowerSpots(model, clusters, treeV2CrownFlowerCount(model)) : []) {
    anchor = spot.point;
    const n = spot.normal;
    const [u, v] = basis(n);
    const R = size * 0.75;
    const centre = add(spot.point, mul(n, size * 0.03));
    const turn = 2 * Math.PI * unit(seed, `bloom:${spot.point.map((x) => x.toFixed(3)).join(',')}`);
    const dir = (a: number) => add(mul(u, Math.cos(a)), mul(v, Math.sin(a)));
    const petal = rgb('#fff4ee');
    const tip = rgb('#ffb6cf');
    for (let q = 0; q < 5; q += 1) {
      const a0 = turn + (q / 5) * Math.PI * 2;
      const lift = mul(n, R * 0.15);
      tri(centre, add(add(centre, mul(dir(a0 - 0.42), R * 0.75)), lift), add(add(centre, mul(dir(a0), R)), lift), petal, 0, 0, 0);
      tri(centre, add(add(centre, mul(dir(a0), R)), lift), add(add(centre, mul(dir(a0 + 0.42), R * 0.75)), lift), tip, 0, 0, 0);
    }
    const yolk = rgb('#ffd24a');
    const raised = add(centre, mul(n, R * 0.1));
    for (let q = 0; q < 5; q += 1) {
      tri(raised, add(raised, mul(dir(turn + (q / 5) * Math.PI * 2), R * 0.22)), add(raised, mul(dir(turn + ((q + 1) / 5) * Math.PI * 2), R * 0.22)), yolk, 0, 0, 0);
    }
  }

  return {
    wood: { positions: new Float32Array(wood), tone: new Float32Array(woodTone), normal: new Float32Array(woodNormal) },
    leaves: { positions: new Float32Array(leaves), tone: new Float32Array(leafTone), autumn: new Float32Array(leafAutumn) },
    wishes: { positions: new Float32Array(wishPos), colour: new Float32Array(wishCol), sway: new Float32Array(wishSway), anchor: new Float32Array(wishAnchor) },
    // Плоди — на поверхні крони, а не всередині купки листя.
    fruits: new Float32Array((spruce ? orn.fruits : orn.fruits.map((p) => treeV2OnCrown(crownMasses, p, 0.98))).flat()),
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
