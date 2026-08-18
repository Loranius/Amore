// ============================================================
// Розкладка сузір'я «Наш шлях» у трьох вимірах.
// ------------------------------------------------------------
// Одна подія — одна зірка. Ніяких декоративних вузлів: усе, що світиться, має
// за собою запис пари.
//
// Три властивості, заради яких цей модуль лишається чистою функцією без React
// і без three:
//
//  1. **Детермінізм.** Координата виводиться з `id`, `date` і `stableHash32`.
//     Та сама пара бачить те саме сузір'я на будь-якому пристрої, і зберігати
//     координати в базі не треба.
//  2. **Старі зірки не рухаються.** Розміщення йде в порядку створення (`id`),
//     тож нова подія бачить усі попередні як зайняті, а сама поступається їм
//     місцем. Зворотного впливу немає — карта пари не перебудовується під нею.
//  3. **Промені не стають павутиною.** Кожна зірка, крім найпершої за датою,
//     дістає рівно один промінь — до попередньої за датою. Отже рівно n−1
//     променів на n зірок, жодних петель і жодного вузла-хаба.
//
// Що дала третя вісь понад пласку версію:
//
//  - **Час став віссю.** У 2D хронологію було видно лише по променях; тут вона
//    веде вздовж Z, а рівень події задає відстань від цієї осі. Ключові події
//    йдуть кістяком, важливі — ближнім кільцем, звичайні — зовнішнім.
//  - **Час веде ще й кут.** Спершу напрямок зірки брався від ПОРЯДКУ СТВОРЕННЯ
//    через золотий кут — і сусідні за датою події сідали в протилежних
//    напрямках. Власник назвав це точно: сузір'я читалось як network graph, а
//    не як шлях. Тепер кут виводиться з тієї самої координати часу, що й Z,
//    тож ланцюг лягає пологим гвинтом і читається як траєкторія.
//  - **Перевірка перетинів більше не потрібна.** У площині два промені
//    неминуче ріжуться, і на це пішло шість проходів; у просторі вони
//    розходяться по глибині, а глядач бачить перетин лише як збіг ракурсу —
//    і прибирає його обертанням.
//
// Ядро малюється в НУЛІ, але місце, яке воно дістало б за загальним правилом,
// лишається зайнятим. Саме це робить зміну ядра рухом рівно двох зірок:
// колишнє ядро повертається на своє й ніким не зайняте місце, нове йде в нуль,
// а решта неба не ворушиться.
// ============================================================
import { stableHash32 } from '@/engine/evolution/seed';
import {
  byChronology,
  coreIdOf,
  daysBetween,
  levelOf,
  type ConstellationEvent,
  type ConstellationLevel,
} from './constellationRules';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Star3D extends Vec3 {
  id: number;
  level: ConstellationLevel;
  /** Ядро сузір'я. Стоїть у нулі, скільки б років не було на осі. */
  core: boolean;
  /** Радіус самої зірки в одиницях сцени. */
  radius: number;
  /** Місце в ланцюгу за датою, з нуля. Керує чергою появи. */
  order: number;
}

export interface Edge3D {
  fromId: number;
  toId: number;
  from: Vec3;
  to: Vec3;
}

export interface Constellation3D {
  stars: Star3D[];
  edges: Edge3D[];
  /** Найдальша зірка від нуля. */
  reach: number;
  /**
   * Середина сузір'я — те, на що дивиться камера.
   *
   * Це НЕ ядро. Ядро стоїть у нулі осі часу, тобто на самому початку шляху, і
   * камера, наведена на нього, показує половину кадру порожньою, а дальній
   * кінець лишає за краєм. Виміряно на живому екрані: з восьми зірок одна
   * висіла за верхнім краєм, а нижня третина кадру була порожня.
   *
   * Ядро лишається головним не місцем у кадрі, а розміром і кольором.
   */
  centre: Vec3;
  /** Півдовжина сузір'я вздовж осі часу, від середини. */
  axial: number;
  /**
   * Найбільший відступ від осі часу — «товщина» сузір'я.
   *
   * Окремо від `axial`, бо кадрування різне по осях: уздовж часу сузір'я
   * розтягнуте, впоперек — ні, і на портретному екрані ці два числа впираються
   * у РІЗНІ сторони кадру.
   */
  radial: number;
  /** Протяжність осі часу: від найранішої події до найпізнішої. */
  span: number;
}

/** Скільки одиниць сцени бере один рік стосунків. */
const YEAR_UNITS = 12;
/** Доба року за григоріанським календарем — щоб високосні не зсували вісь. */
const DAYS_IN_YEAR = 365.2425;
/**
 * Скільки років вісь показує один до одного, і як стискає далі.
 *
 * Перші вісім років ідуть без спотворення — саме там живе більшість подій.
 * Далі відстань росте логарифмічно: пара з двадцятилітнім стажем не мусить
 * летіти крізь двісті сорок одиниць порожнечі, але й не втрачає порядок
 * подій — функція лишається строго зростаючою.
 */
const LINEAR_YEARS = 8;
const COMPRESSED_SCALE = 2.5;

/**
 * Кільця орбіт.
 *
 * Два обмеження, і обидва виміряні, а не вибрані на смак.
 *
 * **Знизу** — ядро. Воно малюється в нулі, тобто просто на осі часу, і мусить
 * туди сісти, нікого не зачепивши. Найближче, що взагалі може там опинитись —
 * ключова зірка на 7.6 одиницях; їй треба 2.8 + 2.0 + 2.4 = 7.2. Запас
 * лишається, і саме тому `key.min` не можна опускати нижче без перерахунку —
 * і не можна збільшувати зірки, не перерахувавши його. Останнє збільшення
 * підняло цю межу з 6.5 рівно тому, що ядро виросло з 2.1 до 2.8.
 *
 * **Згори** — портретний екран. Зовнішнє кільце визначає, наскільки далеко
 * камері доводиться відійти, щоб сузір'я вмістилось у ВУЖЧУ сторону кадру, а
 * на телефоні вона вдвічі вужча за поле зору по вертикалі. Перша редакція мала
 * зовнішнє кільце на 25 — на живому екрані пара побачила половину свого шляху
 * за краєм кадру. Виміряно й звужено.
 */
const ORBIT: Record<ConstellationLevel, { min: number; max: number }> = {
  key: { min: 7.6, max: 9.6 },
  important: { min: 10.4, max: 12.8 },
  regular: { min: 13.2, max: 16 },
};

/**
 * Розміри зірок.
 *
 * Виміряно на живому екрані й збільшено ДВІЧІ. Перший раз — бо звичайна зірка
 * радіуса 0.6 займала на телефоні сім пікселів, і бірюзова від жовтої не
 * відрізнялась ніяк. Другий — бо власник назвав ваду прямо: простір домінує
 * над сузір'ям, зірки дрібні, порожнечі забагато.
 *
 * Співвідношення 1 / 1.35 / 1.74 — це вже сама по собі ієрархія: рівень видно
 * розміром, а не лише кольором, і воно лишається чинним, коли колір несе
 * власний вибір пари.
 */
const STAR_RADIUS: Record<ConstellationLevel, number> = {
  key: 2,
  important: 1.55,
  regular: 1.15,
};

/** Ядро більше за все інше: воно тримає сузір'я на собі. */
export const CORE_STAR_RADIUS = 2.8;

/** Мінімальний просвіт між поверхнями двох зірок. */
const STAR_GAP = 2.4;
/** Скільки позицій пробує нова зірка, перш ніж узяти найкращу з невдалих. */
const PLACEMENT_ATTEMPTS = 40;

/**
 * Скільки радіан кут проходить за РІК осі часу.
 *
 * Це і є виправлення вади, яку власник назвав «network graph, а не шлях».
 *
 * Було: `index * GOLDEN_ANGLE`, де `index` — порядок СТВОРЕННЯ. Золотий кут
 * розкидає напрямки рівномірно, і саме тому дві сусідні за датою події сідали
 * в напрямках, що різняться на 137°. Ланцюг за датою після цього не міг не
 * зигзагувати: він мусив щоразу перестрибувати через усю трубу.
 *
 * Стало: кут веде та сама координата, що й Z. Повний оберт за шість років —
 * досить, щоб зірки не збирались в одну лінію, і достатньо мало, щоб сусідні
 * за датою події стояли поруч і за кутом. Ланцюг лягає пологим гвинтом.
 *
 * Інваріант «стара зірка не рухається» від цього не постраждав, і це не
 * випадковість: кут виводиться з ВЛАСНОЇ дати події, а не з її рангу серед
 * інших. Подія, додана заднім числом, нікого не зсуває — рівно як і раніше.
 */
const WINDING_RATE = (2 * Math.PI) / 6;
/**
 * ПОЧАТКОВИЙ розкид навколо кута часу, радіани.
 *
 * Дрібний навмисно: він має розбити креслення, а не зіпсувати гвинт. Зірка,
 * якій на своєму напрямку тісно, розширює пошук із кожною спробою аж до
 * повного кола — без цього всі спроби лежать в одному вузькому секторі й
 * чотириста проб дають рівно стільки ж, скільки двадцять (виміряно ще на
 * пласкій версії). Саме ця сходинка й розводить події, що сіли на один тиждень
 * і тому мають однаковий кут часу.
 */
const ANGLE_JITTER = 0.26;

/**
 * Дробове число з хешу в [0, 1).
 *
 * Фіналізатор обов'язковий: FNV-1a слабко розмиває останній байт, а солі
 * сусідніх координат різняться саме ним. У фоновому полі зірок це вже одного
 * разу зібрало крапки в пари й виклало їх діагональними смугами.
 */
function unit(seed: string): number {
  let value = stableHash32(seed);
  value ^= value >>> 16;
  value = Math.imul(value, 0x21f0aaad) >>> 0;
  value ^= value >>> 15;
  value = Math.imul(value, 0x735a2d97) >>> 0;
  value ^= value >>> 15;
  return (value >>> 0) / 4294967296;
}

/**
 * Кут гвинта для точки осі часу.
 *
 * Виводиться з КООРДИНАТИ, а не з років: вісь часу нелінійна після восьмого
 * року, і кут, що йшов би за сирими роками, розкручувався б там, де відстань
 * уже стиснута. Гвинт лишається рівним у сцені саме тому, що обидві його
 * координати читають одне й те саме число.
 */
export function pathAngle(z: number): number {
  return (z / YEAR_UNITS) * WINDING_RATE;
}

/** Роки стосунків у одиниці осі. Строго зростаюча, непарна за знаком. */
export function timeAxis(days: number): number {
  const years = days / DAYS_IN_YEAR;
  const magnitude = Math.abs(years);
  const scaled = magnitude <= LINEAR_YEARS
    ? magnitude
    : LINEAR_YEARS + Math.log1p(magnitude - LINEAR_YEARS) * COMPRESSED_SCALE;
  return Math.sign(years) * scaled * YEAR_UNITS;
}

interface Placed extends Vec3 {
  radius: number;
}

/**
 * Наскільки позиція вільна: додатне — просвіт є, від'ємне — глибина накладання.
 * Порожнє небо дає `Infinity`, тож перша зірка сідає з першої спроби.
 */
function clearance(spot: Vec3, radius: number, placed: readonly Placed[]): number {
  let worst = Number.POSITIVE_INFINITY;
  for (const other of placed) {
    const distance = Math.hypot(spot.x - other.x, spot.y - other.y, spot.z - other.z);
    const gap = distance - (radius + other.radius + STAR_GAP);
    if (gap < worst) worst = gap;
  }
  return worst;
}

/**
 * Місце зірки за загальним правилом — незалежно від того, чи вона ядро.
 *
 * Незалежність тут не дрібниця: якби ядро пропускало розміщення, набір
 * перешкод залежав би від того, хто саме ядро, і поява одруження перебудувала б
 * усю карту замість двох зірок.
 */
function placeStar(
  event: ConstellationEvent,
  z: number,
  radius: number,
  placed: readonly Placed[],
): Placed {
  const orbit = ORBIT[levelOf(event)];
  const base = pathAngle(z);
  let best: Placed | null = null;
  let bestGap = Number.NEGATIVE_INFINITY;

  for (let attempt = 0; attempt < PLACEMENT_ATTEMPTS; attempt += 1) {
    const spread = ANGLE_JITTER + (attempt / PLACEMENT_ATTEMPTS) * (Math.PI - ANGLE_JITTER);
    const jitter = (unit(`a${event.id}:${event.date}:${attempt}`) * 2 - 1) * spread;
    const angle = base + jitter;
    const reach = orbit.min
      + unit(`r${event.id}:${event.date}:${attempt}`) * (orbit.max - orbit.min);
    const spot: Placed = {
      x: Math.cos(angle) * reach,
      y: Math.sin(angle) * reach,
      z,
      radius,
    };

    const gap = clearance(spot, radius, placed);
    if (gap >= 0) return spot;
    if (gap > bestGap) {
      bestGap = gap;
      best = spot;
    }
  }

  // Небо тісне: беремо найменш погану з проб. Зсувати вже розміщені зірки не
  // можна — це зламало б карту, яку пара вже бачила.
  return best!;
}

export function buildConstellation3D(
  events: readonly ConstellationEvent[],
): Constellation3D {
  const chain = [...events].sort(byChronology);
  if (chain.length === 0) {
    return {
      stars: [],
      edges: [],
      reach: 0,
      centre: { x: 0, y: 0, z: 0 },
      axial: 0,
      radial: 0,
      span: 0,
    };
  }

  const coreId = coreIdOf(chain);
  const orderById = new Map(chain.map((event, index) => [event.id, index]));

  // Розміщення — у порядку створення, щоб поява нової події не пересунула
  // жодну зі старих зірок. Ланцюг променів рахується окремо, за датою.
  const byCreation = [...events].sort((a, b) => a.id - b.id);

  // Початок відліку часу — ПЕРША записана подія пари, а не ядро.
  //
  // Спокуса взяти ядро велика: воно ж головна дата. Але вісь тоді залежала б
  // від того, хто ядро, а ядро змінюється — і поява одруження зсунула б час
  // усім. Через нелінійне стиснення далеких років це навіть не був би
  // однаковий зсув, тобто карта перебудувалась би по-справжньому. Найменший
  // `id` не змінюється ніколи: нова подія завжди дістає більший.
  const anchor = byCreation[0]!.date;

  const placed: Placed[] = [];
  const homes = new Map<number, Placed>();
  for (const event of byCreation) {
    // Радіус для перевірки тісноти береться за РІВНЕМ, а не за роллю: ядро
    // більше за розміром, але роль змінюється, і разом з нею змінився б набір
    // перешкод для всіх наступних зірок.
    const radius = STAR_RADIUS[levelOf(event)];
    const spot = placeStar(event, timeAxis(daysBetween(anchor, event.date)), radius, placed);
    placed.push(spot);
    homes.set(event.id, spot);
  }

  const stars: Star3D[] = chain.map((event) => {
    const home = homes.get(event.id)!;
    const core = event.id === coreId;
    return {
      id: event.id,
      level: levelOf(event),
      core,
      // Ядро сідає в нуль; його власне місце лишається зайнятим у `placed`.
      x: core ? 0 : home.x,
      y: core ? 0 : home.y,
      z: core ? 0 : home.z,
      radius: core ? CORE_STAR_RADIUS : home.radius,
      order: orderById.get(event.id)!,
    };
  });

  const byId = new Map(stars.map((star) => [star.id, star]));
  const edges: Edge3D[] = [];
  for (let index = 1; index < chain.length; index += 1) {
    const from = byId.get(chain[index - 1]!.id)!;
    const to = byId.get(chain[index]!.id)!;
    edges.push({
      fromId: from.id,
      toId: to.id,
      from: { x: from.x, y: from.y, z: from.z },
      to: { x: to.x, y: to.y, z: to.z },
    });
  }

  const reach = stars.reduce(
    (worst, star) => Math.max(worst, Math.hypot(star.x, star.y, star.z) + star.radius),
    0,
  );

  // Габарит рахується по КРАЯХ тіл, не по центрах: зірка радіуса 1.6, чий
  // центр рівно на межі кадру, показала б парі половину себе.
  const bound = (pick: (star: Star3D) => number) => {
    const low = Math.min(...stars.map((star) => pick(star) - star.radius));
    const high = Math.max(...stars.map((star) => pick(star) + star.radius));
    return { low, high, middle: (low + high) / 2, half: (high - low) / 2 };
  };
  const x = bound((star) => star.x);
  const y = bound((star) => star.y);
  const z = bound((star) => star.z);
  const centre = { x: x.middle, y: y.middle, z: z.middle };
  const radial = stars.reduce(
    (worst, star) => Math.max(
      worst,
      Math.hypot(star.x - centre.x, star.y - centre.y) + star.radius,
    ),
    0,
  );

  const zs = stars.map((star) => star.z);
  return {
    stars,
    edges,
    reach,
    centre,
    axial: z.half,
    radial,
    span: Math.max(...zs) - Math.min(...zs),
  };
}
