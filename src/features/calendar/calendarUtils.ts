// ============================================================
// Календар — константи та чисті утиліти дат (порт із calendar.js)
// ------------------------------------------------------------
// Жодного парсингу тегів: план читає ev.metadata (PlanMetadata).
//
// Файл навмисно БЕЗ рантайм-залежностей, окрім `localDateFromISO`: тут
// живе вся арифметика дат модуля, і вона мусить тестуватись без клієнта
// бази. Раніше звідси реекспортувався `planMetadataOf`, через що імпорт
// цих чистих функцій тягнув за собою `@/lib/supabase`. Споживачі беруть
// його прямо з `_shared/events` — рівно як це вже робить `home/Hero.tsx`.
// ============================================================
import { localDateFromISO, pluralUA } from '@/lib/utils';
import type {
  EventRow,
  EnrichedEvent,
  EventType,
  PlanCategory,
  PlanStatus,
} from '@/types';

// Список місяців живе у _shared/month.ts — календар мав власну копію,
// поки «Спогадам» не знадобився той самий. Псевдонім лишається, щоб
// наявні імпорти MONTHS не мінялись. Імпорт саме локальний, а не
// `export … from`: реекспорт не вводить імені в область файлу, і
// formatUaDate нижче його не побачив би.
import { MONTHS_UA_GENITIVE as MONTHS } from '@/features/_shared/month';
export { MONTHS };

export const TYPES: Record<EventType, { icon: string; label: string; color: string }> = {
  birthday: { icon: '🎂', label: 'День народження', color: '#FF6B9D' },
  anniversary: { icon: '💕', label: 'Річниця', color: '#E8829C' },
  holiday: { icon: '🎉', label: 'Свято', color: '#F4A6BE' },
  other: { icon: '🗺️', label: 'Плани', color: '#9B6EA8' },
};

export const PLAN_CATS: Record<
  PlanCategory,
  { icon: string; label: string; color: string; gradient: string }
> = {
  date: { icon: '💑', label: 'Побачення', color: '#FF6B9D', gradient: 'linear-gradient(135deg,#FF6B9D,#E8829C)' },
  dream: { icon: '✨', label: 'Мрії', color: '#9B6EA8', gradient: 'linear-gradient(135deg,#9B6EA8,#C084D4)' },
  trip: { icon: '✈️', label: 'Подорожі', color: '#5BA3D9', gradient: 'linear-gradient(135deg,#5BA3D9,#7EC8E3)' },
  goal: { icon: '🎯', label: 'Цілі', color: '#E8829C', gradient: 'linear-gradient(135deg,#E8829C,#F4A6BE)' },
  other: { icon: '🗺️', label: 'Інше', color: '#B98A9A', gradient: 'linear-gradient(135deg,#B98A9A,#D4B0BC)' },
};

export const PLAN_STATUS: Record<PlanStatus, { label: string; icon: string; cls: string }> = {
  planned: { label: 'Планується', icon: '⏳', cls: 'plan-status-planned' },
  active: { label: 'В процесі', icon: '🔥', cls: 'plan-status-active' },
  done: { label: 'Виконано!', icon: '✅', cls: 'plan-status-done' },
};

export const PLAN_CAT_ORDER: PlanCategory[] = ['date', 'dream', 'trip', 'goal', 'other'];

// ── Дати ─────────────────────────────────────────────────────
/**
 * Та сама дата в іншому році, із затисканням до кінця місяця.
 *
 * `new Date(2027, 1, 29)` — це НЕ 29 лютого, а 1 березня: переповнення
 * дня в Date мовчки переливається в наступний місяць. Через це щорічна
 * подія 29 лютого показувалась 1 березня, а крон-нагадування, що звіряє
 * 'MM-DD', не спрацьовувало взагалі три роки з чотирьох.
 *
 * Конвенція — останній день ТОГО САМОГО місяця (28 лютого), а не перший
 * день наступного. Те саме правило продубльоване в
 * `supabase/functions/event-reminders/index.ts`; edge-функція не імпортує
 * з `src/`, тож при зміні конвенції правити треба обидва місця.
 */
function sameDayInYear(year: number, month: number, day: number): Date {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, daysInMonth));
}

/** Наступне настання події (щорічні перераховуються на цей/наступний рік). */
export function nextOccurrence(ev: EventRow): { date: Date; passed: boolean } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const orig = localDateFromISO(ev.date);

  if (!ev.yearly) {
    const d = new Date(orig.getFullYear(), orig.getMonth(), orig.getDate());
    return { date: d, passed: d < today };
  }
  const [month, day] = [orig.getMonth(), orig.getDate()];
  let next = sameDayInYear(today.getFullYear(), month, day);
  if (next < today) next = sameDayInYear(today.getFullYear() + 1, month, day);
  return { date: next, passed: false };
}

export function daysUntil(dateObj: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((dateObj.getTime() - today.getTime()) / 86_400_000);
}

export function daysLabel(n: number): string {
  if (n === 0) return '🎊 Сьогодні!';
  if (n === 1) return 'завтра';
  if (n < 0) return `${Math.abs(n)} дн. тому`;
  if (n < 7) return `через ${n} дн.`;
  if (n < 30) return `через ${Math.floor(n / 7)} тиж.`;
  if (n < 365) return `через ${Math.floor(n / 30)} міс.`;
  return `через ${Math.floor(n / 365)} р.`;
}

/** 'YYYY-MM-DD' → «5 січня 2026 р.». */
export function formatUaDate(iso: string): string {
  const d = localDateFromISO(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} р.`;
}

/**
 * Дата НАЙБЛИЖЧОГО настання події.
 *
 * Список показував `ev.date` — вихідну дату. Для щорічної події це
 * означало «5 липня 1963 р.» під заголовком дня народження: екран друкував
 * рік народження людини й лишав читачеві самому здогадатись, що подія
 * буде 5 липня 2027. Найближче настання весь цей час обчислювалось
 * (`enrichEvent`), використовувалось для «через скільки днів» — і не
 * показувалось.
 */
export function formatOccurrence(ev: EnrichedEvent): string {
  const d = ev.nextDate;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} р.`;
}

/**
 * Котрі роковини настануть цього разу.
 *
 * Рік народження й рік початку стосунків уже лежать у `date` — з них
 * прямо випливає і вік, і «скільки років разом». Досі з цієї арифметики
 * не виводилось нічого.
 *
 * Нуль означає «це та сама подія, що й оригінал» (перше настання) — тоді
 * показувати нема чого, і підпис не малюється.
 */
export function occurrenceYears(ev: EnrichedEvent): number {
  return ev.nextDate.getFullYear() - localDateFromISO(ev.date).getFullYear();
}

/**
 * Підпис роковин під тип події, або null коли він не має сенсу.
 *
 * Для свята рік походження нічого не означає: «Новий рік, 26 років» —
 * нісенітниця. Для дня народження це вік, для річниці — скільки років
 * разом.
 */
export function occurrenceLabel(ev: EnrichedEvent): string | null {
  const years = occurrenceYears(ev);
  if (years <= 0) return null;
  const word = pluralUA(years, ['рік', 'роки', 'років']);
  if (ev.type === 'birthday') return `виповниться ${years} ${word}`;
  if (ev.type === 'anniversary') return `${years} ${word} разом`;
  return null;
}

export function enrichEvent(ev: EventRow): EnrichedEvent {
  const { date: nextDate, passed } = nextOccurrence(ev);
  return { ...ev, nextDate, days: daysUntil(nextDate), passed };
}

/** Сортування: майбутні за близькістю, минулі — в кінець. */
export function sortEnriched(a: EnrichedEvent, b: EnrichedEvent): number {
  if (a.passed && !b.passed) return 1;
  if (!a.passed && b.passed) return -1;
  return a.days - b.days;
}
