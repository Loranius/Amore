// ============================================================
// Дерево v2 — геометрія з моделі (ADR-0218).
// ------------------------------------------------------------
// Той самий алгоритм, що в Python-двійнику
// (`tools/crystal_twin/crystal_twin/tree_geometry.py`); `summary` звіряється
// з `golden/tree/*.json`.
//
// Скелет росте рекурсивно: стовбур → скелетні гілки (плани) і провідник
// угору → на кожному порядку продовження й бічна гілка. Кут, азимут і
// довжина кожної гілки — з хешу її шляху. Крона — гранчасті кластери на
// кінцях гілок: пласкі грані, жодного шуму.
//
// Модуль чистий: лише масиви, без three, без React.
// ============================================================
import { unit } from '../crystalV2/hash';
import type { GiftChannel } from '../crystalV2/model';
import type { TreeV2Model } from './model';

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

export interface TreeV2Cluster { centre: V3; radius: number; key: string }

export function treeV2Skeleton(model: TreeV2Model): { branches: TreeV2Branch[]; clusters: TreeV2Cluster[] } {
  const seed = model.startDate;
  const { orders, limbs, leafiness } = model;
  const lean = rad(model.lean);
  const leanAz = rad(model.leanAzimuth);
  const trunkDir: V3 = [Math.sin(lean) * Math.cos(leanAz), Math.cos(lean), Math.sin(lean) * Math.sin(leanAz)];
  const branches: TreeV2Branch[] = [];
  const clusters: TreeV2Cluster[] = [];

  const grow = (start: V3, direction: V3, length: number, order: number, key: string, radius: number, thinning: number): void => {
    const end = add(start, mul(direction, length));
    const r1 = Math.max(radius * thinning, 0.004);
    branches.push({ start, end, r0: radius, r1, order, key });
    if (order >= orders - 1 && order > 0) {
      // Кінчик і передостанній порядок несуть листя: так крона повна й на
      // молодому дереві з двома порядками.
      const size = (0.2 + 0.9 * length) * leafiness * (order === orders ? 0.55 : 0.42);
      clusters.push({ centre: end, radius: size, key });
    }
    if (order === orders) return;
    if (order === 0) {
      for (let i = 0; i < limbs; i += 1) {
        const t = 0.62 + 0.38 * ((i + 0.5) / limbs);
        const phi = (i * 360) / limbs + (unit(seed, `${key}:limb${i}:az`) - 0.5) * 30;
        const theta = 32 + 20 * unit(seed, `${key}:limb${i}:th`);
        const d: V3 = [
          Math.sin(rad(theta)) * Math.cos(rad(phi)),
          Math.cos(rad(theta)),
          Math.sin(rad(theta)) * Math.sin(rad(phi)),
        ];
        const at = add(start, mul(direction, length * t));
        grow(at, d, 0.85 * (0.85 + 0.3 * unit(seed, `${key}:limb${i}:len`)), 1, `${key}.l${i}`, radius * (0.62 - 0.12 * t), 0.7);
      }
      const leader = deviate(norm(add(direction, [0, 0.5, 0])), 8, 360 * unit(seed, `${key}:lead`));
      grow(end, leader, 0.72, 1, `${key}.c`, r1 * 0.85, 0.7);
      return;
    }
    const turn = 137.5 * order + 360 * unit(seed, `${key}:turn`);
    const cont = deviate(direction, 18 + 16 * unit(seed, `${key}:ca`) - 8, turn);
    const side = deviate(direction, 42 + 24 * unit(seed, `${key}:sa`) - 12, turn + 180);
    const last = order + 1 < orders ? 0.7 : 0.5;
    grow(end, cont, length * 0.74, order + 1, `${key}.c`, r1 * 0.85, last);
    grow(end, side, length * 0.62, order + 1, `${key}.s`, r1 * 0.65, last);
  };

  grow([0, 0, 0], trunkDir, 1.3, 0, 't', 1, 0.72);

  // Масштаб: верх крони — рівно висота моделі.
  const top = Math.max(...branches.map((b) => b.end[1]), ...clusters.map((c) => c.centre[1] + c.radius));
  const s = model.height / top;
  for (const b of branches) {
    b.start = mul(b.start, s);
    b.end = mul(b.end, s);
    b.r0 *= model.trunkRadius * TREE_GIRTH;
    b.r1 *= model.trunkRadius * TREE_GIRTH;
  }
  for (const c of clusters) {
    c.centre = mul(c.centre, s);
    c.radius *= s;
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
  const onCluster = (tag: string, upward: boolean, depth: number): V3 => {
    const c = clusters[Math.min(n - 1, Math.floor(unit(seed, `${tag}:c`) * n))]!;
    const y = upward ? 0.2 + 0.8 * unit(seed, `${tag}:y`) : -(0.3 + 0.5 * unit(seed, `${tag}:y`));
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = 2 * Math.PI * unit(seed, `${tag}:phi`);
    return add(c.centre, mul([ring * Math.cos(phi), y, ring * Math.sin(phi)], c.radius * depth));
  };
  const blossoms = model.blossoms.map((b) => ({ position: onCluster(`blossom${b.id}`, true, 0.98), channel: b.channel }));
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

export function buildTreeV2Geometry(model: TreeV2Model): TreeV2Geometry {
  const seed = model.startDate;
  const { branches, clusters } = treeV2Skeleton(model);
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
  for (const r of treeV2Roots(model)) {
    pushTris(prism(r.start, r.end, r.r0, r.r1, 5), wood, woodTone, (face) => 0.75 + 0.3 * unit(seed, `${r.key}:w${face}`));
  }

  const leaves: number[] = [];
  const leafTone: number[] = [];
  const leafAutumn: number[] = [];
  for (const c of clusters) {
    const pts = ICO.verts.map((v, i): V3 => {
      const k = c.radius * (0.82 + 0.3 * unit(seed, `${c.key}:v${i}`));
      return [c.centre[0] + v[0] * k, c.centre[1] + v[1] * k * 0.82, c.centre[2] + v[2] * k];
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
