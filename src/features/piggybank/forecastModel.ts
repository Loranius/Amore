const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);

  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

export function localTodayIso(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDesiredDate(value: string, today = localTodayIso()): boolean {
  return parseIsoDate(value) !== null && value >= today;
}

export function formatGoalDate(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return '';
  return date.toLocaleDateString('uk-UA', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatGoalMonth(value: string): string {
  const date = parseIsoDate(value);
  if (!date) return '';
  return date.toLocaleDateString('uk-UA', {
    month: 'long',
    year: 'numeric',
  });
}
