// ============================================================
// Меш однієї річної колонії: коралові тіла, зрощені з куполом.
// ------------------------------------------------------------
// `colonyBodies.ts` вирішує, ДЕ стоїть кожне тіло; тут воно стає
// геометрією. Колонія віддається ОДНИМ мешем, а не мешем на тіло: у
// повній історії тіл під чотири сотні, і чотириста викликів малювання
// коштували б дорожче за всю решту сцени разом.
//
// ТРИ РІШЕННЯ, ЯКІ ВИЗНАЧАЮТЬ ФОРМУ.
//
// 1. ТІЛО СИДИТЬ НА КУПОЛІ, А НЕ НА ПЛОЩИНІ. Розкладка дає зсув у
//    дотичній площині прив'язки, але купол під колонією вигнутий, і на
//    краю шапки площина відходить від нього помітно. Тому кожна точка
//    зсуву ПРОЄКТУЄТЬСЯ на еліпсоїд голови, і власна вісь тіла береться
//    з нормалі в його ВЛАСНІЙ основі. Ціна — невелике стиснення
//    відстаней (хорда проти дуги); воно робить колонію трохи щільнішою
//    за оголошену, тобто зазор між роками від нього не страждає.
//
// 2. ОСНОВА ЗАТОПЛЕНА — І ПО ПОВЕРХНІ, А НЕ ПО ОСІ. Це вимога профілю
//    цілісності: жодна базова кришка не має бути видимою, і виконана
//    вона має бути геометрично, а не обіцянкою.
//
//    Перша редакція опускала нижнє кільце вздовж ОСІ тіла на частку
//    його радіуса — і цього не вистачало. Виміряно: на поясі 0.22, де
//    купол найкрутіший, найгірша базова вершина виходила НАЗОВНІ
//    (значення еліпсоїда 1.0083 замість <1). Причина рахується на
//    папері: біля екватора меридіанний радіус кривини дорівнює лише
//    H²/R = 0.19, тож підйом дотичної площини над куполом (0.045)
//    разом із перекосом нахиленого кільця (0.051) з'їдали все
//    затоплення (0.098) до нуля.
//
//    Тому кожна вершина нижнього кільця САДИТЬСЯ на купол і аж тоді
//    втоплюється вздовж місцевої нормалі. Опуклість тоді гарантує
//    результат: точка на поверхні, зміщена всередину менше, ніж
//    найменший радіус кривини, лежить усередині — при будь-якому
//    нахилі й будь-якій кривині.
//
// 3. ТІЛО ЗАМКНЕНЕ, ХОЧ КРИШКИ Й НЕ ВИДНО. Затоплена кришка все одно
//    будується: незамкнена оболонка дає діри в тіні й ламає будь-яке
//    подальше злиття мешів.
// ============================================================
import { round6, seededUnit } from './math';
import type { ReefHeadSize, ReefColonyAnchor } from './colonyFormations';
import type { ReefCoralBody } from './colonyBodies';
import type { ReefMeshData } from './headMesh';

/** Скільки граней по колу в одного тіла. */
const AZIMUTH_SEGMENTS = 8;

/**
 * Профіль тіла знизу вгору: частка висоти й товщина на ній.
 *
 * Не конус і не циліндр. Корал тримає товщину майже до середини й
 * швидко звужується вгорі — саме це відрізняє живий палець від
 * загостреного кілочка. Останнє кільце не сходиться в нуль: над ним
 * стоїть кругла маківка.
 */
const PROFILE: ReadonlyArray<readonly [number, number]> = [
  [0.0, 1.0],
  [0.45, 0.88],
  [0.78, 0.66],
  [1.0, 0.36],
];

/** Наскільки глибоко основа втоплена в купол, у частках радіуса тіла. */
const SINK_OF_RADIUS = 0.85;

/**
 * Стеля затоплення — частка найменшого радіуса кривини купола.
 *
 * Опуклість рятує лише доти, доки зміщення всередину менше за радіус
 * кривини: глибше нормаль виходить з іншого боку купола, і тіло
 * протикає голову наскрізь.
 *
 * НАЗВАНО ЧЕСНО: сьогодні ця стеля майже не працює. Перебрано весь
 * діапазон закону росту (0.1–30 років × широта 0–6 × наповненість
 * 0–1): найбільше, чого просить затоплення, — 1.06 стелі, тобто 0.53
 * радіуса кривини, і до небезпечної одиниці там удвічі далі. Тож
 * жодна мутація, яка цю стелю знімає, тестом не падає, і вдавати
 * інакше не можна.
 *
 * Лишається вона тому, що ціна помилки несиметрична: пропущений
 * випадок — це корал, що прошив голову наскрізь, а ціна стелі —
 * невидима затоплена частина на кілька відсотків коротша. Якщо
 * товщину тіл колись піднімуть, стеля почне тримати мовчки.
 */
const SINK_CURVATURE_SHARE = 0.5;

/** Скільки поздовжніх ребер має тіло і як глибоко вони йдуть. */
const RIB_COUNT = 3;
const RIB_DEPTH = 0.13;

/** Насіння лишає тілу трохи власної товщини, щоб сусіди не були близнюками. */
const GIRTH_JITTER = 0.18;

interface Vec3 { x: number; y: number; z: number }

function scaled(v: Vec3, by: number): Vec3 {
  return { x: v.x * by, y: v.y * by, z: v.z * by };
}
function added(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}
function normalized(v: Vec3): Vec3 {
  const length = Math.max(1e-9, Math.hypot(v.x, v.y, v.z));
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

/** Нормаль еліпсоїда голови в точці — градієнт (x²+z²)/R² + y²/H². */
function domeNormal(head: ReefHeadSize, point: Vec3): Vec3 {
  const radius = Math.max(1e-6, head.radius);
  const rise = Math.max(1e-6, head.rise);
  return normalized({
    x: point.x / (radius * radius),
    y: point.y / (rise * rise),
    z: point.z / (radius * radius),
  });
}

/** Точку, що зійшла з поверхні, повертає на купол уздовж променя з центру. */
function ontoDome(head: ReefHeadSize, point: Vec3): Vec3 {
  const radius = Math.max(1e-6, head.radius);
  const rise = Math.max(1e-6, head.rise);
  const value = Math.sqrt(
    (point.x * point.x + point.z * point.z) / (radius * radius)
    + (point.y * point.y) / (rise * rise),
  );
  if (!(value > 1e-9)) return point;
  return scaled(point, 1 / value);
}

/** Пара дотичних, ортонормованих до осі. */
function tangentFrame(axis: Vec3): [Vec3, Vec3] {
  const helper = Math.abs(axis.y) > 0.9 ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 };
  const first = normalized(cross(axis, helper));
  return [first, normalized(cross(axis, first))];
}

/**
 * Меш цілої річної колонії.
 *
 * Голова потрібна тут не для краси: без неї не можна ні посадити тіло
 * на вигнуту поверхню, ні втопити його основу так, щоб кришки не було
 * видно з жодного боку.
 */
export function buildReefColonyMesh(
  head: ReefHeadSize,
  anchor: ReefColonyAnchor,
  bodies: readonly ReefCoralBody[],
  seed: number,
): ReefMeshData {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let baseCapTriangleCount = 0;

  const anchorNormal = normalized(anchor.normal);
  const [colonyU, colonyV] = tangentFrame(anchorNormal);

  bodies.forEach((body, index) => {
    const salt = `${anchor.band}:${index}`;

    // 1. Основа тіла — власна точка на куполі, а не зсув у площині.
    const planar = added(
      added(anchor.point, scaled(colonyU, body.offset.u)),
      scaled(colonyV, body.offset.v),
    );
    const foot = ontoDome(head, planar);
    const up = domeNormal(head, foot);

    // 2. Вісь: нормаль, нахилена назовні на власний кут тіла.
    const [footU, footV] = tangentFrame(up);
    const lean = normalized(added(
      scaled(footU, Math.cos(body.tiltAzimuthRad)),
      scaled(footV, Math.sin(body.tiltAzimuthRad)),
    ));
    const axis = normalized(added(
      scaled(up, Math.cos(body.tiltRad)),
      scaled(lean, Math.sin(body.tiltRad)),
    ));
    const [ringU, ringV] = tangentFrame(axis);

    const girth = body.radius
      * (1 + (seededUnit(seed, `reef:mesh:girth:${salt}`) - 0.5) * GIRTH_JITTER);
    const ribPhase = seededUnit(seed, `reef:mesh:rib:${salt}`) * Math.PI * 2;
    // Найменший радіус кривини півеліпсоїда — на екваторі, H²/R.
    const curvature = (head.rise * head.rise) / Math.max(1e-6, head.radius);
    const sink = Math.min(girth * SINK_OF_RADIUS, curvature * SINK_CURVATURE_SHARE);

    const firstVertex = positions.length / 3;

    const ringPoint = (theta: number, along: number, width: number): Vec3 => {
      const rib = 1 + Math.sin(theta * RIB_COUNT + ribPhase) * RIB_DEPTH;
      const outward = added(
        scaled(ringU, Math.cos(theta)),
        scaled(ringV, Math.sin(theta)),
      );
      return added(added(foot, scaled(axis, along)), scaled(outward, width * rib));
    };

    const pushRing = (along: number, width: number, buried: boolean): void => {
      for (let segment = 0; segment < AZIMUTH_SEGMENTS; segment += 1) {
        const theta = (segment / AZIMUTH_SEGMENTS) * Math.PI * 2;
        const raw = ringPoint(theta, along, width);
        const outward = normalized({
          x: raw.x - foot.x - axis.x * along,
          y: raw.y - foot.y - axis.y * along,
          z: raw.z - foot.z - axis.z * along,
        });
        // Затоплене кільце сідає на купол і тоне вздовж МІСЦЕВОЇ
        // нормалі — саме це й робить його невидимим при будь-якому
        // нахилі.
        const point = buried
          ? (() => {
            const onDome = ontoDome(head, raw);
            return added(onDome, scaled(domeNormal(head, onDome), -sink));
          })()
          : raw;
        positions.push(round6(point.x), round6(point.y), round6(point.z));
        normals.push(round6(outward.x), round6(outward.y), round6(outward.z));
      }
    };

    pushRing(0, girth * PROFILE[0]![1], true);
    for (const [along, width] of PROFILE) {
      pushRing(along * body.height, girth * width, false);
    }

    const ringCount = PROFILE.length + 1;
    for (let ring = 0; ring < ringCount - 1; ring += 1) {
      const low = firstVertex + ring * AZIMUTH_SEGMENTS;
      const high = low + AZIMUTH_SEGMENTS;
      for (let segment = 0; segment < AZIMUTH_SEGMENTS; segment += 1) {
        const next = (segment + 1) % AZIMUTH_SEGMENTS;
        indices.push(low + segment, low + next, high + segment);
        indices.push(low + next, high + next, high + segment);
      }
    }

    // Маківка: одна вершина над верхнім кільцем, віяло на нього.
    const apex = positions.length / 3;
    const tip = added(foot, scaled(axis, body.height * (1 + PROFILE[PROFILE.length - 1]![1] * 0.9)));
    positions.push(round6(tip.x), round6(tip.y), round6(tip.z));
    normals.push(round6(axis.x), round6(axis.y), round6(axis.z));
    const topRing = firstVertex + (ringCount - 1) * AZIMUTH_SEGMENTS;
    for (let segment = 0; segment < AZIMUTH_SEGMENTS; segment += 1) {
      const next = (segment + 1) % AZIMUTH_SEGMENTS;
      indices.push(topRing + segment, topRing + next, apex);
    }

    // Кришка основи: затоплена, але замкнена.
    const capCentre = positions.length / 3;
    const capPoint = added(foot, scaled(domeNormal(head, foot), -sink));
    positions.push(round6(capPoint.x), round6(capPoint.y), round6(capPoint.z));
    normals.push(round6(-axis.x), round6(-axis.y), round6(-axis.z));
    for (let segment = 0; segment < AZIMUTH_SEGMENTS; segment += 1) {
      const next = (segment + 1) % AZIMUTH_SEGMENTS;
      indices.push(capCentre, firstVertex + next, firstVertex + segment);
    }
    baseCapTriangleCount += AZIMUTH_SEGMENTS;
  });

  let minX = Infinity; let minY = Infinity; let minZ = Infinity;
  let maxX = -Infinity; let maxY = -Infinity; let maxZ = -Infinity;
  for (let at = 0; at < positions.length; at += 3) {
    minX = Math.min(minX, positions[at]!); maxX = Math.max(maxX, positions[at]!);
    minY = Math.min(minY, positions[at + 1]!); maxY = Math.max(maxY, positions[at + 1]!);
    minZ = Math.min(minZ, positions[at + 2]!); maxZ = Math.max(maxZ, positions[at + 2]!);
  }
  const empty = positions.length === 0;

  return {
    positions,
    normals,
    indices,
    baseCapTriangleCount,
    bounds: {
      min: { x: empty ? 0 : round6(minX), y: empty ? 0 : round6(minY), z: empty ? 0 : round6(minZ) },
      max: { x: empty ? 0 : round6(maxX), y: empty ? 0 : round6(maxY), z: empty ? 0 : round6(maxZ) },
    },
  };
}
