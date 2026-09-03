// ============================================================
// Сказане число — коли пара пам'ятає СКІЛЬКИ, але не пам'ятає що.
// ------------------------------------------------------------
// ЗАПИТ ВЛАСНИКА: «потрібно дати лінивим людям вибір або додавати самі
// світлини, або вказати приблизну кількість скільки було важливих
// знімків», і те саме для фільмів, серіалів і місць — «потім ці пробіли
// користувачі зможуть самостійно заповнити за бажанням у відповідних
// модулях».
//
// ЧОГО ТУТ НЕМАЄ: ПІДРОБЛЕНИХ РЯДКІВ У МОДУЛЯХ ПАРИ. Найпростіше було б
// створити двадцять порожніх фільмів у вотчлісті й шість міток на карті.
// Так робити не можна з трьох окремих причин:
//
//   1. Мітка карти вимагає координат (`map_pins.lat/lng NOT NULL`), а
//      знімок — файла (`memories.photo_url NOT NULL`). Тобто «порожній
//      рядок» у двох модулях із чотирьох просто не існує як річ.
//   2. Двадцять безіменних фільмів у вотчлісті — це не пробіли, які
//      «заповнять за бажанням», а прибирання, яке пара НЕ просила.
//   3. Число, записане рядками, застигає. Пара додає справжній фільм — і
//      він додається ЗВЕРХУ до двадцяти вигаданих, тобто рік рахується
//      двічі.
//
// ЩО ТУТ Є НАТОМІСТЬ. Число зберігається як число (`settings`), а до
// знімка джерел (`EvolutionSourceSnapshot`) домішується рівно РІЗНИЦЯ між
// сказаним і справжнім: `max(0, сказано − уже є)`. Наслідки:
//
//   • модулі пари лишаються чистими — там немає жодного вигаданого рядка;
//   • подвійного рахунку не буває за побудовою: щойно пара заводить
//     справжній фільм, домішка меншає на одиницю;
//   • «пробіл» — це і є та різниця, і заповнюється він природно, самим
//     користуванням модулем.
//
// ЧОМУ ЦЕ НЕ ОБМАН РУШІЯ. Пара САМА сказала, що того року подивилась
// дванадцять фільмів. Рушій рахує роки з того, чого життя пари торкнулось
// (`relationshipYear`), і дванадцять фільмів у 2023-му — це факт про їхнє
// життя, а не про портал. Чого рушій НЕ дізнається — які саме це фільми;
// але він цього й не питає, бо в його знімку медіа має лише дату й стан.
//
// МЕЖА, НАЗВАНА ВГОЛОС: цим не можна намалювати те, чого не було. Стеля
// на кожен рід — `DECLARED_MAX`, і вона мала: сказане число має бути
// спогадом, а не важелем.
// ============================================================
import type { EvolutionSourceSnapshot } from '@/engine/evolution/adapters';

/** Роди, які пара може назвати числом. */
export type DeclaredKind = 'photos' | 'movies' | 'series' | 'places';

export const DECLARED_KINDS: readonly DeclaredKind[] = ['photos', 'movies', 'series', 'places'];

/**
 * Стеля на один рід в одному році.
 *
 * Сотня — не «щоб було з запасом». Виміряно на рушії: наповненість року
 * зважена в бік ШИРОТИ (скількох модулів торкнувся рік), а не обсягу, тож
 * після десятка-двох у тому самому модулі число майже перестає рухати рік.
 * Далі воно рухає лише саме себе — і стає важелем, яким пара обманює
 * власне дерево.
 */
export const DECLARED_MAX = 100;

/** Скільки чого пара назвала в одному році. */
export type DeclaredYear = Partial<Record<DeclaredKind, number>>;

/** Ключ — `startsAt` року стосунків, тобто те саме, чим рік себе називає. */
export type DeclaredCounts = Record<string, DeclaredYear>;

/** Ключ у `settings`, під яким це лежить. */
export const DECLARED_COUNTS_KEY = 'sweep_declared_counts';

const isYearKey = (key: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(key);

const clampCount = (value: unknown): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  return Math.min(DECLARED_MAX, Math.max(0, Math.floor(value)));
};

/**
 * Прочитати з `settings`, не впавши на будь-чому.
 *
 * Значення в `settings` — вільний рядок, який пише портал; читати його
 * довірливо означало б покласти онбординг від одного зіпсованого запису.
 * Усе, що не впізнане, тихо стає порожнечею: відсутність сказаного числа —
 * нормальний стан, а не помилка.
 */
export function parseDeclaredCounts(value: unknown): DeclaredCounts {
  if (typeof value !== 'string' || value.trim() === '') return {};
  let raw: unknown;
  try {
    raw = JSON.parse(value);
  } catch {
    return {};
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};

  const result: DeclaredCounts = {};
  for (const [key, entry] of Object.entries(raw as Record<string, unknown>)) {
    if (!isYearKey(key)) continue;
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const year: DeclaredYear = {};
    for (const kind of DECLARED_KINDS) {
      const count = clampCount((entry as Record<string, unknown>)[kind]);
      if (count > 0) year[kind] = count;
    }
    if (Object.keys(year).length > 0) result[key] = year;
  }
  return result;
}

/**
 * Записати назад — БЕЗ нулів і з упорядкованими ключами.
 *
 * Порядок тут не косметика: значення лягає в `settings` рядком, і рядок,
 * що переставляється сам собою, робив би кожне збереження «зміною» для
 * будь-кого, хто порівнює записи.
 */
export function serializeDeclaredCounts(counts: DeclaredCounts): string {
  const clean: DeclaredCounts = {};
  for (const key of Object.keys(counts).sort()) {
    const year = counts[key];
    if (!year) continue;
    const kept: DeclaredYear = {};
    for (const kind of DECLARED_KINDS) {
      const count = clampCount(year[kind]);
      if (count > 0) kept[kind] = count;
    }
    if (Object.keys(kept).length > 0) clean[key] = kept;
  }
  return JSON.stringify(clean);
}

/** Поставити одне число, прибравши запис, коли він став порожнім. */
export function withDeclared(
  counts: DeclaredCounts,
  yearStartsAt: string,
  kind: DeclaredKind,
  count: number,
): DeclaredCounts {
  const next: DeclaredCounts = { ...counts };
  const year: DeclaredYear = { ...next[yearStartsAt] };
  const safe = clampCount(count);
  if (safe > 0) year[kind] = safe;
  else delete year[kind];
  if (Object.keys(year).length > 0) next[yearStartsAt] = year;
  else delete next[yearStartsAt];
  return next;
}

/** Проміжок року стосунків — рівно те, чим його називає `yearFills`. */
export interface DeclaredYearSpan {
  startsAt: string;
  endsAt: string;
}

const within = (day: string | null | undefined, span: DeclaredYearSpan): boolean => (
  typeof day === 'string' && day.slice(0, 10) >= span.startsAt && day.slice(0, 10) < span.endsAt
);

/**
 * Рівномірні дні всередині року — стільки, скільки треба домішати.
 *
 * Детерміновано й без випадковості: один і той самий рік із тим самим
 * числом дає ті самі дні завжди. Рушій вимагає цього прямо
 * (`DETERMINISM_STANDARD`), але тут є й простіша причина: пара не мусить
 * бачити, як дерево ворушиться від самого перезавантаження.
 *
 * Перший день зсунутий на півкроку від межі, щоб домішка не сідала рівно
 * на річницю — там і без неї густо.
 */
function spreadWithinYear(count: number, span: DeclaredYearSpan): string[] {
  const from = Date.parse(`${span.startsAt}T00:00:00.000Z`);
  const to = Date.parse(`${span.endsAt}T00:00:00.000Z`);
  if (count <= 0 || !Number.isFinite(from) || !Number.isFinite(to) || to <= from) return [];
  const step = (to - from) / count;
  const days: string[] = [];
  for (let index = 0; index < count; index += 1) {
    days.push(new Date(from + step * (index + 0.5)).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Скільки ще бракує до сказаного — по кожному роду, по кожному році.
 *
 * Публічна навмисно: екран показує парі саме це число («ще 7 без назви»),
 * і рахувати його вдруге в іншому місці означало б завести другу правду.
 */
export function declaredShortfall(
  snapshot: EvolutionSourceSnapshot,
  declared: DeclaredYear,
  span: DeclaredYearSpan,
): Record<DeclaredKind, number> {
  const real = {
    photos: snapshot.memories.filter((row) => within(row.memoryDate, span)).length,
    /*
     * Фільми й серіали в знімку рушія НЕ РОЗРІЗНЯЮТЬСЯ: `media` має лише
     * стан і дату. Тому сказане про них складається, а вже потім із
     * суми віднімається все переглянуте того року. Розділені вони тільки
     * на екрані — бо пара пам'ятає їх окремо, — і це чесніше, ніж вигадати
     * рушієві поле, якого він не читає.
     */
    movies: 0,
    series: 0,
    places: snapshot.mapPlaces.filter((row) => within(row.visitedAt, span)).length,
  };
  const watched = snapshot.media.filter((row) => within(row.finishedAt, span)).length;
  const saidWatched = (declared.movies ?? 0) + (declared.series ?? 0);

  const share = (said: number): number => (
    saidWatched === 0 ? 0 : Math.round(Math.max(0, saidWatched - watched) * (said / saidWatched))
  );

  return {
    photos: Math.max(0, (declared.photos ?? 0) - real.photos),
    movies: share(declared.movies ?? 0),
    series: share(declared.series ?? 0),
    places: Math.max(0, (declared.places ?? 0) - real.places),
  };
}

/** Межа ідентифікаторів домішки — щоб вона ніколи не зіткнулась зі справжніми. */
const DECLARED_ID_BASE = 8_000_000;

/**
 * Домішати до знімка рівно те, чого бракує до сказаного.
 *
 * НЕ ЗАМІНЮЄ НІЧОГО. Справжні рядки лишаються як є; додається тільки
 * різниця, і тільки в ті роки, про які пара щось сказала. Знімок без
 * сказаних чисел вертається ТИМ САМИМ об'єктом — інакше кожне читання
 * порталу виглядало б зміною для всіх, хто його порівнює.
 */
export interface PaddedSnapshot {
  snapshot: EvolutionSourceSnapshot;
  /**
   * Скільки чого домішано — по роках і родах.
   *
   * Вертається звідси, а не рахується вдруге на екрані, і причина не в
   * ощадності. Знімок ПІСЛЯ домішки вже містить її рядки, тож
   * `declaredShortfall`, покликаний на ньому, дасть нуль — і екран
   * сказав би парі «усі 24 знімки вже названі» рівно тоді, коли не
   * названо жодного. Різниця існує лише в мить домішування; далі її
   * можна тільки передати.
   */
  gaps: Record<string, Record<DeclaredKind, number>>;
}

export function padSnapshotWithDeclared(
  snapshot: EvolutionSourceSnapshot,
  counts: DeclaredCounts,
  years: readonly DeclaredYearSpan[],
): PaddedSnapshot {
  const memories: EvolutionSourceSnapshot['memories'][number][] = [];
  const media: EvolutionSourceSnapshot['media'][number][] = [];
  const mapPlaces: EvolutionSourceSnapshot['mapPlaces'][number][] = [];
  const gaps: Record<string, Record<DeclaredKind, number>> = {};
  let serial = 0;

  for (const span of [...years].sort((left, right) => (
    left.startsAt < right.startsAt ? -1 : left.startsAt > right.startsAt ? 1 : 0
  ))) {
    const declared = counts[span.startsAt];
    if (!declared) continue;
    const missing = declaredShortfall(snapshot, declared, span);
    gaps[span.startsAt] = missing;

    for (const day of spreadWithinYear(missing.photos, span)) {
      serial += 1;
      memories.push({
        id: DECLARED_ID_BASE + serial,
        memoryDate: day,
        /*
         * `year`, а не `day`: пара назвала РІК, а не дні. Точність тут не
         * оздоба — рушій нею зважує подію (`historical-estimate`), і
         * сказати «день» означало б збрехати про те, що ми знаємо.
         */
        datePrecision: 'year',
        takenAt: null,
        createdAt: `${day}T12:00:00.000Z`,
      });
    }

    for (const day of spreadWithinYear(missing.movies + missing.series, span)) {
      serial += 1;
      media.push({
        id: DECLARED_ID_BASE + serial,
        status: 'done',
        createdAt: `${day}T12:00:00.000Z`,
        finishedAt: `${day}T12:00:00.000Z`,
      });
    }

    for (const day of spreadWithinYear(missing.places, span)) {
      serial += 1;
      mapPlaces.push({
        id: DECLARED_ID_BASE + serial,
        category: 'other',
        visitedAt: day,
        createdAt: `${day}T12:00:00.000Z`,
        rating: null,
        city: null,
        country: null,
      });
    }
  }

  if (memories.length === 0 && media.length === 0 && mapPlaces.length === 0) {
    return { snapshot, gaps };
  }

  return {
    snapshot: {
      ...snapshot,
      memories: [...snapshot.memories, ...memories],
      media: [...snapshot.media, ...media],
      mapPlaces: [...snapshot.mapPlaces, ...mapPlaces],
    },
    gaps,
  };
}
