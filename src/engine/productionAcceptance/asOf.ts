function datePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  const value = parts.find((part) => part.type === type)?.value;
  if (!value) throw new Error(`Tree Production asOf could not resolve ${type}.`);
  return value;
}

/**
 * Pins portal-history builds to one stable timestamp per relationship-local day.
 * Reloading the portal during the same day therefore cannot change the tree only
 * because a few seconds passed between mounts.
 */
export function resolveTreeProductionAsOf(
  value: Date | string | number,
  timeZone = 'Europe/Kyiv',
): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Tree Production asOf requires a valid date.');
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = datePart(parts, 'year');
  const month = datePart(parts, 'month');
  const day = datePart(parts, 'day');

  return `${year}-${month}-${day}T12:00:00.000Z`;
}
