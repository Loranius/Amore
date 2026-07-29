import { parseCalendarDate } from '../calendar';
import {
  CALENDAR_MILESTONE_PRESSURE,
  CALENDAR_RECURRENCE_PRESSURE,
  CALENDAR_REGULAR_PRESSURE,
} from './rules';
import type {
  CalendarEventSource,
  EvolutionAdapterContext,
  EvolutionAdapterResult,
} from './types';
import {
  diagnostic,
  emptyAdapterResult,
  eventOccursBy,
  validateAdapterContext,
  withPressure,
} from './utils';

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function recurrenceDate(
  sourceDate: { month: number; day: number },
  year: number,
  leapDayPolicy: EvolutionAdapterContext['leapDayPolicy'],
): string {
  if (sourceDate.month === 2 && sourceDate.day === 29) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    if (!leap) return leapDayPolicy === 'feb-28' ? `${year}-02-28` : `${year}-03-01`;
  }
  return `${year}-${pad(sourceDate.month)}-${pad(sourceDate.day)}`;
}

export function adaptCalendarEvents(
  rows: readonly CalendarEventSource[],
  context: EvolutionAdapterContext,
): EvolutionAdapterResult {
  const result = emptyAdapterResult();
  const asOfEpoch = validateAdapterContext(context);
  const asOfDate = parseCalendarDate(context.asOf, context.timeZone);
  if (!asOfDate) throw new Error(`Invalid adapter asOf: "${context.asOf}".`);

  for (const row of rows) {
    // Birthdays and generic holidays belong to the calendar UI, not to the
    // couple's structural history. Legacy `other` records are ignored too.
    if (row.type !== 'anniversary') continue;

    const sourceDate = parseCalendarDate(row.date, context.timeZone);
    const occursBy = eventOccursBy(row.date, asOfEpoch);
    if (!sourceDate || occursBy === null) {
      result.diagnostics.push(diagnostic(
        'calendar',
        'invalid_date',
        row.id,
        'Relationship event has an invalid date.',
      ));
      continue;
    }
    if (!occursBy) continue;

    const basePressure = row.isMilestone
      ? CALENDAR_MILESTONE_PRESSURE
      : CALENDAR_REGULAR_PRESSURE;

    result.events.push({
      id: `calendar:${row.id}:origin`,
      episodeId: `calendar:${row.id}:origin`,
      occurredAt: row.date,
      source: `calendar@${context.rulesVersion}`,
      evidence: 'verified',
      channels: withPressure(basePressure),
      portalActivity: row.isMilestone ? 0.24 : 0.14,
    });

    if (!row.yearly) continue;

    for (let year = sourceDate.year + 1; year <= asOfDate.year; year += 1) {
      const occurredAt = recurrenceDate(sourceDate, year, context.leapDayPolicy);
      if (eventOccursBy(occurredAt, asOfEpoch) !== true) continue;
      result.events.push({
        id: `calendar:${row.id}:year:${year}`,
        occurredAt,
        source: `calendar@${context.rulesVersion}`,
        evidence: 'historical-estimate',
        channels: withPressure(CALENDAR_RECURRENCE_PRESSURE),
        portalActivity: 0.05,
      });
    }
  }

  return result;
}
