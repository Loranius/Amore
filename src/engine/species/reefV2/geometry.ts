// ============================================================
// Риф v2 — геометрія з моделі (ADR-0219).
// ------------------------------------------------------------
// Той самий алгоритм, що в Python-двійнику
// (`tools/crystal_twin/crystal_twin/reef_geometry.py`); `reefV2Summary`
// звіряється з `golden/reef/*.json`.
//
// Голова рифу — приплюснута гранчаста ікосфера на піску. Тіла колонії
// кожного року сидять на її поверхні по спіралі (золотий кут) і нахилені за
// схилом. Шість форм — пласкі грані, без шуму.
//
// Модуль чистий: лише масиви, без three, без React.
// ============================================================
import { unit } from '../crystalV2/hash';
import type { GiftChannel } from '../crystalV2/model';
import type { ReefForm, ReefV2Colony, ReefV2Model } from './model';

type V3 = [number, number, number];

const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): V3 => {
  const l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
const rad = (d: number) => (d * Math.PI) / 180;

function basis(d: V3): [V3, V3] {
  const ref: V3 = Math.abs(d[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  const a = norm(cross(d, ref));
  return [a, cross(d, a)];
}

/** Висота кожної форми в частках розміру колонії: з неї — верх рифу. */
export const REEF_FORM_HEIGHT: Record<ReefForm, number> = {
  brain: 0.4, branch: 1, fan: 1.1, tube: 0.9, table: 0.5, finger: 0.85,
};

export function reefSurfaceY(model: ReefV2Model, d: number): number {
  const t = Math.min(1, d / model.radius);
  return model.rise * Math.sqrt(Math.max(0, 1 - t * t));
}

/** Вісь колонії: вертикаль, нахилена назовні на 60% схилу голови. */
function leanDir(model: ReefV2Model, azimuthDeg: number, d: number): V3 {
  const t = Math.min(0.97, d / model.radius);
  const slope = (model.rise * t) / (model.radius * Math.sqrt(1 - t * t));
  const tilt = Math.atan(slope) * 0.6;
  const a = rad(azimuthDeg);
  return [Math.sin(tilt) * Math.cos(a), Math.cos(tilt), Math.sin(tilt) * Math.sin(a)];
}

export interface ReefV2Placement {
  colony: ReefV2Colony;
  body: number;
  key: string;
  size: number;
  base: V3;
  axis: V3;
}

/** Тіла колоній: перше — у точці колонії, решта — довкола, трохи менші. */
export function reefV2Placements(model: ReefV2Model): ReefV2Placement[] {
  const seed = model.startDate;
  const out: ReefV2Placement[] = [];
  for (const c of model.colonies) {
    const d0 = c.reach * model.radius;
    const a0 = rad(c.azimuth);
    const cx = Math.cos(a0) * d0;
    const cz = Math.sin(a0) * d0;
    for (let j = 0; j < c.bodies; j += 1) {
      const key = `colony${c.year}:body${j}`;
      let x = cx;
      let z = cz;
      let scale = 1;
      if (j > 0) {
        const ang = 2 * Math.PI * (j / c.bodies + unit(seed, `${key}:a`) * 0.2);
        const off = c.size * (0.45 + 0.25 * unit(seed, `${key}:d`));
        x = cx + Math.cos(ang) * off;
        z = cz + Math.sin(ang) * off;
        scale = 0.55 + 0.3 * unit(seed, `${key}:s`);
      }
      const d = Math.hypot(x, z);
      const az = (Math.atan2(z, x) * 180) / Math.PI;
      const size = c.size * scale;
      out.push({ colony: c, body: j, key, size, base: [x, reefSurfaceY(model, d) - 0.03 * size, z], axis: leanDir(model, az, d) });
    }
  }
  return out;
}

const UNDERGROWTH_FORMS: readonly ReefForm[] = ['finger', 'brain', 'branch', 'tube', 'finger', 'fan'];

/** Дрібні корали по всьому каменю: форма й відтінок кожного — з хешу. */
export function reefV2Undergrowth(model: ReefV2Model): ReefV2Placement[] {
  const seed = model.startDate;
  const out: ReefV2Placement[] = [];
  for (let k = 0; k < model.undergrowth; k += 1) {
    const key = `under${k}`;
    const a = 2 * Math.PI * unit(seed, `${key}:a`);
    // Більше до схилів: вершину й так вкривають колонії років.
    const u = unit(seed, `${key}:d`);
    // Кожен третій — кільцем біля підніжжя, на межі каменю й піску: інакше
    // нижній пояс каменю лишався голою смугою.
    const d = model.radius * (k % 3 === 2 ? 0.92 + 0.26 * u : 0.3 + 0.66 * Math.sqrt(u));
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    const size = 0.1 + 0.13 * unit(seed, `${key}:s`);
    const form = UNDERGROWTH_FORMS[Math.min(5, Math.floor(unit(seed, `${key}:f`) * 6))]!;
    const colony: ReefV2Colony = { year: -1, age: 0, activity: 0, form, size, bodies: 1, azimuth: 0, reach: 0, hue: unit(seed, `${key}:h`) };
    out.push({
      colony, body: k, key, size,
      base: [x, reefSurfaceY(model, d) - 0.02 * size, z],
      axis: leanDir(model, (Math.atan2(z, x) * 180) / Math.PI, d),
    });
  }
  return out;
}

function onSurface(model: ReefV2Model, tag: string, lo: number, hi: number): V3 {
  const seed = model.startDate;
  const a = 2 * Math.PI * unit(seed, `${tag}:a`);
  const d = model.radius * (lo + (hi - lo) * Math.sqrt(unit(seed, `${tag}:d`)));
  return [Math.cos(a) * d, reefSurfaceY(model, d), Math.sin(a) * d];
}

export interface ReefV2Fish { orbit: number; height: number; phase: number; speed: number }

export interface ReefV2Ornaments {
  anemones: { position: V3; channel: GiftChannel }[];
  clams: V3[];
  starfish: { position: V3; turn: number }[];
  fish: ReefV2Fish[];
  seagrass: V3[];
}

export function reefV2Ornaments(model: ReefV2Model): ReefV2Ornaments {
  const seed = model.startDate;
  const anemones = model.anemones.map((a) => ({ position: onSurface(model, `anemone${a.id}`, 0.2, 0.95), channel: a.channel }));
  const clams = Array.from({ length: model.clams }, (_, k) => onSurface(model, `clam${k}`, 0.3, 0.9));
  const starfish = Array.from({ length: model.starfish }, (_, k) => {
    const a = 2 * Math.PI * unit(seed, `star${k}:a`);
    const d = model.radius * (1.08 + 0.4 * unit(seed, `star${k}:d`));
    return { position: [Math.cos(a) * d, 0, Math.sin(a) * d] as V3, turn: 360 * unit(seed, `star${k}:t`) };
  });
  const fish = Array.from({ length: model.fish }, (_, k) => ({
    orbit: model.radius * (1.25 + 0.7 * unit(seed, `fish${k}:r`)),
    height: model.rise * (0.5 + 1.3 * unit(seed, `fish${k}:y`)) + 0.15,
    phase: 360 * unit(seed, `fish${k}:p`),
    speed: 0.7 + 0.6 * unit(seed, `fish${k}:s`),
  }));
  const seagrass = Array.from({ length: model.seagrass }, (_, k): V3 => {
    const a = 2 * Math.PI * unit(seed, `grass${k}:a`);
    const d = model.radius * 1.02 + 2.2 * unit(seed, `grass${k}:d`) ** 1.5;
    return [Math.cos(a) * d, 0, Math.sin(a) * d];
  });
  return { anemones, clams, starfish, fish, seagrass };
}

const q = (x: number) => Math.floor(x * 1e4 + 0.5) / 1e4;

/** Що звіряється з двійником (до 10⁻⁴). */
export function reefV2Summary(model: ReefV2Model) {
  const places = reefV2Placements(model);
  const orn = reefV2Ornaments(model);
  const top = Math.max(model.rise, ...places.map((p) => p.base[1] + p.axis[1] * REEF_FORM_HEIGHT[p.colony.form] * p.size));
  const reach = Math.max(model.radius, ...places.map((p) => Math.hypot(p.base[0], p.base[2]) + p.size * 0.6));
  return {
    colonies: model.colonies.length,
    bodies: places.length,
    forms: model.colonies.map((c) => c.form),
    top: q(top),
    reach: q(reach),
    firstBase: places[0] ? places[0].base.map(q) : null,
    undergrowth: model.undergrowth,
    firstUnder: model.undergrowth ? reefV2Undergrowth(model)[0]!.base.map(q) : null,
    firstAnemone: orn.anemones[0] ? orn.anemones[0].position.map(q) : null,
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

type Tri = [V3, V3, V3];

function prism(start: V3, end: V3, r0: number, r1: number, sides = 5, caps = false): Tri[] {
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
  const tris: Tri[] = [];
  for (let i = 0; i < sides; i += 1) {
    const j = (i + 1) % sides;
    tris.push([ring0[i]!, ring0[j]!, ring1[j]!], [ring0[i]!, ring1[j]!, ring1[i]!]);
    if (caps) tris.push([end, ring1[i]!, ring1[j]!], [start, ring0[j]!, ring0[i]!]);
  }
  return tris;
}

export function reefV2RockTriangles(model: ReefV2Model): Tri[] {
  const seed = model.startDate;
  const pts = ICO.verts.map((v, i): V3 => {
    const k = 0.9 + 0.2 * unit(seed, `rock:v${i}`);
    const y = v[1] > 0 ? v[1] * model.rise * k : v[1] * model.rise * 0.25;
    return [v[0] * model.radius * k, y, v[2] * model.radius * k];
  });
  return ICO.faces.map(([a, b, c]) => [pts[a]!, pts[b]!, pts[c]!]);
}

/** Ікосаедр без поділу: 20 великих граней — гранчастий помпон. */
const ICO20: { verts: V3[]; faces: [number, number, number][] } = (() => {
  const t = (1 + Math.sqrt(5)) / 2;
  const verts = ([
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t],
    [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ] as V3[]).map(norm);
  const faces: [number, number, number][] = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2],
    [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5],
    [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  return { verts, faces };
})();

/** Гранчасте лезо: основа, два плечі, вістря й ребро посередині — 4 грані. */
function blade(base: V3, tip: V3, side: V3, width: number, ridge: V3): Tri[] {
  const at = (k: number): V3 => add(base, mul([tip[0] - base[0], tip[1] - base[1], tip[2] - base[2]], k));
  const left = add(at(0.4), mul(side, width));
  const right = add(at(0.4), mul(side, -width));
  const mid = add(at(0.45), ridge);
  return [[base, left, mid], [base, mid, right], [left, tip, mid], [mid, tip, right]];
}

/** Пластина з неправильного многокутника: верх, низ і бічні грані. */
function plate(centre: V3, radii: number[], thickness: number, turn: number): Tri[] {
  const n = radii.length;
  const ring = (y: number) => radii.map((r, i): V3 => {
    const a = turn + (2 * Math.PI * i) / n;
    return [centre[0] + Math.cos(a) * r, centre[1] + y, centre[2] + Math.sin(a) * r];
  });
  const top = ring(thickness);
  const low = ring(0);
  const up: V3 = [centre[0], centre[1] + thickness, centre[2]];
  const tris: Tri[] = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    tris.push([up, top[j]!, top[i]!], [centre, low[i]!, low[j]!], [low[i]!, top[i]!, top[j]!], [low[i]!, top[j]!, low[j]!]);
  }
  return tris;
}

/**
 * Трикутники одного тіла колонії в координатах рифу.
 *
 * Стиль — гранчастий low-poly за референсом власника (ADR-0225): кожна
 * форма складена з кількох великих пласких граней, а не з гладкої кулі чи
 * тонких трубочок. Висоти форм ті самі (`REEF_FORM_HEIGHT`): від них
 * рахується кадр і зведення двійника, і вони не змінились.
 */
export function reefV2ColonyTriangles(model: ReefV2Model, place: ReefV2Placement): Tri[] {
  const seed = model.startDate;
  const s = place.size;
  const key = place.key;
  const [x, z] = basis(place.axis);
  const y = place.axis;
  const L = (p: V3): V3 => add(place.base, add(add(mul(x, p[0]), mul(y, p[1])), mul(z, p[2])));
  const tris: Tri[] = [];
  const toWorld = (list: Tri[]) => list.map((t): Tri => [L(t[0]), L(t[1]), L(t[2])]);
  switch (place.colony.form) {
    case 'brain': {
      // Помпон: гранчасте ядро з двадцяти граней і колючки врізнобіч.
      const c: V3 = [0, 0.17 * s, 0];
      const pts = ICO20.verts.map((v, i): V3 => {
        const k = s * 0.19 * (0.85 + 0.3 * unit(seed, `${key}:v${i}`));
        return [c[0] + v[0] * k, c[1] + Math.max(v[1], -0.5) * k * 0.85, c[2] + v[2] * k];
      });
      for (const [a, b, d] of ICO20.faces) tris.push([L(pts[a]!), L(pts[b]!), L(pts[d]!)]);
      for (let i = 0; i < 7; i += 1) {
        const phi = rad(i * (360 / 7) + 30 * unit(seed, `${key}:sp${i}`));
        const th = rad(20 + 55 * unit(seed, `${key}:st${i}`));
        const d: V3 = [Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi)];
        const from = add(c, mul(d, 0.13 * s));
        tris.push(...prism(L(from), L(add(c, mul(d, 0.25 * s))), 0.06 * s, 0.002 * s, 4));
      }
      break;
    }
    case 'branch': {
      // Гіллястий: товсті чотиригранні гілки з гострими кінчиками.
      tris.push(...prism(L([0, 0, 0]), L([0, 0.4 * s, 0]), 0.12 * s, 0.09 * s, 4));
      for (let i = 0; i < 4; i += 1) {
        const phi = rad(i * 90 + 360 * unit(seed, `${key}:b${i}`));
        const th = rad(25 + 20 * unit(seed, `${key}:t${i}`));
        const d: V3 = [Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi)];
        const mid: V3 = [d[0] * 0.35 * s, 0.4 * s + d[1] * 0.35 * s, d[2] * 0.35 * s];
        tris.push(...prism(L([0, 0.4 * s, 0]), L(mid), 0.09 * s, 0.07 * s, 4));
        for (const j of [-1, 1]) {
          const tip: V3 = [
            mid[0] + (d[0] + j * 0.35 * Math.sin(phi)) * 0.3 * s,
            mid[1] + 0.28 * s,
            mid[2] + (d[2] - j * 0.35 * Math.cos(phi)) * 0.3 * s,
          ];
          tris.push(...prism(L(mid), L(tip), 0.065 * s, 0.004 * s, 4));
        }
      }
      break;
    }
    case 'fan': {
      // Пучок лез (як водорості й м'які корали референсу): кожне лезо —
      // чотири грані з ребром посередині.
      const n = 5 + Math.floor(unit(seed, `${key}:n`) * 3);
      for (let i = 0; i < n; i += 1) {
        const phi = rad(i * (360 / n) + 40 * unit(seed, `${key}:bp${i}`));
        const th = rad(8 + 28 * unit(seed, `${key}:bt${i}`));
        const len = s * (0.8 + 0.3 * unit(seed, `${key}:bl${i}`));
        const d: V3 = [Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi)];
        const base: V3 = [Math.cos(phi) * 0.06 * s, 0, Math.sin(phi) * 0.06 * s];
        const side: V3 = [-Math.sin(phi), 0, Math.cos(phi)];
        const out: V3 = [Math.cos(phi), 0, Math.sin(phi)];
        tris.push(...toWorld(blade(base, add(base, mul(d, len)), side, 0.11 * s, mul(out, 0.05 * s))));
      }
      break;
    }
    case 'tube':
      // Трубки-губки з розкритим вінцем.
      for (let i = 0; i < 4; i += 1) {
        const phi = rad(i * 90 + 40 * unit(seed, `${key}:p${i}`));
        const off = 0.14 * s * (0.4 + unit(seed, `${key}:o${i}`));
        const h = s * (0.5 + 0.35 * unit(seed, `${key}:h${i}`));
        const r = s * (0.09 + 0.05 * unit(seed, `${key}:r${i}`));
        const b0: V3 = [Math.cos(phi) * off, 0, Math.sin(phi) * off];
        const top: V3 = [b0[0] * 1.3, h, b0[2] * 1.3];
        tris.push(...prism(L(b0), L(top), r, r * 1.05, 5));
        tris.push(...prism(L(top), L([top[0] * 1.05, h + 0.05 * s, top[2] * 1.05]), r * 1.05, r * 1.35, 5));
      }
      break;
    case 'table': {
      // Стос пластин на короткій ніжці.
      tris.push(...prism(L([0, 0, 0]), L([0, 0.3 * s, 0]), 0.1 * s, 0.07 * s, 5));
      const count = 2 + Math.floor(unit(seed, `${key}:plates`) * 2);
      for (let k = 0; k < count; k += 1) {
        const radius = 0.42 * s * (1 - 0.22 * k);
        const radii = Array.from({ length: 7 }, (_, i) => radius * (0.75 + 0.45 * unit(seed, `${key}:pl${k}:${i}`)));
        const shift = 0.08 * s * k;
        const a = rad(360 * unit(seed, `${key}:ps${k}`));
        const centre: V3 = [Math.cos(a) * shift, 0.3 * s + k * 0.075 * s, Math.sin(a) * shift];
        tris.push(...toWorld(plate(centre, radii, 0.05 * s, a)));
      }
      break;
    }
    default:
      // Пальці: чотиригранні, з вістрям.
      for (let i = 0; i < 6; i += 1) {
        const phi = rad(i * 60 + 30 * unit(seed, `${key}:p${i}`));
        const off = 0.2 * s * unit(seed, `${key}:o${i}`);
        const h = s * (0.5 + 0.35 * unit(seed, `${key}:h${i}`));
        const lean = 0.25 * h;
        const b0: V3 = [Math.cos(phi) * off, 0, Math.sin(phi) * off];
        const top: V3 = [b0[0] + Math.cos(phi) * lean, h, b0[2] + Math.sin(phi) * lean];
        tris.push(...prism(L(b0), L(top), 0.08 * s, 0.06 * s, 4));
        const tip: V3 = [top[0] + Math.cos(phi) * 0.02 * s, h + 0.1 * s, top[2] + Math.sin(phi) * 0.02 * s];
        tris.push(...prism(L(top), L(tip), 0.06 * s, 0.002 * s, 4));
      }
  }
  return tris;
}

const FORM_INDEX: Record<ReefForm, number> = { brain: 0, branch: 1, fan: 2, tube: 3, table: 4, finger: 5 };
const CHANNEL_INDEX: Record<GiftChannel, number> = { red: 0, blue: 1, green: 2 };

export interface ReefV2Geometry {
  rock: { positions: Float32Array; tone: Float32Array };
  /** Корали: позиції, тон грані, форма (0…5) і власний зсув відтінку колонії. */
  corals: { positions: Float32Array; tone: Float32Array; form: Float32Array; hue: Float32Array; rise: Float32Array };
  /** Актинії й мушлі: позиції, канал кольору (0…2 — бажання, 3 — мушля). */
  critters: { positions: Float32Array; channel: Float32Array };
  starfish: { positions: Float32Array; tone: Float32Array };
  pearls: Float32Array;
  fish: ReefV2Fish[];
  seagrass: V3[];
  top: number;
  reach: number;
}

export function buildReefV2Geometry(model: ReefV2Model): ReefV2Geometry {
  const seed = model.startDate;
  const rock: number[] = [];
  const rockTone: number[] = [];
  reefV2RockTriangles(model).forEach((tri, k) => {
    const tone = 0.85 + 0.3 * unit(seed, `rock:f${k}`);
    for (const p of tri) { rock.push(...p); rockTone.push(tone); }
  });

  const corals: number[] = [];
  const coralTone: number[] = [];
  const coralForm: number[] = [];
  const coralHue: number[] = [];
  const coralRise: number[] = [];
  for (const place of [...reefV2Placements(model), ...reefV2Undergrowth(model)]) {
    const form = FORM_INDEX[place.colony.form];
    const height = REEF_FORM_HEIGHT[place.colony.form] * place.size;
    reefV2ColonyTriangles(model, place).forEach((tri, k) => {
      const tone = 0.85 + 0.3 * unit(seed, `${place.key}:f${k}`);
      for (const p of tri) {
        corals.push(...p);
        coralTone.push(tone);
        coralForm.push(form);
        coralHue.push(place.colony.hue);
        // Висота над основою тіла в частках самого тіла: для градієнта.
        const lift = (p[0] - place.base[0]) * place.axis[0] + (p[1] - place.base[1]) * place.axis[1] + (p[2] - place.base[2]) * place.axis[2];
        coralRise.push(Math.max(0, Math.min(1, lift / Math.max(1e-6, height))));
      }
    });
  }

  const orn = reefV2Ornaments(model);
  const critters: number[] = [];
  const critterChannel: number[] = [];
  const tentacle = 0.1 * Math.max(0.7, model.head);
  for (const a of orn.anemones) {
    for (let i = 0; i < 7; i += 1) {
      const ang = (2 * Math.PI * i) / 7;
      const tip: V3 = [a.position[0] + Math.cos(ang) * tentacle * 0.6, a.position[1] + tentacle, a.position[2] + Math.sin(ang) * tentacle * 0.6];
      for (const tri of prism(a.position, tip, tentacle * 0.16, tentacle * 0.04, 3)) {
        for (const p of tri) { critters.push(...p); critterChannel.push(CHANNEL_INDEX[a.channel]); }
      }
    }
  }
  const pearls: number[] = [];
  const shell = 0.09 * Math.max(0.7, model.head);
  for (const c of orn.clams) {
    // Мушля — дві пласкі стулки, відкриті вгору; перлина світиться між ними.
    for (const side of [-1, 1]) {
      const hinge = c;
      const rim: V3 = [c[0] + side * shell, c[1] + shell * 0.6, c[2]];
      for (const tri of prism(hinge, rim, shell * 0.02, shell * 0.8, 6)) {
        for (const p of tri) { critters.push(...p); critterChannel.push(3); }
      }
    }
    pearls.push(c[0], c[1] + shell * 0.25, c[2]);
  }

  const starfish: number[] = [];
  const starTone: number[] = [];
  for (const s of orn.starfish) {
    const [cx, , cz] = s.position;
    for (let i = 0; i < 5; i += 1) {
      const ang = rad(s.turn) + (2 * Math.PI * i) / 5;
      const tone = 0.85 + 0.3 * unit(seed, `star:${i}:${cx}`);
      const inner = 0.05;
      const outer = 0.15;
      const a: V3 = [cx, 0.02, cz];
      const l: V3 = [cx + Math.cos(ang - 0.4) * inner, 0.015, cz + Math.sin(ang - 0.4) * inner];
      const r: V3 = [cx + Math.cos(ang + 0.4) * inner, 0.015, cz + Math.sin(ang + 0.4) * inner];
      const tip: V3 = [cx + Math.cos(ang) * outer, 0.01, cz + Math.sin(ang) * outer];
      for (const p of [a, tip, l, a, r, tip]) { starfish.push(...p); starTone.push(tone); }
    }
  }

  const summary = reefV2Summary(model);
  return {
    rock: { positions: new Float32Array(rock), tone: new Float32Array(rockTone) },
    corals: {
      positions: new Float32Array(corals),
      tone: new Float32Array(coralTone),
      form: new Float32Array(coralForm),
      hue: new Float32Array(coralHue),
      rise: new Float32Array(coralRise),
    },
    critters: { positions: new Float32Array(critters), channel: new Float32Array(critterChannel) },
    starfish: { positions: new Float32Array(starfish), tone: new Float32Array(starTone) },
    pearls: new Float32Array(pearls),
    fish: orn.fish,
    seagrass: orn.seagrass,
    top: summary.top,
    reach: summary.reach,
  };
}
