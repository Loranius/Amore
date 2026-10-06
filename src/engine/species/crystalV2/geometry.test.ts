import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCrystalV2Geometry, monarchProfile, monarchSplits } from './geometry';
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

  it('грані пласкі (ADR-0245): трикутник — пласкі за побудовою; пара одного тону зламана менше ніж на 10°', () => {
    // Стовбур ламається на площини, але грань не стає кривою: два трикутники
    // з одним тоном — одна грань із легким зламом, решта — окремі грані.
    const { positions, faceTone, triangles } = geometry.crystals;
    let pairs = 0;
    for (let t = 0; t + 1 < triangles; t += 1) {
      if (faceTone[t * 3] !== faceTone[(t + 1) * 3]) continue;
      const tri = (k: number): [V3, V3, V3] => [point(positions, k * 3), point(positions, k * 3 + 1), point(positions, k * 3 + 2)];
      const na = cross(sub(tri(t)[1], tri(t)[0]), sub(tri(t)[2], tri(t)[0]));
      const nb = cross(sub(tri(t + 1)[1], tri(t + 1)[0]), sub(tri(t + 1)[2], tri(t + 1)[0]));
      const cos = Math.abs(na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2]) / (norm(na) * norm(nb));
      expect((Math.acos(Math.min(1, cos)) * 180) / Math.PI).toBeLessThan(10);
      pairs += 1;
    }
    expect(pairs).toBeGreaterThan(5);
  });

  it('бічні грані різної довжини: межі граней на багатьох висотах (ADR-0245, еталон low_poly_dirt_crystals)', () => {
    // Еталон: вершини кристала на 9–17 висотах. Рівна смуга дала б 2–4.
    for (const name of ['busy', 'empty']) {
      const model = buildCrystalV2Model(fixture(name));
      const { positions } = buildCrystalV2Geometry({ ...model, children: [] }).crystals;
      const shoulder = model.monarch.height - model.monarch.tierHeights.reduce((sum, h) => sum + h, 0);
      const heights = new Set<string>();
      for (let v = 0; v < positions.length / 3; v += 1) {
        const y = positions[v * 3 + 1]!;
        if (y > 0 && y < shoulder) heights.add(y.toFixed(4));
      }
      expect(heights.size).toBeGreaterThanOrEqual(12);
    }
  });

  it('бік монарха прямий — без дуги й бочки (власник, 2026-10-06)', () => {
    // Кожна вершина стовбура — не далі від осі, ніж пряма від основи до плеча
    // на тій самій висоті, плюс 4 % радіуса (злам грані ±2 %, ребро ±3 %).
    for (const name of ['busy', 'empty', 'gifts_red', 'leap_day']) {
      const model = buildCrystalV2Model(fixture(name));
      const { positions } = buildCrystalV2Geometry({ ...model, children: [] }).crystals;
      const m = model.monarch;
      const radius = Math.max(...m.sides.map((side) => side[1]));
      const bury = 0.12 * m.height;
      const shoulder = m.height - m.tierHeights.reduce((sum, h) => sum + h, 0);
      const profile = monarchProfile(model.startDate);
      const foot = profile[0]!;
      const top = profile[profile.length - 1]!;
      for (let v = 0; v < positions.length / 3; v += 1) {
        const [x, y, z] = point(positions, v);
        if (y < -bury + 1e-6 || y > shoulder - 0.08 * (shoulder + bury)) continue;
        const t = (y + bury) / (shoulder + bury);
        const ax = (foot.shift[0] + (top.shift[0] - foot.shift[0]) * t) * radius;
        const az = (foot.shift[1] + (top.shift[1] - foot.shift[1]) * t) * radius;
        const line = (foot.scale + (top.scale - foot.scale) * t) * radius * 1.05 * 1.03;
        expect(Math.hypot(x - ax, z - az)).toBeLessThan(line * 1.04);
      }
    }
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

  it('монарх — профіль (ADR-0242, ADR-0245): важка основа, ширший пояс, плече зсунуте від осі', () => {
    const profile = monarchProfile(busy.startDate);
    // Чотири кільця (ADR-0245): основа, пояс, верхній злам, плече.
    expect(profile.map((r) => r.at)).toEqual([0, profile[1]!.at, profile[2]!.at, 1]);
    expect(profile[2]!.at).toBeGreaterThan(profile[1]!.at);
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

  it('монарх — гранчастий кристал (ADR-0244, ADR-0245): широкі й вузькі грані у три пояси, вершина у два яруси', () => {
    const alone = buildCrystalV2Geometry({ ...busy, children: [] });
    const { positions, triangles } = alone.crystals;
    const tip = busy.monarch.tierHeights.reduce((sum, h) => sum + h, 0);
    // Плече ламається на різній висоті (±6 % проміжку), пояс вершини — над ним
    // щонайменше на 0.4 кінчика: поріг посередині їх розділяє.
    const threshold = busy.monarch.height - tip * 0.75;
    let shaft = 0;
    let belt = 0;
    let crown = 0;
    let top = -Infinity;
    for (let t = 0; t < triangles; t += 1) {
      const ys = [0, 1, 2].map((c) => positions[(t * 3 + c) * 3 + 1]!);
      top = Math.max(top, ...ys);
      if (Math.max(...ys) < threshold) shaft += 1;
      else if (Math.min(...ys) < threshold) belt += 1;
      else crown += 1;
    }
    const sides = busy.monarch.sides.length;
    const splits = monarchSplits(busy.startDate, busy.monarch.sides).filter(Boolean).length;
    expect(splits).toBeGreaterThanOrEqual(2);
    expect(splits).toBeLessThan(sides);
    expect(shaft).toBe(3 * (sides + splits) * 2); // 3 пояси × грані × 2 трикутники
    expect(belt).toBe(2 * sides + splits); // пояс вершини: 2 грані на сторону, 3 — де є ребро
    expect(crown).toBeGreaterThanOrEqual(sides);
    expect(top).toBeCloseTo(busy.monarch.height, 5);
  });

  it('тон грані — один із трьох, тож сусідні грані ніколи не зливаються', () => {
    const { faceTone, triangles } = geometry.crystals;
    for (let t = 0; t < triangles; t += 1) {
      const tone = faceTone[t * 3]!;
      const nearest = [0.74, 1.0, 1.3].some((base) => tone >= base * 0.95 - 1e-6 && tone <= base * 1.05 + 1e-6);
      expect(nearest).toBe(true);
    }
  });

  it('вістря монарха дивиться прямо вгору: точки під ним — рівне кільце навколо осі вістря', () => {
    for (const name of ['busy', 'empty', 'gifts_red', 'leap_day']) {
      const model = buildCrystalV2Model(fixture(name));
      const { positions } = buildCrystalV2Geometry({ ...model, children: [] }).crystals;
      const pts: V3[] = [];
      for (let v = 0; v < positions.length / 3; v += 1) pts.push(point(positions, v));
      const top = pts.reduce((best, p) => (p[1] > best[1] ? p : best));
      expect(top[1]).toBeCloseTo(model.monarch.height, 5);
      // Найближчий нижчий ярус вершин під вістрям: та сама висота й той
      // самий відступ від осі вістря — інакше вістря косить убік.
      const below = [...new Set(pts.filter((p) => p[1] < top[1] - 1e-6).map((p) => p[1].toFixed(6)))].map(Number).sort((a, b) => b - a)[0]!;
      const ring = pts.filter((p) => Math.abs(p[1] - below) < 1e-6);
      const reach = ring.map((p) => Math.hypot(p[0] - top[0], p[2] - top[2]));
      expect(Math.max(...reach) - Math.min(...reach)).toBeLessThan(1e-5);
      expect(Math.min(...reach)).toBeGreaterThan(0);
    }
  });
});

