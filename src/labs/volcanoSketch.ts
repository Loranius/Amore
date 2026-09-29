// ============================================================
// Підводний вулкан — ЕСКІЗ нового виду замість рифу (2026-09-29).
// ------------------------------------------------------------
// Власник: «риф … немає героя … давай зробимо підводний вулкан, як героя,
// який буде рости вище і вище, а навколо нього будуть з'являтись рибки,
// корали що ростуть на ньому і водорості, створи попередньо ескіз».
//
// Це ЕСКІЗ у лабораторії, а не вид рушія: жодної моделі росту, двійника чи
// ADR — лише щоб подивитись, чи тримає вулкан роль героя. Але вже зараз
// він підкоряється догмі власника «час — основна валюта росту»: кожен
// прожитий рік — шар застиглої лави, тож вулкан вищає щороку, навіть коли
// подій немає. Випадковість — лише хеш пари (`unit`), тож та сама пара на
// 3, 8 і 15 роках — той самий вулкан, що підріс, а не три різні.
// ============================================================
import { unit } from '@/engine/species/crystalV2/hash';

export type V3 = [number, number, number];

/** Розміри вулкана за віком: росте завжди, але дедалі повільніше. */
export function volcanoShape(years: number) {
  const grown = 1 - Math.exp(-years / 8);
  return {
    height: 0.55 + 2.2 * grown,
    baseRadius: 0.95 + 0.4 * (1 - Math.exp(-years / 10)),
    craterRadius: 0.2 + 0.06 * grown,
    /** Шар на рік; понад 18 шари зливаються — інакше смуги стають шумом. */
    layers: Math.max(2, Math.min(18, Math.round(years))),
    corals: Math.min(70, Math.round(3 + 3.4 * years)),
    kelp: Math.min(26, Math.round(3 + 1.3 * years)),
    fish: Math.min(22, Math.round(2 + 1.25 * years)),
  };
}

const SIDES = 11;

/** Радіус схилу на частці висоти `f`: увігнутий конус, як справжній стратовулкан. */
export function slopeRadius(years: number, f: number): number {
  const s = volcanoShape(years);
  return s.craterRadius + (s.baseRadius - s.craterRadius) * Math.pow(1 - f, 1.35);
}

export interface FlatMesh { positions: Float32Array; colors: Float32Array }

function hex(color: number): V3 {
  return [((color >> 16) & 255) / 255, ((color >> 8) & 255) / 255, (color & 255) / 255];
}
const shade = (c: V3, k: number): V3 => [Math.min(1, c[0] * k), Math.min(1, c[1] * k), Math.min(1, c[2] * k)];
const mix = (a: V3, b: V3, t: number): V3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

class Builder {
  p: number[] = [];
  c: number[] = [];
  tri(a: V3, b: V3, d: V3, color: V3) {
    this.p.push(...a, ...b, ...d);
    for (let i = 0; i < 3; i += 1) this.c.push(...color);
  }
  done(): FlatMesh {
    return { positions: new Float32Array(this.p), colors: new Float32Array(this.c) };
  }
}

const BASALT = hex(0x5b4b93);
const BASALT_YOUNG = hex(0x9a5a86);
const EMBER = hex(0xff6a4a);

/**
 * Конус із кільцями-роками. Старі шари внизу темніші й холодніші, верхні —
 * теплішають до кратера: видно, де вулкан живий.
 */
export function buildVolcano(seed: string, years: number): FlatMesh {
  const s = volcanoShape(years);
  const out = new Builder();
  const rings: V3[][] = [];
  for (let k = 0; k <= s.layers; k += 1) {
    const f = k / s.layers;
    const ring: V3[] = [];
    for (let i = 0; i < SIDES; i += 1) {
      // Шум прив'язаний до ШАРУ, а не до частки висоти: той самий рік
      // лишається тим самим каменем, коли вулкан підростає.
      const tag = `v:${k}:${i}`;
      const lip = k === s.layers ? 1.08 : 1;
      const r = slopeRadius(years, f) * (1 + 0.14 * (unit(seed, `${tag}:r`) - 0.5)) * lip;
      const a = ((i + 0.3 * (unit(seed, `${tag}:a`) - 0.5)) / SIDES) * Math.PI * 2;
      const y = f * s.height + (k > 0 && k < s.layers ? 0.05 * (unit(seed, `${tag}:y`) - 0.5) : 0);
      ring.push([Math.cos(a) * r, y, Math.sin(a) * r]);
    }
    rings.push(ring);
  }
  for (let k = 0; k < s.layers; k += 1) {
    const f = k / s.layers;
    const band = mix(BASALT, BASALT_YOUNG, Math.pow(f, 1.5));
    for (let i = 0; i < SIDES; i += 1) {
      const j = (i + 1) % SIDES;
      const a = rings[k]![i]!;
      const b = rings[k]![j]!;
      const c = rings[k + 1]![j]!;
      const d = rings[k + 1]![i]!;
      const tone = 0.82 + 0.3 * unit(seed, `f:${k}:${i}`) + (k % 2 === 0 ? 0.06 : -0.04);
      out.tri(a, c, b, shade(band, tone));
      out.tri(a, d, c, shade(band, tone * 0.97));
    }
  }
  // Кратер: губа загортається всередину й униз, до озера магми.
  const top = rings[s.layers]!;
  const depth = s.height - 0.16 - 0.04 * s.height;
  const inner: V3[] = top.map(([x, , z]) => [x * 0.62, depth, z * 0.62]);
  for (let i = 0; i < SIDES; i += 1) {
    const j = (i + 1) % SIDES;
    const glow = mix(shade(BASALT, 0.7), EMBER, 0.35);
    out.tri(top[i]!, top[j]!, inner[j]!, shade(glow, 0.8 + 0.3 * unit(seed, `c:${i}`)));
    out.tri(top[i]!, inner[j]!, inner[i]!, shade(glow, 0.75 + 0.3 * unit(seed, `c:${i}`)));
  }
  return out.done();
}

/**
 * Жили лави: по кількох «стовпцях» граней від кратера вниз тече світло.
 * Окремий меш, бо світиться (вершинний колір не світить). Довжина жил
 * росте з віком: молодий вулкан ледь тліє, старий — у сяйві.
 */
export function buildLavaVeins(seed: string, years: number): Float32Array {
  const s = volcanoShape(years);
  const out: number[] = [];
  const veins = 3 + Math.min(3, Math.floor(years / 5));
  const reach = Math.min(0.75, 0.3 + years * 0.03);
  for (let v = 0; v < veins; v += 1) {
    const a0 = unit(seed, `vein:${v}:a`) * Math.PI * 2;
    const steps = 7;
    let prev: V3 | null = null;
    let prevW = 0;
    for (let k = 0; k <= steps; k += 1) {
      const f = 1 - (k / steps) * reach;
      const a = a0 + 0.18 * Math.sin(k * 1.7 + v);
      const r = slopeRadius(years, f) * 1.015;
      const p: V3 = [Math.cos(a) * r, f * s.height, Math.sin(a) * r];
      const w = 0.05 * (1 - k / steps) + 0.012;
      if (prev) {
        const t: V3 = [-Math.sin(a), 0, Math.cos(a)];
        const pa: V3 = [prev[0] + t[0] * prevW, prev[1], prev[2] + t[2] * prevW];
        const pb: V3 = [prev[0] - t[0] * prevW, prev[1], prev[2] - t[2] * prevW];
        const qa: V3 = [p[0] + t[0] * w, p[1], p[2] + t[2] * w];
        const qb: V3 = [p[0] - t[0] * w, p[1], p[2] - t[2] * w];
        out.push(...pa, ...qa, ...pb, ...pb, ...qa, ...qb);
      }
      prev = p;
      prevW = w;
    }
  }
  return new Float32Array(out);
}

/** Озеро магми в кратері — окремо, бо світиться. */
export function magmaLevel(years: number): { y: number; radius: number } {
  const s = volcanoShape(years);
  return { y: s.height - 0.17 - 0.04 * s.height, radius: s.craterRadius * 0.95 };
}

/** Піщане дно острова зверху, фіолетова скеля знизу — як острівці інших видів. */
export function buildSeabed(seed: string): FlatMesh {
  const out = new Builder();
  const R = 2.05;
  const n = 16;
  const rim: V3[] = [];
  const under: V3[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = ((i + 0.35 * (unit(seed, `b:${i}:a`) - 0.5)) / n) * Math.PI * 2;
    const r = R * (0.93 + 0.12 * unit(seed, `b:${i}:r`));
    rim.push([Math.cos(a) * r, 0.02 * unit(seed, `b:${i}:y`), Math.sin(a) * r]);
    const r2 = r * (0.62 + 0.12 * unit(seed, `b:${i}:u`));
    under.push([Math.cos(a) * r2, -0.55 - 0.25 * unit(seed, `b:${i}:d`), Math.sin(a) * r2]);
  }
  const sand = hex(0xe6d3ae);
  const rock = hex(0x7a64d8);
  const centre: V3 = [0, 0, 0];
  const tip: V3 = [0.1, -1.9, -0.05];
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    out.tri(centre, rim[j]!, rim[i]!, shade(sand, 0.9 + 0.15 * unit(seed, `s:${i}`)));
    out.tri(rim[i]!, rim[j]!, under[j]!, shade(rock, 0.85 + 0.3 * unit(seed, `k:${i}:a`)));
    out.tri(rim[i]!, under[j]!, under[i]!, shade(rock, 0.8 + 0.3 * unit(seed, `k:${i}:b`)));
    out.tri(under[i]!, under[j]!, tip, shade(rock, 0.6 + 0.25 * unit(seed, `k:${i}:c`)));
  }
  return out.done();
}

export const REEF_COLORS = [0xff6f91, 0xff9e6d, 0xc77dff, 0x4fd1c5, 0xffd166, 0xff5fa2] as const;

export type CoralKind = 'branch' | 'fan' | 'brain';

export interface CoralSpot { position: V3; outward: V3; kind: CoralKind; color: number; size: number }

/**
 * Корали сідають на схили, але не біля кратера — там гаряче. Порядок
 * фіксований хешем: у старшої пари ті самі корали, що в молодшої, плюс нові.
 */
export function coralSpots(seed: string, years: number): CoralSpot[] {
  const s = volcanoShape(years);
  const spots: CoralSpot[] = [];
  for (let i = 0; i < s.corals; i += 1) {
    const f = 0.04 + 0.66 * unit(seed, `cor:${i}:f`);
    const a = unit(seed, `cor:${i}:a`) * Math.PI * 2;
    const r = slopeRadius(years, f) * 0.97;
    const outward: V3 = [Math.cos(a), 0.55, Math.sin(a)];
    const pick = unit(seed, `cor:${i}:k`);
    spots.push({
      position: [Math.cos(a) * r, f * s.height, Math.sin(a) * r],
      outward,
      kind: pick < 0.45 ? 'branch' : pick < 0.75 ? 'fan' : 'brain',
      color: REEF_COLORS[Math.floor(unit(seed, `cor:${i}:c`) * REEF_COLORS.length)]!,
      // Корал росте разом із вулканом: старші більші.
      size: (0.14 + 0.12 * unit(seed, `cor:${i}:s`)) * (0.8 + 0.25 * Math.min(1, years / 12)),
    });
  }
  return spots;
}

export interface KelpSpot { position: V3; height: number; phase: number; color: number }

export function kelpSpots(seed: string, years: number): KelpSpot[] {
  const s = volcanoShape(years);
  const out: KelpSpot[] = [];
  for (let i = 0; i < s.kelp; i += 1) {
    const a = unit(seed, `kelp:${i}:a`) * Math.PI * 2;
    const r = s.baseRadius + 0.12 + (1.85 - s.baseRadius - 0.12) * unit(seed, `kelp:${i}:r`);
    out.push({
      position: [Math.cos(a) * r, 0, Math.sin(a) * r],
      height: (0.35 + 0.55 * unit(seed, `kelp:${i}:h`)) * (0.7 + 0.5 * Math.min(1, years / 10)),
      phase: unit(seed, `kelp:${i}:p`) * Math.PI * 2,
      color: unit(seed, `kelp:${i}:c`) < 0.6 ? 0x3fbf7f : 0x8fd694,
    });
  }
  return out;
}

export interface FishPath { radius: number; height: number; speed: number; phase: number; color: number; size: number; tilt: number }

export function fishPaths(seed: string, years: number): FishPath[] {
  const s = volcanoShape(years);
  const out: FishPath[] = [];
  for (let i = 0; i < s.fish; i += 1) {
    out.push({
      radius: s.baseRadius + 0.35 + 1.1 * unit(seed, `fish:${i}:r`),
      height: 0.3 + (s.height + 0.2) * unit(seed, `fish:${i}:h`),
      speed: (0.25 + 0.35 * unit(seed, `fish:${i}:v`)) * (unit(seed, `fish:${i}:d`) < 0.5 ? 1 : -1),
      phase: unit(seed, `fish:${i}:p`) * Math.PI * 2,
      color: REEF_COLORS[Math.floor(unit(seed, `fish:${i}:c`) * REEF_COLORS.length)]!,
      size: 0.06 + 0.05 * unit(seed, `fish:${i}:s`),
      tilt: 0.25 * (unit(seed, `fish:${i}:t`) - 0.5),
    });
  }
  return out;
}
