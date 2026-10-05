import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCrystalV2Geometry, monarchProfile } from './geometry';
import { buildCrystalV2Model, type CrystalV2Snapshot } from './model';

// ============================================================
// Геометрія кристала v2 (ADR-0217).
// ------------------------------------------------------------
// Кожен тест тримає одне правило власника або цілісності кріплення:
// грані пласкі (PRODUCT.md: «не роби поверхні кривими чи шумними»),
// основи заглиблені (CAI: зрізу не видно ні збоку, ні з-під низу),
// кант лише на справжніх ребрах, і все детерміноване.
// Знімки — ті самі фікстури, що звіряє Python-двійник.
// ============================================================

const TWIN = fileURLToPath(new URL('../../../../tools/crystal_twin/fixtures/', import.meta.url));
const fixture = (name: string) => JSON.parse(readFileSync(`${TWIN}${name}.json`, 'utf8')) as CrystalV2Snapshot;

const busy = buildCrystalV2Model(fixture('busy'));
const geometry = buildCrystalV2Geometry(busy);

type V3 = [number, number, number];
const point = (array: Float32Array, v: number): V3 => [array[v * 3]!, array[v * 3 + 1]!, array[v * 3 + 2]!];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: V3): number => Math.hypot(a[0], a[1], a[2]);

describe('кристал v2: геометрія', () => {
  it('у колонії є монарх і по кристалу на кожен рік', () => {
    expect(busy.children.length).toBeGreaterThan(0);
    // Один тон на грань: три кути трикутника мають один faceTone.
    const { faceTone, triangles } = geometry.crystals;
    for (let t = 0; t < triangles; t += 1) {
      expect(faceTone[t * 3]).toBe(faceTone[t * 3 + 1]);
      expect(faceTone[t * 3]).toBe(faceTone[t * 3 + 2]);
    }
  });

  it('кожна грань ПЛАСКА: трикутники однієї грані лежать в одній площині', () => {
    const { positions, faceTone, triangles } = geometry.crystals;
    // Сусідні трикутники з тим самим тоном — дві половини однієї грані-чотирикутника.
    let pairs = 0;
    for (let t = 0; t + 1 < triangles; t += 1) {
      if (faceTone[t * 3] !== faceTone[(t + 1) * 3]) continue;
      const a = point(positions, t * 3);
      const b = point(positions, t * 3 + 1);
      const c = point(positions, t * 3 + 2);
      const n = cross(sub(b, a), sub(c, a));
      const length = norm(n);
      if (length < 1e-9) continue;
      for (let corner = 0; corner < 3; corner += 1) {
        const q = point(positions, (t + 1) * 3 + corner);
        const d = sub(q, a);
        const distance = Math.abs(n[0] * d[0] + n[1] * d[1] + n[2] * d[2]) / length;
        expect(distance).toBeLessThan(1e-4);
      }
      pairs += 1;
    }
    expect(pairs).toBeGreaterThan(20);
  });

  it('кожна грань дивиться НАЗОВНІ (регресія: закрут усередину ховав передні грані монарха)', () => {
    // Живий кадр показав монарх, крізь який видно дальню стінку й ауру сцени:
    // three відсікав передні грані як задні. Перевіряємо монарха окремо —
    // його вісь проходить через початок координат.
    const alone = buildCrystalV2Geometry({ ...busy, children: [] });
    const { positions, triangles } = alone.crystals;
    for (let t = 0; t < triangles; t += 1) {
      const a = point(positions, t * 3);
      const b = point(positions, t * 3 + 1);
      const c = point(positions, t * 3 + 2);
      const n = cross(sub(b, a), sub(c, a));
      if (norm(n) < 1e-9) continue;
      const centre: V3 = [(a[0] + b[0] + c[0]) / 3, 0, (a[2] + b[2] + c[2]) / 3];
      // Бічна грань — назовні від осі; грань вершини — ще й угору.
      expect(n[0] * centre[0] + n[2] * centre[2] + Math.max(0, n[1])).toBeGreaterThan(0);
    }
    const rocks = alone.rocks.positions;
    for (let t = 0; t < alone.rocks.triangles; t += 1) {
      const a = point(rocks, t * 3);
      const b = point(rocks, t * 3 + 1);
      const c = point(rocks, t * 3 + 2);
      const n = cross(sub(b, a), sub(c, a));
      // Верх брили дивиться вгору, низ — униз; низ — це трикутник із
      // підошвою під землею (брила тепер висока, ADR-0220).
      const top = Math.min(a[1], b[1], c[1]) >= 0;
      expect(Math.sign(n[1])).toBe(top ? 1 : -1);
    }
  });

  it('верхівка НЕ рівна (регресія: «не подобається верхівка з геометрично рівними гранями»)', () => {
    // Колишні яруси були кільцями плеча, стиснутими до осі: грані вершини
    // виходили однаковими поясами. Тепер кінчик зміщений, а грані — різні.
    const alone = buildCrystalV2Geometry({ ...busy, children: [] });
    const { positions, triangles } = alone.crystals;
    const shoulder = busy.monarch.height - busy.monarch.tierHeights.reduce((s, h) => s + h, 0);
    const areas: number[] = [];
    let apex: V3 = [0, -Infinity, 0];
    for (let t = 0; t < triangles; t += 1) {
      const a = point(positions, t * 3);
      const b = point(positions, t * 3 + 1);
      const c = point(positions, t * 3 + 2);
      for (const p of [a, b, c]) if (p[1] > apex[1]) apex = p;
      if (Math.min(a[1], b[1], c[1]) < shoulder - 1e-6) continue;
      areas.push(norm(cross(sub(b, a), sub(c, a))) / 2);
    }
    expect(areas.length).toBeGreaterThanOrEqual(6);
    expect(Math.max(...areas) / Math.min(...areas)).toBeGreaterThan(1.5);
    expect(Math.hypot(apex[0], apex[2])).toBeGreaterThan(0.02);
    expect(apex[1]).toBeCloseTo(busy.monarch.height, 5);
  });

  it('основи заглиблені в жеоду: нижня точка кожного тіла — під землею', () => {
    const { positions, rise, triangles } = geometry.crystals;
    let lowest = Infinity;
    for (let v = 0; v < triangles * 3; v += 1) lowest = Math.min(lowest, positions[v * 3 + 1]!);
    expect(lowest).toBeLessThan(0);
    // `rise` не виходить за 0…1: заглиблена частина рахується як основа.
    for (const value of rise) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('кант лише на справжніх ребрах: діагональ грані ніде не доходить до нуля', () => {
    const { edge, triangles } = geometry.crystals;
    for (let t = 0; t < triangles; t += 1) {
      for (let slot = 0; slot < 3; slot += 1) {
        const values = [0, 1, 2].map((corner) => edge[(t * 3 + corner) * 3 + slot]!);
        const suppressed = values.every((value) => value === 1);
        const real = values.filter((value) => value === 1).length === 1 && values.filter((value) => value === 0).length === 2;
        expect(suppressed || real).toBe(true);
      }
    }
  });

  it('іскри — по одній на кожну віху, у кристалі свого року', () => {
    const milestones = busy.children.reduce((sum, child) => sum + child.sparks, 0);
    expect(geometry.sparks.length).toBe(milestones * 3);
  });

  it('жеода — купа каменів, а не диск: 16 каменів по 10 трикутників', () => {
    expect(geometry.rocks.triangles).toBe(160);
    expect(geometry.reach).toBeGreaterThanOrEqual(geometry.geodeRadius);
  });

  it('детерміновано: той самий знімок дає побітово ту саму геометрію', () => {
    const again = buildCrystalV2Geometry(buildCrystalV2Model(fixture('busy')));
    expect(Array.from(again.crystals.positions)).toEqual(Array.from(geometry.crystals.positions));
    expect(Array.from(again.rocks.positions)).toEqual(Array.from(geometry.rocks.positions));
  });

  it('порожня історія теж дає кристал: час — головна валюта росту', () => {
    const empty = buildCrystalV2Geometry(buildCrystalV2Model(fixture('empty')));
    expect(empty.crystals.triangles).toBeGreaterThan(0);
    expect(empty.height).toBeGreaterThan(1.4);
    for (const value of empty.crystals.positions) expect(Number.isFinite(value)).toBe(true);
  });

  it('монарх — три кільця (ADR-0242): важка основа, ширший пояс, плече зсунуте від осі', () => {
    const profile = monarchProfile(busy.startDate);
    expect(profile.map((r) => r.at)).toEqual([0, profile[1]!.at, 1]);
    expect(profile[0]!.scale).toBeGreaterThan(0.8);
    expect(profile[1]!.scale).toBeGreaterThan(profile[0]!.scale);
    expect(profile[1]!.at).toBeGreaterThan(0.2);
    expect(profile[1]!.at).toBeLessThan(0.45);
    for (const ring of profile) for (const s of ring.shift) expect(Math.abs(s)).toBeLessThanOrEqual(0.07);
    expect(monarchProfile(busy.startDate)).toEqual(profile);
  });

  it('монарх має вдвічі більше граней стовбура, ніж кристал року: два пояси замість одного', () => {
    const sides = busy.monarch.sides.length;
    // Перші 2·sides·2 трикутники — два пояси монарха; кожен пояс — sides граней.
    const tones = new Set<number>();
    for (let t = 0; t < sides * 4; t += 1) tones.add(geometry.crystals.faceTone[t * 3]!);
    expect(tones.size).toBeGreaterThan(sides);
  });

  it('монарх — гранчастий кристал (ADR-0244): 12 поздовжніх граней і вершина у два яруси', () => {
    // Монарх — перше тіло: його трикутники йдуть до першого тіла року.
    const { positions, triangles } = geometry.crystals;
    const sides = busy.monarch.sides.length;
    const tops: number[] = [];
    let monarchTris = 0;
    for (let t = 0; t < triangles; t += 1) {
      const ys = [0, 1, 2].map((c) => positions[(t * 3 + c) * 3 + 1]!);
      if (t > 0 && Math.max(...ys) > busy.monarch.height * 1.01) break;
      tops.push(Math.max(...ys));
      monarchTris += 1;
    }
    // 2 пояси × 12 граней × 2 трикутники + 18 граней поясу вершини + кінчик.
    expect(monarchTris).toBeGreaterThanOrEqual(2 * 2 * sides * 2 + 3 * sides);
    expect(Math.max(...tops)).toBeCloseTo(busy.monarch.height, 5);
  });

  it('тон грані — один із трьох, тож сусідні грані ніколи не зливаються', () => {
    const { faceTone, triangles } = geometry.crystals;
    for (let t = 0; t < triangles; t += 1) {
      const tone = faceTone[t * 3]!;
      const nearest = [0.74, 1.0, 1.3].some((base) => tone >= base * 0.95 - 1e-6 && tone <= base * 1.05 + 1e-6);
      expect(nearest).toBe(true);
    }
  });
});

