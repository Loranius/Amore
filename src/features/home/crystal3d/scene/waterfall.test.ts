import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  PORTAL_WATERFALLS,
  buildPortalIslandGeometry,
  buildPortalWaterfallGeometry,
} from './portalIsland';

// ============================================================
// Водоспади з кромки (ADR-0167).
// ------------------------------------------------------------
// Дві вади, обидві знайдені кадром і обидві тут застережені:
//
//  1. **Вода йшла по прямій, а острів найширший НЕ на кромці.** Виміряно
//     1.03 радіуса на плато проти 1.32 на висоті −0.4: пряма стрічка
//     проходила ВСЕРЕДИНІ породи й з'являлась лише там, де обрив уже
//     звузився. У кадрі це стовп туману без початку.
//  2. **Падіння починалось нижче за кромку.** `ISLAND_ROOT_ROWS_ALL`
//     починається вже під нею, тож без окремої ланки на самій кромці
//     витік було видно, а джерело — ні.
// ============================================================

const SEED = 20221226;

type P = readonly [number, number, number];

function vertices(geometry: THREE.BufferGeometry): { at: P; alpha: number }[] {
  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colour = geometry.getAttribute('color') as THREE.BufferAttribute;
  const out: { at: P; alpha: number }[] = [];
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    out.push({
      at: [position.getX(vertex), position.getY(vertex), position.getZ(vertex)],
      alpha: colour.getW(vertex),
    });
  }
  return out;
}

/**
 * Вершини самих завіс, без потоків на плато (ADR-0211).
 *
 * Кожен водоспад тепер — потік по плато й завіса під кромкою, і будівник
 * публікує, скільки трикутників у кожній частині. Мірки ОБРИВУ (звуження,
 * згасання, розведення) питають завісу: потік лежить на плато, тож він і
 * вищий, і ближчий до осі — будь-яка мірка по суміші міряла б його.
 */
function curtains(geometry: THREE.BufferGeometry): { at: P; alpha: number }[][] {
  const layout = geometry.userData.waterfallLayout as { stream: number; curtain: number }[] | undefined;
  expect(layout, 'водоспади не опублікували розклад').toBeDefined();
  const all = vertices(geometry);
  const out: { at: P; alpha: number }[][] = [];
  let at = 0;
  for (const fall of layout!) {
    at += fall.stream * 3;
    out.push(all.slice(at, at + fall.curtain * 3));
    at += fall.curtain * 3;
  }
  expect(at).toBe(all.length);
  return out;
}

/** Найвища точка плато — та висота, з якої вода й мусить зриватись. */
function crownTop(): number {
  const island = buildPortalIslandGeometry(SEED, 0);
  const position = island.getAttribute('position') as THREE.BufferAttribute;
  let top = -Infinity;
  for (let vertex = 0; vertex < position.count; vertex += 1) {
    top = Math.max(top, position.getY(vertex));
  }
  island.dispose();
  return top;
}

describe('водоспади з кромки (ADR-0167)', () => {
  it('зривається З КРОМКИ, а не з середини обриву', () => {
    /*
     * Верхня точка кожної стрічки мусить стояти на рівні плато. Допуск —
     * чверть радіуса острова: плато не пласке (рельєф ADR-0147), тож
     * рівності тут не буває, а от «на пів острова нижче» буває, і саме це
     * ловиться.
     */
    const geometry = buildPortalWaterfallGeometry(SEED, PORTAL_WATERFALLS.high);
    const highest = Math.max(...vertices(geometry).map((one) => one.at[1]));
    expect(highest).toBeGreaterThan(crownTop() - 0.25);
    geometry.dispose();
  });

  it('ніколи не заходить у камінь і не повертає за ним досередини (ADR-0211)', () => {
    /*
     * ЗМІНА ЗМІСТУ. Тут стояло «облягає породу: радіус звужується разом із
     * коренем» (ADR-0167). Ця гарантія боролась із прямою стрічкою, що йшла
     * ВСЕРЕДИНІ породи, — і перемогла її, але ціною, яку показав кадр
     * ADR-0211: вода, що облягає корінь до вістря, зводить обидва передні
     * водоспади в один стовп під островом. На еталоні вода падає ПРЯМО
     * ВНИЗ там, де обрив під нею звужується.
     *
     * Незмінне від ADR-0167 одне: вода не проходить крізь камінь. Тож
     * перевіряється саме воно — завіса на кожній висоті ширша за острів на
     * тому ж куті, — і нове правило: донизу радіус не меншає.
     */
    const geometry = buildPortalWaterfallGeometry(SEED, PORTAL_WATERFALLS.high);
    const island = vertices(buildPortalIslandGeometry(SEED, 0));
    for (const [fall, own] of curtains(geometry).entries()) {
      /*
       * Осьова лінія завіси — середина кожного ряду: ряд симетричний
       * відносно ядра, тож середнє його точок і є ядро.
       */
      const byRow = new Map<string, P[]>();
      for (const one of own) {
        const key = one.at[1].toFixed(6);
        byRow.set(key, [...(byRow.get(key) ?? []), one.at]);
      }
      const cores = [...byRow.values()].map((points) => ({
        at: [
          points.reduce((sum, point) => sum + point[0], 0) / points.length,
          points[0]![1],
          points.reduce((sum, point) => sum + point[2], 0) / points.length,
        ] as P,
      }));
      const angle = Math.atan2(cores[0]!.at[2], cores[0]!.at[0]);
      const bearing = (one: { at: P }) => Math.abs(
        ((Math.atan2(one.at[2], one.at[0]) - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI,
      );
      const rock = island.filter((one) => bearing(one) < 0.04);
      const sorted = [...cores].sort((a, b) => b.at[1] - a.at[1]);
      let previous = 0;
      let compared = 0;
      for (const core of sorted) {
        const radius = Math.hypot(core.at[0], core.at[2]);
        expect(radius, `падіння ${fall}: радіус меншає донизу`).toBeGreaterThanOrEqual(previous - 0.03);
        previous = Math.max(previous, radius);
        const beside = rock.filter((one) => Math.abs(one.at[1] - core.at[1]) < 0.06);
        if (beside.length === 0) continue;
        compared += 1;
        const widest = Math.max(...beside.map((one) => Math.hypot(one.at[0], one.at[2])));
        expect(radius, `падіння ${fall} на ${core.at[1].toFixed(2)} — у камені`).toBeGreaterThan(widest - 0.02);
      }
      // Мірка, що нічого не порівняла, нічого й не гарантує.
      expect(compared, `падіння ${fall}: поруч немає каменю`).toBeGreaterThan(3);
    }
    geometry.dispose();
  });

  it('тане, а не обривається', () => {
    /*
     * Під островом немає ані озера, ані туману, який з'їв би стрічку:
     * різаний край читався б шматком скла. Тому прозорість іде четвертим
     * каналом кольору (той самий прийом, що в хмар, ADR-0165) і на дні
     * доходить до нуля.
     *
     * Згасання рахується ПО ГЛИБИНІ, а не по номеру ланки: ряди кореня
     * біля кромки стоять густо, і згасання за номером ланки лишало
     * яскравими кілька пікселів висоти — у кадрі це біла латка, а не
     * падіння.
     */
    const geometry = buildPortalWaterfallGeometry(SEED, PORTAL_WATERFALLS.high);
    const colour = geometry.getAttribute('color') as THREE.BufferAttribute;
    expect(colour.itemSize).toBe(4);
    const all = curtains(geometry).flat();
    const lowest = all.reduce((deep, one) => (one.at[1] < deep.at[1] ? one : deep), all[0]!);
    expect(lowest.alpha).toBeLessThan(0.02);
    /*
     * Нагорі ЯДРО повної сили. Краї завіси навмисно прозорі (ADR-0211:
     * світле ядро, прозорі краї), тож питається найщільніша вершина
     * верхнього ряду, а не будь-яка найвища.
     */
    const top = Math.max(...all.map((one) => one.at[1]));
    const crest = all.filter((one) => one.at[1] > top - 1e-6);
    expect(Math.max(...crest.map((one) => one.alpha))).toBeGreaterThan(0.9);
    expect(Math.min(...crest.map((one) => one.alpha))).toBeLessThan(0.4);
    /*
     * І на половині глибини вода вже помітно слабша: рівне згасання
     * лишало під островом сірий стовп пари.
     */
    const bottom = lowest.at[1];
    const middle = all.filter((one) => Math.abs(one.at[1] - (top + bottom) / 2) < 0.08);
    expect(middle.length).toBeGreaterThan(0);
    const mean = middle.reduce((sum, one) => sum + one.alpha, 0) / middle.length;
    expect(mean).toBeLessThan(0.6);
    geometry.dispose();
  });

  it('розводить падіння по різних клинах', () => {
    // Два водоспади на одному клині — це не два падіння, а одне подвійної
    // яскравості, за яке заплачено двічі.
    const geometry = buildPortalWaterfallGeometry(SEED, PORTAL_WATERFALLS.high);
    const angles = curtains(geometry).map((own) => {
      const head = own[1]!;
      return Math.atan2(head.at[2], head.at[0]);
    });
    for (let one = 0; one < angles.length; one += 1) {
      for (let other = one + 1; other < angles.length; other += 1) {
        // Різниця кутів у [0, π]: скільки між двома падіннями по колу.
        const gap = Math.abs(
          ((angles[one]! - angles[other]! + Math.PI * 3) % (Math.PI * 2)) - Math.PI,
        );
        expect(gap, `${one} проти ${other}`).toBeGreaterThan(0.3);
      }
    }
    geometry.dispose();
  });

  it('порожній профіль якості не малює нічого', () => {
    const empty = buildPortalWaterfallGeometry(SEED, PORTAL_WATERFALLS.fallback);
    expect(empty.getAttribute('position').count).toBe(0);
    empty.dispose();
  });

  it('два головні водоспади — СПЕРЕДУ, перед глядачем (ADR-0211)', () => {
    /*
     * ВИМОГА ВЛАСНИКА: «допрацюй водоспади, щоб вони були схожі на
     * референс». На еталоні два головні падіння — просто перед камерою.
     * Рівне коло ADR-0167 ставило їх збоку й позаду, і з головного ракурсу
     * води майже не було видно. Камера дивиться з +Z, тобто «спереду» —
     * кут π/2 у площині XZ.
     */
    const geometry = buildPortalWaterfallGeometry(SEED, PORTAL_WATERFALLS.high);
    const falls = curtains(geometry);
    for (const fall of [0, 1]) {
      const head = falls[fall]![1]!;
      const angle = Math.atan2(head.at[2], head.at[0]);
      expect(Math.abs(angle - Math.PI / 2), `падіння ${fall}`).toBeLessThan(0.7);
    }
    geometry.dispose();
  });

  it('вода біжить по плато до кромки й переходить у завісу без щілини', () => {
    const geometry = buildPortalWaterfallGeometry(SEED, PORTAL_WATERFALLS.high);
    const layout = geometry.userData.waterfallLayout as { stream: number; curtain: number }[];
    const all = vertices(geometry);
    const falls = curtains(geometry);
    let at = 0;
    for (let fall = 0; fall < layout.length; fall += 1) {
      const stream = all.slice(at, at + layout[fall]!.stream * 3);
      at += (layout[fall]!.stream + layout[fall]!.curtain) * 3;
      expect(stream.length, `потік ${fall}`).toBeGreaterThan(0);
      // Джерело — глибше на плато, ніж кромка: потік тече НАЗОВНІ.
      const radii = stream.map((one) => Math.hypot(one.at[0], one.at[2]));
      expect(Math.min(...radii)).toBeLessThan(0.7);
      // Остання ланка потоку — рівно верхній ряд завіси: жодної щілини.
      const crest = falls[fall]!.slice(0, 6).map((one) => one.at.join(','));
      const tail = new Set(stream.map((one) => one.at.join(',')));
      expect(crest.some((point) => tail.has(point)), `стик ${fall}`).toBe(true);
    }
    geometry.dispose();
  });
});
