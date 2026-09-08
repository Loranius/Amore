import { describe, expect, it } from 'vitest';
import {
  PORTAL_DRIFT_ROCKS,
  PORTAL_FLORA_TUFTS,
  PORTAL_ISLAND_RADIUS,
  buildPortalDriftGeometry,
  buildPortalFloraGeometry,
  buildPortalIslandGeometry,
} from './portalIsland';

// ============================================================
// Рослинність на островах (ADR-0163).
// ------------------------------------------------------------
// Прохання власника: «додай трохи рослинності на всі острови». «Всі» тут
// головне слово — і плато, і летючі брили, — а з нього випливає ЄДИНА
// справжня складність цієї зміни: кущик на летючому камені мусить літати
// РАЗОМ із каменем, а кущик на плато — стояти.
//
// Дві вади, які тут стережуться, обидві вже траплялись у цьому файлі під
// іншими іменами:
//
//  1. **Рослина, посаджена на КРИВУ, а не на МЕШ** (ADR-0140). Плато
//     намальоване пласкими трикутниками між вибірками кривої, і між ними
//     хорда провисає; кущик, посаджений на криву, висить над каменем.
//  2. **Рослина, що відстала від свого каменя.** Друга копія арифметики
//     розміщення розійшлась би з першою тієї ж миті, коли хтось поворухне
//     будь-яке число.
// ============================================================

const SEED = 20221226;

type P = readonly [number, number, number];

function triangles(geometry: { getAttribute(name: string): { array: ArrayLike<number> } }): P[][] {
  const p = geometry.getAttribute('position').array;
  const out: P[][] = [];
  for (let at = 0; at + 8 < p.length; at += 9) {
    out.push([
      [p[at]!, p[at + 1]!, p[at + 2]!],
      [p[at + 3]!, p[at + 4]!, p[at + 5]!],
      [p[at + 6]!, p[at + 7]!, p[at + 8]!],
    ]);
  }
  return out;
}

function floats(geometry: { getAttribute(name: string): { array: ArrayLike<number> } | undefined }) {
  const attribute = geometry.getAttribute('portalFloat');
  expect(attribute).toBeDefined();
  return attribute!.array;
}

/** Möller–Trumbore, двобічний: відстань уздовж променя або `null`. */
function hit(from: P, dir: P, a: P, b: P, c: P): number | null {
  const sub = (one: P, other: P): P => [one[0] - other[0], one[1] - other[1], one[2] - other[2]];
  const cross = (one: P, other: P): P => [
    one[1] * other[2] - one[2] * other[1],
    one[2] * other[0] - one[0] * other[2],
    one[0] * other[1] - one[1] * other[0],
  ];
  const dot = (one: P, other: P) => one[0] * other[0] + one[1] * other[1] + one[2] * other[2];
  const edge1 = sub(b, a);
  const edge2 = sub(c, a);
  const pivot = cross(dir, edge2);
  const det = dot(edge1, pivot);
  if (Math.abs(det) < 1e-12) return null;
  const inverse = 1 / det;
  const span = sub(from, a);
  const u = inverse * dot(span, pivot);
  if (u < 0 || u > 1) return null;
  const other = cross(span, edge1);
  const v = inverse * dot(dir, other);
  if (v < 0 || u + v > 1) return null;
  const along = inverse * dot(edge2, other);
  return along > 1e-9 ? along : null;
}

const flora = () => buildPortalFloraGeometry(SEED, PORTAL_FLORA_TUFTS.high, PORTAL_DRIFT_ROCKS.high);

/** Основа кущика — спільна нижня точка трьох його листків. */
function tufts(): { seat: P; float: readonly [number, number] }[] {
  const geometry = flora();
  const face = triangles(geometry);
  const marks = floats(geometry);
  const out: { seat: P; float: readonly [number, number] }[] = [];
  /*
   * Основа — СЕРЕДИНА між двома нижніми кутами листка, а не перший кут.
   *
   * Листок стоїть на землі парою точок, розведених убік від основи, тож
   * перший кут зсунутий від неї на пів ширини листка. Перша редакція цього
   * тесту брала саме його — і промінь, пущений із зсунутої точки, подеколи
   * промахувався повз трикутник плато й летів до самого обриву: 0.47
   * замість 0.01. Вада була в мірці, а не в посадці.
   */
  for (let blade = 0; blade < face.length; blade += 3) {
    const left = face[blade]![0]!;
    const right = face[blade]![1]!;
    const at = blade * 3 * 2;
    out.push({
      seat: [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2, (left[2] + right[2]) / 2],
      float: [marks[at]!, marks[at + 1]!],
    });
  }
  return out;
}

describe('рослинність на островах', () => {
  it('росте і на плато, і на летючих брилах', () => {
    // «На всі острови» дослівно: якби кущики були лише на плато, тест
    // проходив би, а прохання — ні.
    const grown = tufts();
    const still = grown.filter((tuft) => tuft.float[0] === 0 && tuft.float[1] === 0);
    const flying = grown.filter((tuft) => tuft.float[1] !== 0);
    expect(still.length).toBe(PORTAL_FLORA_TUFTS.high);
    expect(flying.length).toBeGreaterThan(PORTAL_DRIFT_ROCKS.high * 0.5);
    expect(flying.length).toBeLessThanOrEqual(PORTAL_DRIFT_ROCKS.high);
  });

  it('кущик на брилі несе ТУ САМУ фазу, що й камінь під ним', () => {
    /*
     * Це і є вся складність зміни. Трава, яка порахувала б свою фазу
     * самостійно, полетіла б окремо від каменя — і побачити це можна було б
     * лише оком, у русі, тобто ніколи.
     *
     * Звіряються множини: кожна фаза трави мусить існувати серед фаз брил.
     */
    const stone = floats(buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.high));
    const known = new Set<string>();
    for (let at = 0; at + 1 < stone.length; at += 2) {
      known.add(`${stone[at]}|${stone[at + 1]}`);
    }
    const flying = tufts().filter((tuft) => tuft.float[1] !== 0);
    expect(flying.length).toBeGreaterThan(0);
    for (const tuft of flying) {
      expect(known, `${tuft.float[0]}|${tuft.float[1]}`)
        .toContain(`${tuft.float[0]}|${tuft.float[1]}`);
    }
  });

  it('кущик на брилі стоїть НА НІЙ, а не поруч у повітрі', () => {
    // Фаза каменя — його ім'я: вершини брили й трави на ній несуть одну
    // пару чисел, тож камінь можна знайти, не знаючи, як його будували.
    const stone = buildPortalDriftGeometry(SEED, PORTAL_DRIFT_ROCKS.high);
    const rockPoints = triangles(stone).flat();
    const rockMarks = floats(stone);
    const box = new Map<string, { x0: number; x1: number; z0: number; z1: number; top: number }>();
    for (let vertex = 0; vertex < rockPoints.length; vertex += 1) {
      const key = `${rockMarks[vertex * 2]}|${rockMarks[vertex * 2 + 1]}`;
      const point = rockPoints[vertex]!;
      const seen = box.get(key);
      if (seen === undefined) {
        box.set(key, { x0: point[0], x1: point[0], z0: point[2], z1: point[2], top: point[1] });
        continue;
      }
      seen.x0 = Math.min(seen.x0, point[0]);
      seen.x1 = Math.max(seen.x1, point[0]);
      seen.z0 = Math.min(seen.z0, point[2]);
      seen.z1 = Math.max(seen.z1, point[2]);
      seen.top = Math.max(seen.top, point[1]);
    }
    for (const tuft of tufts().filter((one) => one.float[1] !== 0)) {
      const key = `${tuft.float[0]}|${tuft.float[1]}`;
      const rock = box.get(key)!;
      expect(rock, key).toBeDefined();
      expect(tuft.seat[0], `${key} x`).toBeGreaterThanOrEqual(rock.x0);
      expect(tuft.seat[0], `${key} x`).toBeLessThanOrEqual(rock.x1);
      expect(tuft.seat[2], `${key} z`).toBeGreaterThanOrEqual(rock.z0);
      expect(tuft.seat[2], `${key} z`).toBeLessThanOrEqual(rock.z1);
      // На шапці, а не на зламі знизу: шапка брили — це колишня поверхня
      // острова, тобто єдине місце на камені, де трава могла лишитись.
      expect(rock.top - tuft.seat[1], `${key} y`).toBeLessThan((rock.x1 - rock.x0) * 0.6);
      expect(tuft.seat[1], `${key} y`).toBeLessThanOrEqual(rock.top);
    }
  });

  it('кущик на плато сидить у МЕШІ, а не на кривій, яку той меш наближає', () => {
    /*
     * Та сама вада, що ADR-0140 знайшов у друзи печери: плато намальоване
     * пласкими трикутниками МІЖ вибірками кривої, і між ними хорда
     * провисає. Кущик, посаджений на криву, висить над каменем.
     *
     * ПРОМІНЬ ПУСКАЄТЬСЯ З 0.01 НАД ОСНОВОЮ, а не з-під неба, і це не
     * послаблення. Перша редакція брала найвищий камінь над кущиком і
     * падала на 0.027 — виявилось, що плато місцями НАКРИВАЄ САМЕ СЕБЕ:
     * радіальне тремтіння ґратки (ADR-0147) зсуває вершини вздовж радіуса,
     * і кільця подеколи заходять одне за одне, тож над кущиком буває
     * навислий карниз. Це властивість плато, а не посадки, і питати про неї
     * тут — значить міряти не те.
     *
     * Питання цього тесту одне: чи є камінь ПІД основою, впритул. Промінь з
     * 0.01 над нею мусить його зустріти в межах 0.02 — тобто рівно там, де
     * кущик і посаджено.
     */
    const island = triangles(buildPortalIslandGeometry(SEED, 0));
    let worst = 0;
    for (const tuft of tufts().filter((one) => one.float[1] === 0)) {
      const from: P = [tuft.seat[0], tuft.seat[1] + 0.01, tuft.seat[2]];
      let nearest = Infinity;
      for (const triangle of island) {
        const along = hit(from, [0, -1, 0], triangle[0]!, triangle[1]!, triangle[2]!);
        if (along !== null && along < nearest) nearest = along;
      }
      expect(nearest, `${tuft.seat.join(',')} — каменю під кущиком немає`).toBeLessThan(0.02);
      worst = Math.max(worst, Math.abs(from[1] - nearest - tuft.seat[1]));
    }
    /*
     * Виміряно: найгірше розходження — 0.0040000478, тобто рівно те
     * підтоплення на 0.004, з яким кущик і садять, плюс п'ять
     * стомільйонних. Посадка не наближена — вона точна, бо основа лежить
     * усередині трикутника, а не між вибірками кривої.
     */
    expect(worst).toBeGreaterThan(0.0039);
    expect(worst).toBeLessThan(0.0041);
  });

  it('не вилазить за кромку плато', () => {
    // Кущик, що звисає з обриву, читається не травою, а дірою в силуеті.
    for (const tuft of tufts().filter((one) => one.float[1] === 0)) {
      expect(Math.hypot(tuft.seat[0], tuft.seat[2])).toBeLessThan(PORTAL_ISLAND_RADIUS);
    }
  });

  it('порожній профіль якості не малює нічого', () => {
    const empty = buildPortalFloraGeometry(SEED, PORTAL_FLORA_TUFTS.fallback, PORTAL_DRIFT_ROCKS.fallback);
    expect(empty.getAttribute('position').array.length).toBe(0);
  });

  it('коштує три трикутники на кущик, і жодного більше', () => {
    /*
     * Листок — ОДИН трикутник, бо матеріал двобічний. Другий трикутник на
     * кожен листок подвоїв би весь цей меш заради нічого; це той самий
     * виняток, що в хмар (ADR-0159): пласка пелюстка не є тілом.
     */
    const count = triangles(flora()).length;
    expect(count % 3).toBe(0);
    expect(count / 3).toBe(tufts().length);
  });
});
