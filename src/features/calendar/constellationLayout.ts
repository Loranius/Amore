// ============================================================
// Розкладка сузір'я «Наш шлях».
// ------------------------------------------------------------
// Одна подія — одна зірка. Ніяких декоративних вузлів: усе, що світиться,
// має за собою запис пари.
//
// Три властивості, заради яких цей модуль існує окремо від React:
//
//  1. Детермінізм. Позиція зірки виводиться з `id` та `date` самої події
//     через `stableHash32`. Та сама пара бачить те саме сузір'я на будь-якому
//     пристрої, і координати не треба зберігати в базі.
//  2. Старі зірки не рухаються. Розміщення йде в порядку створення (`id`),
//     тож нова подія бачить усі попередні як зайняті, а сама поступається їм
//     місцем. Зворотного впливу немає — карта пари не перебудовується під нею.
//  3. Промені не стають павутиною. Кожна зірка, крім найпершої за датою,
//     дістає рівно один промінь — до попередньої за датою. Отже рівно n−1
//     променів на n зірок, жодних петель і жодного вузла-хаба.
//
// Третя властивість — не питання смаку. Правило «з'єднай з найближчою» дає
// на сімох подіях пристойний вигляд, а на тридцяти — сітку з перетинами.
// Один промінь на зірку робить павутину неможливою за побудовою.
// ============================================================
import { stableHash32 } from '@/engine/evolution/seed';

/** Рівень події. `important` з'явиться разом із міграцією `significance`. */
export type ConstellationLevel = 'key' | 'regular';

export interface ConstellationInput {
  id: number;
  /** ISO `YYYY-MM-DD`. Порівнюється як рядок — без локалі. */
  date: string;
  milestone: boolean;
}

export interface ConstellationStar {
  id: number;
  level: ConstellationLevel;
  /** Ядро сузір'я — найраніша ключова подія. Стоїть у центрі кадру. */
  core: boolean;
  x: number;
  y: number;
  radius: number;
  /** Місце в ланцюгу за датою, з нуля. Керує чергою появи. */
  order: number;
}

export interface ConstellationEdge {
  fromId: number;
  toId: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface ConstellationLayout {
  stars: ConstellationStar[];
  edges: ConstellationEdge[];
  width: number;
  height: number;
}

/** Портретне полотно: модуль живе на телефоні. */
export const CONSTELLATION_WIDTH = 100;
export const CONSTELLATION_HEIGHT = 134;

const CENTRE_X = CONSTELLATION_WIDTH / 2;
const CENTRE_Y = CONSTELLATION_HEIGHT / 2;
/** Кадр вищий за ширину — орбіти розтягнуті, щоб не збиватись у смугу. */
const ORBIT_ASPECT = 1.34;
const MARGIN = 7;
/** Скільки позицій пробує нова зірка, перш ніж узяти найкращу з невдалих. */
const PLACEMENT_ATTEMPTS = 28;
/**
 * Золотий кут: база напрямку для n-ї за створенням зірки.
 *
 * Чистий хеш давав нерівний розподіл — на живому екрані цієї пари верхня
 * третина неба лишилась порожньою, а сім зірок збились у середину. Золотий
 * кут розкидає напрямки рівномірно за будь-якої кількості подій, а хеш
 * лишається джерелом відхилення, щоб сузір'я не виглядало кресленням.
 *
 * Індекс береться з порядку створення, тож у вже розміщеної зірки він ніколи
 * не змінюється — нова подія отримує наступний і нікого не зрушує.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
/** Наскільки хеш може відхилити зірку від її золотого напрямку, радіани. */
const ANGLE_JITTER = 0.42;
/** Мінімальний просвіт між дисками двох зірок. */
const STAR_GAP = 1.7;

const ORBIT: Record<ConstellationLevel, { min: number; max: number }> = {
  key: { min: 14, max: 25 },
  regular: { min: 28, max: 41 },
};

const CORE_RADIUS = 4.6;
const STAR_RADIUS: Record<ConstellationLevel, number> = {
  key: 3.2,
  regular: 2.3,
};

interface Placed {
  x: number;
  y: number;
  radius: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function levelOf(event: ConstellationInput): ConstellationLevel {
  return event.milestone ? 'key' : 'regular';
}

/** Хронологія: ISO-дата, далі `id` — щоб порядок був повним і стабільним. */
function byChronology(a: ConstellationInput, b: ConstellationInput): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return a.id - b.id;
}

/**
 * Наскільки позиція вільна: додатне — просвіт є, від'ємне — глибина накладання.
 * Порожнє небо дає `Infinity`, тож перша зірка сідає з першої спроби.
 */
function clearance(x: number, y: number, radius: number, placed: readonly Placed[]): number {
  let worst = Number.POSITIVE_INFINITY;
  for (const other of placed) {
    const distance = Math.hypot(x - other.x, y - other.y);
    const gap = distance - (radius + other.radius + STAR_GAP);
    if (gap < worst) worst = gap;
  }
  return worst;
}

function placeStar(
  event: ConstellationInput,
  index: number,
  radius: number,
  placed: readonly Placed[],
): Placed {
  const orbit = ORBIT[levelOf(event)];
  let best: Placed | null = null;
  let bestClearance = Number.NEGATIVE_INFINITY;

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const hash = stableHash32(`${event.id}${event.date}${attempt}`);
    const jitter = (((hash % 2000) / 2000) * 2 - 1) * ANGLE_JITTER;
    const angle = index * GOLDEN_ANGLE + jitter;
    const reach = orbit.min + (((hash >>> 12) % 1000) / 1000) * (orbit.max - orbit.min);
    const x = clamp(CENTRE_X + Math.cos(angle) * reach, MARGIN, CONSTELLATION_WIDTH - MARGIN);
    const y = clamp(
      CENTRE_Y + Math.sin(angle) * reach * ORBIT_ASPECT,
      MARGIN,
      CONSTELLATION_HEIGHT - MARGIN,
    );

    const gap = clearance(x, y, radius, placed);
    if (gap >= 0) return { x, y, radius };
    if (gap > bestClearance) {
      bestClearance = gap;
      best = { x, y, radius };
    }
  }

  // Небо переповнене: беремо найменш тісну з проб. Зсувати вже розміщені
  // зірки не можна — це зламало б карту, яку пара вже бачила.
  return best ?? { x: CENTRE_X, y: CENTRE_Y, radius };
}

export function buildConstellation(events: readonly ConstellationInput[]): ConstellationLayout {
  const chain = [...events].sort(byChronology);
  if (chain.length === 0) {
    return { stars: [], edges: [], width: CONSTELLATION_WIDTH, height: CONSTELLATION_HEIGHT };
  }

  const coreId = chain.find((event) => event.milestone)?.id ?? null;
  const orderById = new Map(chain.map((event, index) => [event.id, index]));

  // Розміщення — у порядку створення, щоб поява нової події не пересунула
  // жодну зі старих зірок. Ланцюг променів окремо, за датою.
  const placementOrder = [...events].sort((a, b) => a.id - b.id);
  const placed: Placed[] = [];
  const positions = new Map<number, Placed>();

  placementOrder.forEach((event, index) => {
    const core = event.id === coreId;
    const radius = core ? CORE_RADIUS : STAR_RADIUS[levelOf(event)];
    const spot = core
      ? { x: CENTRE_X, y: CENTRE_Y, radius }
      : placeStar(event, index, radius, placed);
    positions.set(event.id, spot);
    placed.push(spot);
  });

  const stars: ConstellationStar[] = chain.map((event) => {
    const spot = positions.get(event.id)!;
    return {
      id: event.id,
      level: levelOf(event),
      core: event.id === coreId,
      x: spot.x,
      y: spot.y,
      radius: spot.radius,
      order: orderById.get(event.id)!,
    };
  });

  const edges: ConstellationEdge[] = [];
  for (let index = 1; index < chain.length; index += 1) {
    const from = positions.get(chain[index - 1]!.id)!;
    const to = positions.get(chain[index]!.id)!;
    edges.push({
      fromId: chain[index - 1]!.id,
      toId: chain[index]!.id,
      x1: from.x,
      y1: from.y,
      x2: to.x,
      y2: to.y,
    });
  }

  return { stars, edges, width: CONSTELLATION_WIDTH, height: CONSTELLATION_HEIGHT };
}
