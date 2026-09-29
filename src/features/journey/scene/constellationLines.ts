// ============================================================
// Лінії сузір'я — прямі, як на зоряній карті (ADR-0214).
// ------------------------------------------------------------
// Власник: «зроби сузір'я схожим на реальні сузір'я з гострими
// геометричними з'єднаннями замість хвилястих».
//
// Шлях був одним сплайном Катмулла — Рома крізь усі зірки: на кожній зірці
// він згинався, і сузір'я читалось стрічкою, що в'ється. На справжній
// зоряній карті інакше: від зірки до зірки — ПРЯМА, злам — рівно на зірці.
// Лінія доходить до осердя зірки (власник: «щоб вони торкались зірок»):
// проміжок біля кінчиків променів робив зірки відірваними від шляху.
//
// Модуль чистий: лише масиви вершин, без three. `uv.x` лишається тією самою
// угодою, що була в сплайна, — зірка `i` лежить на `i / (n − 1)`, — тож поява
// (`pathReveal`) і імпульс працюють без змін.
// ============================================================

export interface LineStar {
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface ConstellationLineMesh {
  positions: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

/** Скільки граней у перерізі лінії. П'ять досить: вона тонша за піксель здалеку. */
export const LINE_SIDES = 5;

/**
 * Де кінчається лінія — частка радіуса зірки від її центру.
 *
 * Було 0.85: лінія зупинялась біля кінчиків променів, і власник побачив
 * зірки, що висять окремо від шляху («щоб вони торкались зірок»). Тепер
 * лінія заходить у сяйво й упирається в осердя (≈0.1 радіуса), тож зірка
 * й шлях читаються одним малюнком.
 */
export const LINE_GAP_SHARE = 0.12;

/** Проміжки ніколи не з'їдають більше за цю частку прольоту. */
const MAX_GAP_SHARE_OF_LEG = 0.35;

type V = [number, number, number];

function sub(a: V, b: V): V { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function add(a: V, b: V): V { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
function scale(a: V, s: number): V { return [a[0] * s, a[1] * s, a[2] * s]; }
function cross(a: V, b: V): V {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function length(a: V): number { return Math.hypot(a[0], a[1], a[2]); }
function normalise(a: V): V { const l = length(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

/** Скільки на цьому прольоті забирає проміжок біля кожної зірки. */
export function legGaps(from: LineStar, to: LineStar): { start: number; end: number; length: number } {
  const leg = length(sub([to.x, to.y, to.z], [from.x, from.y, from.z]));
  const cap = leg * MAX_GAP_SHARE_OF_LEG;
  return {
    start: Math.min(from.radius * LINE_GAP_SHARE, cap),
    end: Math.min(to.radius * LINE_GAP_SHARE, cap),
    length: leg,
  };
}

/**
 * Прямі призми між сусідніми зірками ланцюга.
 *
 * Кожен проліт — окрема призма з двох кілець: прямій більше вершин не
 * треба, а `uv.x` лінійно інтерполюється між кільцями рівно так, як
 * потрібно появі. Один меш на весь ланцюг — один виклик малювання.
 */
export function buildConstellationLines(chain: readonly LineStar[], radius: number): ConstellationLineMesh {
  const legs = Math.max(0, chain.length - 1);
  const ringSize = LINE_SIDES;
  const positions = new Float32Array(legs * 2 * ringSize * 3);
  const uvs = new Float32Array(legs * 2 * ringSize * 2);
  const indices = new Uint32Array(legs * ringSize * 6);
  let vertex = 0;
  let index = 0;
  for (let leg = 0; leg < legs; leg += 1) {
    const from = chain[leg]!;
    const to = chain[leg + 1]!;
    const a: V = [from.x, from.y, from.z];
    const b: V = [to.x, to.y, to.z];
    const gaps = legGaps(from, to);
    const dir = normalise(sub(b, a));
    // Будь-який перпендикуляр: вісь, найменш паралельна до прольоту.
    const helper: V = Math.abs(dir[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const n1 = normalise(cross(dir, helper));
    const n2 = cross(dir, n1);
    const start = add(a, scale(dir, gaps.start));
    const end = sub(b, scale(dir, gaps.end));
    const span = Math.max(1, legs);
    const uvStart = (leg + (gaps.length > 0 ? gaps.start / gaps.length : 0)) / span;
    const uvEnd = (leg + 1 - (gaps.length > 0 ? gaps.end / gaps.length : 0)) / span;
    const base = vertex;
    for (const [centre, u] of [[start, uvStart], [end, uvEnd]] as const) {
      for (let side = 0; side < ringSize; side += 1) {
        const angle = (side / ringSize) * Math.PI * 2;
        const offset = add(scale(n1, Math.cos(angle) * radius), scale(n2, Math.sin(angle) * radius));
        const p = add(centre, offset);
        positions.set(p, vertex * 3);
        uvs.set([u, side / ringSize], vertex * 2);
        vertex += 1;
      }
    }
    for (let side = 0; side < ringSize; side += 1) {
      const next = (side + 1) % ringSize;
      const a0 = base + side;
      const a1 = base + next;
      const b0 = base + ringSize + side;
      const b1 = base + ringSize + next;
      indices.set([a0, b0, a1, a1, b0, b1], index);
      index += 6;
    }
  }
  return { positions, uvs, indices };
}
