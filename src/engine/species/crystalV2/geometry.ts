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
  /**
   * Тонова група (ADR-0245): два трикутники чотирикутника стовбура мають
   * один тон і діагональ без канта — одна грань із ледь помітним зламом
   * (до ±2 % від прямої). Кожен трикутник лишається пласким. Без поля —
   * тон за `face`.
   */
  shade?: number;
}


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
 * Вершина кристала — перетин площин, як у справжнього кварцу (ADR-0260).
 *
 * Власник, 2026-11-10, за концептом: «природна форма вершини — замість
 * простої симетричної піраміди складніша кристалічна термінація з кількома
 * площинами та неоднаковими кутами; різні за розміром трикутні й
 * багатокутні поверхні». Справжній кварц закінчується не віялом трикутників,
 * а гранями-площинами, кожна з яких тягнеться, доки її не зріже сусідня:
 *
 *   * над кожною стороною — своя площина через вістря; нахил чергується
 *     (крутіша / пологіша), тож великі грані сходять у призму клинами, а малі
 *     лишаються вузькими вгорі — як великі й малі ромбоедри кварцу;
 *   * напрям кожної площини повернутий від нормалі сторони на кілька
 *     градусів, тож шов вершини з призмою похилий, а не рівна лінія;
 *   * на кількох кутах — додаткова маленька фаска: нижче за головні площини
 *     біля кута й крутіша, тож зрізає лише кут (у монарха їх дають плани —
 *     ADR-0217: плани → грані вершини);
 *   * вершина даху — мінімум усіх площин: грань кожної площини — опуклий
 *     багатокутник, де вона нижча за решту. Кожна грань пласка за побудовою;
 *     стінки призми над верхнім кільцем стовбура дотягуються до даху.
 */
interface RoofPlane {
  /** y = a + b·x + c·z */
  a: number;
  b: number;
  c: number;
}

type XZ = [number, number];

const planeY = (p: RoofPlane, x: number, z: number) => p.a + p.b * x + p.c * z;

/** Частина многокутника, де f(x, z) ≤ 0 (f лінійна) — Сазерленд — Ходжмен. */
function clipHalf(poly: readonly XZ[], f: (x: number, z: number) => number): XZ[] {
  const out: XZ[] = [];
  for (let i = 0; i < poly.length; i += 1) {
    const cur = poly[i]!;
    const prev = poly[(i + poly.length - 1) % poly.length]!;
    const fc = f(cur[0], cur[1]);
    const fp = f(prev[0], prev[1]);
    const cross = (): XZ => {
      const t = fp / (fp - fc);
      return [prev[0] + (cur[0] - prev[0]) * t, prev[1] + (cur[1] - prev[1]) * t];
    };
    if (fc <= 0) {
      if (fp > 0) out.push(cross());
      out.push(cur);
    } else if (fp <= 0) {
      out.push(cross());
    }
  }
  return out.filter((p, i) => {
    const q = out[(i + out.length - 1) % out.length]!;
    return out.length < 2 || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1e-9;
  });
}

interface Termination {
  /** Висота даху над кожною вершиною верхнього кільця стовбура. */
  roofAt: (x: number, z: number) => number;
  /** Грані вершини: кожна — опуклий многокутник на своїй площині. */
  faces: V3[][];
}

/**
 * Площини вершини й многокутники її граней над кільцем `ring` (лише x, z).
 * `sides` — номери вершин кільця, з яких починається кожна сторона моделі.
 */
function termination(
  seed: string,
  tag: string,
  ring: readonly V3[],
  sides: readonly number[],
  apex: XZ,
  height: number,
  crownHeight: number,
  contrast: number,
  facets: number,
): Termination {
  const n = sides.length;
  const planes: RoofPlane[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const p = ring[sides[i]!]!;
    const q = ring[sides[(i + 1) % n]!]!;
    // Нормаль сторони назовні, повернута на ±11°: шов похилий.
    let nx = q[2] - p[2];
    let nz = -(q[0] - p[0]);
    const len = Math.hypot(nx, nz);
    nx /= len;
    nz /= len;
    const mx = (p[0] + q[0]) / 2 - apex[0];
    const mz = (p[2] + q[2]) / 2 - apex[1];
    if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
    const turn = ((unit(seed, `${tag}:roof${i}:turn`) - 0.5) * 22 * Math.PI) / 180;
    const dx = nx * Math.cos(turn) - nz * Math.sin(turn);
    const dz = nx * Math.sin(turn) + nz * Math.cos(turn);
    const reach = Math.max(1e-6, mx * dx + mz * dz);
    // Чергування крутіша / пологіша: великі й малі грані поруч.
    const sign = i % 2 === 0 ? 1 : -1;
    const factor = 1 + sign * contrast + 0.16 * (unit(seed, `${tag}:roof${i}:tilt`) - 0.5);
    const t = (crownHeight / reach) * factor;
    slopes.push(t);
    planes.push({ a: height + t * (apex[0] * dx + apex[1] * dz), b: -t * dx, c: -t * dz });
  }
  const mainRoof = (x: number, z: number) => Math.min(...planes.map((p) => planeY(p, x, z)));
  const mean = slopes.reduce((s, v) => s + v, 0) / n;
  // Фаски на кутах: найвищі за рангом хешу, `facets` штук.
  const corners = sides
    .map((v, i) => ({ v, i, rank: unit(seed, `${tag}:facet${i}:rank`) }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, Math.max(0, Math.min(n, facets)));
  for (const { v, i } of corners) {
    const c = ring[v]!;
    let dx = c[0] - apex[0];
    let dz = c[2] - apex[1];
    const len = Math.hypot(dx, dz);
    dx /= len;
    dz /= len;
    const drop = crownHeight * (0.07 + 0.1 * unit(seed, `${tag}:facet${i}:drop`));
    const y = mainRoof(c[0], c[2]) - drop;
    // Крутіша за головні: зрізає кут і закінчується, не дійшовши до вістря.
    let g = mean * (1.25 + 0.3 * unit(seed, `${tag}:facet${i}:slope`));
    g = Math.max(g, ((height - y) / len) * 1.15);
    planes.push({ a: y + g * (c[0] * dx + c[2] * dz), b: -g * dx, c: -g * dz });
  }
  const roofAt = (x: number, z: number) => Math.min(...planes.map((p) => planeY(p, x, z)));
  const base: XZ[] = ring.map((p) => [p[0], p[2]]);
  const faces: V3[][] = [];
  planes.forEach((own, k) => {
    let poly = base;
    planes.forEach((other, j) => {
      if (j === k || poly.length < 3) return;
      poly = clipHalf(poly, (x, z) => planeY(own, x, z) - planeY(other, x, z));
    });
    if (poly.length < 3) return;
    let area = 0;
    for (let i = 0; i < poly.length; i += 1) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      area += a[0] * b[1] - b[0] * a[1];
    }
    if (Math.abs(area) < 1e-7 * crownHeight * crownHeight) return;
    faces.push(poly.map(([x, z]): V3 => [x, roofAt(x, z), z]));
  });
  return { roofAt, faces };
}

/** Тонова група граней вершини — окремо від груп стовбура. */
const ROOF_SHADE = 100000;

/**
 * Дах над стовбуром: грані вершини віялом (кожна — одна площина, одна
 * тонова група) і стінки призми над верхнім кільцем — до лінії даху, у
 * тоновій групі верхньої грані стовбура під ними.
 */
function roofTris(
  shaft: { tris: Tri[]; rings: V3[][] },
  roof: Termination,
  inside: V3,
  firstFace: number,
  shadeBase: number,
): Tri[] {
  const top = shaft.rings[shaft.rings.length - 1]!;
  const n = top.length;
  const tiers = shaft.rings.length - 1;
  const facing = (a: V3, b: V3, c: V3): [V3, V3, V3] => {
    const e1: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const e2: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const nrm: V3 = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const d: V3 = [(a[0] + b[0] + c[0]) / 3 - inside[0], (a[1] + b[1] + c[1]) / 3 - inside[1], (a[2] + b[2] + c[2]) / 3 - inside[2]];
    return nrm[0] * d[0] + nrm[1] * d[1] + nrm[2] * d[2] >= 0 ? [a, b, c] : [a, c, b];
  };
  const out: Tri[] = [];
  let face = firstFace;
  roof.faces.forEach((poly, k) => {
    for (let i = 1; i + 1 < poly.length; i += 1) {
      out.push({ points: facing(poly[0]!, poly[i]!, poly[i + 1]!), face, edges: TRI, shade: shadeBase + k });
      face += 1;
    }
  });
  // Стінки: точки зламу даху на кожному ребрі кільця.
  const corners = roof.faces.flat();
  for (let i = 0; i < n; i += 1) {
    const a = top[i]!;
    const b = top[(i + 1) % n]!;
    const ex = b[0] - a[0];
    const ez = b[2] - a[2];
    const len2 = ex * ex + ez * ez;
    const on = corners
      .map((p) => ({ p, t: ((p[0] - a[0]) * ex + (p[2] - a[2]) * ez) / len2, off: Math.abs((p[0] - a[0]) * ez - (p[2] - a[2]) * ex) / Math.sqrt(len2) }))
      .filter((h) => h.off < 1e-7 && h.t > 1e-6 && h.t < 1 - 1e-6)
      .sort((x, y) => x.t - y.t);
    const line: V3[] = [];
    for (const h of on) if (!line.some((q) => Math.hypot(q[0] - h.p[0], q[2] - h.p[2]) < 1e-7)) line.push(h.p);
    line.push(b);
    // Чотирикутники стовбура завжди мають тонову групу (`brokenShaft`).
    const shade = shaft.tris[((tiers - 1) * n + i) * 2]!.shade!;
    for (let k = 0; k + 1 < line.length; k += 1) {
      out.push({ points: facing(a, line[k]!, line[k + 1]!), face, edges: TRI, shade });
      face += 1;
    }
  }
  return out;
}

/**
 * Кільце профілю тіла: `at` — частка шляху від основи (0) до плеча (1),
 * `scale` — множник кільця плеча, `shift` — зсув осі в частках радіуса.
 * Кільце — те саме кільце плеча, стиснуте й зсунуте, тож ребра сусідніх
 * кілець паралельні і кожна грань між ними ПЛАСКА за побудовою.
 */
interface ProfileRing {
  at: number;
  scale: number;
  shift: readonly [number, number];
}

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
  // Бік — ПРЯМА від основи до плеча (власник, 2026-10-06: «кристал не має
  // скручувати дугою»): проміжні кільця лежать на прямій, пояса-бочки
  // немає. Асиметрія — у зсуві плеча й нахилі осі, не у вигині.
  const foot = { at: 0, scale: 0.86, shift: [0, 0] as [number, number] };
  const shoulder = { at: 1, scale: 0.97, shift: [jitter('shoulder:x', 0.14), jitter('shoulder:z', 0.14)] as [number, number] };
  const on = (at: number): ProfileRing => ({
    at,
    scale: foot.scale + (shoulder.scale - foot.scale) * at,
    shift: [shoulder.shift[0] * at, shoulder.shift[1] * at],
  });
  return [foot, on(0.32 + jitter('belly:at', 0.08)), on(0.68 + jitter('upper:at', 0.06)), shoulder];
}

/**
 * Стовбур, що ламається на площини (ADR-0245).
 *
 * Власник, 2026-10-05: «бічні грані йдуть ідеально рівними знизу догори».
 * Еталон `low_poly_dirt_crystals` (виміряно): у кристала з 32–48
 * трикутників 26–39 різних площин, а вершини стоять на 9–17 висотах — грань
 * ламається на кілька площин, а не тягнеться смугою від основи до плеча.
 *
 * Тому кожна вершина кільця профілю має свій відступ від осі (±10 %), а
 * вершини внутрішніх кілець — ще й свою висоту (±30 % проміжку). Кожен
 * трикутник — окрема пласка грань зі своїм тоном і кантом по всіх трьох
 * ребрах; діагональ чотирикутника лягає то в один, то в інший бік. Основа
 * (заглиблена в жеоду) лишається рівною: її не видно, а рівна вона не
 * вилазить із породи.
 */
function brokenShaft(
  seed: string,
  tag: string,
  base: readonly V3[],
  profile: readonly ProfileRing[],
  y0: number,
  y1: number,
  radius: number,
  firstFace: number,
  topDrop: readonly number[] = [],
): { tris: Tri[]; rings: V3[][]; face: number } {
  const n = base.length;
  const last = profile.length - 1;
  const foot = profile[0]!;
  const top = profile[last]!;
  const span = y1 - y0;
  // Основа рівна (вона в жеоді); плече — кожна вершина на ±6 % проміжку й ±3 %
  // від осі: ребра стовбура різної довжини й нахилу, але кожне — пряме.
  const lastGap = span * (top.at - profile[last - 1]!.at);
  const footRing = base.map((p): V3 => [p[0] * foot.scale + foot.shift[0] * radius, y0, p[2] * foot.scale + foot.shift[1] * radius]);
  const topRing = base.map((p, i): V3 => {
    const key = `${tag}:ring${last}:${i}`;
    const out = 1 + 0.06 * (unit(seed, `${key}:r`) - 0.5);
    const lift = (unit(seed, `${key}:y`) - 0.5) * lastGap * 0.12;
    return [p[0] * top.scale * out + top.shift[0] * radius, y1 + lift - (topDrop[i] ?? 0), p[2] * top.scale * out + top.shift[1] * radius];
  });
  /*
   * Проміжні вершини лежать НА ПРЯМОМУ ребрі від основи до плеча, кожна на
   * своїй висоті (±35 % проміжку), і лише на ±2 % відступають від осі.
   * Тому силует прямий — жодної дуги чи бочки (власник, 2026-10-06), — а
   * межі граней по довжині стоять на різній висоті: грані різної довжини.
   */
  const rings: V3[][] = [footRing];
  for (let k = 1; k < last; k += 1) {
    const r = profile[k]!;
    const room = Math.min(r.at - profile[k - 1]!.at, profile[k + 1]!.at - r.at);
    rings.push(base.map((_, i): V3 => {
      const key = `${tag}:ring${k}:${i}`;
      const t = r.at + (unit(seed, `${key}:y`) - 0.5) * room * 0.7;
      const f = footRing[i]!;
      const u = topRing[i]!;
      const p: V3 = [f[0] + (u[0] - f[0]) * t, f[1] + (u[1] - f[1]) * t, f[2] + (u[2] - f[2]) * t];
      const ax = (foot.shift[0] + (top.shift[0] - foot.shift[0]) * t) * radius;
      const az = (foot.shift[1] + (top.shift[1] - foot.shift[1]) * t) * radius;
      const out = 1 + 0.04 * (unit(seed, `${key}:r`) - 0.5);
      return [ax + (p[0] - ax) * out, p[1], az + (p[2] - az) * out];
    }));
  }
  rings.push(topRing);
  /*
   * Грань — чотирикутник між двома кільцями: два трикутники з одним тоном,
   * діагональ без канта. Межа між ярусами — кант і інший тон. Тон іде
   * 3-циклом по кільцю й зсувається на ярус, тож сусіди і збоку, і згори
   * різні (крок яруса не кратний трьом).
   */
  const lift = n + (n % 3 === 2 ? 2 : 1);
  const tris: Tri[] = [];
  let face = firstFace;
  for (let k = 0; k < last; k += 1) {
    const lower = rings[k]!;
    const upper = rings[k + 1]!;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const [li, lj, ui, uj] = [lower[i]!, lower[j]!, upper[i]!, upper[j]!];
      const shade = firstFace + k * lift + i;
      // Діагональ — то в один, то в інший бік; ребра: [навпроти кута 0, 1, 2].
      if (unit(seed, `${tag}:diag${k}:${i}`) < 0.5) {
        tris.push({ ...outward(li, lj, uj, face, [true, false, true]), shade });
        tris.push({ ...outward(li, uj, ui, face + 1, [true, true, false]), shade });
      } else {
        tris.push({ ...outward(li, lj, ui, face, [false, true, true]), shade });
        tris.push({ ...outward(lj, uj, ui, face + 1, [true, false, true]), shade });
      }
      face += 2;
    }
  }
  return { tris, rings, face: Math.max(face, firstFace + last * lift) };
}

/** Кристал року: основа, ледь ширший пояс посередині й плече. */
const CHILD_PROFILE: readonly ProfileRing[] = [
  { at: 0, scale: FOOT, shift: [0, 0] },
  { at: 0.5, scale: (FOOT + 1) / 2, shift: [0, 0] },
  { at: 1, scale: 1, shift: [0, 0] },
];

/**
 * Габітус кристала року (ADR-0259, ADR-0260): той самий ріст, інший малюнок
 * вершини. Власник, 2026-11-10: «різноманіття форм — різні нахили граней».
 * З хешу року:
 *   * `tip` — гострота вістря: 0.8 (тупе) … 1.55 (гостре) від кварцових 52°;
 *   * `contrast` — наскільки великі грані вершини більші за малі: як
 *     глибоко вони сходять у призму клинами.
 */
export function yearHabit(seed: string, tag: string): { tip: number; contrast: number } {
  return {
    tip: 0.8 + 0.75 * unit(seed, `${tag}:habit:tip`),
    contrast: 0.12 + 0.2 * unit(seed, `${tag}:habit:contrast`),
  };
}

/**
 * Кристал року з вершиною з площин (ADR-0260, `termination`): над кожною
 * стороною своя площина через зміщене вістря, 1–2 фаски на кутах.
 */
function body(
  seed: string,
  tag: string,
  sides: readonly (readonly [number, number])[],
  height: number,
  tip: number,
  apex: readonly [number, number],
  ridge: number,
  bury: number,
  profile: readonly ProfileRing[] = CHILD_PROFILE,
): Tri[] {
  const base = ring(sides);
  const habit = yearHabit(seed, tag);
  // Висота кристала та сама (модель): габітус лише перерозподіляє її між
  // призмою й вершиною, і вершина не забирає більше 45 % тіла.
  const tipHeight = Math.min(tip * habit.tip, height * 0.45);
  const y0 = -bury;
  const y1 = height - tipHeight;
  const radius = Math.max(...base.map((p) => Math.hypot(p[0], p[2])));
  const shoulder = profile[profile.length - 1]!;
  // Кінчик іде за плечем: зсунуте плече з кінчиком на осі читалось би зламом.
  const tipAt: XZ = [apex[0] + shoulder.shift[0] * radius, apex[1] + shoulder.shift[1] * radius];
  const flat = brokenShaft(seed, tag, base, profile, y0, y1, radius, 0);
  const top0 = flat.rings[flat.rings.length - 1]!;
  const roof = termination(seed, tag, top0, base.map((_, i) => i), tipAt, height, tipHeight, habit.contrast, ridge);
  const shaft = brokenShaft(seed, tag, base, profile, y0, y1, radius, 0, top0.map((p) => p[1] - roof.roofAt(p[0], p[2])));
  return [...shaft.tris, ...roofTris(shaft, roof, [tipAt[0], y1 - 0.2 * tipHeight, tipAt[1]], shaft.face, ROOF_SHADE)];
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
 *   * Вершина — корона самоцвіта (ADR-0247, замість двох ярусів ADR-0244):
 *     верхня п'ята частина кристала, шов клинами, широкі плечі, зірка граней
 *     на півкроку й рівне кільце з точок планів (ADR-0217) під вістрям.
 *     Вістря — рівно над центром плеча: зсув вершини моделі (`apex`) для
 *     монарха не береться, бо косив верхівку вбік (власник, 2026-10-05).
 *   * Кант лише на поздовжніх ребрах, ребрі плеча й вершині: горизонтальний
 *     злам поясу без канта, бо смуги поперек призми власник відкинув.
 */
/**
 * На яких сторонах монарха стоїть додаткове поздовжнє ребро.
 *
 * ADR-0245 ставив його на половину сторін, «щонайменше дві й не всі», бо
 * 12 однаково винесених ребер робили монарх майже циліндром (власник,
 * 2026-10-06). ADR-0258 ставить ребро на КОЖНУ сторону: з боку сторони без
 * ребра спереду було видно лише 2–3 грані, і середня займала до 66 % ширини
 * стовбура — монарх читався стовпом. Циліндром він не стає, бо циліндр давала
 * рівність, а не кількість: ребро стоїть у нерівному місці сторони
 * (`SPLIT_T`), і злам на ньому свій (`SPLIT_FOLD`), тож поруч завжди стоять
 * широка й вузька грані, а кути призми лишаються найгострішими ребрами.
 */
export function monarchSplits(_seed: string, sides: readonly (readonly [number, number])[]): boolean[] {
  return sides.map(() => true);
}

/**
 * Висота корони монарха (ADR-0247): верхня п'ята частина кристала, але не
 * менше за кінчик моделі × 1.2 (пологі плечі потребують висоти) і не більше
 * за 30 % (молодий кристал не стає самою короною). Висота всього кристала
 * та сама — корона забирає верх стовбура, а не додається зверху.
 */
export function monarchCrownHeight(height: number, tip: number): number {
  return Math.min(0.3 * height, Math.max(0.2 * height, tip * 1.2));
}

/**
 * Де лежить додаткове ребро сторони (ADR-0258): у місці `t` сторони,
 * винесене назовні рівно настільки, щоб дві половини сторони зламались на
 * `foldDeg` градусів. Колись ребро виносили на 2…5 % радіуса — злам у 4…8°,
 * який око не бачить гранню, і правило зламів (`FOLD_DEG`) чесно зливало
 * обидві половини в одну широку площину. Тепер злам задано кутом, а не
 * відсотком, тож кожна половина — справжня грань.
 */
function splitPoint(a: V3, b: V3, t: number, foldDeg: number): V3 {
  const dx = b[0] - a[0];
  const dz = b[2] - a[2];
  const length = Math.hypot(dx, dz);
  // Нормаль сторони назовні: перпендикуляр, що дивиться від осі.
  let nx = dz / length;
  let nz = -dx / length;
  const mx = a[0] + dx * 0.5;
  const mz = a[2] + dz * 0.5;
  if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }
  const target = (foldDeg * Math.PI) / 180;
  const fold = (h: number) => Math.atan(h / (t * length)) + Math.atan(h / ((1 - t) * length));
  let lo = 0;
  let hi = length;
  for (let k = 0; k < 40; k += 1) {
    const mid = (lo + hi) / 2;
    if (fold(mid) < target) lo = mid; else hi = mid;
  }
  const h = (lo + hi) / 2;
  return [a[0] + dx * t + nx * h, 0, a[2] + dz * t + nz * h];
}

/** Місце додаткового ребра на стороні: нерівні половини (ADR-0258). */
const SPLIT_T: readonly [number, number] = [0.35, 0.65];
/** Злам на додатковому ребрі, градуси: завжди вище за `FOLD_DEG`. */
const SPLIT_FOLD: readonly [number, number] = [20, 28];

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
  // Додаткове ребро — на кожній стороні, але в нерівному місці й зі своїм
  // зламом (ADR-0258, `monarchSplits`): поруч стоять широкі й вузькі грані.
  const splits = monarchSplits(seed, sides);
  const ring12: V3[] = [];
  const cornerAt: number[] = [];
  const splitAt: number[] = [];
  for (let i = 0; i < n; i += 1) {
    const a = corners[i]!;
    const b = corners[(i + 1) % n]!;
    cornerAt.push(ring12.length);
    ring12.push(a);
    if (splits[i]) {
      const t = SPLIT_T[0] + (SPLIT_T[1] - SPLIT_T[0]) * unit(seed, `monarch:split${i}:t`);
      const fold = SPLIT_FOLD[0] + (SPLIT_FOLD[1] - SPLIT_FOLD[0]) * unit(seed, `monarch:split${i}:b`);
      splitAt.push(ring12.length);
      ring12.push(splitPoint(a, b, t, fold));
    } else {
      splitAt.push(-1);
    }
  }
  const y0 = -bury;
  const crownHeight = monarchCrownHeight(height, tip);
  const y1 = height - crownHeight;
  const radius = Math.max(...corners.map((p) => Math.hypot(p[0], p[2])));
  const last = profile[profile.length - 1]!;
  // Вістря — рівно над центром плеча (власник, 2026-10-05): зсув вершини
  // моделі для монарха не береться.
  const apex: XZ = [last.shift[0] * radius, last.shift[1] * radius];
  const flat = brokenShaft(seed, 'monarch', ring12, profile, y0, y1, radius, 0);
  const top0 = flat.rings[flat.rings.length - 1]!;
  // Корона з площин (ADR-0260): чергування великих і малих граней сильніше,
  // ніж у дітей, — монарх головний; фасок на кутах стільки, скільки ярусів
  // дали плани (ADR-0217).
  const roof = termination(seed, 'monarch', top0, cornerAt, apex, height, crownHeight,
    0.2 + 0.1 * unit(seed, 'monarch:roof:contrast'), Math.max(1, ridge));
  const shaft = brokenShaft(seed, 'monarch', ring12, profile, y0, y1, radius, 0,
    top0.map((p) => p[1] - roof.roofAt(p[0], p[2])));
  return [...shaft.tris, ...roofTris(shaft, roof, [apex[0], y1 - 0.2 * crownHeight, apex[1]], shaft.face, ROOF_SHADE)];
}

/**
 * Тон грані — з трьох (навичка `amore-crystal-look`, ADR-0176): на
 * 3-циклі сусідні грані й грані через одну завжди різні, тож жодна пара,
 * яку бачить око, не зливається в одну площину. Легкий розкид у межах
 * тону лишає кожну грань своєю.
 */
const FACE_TONES = [0.74, 1.0, 1.3] as const;

/**
 * Найменший злам, який око бачить ребром (ADR-0258). Виміряно на чотирьох
 * фікстурах двійника: третина кантів (≈86 з ≈250) лежала на зламах до 10° —
 * на майже пласкій поверхні, — і саме вони малювали сітку паперової моделі.
 * Між 10° і 20° справжніх ребер майже немає, тож 12° розділяє їх чисто.
 */
export const FOLD_DEG = 12;

/**
 * Кант — лише там, де площини справді зламані (ADR-0258).
 *
 * Злам, менший за `FOLD_DEG`, канта не має: око не бачить там ребра, і
 * світла лінія на майже пласкій поверхні малювала сітку паперової моделі.
 * Межу тону такий злам зберігає, якщо вона задумана: яруси стовбура
 * (ADR-0245) — різні грані на різній висоті, і без різниці тону бічні грані
 * знову йшли б рівно знизу догори. Грані вершини (без тонової групи), зламані
 * менше за поріг, стають однією гранню з одним тоном — корона з кількох
 * великих граней (ADR-0244), а не віяло дрібних трикутників.
 *
 * Тон кожної грані — один із трьох (ADR-0176). Сусідів через спільне ребро
 * розводить колір, і найважливіші — пологі: на крутому зламі грані й так
 * розводить світло, на пологому — лише тон. Тому збіг важить квадрат косинуса
 * злама; жадібний обхід у порядку трикутників і кілька проходів, що
 * перебирають тон, поки збігів меншає. Ребро без сусіда (низ стовбура в
 * жеоді) зберігає свій кант. Правило бачить лише кути між трикутниками, тож
 * нахил тіла його не змінює.
 */
function foldFacets(tris: readonly Tri[]): Tri[] {
  const key = (p: V3) => `${p[0].toFixed(5)},${p[1].toFixed(5)},${p[2].toFixed(5)}`;
  const normals = tris.map((tri): V3 => {
    const [a, b, c] = tri.points;
    const u: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const w: V3 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n: V3 = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    return [n[0] / l, n[1] / l, n[2] / l];
  });
  // Ребро навпроти кута s — між кутами s+1 і s+2.
  const owners = new Map<string, [number, number][]>();
  tris.forEach((tri, t) => {
    for (let s = 0; s < 3; s += 1) {
      const a = key(tri.points[(s + 1) % 3]!);
      const b = key(tri.points[(s + 2) % 3]!);
      const k = a < b ? `${a}|${b}` : `${b}|${a}`;
      const list = owners.get(k);
      if (list) list.push([t, s]); else owners.set(k, [[t, s]]);
    }
  });
  const minCos = Math.cos((FOLD_DEG * Math.PI) / 180);
  const group = (t: number) => tris[t]!.shade ?? -1 - tris[t]!.face;
  const parent = tris.map((_, t) => t);
  const find = (t: number): number => {
    let r = t;
    while (parent[r] !== r) r = parent[r]!;
    while (parent[t] !== r) { const next = parent[t]!; parent[t] = r; t = next; }
    return r;
  };
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  };
  // Задумана грань (два трикутники чотирикутника стовбура) — одна.
  const firstOfGroup = new Map<number, number>();
  tris.forEach((_, t) => {
    const g = group(t);
    const first = firstOfGroup.get(g);
    if (first === undefined) firstOfGroup.set(g, t); else join(first, t);
  });
  const folded: boolean[][] = tris.map((tri) => [...tri.edges]);
  const pairs: { t1: number; t2: number; cos: number }[] = [];
  for (const list of owners.values()) {
    if (list.length !== 2) continue;
    const [[t1, s1], [t2, s2]] = list as [[number, number], [number, number]];
    const a = normals[t1]!;
    const b = normals[t2]!;
    const cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const same = group(t1) === group(t2);
    const fold = cos < minCos && !same;
    folded[t1]![s1] = fold;
    folded[t2]![s2] = fold;
    if (!fold && !same && tris[t1]!.shade === undefined && tris[t2]!.shade === undefined) join(t1, t2);
    pairs.push({ t1, t2, cos });
  }
  const facetOf = tris.map((_, t) => find(t));
  const weights = new Map<number, Map<number, number>>();
  for (const { t1, t2, cos } of pairs) {
    const f1 = facetOf[t1]!;
    const f2 = facetOf[t2]!;
    if (f1 === f2) continue;
    const w = Math.max(0, cos) ** 2;
    for (const [a, b] of [[f1, f2], [f2, f1]] as const) {
      const near = weights.get(a) ?? new Map<number, number>();
      near.set(b, Math.max(near.get(b) ?? 0, w));
      weights.set(a, near);
    }
  }
  const roots = [...new Set(facetOf)];
  const tone = new Map<number, number>();
  const clash = (root: number, k: number) => {
    let sum = 0;
    for (const [f, w] of weights.get(root) ?? []) if (tone.get(f) === k) sum += w;
    return sum;
  };
  for (const root of roots) {
    const wanted = group(root) >= 0 ? group(root) % 3 : tris[root]!.face % 3;
    const order = [wanted, (wanted + 1) % 3, (wanted + 2) % 3];
    tone.set(root, order.reduce((best, k) => (clash(root, k) < clash(root, best) - 1e-9 ? k : best), wanted));
  }
  for (let pass = 0; pass < 8; pass += 1) {
    let changed = false;
    for (const root of roots) {
      const now = tone.get(root)!;
      if (clash(root, now) === 0) continue;
      const better = [0, 1, 2].reduce((best, k) => (clash(root, k) < clash(root, best) - 1e-9 ? k : best), now);
      if (better !== now) { tone.set(root, better); changed = true; }
    }
    if (!changed) break;
  }
  return tris.map((tri, t) => ({
    ...tri,
    edges: folded[t] as [boolean, boolean, boolean],
    // Група тону: грань (її перший трикутник) і тон із трьох.
    shade: facetOf[t]! * 3 + tone.get(facetOf[t]!)!,
  }));
}

/** Нахил тіл року в друзі — частка модельного (ADR-0245). */
const CHILD_LEAN = 0.5;
/** На скільки радіусів тіла року його основа відходить від монарха. */
const CHILD_STEP_OUT = 0.35;

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
      : foldFacets(monarchBody(seed, m.sides, m.height, m.tierHeights.reduce((sum, h) => sum + h, 0),
        m.tiers, 0.12 * m.height, monarchProfile(seed))),
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
      : foldFacets(body(seed, key, child.sides, child.height, tip, apexShift,
        1 + Math.floor(unit(seed, `${key}:ridge`) * 2), 0.12 * child.height));
    const az = (child.azimuth * Math.PI) / 180;
    const distance = form === 'stalagmite' ? child.distance : child.distance + child.radius * CHILD_STEP_OUT;
    const offset: V3 = [Math.cos(az) * distance, 0, Math.sin(az) * distance];
    // Сталагміт росте прямо вгору — краплі падають згори; нахил місць лишається
    // натяком (третина), а не віялом, як у друзи.
    // Друза — щільний пучок майже вертикальних кристалів (ADR-0245, еталон:
    // нахил 0…7°): віяло під 30–40° розкидало дітей від монарха. Нахил
    // місць лишається — удвічі м'якший, і більше місць досі нахиляє більше.
    // Щоб пряміший кристал не врізався в монарха, основа відходить на
    // третину власного радіуса.
    const lean = form === 'stalagmite' ? child.lean * 0.3 : child.lean * CHILD_LEAN;
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
    reach = Math.max(reach, distance + Math.sin((lean * Math.PI) / 180) * child.height + child.radius * (form === 'stalagmite' ? 2 : 1));
  }

  const total = bodies.reduce((sum, b) => sum + b.tris.length, 0);
  const positions = new Float32Array(total * 9);
  const faceTone = new Float32Array(total * 3);
  const edge = new Float32Array(total * 9);
  const rise = new Float32Array(total * 3);
  let at = 0;
  for (const b of bodies) {
    for (const tri of b.tris) {
      const group = tri.shade ?? tri.face;
      const tone = FACE_TONES[group % 3]! * (0.95 + 0.1 * unit(seed, `face:${b.key}:${group}`));
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
