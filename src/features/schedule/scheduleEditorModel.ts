import { daysInMonth, ymd } from '@/features/_shared/month';
import type { ScheduleChange, ScheduleMark } from './useSchedule';

export type TemplateKind = 'two-two' | 'three-three' | 'weekdays';

export function markLabel(mark: ScheduleMark): string {
  if (mark === 'Р') return 'Робота';
  if (mark === 'Х') return 'Вихідний';
  return 'Очистити';
}

export function normalizeMark(mark: string | undefined): ScheduleMark {
  return mark === 'Р' || mark === 'Х' ? mark : '';
}

function templateMark(kind: TemplateKind, yr: number, mo: number, day: number): ScheduleMark {
  if (kind === 'weekdays') {
    const weekDay = new Date(yr, mo - 1, day).getDay();
    return weekDay === 0 || weekDay === 6 ? 'Х' : 'Р';
  }

  const blockSize = kind === 'two-two' ? 2 : 3;
  const block = Math.floor((day - 1) / blockSize);
  return block % 2 === 0 ? 'Р' : 'Х';
}

export function templateLabel(kind: TemplateKind): string {
  if (kind === 'two-two') return '2 через 2';
  if (kind === 'three-three') return '3 через 3';
  return 'Пн–Пт';
}

export function buildTemplateChanges(
  userId: number,
  yr: number,
  mo: number,
  kind: TemplateKind,
): ScheduleChange[] {
  return Array.from({ length: daysInMonth(yr, mo) }, (_, index) => ({
    userId,
    date: ymd(yr, mo, index + 1),
    mark: templateMark(kind, yr, mo, index + 1),
  }));
}

export function buildClearChanges(userId: number, yr: number, mo: number): ScheduleChange[] {
  return Array.from({ length: daysInMonth(yr, mo) }, (_, index) => ({
    userId,
    date: ymd(yr, mo, index + 1),
    mark: '',
  }));
}

export function buildCopyChanges({
  userId,
  yr,
  mo,
  previousYr,
  previousMo,
  previousMarks,
}: {
  userId: number;
  yr: number;
  mo: number;
  previousYr: number;
  previousMo: number;
  previousMarks: Record<string, string>;
}): ScheduleChange[] {
  const total = daysInMonth(yr, mo);
  const previousTotal = daysInMonth(previousYr, previousMo);
  return Array.from({ length: total }, (_, index) => {
    const day = index + 1;
    const previousDate = day <= previousTotal ? ymd(previousYr, previousMo, day) : '';
    return {
      userId,
      date: ymd(yr, mo, day),
      mark: previousDate ? normalizeMark(previousMarks[previousDate]) : '',
    };
  });
}
