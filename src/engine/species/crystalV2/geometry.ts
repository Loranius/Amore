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
// 2026-10-06 (власник: «кристали більш реалістично фасетованими»):
// 0.5 → 0.72. Звуження вдвічі читалось веретеном-олівцем; справжня призма
// кварцу майже паралельна й лише трохи тоншає до місця, звідки росте.
const FOOT = 0.72;

function ring(sides: readonly (readonly [number, number])[]): V3[] {
  return sides.map(([angle, reach]) => {
    const a = (angle * Math.PI) / 180;
    return [Math.cos(a) * reach, 0, Math.sin(a) * reach];
  });
}

/**
 * Верхівка кристала — НЕ концентричні яруси (ADR-0217, поправка «г»).
 *
 * Власник: «мені не подобається верхівка з геометрично рівними гранями».
 * Яруси були кільцями плеча, стиснутими до осі, — звідси однакові
 * паралельні пояси, як у заточеного олівця. Справжній кварц і
 * лоуполі-самоцвіти закінчуються інакше: вершина зміщена від осі, кінчик —
 * не точка, а коротке ребро або кілька точок на різній висоті, і грані
 * мають різний розмір.
 *
 * Тут кінчик — `ridge` точок (1…4; у монарха це правило «плани → грані
 * вершини»), розкиданих довкола зміщеної вершини на різній висоті. Кожна
 * вершина плеча дивиться на найближчу точку кінчика; де сусідні вершини
 * плеча дивляться на різні точки, між ними лягає перехідний трикутник.
 * Кожна грань — ОДИН трикутник, тож пласка за побудовою, і кожна своя.
 */
function crown(
  seed: string,
  tag: string,
  top: V3[],
  y1: number,
  tip: number,
  apex: readonly [number, number],
  ridge: number,
  radius: number,
): [V3, V3, V3][] {
  const ax = apex[0];
  const az = apex[1];
  const theta0 = unit(seed, `${tag}:ridge:turn`) * Math.PI * 2;
  const q: V3[] = [];
  for (let k = 0; k < ridge; k += 1) {
    const th = theta0 + (k * 2 * Math.PI) / ridge + (unit(seed, `${tag}:ridge${k}:a`) - 0.5) * (Math.PI / ridge) * 0.6;
    const rho = ridge === 1 ? 0 : radius * (0.3 + 0.16 * unit(seed, `${tag}:ridge${k}:r`));
    const h = k === 0 ? y1 + tip : y1 + tip * (0.62 + 0.26 * unit(seed, `${tag}:ridge${k}:h`));
    q.push([ax + Math.cos(th) * rho, h, az + Math.sin(th) * rho]);
  }
  const angleOf = (p: V3) => Math.atan2(p[2] - az, p[0] - ax);
  const owner = top.map((p) => {
    if (ridge === 1) return 0;
    let best = 0;
    let bestGap = Infinity;
    q.forEach((r, k) => {
      const d = Math.abs(Math.atan2(Math.sin(angleOf(p) - angleOf(r)), Math.cos(angleOf(p) - angleOf(r))));
      if (d < bestGap) { bestGap = d; best = k; }
    });
    return best;
  });
  const tris: [V3, V3, V3][] = [];
  const n = top.length;
  for (let i = 0; i < n; i += 1) {
    const j = (i + 1) % n;
    let k = owner[i]!;
    const b = owner[j]!;
    // Кінчик по колу: від точки вершини i до точки вершини j.
    let guard = 0;
    while (k !== b && guard < ridge) {
      const next = (k + 1) % ridge;
      tris.push([top[i]!, q[k]!, q[next]!]);
      k = next;
      guard += 1;
    }
    tris.push([top[i]!, top[j]!, q[b]!]);
  }
  for (let k = 1; k + 1 < ridge; k += 1) tris.push([q[0]!, q[k]!, q[k + 1]!]);
  // Закрут назовні: від точки всередині тіла під плечем.
  const inside: V3 = [ax * 0.5, y1 - 0.2 * tip, az * 0.5];
  return tris.map(([a, b, c]) => {
    const e1: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nrm: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const m: V3 = [(a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]];
    return nrm[0] * m[0] + nrm[1] * m[1] + nrm[2] * m[2] >= 0 ? [a, b, c] : [a, c, b];
  });
}

/**
 * Кільце профілю тіла: `at` — частка шляху від основи (0) до плеча (1),
 * `scale` — множник кільця плеча, `shift` — зсув осі в частках радіуса.
 * Кільце — те саме кільце плеча, стиснуте й зсунуте, тож ребра сусідніх
 * кілець паралельні і кожна грань між ними ПЛАСКА за побудовою.
 */
export interface ProfileRing {
  at: number;
  scale: number;
  shift: readonly [number, number];
}

/** Звичайне тіло року: основа — `FOOT` плеча, плече — саме кільце. */
const SPINDLE: readonly ProfileRing[] = [
  { at: 0, scale: FOOT, shift: [0, 0] },
  { at: 1, scale: 1, shift: [0, 0] },
];

/**
 * Монарх — монументальний кристал, що виріс, а не видавлений багатокутник
 * (власник, 2026-10-05: «природно вирослий монумент … нижня частина має
 * вагу … легка асиметрія»). Три кільця замість двох: важка основа (0.86
 * плеча, а не 0.72), ледь ширший пояс на третині висоти, де кристал
 * набирав масу, і плече, зсунуте від осі. Кожна грань стовбура ділиться на
 * дві великі пласкі грані з різним нахилом — більше читаних граней без
 * дрібних трикутників. Зсуви — з хешу дати, тож кожна пара має свій монарх.
 */
export function monarchProfile(seed: string): ProfileRing[] {
  const jitter = (key: string, span: number) => (unit(seed, `monarch:profile:${key}`) - 0.5) * span;
  return [
    { at: 0, scale: 0.86, shift: [0, 0] },
    { at: 0.32 + jitter('belly:at', 0.08), scale: 1.05, shift: [jitter('belly:x', 0.06), jitter('belly:z', 0.06)] },
    { at: 1, scale: 0.97, shift: [jitter('shoulder:x', 0.14), jitter('shoulder:z', 0.14)] },
  ];
}

function body(
  seed: string,
  tag: string,
  sides: readonly (readonly [number, number])[],
  height: number,
  tip: number,
  apex: readonly [number, number],
  ridge: number,
  bury: number,
  profile: readonly ProfileRing[] = SPINDLE,
): Tri[] {
  const base = ring(sides);
  const n = base.length;
  const y0 = -bury;
  const y1 = height - tip;
  const radius = Math.max(...base.map((p) => Math.hypot(p[0], p[2])));
  const rings = profile.map((r) => {
    const y = y0 + (y1 - y0) * r.at;
    return base.map((p): V3 => [p[0] * r.scale + r.shift[0] * radius, y, p[2] * r.scale + r.shift[1] * radius]);
  });
  const tris: Tri[] = [];
  let face = 0;
  for (let k = 0; k + 1 < rings.length; k += 1) {
    const lower = rings[k]!;
    const upper = rings[k + 1]!;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      tris.push(outward(lower[i]!, lower[j]!, upper[j]!, face, QUAD_A));
      tris.push(outward(lower[i]!, upper[j]!, upper[i]!, face, QUAD_B));
      face += 1;
    }
  }
  const top = rings[rings.length - 1]!;
  const shoulder = profile[profile.length - 1]!;
  // Кінчик іде за плечем: зсунуте плече з кінчиком на осі читалось би зламом.
  const tipAt: [number, number] = [apex[0] + shoulder.shift[0] * radius, apex[1] + shoulder.shift[1] * radius];
  for (const points of crown(seed, tag, top, y1, tip, tipAt, ridge, radius * shoulder.scale)) {
    tris.push({ points, face, edges: TRI });
    face += 1;
  }
  return tris;
}

/**
 * Монарх як великий гранчастий кристал (ADR-0244), а не призма з пірамідою.
 *
 * Власник, 2026-10-05: «оригінальний монарх Amore, змодельований
 * професійно»: багато поздовжніх граней різної ширини, нерівна вершина з
 * кількох великих граней, що перетинаються, і пласкі грані без шуму.
 *
 *   * Стовбур — 12 поздовжніх граней із 6 сторін моделі: кожну сторону
 *     ділить неглибоке ребро в нерівному місці (0.35…0.65), трохи винесене
 *     назовні. Ширина граней різна, силует — кристал, а не шестигранник.
 *     Кільця профілю — масштабовані копії того самого 12-кутника, тож кожна
 *     грань пласка за побудовою.
 *   * Вершина — два яруси. Перший: пояс із 18 граней від плеча до кільця з
 *     6 точок над ребрами сторін (зсунутого на пів кроку — грані ярусів
 *     перетинаються, а не стоять одна над одною). Другий: кінчик із тих
 *     самих `ridge` точок, що й раніше (плани → грані вершини, ADR-0217).
 *     Вістря — рівно над центром плеча: зсув вершини моделі (`apex`) для
 *     монарха не береться, бо косив верхівку вбік (власник, 2026-10-05).
 *   * Кант лише на поздовжніх ребрах, ребрі плеча й вершині: горизонтальний
 *     злам поясу без канта, бо смуги поперек призми власник відкинув.
 */
function monarchBody(
  seed: string,
  sides: readonly (readonly [number, number])[],
  height: number,
  tip: number,
  ridge: number,
  bury: number,
  profile: readonly ProfileRing[],
): Tri[] {
  const corners = ring(sides);
  const n = corners.length;
  const ring12: V3[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = corners[i]!;
    const b = corners[(i + 1) % n]!;
    const t = 0.35 + 0.3 * unit(seed, `monarch:split${i}:t`);
    const bulge = 1.06 + 0.08 * unit(seed, `monarch:split${i}:b`);
    ring12.push(a, [(a[0] + (b[0] - a[0]) * t) * bulge, 0, (a[2] + (b[2] - a[2]) * t) * bulge]);
  }
  const m = ring12.length;
  const y0 = -bury;
  const y1 = height - tip;
  const radius = Math.max(...corners.map((p) => Math.hypot(p[0], p[2])));
  const rings = profile.map((r) => {
    const y = y0 + (y1 - y0) * r.at;
    return ring12.map((p): V3 => [p[0] * r.scale + r.shift[0] * radius, y, p[2] * r.scale + r.shift[1] * radius]);
  });
  const tris: Tri[] = [];
  let face = 0;
  for (let k = 0; k + 1 < rings.length; k += 1) {
    const lower = rings[k]!;
    const upper = rings[k + 1]!;
    const topIsShoulder = k + 2 === rings.length;
    for (let i = 0; i < m; i += 1) {
      const j = (i + 1) % m;
      // [поздовжнє ребро j, діагональ, низ] і [верх, поздовжнє ребро i, діагональ].
      tris.push(outward(lower[i]!, lower[j]!, upper[j]!, face, [true, false, false]));
      tris.push(outward(lower[i]!, upper[j]!, upper[i]!, face, [topIsShoulder, true, false]));
      face += 1;
    }
  }
  const shoulder = rings[rings.length - 1]!;
  const last = profile[profile.length - 1]!;
  const sx = last.shift[0] * radius;
  const sz = last.shift[1] * radius;
  // ── Ярус 1: пояс граней від плеча до кільця над ребрами сторін ──
  // Пояс майже рівний (±5 %): різні висоти точок нахиляли всю вершину вбік
  // (власник, 2026-10-05: «верхівку косить — хай дивиться чітко вгору»).
  const midHeight = tip * 0.42;
  const mid: V3[] = [];
  for (let i = 0; i < n; i += 1) {
    const s = shoulder[2 * i + 1]!;
    const a = Math.atan2(s[2] - sz, s[0] - sx);
    const r = radius * last.scale * 0.5 * (0.95 + 0.1 * unit(seed, `monarch:mid${i}:r`));
    const y = y1 + midHeight * (0.95 + 0.1 * unit(seed, `monarch:mid${i}:y`));
    mid.push([sx + Math.cos(a) * r, y, sz + Math.sin(a) * r]);
  }
  const inside: V3 = [sx, y1 - tip * 0.2, sz];
  const facing = (a: V3, b: V3, c: V3): [V3, V3, V3] => {
    const e1: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nrm: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const d: V3 = [(a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]];
    return nrm[0] * d[0] + nrm[1] * d[1] + nrm[2] * d[2] >= 0 ? [a, b, c] : [a, c, b];
  };
  for (let i = 0; i < n; i += 1) {
    const c0 = shoulder[2 * i]!;
    const s = shoulder[2 * i + 1]!;
    const c1 = shoulder[(2 * i + 2) % m]!;
    const m0 = mid[i]!;
    const m1 = mid[(i + 1) % n]!;
    for (const points of [facing(c0, s, m0), facing(s, c1, m0), facing(c1, m1, m0)]) {
      tris.push({ points, face, edges: TRI });
      face += 1;
    }
  }
  // ── Ярус 2: вістря точно над центром плеча ──────────────────
  // Плани дають грані вершини (ADR-0217) — тепер це рівне кільце з `ridge`
  // точок навколо осі на одній висоті, а над ним одне вістря на осі. Раніше
  // точки кінчика стояли на різній висоті й зсунуті від осі, і вістря
  // косило вбік. Кількість граней та сама, напрям — вертикальний.
  const apexPoint: V3 = [sx, height, sz];
  const midTop = mid.reduce((sum, p) => sum + p[1], 0) / n;
  const tipFaces = (ring: V3[]) => {
    for (let i = 0; i < ring.length; i += 1) {
      tris.push({ points: facing(ring[i]!, ring[(i + 1) % ring.length]!, apexPoint), face, edges: TRI });
      face += 1;
    }
  };
  if (ridge < 2) {
    tipFaces(mid);
  } else {
    const qy = midTop + (height - midTop) * 0.45;
    const qr = radius * last.scale * 0.5 * 0.45;
    const turn = unit(seed, 'monarch:ridge:turn') * Math.PI * 2;
    const q: V3[] = Array.from({ length: ridge }, (_, k) => {
      const a = turn + (k / ridge) * Math.PI * 2;
      return [sx + Math.cos(a) * qr, qy, sz + Math.sin(a) * qr];
    });
    // Кожна точка поясу сходиться до найближчої точки кільця; де сусіди
    // дивляться на різні точки — перехідний трикутник (як у `crown`).
    const angle = (p: V3) => Math.atan2(p[2] - sz, p[0] - sx);
    const owner = mid.map((p) => {
      let best = 0;
      let gap = Infinity;
      q.forEach((r, k) => {
        const d = Math.abs(Math.atan2(Math.sin(angle(p) - angle(r)), Math.cos(angle(p) - angle(r))));
        if (d < gap) { gap = d; best = k; }
      });
      return best;
    });
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      let k = owner[i]!;
      let guard = 0;
      while (k !== owner[j]! && guard < ridge) {
        const next = (k + 1) % ridge;
        tris.push({ points: facing(mid[i]!, q[k]!, q[next]!), face, edges: TRI });
        face += 1;
        k = next;
        guard += 1;
      }
      tris.push({ points: facing(mid[i]!, mid[j]!, q[owner[j]!]!), face, edges: TRI });
      face += 1;
    }
    tipFaces(q);
  }
  return tris;
}

/**
 * Тон грані — з трьох (навичка `amore-crystal-look`, ADR-0176): на
 * 3-циклі сусідні грані й грані через одну завжди різні, тож жодна пара,
 * яку бачить око, не зливається в одну площину. Легкий розкид у межах
 * тону лишає кожну грань своєю.
 */
const FACE_TONES = [0.74, 1.0, 1.3] as const;

/**
 * Форма кристала (ADR-0237 §4.3): ТОЙ САМИЙ ріст — монарх, кристал на рік,
 * колір, нахил — інший малюнок. `druse` — теперішня друза кварцу,
 * `stalagmite` — натічний сталагміт.
 */
export type CrystalForm = 'druse' | 'stalagmite';
export const CRYSTAL_FORMS: readonly CrystalForm[] = ['druse', 'stalagmite'];

const STALAGMITE_SIDES = 9;

/**
 * Сталагміт: округлий конус, найширший біля основи, з натічними кільцями.
 * Кант — лише на горизонтальних ребрах кілець, не на вертикальних: так
 * читаються шари натеку, а не грані кварцу. Кожна грань — пласка трапеція
 * між двома кільцями, кінчик — заокруглений маленьким кільцем і точкою.
 */
function stalagmite(seed: string, tag: string, radius: number, height: number, rings: number, bury: number): Tri[] {
  const n = STALAGMITE_SIDES;
  const turn = unit(seed, `${tag}:turn`) * 360;
  const angles = Array.from({ length: n }, (_, i) => ((i + 0.3 * (unit(seed, `${tag}:a${i}`) - 0.5)) / n) * 360 + turn);
  const tipShift: [number, number] = [(unit(seed, `${tag}:tx`) - 0.5) * 0.3 * radius, (unit(seed, `${tag}:tz`) - 0.5) * 0.3 * radius];
  const level = (k: number): V3[] => {
    // t 0 → основа, 1 → під кінчиком; натічні кільця — легкі потовщення.
    const t = k / rings;
    const y = -bury + (height * 0.94 + bury) * t;
    const bulge = k > 0 && k < rings ? 1 + 0.07 * (unit(seed, `${tag}:ring${k}`) - 0.2) : 1;
    const r = radius * 1.25 * Math.pow(1 - 0.86 * t, 0.8) * bulge;
    return angles.map((deg) => {
      const a = (deg * Math.PI) / 180;
      return [Math.cos(a) * r + tipShift[0] * t * t, y, Math.sin(a) * r + tipShift[1] * t * t];
    });
  };
  const levels = Array.from({ length: rings + 1 }, (_, k) => level(k));
  const tris: Tri[] = [];
  let face = 0;
  for (let k = 0; k < rings; k += 1) {
    const lo = levels[k]!;
    const hi = levels[k + 1]!;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      tris.push(outward(lo[i]!, lo[j]!, hi[j]!, face, [false, false, true]));
      tris.push(outward(lo[i]!, hi[j]!, hi[i]!, face, [true, false, false]));
      face += 1;
    }
  }
  const last = levels[rings]!;
  const apex: V3 = [tipShift[0], height, tipShift[1]];
  for (let i = 0; i < n; i += 1) {
    tris.push(outward(last[i]!, last[(i + 1) % n]!, apex, face, [false, false, true]));
    face += 1;
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

export function buildCrystalV2Geometry(model: CrystalV2Model, form: CrystalForm = 'druse'): CrystalV2Geometry {
  const seed = model.startDate;
  const m = model.monarch;
  const bodies: { key: string; tris: Tri[]; height: number }[] = [{
    key: 'monarch',
    // Вершина зміщена вчетверо далі, ніж у моделі: ±0.08 радіуса на екрані
    // не читались зовсім, кінчик стояв по центру. Точок кінчика — стільки,
    // скільки ярусів дали плани (ADR-0217).
    // Плани — у друзи точки кінчика, у сталагміта кільця натеку (ADR-0237).
    tris: form === 'stalagmite'
      ? stalagmite(seed, 'monarch', m.radius, m.height, 3 + m.tiers, 0.12 * m.height)
      : monarchBody(seed, m.sides, m.height, m.tierHeights.reduce((sum, h) => sum + h, 0),
        m.tiers, 0.12 * m.height, monarchProfile(seed)),
    height: m.height,
  }];
  const sparks: number[] = [];
  let reach = m.radius;
  for (const child of model.children) {
    const tip = child.radius * 1.28;
    // Кінчик кристала року — теж не рівна піраміда: зміщена вершина й одна
    // або дві точки, з хешу року.
    const key = `year${child.year}`;
    const apexShift: [number, number] = [
      (unit(seed, `${key}:apex:x`) - 0.5) * 0.5 * child.radius,
      (unit(seed, `${key}:apex:z`) - 0.5) * 0.5 * child.radius,
    ];
    const tris = form === 'stalagmite'
      ? stalagmite(seed, key, child.radius * 1.6, child.height * 0.8, 3, 0.12 * child.height)
      : body(seed, key, child.sides, child.height, tip, apexShift,
        1 + Math.floor(unit(seed, `${key}:ridge`) * 2), 0.12 * child.height);
    const az = (child.azimuth * Math.PI) / 180;
    const offset: V3 = [Math.cos(az) * child.distance, 0, Math.sin(az) * child.distance];
    // Сталагміт росте прямо вгору — краплі падають згори; нахил місць лишається
    // натяком (третина), а не віялом, як у друзи.
    const lean = form === 'stalagmite' ? child.lean * 0.3 : child.lean;
    const place = (p: V3): V3 => {
      const q = leanOutward(p, lean, child.azimuth);
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
    reach = Math.max(reach, child.distance + Math.sin((lean * Math.PI) / 180) * child.height + child.radius * (form === 'stalagmite' ? 2 : 1));
  }

  const total = bodies.reduce((sum, b) => sum + b.tris.length, 0);
  const positions = new Float32Array(total * 9);
  const faceTone = new Float32Array(total * 3);
  const edge = new Float32Array(total * 9);
  const rise = new Float32Array(total * 3);
  let at = 0;
  for (const b of bodies) {
    for (const tri of b.tris) {
      const tone = FACE_TONES[tri.face % 3]! * (0.95 + 0.1 * unit(seed, `face:${b.key}:${tri.face}`));
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
    const size = 0.14 + 0.12 * unit(seed, `rock${i}:s`);
    const cx = Math.cos(a) * d;
    const cz = Math.sin(a) * d;
    // Гранчасті брили, а не пласкі скалки: у діорамі (ADR-0220) низькі
    // темні уламки читались конфеті. Вершина брили зсунута з центру.
    const topP: V3 = [
      cx + (unit(seed, `rock${i}:tx`) - 0.5) * size * 0.6,
      size * 1.0,
      cz + (unit(seed, `rock${i}:tz`) - 0.5) * size * 0.6,
    ];
    const bottomP: V3 = [cx, -size, cz];
    const around: V3[] = [];
    for (let j = 0; j < 5; j += 1) {
      const b = a + (j / 5) * Math.PI * 2 + unit(seed, `rock${i}:${j}`);
      const rr = size * (0.8 + 0.5 * unit(seed, `rock${i}:r${j}`));
      around.push([cx + Math.cos(b) * rr, size * (0.25 + 0.2 * unit(seed, `rock${i}:y${j}`)), cz + Math.sin(b) * rr]);
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
