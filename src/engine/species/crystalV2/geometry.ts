// ============================================================
// Кристал v2 — геометрія з моделі (ADR-0217).
// ------------------------------------------------------------
// Той самий алгоритм, що в Python-двійнику (`crystal_twin/geometry.py`).
// Кожне тіло — шестигранне веретено: звужене до основи, найширше на плечі,
// з ярусною вершиною. Кільце ярусу j+1 —
// це кільце j, стиснуте до осі й зсунуте до вершини, тож відповідні ребра
// паралельні й кожна грань ПЛАСКА за побудовою. Нерівність граней дає не шум
// (власник: «не роби поверхні кривими чи шумними»), а різні кут і відстань
// кожної грані.
//
// Основа кожного тіла заглиблена в жеоду: зрізу знизу не видно ні збоку, ні
// з-під низу, бо над породою його немає (правило цілісності кріплення).
//
// Модуль чистий: лише масиви, без three, без React.
// ============================================================
import { unit } from './hash';
import type { CrystalV2Model } from './model';

type V3 = [number, number, number];

/** Трикутник: три вершини, номер грані, які ребра справжні (навпроти вершини k). */
interface Tri {
  points: [V3, V3, V3];
  face: number;
  edges: [boolean, boolean, boolean];
}

const QUAD_A: [boolean, boolean, boolean] = [true, false, true];
const QUAD_B: [boolean, boolean, boolean] = [true, true, false];
const TRI: [boolean, boolean, boolean] = [true, true, true];

/**
 * Трикутник, закручений ПРОТИ годинникової стрілки, якщо дивитись ззовні.
 * Кільця йдуть за зростанням кута, тож природний порядок (a, b, c) дивиться
 * всередину; three відсікає такі грані як задні, і на живому кадрі крізь
 * монарх було видно його дальню стінку й ауру за нею. Міняються місцями
 * друга й третя вершини — і разом із ними слоти їхніх ребер.
 */
function outward(a: V3, b: V3, c: V3, face: number, edges: readonly [boolean, boolean, boolean]): Tri {
  return { points: [a, c, b], face, edges: [edges[0], edges[2], edges[1]] };
}

export interface CrystalV2Mesh {
  /** Трикутники поспіль, по три вершини на кожен (без індексів: грань — своя). */
  positions: Float32Array;
  /** Зсув тону грані 0.85…1.15 — одна пласка грань, один тон. */
  faceTone: Float32Array;
  /**
   * Відстань до справжніх ребер для канта (навичка crystal-look): кожен кут
   * має 1 у своєму слоті; слот ребра, що лише ділить грань на трикутники,
   * має 1 в усіх кутах, тож до нуля він не доходить і канта не дає.
   */
  edge: Float32Array;
  /** Висота вершини в частках свого тіла — для градієнта від основи до вершини. */
  rise: Float32Array;
  triangles: number;
}

export interface CrystalV2Geometry {
  crystals: CrystalV2Mesh;
  rocks: { positions: Float32Array; tone: Float32Array; triangles: number };
  sparks: Float32Array;
  /** Радіус жеоди — до нього доростає зелень острова. */
  geodeRadius: number;
  /** Найдальша точка колонії від осі — під неї кадрується камера. */
  reach: number;
  height: number;
}

/**
 * Веретено, а не стовп (еталон `low_poly_dirt_crystals`, 2026-09-28).
 * Власник: «зроби кристал кристалом, а не картонним конусом». В еталоні
 * кожен кристал найширший на ПЛЕЧІ — там, де починається вістря, — а донизу
 * звужується майже вдвічі: так він виростає з точки, а не стоїть на п'ятаку.
 * Нижнє кільце — `FOOT` плеча. Обидва кільця стиснуті до осі, тож кожна
 * грань — пласка трапеція.
 *
 * Фаску на ребрах прибрано: у жодному еталоні її немає, і вузькі смужки між
 * гранями разом із кантом читались згинами паперу.
 */
const FOOT = 0.5;

function ring(sides: readonly (readonly [number, number])[]): V3[] {
  return sides.map(([angle, reach]) => {
    const a = (angle * Math.PI) / 180;
    return [Math.cos(a) * reach, 0, Math.sin(a) * reach];
  });
}

function body(
  sides: readonly (readonly [number, number])[],
  height: number,
  tierHeights: readonly number[],
  apex: readonly [number, number],
  bury: number,
): Tri[] {
  const base = ring(sides);
  const n = base.length;
  const tip = tierHeights.reduce((sum, h) => sum + h, 0);
  const y0 = -bury;
  const y1 = height - tip;
  const lift = (p: V3, y: number): V3 => [p[0], y, p[2]];
  const shoulder = base;
  const bottom = base.map((p) => lift([p[0] * FOOT, 0, p[2] * FOOT], y0));
  const top = shoulder.map((p) => lift(p, y1));
  const tris: Tri[] = [];
  let face = 0;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    tris.push(outward(bottom[i]!, bottom[j]!, top[j]!, face, QUAD_A));
    tris.push(outward(bottom[i]!, top[j]!, top[i]!, face, QUAD_B));
    face += 1;
  }
  const tiers = tierHeights.length;
  let prev = top;
  let y = y1;
  for (let t = 0; t < tiers; t += 1) {
    const s = 1 - (t + 1) / tiers;
    y += tierHeights[t]!;
    const next = shoulder.map((p): V3 => [
      p[0] * s + apex[0] * (1 - s),
      y,
      p[2] * s + apex[1] * (1 - s),
    ]);
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      if (s > 1e-9) {
        tris.push(outward(prev[i]!, prev[j]!, next[j]!, face, QUAD_A));
        tris.push(outward(prev[i]!, next[j]!, next[i]!, face, QUAD_B));
      } else {
        tris.push(outward(prev[i]!, prev[j]!, next[i]!, face, TRI));
      }
      face += 1;
    }
    prev = next;
  }
  return tris;
}

/** Нахил НАЗОВНІ від осі колонії: поворот навколо дотичної осі (Родрігес). */
function leanOutward(p: V3, leanDeg: number, azimuthDeg: number): V3 {
  const az = (azimuthDeg * Math.PI) / 180;
  const lean = (leanDeg * Math.PI) / 180;
  // Вісь = up × out = (sin az, 0, −cos az) → нормована.
  const k: V3 = [Math.sin(az), 0, -Math.cos(az)];
  const c = Math.cos(lean);
  const s = Math.sin(lean);
  const dot = k[0] * p[0] + k[1] * p[1] + k[2] * p[2];
  const cross: V3 = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
  return [
    p[0] * c + cross[0] * s + k[0] * dot * (1 - c),
    p[1] * c + cross[1] * s + k[1] * dot * (1 - c),
    p[2] * c + cross[2] * s + k[2] * dot * (1 - c),
  ];
}

export function buildCrystalV2Geometry(model: CrystalV2Model): CrystalV2Geometry {
  const seed = model.startDate;
  const m = model.monarch;
  const bodies: { key: string; tris: Tri[]; height: number }[] = [{
    key: 'monarch',
    tris: body(m.sides, m.height, m.tierHeights, m.apex, 0.12 * m.height),
    height: m.height,
  }];
  const sparks: number[] = [];
  let reach = m.radius;
  for (const child of model.children) {
    const tip = child.radius * 1.28;
    const tris = body(child.sides, child.height, [tip], [0, 0], 0.12 * child.height);
    const az = (child.azimuth * Math.PI) / 180;
    const offset: V3 = [Math.cos(az) * child.distance, 0, Math.sin(az) * child.distance];
    const place = (p: V3): V3 => {
      const q = leanOutward(p, child.lean, child.azimuth);
      return [q[0] + offset[0], q[1], q[2] + offset[2]];
    };
    bodies.push({
      key: `year${child.year}`,
      tris: tris.map((tri) => ({ ...tri, points: tri.points.map(place) as [V3, V3, V3] })),
      height: child.height,
    });
    for (let s = 0; s < child.sparks; s += 1) {
      const h = child.height * (0.25 + 0.5 * unit(seed, `child${child.year}:spark${s}`));
      sparks.push(...place([0, h, 0]));
    }
    reach = Math.max(reach, child.distance + Math.sin((child.lean * Math.PI) / 180) * child.height + child.radius);
  }

  const total = bodies.reduce((sum, b) => sum + b.tris.length, 0);
  const positions = new Float32Array(total * 9);
  const faceTone = new Float32Array(total * 3);
  const edge = new Float32Array(total * 9);
  const rise = new Float32Array(total * 3);
  let at = 0;
  for (const b of bodies) {
    for (const tri of b.tris) {
      const tone = 0.85 + 0.3 * unit(seed, `face:${b.key}:${tri.face}`);
      tri.points.forEach((p, corner) => {
        const v = at * 3 + corner;
        positions.set(p, v * 3);
        faceTone[v] = tone;
        rise[v] = Math.max(0, Math.min(1, p[1] / Math.max(1e-6, b.height)));
        for (let slot = 0; slot < 3; slot += 1) {
          edge[v * 3 + slot] = tri.edges[slot] ? (slot === corner ? 1 : 0) : 1;
        }
      });
      at += 1;
    }
  }

  // ── Жеода: купа битих каменів, не диск і не плита ──────────
  const geodeRadius = m.radius + 0.3 + Math.max(0, ...model.children.map((c) => c.distance)) * 0.4;
  const rockTris: number[] = [];
  const rockTone: number[] = [];
  const COUNT = 16;
  for (let i = 0; i < COUNT; i += 1) {
    const a = ((i + unit(seed, `rock${i}:a`)) / COUNT) * Math.PI * 2;
    const d = geodeRadius * (0.55 + 0.5 * unit(seed, `rock${i}:d`));
    const size = 0.16 + 0.14 * unit(seed, `rock${i}:s`);
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    const topP: V3 = [cx, size * 0.7, cz];
    const bottomP: V3 = [cx, -size, cz];
    const around: V3[] = [];
    for (let j = 0; j < 5; j += 1) {
      const b = a + (j / 5) * Math.PI * 2 + unit(seed, `rock${i}:${j}`);
      const rr = size * (0.8 + 0.5 * unit(seed, `rock${i}:r${j}`));
      around.push([cx + Math.cos(b) * rr, size * 0.05, cz + Math.sin(b) * rr]);
    }
    for (let j = 0; j < 5; j += 1) {
      const k = (j + 1) % 5;
      const tone = 0.7 + 0.3 * unit(seed, `rock${i}:tone${j}`);
      // Той самий закрут назовні, що й у кристалів (див. `outward`).
      rockTris.push(...around[j]!, ...topP, ...around[k]!);
      rockTris.push(...around[k]!, ...bottomP, ...around[j]!);
      rockTone.push(tone, tone, tone, tone * 0.7, tone * 0.7, tone * 0.7);
    }
  }

  return {
    crystals: { positions, faceTone, edge, rise, triangles: total },
    rocks: {
      positions: new Float32Array(rockTris),
      tone: new Float32Array(rockTone),
      triangles: rockTris.length / 9,
    },
    sparks: new Float32Array(sparks),
    geodeRadius,
    reach: Math.max(reach, geodeRadius),
    height: m.height,
  };
}
