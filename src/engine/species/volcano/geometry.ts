// ============================================================
// Підводний вулкан — геометрія з моделі (ADR-0235).
// ------------------------------------------------------------
// Конус — кільця на межах шарів-років: гранчасті, без шуму на гранях, і шум
// кожного кільця прив'язаний до РОКУ, тож та сама пара на 3 і 15 роках —
// той самий камінь, що підріс, а не новий. Кратер загортається всередину
// до озера лави; жили лави стікають схилами.
//
// Корал кожного року сидить на шарі СВОГО року — вулкан читається знизу
// вгору, як літопис. Решта життя (підріст, актинії, мушлі, зірки, риби,
// трава) — ті самі правила рифу v2, лише на схилах конуса; збирає меш
// спільний `assembleReefLife`, тож шейдери й палітри рифу працюють як є.
//
// Модуль чистий: лише масиви, без three, без React.
// ============================================================
import { unit } from '../crystalV2/hash';
import {
  REEF_FORM_HEIGHT,
  assembleReefLife,
  type ReefV2Geometry,
  type ReefV2Ornaments,
  type ReefV2Placement,
  type Tri,
} from '../reefV2/geometry';
import type { ReefForm, ReefV2Colony } from '../reefV2/model';
import { volcanoSlopeRadius, type VolcanoModel } from './model';

type V3 = [number, number, number];

const SIDES = 12;


interface Ring { y: number; key: string; points: V3[] }

/** Кільця конуса: підніжжя, верх пагорба, межі шарів і губа кратера. */
const MAX_RING_LAYERS = 5;

function ringLayers<T>(layers: readonly T[]): T[] {
  if (layers.length <= MAX_RING_LAYERS + 1) return [...layers];
  const picked: T[] = [];
  for (let k = 1; k <= MAX_RING_LAYERS; k += 1) picked.push(layers[Math.round((k * (layers.length - 1)) / (MAX_RING_LAYERS + 1))]!);
  picked.push(layers[layers.length - 1]!);
  return picked;
}

export function volcanoRings(model: VolcanoModel): Ring[] {
  const seed = model.startDate;
  const heights: { y: number; key: string }[] = [
    { y: -0.08, key: 'foot' },
    { y: Math.min(model.height, 0.35), key: 'hill' },
    // Не більше п'яти кілець шарів (плюс верхнє): великі грані, як у
    // референсі власника. Кільце на кожен рік робило конус дрібно
    // посмугованим і м'яким; роки й далі в шарах моделі — тут лише меш.
    ...ringLayers(model.layers).map((l) => ({ y: l.to, key: `year${l.year}` })),
  ];
  return heights.map(({ y, key }, index) => {
    const last = index === heights.length - 1;
    const points: V3[] = [];
    for (let i = 0; i < SIDES; i += 1) {
      const tag = `${key}:${i}`;
      const a = ((i + 0.35 * (unit(seed, `${tag}:a`) - 0.5)) / SIDES) * Math.PI * 2;
      const base = key === 'foot' ? model.baseRadius * 1.04 : volcanoSlopeRadius(model, y);
      const r = base * (1 + 0.12 * (unit(seed, `${tag}:r`) - 0.5)) * (last ? 1.07 : 1);
      const dy = last || key === 'foot' ? 0 : 0.035 * (unit(seed, `${tag}:y`) - 0.5);
      points.push([Math.cos(a) * r, y + dy, Math.sin(a) * r]);
    }
    return { y, key, points };
  });
}

/** Глибина озера лави під губою кратера. */
export function volcanoMagmaY(model: VolcanoModel): number {
  return model.height - 0.1 - 0.05 * model.height;
}

/**
 * Точка ріки: вісь, напрям упоперек, ширина окремо лівого й правого берега
 * (природна лава не симетрична), жар і `flow` — частка довжини ріки від
 * жерла (0) до язика (1): фронт анімації дотику (ADR-0235).
 */
interface VeinPoint { at: V3; side: V3; wl: number; wr: number; heat: number; flow: number }

/**
 * Де грань конуса перетинає промінь з осі під азимутом `a`: радіус і
 * висота на справжньому гранчастому кільці, а не на гладкому конусі.
 * Ріка, покладена на гладкий конус, пірнала під грані, що випинаються на
 * ±6% (шум кілець), — лава «витікала десь під текстурами вулкана».
 */
export function volcanoRingHit(points: readonly V3[], a: number): { r: number; y: number } {
  const dx = Math.cos(a);
  const dz = Math.sin(a);
  let best: { r: number; y: number } | null = null;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i]!;
    const q = points[(i + 1) % points.length]!;
    const ex = q[0] - p[0];
    const ez = q[2] - p[2];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = (p[0] * ez - p[2] * ex) / den;
    const s = (p[0] * dz - p[2] * dx) / den;
    if (t > 0 && s >= -1e-9 && s <= 1 + 1e-9 && (best === null || t < best.r)) best = { r: t, y: p[1] + (q[1] - p[1]) * s };
  }
  return best ?? { r: Math.hypot(points[0]![0], points[0]![2]), y: points[0]![1] };
}

/**
 * Ріки лави: витікають рівно з жерла — через губу кратера — і спускаються
 * гранями конуса до самого підніжжя, трохи над поверхнею, щоб жодна грань
 * їх не перекрила.
 */
export function volcanoVeinPaths(model: VolcanoModel): VeinPoint[][] {
  const seed = model.startDate;
  const R = model.craterRadius;
  const crater = volcanoCrater(model);
  const cone = volcanoRings(model).map((ring) => ring.points).reverse();
  // Згори донизу: губа, вал, комір (= верх останнього шару), кільця шарів.
  const profile: V3[][] = [crater.rim, crater.bulge, ...cone];
  // Між кільцями — по кілька проміжних точок: ріка звивається й хвилює
  // берегами не лише на межах шарів.
  const SUB = 4;
  const paths: VeinPoint[][] = [];
  for (const [v, index] of volcanoVeinIndices(model).entries()) {
    const notch = crater.rim[index]!;
    const a0 = Math.atan2(notch[2], notch[0]);
    const tag = `vein${v}`;
    const phase = unit(seed, `${tag}:p`) * Math.PI * 2;
    const drift = (unit(seed, `${tag}:d`) - 0.5) * 0.18;
    const samples: { ring: number; s: number }[] = [];
    for (let k = 0; k < profile.length - 1; k += 1) {
      for (let q = 0; q < SUB; q += 1) samples.push({ ring: k, s: q / SUB });
    }
    samples.push({ ring: profile.length - 1, s: 0 });
    const n = samples.length - 1;
    const path: VeinPoint[] = [];
    // Джерело — у чаші під виїмкою: лава переливається через край жерла.
    path.push({
      at: [notch[0] * 0.8, notch[1] - R * 0.05, notch[2] * 0.8],
      side: [-Math.sin(a0), 0, Math.cos(a0)],
      wl: R * 0.22, wr: R * 0.22, heat: 1, flow: 0,
    });
    samples.forEach((sample, k) => {
      const t = k / n;
      // Меандр: ріка повільно відхиляється й хитається, а не падає по лінійці.
      const a = a0 + drift * t + 0.07 * Math.sin(phase + t * 7.5) * Math.min(1, t * 4);
      const lo = volcanoRingHit(profile[sample.ring]!, a);
      const hi = sample.s > 0 ? volcanoRingHit(profile[sample.ring + 1]!, a) : lo;
      const r = lo.r + (hi.r - lo.r) * sample.s;
      const y = lo.y + (hi.y - lo.y) * sample.s;
      const lift = 1.03 + 0.01 * t;
      // Малі хвилі берегів — кожен берег свої — і ширшання донизу.
      const base = R * (0.26 + 0.24 * t);
      const waveL = 1 + 0.18 * Math.sin(phase + t * 23) + 0.1 * Math.sin(phase * 2 + t * 41);
      const waveR = 1 + 0.18 * Math.sin(phase + 1.7 + t * 19) + 0.1 * Math.sin(phase * 3 + t * 37);
      // Язик заокруглюється: береги сходяться в останні 6% довжини.
      const toe = t > 0.94 ? Math.sqrt(Math.max(0, (1 - t) / 0.06)) : 1;
      path.push({
        at: [Math.cos(a) * r * lift, y + 0.006, Math.sin(a) * r * lift],
        side: [-Math.sin(a), 0, Math.cos(a)],
        wl: base * waveL * toe + 0.002,
        wr: base * waveR * toe + 0.002,
        heat: 0.95 - 0.4 * t,
        flow: Math.max(0.02, t),
      });
    });
    paths.push(path);
  }
  return paths;
}

/**
 * Жар каменю в точці: тепліє до кратера й біля жил. Камінь сам не світить —
 * він лише теплішає й пульсує разом із лавою.
 */
export function volcanoRockHeat(model: VolcanoModel, veins: readonly VeinPoint[][], p: V3): number {
  const f = p[1] / model.height;
  let heat = 0.5 * Math.min(1, Math.max(0, (f - 0.6) / 0.4)) ** 1.5;
  for (const path of veins) {
    for (const v of path) {
      const d = Math.hypot(p[0] - v.at[0], p[1] - v.at[1], p[2] - v.at[2]);
      heat = Math.max(heat, 0.4 * v.heat * Math.exp(-((d / 0.14) ** 2)));
    }
  }
  return Math.min(1, heat);
}

/**
 * Кільця жерла. Корона — зубці через один: високі й низькі, як у
 * референсі власника; вал під нею випирає назовні.
 */
/** Вершини губи, з яких витікають ріки: рівномірно довкола, з хешу пари. */
export function volcanoVeinIndices(model: VolcanoModel): number[] {
  const offset = Math.floor(unit(model.startDate, 'veins:turn') * SIDES);
  return Array.from({ length: model.veins }, (_, v) => (offset + Math.round((v * SIDES) / model.veins)) % SIDES);
}

export function volcanoCrater(model: VolcanoModel) {
  const seed = model.startDate;
  const rings = volcanoRings(model);
  const collar = rings[rings.length - 1]!.points;
  const R = model.craterRadius;
  const notches = new Set(volcanoVeinIndices(model));
  // Губа кам'яна, трошки зубчаста (власник: «зроби жерло трошки зубчастим,
  // з виямки якої витікає лава»): зубці через один, а над кожною рікою —
  // виїмка майже до коміра, звідки лава й переливається.
  const lift = collar.map((_, i) => (notches.has(i)
    ? R * 0.05
    : R * ((i % 2 === 0 ? 0.46 : 0.3) + 0.1 * unit(seed, `rim:${i}:y`))));
  const bulge = collar.map(([x, y, z], i): V3 => [x * 1.1, y + lift[i]! * 0.4, z * 1.1]);
  const rim = collar.map(([x, y, z], i): V3 => [x * 0.95, y + lift[i]!, z * 0.95]);
  const magma = volcanoMagmaY(model);
  const ledge = collar.map(([x, y, z], i): V3 => [x * 0.76, y - R * (0.08 + 0.08 * unit(seed, `ledge:${i}`)), z * 0.76]);
  const inner = collar.map(([x, , z]): V3 => [x * 0.6, magma, z * 0.6]);
  return { collar, bulge, rim, ledge, inner };
}

export function volcanoConeTriangles(model: VolcanoModel): { tris: Tri[]; tone: number[]; heat: number[] } {
  const seed = model.startDate;
  const rings = volcanoRings(model);
  const veins = volcanoVeinPaths(model);
  const tris: Tri[] = [];
  const tone: number[] = [];
  // Кожна грань конуса — чотири трикутники довкола втиснутого центру
  // (власник, 2026-10-04: «додай йому трикутників і трошки тіней»). Центр
  // лише западає, ніколи не випирає: ріки лави лежать над гранями кілець і
  // не ховаються під жоден горбик. Тон кожного трикутника свій і темнішає
  // донизу — тінь біля підніжжя, світло біля жерла.
  const shadeAt = (tri: Tri) => {
    const y = (tri[0][1] + tri[1][1] + tri[2][1]) / 3;
    return 0.74 + 0.26 * Math.min(1, Math.max(0, y / Math.max(1e-6, model.height)));
  };
  for (let k = 0; k < rings.length - 1; k += 1) {
    const lo = rings[k]!;
    const hi = rings[k + 1]!;
    for (let i = 0; i < SIDES; i += 1) {
      const j = (i + 1) % SIDES;
      const corners = [lo.points[i]!, hi.points[i]!, hi.points[j]!, lo.points[j]!];
      const mid: V3 = [0, 0, 0];
      for (const c of corners) { mid[0] += c[0] / 4; mid[1] += c[1] / 4; mid[2] += c[2] / 4; }
      const dent = 1 - 0.045 * unit(seed, `${hi.key}:dent${i}`);
      const lift = (unit(seed, `${hi.key}:lift${i}`) - 0.5) * 0.25 * (hi.y - lo.y);
      const c: V3 = [mid[0] * dent, mid[1] + lift, mid[2] * dent];
      // Сильніша різниця між гранями, без горизонтальних смуг: low-poly
      // референсу читається гранями, а не поясами.
      const t = 0.72 + 0.4 * unit(seed, `${hi.key}:f${i}`);
      for (let q = 0; q < 4; q += 1) {
        const tri: Tri = [corners[q]!, corners[(q + 1) % 4]!, c];
        tris.push(tri);
        tone.push(t * (0.86 + 0.24 * unit(seed, `${hi.key}:f${i}:${q}`)) * shadeAt(tri));
      }
    }
  }
  // Жерло — кам'яне: комір → вал, що випирає назовні → рівна губа →
  // внутрішня стінка до уступу. Лава лише в чаші нижче (`buildVolcanoLava`):
  // лавову корону прибрано на прохання власника.
  const crater = volcanoCrater(model);
  const band = (lo: V3[], hi: V3[], tag: string, base: number) => {
    for (let i = 0; i < SIDES; i += 1) {
      const j = (i + 1) % SIDES;
      const t = base + 0.2 * unit(seed, `${tag}:${i}:f`);
      tris.push([lo[i]!, hi[j]!, lo[j]!], [lo[i]!, hi[i]!, hi[j]!]);
      tone.push(t, t * 0.94);
    }
  };
  band(crater.collar, crater.bulge, 'bulge', 0.8);
  band(crater.bulge, crater.rim, 'rim', 0.8);
  const innerFrom = tris.length;
  band(crater.rim, crater.ledge, 'wall', 0.5);
  // Жар — на кожну вершину, у тому ж порядку, що й трикутники.
  const heat: number[] = [];
  for (const tri of tris) for (const v of tri) heat.push(volcanoRockHeat(model, veins, v));
  // Вал і губа теплі; внутрішня стінка жерла підсвічена лавою знизу.
  for (let k = (innerFrom - SIDES * 4) * 3; k < innerFrom * 3; k += 1) heat[k] = Math.max(heat[k]!, 0.35);
  for (let k = innerFrom * 3; k < heat.length; k += 1) heat[k] = Math.max(heat[k]!, 0.75);
  const ledges = volcanoLedges(model);
  for (const tri of ledges.tris) for (const v of tri) heat.push(volcanoRockHeat(model, veins, v));
  tris.push(...ledges.tris);
  tone.push(...ledges.tone);
  return { tris, tone, heat };
}

/** Радіус справжнього гранчастого конуса на висоті `y` під азимутом `a`. */
export function volcanoConeRadiusAt(rings: readonly Ring[], a: number, y: number): number {
  for (let k = 0; k + 1 < rings.length; k += 1) {
    const lo = volcanoRingHit(rings[k]!.points, a);
    const hi = volcanoRingHit(rings[k + 1]!.points, a);
    if (y >= lo.y && y <= hi.y) return lo.r + ((hi.r - lo.r) * (y - lo.y)) / Math.max(1e-9, hi.y - lo.y);
  }
  return volcanoRingHit(rings[rings.length - 1]!.points, a).r;
}

/** Мінімальна насиченість року, з якої він лишає уступ. */
export const VOLCANO_LEDGE_FERTILITY = 0.4;

/**
 * Уступи насичених років (ADR-0237 §5): на верху шару року, що був
 * насиченим, лава застигла терасою. Тераса — ДУГА на одному боці конуса
 * (азимут — золотий кут року), а не кільце: кільце на кожному насиченому
 * році робило з конуса посмугований стос (живий кадр, 2026-09-29), а смуги
 * власник уже відкидав. Чим насиченіший рік, тим ширша дуга й далі виступ.
 * Над ріками лави тераси немає: вона перекрила б ріку.
 */
export function volcanoLedges(model: VolcanoModel): { tris: Tri[]; tone: number[] } {
  const seed = model.startDate;
  const rings = volcanoRings(model);
  const crater = volcanoCrater(model);
  const notches = volcanoVeinIndices(model).map((i) => Math.atan2(crater.rim[i]![2], crater.rim[i]![0]));
  const tris: Tri[] = [];
  const tone: number[] = [];
  const N = 24;
  for (const layer of model.layers) {
    if (layer.fertility < VOLCANO_LEDGE_FERTILITY || layer.to > model.height * 0.85) continue;
    const y = layer.to;
    const drop = 0.035 + 0.03 * layer.fertility;
    const out = 0.04 + 0.08 * layer.fertility;
    const t = 0.78 + 0.3 * unit(seed, `ledge${layer.year}`);
    const centre = layer.year * 2.399963 + unit(seed, `ledge${layer.year}:a`) * 0.6;
    const span = (0.7 + 1.0 * layer.fertility) * (Math.PI / 3);
    const segments = Math.max(3, Math.round((span / (Math.PI * 2)) * N));
    for (let i = 0; i < segments; i += 1) {
      const a0 = centre - span / 2 + (i / segments) * span;
      const a1 = centre - span / 2 + ((i + 1) / segments) * span;
      const mid = (a0 + a1) / 2;
      const nearRiver = notches.some((n) => Math.abs(Math.atan2(Math.sin(mid - n), Math.cos(mid - n))) < 0.42);
      if (nearRiver) continue;
      const at = (a: number, dy: number, grow: number): V3 => {
        const r = volcanoConeRadiusAt(rings, a, y + dy) * (1 + grow) - (grow === 0 ? 0.004 : 0);
        return [Math.cos(a) * r, y + dy, Math.sin(a) * r];
      };
      const in0 = at(a0, 0, 0);
      const in1 = at(a1, 0, 0);
      // Тераса звужується до кінців дуги — як застиглий язик, а не полиця.
      const taper = (k: number) => Math.sin((Math.PI * k) / segments) ** 0.6;
      const o0 = at(a0, 0, out * taper(i));
      const o1 = at(a1, 0, out * taper(i + 1));
      const b0 = at(a0, -drop, 0);
      const b1 = at(a1, -drop, 0);
      // Полиця зверху й лице вниз до схилу — закручено назовні.
      tris.push([in0, in1, o1], [in0, o1, o0], [o0, o1, b1], [o0, b1, b0]);
      tone.push(t * 1.05, t * 1.05, t * 0.86, t * 0.86);
    }
  }
  return { tris, tone };
}

export interface VolcanoLava {
  /** Трикутники лави: озеро в кратері й жили на схилах. */
  positions: Float32Array;
  /** Жар вершини 0…1: 1 у кратері, згасає вниз по жилі. */
  heat: Float32Array;
  /**
   * Де вершина на ріці: 0 у жерлі … 1 на язику; −1 — чаша й кратери
   * бічних конусів, що світяться завжди. Фронт дотику порівнюється з цим.
   */
  flow: Float32Array;
}

export function buildVolcanoLava(model: VolcanoModel): VolcanoLava {
  const p: number[] = [];
  const h: number[] = [];
  const f: number[] = [];
  const push = (v: V3, heat: number, flow = -1) => { p.push(...v); h.push(heat); f.push(flow); };
  // Озеро: віяло трикутників, що здувається посередині — лава випирає.
  const y = volcanoMagmaY(model) + 0.005;
  const r = volcanoSlopeRadius(model, model.height) * 0.64;
  const dome = model.craterRadius * 0.28;
  for (let i = 0; i < SIDES; i += 1) {
    const a0 = (i / SIDES) * Math.PI * 2;
    const a1 = ((i + 1) / SIDES) * Math.PI * 2;
    push([0, y + dome, 0], 1);
    push([Math.cos(a1) * r, y, Math.sin(a1) * r], 0.85);
    push([Math.cos(a0) * r, y, Math.sin(a0) * r], 0.85);
  }
  // Нижній уступ чаші — розпечений; вище — кам'яна стінка жерла.
  const crater = volcanoCrater(model);
  const band = (a: V3[], b: V3[], ha: number, hb: number) => {
    for (let i = 0; i < SIDES; i += 1) {
      const j = (i + 1) % SIDES;
      push(a[i]!, ha); push(b[j]!, hb); push(a[j]!, ha);
      push(a[i]!, ha); push(b[i]!, hb); push(b[j]!, hb);
    }
  };
  band(crater.ledge, crater.inner, 0.85, 0.92);
  // Ріки: ті самі шляхи, від яких тепліє камінь.
  for (const path of volcanoVeinPaths(model)) {
    let prev: VeinPoint | null = null;
    for (const point of path) {
      const { at, side, wl, wr, heat, flow } = point;
      if (prev) {
        const pa: V3 = [prev.at[0] + prev.side[0] * prev.wl, prev.at[1], prev.at[2] + prev.side[2] * prev.wl];
        const pb: V3 = [prev.at[0] - prev.side[0] * prev.wr, prev.at[1], prev.at[2] - prev.side[2] * prev.wr];
        const qa: V3 = [at[0] + side[0] * wl, at[1], at[2] + side[2] * wl];
        const qb: V3 = [at[0] - side[0] * wr, at[1], at[2] - side[2] * wr];
        push(pa, prev.heat, prev.flow); push(qa, heat, flow); push(pb, prev.heat, prev.flow);
        push(pb, prev.heat, prev.flow); push(qa, heat, flow); push(qb, heat, flow);
      }
      prev = point;
    }
  }
  // Виконані плани — тріщини лави на схилі (ADR-0237, поправка
  // 2026-10-04): власник прибрав бічні конуси, але план не зникає зі
  // світу вулкана — він лишає жевріючу зигзагом розколину там, де стояв
  // конус. Тріщина лежить трохи над справжньою гранню, щоб жодна її не
  // перекрила.
  const rings = volcanoRings(model);
  for (const vent of model.vents) {
    const a = (vent.azimuth * Math.PI) / 180;
    const y0 = vent.at * model.height;
    const len = vent.size * 1.3;
    const width = vent.size * 0.13;
    const side: V3 = [-Math.sin(a), 0, Math.cos(a)];
    const N = 6;
    const spine = Array.from({ length: N + 1 }, (_, k) => {
      const y = y0 + len * (0.55 - k / N);
      const r = volcanoConeRadiusAt(rings, a, y) * 1.015;
      const zig = (k % 2 === 0 ? 1 : -1) * width * 0.8 * (0.5 + unit(model.startDate, `fissure${vent.index}:${k}`));
      const w = width * Math.sin(((k + 0.5) / (N + 1)) * Math.PI);
      return { at: [Math.cos(a) * r + side[0] * zig, y, Math.sin(a) * r + side[2] * zig] as V3, w };
    });
    for (let k = 0; k < N; k += 1) {
      const p0 = spine[k]!;
      const p1 = spine[k + 1]!;
      const l0: V3 = [p0.at[0] + side[0] * p0.w, p0.at[1], p0.at[2] + side[2] * p0.w];
      const r0: V3 = [p0.at[0] - side[0] * p0.w, p0.at[1], p0.at[2] - side[2] * p0.w];
      const l1: V3 = [p1.at[0] + side[0] * p1.w, p1.at[1], p1.at[2] + side[2] * p1.w];
      const r1: V3 = [p1.at[0] - side[0] * p1.w, p1.at[1], p1.at[2] - side[2] * p1.w];
      push(l0, 0.7); push(l1, 0.7); push(p0.at, 1);
      push(p0.at, 1); push(l1, 0.7); push(p1.at, 1);
      push(r0, 0.7); push(p0.at, 1); push(r1, 0.7);
      push(p0.at, 1); push(p1.at, 1); push(r1, 0.7);
    }
  }
  return { positions: new Float32Array(p), heat: new Float32Array(h), flow: new Float32Array(f) };
}

/**
 * Колонія кожного року — на білому плато кільцем довкола підніжжя, як
 * рослини й кристали в референсі власника; конус лишається чистим. Старші
 * роки ближче до підніжжя, молодші — далі: кільце росте назовні з роками,
 * азимут — золотий кут колонії рифу.
 */
export function volcanoPlacements(model: VolcanoModel): ReefV2Placement[] {
  const seed = model.startDate;
  const out: ReefV2Placement[] = [];
  const years = Math.max(1, model.life.colonies.length);
  for (const [index, c] of model.life.colonies.entries()) {
    const a0 = (c.azimuth * Math.PI) / 180;
    const r0 = model.baseRadius * (1.04 + 0.1 * (index / years));
    // Скільки коралів у колонії — спогади цього року (ADR-0237): 1 на тихий
    // рік, до чотирьох на рік, повний спогадів. Небагато — власник: «прибери
    // … коралів в дві третини».
    const memories = model.layers.find((l) => l.year === c.year)?.memories ?? 0;
    const bodies = 1 + Math.min(3, Math.floor(Math.log2(1 + memories / 2)));
    for (let j = 0; j < bodies; j += 1) {
      const key = `colony${c.year}:body${j}`;
      let a = a0;
      let r = r0;
      // Корали дрібніші за рифові (власник: «зменш корали»): вулкан — герой.
      let scale = 0.6;
      if (j > 0) {
        a = a0 + ((j % 2 ? 1 : -1) * Math.ceil(j / 2) * c.size * (0.5 + 0.25 * unit(seed, `${key}:d`))) / r0;
        r = r0 * (0.98 + 0.08 * unit(seed, `${key}:r`));
        scale = 0.36 + 0.2 * unit(seed, `${key}:s`);
      }
      out.push({ colony: c, body: j, key, size: c.size * scale, base: [Math.cos(a) * r, 0, Math.sin(a) * r], axis: [0, 1, 0] });
    }
  }
  return out;
}

const UNDERGROWTH_FORMS: readonly ReefForm[] = ['finger', 'brain', 'branch', 'tube', 'finger', 'fan'];
/** Підросту — пояс біля підніжжя, не шуба на конусі: небагато й дрібно. */
const UNDERGROWTH_MAX = 12;

export function volcanoUndergrowth(model: VolcanoModel): ReefV2Placement[] {
  const seed = model.startDate;
  const out: ReefV2Placement[] = [];
  const count = Math.min(UNDERGROWTH_MAX, Math.round(model.life.undergrowth / 12));
  for (let k = 0; k < count; k += 1) {
    const key = `under${k}`;
    const a = 2 * Math.PI * unit(seed, `${key}:a`);
    const r = model.baseRadius * (0.99 + 0.12 * unit(seed, `${key}:r`));
    const size = 0.055 + 0.075 * unit(seed, `${key}:s`);
    const form = UNDERGROWTH_FORMS[Math.min(5, Math.floor(unit(seed, `${key}:f`) * 6))]!;
    const colony: ReefV2Colony = { year: -1, age: 0, activity: 0, form, size, bodies: 1, azimuth: 0, reach: 0, hue: unit(seed, `${key}:h`) };
    out.push({ colony, body: k, key, size, base: [Math.cos(a) * r, 0, Math.sin(a) * r], axis: [0, 1, 0] });
  }
  return out;
}

export function volcanoOrnaments(model: VolcanoModel): ReefV2Ornaments {
  const seed = model.startDate;
  const life = model.life;
  return {
    anemones: life.anemones.map((a) => {
      const t = 2 * Math.PI * unit(seed, `anemone${a.id}:a`);
      const r = model.baseRadius * (1.02 + 0.2 * unit(seed, `anemone${a.id}:r`));
      return { position: [Math.cos(t) * r, 0, Math.sin(t) * r] as V3, channel: a.channel };
    }),
    clams: Array.from({ length: life.clams }, (_, k): V3 => {
      const a = 2 * Math.PI * unit(seed, `clam${k}:a`);
      const r = model.baseRadius * (1.02 + 0.12 * unit(seed, `clam${k}:r`));
      return [Math.cos(a) * r, 0, Math.sin(a) * r];
    }),
    starfish: Array.from({ length: life.starfish }, (_, k) => {
      const a = 2 * Math.PI * unit(seed, `star${k}:a`);
      const d = model.baseRadius * (1.1 + 0.35 * unit(seed, `star${k}:d`));
      return { position: [Math.cos(a) * d, 0, Math.sin(a) * d] as V3, turn: 360 * unit(seed, `star${k}:t`) };
    }),
    // Риби кружляють довкола вулкана на всю його висоту.
    // Третина риб і трави рифу: вулкан не акваріум (власник, ADR-0235).
    fish: Array.from({ length: Math.round(life.fish / 3) }, (_, k) => ({
      orbit: model.baseRadius * (1.15 + 0.6 * unit(seed, `fish${k}:r`)),
      height: 0.15 + (model.height + 0.25) * unit(seed, `fish${k}:y`),
      phase: 360 * unit(seed, `fish${k}:p`),
      speed: 0.7 + 0.6 * unit(seed, `fish${k}:s`),
    })),
    seagrass: Array.from({ length: Math.round(life.seagrass / 3) }, (_, k): V3 => {
      const a = 2 * Math.PI * unit(seed, `grass${k}:a`);
      const d = model.baseRadius * 1.04 + 2.2 * unit(seed, `grass${k}:d`) ** 1.5;
      return [Math.cos(a) * d, 0, Math.sin(a) * d];
    }),
  };
}

export interface VolcanoGeometry extends ReefV2Geometry {
  /** Жар кожної вершини каменю (у порядку `rock.positions`). */
  rockHeat: Float32Array;
  lava: VolcanoLava;
  magmaY: number;
}

export function buildVolcanoGeometry(model: VolcanoModel): VolcanoGeometry {
  const cone = volcanoConeTriangles(model);
  const placements = [...volcanoPlacements(model), ...volcanoUndergrowth(model)];
  // Губа жерла здіймається над останнім шаром.
  const top = Math.max(model.height + model.craterRadius * 0.7, ...placements.map((p) => p.base[1] + p.axis[1] * REEF_FORM_HEIGHT[p.colony.form] * p.size));
  // Корал на плато сягає вбік на ~0.35 свого розміру (форми рифу вужчі за висоту).
  const reach = Math.max(model.baseRadius * 1.1, ...placements.map((p) => Math.hypot(p.base[0], p.base[2]) + p.size * 0.35));
  const life = assembleReefLife(model.life, {
    rock: cone.tris,
    rockTone: (face) => cone.tone[face]!,
    placements,
    ornaments: volcanoOrnaments(model),
    top,
    reach,
  });
  return { ...life, rockHeat: new Float32Array(cone.heat), lava: buildVolcanoLava(model), magmaY: volcanoMagmaY(model) };
}
