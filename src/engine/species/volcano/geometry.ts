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
/**
 * Корали займають нижні 62% висоти, у хронологічному порядку: верхівка з
 * кратером і лавою лишається голою. На першому живому кадрі лабораторії
 * корали останніх років (їхні шари тонкі й тісняться під кратером)
 * накривали вершину шапкою, і герой губив корону.
 */
export const CORAL_CEILING = 0.62;

const norm = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

/** Вісь колонії на схилі: назовні й угору — корал росте до світла. */
function slopeAxis(azimuth: number, tiltDeg = 38): V3 {
  const t = (tiltDeg * Math.PI) / 180;
  return norm([Math.sin(t) * Math.cos(azimuth), Math.cos(t), Math.sin(t) * Math.sin(azimuth)]);
}

function onSlope(model: VolcanoModel, azimuth: number, y: number, inset = 0.97): V3 {
  const r = volcanoSlopeRadius(model, y) * inset;
  return [Math.cos(azimuth) * r, y, Math.sin(azimuth) * r];
}

interface Ring { y: number; key: string; points: V3[] }

/** Кільця конуса: підніжжя, верх пагорба, межі шарів і губа кратера. */
export function volcanoRings(model: VolcanoModel): Ring[] {
  const seed = model.startDate;
  const heights: { y: number; key: string }[] = [
    { y: -0.08, key: 'foot' },
    { y: Math.min(model.height, 0.35), key: 'hill' },
    ...model.layers.map((l) => ({ y: l.to, key: `year${l.year}` })),
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

interface VeinPoint { at: V3; side: V3; w: number; heat: number }

/** Шляхи жил лави: від губи кратера вниз схилом, звужуються й холонуть. */
export function volcanoVeinPaths(model: VolcanoModel): VeinPoint[][] {
  const seed = model.startDate;
  const reach = Math.min(0.7, 0.28 + 0.03 * model.years);
  const paths: VeinPoint[][] = [];
  for (let v = 0; v < model.veins; v += 1) {
    const a0 = unit(seed, `vein${v}:a`) * Math.PI * 2;
    const steps = 8;
    const path: VeinPoint[] = [];
    for (let k = 0; k <= steps; k += 1) {
      const f = 1 - (k / steps) * reach;
      const a = a0 + 0.16 * Math.sin(k * 1.9 + v * 2.3);
      path.push({
        at: onSlope(model, a, f * model.height, 1.012),
        side: [-Math.sin(a), 0, Math.cos(a)],
        w: 0.045 * (1 - k / steps) + 0.012,
        heat: 1 - 0.85 * (k / steps),
      });
    }
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
      heat = Math.max(heat, 0.75 * v.heat * Math.exp(-((d / 0.14) ** 2)));
    }
  }
  return Math.min(1, heat);
}

/** Бічний конус: 7 граней, власний маленький кратер. */
function ventTriangles(model: VolcanoModel, vent: VolcanoModel['vents'][number]): { tris: Tri[]; tone: number[]; heat: number[] } {
  const seed = model.startDate;
  const a = (vent.azimuth * Math.PI) / 180;
  const y0 = vent.at * model.height;
  const base = onSlope(model, a, y0, 0.93);
  const out: V3 = [Math.cos(a), 0, Math.sin(a)];
  // Конус стоїть на схилі й хилиться назовні.
  const axis = norm([out[0] * 0.35, 1, out[2] * 0.35]);
  const tip: V3 = [base[0] + axis[0] * vent.size, base[1] + axis[1] * vent.size, base[2] + axis[2] * vent.size];
  const n = 7;
  const r0 = vent.size * 0.95;
  const r1 = vent.size * 0.28;
  const ring = (centre: V3, r: number, tag: string): V3[] => Array.from({ length: n }, (_, i) => {
    const t = ((i + 0.3 * (unit(seed, `${tag}:${i}`) - 0.5)) / n) * Math.PI * 2;
    return [centre[0] + Math.cos(t) * r, centre[1] - (tag.endsWith('lo') ? 0.03 : 0), centre[2] + Math.sin(t) * r];
  });
  const lo = ring([base[0], base[1] - vent.size * 0.15, base[2]], r0, `vent${vent.year}:lo`);
  const hi = ring(tip, r1, `vent${vent.year}:hi`);
  const pit: V3 = [tip[0], tip[1] - vent.size * 0.2, tip[2]];
  const tris: Tri[] = [];
  const tone: number[] = [];
  const heat: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    const t = 0.8 + 0.25 * unit(seed, `vent${vent.year}:f${i}`);
    tris.push([lo[i]!, hi[j]!, lo[j]!], [lo[i]!, hi[i]!, hi[j]!], [hi[i]!, pit, hi[j]!]);
    tone.push(t, t * 0.95, 0.5);
    heat.push(0, 0.35, 0.35, 0, 0.35, 0.35, 0.35, 0.9, 0.35);
  }
  return { tris, tone, heat };
}

export function volcanoConeTriangles(model: VolcanoModel): { tris: Tri[]; tone: number[]; heat: number[] } {
  const seed = model.startDate;
  const rings = volcanoRings(model);
  const veins = volcanoVeinPaths(model);
  const tris: Tri[] = [];
  const tone: number[] = [];
  for (let k = 0; k < rings.length - 1; k += 1) {
    const lo = rings[k]!;
    const hi = rings[k + 1]!;
    // Смуги років: сусідні шари трохи різняться тоном — видно, скільки їх.
    const band = k % 2 === 0 ? 0.05 : -0.04;
    for (let i = 0; i < SIDES; i += 1) {
      const j = (i + 1) % SIDES;
      const t = 0.82 + 0.26 * unit(seed, `${hi.key}:f${i}`) + band;
      tris.push([lo.points[i]!, hi.points[j]!, lo.points[j]!], [lo.points[i]!, hi.points[i]!, hi.points[j]!]);
      tone.push(t, t * 0.96);
    }
  }
  // Жерло — об'ємне, а не пласке кільце (власник: «зроби жерло вулкана
  // трошки об'ємнішим, не таким пласким»). Верх останнього шару — комір;
  // над ним нерівна губа, що здіймається й трохи загортається всередину;
  // усередині — чаша у два уступи до озера лави.
  const collar = rings[rings.length - 1]!.points;
  const R = model.craterRadius;
  // Губа з округлим валом: спершу випирає назовні, потім загортається
  // всередину. Одне кільце без валу з бокової камери читалось пласким.
  const lift = collar.map((_, i) => R * (0.4 + 0.3 * unit(seed, `rim:${i}:y`)));
  const bulge = collar.map(([x, y, z], i): V3 => [x * 1.1, y + lift[i]! * 0.45, z * 1.1]);
  const rim = collar.map(([x, y, z], i): V3 => [x * 0.9, y + lift[i]!, z * 0.9]);
  const magma = volcanoMagmaY(model);
  const ledge = collar.map(([x, y, z], i): V3 => [x * 0.76, y - R * (0.08 + 0.08 * unit(seed, `ledge:${i}`)), z * 0.76]);
  const inner = collar.map(([x, , z]): V3 => [x * 0.6, magma, z * 0.6]);
  for (const [lo, hi, tag] of [[collar, bulge, 'bulge'], [bulge, rim, 'rim']] as const) {
    for (let i = 0; i < SIDES; i += 1) {
      const j = (i + 1) % SIDES;
      const t = 0.78 + 0.24 * unit(seed, `${tag}:${i}:f`);
      tris.push([lo[i]!, hi[j]!, lo[j]!], [lo[i]!, hi[i]!, hi[j]!]);
      tone.push(t, t * 0.94);
    }
  }
  const outerCount = tris.length;
  const stepDown = (a: V3[], b: V3[], dark: number) => {
    for (let i = 0; i < SIDES; i += 1) {
      const j = (i + 1) % SIDES;
      tris.push([a[i]!, a[j]!, b[j]!], [a[i]!, b[j]!, b[i]!]);
      tone.push(dark, dark * 0.9);
    }
  };
  stepDown(rim, ledge, 0.62);
  stepDown(ledge, inner, 0.5);
  // Жар — на кожну вершину, у тому ж порядку, що й трикутники.
  const heat: number[] = [];
  for (const tri of tris) for (const v of tri) heat.push(volcanoRockHeat(model, veins, v));
  // Нутро чаші розпечене незалежно від відстані до жил; губа — тепла.
  for (let k = outerCount * 3; k < heat.length; k += 1) heat[k] = Math.max(heat[k]!, 0.8);
  for (let k = (outerCount - SIDES * 4) * 3; k < outerCount * 3; k += 1) heat[k] = Math.max(heat[k]!, 0.45);
  for (const vent of model.vents) {
    const v = ventTriangles(model, vent);
    tris.push(...v.tris);
    tone.push(...v.tone);
    heat.push(...v.heat);
  }
  return { tris, tone, heat };
}

export interface VolcanoLava {
  /** Трикутники лави: озеро в кратері й жили на схилах. */
  positions: Float32Array;
  /** Жар вершини 0…1: 1 у кратері, згасає вниз по жилі. */
  heat: Float32Array;
}

export function buildVolcanoLava(model: VolcanoModel): VolcanoLava {
  const p: number[] = [];
  const h: number[] = [];
  const push = (v: V3, heat: number) => { p.push(...v); h.push(heat); };
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
  // Жили: ті самі шляхи, від яких тепліє камінь.
  for (const path of volcanoVeinPaths(model)) {
    let prev: VeinPoint | null = null;
    for (const point of path) {
      const { at, side, w, heat } = point;
      if (prev) {
        const pa: V3 = [prev.at[0] + prev.side[0] * prev.w, prev.at[1], prev.at[2] + prev.side[2] * prev.w];
        const pb: V3 = [prev.at[0] - prev.side[0] * prev.w, prev.at[1], prev.at[2] - prev.side[2] * prev.w];
        const qa: V3 = [at[0] + side[0] * w, at[1], at[2] + side[2] * w];
        const qb: V3 = [at[0] - side[0] * w, at[1], at[2] - side[2] * w];
        push(pa, prev.heat); push(qa, heat); push(pb, prev.heat);
        push(pb, prev.heat); push(qa, heat); push(qb, heat);
      }
      prev = point;
    }
  }
  // Кратери бічних конусів тліють.
  for (const vent of model.vents) {
    const a = (vent.azimuth * Math.PI) / 180;
    const base = onSlope(model, a, vent.at * model.height, 0.93);
    const axis = norm([Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35]);
    const c: V3 = [base[0] + axis[0] * vent.size * 0.85, base[1] + axis[1] * vent.size * 0.85, base[2] + axis[2] * vent.size * 0.85];
    const r = vent.size * 0.22;
    for (let i = 0; i < 6; i += 1) {
      const t0 = (i / 6) * Math.PI * 2;
      const t1 = ((i + 1) / 6) * Math.PI * 2;
      push(c, 0.95);
      push([c[0] + Math.cos(t1) * r, c[1], c[2] + Math.sin(t1) * r], 0.7);
      push([c[0] + Math.cos(t0) * r, c[1], c[2] + Math.sin(t0) * r], 0.7);
    }
  }
  return { positions: new Float32Array(p), heat: new Float32Array(h) };
}

/** Колонія кожного року — на шарі свого року; тіла — вздовж шару. */
export function volcanoPlacements(model: VolcanoModel): ReefV2Placement[] {
  const seed = model.startDate;
  const out: ReefV2Placement[] = [];
  const ceiling = model.height * CORAL_CEILING;
  for (const c of model.life.colonies) {
    const layer = model.layers.find((l) => l.year === c.year);
    // Хронологія зберігається, але стискається в нижні 62% висоти.
    const yMid = (layer ? (layer.from + layer.to) / 2 : 0.2) * CORAL_CEILING;
    const a0 = (c.azimuth * Math.PI) / 180;
    for (let j = 0; j < c.bodies; j += 1) {
      const key = `colony${c.year}:body${j}`;
      let a = a0;
      let y = Math.min(ceiling, yMid);
      // Корали дрібніші за рифові (власник: «зменш корали»): вулкан — герой,
      // корали на ньому — його мешканці, а не шуба.
      let scale = 0.6;
      if (j > 0) {
        const r = Math.max(0.2, volcanoSlopeRadius(model, y));
        a = a0 + ((j % 2 ? 1 : -1) * Math.ceil(j / 2) * c.size * (0.55 + 0.25 * unit(seed, `${key}:d`))) / r;
        y = Math.min(ceiling, Math.max(0.02, y + (unit(seed, `${key}:y`) - 0.5) * c.size * 0.6));
        scale = 0.36 + 0.2 * unit(seed, `${key}:s`);
      }
      const size = c.size * scale;
      out.push({ colony: c, body: j, key, size, base: onSlope(model, a, y, 0.96), axis: slopeAxis(a) });
    }
  }
  return out;
}

const UNDERGROWTH_FORMS: readonly ReefForm[] = ['finger', 'brain', 'branch', 'tube', 'finger', 'fan'];

/** Підріст: дрібні корали по схилах і поясом біля підніжжя. */
export function volcanoUndergrowth(model: VolcanoModel): ReefV2Placement[] {
  const seed = model.startDate;
  const out: ReefV2Placement[] = [];
  const ceiling = model.height * CORAL_CEILING;
  for (let k = 0; k < model.life.undergrowth; k += 1) {
    const key = `under${k}`;
    const a = 2 * Math.PI * unit(seed, `${key}:a`);
    const foot = k % 3 === 2;
    const y = foot ? 0 : ceiling * Math.pow(unit(seed, `${key}:y`), 1.4);
    const size = 0.055 + 0.075 * unit(seed, `${key}:s`);
    const form = UNDERGROWTH_FORMS[Math.min(5, Math.floor(unit(seed, `${key}:f`) * 6))]!;
    const colony: ReefV2Colony = { year: -1, age: 0, activity: 0, form, size, bodies: 1, azimuth: 0, reach: 0, hue: unit(seed, `${key}:h`) };
    const base: V3 = foot
      ? (() => {
          const r = model.baseRadius * (0.98 + 0.08 * unit(seed, `${key}:r`));
          return [Math.cos(a) * r, 0, Math.sin(a) * r];
        })()
      : onSlope(model, a, y, 0.96);
    out.push({ colony, body: k, key, size, base, axis: foot ? [0, 1, 0] : slopeAxis(a, 30) });
  }
  return out;
}

export function volcanoOrnaments(model: VolcanoModel): ReefV2Ornaments {
  const seed = model.startDate;
  const life = model.life;
  const slopeSpot = (tag: string, lo: number, hi: number): V3 => {
    const a = 2 * Math.PI * unit(seed, `${tag}:a`);
    const y = model.height * (lo + (hi - lo) * unit(seed, `${tag}:y`));
    return onSlope(model, a, y, 0.98);
  };
  return {
    anemones: life.anemones.map((a) => ({ position: slopeSpot(`anemone${a.id}`, 0.05, 0.7), channel: a.channel })),
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
    fish: Array.from({ length: life.fish }, (_, k) => ({
      orbit: model.baseRadius * (1.15 + 0.6 * unit(seed, `fish${k}:r`)),
      height: 0.15 + (model.height + 0.25) * unit(seed, `fish${k}:y`),
      phase: 360 * unit(seed, `fish${k}:p`),
      speed: 0.7 + 0.6 * unit(seed, `fish${k}:s`),
    })),
    seagrass: Array.from({ length: life.seagrass }, (_, k): V3 => {
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
  const reach = Math.max(model.baseRadius * 1.1, ...placements.map((p) => Math.hypot(p.base[0], p.base[2]) + p.size * 0.6));
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
