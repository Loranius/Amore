// ============================================================
// Звідки дивитись на сузір'я.
// ------------------------------------------------------------
// Чиста арифметика без three, і саме тому перевірена тестом: помилка тут не
// падає — вона тихо лишає половину подій пари за краєм кадру або, навпаки,
// половину кадру порожньою. Так уже й ставалось, тричі, і щоразу знайшов
// знімок, а не типізація:
//
//  1. Перша редакція рахувала одну відстань і не питала про форму екрана. На
//     телефоні 412×915 поле зору по горизонталі вдвічі вужче за вертикальне —
//     з восьми зірок у кадр потрапило шість.
//  2. Друга питала, але міряла сузір'я як ПЛОСКУ мішень на відстані цілі.
//     Перспектива працює інакше: зірка з ближнього боку стоїть до камери
//     ближче за центр, і той самий відступ від осі займає в кадрі більше. На
//     широкому екрані так виїхали два краї.
//  3. Третя добирала відстань правильно, але добирала її під ГАБАРИТНУ
//     КОРОБКУ сузір'я, а не під самі зірки. Коробка має вісім кутів, і в
//     жодному з них зірки немає: після того, як кут зірки повів час, сузір'я
//     стало пологою дугою по один бік осі, а коробка лишилась симетричною.
//     Виміряно: на широкому екрані шлях займав 58% ширини й 50% висоти, решта
//     була порожнеча. Це і є вада, яку власник назвав «простір домінує над
//     сузір'ям».
//
// Тому тут не формула «розмір поділити на тангенс» і не коробка, а прямий
// добір по САМИХ ТІЛАХ: беремо кожну зірку як кулю, проєктуємо справжньою
// камерою і шукаємо найменшу відстань, з якої всі кулі всередині кадру.
// Дорожче на двадцять ітерацій раз на зміну розміру полотна — і не бреше.
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
/**
 * Скільки місця лишається навколо сузір'я.
 *
 * Зменшено з 1.1 після того, як власник назвав ваду прямо: простір домінує над
 * сузір'ям. Двійковий пошук уже дає найменшу відстань, з якої всі тіла
 * вміщаються ЦІЛКОМ, тобто запас тут — чиста порожнеча понад потрібну. Три
 * відсотки лишаються тільки на те, щоб крайня зірка не торкалась рамки, і на
 * дихання — воно розтягує зірку на кілька відсотків її розміру.
 */
const BREATHING_ROOM = 1.03;
/** Ближче цього до середини камера не підходить навіть на щипок. */
const CLOSEST = 7;
/** Кут підйому камери над площиною осі часу, рад. */
const ELEVATION = 0.3;
/** Межі й точність добору відстані. */
const SEARCH_MAX = 4_000;
const SEARCH_STEPS = 30;

/**
 * Тіло, яке мусить лишитись у кадрі: зірка події разом зі своїм радіусом.
 *
 * Координати — ВІДНОСНО середини сузір'я, бо камера обертається саме навколо
 * неї. Радіус тут силуету, а не ореолу: ореол м'який і згасає до нуля, тож
 * зрізаний його край побачити неможливо, а платити за нього довелось би
 * третиною кадру.
 */
export interface JourneyBody {
  x: number;
  y: number;
  z: number;
  radius: number;
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

/** Чи всі тіла видно з відстані `distance` уздовж `direction`. */
function allInside(
  bodies: readonly JourneyBody[],
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
  // Куля лежить усередині площини відсікання, коли її ЦЕНТР віддалений від
  // площини не менше ніж на радіус. Множники — довжини нормалей тих площин:
  // без них перевірка міряла б відстань уздовж осі кадру, а не по нормалі, і
  // на широкому полі зору зірка виїжджала б за край.
  const marginX = Math.hypot(1, tanX);
  const marginY = Math.hypot(1, tanY);

  for (const body of bodies) {
    const v: Vec = [body.x - eye[0], body.y - eye[1], body.z - eye[2]];
    const depth = dot(v, forward);
    // Тіло за спиною камери не «вміщається» — воно поза кадром назавжди.
    if (depth <= body.radius + 0.001) return false;
    if (Math.abs(dot(v, right)) - depth * tanX + body.radius * marginX > 0) return false;
    if (Math.abs(dot(v, trueUp)) - depth * tanY + body.radius * marginY > 0) return false;
  }
  return true;
}

export function journeyFraming(
  bodies: readonly JourneyBody[],
  viewport: JourneyViewport,
): JourneyFraming {
  // Порожнє небо теж треба чимось кадрувати: одна невидима куля в середині.
  const targets: readonly JourneyBody[] = bodies.length > 0
    ? bodies
    : [{ x: 0, y: 0, z: 0, radius: MINIMUM_EXTENT }];

  const radial = Math.max(
    MINIMUM_EXTENT,
    ...targets.map((body) => Math.hypot(body.x, body.y) + body.radius),
  );
  const axial = Math.max(
    MINIMUM_EXTENT,
    ...targets.map((body) => Math.abs(body.z) + body.radius),
  );

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

  // Двійковий пошук найменшої відстані, з якої всі тіла вміщаються цілком.
  let low = 0;
  let high = SEARCH_MAX;
  for (let step = 0; step < SEARCH_STEPS; step += 1) {
    const middle = (low + high) / 2;
    if (allInside(targets, direction, up, middle, tanY, tanX)) high = middle;
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
 * Наскільки далеко камера стоїть від розкритої події, у радіусах її сонця.
 *
 * Число прямо задає, яку частку вузької сторони кадру займе сонце: 3.05
 * означає приблизно третину півсторони.
 *
 * Було 2.1 — сонце заповнювало кадр майже цілком, і пара, відкривши подію,
 * втрачала сузір'я з очей повністю. Власник просив протилежного: подія
 * розкривається ВСЕРЕДИНІ шляху, а не замість нього. Тепер навколо сонця
 * лишається видимий шматок сузір'я, і зв'язок «ось де ця подія стоїть»
 * не рветься.
 */
const FOCUS_MARGIN = 3.05;

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
  return Math.max(radius * 2.2, (radius / tightest) * FOCUS_MARGIN);
}
