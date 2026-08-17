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
//  4. Промені намагаються не перетинатись. Обираючи місце, зірка звіряє свої
//     майбутні промені з усіма, що вже проведені, і відступає, якщо ріже
//     чужий.
//
// Третя властивість — не питання смаку. Правило «з'єднай з найближчою» дає
// на сімох подіях пристойний вигляд, а на тридцяти — сітку з перетинами.
// Один промінь на зірку робить павутину неможливою за побудовою.
//
// Четверта — намагання, а не гарантія, і це чесно виміряно: на семи подіях
// цієї пари перетинів нуль, на тридцяти лишається близько двадцяти. Далі їх
// прибирає лише свобода рухати вже показані зірки, а вона дорожча.
// ============================================================
import { type EventSignificance } from '@/types';
import { stableHash32 } from '@/engine/evolution/seed';

/** Вага зірки в кадрі: три розміри, три орбіти. */
export type ConstellationLevel = 'key' | 'important' | 'regular';

export interface ConstellationInput {
  id: number;
  /** ISO `YYYY-MM-DD`. Порівнюється як рядок — без локалі. */
  date: string;
  significance: EventSignificance;
  /**
   * Довжина назви в символах — рівно стільки розкладка знає про текст.
   *
   * Без неї габарит підпису доводилось брати константою на рівень, і модель
   * розходилась із реальністю: «Познайомився з мамою Оксаною» займає три
   * рядки й 48 px, а «Пропозиція» — один і 24. Три перетини підписів на
   * живому екрані взялись саме звідти.
   */
  titleLength: number;
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
  /** Довжина назви — потрібна, щоб оцінити габарит підпису. */
  titleLength: number;
  /**
   * Центр підпису в координатах полотна.
   *
   * Підпис має кожна подія, тож у тісному кадрі телефона вони налазять.
   * Розкладка пробує чотири місця навколо зірки — знизу, згори, праворуч,
   * ліворуч — і бере перше, де нічого не накриває. Координата вже затиснута
   * в межі кадру: «Здав на права» колись перетворилось на «в на права», бо
   * підпис ширший за зірку й виїжджав за край.
   */
  labelX: number;
  labelY: number;
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
export const CONSTELLATION_HEIGHT = 168;

const CENTRE_X = CONSTELLATION_WIDTH / 2;
const CENTRE_Y = CONSTELLATION_HEIGHT / 2;
/**
 * Кадр вищий за ширину — орбіти розтягнуті, щоб не збиватись у смугу.
 *
 * Піднято разом із висотою полотна: підпис із датою вдвічі вищий за колишній
 * (36–48 px проти 22), і на кадрі 100×134 сім таких не розходились — три
 * перетини лишались за будь-якого вибору боку.
 */
const ORBIT_ASPECT = 1.62;
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
/**
 * Наскільки хеш може відхилити зірку від її золотого напрямку, радіани.
 *
 * Це лише ПОЧАТКОВИЙ розкид. Зірка, якій на своєму напрямку тісно або чиї
 * промені там перетинають чужі, розширює пошук із кожною спробою аж до
 * повного кола. Без цього всі спроби лежали в секторі ±24° і були
 * практично одним місцем: чотириста проб давали рівно стільки ж перетинів,
 * скільки двадцять вісім — виміряно.
 */
const ANGLE_JITTER = 0.42;
/** Мінімальний просвіт між дисками двох зірок. */
const STAR_GAP = 1.7;

const ORBIT: Record<ConstellationLevel, { min: number; max: number }> = {
  key: { min: 13, max: 22 },
  important: { min: 22, max: 32 },
  regular: { min: 31, max: 42 },
};

export interface Point {
  x: number;
  y: number;
}

const CORE_RADIUS = 4.6;

/**
 * Два місця, зарезервовані під ключові події, і зарезервовані **завжди** —
 * навіть коли пара ще не назвала жодної.
 *
 * Інакше «рухаються рівно дві зірки» лишається побажанням. Ключових видів
 * рівно два, і коли одруження забирає центр, початок відносин мусить кудись
 * піти. Якби він шукав місце хешем, він зайняв би нову точку, і всі, кого
 * ставили після нього, побачили б іншу перешкоду — карта перебудувалась би
 * цілком. Коли обидва місця зайняті постійно, набір перешкод не залежить від
 * того, хто в якому сидить, і зміна ядра нікого стороннього не чіпає.
 *
 * Друге місце — трохи нижче й правіше центру: корона переходить донизу.
 */
const CORE_SPOT: Point = { x: CENTRE_X, y: CENTRE_Y };
const SECOND_KEY_SPOT: Point = { x: CENTRE_X + 9.5, y: CENTRE_Y + 22 };
const STAR_RADIUS: Record<ConstellationLevel, number> = {
  key: 3.4,
  important: 2.9,
  regular: 2.1,
};

interface Placed {
  x: number;
  y: number;
  radius: number;
}

/** Знак векторного добутку — з якого боку від AB лежить C. */
function turn(a: Point, b: Point, c: Point): number {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (value > 1e-9) return 1;
  if (value < -1e-9) return -1;
  return 0;
}

/**
 * Чи перетинаються відрізки по-справжньому — тобто всередині, а не кінцями.
 *
 * Спільний кінець дає нуль в одному з поворотів і сюди не рахується: сусідні
 * промені ланцюга завжди сходяться в зірці, і це не перетин.
 */
export function segmentsCross(a: Point, b: Point, c: Point, d: Point): boolean {
  return turn(a, b, c) * turn(a, b, d) < 0 && turn(c, d, a) * turn(c, d, b) < 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function levelOf(event: ConstellationInput): ConstellationLevel {
  if (event.significance === 'marriage' || event.significance === 'relationship_start') return 'key';
  return event.significance === 'important' ? 'important' : 'regular';
}

/**
 * Ядро — роль, а не подія: одруження забирає центр у початку відносин.
 *
 * Стосунки ростуть, і головна дата пари з часом змінюється. Поки одруження
 * немає, центр належить початку відносин; щойно воно з'являється, центр
 * переходить до нього, а початок відносин лишається ключовим і йде в
 * ближнє кільце. Рівень, який поставила пара, при цьому не чіпається.
 */
function coreIdOf(events: readonly ConstellationInput[]): number | null {
  const marriage = events.find((event) => event.significance === 'marriage');
  if (marriage) return marriage.id;
  return events.find((event) => event.significance === 'relationship_start')?.id ?? null;
}

/**
 * Метрики підпису в координатах полотна, за рівнем.
 *
 * Виміряні на живому екрані в кадрі 378×507, не вгадані: `maxChars` дублює
 * `max-width` у `ch` зі стилю, `charWidth` — фактична ширина знака при тому
 * кеглі, `titleLine` і `dateLine` — висоти рядків назви й дати.
 */
const LABEL_METRICS: Record<'core' | ConstellationLevel, {
  maxChars: number;
  charWidth: number;
  titleLine: number;
  dateLine: number;
}> = {
  core: { maxChars: 17, charWidth: 1.95, titleLine: 3.71, dateLine: 2.99 },
  key: { maxChars: 16, charWidth: 1.78, titleLine: 3.39, dateLine: 2.73 },
  important: { maxChars: 15, charWidth: 1.61, titleLine: 3.06, dateLine: 2.47 },
  regular: { maxChars: 15, charWidth: 1.61, titleLine: 3.06, dateLine: 2.47 },
};

/** Стеля переносу назви — та сама, що `-webkit-line-clamp` у стилі. */
const LABEL_MAX_LINES = 2;
/** Ширина рядка дати у знаках: «12 серпня 2023» без «р.». */
const DATE_CHARS = 14;
/** Просвіт між диском зірки й підписом. */
const LABEL_GAP = 1.8;

export interface Rect { left: number; top: number; right: number; bottom: number; }

export function labelSizeOf(
  star: { level: ConstellationLevel; core: boolean; titleLength: number },
): { width: number; height: number } {
  const metric = LABEL_METRICS[star.core ? 'core' : star.level];
  const lines = Math.min(
    LABEL_MAX_LINES,
    Math.max(1, Math.ceil(star.titleLength / metric.maxChars)),
  );
  const titleWidth = Math.min(star.titleLength, metric.maxChars) * metric.charWidth;
  return {
    width: Math.max(titleWidth, DATE_CHARS * metric.charWidth * 0.82),
    height: lines * metric.titleLine + metric.dateLine + 0.3,
  };
}

/** Прямокутник підпису з центром у точці, затиснутий у межі кадру. */
function rectAt(centreX: number, centreY: number, width: number, height: number): Rect {
  const x = clamp(centreX, width / 2, CONSTELLATION_WIDTH - width / 2);
  const y = clamp(centreY, height / 2, CONSTELLATION_HEIGHT - height / 2);
  return { left: x - width / 2, right: x + width / 2, top: y - height / 2, bottom: y + height / 2 };
}

/** Площа накриття двох прямокутників; нуль — не торкаються. */
export function overlapArea(a: Rect, b: Rect): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left);
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
  return width > 0 && height > 0 ? width * height : 0;
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

/**
 * Скільки наявних променів перетне зірка, якщо сяде сюди.
 *
 * `chain` — хронологічний порядок УЖЕ розміщених зірок. Саме префікс, а не
 * повна історія: інакше подія, додана заднім числом, змінила б сусідство
 * старих зірок, їхня перевірка дала б інший результат — і карта, яку пара вже
 * бачила, перебудувалась би під нею.
 *
 * Через це перевірка виходить не наближенням, а повною: коли промінь
 * народжується, він звіряється з усіма, що вже існують, а кожен пізніший
 * звіриться з ним. Двох променів, які не бачили один одного, не лишається.
 */
function crossingsAt(
  candidate: Point,
  slot: number,
  chain: readonly number[],
  positions: ReadonlyMap<number, Placed>,
): number {
  const previous = slot > 0 ? positions.get(chain[slot - 1]!)! : null;
  const next = slot < chain.length ? positions.get(chain[slot]!)! : null;
  const fresh: Array<readonly [Point, Point]> = [];
  if (previous) fresh.push([previous, candidate]);
  if (next) fresh.push([candidate, next]);
  if (fresh.length === 0) return 0;

  let crossings = 0;
  for (let index = 1; index < chain.length; index += 1) {
    // Промінь, який ця зірка розриває, зникне — звірятись із ним не треба.
    if (index === slot) continue;
    const from = positions.get(chain[index - 1]!)!;
    const to = positions.get(chain[index]!)!;
    for (const [a, b] of fresh) {
      if (segmentsCross(a, b, from, to)) crossings += 1;
    }
  }
  return crossings;
}

function placeStar(
  event: ConstellationInput,
  index: number,
  radius: number,
  placed: readonly Placed[],
  slot: number,
  chain: readonly number[],
  positions: ReadonlyMap<number, Placed>,
): Placed {
  const orbit = ORBIT[levelOf(event)];
  let best: Placed | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const hash = stableHash32(`${event.id}${event.date}${attempt}`);
    const spread = ANGLE_JITTER
      + (attempt / PLACEMENT_ATTEMPTS) * (Math.PI - ANGLE_JITTER);
    const jitter = (((hash % 2000) / 2000) * 2 - 1) * spread;
    const angle = index * GOLDEN_ANGLE + jitter;
    const reach = orbit.min + (((hash >>> 12) % 1000) / 1000) * (orbit.max - orbit.min);
    const x = clamp(CENTRE_X + Math.cos(angle) * reach, MARGIN, CONSTELLATION_WIDTH - MARGIN);
    const y = clamp(
      CENTRE_Y + Math.sin(angle) * reach * ORBIT_ASPECT,
      MARGIN,
      CONSTELLATION_HEIGHT - MARGIN,
    );

    const gap = clearance(x, y, radius, placed);
    const crossings = crossingsAt({ x, y }, slot, chain, positions);
    if (gap >= 0 && crossings === 0) return { x, y, radius };

    // Накладання зірок гірше за перетин: перше читається як вада, друге —
    // щонайбільше як неохайність.
    const penalty = (gap >= 0 ? 0 : -gap * 10) + crossings;
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      best = { x, y, radius };
    }
  }

  // Небо переповнене: беремо найменш погану з проб. Зсувати вже розміщені
  // зірки не можна — це зламало б карту, яку пара вже бачила.
  return best ?? { x: CENTRE_X, y: CENTRE_Y, radius };
}

export function buildConstellation(events: readonly ConstellationInput[]): ConstellationLayout {
  const chain = [...events].sort(byChronology);
  if (chain.length === 0) {
    return { stars: [], edges: [], width: CONSTELLATION_WIDTH, height: CONSTELLATION_HEIGHT };
  }

  const coreId = coreIdOf(chain);
  const orderById = new Map(chain.map((event, index) => [event.id, index]));

  // Розміщення — у порядку створення, щоб поява нової події не пересунула
  // жодну зі старих зірок. Ланцюг променів окремо, за датою.
  const placementOrder = [...events].sort((a, b) => a.id - b.id);
  const placed: Placed[] = [];
  const positions = new Map<number, Placed>();

  // Хронологічний ланцюг тих зірок, що вже стоять. Він росте разом із
  // розміщенням і слугує єдиним, що знає нова зірка про промені.
  const prefixChain: ConstellationInput[] = [];


  // Обидва ключові місця зайняті від початку й незалежно від даних — саме це
  // робить зміну ядра рухом рівно двох зірок, а не перебудовою карти.
  placed.push({ ...CORE_SPOT, radius: CORE_RADIUS });
  placed.push({ ...SECOND_KEY_SPOT, radius: STAR_RADIUS.key });

  placementOrder.forEach((event, index) => {
    const core = event.id === coreId;
    const key = levelOf(event) === 'key';
    const radius = core ? CORE_RADIUS : STAR_RADIUS[levelOf(event)];
    let slot = prefixChain.length;
    for (let at = 0; at < prefixChain.length; at += 1) {
      if (byChronology(event, prefixChain[at]!) < 0) {
        slot = at;
        break;
      }
    }

    let spot: Placed;
    if (core) {
      spot = { ...CORE_SPOT, radius };
    } else if (key) {
      spot = { ...SECOND_KEY_SPOT, radius };
    } else {
      spot = placeStar(
        event,
        index,
        radius,
        placed,
        slot,
        prefixChain.map((placedEvent) => placedEvent.id),
        positions,
      );
      // Ключові місця вже в `placed` від початку; додавати їх удруге не можна.
      placed.push(spot);
    }

    positions.set(event.id, spot);
    prefixChain.splice(slot, 0, event);
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
      labelX: spot.x,
      labelY: spot.y,
      titleLength: event.titleLength,
    };
  });

  // Місце підпису обирається жадібно, у хронологічному порядку: кожен новий
  // бере перше з чотирьох, де нічого не накриває. Порядок переваги — знизу,
  // згори, праворуч, ліворуч: підпис під зіркою читається найприродніше.
  //
  // Двох варіантів не вистачало. І згори, і знизу давали по одному накриттю,
  // жадібність брала менше зло — і підпис «Купили Nissan Tiida» лишався на
  // підписі ядра. Виміряно на живому екрані.
  const taken: Rect[] = [];
  for (const star of stars) {
    const { width, height } = labelSizeOf(star);
    const gap = star.radius + LABEL_GAP;
    const candidates: Rect[] = [
      rectAt(star.x, star.y + gap + height / 2, width, height),
      rectAt(star.x, star.y - gap - height / 2, width, height),
      rectAt(star.x + gap + width / 2, star.y, width, height),
      rectAt(star.x - gap - width / 2, star.y, width, height),
    ];

    let best = candidates[0]!;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
      const cost = taken.reduce((sum, rect) => sum + overlapArea(candidate, rect), 0);
      if (cost === 0) { best = candidate; break; }
      if (cost < bestCost) { bestCost = cost; best = candidate; }
    }

    star.labelX = (best.left + best.right) / 2;
    star.labelY = (best.top + best.bottom) / 2;
    taken.push(best);
  }

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
