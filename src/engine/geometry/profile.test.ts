import { describe, expect, it } from 'vitest';
import type { GrowthBody } from '../growth';
import type { CrystalFacePlane } from './types';
import { add, orthonormalBasis, scale } from '../growth/math';
import { buildCrystalMesh, splitCrystalMeshFaces } from './mesh';
import { intersectHalfSpaces, polytopeTolerance } from './polytope';
import { buildCrystalFacePlanes } from './planes';
import { crystalHabitShape } from './habit';
import { buildCrystalProfile } from './profile';
import { pointInsideCrystalSolid } from './trim';

function crystalBody(overrides: Partial<GrowthBody> = {}): GrowthBody {
  return {
    id: 'crystal-body-1',
    instructionId: 'instruction-1',
    sourceId: 'event-1',
    species: 'crystal',
    kind: 'crystal:formation',
    tier: 'support',
    attributes: {
      formationKind: 'event',
      archetype: 'blade',
    },
    sequence: 1,
    colonyId: 'colony-1',
    epochIndex: 1,
    seed: 1_234_567,
    emphasized: false,
    generation: 1,
    hostBodyId: 'crystal-host-1',
    attachment: {
      siteKey: 'site-1',
      surfaceRegionId: 'region-1',
      hostBodyId: 'crystal-host-1',
      hostT: 0.34,
      hostAngleRad: 0.72,
      point: { x: 0.1, y: 0.2, z: -0.1 },
      normal: { x: 0, y: 1, z: 0 },
      burialDepth: 0.22,
    },
    anchor: { x: 0.25, y: 0.1, z: -0.18 },
    direction: { x: 0, y: 1, z: 0 },
    skeletonLength: 1.8,
    skeletonRadius: 0.24,
    surfaceRadiusScale: 0.82,
    renderedLength: 1.64,
    renderedRadius: 0.21,
    maturity: 0.78,
    growthEnergy: 0.66,
    competition: 0.18,
    crowding: 0.12,
    growthCenterId: 'center-1',
    growthCenterRole: 'dominant',
    ...overrides,
  };
}

function motherBody(): GrowthBody {
  return crystalBody({
    id: 'mother',
    kind: 'crystal:mother',
    tier: 'king',
    attributes: { formationKind: 'mother', archetype: 'massive' },
    generation: 0,
    hostBodyId: null,
    attachment: null,
    growthCenterRole: 'dominant',
  });
}

describe('Crystal organic profile phase 3a', () => {
  it('publishes a deterministic solid with lean, burial metadata and an envelope', () => {
    const body = crystalBody();
    const first = buildCrystalProfile(body, 'high');
    const repeated = buildCrystalProfile(body, 'high');

    expect(repeated).toEqual(first);
    expect(Math.abs(first.axisLeanX) + Math.abs(first.axisLeanZ)).toBeGreaterThan(0);
    expect(first.burialStartY).toBe(first.extraSink);
    expect(first.burialCompression).toBeGreaterThanOrEqual(0.62);
    expect(first.burialCompression).toBeLessThanOrEqual(0.76);

    // Twist is published as zero and no longer earned (ADR-0006). It is the one
    // thing the plane model gave up: a twist rotates every height by a
    // different angle, which is not an affine map of the solid, so it bends a
    // flat face into a helicoid — and a helicoid can only be drawn as triangles
    // that disagree about their normal. That is the mosaic. The crystal's
    // asymmetry now comes from its faces being unequal instead.
    expect(first.twistTotal).toBe(0);
    expect(first.rows.every((row) => row.rotation === 0)).toBe(true);
    expect(first.rows.every((row) => row.facetPhase === 0)).toBe(true);

    // The cut set is the shape; the rows only report it.
    const planes = first.planes!;
    expect(planes.length).toBeGreaterThan(6);
    expect(planes.filter((plane) => plane.kind === 'base')).toHaveLength(1);
    expect(planes.filter((plane) => plane.kind === 'prism').length).toBeGreaterThanOrEqual(5);
    expect(planes.filter((plane) => plane.kind === 'crown').length).toBeGreaterThanOrEqual(4);
    for (const plane of planes) {
      // Unit to within `round6` on each component, which is what the published
      // state can carry.
      expect(Math.hypot(plane.normal.x, plane.normal.y, plane.normal.z)).toBeCloseTo(1, 5);
      expect(Number.isFinite(plane.offset)).toBe(true);
    }

    for (const row of first.rows) {
      expect(row.radius).toBeGreaterThan(0);
      expect(row.radiusX).toBeGreaterThan(0);
      expect(row.radiusZ).toBeGreaterThan(0);
      expect([
        row.y,
        row.radius,
        row.radiusX,
        row.radiusZ,
        row.centerOffsetX,
        row.centerOffsetZ,
        row.rotation,
        row.facetPhase,
      ].every(Number.isFinite)).toBe(true);
    }
  });

  it('keeps the published envelope outside the solid it describes', () => {
    // `rows` stopped being the recipe and became a report (ADR-0006), and the
    // one thing a report must not do is understate. Everything downstream that
    // still reads rows — the trim's occupancy test above all — treats them as
    // "the body is at most this wide here", so an envelope that cut inside the
    // crystal would let the trim delete triangles that are genuinely visible.
    // Монарх у кожному з чотирьох габітусів плюс дитина: обхват габітусу
    // змінює радіус, на якому тіло ріжеться, а звіт мусить містити тіло
    // за будь-якого обхвату.
    const bodies = [
      ...(['prismatic', 'massive', 'needle', 'tabular'] as const).map((habit) => ({
        ...motherBody(),
        attributes: { formationKind: 'mother', archetype: habit },
      })),
      crystalBody(),
    ];
    for (const body of bodies) {
      for (let seed = 1; seed <= 8; seed += 1) {
        const shaped = { ...body, seed: seed * 3571 };
        const profile = buildCrystalProfile(shaped, 'high');
        const polytope = intersectHalfSpaces(
          profile.planes!,
          // Радіус різу, а не радіус тіла — див. `cutRadius`.
          polytopeTolerance(profile.cutRadius ?? shaped.renderedRadius),
        )!;
        const rows = profile.rows;

        for (const vertex of polytope.vertices) {
          // The row at or above this vertex's height is the one that has to
          // contain it.
          const row = rows.find((candidate) => candidate.y >= vertex.y - 1e-6) ?? rows[rows.length - 1]!;
          const previous = rows[Math.max(0, rows.indexOf(row) - 1)]!;
          const widestX = Math.max(row.radiusX, previous.radiusX);
          const widestZ = Math.max(row.radiusZ, previous.radiusZ);
          expect(Math.abs(vertex.x)).toBeLessThanOrEqual(widestX + 1e-6);
          expect(Math.abs(vertex.z)).toBeLessThanOrEqual(widestZ + 1e-6);
        }
      }
    }
  });

  it('draws the crystal at the same tolerance its envelope was measured at', () => {
    /*
     * ЧЕСНО ПРО МЕЖУ ЦЬОГО ТЕСТУ.
     *
     * `polytopeTolerance` зведено в одне місце з причини, записаної в
     * ньому ж: профіль і сітка розв'язують ОДИН многогранник, тож
     * оболонка, зміряна на одному допуску й намальована на іншому,
     * перестає містити тіло. Доти рівність трималась сама — обидва
     * брали `body.renderedRadius`. Обхват габітусу її розірвав: тупа
     * форма ріжеться на 1.22 радіуса, голка на 0.64. Тому профіль тепер
     * публікує `cutRadius`, а `mesh.ts` бере його.
     *
     * Але я це ВИМІРЯВ, перш ніж називати вадою, і виміряне каже інше:
     * на 3 600 тілах (4 габітуси × 300 зерен × 3 довжини) розв'язок із
     * допуском від радіуса тіла й розв'язок із допуском від радіуса
     * різу збіглися ДО ОСТАННЬОГО БІТА — 0 розбіжностей, максимальне
     * відхилення координати 0. Поріг злиття кутів (`radius × CORNER_MERGE`)
     * лежить на порядки нижче за реальні відстані між вершинами, тож
     * зміна його на третину не зливає інший набір.
     *
     * Отже це виправлення ІНВАРІАНТА, а не полагоджений баг, і рядок про
     * кількість вершин нижче сьогодні не ловить нічого: поверніть
     * `mesh.ts` на радіус тіла — тест і далі пройде. Він стоїть як
     * сторож на майбутнє, коли габітуси розійдуться сильніше.
     *
     * А ось що ловить по-справжньому — перевірка самого `cutRadius`:
     * прибрати множник обхвату, і три габітуси з чотирьох упадуть.
     */
    for (const habit of ['prismatic', 'massive', 'needle', 'tabular'] as const) {
      const body = {
        ...motherBody(),
        attributes: { formationKind: 'mother', archetype: habit },
      };
      const profile = buildCrystalProfile(body, 'high');
      const shape = crystalHabitShape(habit);

      // Радіус різу — це радіус тіла, помножений на обхват форми, і ніщо
      // інше: якби сюди просочилась висота, габітус робив би пару старшою.
      expect(profile.cutRadius)
        .toBeCloseTo(body.renderedRadius * shape.girth, 6);

      const solved = intersectHalfSpaces(
        profile.planes!,
        polytopeTolerance(profile.cutRadius!),
      )!;
      const mesh = buildCrystalMesh(body, 'high');
      expect(mesh.positions.length / 3).toBe(solved.vertices.length);
    }
  });

  it('keeps the mother silhouette visibly organic even at low LOD', () => {
    const mother = motherBody();
    const profile = buildCrystalProfile(mother, 'low');
    const leanMagnitude = Math.hypot(profile.axisLeanX, profile.axisLeanZ);

    /*
     * Габітус монарха БІЛЬШЕ НЕ ЗАБЕТОНОВАНИЙ.
     *
     * Тут стояло `toBe('prismatic')` — і воно проходило не тому, що
     * фікстура просила призму (вона просить `massive`), а тому, що
     * профіль перезаписував габітус монарха рядком
     * `mother ? 'prismatic' : sourceArchetype`. Тобто в кожної пари
     * світу монарх мав одну форму.
     *
     * Тепер форму дає дата початку, і профіль її поважає.
     */
    expect(profile.archetype).toBe('massive');
    expect(profile.burialStartY).toBe(0);
    expect(profile.burialCompression).toBe(1);
    // Lean ceiling dropped from 0.26 to 0.09 of the radius (2026-08-03): the
    // monarch is the colony's axis and has to read as near-vertical. It still
    // leans — a perfectly upright crystal reads as placed rather than grown.
    expect(leanMagnitude).toBeGreaterThan(0);
    const shape = crystalHabitShape('massive');
    expect(leanMagnitude)
      .toBeLessThanOrEqual(mother.renderedRadius * shape.girth * shape.lean);
    /*
     * Переріз береться з габітусу, а не з константи.
     *
     * Тут стояло `toBe(0.94)` / `toBe(1.06)` — числа призми, вбиті в
     * тест. Вони проходили рівно з тієї ж причини, що й `'prismatic'`
     * вище: профіль стирав габітус монарха. Форма тіла — це властивість
     * пари, тож і тест питає таблицю форм, а не пам'ять автора.
     *
     * Сам по собі рядок нижче нічого не стереже — він переказує
     * таблицю. Стереже його сусід, `each habit gives the monarch its own
     * body`: там усі чотири габітуси мусять дати ЧОТИРИ різні перерізи.
     * Разом вони кажуть «монарх бере переріз саме зі своєї форми».
     */
    expect({ x: profile.scaleX, z: profile.scaleZ })
      .toEqual({ x: shape.scaleX, z: shape.scaleZ });
    // І він лишається органічним: коло читалось би точеним циліндром.
    expect(profile.scaleX).not.toBe(profile.scaleZ);
    // Low LOD spends fewer crown planes and no bevels, but it must still be the
    // same crystal: the habit is semantics (ADR-0004), not detail.
    const planes = profile.planes!;
    expect(planes.filter((plane) => plane.kind === 'bevel')).toHaveLength(0);
    expect(planes.filter((plane) => plane.kind === 'prism').length)
      .toBe(buildCrystalProfile(mother, 'high').planes!.filter((plane) => plane.kind === 'prism').length);
  });

  it('gives each habit the monarch its own body, and never its own age', () => {
    /*
     * Прохання власника було буквальне: «кристал має мати різні форми —
     * гострокінечний, або такий тупий, як зараз, або ще якийсь третій,
     * щоб у кожної пари було більше варіацій». Цей тест і є та вимога,
     * записана числами.
     *
     * Чотири габітуси мусять дати чотири РІЗНІ тіла — і різнитись саме
     * тим, чим форма має право різнити: перерізом, обхватом, кутом
     * корони. Мутація «повертати PRISMATIC на будь-яке ім'я» валить
     * перші три перевірки.
     */
    const habits = ['prismatic', 'massive', 'needle', 'tabular'] as const;
    const profiles = habits.map((habit) => buildCrystalProfile(
      { ...motherBody(), attributes: { formationKind: 'mother', archetype: habit } },
      'high',
    ));

    // Переріз: чотири імені — чотири різні пари (X, Z).
    const sections = new Set(profiles.map((profile) => `${profile.scaleX}:${profile.scaleZ}`));
    expect(sections.size).toBe(habits.length);

    // Обхват: найтовща форма мусить бути помітно товщою за найтоншу, а
    // не на відсоток. Виміряно: голка 0.64 проти плити 1.3 — рівно 2.03
    // раза, і саме це видно з іншого кінця кімнати.
    const widest = (profile: typeof profiles[number]): number => Math.max(
      ...profile.rows.map((row) => Math.max(row.radiusX, row.radiusZ)),
    );
    const widths = profiles.map(widest);
    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(1.6);

    /*
     * А ось ВИСОТА мусить лишитись однаковою до знака.
     *
     * Це не косметика, а межа між двома законами: висота монарха — це
     * роки пари (ADR-0004), і форма, взята з дати початку, не сміє
     * робити пару старшою. Якби габітус чіпав `geometryLength`, дві
     * пари з однаковим стажем мали б різний вік на вигляд.
     */
    const heights = new Set(profiles.map((profile) => profile.geometryLength));
    expect(heights.size).toBe(1);
  });

  it('keeps the facet count off the level-of-detail knob', () => {
    // ADR-0004 made facets data: the monarch earns them with the couple's
    // photos. Reducing them on a weaker phone would show the same couple a
    // differently shaped crystal, which is the same defect the device body
    // cap had.
    const body = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 13 } };
    const counts = (['high', 'medium', 'low'] as const)
      .map((lod) => buildCrystalProfile(body, lod).ring!.length);

    expect(new Set(counts).size).toBe(1);
  });

  it('spends earned facets on chamfers rather than on more sides', () => {
    // Semantic change (2026-08-03): earning facets used to add sides, up to 24
    // of them, and every face came out narrow. Visual review called the result
    // a "pink obelisk" — narrow faces read as noise, not as a cut stone. The
    // main faces are fixed at six or seven now, and everything earned beyond
    // them cuts one specific edge instead.
    const ringFor = (facetCount: number) => buildCrystalProfile(
      { ...motherBody(), attributes: { ...motherBody().attributes, facetCount } },
      'high',
    ).ring!;

    for (const facetCount of [6, 9, 13, 24]) {
      const ring = ringFor(facetCount);
      const main = ring.filter((facet) => !facet.chamfer);
      expect(main.length).toBeGreaterThanOrEqual(6);
      expect(main.length).toBeLessThanOrEqual(7);
    }

    // More photos still make a richer crystal — just not a narrower one.
    expect(ringFor(13).filter((f) => f.chamfer).length)
      .toBeGreaterThan(ringFor(6).filter((f) => f.chamfer).length);
    // And the richness has a ceiling, so a couple with thousands of photos
    // still has a prism.
    expect(ringFor(500).filter((f) => f.chamfer).length).toBeLessThanOrEqual(12);
  });

  it('refuses a facet count that would not close into a solid', () => {
    const tooFew = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 1 } };
    const tooMany = { ...motherBody(), attributes: { ...motherBody().attributes, facetCount: 500 } };

    expect(buildCrystalProfile(tooFew, 'high').segments).toBeGreaterThanOrEqual(4);
    expect(buildCrystalProfile(tooMany, 'high').segments).toBeLessThanOrEqual(24);
  });

  it('builds the monarch as a prism with a shoulder, not as a bullet', () => {
    // Semantic change (2026-08-03, reference pass): the monarch used to be
    // widest at 12% of its height and taper from there. That is a bullet — and
    // it is why the owner still read it as "a ball sticking out of the ground"
    // after the faceting pass: no amount of facets rescues a silhouette with no
    // straight run and no corner in it.
    //
    // The reference crystals are narrower at the base, swell gently up the
    // shaft, and break at a shoulder into a short sharp termination. That
    // shoulder is the widest point and it sits high.
    //
    // Measured on radiusX, the actual rendered ellipse radius. `row.radius` is
    // the conservative trim envelope — it folds in the axis-lean offset, which
    // grows up the body, so it is not a silhouette measurement.
    const profile = buildCrystalProfile(motherBody(), 'high');
    const rows = profile.rows;
    const top = rows[rows.length - 1]!.y;
    const widestIndex = rows.reduce(
      (best, row, index) => (row.radiusX > rows[best]!.radiusX ? index : best),
      0,
    );
    const widest = rows[widestIndex]!.radiusX;

    // The shoulder sits where a quartz termination begins.
    //
    // The ceiling moved 0.82 → 0.84 when the crown angle became the lattice's
    // own 51.78° instead of a 42–54° band the aspect ratio was clamped into.
    // That is arithmetic, not drift: a face at 51.78° drops `radius · tan` to
    // the shaft, so the termination is 8% shorter than the 54° it always used
    // to be clamped to, and a shorter termination starts higher. On this body
    // the shoulder moved 0.8195 → 0.8216.
    expect(rows[widestIndex]!.y / top).toBeGreaterThanOrEqual(0.6);
    expect(rows[widestIndex]!.y / top).toBeLessThanOrEqual(0.84);

    const radiusNear = (fraction: number): number => {
      const targetY = top * fraction;
      return rows.reduce(
        (best, row) => (
          Math.abs(row.y - targetY) < Math.abs(best.y - targetY) ? row : best
        ),
        rows[0]!,
      ).radiusX;
    };

    // Narrower at the base, but only just: the radius is nearly stable up the
    // shaft so the sides read as parallel and the shoulder is the only place
    // the silhouette turns a corner.
    // ADR-0019 deepened the taper for the gem silhouette: the brief puts the
    // root at 62–75% of the widest slice, against the 80–95% a quartz rod had.
    expect(radiusNear(0)).toBeLessThan(widest * 0.85);
    expect(radiusNear(0)).toBeGreaterThan(widest * 0.6);

    // And the termination is short and decisive rather than a long fade.
    expect(radiusNear(1)).toBeLessThan(widest * 0.1);
  });

  it('gives each crystal its own crown instead of one stamped shape', () => {
    // Shoulder height varies per body, so a colony does not read as one model
    // placed several times — and it varies within a band, so a crystal never
    // becomes a spike or a dome.
    //
    // The shoulder is measured off the published envelope, which since
    // ADR-0006 is sampled at the solid's own vertex heights and so reports the
    // silhouette exactly rather than at a fixed grid.
    // Пробігом по всіх чотирьох габітусах, а не по одному: «своя корона»
    // має бути правдою в кожній формі, і саме тут ховалась би вада
    // «одна форма розсипає силует, решта штампує».
    for (const habit of ['prismatic', 'massive', 'needle', 'tabular'] as const) {
    const shoulders = new Set<number>();

    for (let seed = 1; seed <= 40; seed += 1) {
      const profile = buildCrystalProfile({
        ...motherBody(),
        attributes: { formationKind: 'mother', archetype: habit },
        seed: seed * 7919,
      }, 'high');
      const rows = profile.rows;
      const top = rows[rows.length - 1]!.y;
      const widestIndex = rows.reduce(
        (best, row, index) => (row.radiusX > rows[best]!.radiusX ? index : best),
        0,
      );
      const share = rows[widestIndex]!.y / top;

      // Every crystal keeps a real shoulder, high on the body. The ceiling
      // moved 0.90 → 0.92 with the lattice crown angle, for the same reason as
      // in the test above: a termination 8% shorter starts 8% further up. The
      // worst seed of the forty here went 0.8994 → 0.9063.
      expect(share).toBeGreaterThanOrEqual(0.5);
      expect(share).toBeLessThanOrEqual(0.92);
      shoulders.add(Math.round(share * 100));

      // Below the shoulder the body only widens, above it only narrows. That is
      // what makes the silhouette a prism with a corner in it rather than a
      // bullet or a barrel — and it was not true while the crown planes were
      // built from an inverted angle, which put the widest slice at the base on
      // half of all seeds.
      // Tolerance is a fraction of the body, not float noise: the envelope
      // measures the furthest point from the axis, and the crystal leans, so
      // the far side of a narrowing termination can still drift outward by a
      // fraction of a percent. A bullet or a barrel misses by tens of percent.
      const slack = rows[widestIndex]!.radiusX * 0.02;
      for (let index = 1; index <= widestIndex; index += 1) {
        expect(rows[index]!.radiusX).toBeGreaterThanOrEqual(rows[index - 1]!.radiusX - slack);
      }
      for (let index = widestIndex + 1; index < rows.length; index += 1) {
        expect(rows[index]!.radiusX).toBeLessThanOrEqual(rows[index - 1]!.radiusX + slack);
      }
    }

    /*
     * Вісім різних висот плеча на сорок зерен — щонайменше.
     *
     * Поріг був `> 10` і впав на габітусі `massive`: 9 сегментів проти
     * 12 у призми, 16 у голки, 14 у плити. Це не вада — тупа форма має
     * коротшу смугу плеча (0.736–0.847 проти 0.565–0.911 у плити), тож
     * і різних значень у ній фізично менше.
     *
     * Тому поріг опущено до 8 — під найвужчу з чотирьох виміряних форм,
     * а не під найширшу. Штамп (одна форма на всіх) дав би рівно 1.
     */
    expect(shoulders.size).toBeGreaterThanOrEqual(8);
    }
  });

  it('keeps the monarch nearer vertical than the crystals around it', () => {
    // The monarch is the axis of the colony. Its lean used to be the largest of
    // any body (0.26 against 0.1 for a default child) — the one crystal that
    // has to read as the centre was leaning hardest while the children it
    // should have leaned against stood straight.
    const leanOf = (body: Parameters<typeof buildCrystalProfile>[0]): number => {
      const profile = buildCrystalProfile(body, 'high');
      return Math.hypot(profile.axisLeanX, profile.axisLeanZ) / body.renderedRadius;
    };

    let motherLeans = 0;
    let childLeans = 0;
    for (let seed = 1; seed <= 30; seed += 1) {
      motherLeans += leanOf({ ...motherBody(), seed: seed * 6151 });
      childLeans += leanOf({ ...crystalBody(), seed: seed * 6151 });
    }

    expect(motherLeans / 30).toBeLessThan(childLeans / 30);
  });

  it('tests trim occupancy against the solid itself, not against an envelope', () => {
    // Since ADR-0006 the body publishes the half-spaces it was cut from, so
    // "is this point inside" is answered exactly rather than against an
    // elliptical approximation of a polygonal cross-section. That matters
    // because the envelope is deliberately conservative — it circumscribes the
    // section — and a trim run against it would keep triangles that are
    // genuinely hidden.
    const mother = motherBody();
    const mesh = buildCrystalMesh(mother, 'low');
    const solid = { body: mother, profile: mesh.profile, bounds: mesh.bounds };
    const polytope = intersectHalfSpaces(
      mesh.profile.planes!,
      polytopeTolerance(mother.renderedRadius),
    )!;

    // The centroid is inside; every vertex is on the boundary; a point pushed
    // out along any face normal is outside.
    const centroid = polytope.vertices.reduce(
      (sum, vertex) => ({
        x: sum.x + vertex.x / polytope.vertices.length,
        y: sum.y + vertex.y / polytope.vertices.length,
        z: sum.z + vertex.z / polytope.vertices.length,
      }),
      { x: 0, y: 0, z: 0 },
    );
    const { tangent, bitangent } = orthonormalBasis(mother.direction);
    const toWorld = (local: { x: number; y: number; z: number }) => add(
      add(
        add(mesh.profile.geometryAnchor, scale(tangent, local.x)),
        scale(mother.direction, local.y),
      ),
      scale(bitangent, -local.z),
    );

    expect(pointInsideCrystalSolid(toWorld(centroid), solid, 0)).toBe(true);
    for (const vertex of polytope.vertices) {
      expect(pointInsideCrystalSolid(toWorld(vertex), solid, 1e-4)).toBe(true);
    }
    for (const plane of mesh.profile.planes!) {
      if (plane.kind === 'safety') continue;
      const outside = {
        x: centroid.x + plane.normal.x * 10,
        y: centroid.y + plane.normal.y * 10,
        z: centroid.z + plane.normal.z * 10,
      };
      expect(pointInsideCrystalSolid(toWorld(outside), solid, 0)).toBe(false);
    }
  });
});

describe('crystal faceting — slices', () => {
  it('is still deterministic for the same body', () => {
    expect(buildCrystalProfile(motherBody(), 'high'))
      .toEqual(buildCrystalProfile(motherBody(), 'high'));
    expect(buildCrystalMesh(motherBody(), 'high'))
      .toEqual(buildCrystalMesh(motherBody(), 'high'));
  });
});

describe('crystal faceting — triangulation', () => {
  it('keeps every triangle wound outward after the split alternates', () => {
    // Both splits are valid triangulations of the same quad, but only if they
    // wind the same way. Signed volume is positive only when they do.
    for (const body of [motherBody(), crystalBody()]) {
      const mesh = buildCrystalMesh(body, 'high');
      let volume = 0;
      for (let offset = 0; offset < mesh.indices.length; offset += 3) {
        const a = mesh.indices[offset]! * 3;
        const b = mesh.indices[offset + 1]! * 3;
        const c = mesh.indices[offset + 2]! * 3;
        const p = mesh.positions;
        volume += (
          p[a]! * (p[b + 1]! * p[c + 2]! - p[b + 2]! * p[c + 1]!)
          - p[a + 1]! * (p[b]! * p[c + 2]! - p[b + 2]! * p[c]!)
          + p[a + 2]! * (p[b]! * p[c + 1]! - p[b + 1]! * p[c]!)
        ) / 6;
      }
      expect(volume).toBeGreaterThan(0);
    }
  });
});

describe('crystal faceting — flat faces (ADR-0006)', () => {
  /**
   * The invariant the whole plane model exists for.
   *
   * A crystal is the intersection of its published half-spaces, so every face
   * is a plane and every triangle cut from that face must lie in it. This is
   * what lets the faces be as unequal as a real crystal's — different widths,
   * pitches, lengths, shoulder heights — without any of them bending. The lathe
   * that came before could only vary a face by bending it, which is why any
   * attempt at natural variation came back as a mosaic of small triangles.
   *
   * Measured against the face's own plane rather than between neighbouring
   * triangles: with a fan of five or six triangles per face, pairwise
   * comparison would let a slow drift through.
   */
  const worstFaceTilt = (
    body: ReturnType<typeof motherBody>,
    minimumAreaShare: number,
  ): number => {
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;
    let worst = 0;

    for (const face of polytope.faces) {
      const plane = planes[face.planeIndex]!;
      const triangles: { normal: number[]; area: number }[] = [];
      let faceArea = 0;
      for (let corner = 1; corner + 1 < face.loop.length; corner += 1) {
        const a = polytope.vertices[face.loop[0]!]!;
        const b = polytope.vertices[face.loop[corner]!]!;
        const c = polytope.vertices[face.loop[corner + 1]!]!;
        const u = [b.x - a.x, b.y - a.y, b.z - a.z];
        const v = [c.x - a.x, c.y - a.y, c.z - a.z];
        const cross = [
          u[1]! * v[2]! - u[2]! * v[1]!,
          u[2]! * v[0]! - u[0]! * v[2]!,
          u[0]! * v[1]! - u[1]! * v[0]!,
        ];
        const length = Math.hypot(cross[0]!, cross[1]!, cross[2]!);
        faceArea += length * 0.5;
        if (length < 1e-14) continue;
        triangles.push({ normal: cross.map((value) => value / length), area: length * 0.5 });
      }

      for (const triangle of triangles) {
        if (triangle.area < faceArea * minimumAreaShare) continue;
        const alignment = Math.abs(
          triangle.normal[0]! * plane.normal.x
          + triangle.normal[1]! * plane.normal.y
          + triangle.normal[2]! * plane.normal.z,
        );
        worst = Math.max(worst, Math.acos(Math.min(1, alignment)) * (180 / Math.PI));
      }
    }
    return worst;
  };

  it('keeps every triangle of a face in that face`s plane', () => {
    for (const body of [motherBody(), crystalBody()]) {
      for (let seed = 1; seed <= 12; seed += 1) {
        // Under half a degree is `round6` quantisation on coordinates this
        // small — measured at 0.27° over 500 seeds — while a mosaic is tens of
        // degrees. Triangles carrying under a hundredth of their face are
        // sub-pixel splinters of the fan and are excluded: their normals are
        // dominated by the same rounding and they cover nothing.
        expect(worstFaceTilt({ ...body, seed: seed * 5077 }, 0.01)).toBeLessThan(0.45);
      }
    }
  });

  it('keeps faces flat for a crystal that earned bevels', () => {
    // Bevels add planes, and a plane that varied with height would reintroduce
    // the defect on exactly the crystals that earned the most.
    for (const facetCount of [6, 10, 18, 24]) {
      const body = {
        ...motherBody(),
        attributes: { ...motherBody().attributes, facetCount },
      };
      expect(worstFaceTilt(body, 0.01)).toBeLessThan(0.45);
    }
  });

  it('draws few large faces rather than many small ones', () => {
    // The count is the other half of the original complaint: 24 narrow sides
    // read as noise however flat each one is.
    const body = {
      ...motherBody(),
      attributes: { ...motherBody().attributes, facetCount: 24 },
    };
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;
    const kinds = polytope.faces.map((face) => planes[face.planeIndex]!.kind);

    expect(kinds.filter((kind) => kind === 'prism').length).toBeLessThanOrEqual(7);
    expect(kinds.filter((kind) => kind === 'base')).toHaveLength(1);
    // The safety box exists to keep a degenerate seed bounded. If it ever cuts
    // a real crystal the shape is being decided by a guard rail rather than by
    // the geology, which is a bug however well it renders.
    expect(kinds.filter((kind) => kind === 'safety')).toHaveLength(0);
    expect(polytope.faces.length).toBeLessThanOrEqual(24);
  });

  it('makes the faces genuinely unequal, not merely irregular', () => {
    // The requirement in one measurement. Natural quartz keeps the hexagonal
    // habit but no two faces are the same size, so the largest prism face has
    // to be substantially larger than the smallest — and the crystal has to
    // stay recognisably a prism while it happens.
    const body = motherBody();
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;

    const prismAreas = polytope.faces
      .filter((face) => planes[face.planeIndex]!.kind === 'prism')
      .map((face) => {
        let area = 0;
        for (let corner = 1; corner + 1 < face.loop.length; corner += 1) {
          const a = polytope.vertices[face.loop[0]!]!;
          const b = polytope.vertices[face.loop[corner]!]!;
          const c = polytope.vertices[face.loop[corner + 1]!]!;
          const u = [b.x - a.x, b.y - a.y, b.z - a.z];
          const v = [c.x - a.x, c.y - a.y, c.z - a.z];
          area += Math.hypot(
            u[1]! * v[2]! - u[2]! * v[1]!,
            u[2]! * v[0]! - u[0]! * v[2]!,
            u[0]! * v[1]! - u[1]! * v[0]!,
          ) * 0.5;
        }
        return area;
      })
      .sort((left, right) => right - left);

    expect(prismAreas.length).toBeGreaterThanOrEqual(5);
    // A lathe gave every face the same area to within its ±5% radius jitter.
    expect(prismAreas[0]!).toBeGreaterThan(prismAreas[prismAreas.length - 1]! * 1.5);
  });

  it('puts each face`s shoulder at its own height and drifts the tip off-axis', () => {
    // "Плечі починаються на трохи різній висоті", "вісь і верхівка зміщуються
    // від центру". Both are properties of the finished solid rather than of a
    // parameter, so both are measured on it.
    const body = motherBody();
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;

    // The top of each prism face is where its shoulder is. They must not agree.
    const shoulders = polytope.faces
      .filter((face) => planes[face.planeIndex]!.kind === 'prism')
      .map((face) => Math.max(...face.loop.map((index) => polytope.vertices[index]!.y)));
    const highest = Math.max(...shoulders);
    const lowest = Math.min(...shoulders);
    expect(highest - lowest).toBeGreaterThan(profile.geometryLength * 0.02);

    // The tip is off the axis.
    const topY = Math.max(...polytope.vertices.map((vertex) => vertex.y));
    const tip = polytope.vertices.filter((vertex) => vertex.y > topY - 1e-6)[0]!;
    expect(Math.hypot(tip.x, tip.z)).toBeGreaterThan(0);
  });

  it('publishes a planar unwrap the surface maps can be sampled against', () => {
    // The crystal has no atlas and cannot get one: its faces are a different
    // shape on every couple. But each face is a plane, so its own plane
    // parameterises it exactly — the projection stretches nothing, and the only
    // seams land on facet edges, which are hard edges already.
    //
    // Without this attribute Three falls back to (0,0) at every vertex and the
    // maps render as one texel smeared over the whole body.
    for (const body of [motherBody(), crystalBody()]) {
      const mesh = splitCrystalMeshFaces(buildCrystalMesh(body, 'high'));
      const uvs = mesh.uvs!;
      expect(uvs).toHaveLength((mesh.positions.length / 3) * 2);
      expect(uvs.every(Number.isFinite)).toBe(true);

      // Exact means: the triangle's area in texture space equals its area in
      // space. A projection that skewed or scaled would not, and the pattern
      // would stretch across the face it is meant to sit flat on.
      for (let offset = 0; offset < mesh.indices.length; offset += 3) {
        const corner = (slot: number) => {
          const index = mesh.indices[offset + slot]!;
          return {
            position: [
              mesh.positions[index * 3]!,
              mesh.positions[index * 3 + 1]!,
              mesh.positions[index * 3 + 2]!,
            ] as const,
            uv: [uvs[index * 2]!, uvs[index * 2 + 1]!] as const,
          };
        };
        const [a, b, c] = [corner(0), corner(1), corner(2)];
        const edge = (from: typeof a, to: typeof a) => [
          to.position[0] - from.position[0],
          to.position[1] - from.position[1],
          to.position[2] - from.position[2],
        ] as const;
        const ab = edge(a, b);
        const ac = edge(a, c);
        const spatial = Math.hypot(
          ab[1] * ac[2] - ab[2] * ac[1],
          ab[2] * ac[0] - ab[0] * ac[2],
          ab[0] * ac[1] - ab[1] * ac[0],
        ) * 0.5;
        const textured = Math.abs(
          (b.uv[0] - a.uv[0]) * (c.uv[1] - a.uv[1])
          - (c.uv[0] - a.uv[0]) * (b.uv[1] - a.uv[1]),
        ) * 0.5;
        if (spatial < 1e-9) continue;
        // Three places, not more: the coordinates go through `round6` and the
        // crystal is a tenth of a unit across, so a thousandth is quantisation.
        // A projection that actually skewed would miss by tens of percent.
        expect(textured / spatial).toBeCloseTo(1, 3);
      }
    }
  });

  it('is deterministic and unique per body', () => {
    // The geological identity: the same couple gets the same crystal on every
    // reload, and no two bodies in a colony get the same one.
    const first = buildCrystalProfile(motherBody(), 'high');
    expect(buildCrystalProfile(motherBody(), 'high')).toEqual(first);

    const signatures = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) => buildCrystalProfile({ ...motherBody(), seed: seed * 7919 }, 'high').signature,
      ),
    );
    expect(signatures.size).toBe(8);
  });
});

describe('crystal faceting — the face a triangle belongs to', () => {
  /**
   * Per-face tone is the only thing separating one facet from the next on a
   * device with iridescence and procedural reflection switched off, and it was
   * silently landing on the wrong things.
   *
   * The renderer used to name a triangle's face arithmetically, as
   * `floor(triangle / 2)` modulo the ring length. That encoded the lathe: two
   * triangles per facet, facets in ring order. ADR-0006 replaced the lathe with
   * a polytope whose faces are fanned into as many triangles as they have
   * corners minus two — a different count on every face — and whose slivers are
   * dropped entirely. The arithmetic went on returning a number, so nothing
   * failed; the tints simply stopped landing per plane.
   *
   * Measured effect on the live portal: four neighbouring facets of the monarch
   * rendered within 9% of each other's brightness. Hence identifiers published
   * by the pass that actually does the fanning.
   */
  it('gives every triangle of one plane the same identifier, and neighbours different ones', () => {
    const body = motherBody();
    const mesh = buildCrystalMesh(body, 'high');
    const faceIds = mesh.faceIds!;

    expect(faceIds).toHaveLength(mesh.indices.length / 3);

    // Group triangles by published identifier, then check each group really is
    // one plane — the identifier is worth nothing if it does not track geometry.
    const byFace = new Map<number, number[]>();
    faceIds.forEach((id, triangle) => {
      const bucket = byFace.get(id) ?? [];
      bucket.push(triangle);
      byFace.set(id, bucket);
    });
    expect(byFace.size).toBeGreaterThan(6);

    const normalOf = (triangle: number) => {
      const corner = (slot: number) => {
        const index = mesh.indices[triangle * 3 + slot]!;
        return {
          x: mesh.positions[index * 3]!,
          y: mesh.positions[index * 3 + 1]!,
          z: mesh.positions[index * 3 + 2]!,
        };
      };
      const a = corner(0);
      const b = corner(1);
      const c = corner(2);
      const u = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
      const v = { x: c.x - a.x, y: c.y - a.y, z: c.z - a.z };
      const n = {
        x: u.y * v.z - u.z * v.y,
        y: u.z * v.x - u.x * v.z,
        z: u.x * v.y - u.y * v.x,
      };
      const length = Math.hypot(n.x, n.y, n.z) || 1;
      return { x: n.x / length, y: n.y / length, z: n.z / length };
    };

    const faceNormals: { x: number; y: number; z: number }[] = [];
    for (const triangles of byFace.values()) {
      const first = normalOf(triangles[0]!);
      for (const triangle of triangles) {
        const other = normalOf(triangle);
        const dot = first.x * other.x + first.y * other.y + first.z * other.z;
        // Same plane, so the same normal to within rounding.
        expect(dot).toBeGreaterThan(0.9999);
      }
      faceNormals.push(first);
    }

    // And no two identifiers describe the same plane, which would hand one
    // physical face two tones and draw a seam across it.
    for (let left = 0; left < faceNormals.length; left += 1) {
      for (let right = left + 1; right < faceNormals.length; right += 1) {
        const a = faceNormals[left]!;
        const b = faceNormals[right]!;
        const dot = a.x * b.x + a.y * b.y + a.z * b.z;
        expect(dot).toBeLessThan(0.9999);
      }
    }
  });

  it('keeps the identifiers in step with the triangles through the split', () => {
    const body = motherBody();
    const split = splitCrystalMeshFaces(buildCrystalMesh(body, 'high'));
    expect(split.faceIds).toHaveLength(split.indices.length / 3);
  });
});

describe('crystal faceting — the termination is lattice, not proportion', () => {
  /**
   * A quartz termination sits at the angle the lattice dictates, whatever the
   * prism's length: the prism-to-rhombohedral interfacial angle is 141°47′,
   * which puts the crown faces at 51°47′ from horizontal on a stubby crystal
   * and a tall one alike. A point that sharpens as the body grows is a spire,
   * not a crystal.
   *
   * The inclination used to be derived from the body's own aspect and then
   * clamped into a 42–54° band. Measured across every body of three couples,
   * 261 of 313 crown planes landed exactly on a bound of that band, and for the
   * monarch it was 7 of 7 at every age — the aspect angle ran 66–76° against a
   * ceiling of 54. So the crystal already had one fixed crown angle; it had it
   * by accident, through a clamp, behind code that claimed otherwise.
   */
  it('gives every crown plane its habit angle, however long the prism grows', () => {
    /*
     * ЩО ЗМІНИЛОСЬ У ЦЬОМУ ТЕСТІ Й ЧОМУ.
     *
     * Він вимагав ОДИН кут корони на всі тіла світу — 51°47′ кварцу — і
     * ловив реальну ваду: кут, виведений із пропорцій тіла, робив із
     * кристала шпиль, що гострішає з ростом. Це лишається правдою і
     * лишається тут.
     *
     * Але «один кут на всіх» більше не наш закон. Форму монарха тепер
     * дає габітус пари, і кут корони — головне, чим гострокінечна форма
     * відрізняється від тупої. Тож інваріант звузився з «однакове в
     * усьому світі» до «однакове в межах форми, попри довжину тіла», і
     * додався другий, якого раніше не могло бути: між формами кут мусить
     * РІЗНИТИСЬ, і то помітно.
     *
     * Ліквідувати старий тест і написати новий було б дешевше й гірше:
     * стара вада (кут від пропорцій) досі можлива, і її ловить саме
     * порівняння короткого тіла з довгим усередині кожної форми.
     */
    const habits = ['needle', 'prismatic', 'massive', 'tabular'] as const;
    const medians: number[] = [];

    const median = (values: number[]): number => {
      const sorted = [...values].sort((left, right) => left - right);
      return sorted[Math.floor(sorted.length / 2)]!;
    };

    for (const habit of habits) {
      const shape = crystalHabitShape(habit);
      // Нахил грані від горизонталі — доповнення кута корони до прямого.
      const centre = 90 - (shape.crownMinDeg + shape.crownMaxDeg) / 2;
      const attributes = { formationKind: 'mother', archetype: habit };
      const aspects = {
        short: buildCrystalProfile(
          crystalBody({ ...motherBody(), attributes, renderedLength: 0.7, renderedRadius: 0.3 }),
          'high',
        ),
        tall: buildCrystalProfile(
          crystalBody({ ...motherBody(), attributes, renderedLength: 3.4, renderedRadius: 0.18 }),
          'high',
        ),
      };
      const perAspect: number[] = [];

      for (const profile of Object.values(aspects)) {
        const crowns = (profile.planes ?? []).filter((plane) => plane.kind === 'crown');
        expect(crowns.length).toBeGreaterThan(3);
        const pitches = crowns.map(
          (plane) => Math.asin(Math.max(-1, Math.min(1, plane.normal.y))) * (180 / Math.PI),
        );

        /*
         * Зріз верхівки — ОДНА майже горизонтальна площина, і тільки в
         * тупих форм. Вона не має права ховатись у смузі кута корони: це
         * інша річ, і рахувати її разом із гранями означало б розмити
         * смугу настільки, що вона перестала б будь-що ловити.
         *
         * Виміряно: 79.6° у `massive`, 76.1° у `tabular`, рівно по одній;
         * у гострокінечних форм таких площин нуль.
         */
        const cap = pitches.filter((pitch) => pitch > 60);
        expect(cap).toHaveLength(shape.blunt ? 1 : 0);

        const faces = pitches.filter((pitch) => pitch <= 60);
        for (const pitch of faces) {
          /*
           * ±9° — це спотворення, а не свобода кута.
           *
           * Опубліковані площини вже пройшли анізотропію тіла й нахил, а
           * афінне відображення переводить площини в площини, але кутів
           * не зберігає. Найгірше дістається плиті (переріз 0.72/1.20):
           * виміряний максимум відхилення 8.35°, у решти форм 1.4–3.0°.
           */
          expect(Math.abs(pitch - centre)).toBeLessThanOrEqual(9);
        }
        perAspect.push(median(faces));
      }

      /*
       * Та сама форма на короткому й довгому тілі — той самий кут.
       * Саме це ловило стару ваду: кут від пропорцій розійшовся б на
       * десятки градусів між тілом 0.7×0.3 і тілом 3.4×0.18.
       * Виміряно: найбільший розбіг серед чотирьох форм 0.71°.
       */
      expect(Math.abs(perAspect[0]! - perAspect[1]!)).toBeLessThan(1.5);
      expect(Math.abs(median(perAspect) - centre)).toBeLessThan(3.5);
      medians.push(median(perAspect));
    }

    /*
     * І головне, заради чого габітус узагалі існує: між формами кут
     * корони мусить різнитись, і в тому самому порядку, що й смуги в
     * таблиці — голка найгостріша, плита найтупіша.
     *
     * Виміряно: 21.8° / 38.3° / 47.5° / 49.2°. Мутація «повертати
     * PRISMATIC на будь-яке ім'я» дала б чотири рівні числа.
     */
    for (let index = 1; index < medians.length; index += 1) {
      expect(medians[index]!).toBeGreaterThan(medians[index - 1]!);
    }
    expect(medians[medians.length - 1]! - medians[0]!).toBeGreaterThan(20);
  });

  it('alternates major and minor termination faces around the tip', () => {
    const body = motherBody();
    const profile = buildCrystalProfile(body, 'high');
    const planes = profile.planes!;
    const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;

    const faceArea = (loop: number[]): number => {
      let area = 0;
      for (let corner = 1; corner + 1 < loop.length; corner += 1) {
        const a = polytope.vertices[loop[0]!]!;
        const b = polytope.vertices[loop[corner]!]!;
        const c = polytope.vertices[loop[corner + 1]!]!;
        const u = [b.x - a.x, b.y - a.y, b.z - a.z];
        const v = [c.x - a.x, c.y - a.y, c.z - a.z];
        area += Math.hypot(
          u[1]! * v[2]! - u[2]! * v[1]!,
          u[2]! * v[0]! - u[0]! * v[2]!,
          u[0]! * v[1]! - u[1]! * v[0]!,
        ) * 0.5;
      }
      return area;
    };

    // Crown planes are emitted in one run and in order, so a plane's position
    // within that run is its r/z parity.
    const crownOrdinal = new Map<number, number>();
    planes.forEach((plane, index) => {
      if (plane.kind === 'crown') crownOrdinal.set(index, crownOrdinal.size);
    });

    const major: number[] = [];
    const minor: number[] = [];
    for (const face of polytope.faces) {
      const ordinal = crownOrdinal.get(face.planeIndex);
      if (ordinal === undefined) continue;
      (ordinal % 2 === 0 ? major : minor).push(faceArea(face.loop));
    }

    expect(major.length).toBeGreaterThanOrEqual(3);
    expect(minor.length).toBeGreaterThanOrEqual(2);

    const mean = (values: number[]): number =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    // Two sizes, not a spread: every minor face is smaller than every major
    // one, which is what turns a ring of triangles into a quartz point.
    // On this body: majors 0.0250–0.0585, minors 0.0041–0.0304, mean ratio
    // 0.358. Stated as means rather than as "every minor below every major",
    // because the majors themselves span 2.3× — the smallest major overlaps the
    // largest minor, and a crystal where they could not would be the stamped
    // shape this replaces.
    expect(mean(minor)).toBeLessThan(mean(major) * 0.5);
  });

  it('never lets a minor face collapse into a sliver', () => {
    // §36: a facet too small to read is worse than no facet — it costs a plane,
    // a normal and a rim, and renders as a scratch. The retreat that closes a
    // minor face varies about thirtyfold across one crystal, because it depends
    // on the azimuth gaps to the face's neighbours; quoted in radii it left one
    // measured face at 1/368th the area of its neighbour. Quoted as a share of
    // that closing distance it behaves the same on every face.
    //
    // Measured as a facet's span against the body's own width, so it is a
    // statement about what the eye can resolve rather than about engine units.
    const spans: number[] = [];
    for (let seed = 1; seed <= 40; seed += 1) {
      const body = { ...motherBody(), seed: seed * 7919 };
      const profile = buildCrystalProfile(body, 'high');
      const planes = profile.planes!;
      const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;
      const width = body.renderedRadius * 2;

      for (const face of polytope.faces) {
        if (planes[face.planeIndex]!.kind !== 'crown') continue;
        let area = 0;
        for (let corner = 1; corner + 1 < face.loop.length; corner += 1) {
          const a = polytope.vertices[face.loop[0]!]!;
          const b = polytope.vertices[face.loop[corner]!]!;
          const c = polytope.vertices[face.loop[corner + 1]!]!;
          const u = [b.x - a.x, b.y - a.y, b.z - a.z];
          const v = [c.x - a.x, c.y - a.y, c.z - a.z];
          area += Math.hypot(
            u[1]! * v[2]! - u[2]! * v[1]!,
            u[2]! * v[0]! - u[0]! * v[2]!,
            u[0]! * v[1]! - u[1]! * v[0]!,
          ) * 0.5;
        }
        spans.push(Math.sqrt(2 * area) / width);
      }
    }

    // Measured over 255 crown facets on forty seeds: median 0.586 of the body's
    // width, 5th percentile 0.126, floor 0.0362, and two facets below 0.05. The
    // floor is the regression guard — a change that reopens the sliver takes it
    // to 0.003, which is where the radius-quoted retreat left it, and to 0.0071
    // when the shoulder cuts narrowed the shaft locally and the drop was still
    // being read off the body's global minimum.
    // ADR-0019 pulled the minor retreat's ceiling from 0.45 to 0.34 for the gem
    // crown, and both of those two near-slivers went with it: the count is now
    // zero and the floor has risen. Kept as an upper bound rather than an exact
    // count — the requirement is "no sliver", and an exact snapshot of how many
    // narrowly avoided being one is a golden number, not a guard.
    expect(spans.length).toBeGreaterThan(200);
    expect(Math.min(...spans)).toBeGreaterThan(0.03);
    expect(spans.filter((span) => span < 0.05).length).toBeLessThanOrEqual(2);
    const sorted = [...spans].sort((left, right) => left - right);
    expect(sorted[Math.floor(sorted.length / 2)]!).toBeGreaterThan(0.4);
  });
});

describe('crystal faceting — the shaft is interrupted', () => {
  /**
   * Pass 1's strongest finding, measured: every prism face ran from the base to
   * the shoulder as one unbroken strip. Over twelve seeds, **88 of 88 faces
   * changed width monotonically**, and the median change across the whole
   * height was 3.0° of arc.
   *
   * That is arithmetic rather than tuning. A face's width is decided by where
   * its neighbours cut it; each neighbour is one plane with one fixed tilt; so
   * the relative widths can only drift one way and the same face dominates from
   * bottom to top, always. The fix has to be a plane that is not there low down.
   */
  const sectorsAt = (planes: CrystalFacePlane[], y: number): Map<number, number> => {
    const found = new Map<number, number>();
    const steps = 1440;
    for (let step = 0; step < steps; step += 1) {
      const angle = (step / steps) * Math.PI * 2;
      const dx = Math.sin(angle);
      const dz = Math.cos(angle);
      let nearest = Infinity;
      let owner = -1;
      planes.forEach((plane, index) => {
        const denominator = plane.normal.x * dx + plane.normal.z * dz;
        if (denominator <= 1e-9) return;
        const distance = (plane.offset - plane.normal.y * y) / denominator;
        if (distance > 0 && distance < nearest) { nearest = distance; owner = index; }
      });
      if (owner >= 0) found.set(owner, (found.get(owner) ?? 0) + 360 / steps);
    }
    return found;
  };

  it('gives every crystal a face that only exists in the upper shaft', () => {
    // The shoulder cut leans inward and crosses its host exactly once, so below
    // that crossing it stands outside the body and owns no arc at all. A cut
    // that owned arc at the base would be an ordinary bevel and would change
    // nothing about the monotonicity — that is the property under test, not the
    // count of cuts.
    //
    // Measured over 88 cuts on forty seeds: 87 own exactly 0° of arc at 0.15 of
    // the height, one owns 2°, and the median arc at 0.70 is 45.5°. The 2° is
    // the body's lean, not the cut: the published planes have been sheared, and
    // this probe casts its rays from the untilted axis.
    let silentLow = 0;
    let cutCount = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const body = { ...motherBody(), seed: seed * 7919 };
      const profile = buildCrystalProfile(body, 'high');
      const planes = profile.planes!;
      const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;
      const top = Math.max(...polytope.vertices.map((vertex) => vertex.y));

      const cuts = planes
        .map((plane, index) => ({ plane, index }))
        .filter((entry) => entry.plane.kind === 'shoulder');
      expect(cuts.length).toBeGreaterThanOrEqual(1);

      const low = sectorsAt(planes, top * 0.15);
      const high = sectorsAt(planes, top * 0.7);
      let appearing = 0;
      for (const cut of cuts) {
        cutCount += 1;
        const lowArc = low.get(cut.index) ?? 0;
        expect(lowArc).toBeLessThan(3);
        if (lowArc === 0) silentLow += 1;
        if ((high.get(cut.index) ?? 0) > 1) appearing += 1;
      }
      expect(appearing).toBeGreaterThanOrEqual(1);
    }
    expect(silentLow / cutCount).toBeGreaterThan(0.95);
  });

  it('leans every shoulder cut inward, which is the whole mechanism', () => {
    // Asserted on the body's own frame rather than on the published plane: the
    // lean shears `normal.y` and can take a weakly converging cut a thousandth
    // past zero, which says something about the lean and nothing about the cut.
    //
    // A cut that followed the flare — which is what the earned bevels do —
    // would take the same bite at every height and interrupt nothing.
    for (let seed = 1; seed <= 40; seed += 1) {
      const body = { ...motherBody(), seed: seed * 7919 };
      const planes = buildCrystalFacePlanes(body, {
        baseY: 0,
        topY: body.renderedLength,
        radius: body.renderedRadius,
        mainFacets: 7,
        bevels: 1,
        blunt: false,
        broken: false,
        habit: 'mature',
        lod: 'high',
      });
      const cuts = planes.filter((plane) => plane.kind === 'shoulder');
      expect(cuts.length).toBeGreaterThanOrEqual(1);
      for (const cut of cuts) expect(cut.normal.y).toBeGreaterThan(0);
      for (const prism of planes.filter((plane) => plane.kind === 'prism')) {
        // And the prism faces lean the other way, so the break across a face is
        // a real edge rather than a fold.
        expect(prism.normal.y).toBeLessThan(0);
      }
    }
  });

  it('makes prism faces widen and then narrow, which one tilt each cannot', () => {
    // The measurable form of "insufficient variation lower / middle / upper".
    // Before the shoulder cuts this count was exactly zero, on every seed.
    let nonMonotone = 0;
    let total = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const body = { ...motherBody(), seed: seed * 7919 };
      const profile = buildCrystalProfile(body, 'high');
      const planes = profile.planes!;
      const polytope = intersectHalfSpaces(planes, polytopeTolerance(body.renderedRadius))!;
      const top = Math.max(...polytope.vertices.map((vertex) => vertex.y));
      const heights = [0.08, 0.24, 0.4, 0.56, 0.68, 0.78].map((share) => top * share);
      const series = new Map<number, number[]>();
      heights.forEach((y, slot) => {
        for (const [index, degrees] of sectorsAt(planes, y)) {
          if (planes[index]!.kind !== 'prism') continue;
          const widths = series.get(index) ?? heights.map(() => 0);
          widths[slot] = degrees;
          series.set(index, widths);
        }
      });
      for (const widths of series.values()) {
        total += 1;
        const deltas = widths.slice(1).map((width, slot) => width - widths[slot]!);
        if (deltas.some((delta) => delta > 0.5) && deltas.some((delta) => delta < -0.5)) {
          nonMonotone += 1;
        }
      }
    }
    // Measured: 47 of 261. Held as a share rather than a count so the assertion
    // survives a seed changing which face a cut lands on.
    expect(total).toBeGreaterThan(200);
    expect(nonMonotone / total).toBeGreaterThan(0.1);
  });

  it('keeps the shoulder cut in the upper shaft, so the body is not a barrel', () => {
    // A cut pinned low takes the corner away from the part of the shaft that is
    // supposed to be widest, and the broadest slice slides to mid-shaft.
    // Measured across forty seeds the widest vertex sits at 0.657..0.950 of the
    // height; at four times the convergence it fell to 0.44.
    for (let seed = 1; seed <= 40; seed += 1) {
      const body = { ...motherBody(), seed: seed * 7919 };
      const profile = buildCrystalProfile(body, 'high');
      const polytope = intersectHalfSpaces(
        profile.planes!,
        polytopeTolerance(body.renderedRadius),
      )!;
      const top = Math.max(...polytope.vertices.map((vertex) => vertex.y));
      const widest = polytope.vertices.reduce(
        (best, vertex) => (
          Math.hypot(vertex.x, vertex.z) > Math.hypot(best.x, best.z) ? vertex : best
        ),
        polytope.vertices[0]!,
      );
      expect(widest.y / top).toBeGreaterThan(0.6);
    }
  });

  it('drops the cuts at low LOD, where the break is under a pixel', () => {
    const body = motherBody();
    const low = buildCrystalProfile(body, 'low').planes!;
    expect(low.filter((plane) => plane.kind === 'shoulder')).toHaveLength(0);
    const high = buildCrystalProfile(body, 'high').planes!;
    expect(high.filter((plane) => plane.kind === 'shoulder').length).toBeGreaterThan(0);
  });
});

describe('crystal faceting — the facet rim (stylized gem technique)', () => {
  /**
   * The rim has to outline the facet, not the triangulation.
   *
   * Every face is fanned from one corner, so most of its triangles have two
   * edges running through the middle of a flat plane. Lighting those would draw
   * a spider's web across each facet — which is the failure mode the mask
   * exists to prevent, and the reason this cannot be derived in the renderer.
   */
  it('marks the polygon rim and never an internal cut of the fan', () => {
    const mesh = buildCrystalMesh(motherBody(), 'high');
    const borderEdges = mesh.borderEdges!;
    expect(borderEdges).toHaveLength(mesh.indices.length / 3);

    const key = (a: number, b: number) => (a < b ? `${a}:${b}` : `${b}:${a}`);
    // An edge shared by two triangles of the *same* face is an internal cut; an
    // edge on the rim is shared with a different face, or with nothing.
    const faceIds = mesh.faceIds!;
    const owners = new Map<string, number[]>();
    for (let triangle = 0; triangle < borderEdges.length; triangle += 1) {
      const corners = [0, 1, 2].map((slot) => mesh.indices[triangle * 3 + slot]!);
      for (let slot = 0; slot < 3; slot += 1) {
        const edge = key(corners[(slot + 1) % 3]!, corners[(slot + 2) % 3]!);
        const bucket = owners.get(edge) ?? [];
        bucket.push(triangle);
        owners.set(edge, bucket);
      }
    }

    let rimEdges = 0;
    for (let triangle = 0; triangle < borderEdges.length; triangle += 1) {
      const corners = [0, 1, 2].map((slot) => mesh.indices[triangle * 3 + slot]!);
      for (let slot = 0; slot < 3; slot += 1) {
        const edge = key(corners[(slot + 1) % 3]!, corners[(slot + 2) % 3]!);
        const marked = (borderEdges[triangle]! & (1 << slot)) !== 0;
        const sharedWithSameFace = (owners.get(edge) ?? []).some(
          (other) => other !== triangle && faceIds[other] === faceIds[triangle],
        );
        // The two must never agree: an internal cut is exactly an edge shared
        // with another triangle of the same face.
        expect(marked).toBe(!sharedWithSameFace);
        if (marked) rimEdges += 1;
      }
    }
    expect(rimEdges).toBeGreaterThan(6);
  });
});
