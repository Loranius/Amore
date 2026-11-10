import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildCrystalV2Geometry, FOLD_DEG, monarchCrownHeight, monarchProfile, monarchSplits, yearHabit } from './geometry';
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

  /*
   * Ребра колонії з двома сусідами: злам між трикутниками, чи є кант, і
   * чи одна це грань (один тон). Кожне ребро — один раз.
   */
  const sharedEdges = (mesh: { positions: Float32Array; faceTone: Float32Array; edge: Float32Array; triangles: number }) => {
    const key = (p: V3) => p.map((x) => x.toFixed(5)).join(',');
    const normal = (t: number): V3 => {
      const a = point(mesh.positions, t * 3);
      const n = cross(sub(point(mesh.positions, t * 3 + 1), a), sub(point(mesh.positions, t * 3 + 2), a));
      const l = norm(n);
      return [n[0] / l, n[1] / l, n[2] / l];
    };
    const owners = new Map<string, [number, number][]>();
    for (let t = 0; t < mesh.triangles; t += 1) {
      for (let s = 0; s < 3; s += 1) {
        const a = key(point(mesh.positions, t * 3 + ((s + 1) % 3)));
        const b = key(point(mesh.positions, t * 3 + ((s + 2) % 3)));
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        owners.set(k, [...(owners.get(k) ?? []), [t, s]]);
      }
    }
    const tone = (t: number) => [0.74, 1.0, 1.3].findIndex((base) => {
      const v = mesh.faceTone[t * 3]!;
      return v >= base * 0.95 - 1e-6 && v <= base * 1.05 + 1e-6;
    });
    const out: { fold: number; rim: boolean; sameFacet: boolean; sameTone: boolean }[] = [];
    for (const list of owners.values()) {
      if (list.length !== 2) continue;
      const [[t1, s1], [t2]] = list as [[number, number], [number, number]];
      const a = normal(t1);
      const b = normal(t2);
      const fold = (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
      // Кант на ребрі навпроти кута s: у кута s+1 слот s дорівнює нулю.
      const rim = mesh.edge[(t1 * 3 + ((s1 + 1) % 3)) * 3 + s1] === 0;
      out.push({ fold, rim, sameFacet: mesh.faceTone[t1 * 3] === mesh.faceTone[t2 * 3], sameTone: tone(t1) === tone(t2) });
    }
    return out;
  };
  const FIXTURE_NAMES = ['busy', 'empty', 'gifts_red', 'leap_day'];

  it('кант лише на справжньому зламі (ADR-0258): від FOLD_DEG — кант, менше — ніколи', () => {
    // Регресія «сітки ліній»: до правки третина кантів лежала на зламах до
    // 10°, тобто на майже пласкій поверхні, і малювала паперову модель.
    for (const name of FIXTURE_NAMES) {
      const edges = sharedEdges(buildCrystalV2Geometry(buildCrystalV2Model(fixture(name))).crystals);
      for (const e of edges) {
        if (e.rim) expect(e.fold).toBeGreaterThanOrEqual(FOLD_DEG);
        if (!e.rim && !e.sameFacet) expect(e.fold).toBeLessThan(FOLD_DEG);
      }
      expect(edges.filter((e) => e.rim).length).toBeGreaterThan(100);
    }
  });

  it('одна грань — один тон, і вона майже пласка (ADR-0245, ADR-0258)', () => {
    // Два трикутники однієї грані зламані щонайбільше на поріг з невеликим
    // запасом: діагональ чотирикутника стовбура (ADR-0245, до ±2 % від прямої)
    // і злиті грані вершини (до FOLD_DEG).
    for (const name of FIXTURE_NAMES) {
      const edges = sharedEdges(buildCrystalV2Geometry(buildCrystalV2Model(fixture(name))).crystals);
      const inside = edges.filter((e) => e.sameFacet);
      expect(inside.length).toBeGreaterThan(50);
      for (const e of inside) expect(e.fold).toBeLessThan(FOLD_DEG + 2);
    }
  });

  it('сусідні грані через пологий злам — різного тону (ADR-0176, ADR-0258)', () => {
    // На пологому зламі грані розводить лише тон: світло падає на обидві
    // майже однаково. Збіг тону лишається можливим лише на крутому ребрі.
    for (const name of FIXTURE_NAMES) {
      const edges = sharedEdges(buildCrystalV2Geometry(buildCrystalV2Model(fixture(name))).crystals);
      for (const e of edges) if (!e.sameFacet && e.fold < 25) expect(e.sameTone).toBe(false);
    }
  });

  it('тіло замкнене: відкриті ребра — лише в заглибленій основі (ADR-0259, правило цілісності кріплення)', () => {
    // Огранена вершина кристала року (зірка, клини, кінчик) не лишає щілин:
    // кожне ребро вище землі ділять рівно два трикутники.
    for (const name of FIXTURE_NAMES) {
      const { positions, triangles } = buildCrystalV2Geometry(buildCrystalV2Model(fixture(name))).crystals;
      const key = (p: V3) => p.map((x) => x.toFixed(5)).join(',');
      const count = new Map<string, { n: number; y: number }>();
      for (let t = 0; t < triangles; t += 1) {
        for (let s = 0; s < 3; s += 1) {
          const a = point(positions, t * 3 + ((s + 1) % 3));
          const b = point(positions, t * 3 + ((s + 2) % 3));
          const k = key(a) < key(b) ? `${key(a)}|${key(b)}` : `${key(b)}|${key(a)}`;
          const was = count.get(k);
          count.set(k, { n: (was?.n ?? 0) + 1, y: Math.max(a[1], b[1]) });
        }
      }
      for (const { n, y } of count.values()) if (n !== 2) expect(y).toBeLessThan(0);
    }
  });

  it('вершина кристала року — огранена, а не піраміда (ADR-0259): щонайменше 8 граней, що дивляться вгору', () => {
    // Регресія: стара вершина — 5–7 граней від плеча до 1–2 точок кінчика
    // (busy), нова — 8–16 на всіх фікстурах.
    for (const name of FIXTURE_NAMES) {
      const model = buildCrystalV2Model(fixture(name));
      const monarch = buildCrystalV2Geometry({ ...model, children: [] }).crystals.triangles;
      for (const child of model.children) {
        const mesh = buildCrystalV2Geometry({ ...model, children: [{ ...child, lean: 0 }] }).crystals;
        const facets = new Set<number>();
        for (let t = monarch; t < mesh.triangles; t += 1) {
          const a = point(mesh.positions, t * 3);
          const n = cross(sub(point(mesh.positions, t * 3 + 1), a), sub(point(mesh.positions, t * 3 + 2), a));
          if (n[1] / norm(n) > 0.2) facets.add(mesh.faceTone[t * 3]!);
        }
        expect(facets.size).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it('кристали років — різного габітусу (ADR-0259): гострота вістря розходиться між роками', () => {
    // Власник, 2026-11-10: «різноманіття форм — різні нахили граней».
    const tips = Array.from({ length: 12 }, (_, k) => yearHabit(busy.startDate, `year${k}`).tip);
    expect(Math.max(...tips) - Math.min(...tips)).toBeGreaterThan(0.75 / 2);
    for (const tip of tips) {
      expect(tip).toBeGreaterThanOrEqual(0.8);
      expect(tip).toBeLessThanOrEqual(1.55);
    }
    expect(yearHabit(busy.startDate, 'year3')).toEqual(yearHabit(busy.startDate, 'year3'));
  });

  it('монарх спереду — не стовп (ADR-0258): з будь-якого боку видно ≥ 4 граней стовбура, найширша ≤ 40 %', () => {
    // Регресія: з боку сторони без додаткового ребра було видно 2–3 грані, і
    // середня займала до 66 % ширини стовбура.
    for (const name of FIXTURE_NAMES) {
      const model = buildCrystalV2Model(fixture(name));
      const mesh = buildCrystalV2Geometry({ ...model, children: [] }).crystals;
      const y = model.monarch.height * 0.5;
      for (let deg = 0; deg < 360; deg += 15) {
        const a = (deg * Math.PI) / 180;
        const view: V3 = [Math.sin(a), 0, Math.cos(a)];
        const right: V3 = [Math.cos(a), 0, -Math.sin(a)];
        const spans = new Map<number, [number, number]>();
        for (let t = 0; t < mesh.triangles; t += 1) {
          const p = [point(mesh.positions, t * 3), point(mesh.positions, t * 3 + 1), point(mesh.positions, t * 3 + 2)];
          const n = cross(sub(p[1]!, p[0]!), sub(p[2]!, p[0]!));
          if (n[0] * view[0] + n[2] * view[2] <= 0) continue;
          const xs: number[] = [];
          for (let k = 0; k < 3; k += 1) {
            const A = p[k]!;
            const B = p[(k + 1) % 3]!;
            if (A[1] === B[1] || (A[1] - y) * (B[1] - y) > 0) continue;
            const s = (y - A[1]) / (B[1] - A[1]);
            xs.push((A[0] + (B[0] - A[0]) * s) * right[0] + (A[2] + (B[2] - A[2]) * s) * right[2]);
          }
          if (xs.length < 2) continue;
          const facet = mesh.faceTone[t * 3]!;
          const was = spans.get(facet);
          spans.set(facet, [Math.min(was?.[0] ?? Infinity, ...xs), Math.max(was?.[1] ?? -Infinity, ...xs)]);
        }
        const widths = [...spans.values()].map(([lo, hi]) => hi - lo);
        const total = widths.reduce((sum, w) => sum + w, 0);
        expect(widths.filter((w) => w / total > 0.06).length).toBeGreaterThanOrEqual(4);
        expect(Math.max(...widths) / total).toBeLessThanOrEqual(0.4);
      }
    }
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

  it('монарх — гранчастий кристал (ADR-0244, ADR-0245, ADR-0247): стовбур у три пояси, корона самоцвіта', () => {
    const alone = buildCrystalV2Geometry({ ...busy, children: [] });
    const sides = busy.monarch.sides.length;
    const splits = monarchSplits(busy.startDate, busy.monarch.sides).filter(Boolean).length;
    // Ребро на кожній стороні (ADR-0258): інакше з боку сторони без ребра
    // монарх читався стовпом.
    expect(splits).toBe(sides);
    // Стовбур: 3 пояси × грані × 2 трикутники. Корона: плечі (2 на сторону,
    // 3 де є ребро), зірка (2 на сторону), промені до кільця (сторона + крок
    // кільця) і вістря (крок кільця). Кільце — плани + 2.
    const ring = busy.monarch.tiers + 2;
    const crown = 2 * sides + splits + 2 * sides + sides + ring + ring;
    expect(alone.crystals.triangles).toBe(3 * (sides + splits) * 2 + crown);
  });

  describe('корона самоцвіта (ADR-0247)', () => {
    const FIXTURES = ['busy', 'empty', 'gifts_red', 'leap_day'];
    const monarchOf = (name: string) => {
      const model = buildCrystalV2Model(fixture(name));
      const { positions } = buildCrystalV2Geometry({ ...model, children: [] }).crystals;
      const pts: V3[] = [];
      for (let v = 0; v < positions.length / 3; v += 1) pts.push(point(positions, v));
      const m = model.monarch;
      const crown = monarchCrownHeight(m.height, m.tierHeights.reduce((sum, h) => sum + h, 0));
      const profile = monarchProfile(model.startDate);
      const last = profile[profile.length - 1]!;
      const radius = Math.max(...m.sides.map((side) => side[1]));
      const axis: [number, number] = [last.shift[0] * radius, last.shift[1] * radius];
      return { model, pts, crown, R: radius * last.scale, axis };
    };

    it('кристал не вищий: вістря — на висоті моделі, корона — 20…30 % висоти', () => {
      for (const name of FIXTURES) {
        const { model, pts, crown } = monarchOf(name);
        expect(Math.max(...pts.map((p) => p[1]))).toBeCloseTo(model.monarch.height, 5);
        expect(crown / model.monarch.height).toBeGreaterThanOrEqual(0.2 - 1e-9);
        expect(crown / model.monarch.height).toBeLessThanOrEqual(0.3 + 1e-9);
      }
    });

    it('шов корони — не рівна лінія: кути призми врізаються в тіло на різну глибину', () => {
      for (const name of FIXTURES) {
        const { model, pts, crown } = monarchOf(name);
        const y1 = model.monarch.height - crown;
        // Верхнє кільце стовбура: від найглибшого клина до плечей корони (≥ 0.12).
        const seam = pts.filter((p) => p[1] > y1 - crown * 0.3 && p[1] < y1 + crown * 0.11);
        const heights = seam.map((p) => p[1]);
        expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(crown * 0.1);
      }
    });

    it('широкі плечі й опуклий профіль: радіус корони спадає дедалі швидше до вістря', () => {
      for (const name of FIXTURES) {
        const { model, pts, crown, R, axis } = monarchOf(name);
        const y1 = model.monarch.height - crown;
        const reachAt = (from: number, to: number) => Math.max(...pts
          .filter((p) => p[1] > y1 + crown * from && p[1] <= y1 + crown * to)
          .map((p) => Math.hypot(p[0] - axis[0], p[2] - axis[1])));
        const shoulders = reachAt(0.1, 0.22);
        const star = reachAt(0.45, 0.66);
        const ring = reachAt(0.8, 0.9);
        // Плечі майже на всю ширину тіла — не ковпак, звужений одразу.
        expect(shoulders).toBeGreaterThan(R * 0.85);
        // Опуклість: на другій половині корони радіус падає швидше, ніж на першій.
        expect((star - ring) / 0.3).toBeGreaterThan((shoulders - star) / 0.4);
        // Вістря гостре, але не голка: кільце під ним — п'ята частина радіуса.
        expect(ring).toBeGreaterThan(R * 0.15);
        expect(ring).toBeLessThan(R * 0.3);
      }
    });

    it('корона коштує мало: щонайбільше 2·сторони + 6 трикутників понад колишню', () => {
      for (const name of FIXTURES) {
        const model = buildCrystalV2Model(fixture(name));
        const sides = model.monarch.sides.length;
        const splits = monarchSplits(model.startDate, model.monarch.sides).filter(Boolean).length;
        const ridge = model.monarch.tiers;
        // Колишня вершина: пояс (2 на сторону + ребра), промені й вістря.
        const before = 2 * sides + splits + (ridge < 2 ? sides : sides + 2 * ridge);
        const triangles = buildCrystalV2Geometry({ ...model, children: [] }).crystals.triangles - 6 * (sides + splits);
        expect(triangles - before).toBeLessThanOrEqual(2 * sides + 6);
      }
    });
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

