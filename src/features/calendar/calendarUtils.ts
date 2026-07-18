// ============================================================
// Календар — константи та чисті утиліти дат (порт із calendar.js)
// ------------------------------------------------------------
// Жодного парсингу тегів: план читає ev.metadata (PlanMetadata).
// planMetadataOf() дає безпечний дефолт для подій без metadata
// (легасі до бекфілу або не-плани).
// ============================================================
import type {
  EventRow,
  EnrichedEvent,
  EventType,
  PlanCategory,
  PlanStatus,
} from '@/types';

// planMetadataOf живе у _shared (спільний із головною). Реекспорт для календаря.
export { planMetadataOf } from '@/features/_shared/events';

export const MONTHS = [
  'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
  'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня',
] as const;

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
/** Наступне настання події (щорічні перераховуються на цей/наступний рік). */
export function nextOccurrence(ev: EventRow): { date: Date; passed: boolean } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const orig = new Date(ev.date);

  if (!ev.yearly) {
    const d = new Date(orig.getFullYear(), orig.getMonth(), orig.getDate());
    return { date: d, passed: d < today };
  }
  let next = new Date(today.getFullYear(), orig.getMonth(), orig.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, orig.getMonth(), orig.getDate());
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
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()} р.`;
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
