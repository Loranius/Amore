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

/** Розмір кадру. Більше фото — більший кадр, але не більший за пів нитки. */
export type ThreadSize = 's' | 'm' | 'l';
export type ThreadSide = 'left' | 'right';

export type ThreadItem =
  | { kind: 'year'; year: number }
  | { kind: 'gap'; px: number }
  | { kind: 'pause'; days: number; label: string }
  | { kind: 'node'; id: number; side: ThreadSide; size: ThreadSize; year: number };

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
 * Підпис паузи: «7 тижнів», «4 місяці», «рік», «2 роки й 3 місяці».
 *
 * Місяць тут — 30.44 дня, середній григоріанський. Підпис наближений
 * навмисно: пара читає «скільки минуло», а не рахує дні.
 */
export function pauseLabel(days: number): string {
  if (days < 61) {
    const weeks = Math.round(days / 7);
    return `${weeks} ${pluralUA(weeks, ['тиждень', 'тижні', 'тижнів'])}`;
  }
  const totalMonths = Math.round(days / 30.44);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const monthsWord = (n: number) => `${n} ${pluralUA(n, ['місяць', 'місяці', 'місяців'])}`;
  if (years === 0) return monthsWord(months);
  const yearsWord = years === 1 ? 'рік' : `${years} ${pluralUA(years, ['рік', 'роки', 'років'])}`;
  return months === 0 ? yearsWord : `${yearsWord} й ${monthsWord(months)}`;
}

export function sizeFor(photoCount: number): ThreadSize {
  if (photoCount >= 4) return 'l';
  if (photoCount >= 2) return 'm';
  return 's';
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
      size: sizeFor(moment.photoCount),
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
 * Ширина кадру як частка колонки вузла.
 *
 * Кадр притиснутий до нитки, а решта колонки — зовнішнє поле, у яке
 * розходиться віяло. Тому найбільший кадр не займає колонку цілком:
 * інакше віяло вилізло б за край екрана.
 */
export const FRAME_WIDTH: Record<ThreadSize, number> = { s: 0.6, m: 0.7, l: 0.8 };

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
