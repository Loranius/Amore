// ============================================================
// Звідки дивитись на сузір'я.
// ------------------------------------------------------------
// Чиста арифметика без three, і саме тому перевірена тестом: помилка тут не
// падає — вона тихо лишає половину подій пари за краєм кадру. Так уже й
// сталось, двічі поспіль, і обидва рази знайшов знімок, а не типізація:
//
//  1. Перша редакція рахувала одну відстань і не питала про форму екрана. На
//     телефоні 412×915 поле зору по горизонталі вдвічі вужче за вертикальне —
//     з восьми зірок у кадр потрапило шість.
//  2. Друга питала, але міряла сузір'я як ПЛОСКУ мішень на відстані цілі.
//     Перспектива працює інакше: зірка з ближнього боку стоїть до камери
//     ближче за центр, і той самий відступ від осі займає в кадрі більше. На
//     широкому екрані так виїхали два краї.
//
// Тому тут не формула «розмір поділити на тангенс», а прямий добір: беремо
// вісім кутів габариту сузір'я, проєктуємо їх справжньою камерою і шукаємо
// найменшу відстань, з якої всі вісім усередині кадру. Дорожче на двадцять
// ітерацій раз на зміну розміру полотна — і не бреше.
//
// Камера ще й повертається так, щоб довша сторона сузір'я лягла на довшу
// сторону екрана: інакше портретний телефон витрачає половину висоти на
// порожнечу, а по ширині не вміщає нічого.
// ============================================================

export interface JourneyFraming {
  /** Відстань камери від середини сузір'я в спокої. */
  distance: number;
  /** Звідки починається інтро-політ. */
  introDistance: number;
  /** Наскільки близько орбіта пускає камеру. */
  minDistance: number;
  /** Наскільки далеко орбіта пускає камеру. */
  maxDistance: number;
  /** Напрямок на камеру від середини, одиничний. */
  direction: readonly [number, number, number];
  /** Що для камери «вгору». Саме цим вісь часу кладеться на довшу сторону. */
  up: readonly [number, number, number];
}

/** Порожнє небо теж треба чимось кадрувати. */
const MINIMUM_EXTENT = 10;
/** Скільки місця лишається навколо сузір'я. */
const BREATHING_ROOM = 1.1;
/** Ближче цього до середини камера не підходить навіть на щипок. */
const CLOSEST = 7;
/** Кут підйому камери над площиною осі часу, рад. */
const ELEVATION = 0.3;
/** Межі й точність добору відстані. */
const SEARCH_MAX = 4_000;
const SEARCH_STEPS = 30;

export interface JourneyShape {
  /** Найбільший відступ від осі часу, від середини сузір'я. */
  radial: number;
  /** Півдовжина вздовж осі часу, від середини сузір'я. */
  axial: number;
}

export interface JourneyViewport {
  /** Ширина, поділена на висоту. Менше одиниці — портрет. */
  aspect: number;
  /** Вертикальне поле зору камери, градуси. */
  fovY: number;
}

type Vec = readonly [number, number, number];

const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec, b: Vec): Vec => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
function unit(v: Vec): Vec {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

/** Вісім кутів габариту сузір'я, відносно його середини. */
function corners(radial: number, axial: number): Vec[] {
  const out: Vec[] = [];
  for (const x of [-radial, radial]) {
    for (const y of [-radial, radial]) {
      for (const z of [-axial, axial]) out.push([x, y, z]);
    }
  }
  return out;
}

/** Чи видно всі кути з відстані `distance` уздовж `direction`. */
function allInside(
  box: readonly Vec[],
  direction: Vec,
  up: Vec,
  distance: number,
  tanY: number,
  tanX: number,
): boolean {
  const forward: Vec = [-direction[0], -direction[1], -direction[2]];
  const right = unit(cross(forward, up));
  const trueUp = cross(right, forward);
  const eye: Vec = [
    direction[0] * distance,
    direction[1] * distance,
    direction[2] * distance,
  ];

  for (const corner of box) {
    const v: Vec = [corner[0] - eye[0], corner[1] - eye[1], corner[2] - eye[2]];
    const depth = dot(v, forward);
    // Кут за спиною камери не «вміщається» — він поза кадром назавжди.
    if (depth <= 0.001) return false;
    if (Math.abs(dot(v, right)) > depth * tanX) return false;
    if (Math.abs(dot(v, trueUp)) > depth * tanY) return false;
  }
  return true;
}

export function journeyFraming(shape: JourneyShape, viewport: JourneyViewport): JourneyFraming {
  const axial = Math.max(MINIMUM_EXTENT, shape.axial);
  const radial = Math.max(MINIMUM_EXTENT, shape.radial);

  const halfFovY = (viewport.fovY * Math.PI) / 360;
  const tanY = Math.tan(halfFovY);
  const tanX = tanY * Math.max(0.05, viewport.aspect);

  // Вісь часу лягає на довшу сторону кадру. На телефоні це висота, на
  // широкому екрані — ширина; сузір'я від цього не змінюється, змінюється лише
  // те, як воно стоїть перед парою.
  const portrait = viewport.aspect < 1;
  const timeUp = portrait === (axial >= radial);

  const direction: Vec = [Math.cos(ELEVATION), Math.sin(ELEVATION), 0];
  const up: Vec = timeUp ? [0, 0, 1] : [0, 1, 0];
  const box = corners(radial, axial);

  // Двійковий пошук найменшої відстані, з якої габарит вміщається цілком.
  let low = 0;
  let high = SEARCH_MAX;
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (allInside(box, direction, up, middle, tanY, tanX)) high = middle;
    else low = middle;
  }
  const distance = high * BREATHING_ROOM;

  return {
    distance,
    // Політ починається помітно далі, ніж закінчується: три відстані дають
    // відчуття прибуття, півтори — просто наїзд.
    introDistance: distance * 3,
    minDistance: Math.max(CLOSEST, Math.min(radial, axial) * 0.5),
    maxDistance: distance * 3.4,
    direction,
    up,
  };
}

/**
 * З якої відстані дивитись на одну розкриту подію.
 *
 * Кадр у focus-режимі ділиться з деталями, тож вирішує ВУЖЧА зі сторін —
 * та сама логіка, що й у кадруванні сузір'я, тільки мішень тут одна й кругла.
 */
export function focusDistance(radius: number, viewport: JourneyViewport): number {
  const halfFovY = (viewport.fovY * Math.PI) / 360;
  const tanY = Math.tan(halfFovY);
  const tanX = tanY * Math.max(0.05, viewport.aspect);
  const tightest = Math.min(tanY, tanX);
  // Множник лишає сонцю приблизно половину вузької сторони: більше — і воно
  // впирається в край, менше — і подія читається дрібною крапкою.
  return Math.max(radius * 2.2, (radius / tightest) * 2.1);
}
