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

  it('облягає породу: радіус звужується разом із коренем', () => {
    /*
     * Це і є гарантія проти прямої стрічки. Корінь острова звужується
     * донизу, тож вода, що по ньому тече, мусить звужуватись разом із
     * ним; стрічка, пущена рівно вниз, тримала б сталий радіус.
     *
     * Порівнюються верхня й нижня третини кожного падіння окремо — по
     * одному клину, бо радіус острова залежить від кута.
     */
    const geometry = buildPortalWaterfallGeometry(SEED, PORTAL_WATERFALLS.high);
    const all = vertices(geometry);
    const perFall = all.length / PORTAL_WATERFALLS.high;
    for (let fall = 0; fall < PORTAL_WATERFALLS.high; fall += 1) {
      const own = all.slice(fall * perFall, (fall + 1) * perFall);
      const sorted = [...own].sort((a, b) => b.at[1] - a.at[1]);
      const radius = (list: typeof own) =>
        list.reduce((sum, one) => sum + Math.hypot(one.at[0], one.at[2]), 0) / list.length;
      const head = radius(sorted.slice(0, Math.floor(perFall / 3)));
      const tail = radius(sorted.slice(-Math.floor(perFall / 3)));
      expect(head, `падіння ${fall}`).toBeGreaterThan(tail * 1.15);
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
    const all = vertices(geometry);
    const lowest = all.reduce((deep, one) => (one.at[1] < deep.at[1] ? one : deep), all[0]!);
    expect(lowest.alpha).toBeLessThan(0.02);
    const highest = all.reduce((high, one) => (one.at[1] > high.at[1] ? one : high), all[0]!);
    expect(highest.alpha).toBeGreaterThan(0.9);
    /*
     * І на половині глибини вода вже помітно слабша: рівне згасання
     * лишало під островом сірий стовп пари.
     */
    const top = highest.at[1];
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
    const all = vertices(geometry);
    const perFall = all.length / PORTAL_WATERFALLS.high;
    const angles: number[] = [];
    for (let fall = 0; fall < PORTAL_WATERFALLS.high; fall += 1) {
      const head = all[fall * perFall]!;
      angles.push(Math.atan2(head.at[2], head.at[0]));
    }
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
});
