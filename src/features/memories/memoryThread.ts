// ============================================================
// «Нитка часу» — розкладка галереї спогадів (ADR-0249).
// ------------------------------------------------------------
// Сітка показувала фото й мовчала про час між ними: два спогади з одного
// тижня й два, між якими минув рік, стояли на однаковій відстані. Нитка
// каже саме це — відстань між вузлами росте з часом, що минув, тож
// насичене літо читається щільним, а тихі місяці видно як простір.
//
// Чиста функція без React і без DOM: числа відступів, поріг паузи й підпис
// перевіряє тест, а не око на знімку.
//
// Три рішення, кожне з причиною:
//
//   • ВІДСТАНЬ — ЛОГАРИФМ ДНІВ, А НЕ ДНІ. Лінійна шкала дала б або злиплі
//     спогади одного тижня, або екран порожнечі між роками. Логарифм
//     розрізняє «той самий день», «тиждень» і «місяць», а далі насичується.
//   • ДОВГА ПЕРЕРВА ЗГОРТАЄТЬСЯ В ЗНАК. Понад шість тижнів відстань
//     перестає рости й стає підписом «· · · 4 місяці»: час видно словом,
//     а не порожнім екраном, який пара гортала б, думаючи, що список скінчився.
//   • РІК — ЦЕ ЗАРУБКА НА НИТЦІ. Повзунок років читає ці ж зарубки, тож
//     «перекинь на 2024» і те, що пара бачить під пальцем, — одне джерело.
// ============================================================
import { pluralUA } from '@/lib/utils';

/** Найменше, що треба нитці про спогад. Порядок — найновіший перший. */
export interface ThreadMoment {
  id: number;
  /** YYYY-MM-DD — день самого спогаду. */
  memory_date: string;
  /** Скільки фото в спогаді: від цього росте кадр. */
  photoCount: number;
}

export type ThreadSide = 'left' | 'right';

export type ThreadItem =
  | { kind: 'year'; year: number }
  | { kind: 'gap'; px: number }
  | { kind: 'pause'; days: number; label: string }
  /** `leaves` — скільки листів віяла має вузол (0…2); від цього ширина кадру. */
  | { kind: 'node'; id: number; side: ThreadSide; leaves: number; year: number };

/** Перерва, довша за це, згортається в підпис. Шість тижнів. */
export const PAUSE_DAYS = 42;
/** Відступ між спогадами одного дня. */
export const GAP_MIN_PX = 14;
/** Стеля відступу: далі вже пауза, а не простір. */
export const GAP_MAX_PX = 64;
/** Крок логарифма: «+1 день» дає десять пікселів, «+тиждень» — тридцять. */
const GAP_LOG_STEP_PX = 10;

const DAY_MS = 86_400_000;

/** Дні між двома датами YYYY-MM-DD. UTC, тож перехід на літній час не дає 0.96 дня. */
export function daysApart(newer: string, older: string): number {
  const toUtc = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.max(0, Math.round((toUtc(newer) - toUtc(older)) / DAY_MS));
}

/** Відстань між сусідніми вузлами, у пікселях, для перерви коротшої за паузу. */
export function gapPx(days: number): number {
  const px = GAP_MIN_PX + GAP_LOG_STEP_PX * Math.log2(1 + Math.max(0, days));
  return Math.round(Math.min(GAP_MAX_PX, px));
}

/**
 * Скільки минуло, словами: «день», «5 днів», «тиждень», «7 тижнів»,
 * «місяць», «4 місяці», «рік», «2 роки й 3 місяці». Нуль днів — порожньо:
 * «того ж дня» каже викликач, бо це вже інше речення.
 *
 * Місяць тут — 30.44 дня, середній григоріанський. Підпис наближений
 * навмисно: пара читає «скільки минуло», а не рахує дні. Одиниця без
 * числа («тиждень», а не «1 тиждень») — бо так кажуть.
 */
export function durationLabel(days: number): string {
  const counted = (n: number, forms: readonly [string, string, string]) =>
    (n === 1 ? forms[0] : `${n} ${pluralUA(n, forms)}`);
  if (days <= 0) return '';
  if (days < 7) return counted(days, ['день', 'дні', 'днів']);
  if (days < 61) return counted(Math.round(days / 7), ['тиждень', 'тижні', 'тижнів']);
  const totalMonths = Math.round(days / 30.44);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const monthsWord = counted(months, ['місяць', 'місяці', 'місяців']);
  if (years === 0) return monthsWord;
  const yearsWord = counted(years, ['рік', 'роки', 'років']);
  return months === 0 ? yearsWord : `${yearsWord} й ${monthsWord}`;
}

/** Підпис паузи на нитці. Пауза завжди довша за шість тижнів. */
export function pauseLabel(days: number): string {
  return durationLabel(days);
}


const yearOf = (iso: string) => Number(iso.slice(0, 4));

/**
 * Нитка з найновішого спогаду донизу.
 *
 * Сторони чергуються від першого вузла, а не скидаються на кожному році:
 * інакше два роки поспіль, що починаються з одного спогаду, ставили б
 * обидва вузли ліворуч, і нитка ламалась би саме на зарубці.
 */
export function buildThread(moments: readonly ThreadMoment[]): ThreadItem[] {
  const items: ThreadItem[] = [];
  let previous: ThreadMoment | null = null;
  moments.forEach((moment, index) => {
    const year = yearOf(moment.memory_date);
    if (previous) {
      const days = daysApart(previous.memory_date, moment.memory_date);
      if (days > PAUSE_DAYS) items.push({ kind: 'pause', days, label: pauseLabel(days) });
      else items.push({ kind: 'gap', px: gapPx(days) });
    }
    if (!previous || yearOf(previous.memory_date) !== year) items.push({ kind: 'year', year });
    items.push({
      kind: 'node',
      id: moment.id,
      side: index % 2 === 0 ? 'left' : 'right',
      leaves: Math.min(Math.max(0, moment.photoCount - 1), THREAD_FAN_LEAVES),
      year,
    });
    previous = moment;
  });
  return items;
}

/** Роки повзунка: від найновішого, кожен зі своїм першим спогадом і числом спогадів. */
export interface ThreadYear {
  year: number;
  /** Індекс першого (найновішого) спогаду цього року в списку. */
  firstIndex: number;
  count: number;
}

export function threadYears(moments: readonly ThreadMoment[]): ThreadYear[] {
  const years: ThreadYear[] = [];
  moments.forEach((moment, index) => {
    const year = yearOf(moment.memory_date);
    const last = years[years.length - 1];
    if (last && last.year === year) last.count += 1;
    else years.push({ year, firstIndex: index, count: 1 });
  });
  return years;
}

// ── Кадр і віяло ────────────────────────────────────────────

/**
 * Ширина кадру як частка колонки вузла — за кількістю листів віяла.
 *
 * Кадр притиснутий до нитки, а решта колонки — зовнішнє поле під віяло.
 * Перша редакція міряла кадр кількістю фото (0.6 / 0.7 / 0.8), і спогад з
 * одним фото — а таких більшість — діставав кадр у 86 px поруч із
 * порожнім полем під віяло, якого в нього немає (критика 2026-10-12).
 * Тепер поле лишається рівно під ті листи, що є: без віяла кадр займає
 * майже всю колонку.
 *
 * Висоти кадрів від цього майже рівні (0.8…0.9 колонки), тож відстань між
 * вузлами знову каже про час, а не про те, скільки фото того дня.
 */
export const FRAME_WIDTH_BY_LEAVES = [0.9, 0.88, 0.8] as const;

export function frameWidth(leaves: number): number {
  const i = Math.min(Math.max(0, Math.trunc(leaves)), FRAME_WIDTH_BY_LEAVES.length - 1);
  return FRAME_WIDTH_BY_LEAVES[i]!;
}

/** Скільки листів віяла показує вузол нитки. */
export const THREAD_FAN_LEAVES = 2;
/** Крок повороту листа, у градусах. */
export const THREAD_FAN_STEP_DEG = 6;

export interface ThreadFanLeaf {
  /** Градуси; знак веде НАЗОВНІ від нитки. */
  rotate: number;
  scale: number;
}

/**
 * Віяло вузла: листи розходяться лише НАЗОВНІ від нитки.
 *
 * У сітці віяло було симетричне, бо обабіч картки стояли такі самі
 * картки. Тут з одного боку нитка, і лист, нахилений до неї, перетнув би
 * лінію часу — саме ту річ, яку екран показує. Тому один бік, два листи,
 * і найдальший малюється першим, щоб ближчі лягали поверх нього.
 */
export function threadFan(extraPhotos: number, side: ThreadSide): ThreadFanLeaf[] {
  const count = Math.min(Math.max(0, Math.trunc(extraPhotos)), THREAD_FAN_LEAVES);
  const outward = side === 'left' ? -1 : 1;
  const leaves: ThreadFanLeaf[] = [];
  for (let step = count; step >= 1; step -= 1) {
    leaves.push({
      rotate: outward * step * THREAD_FAN_STEP_DEG,
      scale: Number((1 - step * 0.03).toFixed(3)),
    });
  }
  return leaves;
}

// ── Сусіди на нитці ─────────────────────────────────────────

/** Те, що треба знати про спогад, щоб назвати його сусідом. */
export interface ThreadNamedMoment {
  id: number;
  memory_date: string;
  title: string;
}

/** Назва спогаду для речення: без назви — його дата цифрами. */
function spoken(moment: ThreadNamedMoment): string {
  const title = moment.title.trim();
  if (title) return `«${title}»`;
  const [y, m, d] = moment.memory_date.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
}

export interface ThreadNeighbor<T> {
  moment: T;
  /** «через 3 тижні», «за місяць до того», «того ж дня». */
  label: string;
}

/**
 * Попередній і наступний спогади на нитці — для сторінки спогаду (ADR-0250).
 *
 * `moments` — у порядку нитки, найновіший перший. «Новіший» стоїть на
 * нитці ВИЩЕ, тож у реченні він «через N», а старіший — «за N до того».
 */
export function threadNeighbors<T extends ThreadNamedMoment>(
  moments: readonly T[],
  id: number,
): { newer: ThreadNeighbor<T> | null; older: ThreadNeighbor<T> | null } {
  const index = moments.findIndex((m) => m.id === id);
  if (index < 0) return { newer: null, older: null };
  const here = moments[index]!;
  const newer = moments[index - 1];
  const older = moments[index + 1];
  const after = (days: number) => (days === 0 ? 'того ж дня' : `через ${durationLabel(days)}`);
  const before = (days: number) => (days === 0 ? 'того ж дня' : `за ${durationLabel(days)} до того`);
  return {
    newer: newer ? { moment: newer, label: after(daysApart(newer.memory_date, here.memory_date)) } : null,
    older: older ? { moment: older, label: before(daysApart(here.memory_date, older.memory_date)) } : null,
  };
}

/**
 * Де ляже спогад із цією датою — рядок у композері (ADR-0250).
 *
 * Найближчий СТАРШИЙ спогад кращий за молодший: нитка читається з
 * минулого, і «через 4 місяці після «Карпат»» каже про новий спогад
 * більше, ніж «за рік до «Львова»». Спогад, який редагують, сам собі не
 * сусід. Рівна дата рахується старшою: на нитці нове стає вище.
 */
export function landingLabel(
  moments: readonly ThreadNamedMoment[],
  memoryDate: string,
  excludeId?: number,
): string {
  const others = moments.filter((m) => m.id !== excludeId);
  if (others.length === 0) return 'Перший спогад на нитці';
  const date = memoryDate.slice(0, 10);
  const older = others
    .filter((m) => m.memory_date.slice(0, 10) <= date)
    .reduce<ThreadNamedMoment | null>((best, m) => (!best || m.memory_date > best.memory_date ? m : best), null);
  if (older) {
    const days = daysApart(date, older.memory_date);
    return days === 0
      ? `Ляже на нитку того ж дня, що й ${spoken(older)}`
      : `Ляже на нитку через ${durationLabel(days)} після ${spoken(older)}`;
  }
  const newer = others.reduce((best, m) => (m.memory_date < best.memory_date ? m : best));
  return `Ляже на початок нитки, за ${durationLabel(daysApart(newer.memory_date, date))} до ${spoken(newer)}`;
}

// ── Нове від партнера ──────────────────────────────────────

export interface ThreadAuthoredMoment {
  id: number;
  created_by: number | null;
  /** ISO-мітка створення запису. */
  created_at: string;
}

/**
 * Спогади, які склав ПАРТНЕР після останнього візиту на нитку (ADR-0251).
 *
 * Це єдине, що на нитці світиться акцентом. «Найновіший» вузол світився
 * завжди й тому нічого не казав: він просто верхній. А пара заходить
 * асинхронно — один додає вдень, другий гортає ввечері, — і питання
 * вечора саме таке: «що новенького поклав він/вона?».
 *
 * Свої спогади не світяться: свій ти бачив, бо сам його склав. Без мітки
 * попереднього візиту (перший вхід на цьому пристрої) не світиться
 * нічого — інакше весь архів спалахнув би «новим».
 */
export function unseenFromPartner(
  moments: readonly ThreadAuthoredMoment[],
  meId: number,
  seenSince: string | null,
): Set<number> {
  // Порівнюються числа, а не рядки: база пише `+00:00`, браузер — `Z`, і
  // рядкове порівняння двох записів однієї миті збрехало б.
  const since = seenSince ? Date.parse(seenSince) : Number.NaN;
  if (!Number.isFinite(since)) return new Set();
  return new Set(
    moments
      .filter((m) => m.created_by !== null && m.created_by !== meId && Date.parse(m.created_at) > since)
      .map((m) => m.id),
  );
}
