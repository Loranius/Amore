import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import type { PortalFloraLayout } from './portalIsland';
import {
  PORTAL_BUSHES,
  PORTAL_DRIFT_ROCKS,
  PORTAL_FLORA_TUFTS,
  PORTAL_ISLAND_CROWN_TRIANGLES,
  PORTAL_ISLAND_RADIUS,
  PORTAL_ISLAND_SEGMENTS,
  PORTAL_ISLAND_TOP_RING_COUNT,
  PORTAL_MOSS_COVER,
  PORTAL_RIM_TUFTS,
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

const flora = () => buildPortalFloraGeometry(SEED, 'high');

/**
 * Межі родів зелені в меші — з самого меша (ADR-0166).
 *
 * Досі цей файл ділив меш кроком у три трикутники: кущик — три листки, і
 * більше в меші нічого не було. Тепер там п'ять родів зелені різної
 * довжини (мох 1, кущик 3, кущ 5, звис 2, трава на брилі 3), і ділення
 * стало б ДРУГОЮ КОПІЄЮ арифметики будівника — розійшлася б із першою
 * тієї миті, коли хтось поворухне густину моху. Тому будівник публікує
 * розклад, а тест його читає.
 */
function layout(geometry: THREE.BufferGeometry): PortalFloraLayout {
  const published = geometry.userData.floraLayout as PortalFloraLayout | undefined;
  expect(published, 'меш трави не опублікував свій розклад').toBeDefined();
  return published!;
}

/**
 * Основа кущика — спільна нижня точка трьох його листків.
 *
 * Основа — СЕРЕДИНА між двома нижніми кутами листка, а не перший кут.
 * Листок стоїть на землі парою точок, розведених убік від основи, тож
 * перший кут зсунутий від неї на пів ширини листка. Перша редакція цього
 * тесту брала саме його — і промінь, пущений із зсунутої точки, подеколи
 * промахувався повз трикутник плато й летів до самого обриву: 0.47
 * замість 0.01. Вада була в мірці, а не в посадці.
 *
 * Береться ЛИШЕ трава — кущики плато й кущики на брилах. Мох лежить на
 * землі й основи не має; кущ має п'ять листків, а не три; звис росте вниз,
 * і питати в нього про камінь під основою — те саме, що питати про камінь
 * під бурулькою.
 */
function tufts(): { seat: P; float: readonly [number, number] }[] {
  const geometry = flora();
  const face = triangles(geometry);
  const marks = floats(geometry);
  const plan = layout(geometry);
  const out: { seat: P; float: readonly [number, number] }[] = [];
  const spans: readonly (readonly [number, number])[] = [
    [plan.moss, plan.moss + plan.tufts],
    [
      plan.moss + plan.tufts + plan.bushes + plan.drapes + plan.rockMoss,
      plan.moss + plan.tufts + plan.bushes + plan.drapes + plan.rockMoss + plan.rockTufts,
    ],
  ];
  for (const [from, to] of spans) {
    for (let blade = from; blade < to; blade += 3) {
      const left = face[blade]![0]!;
      const right = face[blade]![1]!;
      const at = blade * 3 * 2;
      out.push({
        seat: [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2, (left[2] + right[2]) / 2],
        float: [marks[at]!, marks[at + 1]!],
      });
    }
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
    // Кущики плато — саме вони; мох, кущі й звиси до `tufts()` не входять.
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

  it('тримає ТРАВУ в межах плато, а ЗВИС — за його кромкою', () => {
    /*
     * ПРАВИЛО РОЗДВОЇЛОСЬ, І ЦЕ СВІДОМА ЗМІНА ЗМІСТУ (ADR-0166).
     *
     * Було одне: «не вилазить за кромку плато», бо кущик, що звисає з
     * обриву, читається не травою, а дірою в силуеті. Для трави це
     * лишається правдою й перевіряється далі.
     *
     * Але звис із кромки існує рівно заради протилежного: в еталоні
     * власника зелень перевалюється через край і висить над порожнечею,
     * і саме це малює силует острова зеленим на тлі неба. Тому для нього
     * правило обернене — сідало на плато, кінчик за кромкою й НИЖЧЕ за
     * сідало.
     */
    for (const tuft of tufts().filter((one) => one.float[1] === 0)) {
      expect(Math.hypot(tuft.seat[0], tuft.seat[2])).toBeLessThan(PORTAL_ISLAND_RADIUS);
    }

    const geometry = flora();
    const face = triangles(geometry);
    const plan = layout(geometry);
    const from = plan.moss + plan.tufts + plan.bushes;
    expect(plan.drapes).toBe(PORTAL_RIM_TUFTS.high * 2);
    /*
     * Кромка міряється ПО САМОМУ ПЛАТО, а не по `PORTAL_ISLAND_RADIUS`.
     * Радіальне тремтіння ґратки (ADR-0147) зсуває вершини вздовж
     * радіуса, тож зовнішнє кільце місцями виходить за одиницю — до 1.08
     * на цьому насінні. Порівнювати з номінальним радіусом означало б
     * міряти тремтіння, а не посадку.
     */
    const rim = Math.max(...triangles(buildPortalIslandGeometry(SEED, 0))
      .slice(0, PORTAL_ISLAND_CROWN_TRIANGLES)
      .flat()
      .map((point) => Math.hypot(point[0], point[2])));
    let beyond = 0;
    for (let leaf = from; leaf < from + plan.drapes; leaf += 1) {
      const [left, right, tip] = face[leaf]! as [P, P, P];
      const base: P = [(left[0] + right[0]) / 2, (left[1] + right[1]) / 2, (left[2] + right[2]) / 2];
      // Сідало — на плато: звис росте з землі, а не з повітря поруч.
      expect(Math.hypot(base[0], base[2])).toBeLessThanOrEqual(rim);
      // Кінчик — нижче за сідало. Це і є різниця між звисом і кущиком.
      expect(tip[1]).toBeLessThan(base[1]);
      if (Math.hypot(tip[0], tip[2]) > Math.hypot(base[0], base[2])) beyond += 1;
    }
    // Кожен звис тягнеться НАЗОВНІ — інакше він висить під плато, де його
    // не видно взагалі, і всі ці трикутники оплачені даремно.
    expect(beyond).toBe(plan.drapes);
  });

  it('вкриває плато мохом, а не самими кущиками', () => {
    /*
     * ЧОМУ ЦЕ ОКРЕМА ГАРАНТІЯ. Кущики дали 0.04% кадру — трава, яку видно,
     * лише коли її шукаєш. В еталоні власника зелена САМА ЗЕМЛЯ. Латка
     * коштує один трикутник і вкриває площу, якої тридцять вісім кущиків
     * не вкриють ніколи, тож саме мох, а не кущики, і є зелень острова.
     *
     * Перевіряється частка ВКРИТИХ КЛІТИНОК, бо саме нею густина й
     * задана: клітинок на плато `сегменти × (кільця - 2) × 2`, і кожна
     * або зелена, або ні.
     */
    const geometry = flora();
    const plan = layout(geometry);
    const cells = PORTAL_ISLAND_SEGMENTS * (PORTAL_ISLAND_TOP_RING_COUNT - 2) * 2;
    const share = plan.moss / cells;
    expect(share).toBeGreaterThan(PORTAL_MOSS_COVER.high * 0.85);
    expect(share).toBeLessThan(PORTAL_MOSS_COVER.high * 1.15);
    // І моху більше, ніж усіх кущиків разом: земля зелена, трава — деталь.
    expect(plan.moss).toBeGreaterThan(plan.tufts + plan.bushes);
  });

  it('кладе мох НА плато, а не в нього і не над ним', () => {
    /*
     * Латка — це сам трикутник плато, піднятий на 0.006. Нуль дав би
     * z-fighting із породою під собою; помітний підйом читався б зеленою
     * лускою, що відстала від землі.
     *
     * Перевіряється відстань від кожної вершини моху до найближчої
     * вершини плато: вона мусить дорівнювати саме тому підйому.
     */
    const geometry = flora();
    const plan = layout(geometry);
    const face = triangles(geometry);
    const crown = triangles(buildPortalIslandGeometry(SEED, 0))
      .slice(0, PORTAL_ISLAND_CROWN_TRIANGLES)
      .flat();
    let worst = 0;
    for (let patch = 0; patch < plan.moss; patch += 1) {
      for (const point of face[patch]!) {
        let nearest = Infinity;
        for (const vertex of crown) {
          const gap = Math.hypot(point[0] - vertex[0], point[2] - vertex[2]);
          if (gap < 1e-9) nearest = Math.min(nearest, point[1] - vertex[1]);
        }
        expect(Number.isFinite(nearest), `${point.join(',')} — вершини плато під мохом немає`)
          .toBe(true);
        worst = Math.max(worst, Math.abs(nearest - 0.006));
      }
    }
    expect(worst).toBeLessThan(1e-6);
  });

  it('порожній профіль якості не малює нічого', () => {
    const empty = buildPortalFloraGeometry(SEED, 'fallback');
    expect(empty.getAttribute('position').array.length).toBe(0);
  });

  it('коштує рівно стільки, скільки оголосив, і жодного трикутника більше', () => {
    /*
     * ЗМІНА ЗМІСТУ (ADR-0166). Було «три трикутники на кущик, і жодного
     * більше» — правда, поки меш складався з самих кущиків. Тепер родів
     * зелені п'ять, і незмінним лишається інше: сума розкладу мусить
     * дорівнювати мешу. Розклад, який не сходиться з мешем, гірший за
     * відсутній — за ним ріжуть тести.
     *
     * Листок і далі ОДИН трикутник, бо матеріал двобічний; це той самий
     * виняток, що в хмар (ADR-0159): пласка пелюстка не є тілом. Звідси
     * решта чисел: кущик — 3, кущ — 5, звис — 2, латка — 1.
     */
    const geometry = flora();
    const plan = layout(geometry);
    const count = triangles(geometry).length;
    expect(
      plan.moss + plan.tufts + plan.bushes + plan.drapes + plan.rockMoss + plan.rockTufts,
    ).toBe(count);
    expect(plan.tufts).toBe(PORTAL_FLORA_TUFTS.high * 3);
    expect(plan.bushes).toBe(PORTAL_BUSHES.high * 5);
    expect(plan.drapes).toBe(PORTAL_RIM_TUFTS.high * 2);
    expect(plan.rockTufts % 3).toBe(0);
    // Шапка брили — віяло з семи трикутників, по одному на кут.
    expect(plan.rockMoss % 7).toBe(0);
  });
});
