// ============================================================
// Календар життя (ADR-0239): «один тиждень — один рік».
// ------------------------------------------------------------
// Справжнє життя Лєни — двадцять років; гра мусить пройти їх за вечори.
// Тому тиждень гри — навчальний рік: понеділок — вересень, середа — зима,
// п'ятниця — останній дзвоник, вихідні — літо. Пора року міняється від
// дня до дня, і в кожному році є сніг, цвіт і море.
//
// Тиждень 0 — садочок (2007/08), 1–11 — класи, 12–15 — ВДПУ, далі —
// доросле життя. Точки справжньої історії стають на свої дні самі:
// зустріч із Дімою — грудень 4-го курсу (тиждень 15, середа: 26.12.2022),
// пропозиція — липень 2026 (тиждень 18, субота: 13.07.2026).
// ============================================================

export type Season = 'autumn' | 'winter' | 'spring' | 'summer';
export type Stage = 'sadok' | 'school' | 'uni' | 'adult';

export const DAYS_PER_WEEK = 7;
/** Перший навчальний рік гри — садочок. */
export const FIRST_YEAR = 2007;
export const SCHOOL_GRADES = 11;
export const UNI_COURSES = 4;
export const UNI_FIRST_WEEK = 1 + SCHOOL_GRADES; // 12
export const ADULT_FIRST_WEEK = UNI_FIRST_WEEK + UNI_COURSES; // 16
/** Тиждень і день зустрічі з Дімою: середа 4-го курсу. */
export const MEET_WEEK = UNI_FIRST_WEEK + 3;
export const MEET_DOW = 2;
/** Тиждень пропозиції на Отраді: літо 2025/26 навчального року. */
export const PROPOSAL_WEEK = 18;

interface DayRule {
  name: string;
  short: string;
  season: Season;
  month: number; // 1..12
  monthName: string;
  /** Чи переходить календарний рік (дні з січня — це вже наступний рік). */
  nextYear: boolean;
}

const DAYS: readonly DayRule[] = [
  { name: 'Понеділок', short: 'Пн', season: 'autumn', month: 9, monthName: 'вересень', nextYear: false },
  { name: 'Вівторок', short: 'Вт', season: 'autumn', month: 11, monthName: 'листопад', nextYear: false },
  { name: 'Середа', short: 'Ср', season: 'winter', month: 12, monthName: 'грудень', nextYear: false },
  { name: 'Четвер', short: 'Чт', season: 'spring', month: 3, monthName: 'березень', nextYear: true },
  { name: "П'ятниця", short: 'Пт', season: 'spring', month: 5, monthName: 'травень', nextYear: true },
  { name: 'Субота', short: 'Сб', season: 'summer', month: 7, monthName: 'липень', nextYear: true },
  { name: 'Неділя', short: 'Нд', season: 'summer', month: 8, monthName: 'серпень', nextYear: true },
];

export const SEASON_NAME: Record<Season, string> = {
  autumn: 'Осінь',
  winter: 'Зима',
  spring: 'Весна',
  summer: 'Літо',
};

export interface DayInfo {
  day: number;
  week: number;
  dow: number;
  dayName: string;
  dayShort: string;
  season: Season;
  monthName: string;
  /** Календарний рік цього дня. */
  calendarYear: number;
  /** «2019/20». */
  schoolYear: string;
  weekend: boolean;
  stage: Stage;
  /** Клас 1..11 або курс 1..4; 0 для садочка й дорослого життя. */
  level: number;
  /** Скільки Лєні років цього дня (народилась 2002-го). */
  age: number;
}

export const BIRTH_YEAR = 2002;

export function stageOfWeek(week: number): { stage: Stage; level: number } {
  if (week <= 0) return { stage: 'sadok', level: 0 };
  if (week < UNI_FIRST_WEEK) return { stage: 'school', level: week };
  if (week < ADULT_FIRST_WEEK) return { stage: 'uni', level: week - UNI_FIRST_WEEK + 1 };
  return { stage: 'adult', level: 0 };
}

export function dayInfo(day: number): DayInfo {
  if (!Number.isInteger(day) || day < 0) throw new Error(`dayInfo: день має бути цілим ≥ 0, отримано ${day}`);
  const week = Math.floor(day / DAYS_PER_WEEK);
  const dow = day % DAYS_PER_WEEK;
  const rule = DAYS[dow]!;
  const startYear = FIRST_YEAR + week;
  const calendarYear = rule.nextYear ? startYear + 1 : startYear;
  const { stage, level } = stageOfWeek(week);
  return {
    day,
    week,
    dow,
    dayName: rule.name,
    dayShort: rule.short,
    season: rule.season,
    monthName: rule.monthName,
    calendarYear,
    schoolYear: `${startYear}/${String((startYear + 1) % 100).padStart(2, '0')}`,
    weekend: dow >= 5,
    stage,
    level,
    age: calendarYear - BIRTH_YEAR - (rule.month < 6 ? 1 : 0),
  };
}

export function firstDayOfWeek(week: number): number {
  return week * DAYS_PER_WEEK;
}

/** Хвилини доби: 7:00 — початок дня, 26:00 (2 ночі) — Лєна засинає де стоїть. */
export const DAY_START_MIN = 7 * 60;
export const DAY_END_MIN = 26 * 60;

export function clockLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** Частина доби для освітлення. */
export function dayPhase(minutes: number): 'morning' | 'day' | 'evening' | 'night' {
  if (minutes < 10 * 60) return 'morning';
  if (minutes < 17 * 60) return 'day';
  if (minutes < 20 * 60 + 30) return 'evening';
  return 'night';
}
